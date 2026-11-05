/* Google login (Emergent Auth).
 * Web: redirección normal a auth.emergentagent.com y vuelta a /dashboard#session_id=…
 * Nativo: el WebView vive en https://localhost (no existe fuera de la app), así que la vuelta de Google cae en la web
 * real (brunocard.com/dashboard?native_auth=<nonce>). Esa página canjea el session_id en el backend y deja una sesión
 * nativa de un solo uso bajo el nonce; la app la recoge por polling (no depende de que Chrome permita el esquema
 * com.brunocard.app://, que bloquea las redirecciones sin gesto del usuario). */
import axios from 'axios';
import { isNative } from '@/native/capacitor';

export const NATIVE_AUTH_DONE_LINK = 'com.brunocard.app://auth/done';
const EMERGENT_AUTH = 'https://auth.emergentagent.com/?redirect=';
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const POLL_MS = 2000;
const POLL_MAX_MS = 5 * 60 * 1000;

let pending = null; // { nonce, timer, startedAt }

const randomNonce = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, '0')).join('');

export function nativeHandoffPending() { return Boolean(pending); }

export function cancelNativeHandoff() {
  if (pending?.timer) clearTimeout(pending.timer);
  pending = null;
}

/** Un intento inmediato (se llama al volver la app al frente). Resuelve true si la sesión llegó. */
export async function pollNativeHandoffNow() {
  if (!pending) return false;
  const { nonce } = pending;
  try {
    const r = await axios.get(`${API}/auth/native-handoff/${nonce}`, { __skipAuthRetry: true, timeout: 8000 });
    if (r.data?.access_token) {
      cancelNativeHandoff();
      window.dispatchEvent(new CustomEvent('bruno:native-session', { detail: r.data }));
      return true;
    }
  } catch (_) { /* 404 = todavía no */ }
  return false;
}

function scheduleNativePoll() {
  if (!pending) return;
  if (Date.now() - pending.startedAt > POLL_MAX_MS) { cancelNativeHandoff(); return; }
  pending.timer = setTimeout(async () => { if (!(await pollNativeHandoffNow())) scheduleNativePoll(); }, POLL_MS);
}

export async function startGoogleLogin() {
  if (!isNative()) {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    window.location.href = `${EMERGENT_AUTH}${encodeURIComponent(window.location.origin + '/dashboard')}`;
    return;
  }
  cancelNativeHandoff();
  const nonce = randomNonce();
  pending = { nonce, timer: null, startedAt: Date.now() };
  const webOrigin = process.env.REACT_APP_BACKEND_URL; // web + API de producción (https://brunocard.com)
  const url = `${EMERGENT_AUTH}${encodeURIComponent(`${webOrigin}/dashboard?native_auth=${nonce}`)}`;
  scheduleNativePoll();
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.open(url, '_system');
  }
}

export async function closeNativeBrowser() {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* Android Custom Tabs no soporta close(); la app ya está al frente */ }
}
