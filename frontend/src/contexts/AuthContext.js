import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { rememberAccount, storedAccountToken, dropAccountToken, forgetAccount } from "@/lib/rememberedAccounts";
import { isNative } from "@/native/capacitor";
import { subscribe, loadStored, setSession, clearSession, clearPrivateCaches, refreshSession, logoutRemote, decodeExp, expiresWithin, getToken, getUser, SESSION_PERSISTENT_KEY } from "@/lib/session";

// La sesión vive en lib/session.js (access corto + refresh rotatorio). Este contexto solo la expone a React.
const native = () => { try { return isNative(); } catch { return false; } };

const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
  updateUser: () => {},
  isLoading: true,
  isAuthenticated: false,
  sessionPersistent: true,
});

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function AuthProvider({ children }) {
  const [snap, setSnap] = useState({ user: null, token: null });
  const [isLoading, setIsLoading] = useState(true);
  const [sessionPersistent, setSessionPersistent] = useState(true);
  const wakeAt = useRef(0);

  useEffect(() => subscribe(setSnap), []);

  // Arranque: usuario en caché → pantalla de carga mientras se renueva → nunca al login por un fallo de red.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setSessionPersistent(localStorage.getItem(SESSION_PERSISTENT_KEY) !== "false");
        // Tope de seguridad: si el Keystore/plugin no responde, la app no se queda en el logo para siempre.
        const stored = await Promise.race([loadStored(), new Promise((res) => setTimeout(() => res({ user: null, token: null, refreshToken: null, timedOut: true }), 8000))]);
        if (stored.timedOut) console.warn("[BRUNO] loadStored superó 8 s; se continúa sin sesión en caché");
        setSnap({ user: stored.user, token: stored.token });
        if (native() && !stored.user && !stored.token && !stored.refreshToken) return;
        const r = await refreshSession();
        if (cancelled) return;
        if (r.fatal) clearSession();
        else if (r.ok) refreshUser(r.token);
      } catch { /* sin red: se conserva el usuario en caché */ } finally { if (!cancelled) setIsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Renovación proactiva (antes de caducar) y al volver a primer plano / recuperar conexión.
  useEffect(() => {
    if (!snap.user) return undefined;
    const renew = async () => { const r = await refreshSession(); if (r.fatal) clearSession(); };
    const delay = snap.token ? Math.max(5000, decodeExp(snap.token) - Date.now() - 120000) : 15000;
    const timer = setTimeout(() => { if (navigator.onLine !== false) renew(); }, delay);
    const onWake = () => {
      if (document.visibilityState === "hidden" || navigator.onLine === false || Date.now() - wakeAt.current < 3000) return;
      wakeAt.current = Date.now();
      if (expiresWithin(5 * 60000)) renew();
    };
    window.addEventListener("online", onWake); window.addEventListener("focus", onWake); document.addEventListener("visibilitychange", onWake);
    let sub = null;
    if (native()) import("@capacitor/app").then(({ App }) => App.addListener("appStateChange", ({ isActive }) => { if (isActive) onWake(); })).then((s) => { sub = s; }).catch(() => {});
    return () => { clearTimeout(timer); window.removeEventListener("online", onWake); window.removeEventListener("focus", onWake); document.removeEventListener("visibilitychange", onWake); sub?.remove?.(); };
  }, [snap.token, snap.user?.id]);

  const refreshUser = useCallback(async (authToken = null) => {
    const currentToken = authToken || getToken();
    if (!currentToken) return null;
    try {
      const response = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${currentToken}` }, timeout: 10000, withCredentials: true });
      const userData = response.data;
      if (getUser() && getUser().id !== userData.id) return null; // la cuenta cambió mientras tanto: no mezclar
      await setSession({ user: userData });
      return userData;
    } catch {
      return null; // un 401 real ya lo resolvió el interceptor (renovar o cerrar sesión)
    }
  }, []);

  const login = async (userData, userToken, keepSession = true, refreshToken = null) => {
    const prev = getUser();
    if (prev && prev.id !== userData?.id) clearPrivateCaches();
    localStorage.setItem(SESSION_PERSISTENT_KEY, keepSession ? "true" : "false");
    setSessionPersistent(keepSession);
    await setSession({ user: userData, access_token: userToken, refresh_token: refreshToken });
    if (keepSession) { try { await rememberAccount(userData, refreshToken); } catch { /* ignore */ } }
    setIsLoading(false);
    await refreshUser(userToken);
  };

  const updateUser = async (updates) => {
    const token = getToken();
    if (!token || !getUser()) return false;
    try {
      const response = await axios.put(`${API}/auth/me`, updates, { headers: { Authorization: `Bearer ${token}` } });
      await setSession({ user: response.data });
      return true;
    } catch {
      return false;
    }
  };

  // Cerrar sesión: revoca access + familia de refresh en el servidor y borra todo lo privado del dispositivo.
  const logout = async () => {
    try { await logoutRemote(); } finally { clearSession(); }
  };

  // Cambiar de cuenta sin cerrar la actual (nativo): la sesión actual sigue guardada (su refresh token queda en el Keystore)
  // y la otra se restaura con el suyo. Si ese token caducó, solo esa cuenta pierde su sesión guardada.
  const switchAccount = async (account) => {
    const stored = await storedAccountToken(account.id);
    if (!stored) { const e = new Error("no-token"); e.code = "no-token"; throw e; }
    let r;
    try {
      r = await axios.post(`${API}/auth/refresh`, { refresh_token: stored, platform: "native" }, { __skipAuthRetry: true, timeout: 15000 });
    } catch (e) {
      const err = new Error(e?.response?.status === 401 ? "expired" : "network");
      err.code = err.message;
      if (err.code === "expired") dropAccountToken(account.id);
      throw err;
    }
    await login(r.data.user, r.data.access_token, true, r.data.refresh_token);
    return r.data.user;
  };

  // Quitar una cuenta guardada: revoca su sesión en el servidor (solo la suya) y la borra de la lista; si es la actual, cierra sesión.
  const removeAccount = async (account) => {
    const current = getUser();
    if (current && current.id === account.id) { await logout(); await forgetAccount(account.id); return; }
    const stored = await storedAccountToken(account.id);
    if (stored) { try { await axios.post(`${API}/auth/logout`, { refresh_token: stored }, { __skipAuthRetry: true, timeout: 10000 }); } catch { /* ya revocado o sin red: se borra igual del dispositivo */ } }
    await forgetAccount(account.id);
  };

  const setKeepSession = async (keep) => {
    setSessionPersistent(keep);
    localStorage.setItem(SESSION_PERSISTENT_KEY, keep ? "true" : "false");
    if (getUser() && !native()) await refreshSession(); // reemite las cookies como persistentes o de sesión
  };

  const value = {
    user: snap.user,
    token: snap.token,
    login,
    logout,
    switchAccount,
    removeAccount,
    refreshUser,
    updateUser,
    isLoading,
    isAuthenticated: !!snap.user,
    sessionPersistent,
    setKeepSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
