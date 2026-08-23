/**
 * Native push-notifications bootstrap.
 *
 * On iOS/Android:
 *   1. Requests permission
 *   2. Registers the device with FCM (Android) / APNs (iOS)
 *   3. On registration, POSTs the token to /api/mobile/devices/register
 *      so the backend can send push via Firebase / APNs.
 *   4. Wires listeners so incoming pushes route to the right screen.
 *
 * On the web, this hook is a no-op (Web Push VAPID flow lives elsewhere).
 */
import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import axios from 'axios';
import { isNative, platform } from './capacitor';

const API = process.env.REACT_APP_BACKEND_URL;

async function registerToken(token, authToken) {
  try {
    await axios.post(
      `${API}/api/mobile/devices/register`,
      {
        device_token: token,
        platform: platform(), // 'ios' | 'android'
        app_version: '1.0.0',
        locale: navigator.language,
      },
      { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} }
    );
  } catch (_) {
    /* silent — token will retry on next boot */
  }
}

export function useNativePush(getAuthToken, onNotification) {
  useEffect(() => {
    if (!isNative()) return undefined;

    let mounted = true;

    (async () => {
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive !== 'granted') return;
      await PushNotifications.register();
    })();

    const s1 = PushNotifications.addListener('registration', (t) => {
      if (!mounted) return;
      const auth = getAuthToken?.();
      registerToken(t.value, auth);
    });

    const s2 = PushNotifications.addListener('registrationError', () => {
      /* user can retry manually from Settings */
    });

    const s3 = PushNotifications.addListener('pushNotificationReceived', (n) => {
      onNotification?.({ kind: 'received', data: n });
    });

    const s4 = PushNotifications.addListener('pushNotificationActionPerformed', (n) => {
      onNotification?.({ kind: 'tapped', data: n });
    });

    // Handle app resume — could re-check pending notifications here.
    const s5 = App.addListener('appStateChange', () => {
      /* place hook for future needs (badge clear, deep-link resolve, etc.) */
    });

    return () => {
      mounted = false;
      s1.then((h) => h.remove());
      s2.then((h) => h.remove());
      s3.then((h) => h.remove());
      s4.then((h) => h.remove());
      s5.then((h) => h.remove());
    };
  }, [getAuthToken, onNotification]);
}
