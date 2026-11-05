/* Google login (Emergent Auth).
 * Web: redirección normal a auth.emergentagent.com y vuelta a /dashboard#session_id=…
 * Nativo: Google exige un navegador real (Custom Tab de @capacitor/browser, dentro de la app; nunca un WebView).
 * El WebView vive en https://localhost (no existe fuera de la app), así que la vuelta de Google cae en la web real
 * (brunocard.com/dashboard?native_auth=<nonce>): esa página canjea el session_id en el backend y deja una sesión nativa
 * de un solo uso bajo el nonce; la app la recoge por polling y al volver al frente. Estado visible vía 'bruno:google-status'. */
import axios from 'axios';
import { isNative } from '@/native/capacitor';
import { deviceCaps } from '@/native/deviceCaps';

export const NATIVE_AUTH_DONE_LINK = 'com.brunocard.app://auth/done';
const EMERGENT_AUTH = 'https://auth.emergentagent.com/?redirect=';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 2000;
const POLL_MAX_MS = 5 * 60 * 1000;
const AFTER_CLOSE_GRACE_MS = 6000;

export const GOOGLE_ERRORS = {
  no_browser: 'Este dispositivo no tiene un navegador (Chrome). Google exige un navegador para iniciar sesión: instala Chrome o, en el emulador, usa una imagen con Google Play. También puedes entrar con tu correo.',
  open_failed: 'No se pudo abrir la ventana de Google. Inténtalo de nuevo.',
  not_completed: 'No se completó el inicio de sesión con Google. Inténtalo de nuevo.',
  timeout: 'Se agotó el tiempo esperando a Google. Inténtalo de nuevo.',
  network: 'No se pudo conectar con BRUNO. Revisa tu internet e inténtalo de nuevo.',
};

let pending = null; // { nonce, timer, startedAt, closeTimer, finishedSub }

const emitStatus = (status, message = '') => window.dispatchEvent(new CustomEvent('bruno:google-status', { detail: { status, message } }));
const randomNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

export function nativeHandoffPending() { return Boolean(pending); }

export function cancelNativeHandoff(silent = false) {
  if (pending?.timer) clearTimeout(pending.timer);
  if (pending?.closeTimer) clearTimeout(pending.closeTimer);
  pending?.finishedSub?.then((h) => h.remove()).catch(() => {});
  pending = null;
  if (!silent) emitStatus('idle');
}

/** Un intento inmediato (se llama al volver la app al frente). Resuelve true si la sesión llegó. */
export async function pollNativeHandoffNow() {
  if (!pending) return false;
  const { nonce } = pending;
  try {
    const r = await axios.get(`${API}/auth/native-handoff/${nonce}`, { __skipAuthRetry: true, timeout: 8000 });
    if (r.data?.access_token) {
      cancelNativeHandoff(true);
      emitStatus('done');
      window.dispatchEvent(new CustomEvent('bruno:native-session', { detail: r.data }));
      return true;
    }
  } catch (e) {
    if (!e?.response && pending) emitStatus('waiting', GOOGLE_ERRORS.network); // sin red: seguimos esperando, pero se avisa
  }
  return false;
}

function scheduleNativePoll() {
  if (!pending) return;
  if (Date.now() - pending.startedAt > POLL_MAX_MS) { cancelNativeHandoff(true); emitStatus('error', GOOGLE_ERRORS.timeout); return; }
  pending.timer = setTimeout(async () => { if (!(await pollNativeHandoffNow())) scheduleNativePoll(); }, POLL_MS);
}

export async function startGoogleLogin() {
  if (!isNative()) {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    window.location.href = `${EMERGENT_AUTH}${encodeURIComponent(window.location.origin + '/dashboard')}`;
    return;
  }
  cancelNativeHandoff(true);
  emitStatus('opening');
  const caps = await deviceCaps();
  if (caps.browser === false) { emitStatus('error', GOOGLE_ERRORS.no_browser); return; }
  const nonce = randomNonce();
  pending = { nonce, timer: null, startedAt: Date.now(), closeTimer: null, finishedSub: null };
  const webOrigin = process.env.REACT_APP_BACKEND_URL; // web + API de producción (https://brunocard.com)
  const url = `${EMERGENT_AUTH}${encodeURIComponent(`${webOrigin}/dashboard?native_auth=${nonce}`)}`;
  try {
    const { Browser } = await import('@capacitor/browser');
    // Si el usuario cierra la ventana de Google sin terminar: un último intento y, si no llegó la sesión, error claro.
    pending.finishedSub = Browser.addListener('browserFinished', () => {
      if (!pending) return;
      pending.closeTimer = setTimeout(async () => {
        if (pending && !(await pollNativeHandoffNow())) { cancelNativeHandoff(true); emitStatus('error', GOOGLE_ERRORS.not_completed); }
      }, AFTER_CLOSE_GRACE_MS);
    });
    await Browser.open({ url, presentationStyle: 'popover', toolbarColor: '#ffffff' });
  } catch (e) {
    console.warn('[BRUNO native] Browser.open falló:', e?.message || e);
    cancelNativeHandoff(true);
    emitStatus('error', GOOGLE_ERRORS.open_failed);
    return;
  }
  emitStatus('waiting');
  scheduleNativePoll();
}

export async function closeNativeBrowser() {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* Android Custom Tabs no soporta close(); la app ya está al frente */ }
}
