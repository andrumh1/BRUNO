/**
 * Mounted globally inside AuthProvider so we can read the current auth token.
 * When running on iOS/Android natively, registers for push and forwards the
 * FCM/APNs token to the backend so the server can send push via
 * routers/push_notifications.py.
 *
 * On the web this component is a no-op.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNativePush } from '@/native/useNativePush';
import { isNative } from '@/native/capacitor';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

export default function NativeBootstrap() {
  const { token } = useAuth() || {};
  const navigate = useNavigate();

  // Deep-link + push routing.
  useNativePush(
    () => token,
    ({ kind, data }) => {
      if (kind !== 'tapped') return;
      const payload = data?.notification?.data || data?.data || {};
      const url = payload.url || payload.deeplink || null;
      if (url && typeof url === 'string' && url.startsWith('/')) navigate(url);
    }
  );

  // Native chrome polish: hide the splash screen after the first render,
  // paint the status bar in BRUNO orange.
  useEffect(() => {
    if (!isNative()) return;
    (async () => {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#FF6A00' });
      } catch (_) { /* older iOS versions ignore setBackgroundColor */ }
      try { await SplashScreen.hide(); } catch (_) { /* ignore */ }
    })();
  }, []);

  return null;
}
