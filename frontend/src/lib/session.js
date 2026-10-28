/* Sesión BRUNO (única fuente de verdad fuera de React):
 *  - access token corto (en memoria; en nativo también cifrado en Keychain/Keystore para arrancar sin red),
 *  - refresh token rotatorio (web: cookie httpOnly que el navegador envía solo a /api/auth; nativo: Keychain/Keystore),
 *  - renovación única en vuelo con reintentos ante fallos de red; solo un 401/403 real cierra la sesión. */
import axios from "axios";
import { secureStorage } from "@/utils/secureStorage";
import { isNative } from "@/native/capacitor";
import { dropAccountToken, syncAccountToken } from "@/lib/rememberedAccounts";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const USER_KEY = "user";
const ACCESS_KEY = "token";
const REFRESH_KEY = "refresh";
export const SESSION_PERSISTENT_KEY = "bruno_session_persistent";

const native = () => { try { return isNative(); } catch { return false; } };
const state = { user: null, token: null, refreshToken: null };
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn({ user: state.user, token: state.token }));

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getToken = () => state.token;
export const getUser = () => state.user;
export const hasSession = () => !!(state.user || state.token || state.refreshToken);
export const decodeExp = (jwt) => { try { return (JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).exp || 0) * 1000; } catch { return 0; } };
export const expiresWithin = (ms) => !state.token || decodeExp(state.token) - Date.now() < ms;

/** Carga lo guardado en el dispositivo al arrancar (usuario en caché; tokens solo en nativo). */
export async function loadStored() {
  const legacy = localStorage.getItem("bruno_token");
  if (legacy) { if (native()) await secureStorage.setItem(ACCESS_KEY, legacy); localStorage.removeItem("bruno_token"); localStorage.removeItem("bruno_user"); }
  const [user, token, refresh] = await Promise.all([secureStorage.getItem(USER_KEY), secureStorage.getItem(ACCESS_KEY), native() ? secureStorage.getItem(REFRESH_KEY) : null]);
  try { state.user = user ? JSON.parse(user) : null; } catch { state.user = null; }
  state.refreshToken = refresh || null;
  if (native()) state.token = token || null;
  else { state.token = null; secureStorage.removeItem(ACCESS_KEY); sessionStorage.removeItem(ACCESS_KEY); } // web: nunca tokens en el navegador
  return { user: state.user, token: state.token, refreshToken: state.refreshToken };
}

export async function setSession({ user, access_token, refresh_token } = {}) {
  if (user) state.user = user;
  if (access_token) state.token = access_token;
  if (refresh_token) state.refreshToken = refresh_token;
  if (user) await secureStorage.setItem(USER_KEY, JSON.stringify(user));
  if (native()) {
    if (access_token) await secureStorage.setItem(ACCESS_KEY, access_token);
    if (refresh_token) { await secureStorage.setItem(REFRESH_KEY, refresh_token); await syncAccountToken(state.user?.id, refresh_token); }
  }
  emit();
}

/* Cachés privadas por cuenta (borradores, outbox, preferencias de traducción): nunca sobreviven a un cambio de cuenta. */
export function clearPrivateCaches() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && /^bruno_(draft_|outbox_|autotranslate_)/.test(k)) doomed.push(k); }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}

export function clearSession() {
  const uid = state.user?.id;
  state.user = null; state.token = null; state.refreshToken = null;
  [USER_KEY, ACCESS_KEY, REFRESH_KEY].forEach((k) => secureStorage.removeItem(k));
  sessionStorage.removeItem(ACCESS_KEY); localStorage.removeItem("bruno_token"); localStorage.removeItem("bruno_user");
  dropAccountToken(uid);
  clearPrivateCaches();
  emit();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let inflight = null;

/** Renueva access (+ rota refresh). Nunca lanza: { ok, token, user } | { ok:false, fatal } — fatal = la sesión ya no es válida. */
export function refreshSession({ attempts = 3 } = {}) {
  if (inflight) return inflight;
  inflight = (async () => {
    for (let i = 0; i < attempts; i++) {
      try {
        const headers = {};
        let body;
        if (native()) {
          if (!state.refreshToken && !state.token) return { ok: false, fatal: true, code: "no_session" };
          body = { platform: "native", refresh_token: state.refreshToken || undefined };
          if (!state.refreshToken) headers.Authorization = `Bearer ${state.token}`; // migración única de un token antiguo
        } else {
          body = { platform: "web", remember: localStorage.getItem(SESSION_PERSISTENT_KEY) !== "false" };
        }
        const r = await axios.post(`${API}/auth/refresh`, body, { withCredentials: true, timeout: 15000, headers, __skipAuthRetry: true });
        await setSession(r.data);
        return { ok: true, token: r.data.access_token, user: r.data.user };
      } catch (e) {
        const st = e.response?.status;
        if (st === 401 || st === 403) return { ok: false, fatal: true, code: e.response?.data?.detail?.code };
        if (i < attempts - 1) await sleep(700 * 2 ** i);
      }
    }
    return { ok: false, fatal: false };
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function logoutRemote() {
  const headers = state.token ? { Authorization: `Bearer ${state.token}` } : {};
  await axios.post(`${API}/auth/logout`, { refresh_token: state.refreshToken || undefined }, { headers, withCredentials: true, timeout: 8000, __skipAuthRetry: true }).catch(() => {});
}
