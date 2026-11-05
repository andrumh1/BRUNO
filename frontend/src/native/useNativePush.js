/**
 * Native push-notifications bootstrap (FCM en Android e iOS; en iOS el AppDelegate convierte APNs → FCM).
 *
 *   1. Al arrancar NO pide permisos ni llama a Firebase. Solo re-registra el dispositivo si el usuario ya
 *      concedió el permiso antes y Firebase está configurado (google-services.json → recurso google_app_id).
 *      Sin google-services.json, PushNotifications.register() mataría el proceso
 *      ("Default FirebaseApp is not initialized"), así que ni se llama: la app abre sin push.
 *   2. El permiso se pide solo por acción del usuario (Ajustes → Notificaciones) con enableNativePush().
 *   3. Guarda el token FCM en memoria y lo envía a /api/mobile/devices/register SOLO con sesión iniciada,
 *      y lo reenvía cuando el usuario inicia sesión (nunca queda un token sin dueño o con el dueño anterior).
 *   4. Al cerrar sesión, da de baja el token en el backend.
 *   5. Enruta los toques en notificaciones a la pantalla correcta.
 *
 * En web este hook no hace nada (Web Push VAPID vive aparte).
 */
import { useEffect, useRef } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';
import { isNative, platform } from './capacitor';
import { deviceCaps } from './deviceCaps';

const API = process.env.REACT_APP_BACKEND_URL;
const APP_VERSION = '1.0.0';

export async function registerDeviceToken(fcmToken, authToken) {
  if (!fcmToken || !authToken) return;
  try {
    await axios.post(`${API}/api/mobile/devices/register`, {
      device_token: fcmToken,
      platform: platform(),
      app_version: APP_VERSION,
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { headers: { Authorization: `Bearer ${authToken}` } });
  } catch (_) { /* se reintenta en el siguiente arranque o login */ }
}

export async function unregisterDeviceToken(fcmToken, authToken) {
  if (!fcmToken || !authToken) return;
  try {
    await axios.post(`${API}/api/mobile/devices/unregister`, { device_token: fcmToken }, { headers: { Authorization: `Bearer ${authToken}` } });
  } catch (_) { /* el backend también desactiva el token cuando otro usuario lo registra */ }
}

/** true solo si es seguro llamar a PushNotifications.register() (Firebase configurado o iOS). */
export async function nativePushAvailable() {
  if (!isNative()) return false;
  const caps = await deviceCaps();
  if (!caps.firebase) {
    console.info('[BRUNO native] push desactivado: falta google-services.json (Firebase). La app funciona sin push.');
    return false;
  }
  return true;
}

export async function nativePushPermission() {
  if (!isNative()) return 'denied';
  try { return (await PushNotifications.checkPermissions()).receive; } catch { return 'denied'; }
}

/** Acción del usuario (Ajustes → Notificaciones): pide el permiso y registra el dispositivo. Nunca al arrancar. */
export async function enableNativePush() {
  if (!(await nativePushAvailable())) return false;
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await PushNotifications.register();
    return true;
  } catch (_) { return false; } /* sin Play Services / permiso denegado: la app sigue */
}

export function useNativePush(authToken, onNotification) {
  const fcmRef = useRef(null);
  const lastAuthRef = useRef(null);
  const cbRef = useRef(onNotification);
  cbRef.current = onNotification;

  useEffect(() => {
    if (!isNative()) return undefined;
    let mounted = true;
    const s1 = PushNotifications.addListener('registration', (t) => {
      if (!mounted) return;
      fcmRef.current = t.value;
      if (lastAuthRef.current) registerDeviceToken(t.value, lastAuthRef.current);
    });
    const s2 = PushNotifications.addListener('registrationError', () => { /* el usuario puede reintentar desde Ajustes */ });
    const s3 = PushNotifications.addListener('pushNotificationReceived', (n) => cbRef.current?.({ kind: 'received', data: n }));
    const s4 = PushNotifications.addListener('pushNotificationActionPerformed', (n) => cbRef.current?.({ kind: 'tapped', data: n }));
    // Arranque perezoso: sin prompt. Solo si Firebase existe y el permiso YA estaba concedido.
    (async () => {
      if (!(await nativePushAvailable())) return;
      if ((await nativePushPermission()) !== 'granted' || !mounted) return;
      try { await PushNotifications.register(); } catch (_) { /* sin Play Services: registrationError, sin crash */ }
    })();
    return () => {
      mounted = false;
      [s1, s2, s3, s4].forEach((s) => s.then((h) => h.remove()).catch(() => {}));
    };
  }, []);

  // Login → registrar el token FCM a nombre de este usuario. Logout → darlo de baja.
  useEffect(() => {
    if (!isNative()) return;
    const prev = lastAuthRef.current;
    lastAuthRef.current = authToken || null;
    if (authToken && fcmRef.current) registerDeviceToken(fcmRef.current, authToken);
    else if (!authToken && prev && fcmRef.current) unregisterDeviceToken(fcmRef.current, prev);
  }, [authToken]);
}
