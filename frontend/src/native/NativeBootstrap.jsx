/**
 * Mounted globally inside AuthProvider + Router. On iOS/Android it wires:
 * push (FCM/APNs → backend), safe areas / status bar, splash, keyboard, Android back button,
 * deep links (com.brunocard.app:// and https App Links) and the biometric lock.
 * On the web this component is a no-op.
 */
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useNativePush } from '@/native/useNativePush';
import { isNative, isIOS } from '@/native/capacitor';
import BiometricGate from '@/native/BiometricGate';
import ApiStatusBanner from '@/native/ApiStatusBanner';
import { App } from '@capacitor/app';
import { Keyboard } from '@capacitor/keyboard';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { SafeArea } from '@capacitor-community/safe-area';

const API = process.env.REACT_APP_BACKEND_URL;
const ROOT_PATHS = new Set(['/', '/reels', '/login', '/feed']);

const syncStatusBarStyle = () => {
  const dark = document.documentElement.classList.contains('dark');
  StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
};

const pathFromDeepLink = (raw) => {
  try {
    const u = new URL(raw);
    if (u.protocol.startsWith('http')) return `${u.pathname}${u.search}${u.hash}`;
    return `/${u.host}${u.pathname}${u.search}${u.hash}`.replace(/\/{2,}/g, '/');
  } catch { return null; }
};

export default function NativeBootstrap() {
  const { token } = useAuth() || {};
  const navigate = useNavigate();
  const location = useLocation();

  useNativePush(
    token,
    ({ kind, data }) => {
      if (kind !== 'tapped') return;
      const payload = data?.notification?.data || data?.data || {};
      const url = payload.url || payload.deeplink || null;
      if (url && typeof url === 'string' && url.startsWith('/')) navigate(url);
    }
  );

  useEffect(() => {
    if (!isNative()) return undefined;
    document.documentElement.classList.add('is-native');
    console.info('[BRUNO native] API base:', API);
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
      if (isIOS()) {
        Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
        Keyboard.setScroll({ isDisabled: true }).catch(() => {});
      }
      try { await SplashScreen.hide({ fadeOutDuration: 250 }); } catch (_) { /* ignore */ }
    })();
    const kbShow = Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.dataset.keyboard = 'open';
      document.documentElement.style.setProperty('--native-kb', `${info?.keyboardHeight || 0}px`);
    });
    const kbHide = Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.dataset.keyboard = 'closed';
      document.documentElement.style.setProperty('--native-kb', '0px');
    });
    const urlOpen = App.addListener('appUrlOpen', ({ url }) => {
      const path = pathFromDeepLink(url);
      if (path) navigate(path);
    });
    App.getLaunchUrl?.().then((r) => { const p = r?.url && pathFromDeepLink(r.url); if (p && p !== '/') navigate(p); }).catch(() => {});
    return () => {
      observer?.disconnect();
      kbShow.then((h) => h.remove()); kbHide.then((h) => h.remove()); urlOpen.then((h) => h.remove());
    };
  }, []); // eslint-disable-line

  // Android hardware back: close keyboard/sheets first, then go back, exit only from a root screen.
  useEffect(() => {
    if (!isNative()) return undefined;
    const sub = App.addListener('backButton', () => {
      if (document.activeElement && document.activeElement !== document.body) { document.activeElement.blur(); return; }
      const openSheet = document.querySelector('[data-state="open"][role="dialog"], [data-sheet-open="true"]');
      if (openSheet) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return; }
      if (ROOT_PATHS.has(location.pathname) || window.history.length <= 1) App.exitApp();
      else navigate(-1);
    });
    return () => { sub.then((h) => h.remove()); };
  }, [location.pathname, navigate]);

  if (!isNative()) return null;
  return (<><BiometricGate /><ApiStatusBanner /></>);
}
