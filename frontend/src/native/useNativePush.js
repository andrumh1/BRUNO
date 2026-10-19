/**
 * Native push-notifications bootstrap (FCM en Android e iOS; en iOS el AppDelegate convierte APNs → FCM).
 *
 *   1. Pide permiso y registra el dispositivo.
 *   2. Guarda el token FCM en memoria y lo envía a /api/mobile/devices/register SOLO con sesión iniciada,
 *      y lo reenvía cuando el usuario inicia sesión (así nunca queda un token sin dueño o con el dueño anterior).
 *   3. Al cerrar sesión, da de baja el token en el backend para que el siguiente usuario del teléfono no reciba avisos ajenos.
 *   4. Enruta los toques en notificaciones a la pantalla correcta.
 *
 * En web este hook no hace nada (Web Push VAPID vive aparte).
 */
import { useEffect, useRef } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import axios from 'axios';
import { isNative, platform } from './capacitor';

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

export function useNativePush(authToken, onNotification) {
  const fcmRef = useRef(null);
  const lastAuthRef = useRef(null);
  const cbRef = useRef(onNotification);
  cbRef.current = onNotification;

  useEffect(() => {
    if (!isNative()) return undefined;
    let mounted = true;
    (async () => {
      try {
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;
        await PushNotifications.register();
      } catch (_) { /* dispositivo sin Play Services / permiso denegado */ }
    })();
    const s1 = PushNotifications.addListener('registration', (t) => {
      if (!mounted) return;
      fcmRef.current = t.value;
      if (lastAuthRef.current) registerDeviceToken(t.value, lastAuthRef.current);
    });
    const s2 = PushNotifications.addListener('registrationError', () => { /* el usuario puede reintentar desde Ajustes */ });
    const s3 = PushNotifications.addListener('pushNotificationReceived', (n) => cbRef.current?.({ kind: 'received', data: n }));
    const s4 = PushNotifications.addListener('pushNotificationActionPerformed', (n) => cbRef.current?.({ kind: 'tapped', data: n }));
    return () => {
      mounted = false;
      [s1, s2, s3, s4].forEach((s) => s.then((h) => h.remove()));
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
