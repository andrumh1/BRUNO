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
import { SafeArea } from '@capacitor-community/safe-area';

const syncStatusBarStyle = () => {
  const dark = document.documentElement.classList.contains('dark');
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
};

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

  // Native chrome: edge-to-edge with real safe-area insets (notch / status bar / gesture bar).
  // @capacitor-community/safe-area injects --safe-area-inset-* on Android where env() reports 0;
  // index.css combines both into --safe-top / --safe-bottom used by every top/bottom bar.
  useEffect(() => {
    if (!isNative()) return;
    let observer;
    (async () => {
      try {
        await SafeArea.enable({ config: { customColorsForSystemBars: true, statusBarColor: '#00000000', navigationBarColor: '#00000000', offset: 0 } });
      } catch (_) { /* iOS handles insets natively */ }
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        syncStatusBarStyle();
        observer = new MutationObserver(syncStatusBarStyle);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      } catch (_) { /* ignore */ }
      try { await SplashScreen.hide(); } catch (_) { /* ignore */ }
    })();
    return () => observer?.disconnect();
  }, []);

  return null;
}
