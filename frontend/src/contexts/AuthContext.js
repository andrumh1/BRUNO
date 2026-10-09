import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";
import { secureStorage } from "@/utils/secureStorage";

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

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const USER_KEY = "user";
const TOKEN_KEY = "token";
const SESSION_PERSISTENT_KEY = "bruno_session_persistent";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionPersistent, setSessionPersistent] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedPersistent = localStorage.getItem(SESSION_PERSISTENT_KEY);
        const isPersistent = storedPersistent !== "false";
        setSessionPersistent(isPersistent);

        // Migrate from old unencrypted storage if present
        const oldToken = localStorage.getItem("bruno_token");
        if (oldToken) {
          await secureStorage.setItem(TOKEN_KEY, oldToken);
          localStorage.removeItem("bruno_token");
          localStorage.removeItem("bruno_user");
        }

        let storedToken = await secureStorage.getItem(TOKEN_KEY);
        if (!storedToken && !isPersistent) {
          storedToken = sessionStorage.getItem(TOKEN_KEY);
        }

        if (storedToken) {
          const cachedUser = await secureStorage.getItem(USER_KEY);
          if (cachedUser) {
            try { setUser(JSON.parse(cachedUser)); } catch {}
          }
          setToken(storedToken);
          await refreshUser(storedToken);
        }
      } catch {
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  // Per-account private caches (chat drafts, offline outbox, translation prefs) must never survive an account switch.
  const clearPrivateCaches = () => {
    try {
      const doomed = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith("bruno_draft_") || k.startsWith("bruno_outbox_") || k.startsWith("bruno_autotranslate_"))) doomed.push(k);
      }
      doomed.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  };

  const clearAuth = () => {
    secureStorage.removeItem(TOKEN_KEY);
    secureStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    // Also clean up old unencrypted storage
    localStorage.removeItem("bruno_token");
    localStorage.removeItem("bruno_user");
    clearPrivateCaches();
    setToken(null);
    setUser(null);
  };

  const refreshUser = useCallback(async (authToken = null) => {
    const currentToken = authToken || token;
    if (!currentToken) {
      setIsLoading(false);
      return null;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
        timeout: 10000,
      });

      const userData = response.data;
      let activeToken = currentToken;
      if (userData.refreshed_token) {
        activeToken = userData.refreshed_token;
        await secureStorage.setItem(TOKEN_KEY, activeToken);
        delete userData.refreshed_token;
      }

      setUser(userData);
      setToken(activeToken);
      await secureStorage.setItem(USER_KEY, JSON.stringify(userData));
      return userData;
    } catch (error) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAuth();
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (userData, userToken, keepSession = true) => {
    if (user && user.id !== userData?.id) clearPrivateCaches();
    if (keepSession) {
      await secureStorage.setItem(TOKEN_KEY, userToken);
      localStorage.setItem(SESSION_PERSISTENT_KEY, "true");
    } else {
      sessionStorage.setItem(TOKEN_KEY, userToken);
      localStorage.setItem(SESSION_PERSISTENT_KEY, "false");
    }
    await secureStorage.setItem(USER_KEY, JSON.stringify(userData));

    setToken(userToken);
    setUser(userData);
    setSessionPersistent(keepSession);
    await refreshUser(userToken);
  };

  const updateUser = async (updates) => {
    if (!token || !user) return false;
    try {
      const response = await axios.put(`${API}/auth/me`, updates, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updatedUser = response.data;
      setUser(updatedUser);
      await secureStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      return true;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await axios.post(`${API}/auth/logout`, {}, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      clearAuth();
    }
  };

  const setKeepSession = async (keep) => {
    setSessionPersistent(keep);
    localStorage.setItem(SESSION_PERSISTENT_KEY, keep ? "true" : "false");
    if (token) {
      if (keep) {
        await secureStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(TOKEN_KEY);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
        secureStorage.removeItem(TOKEN_KEY);
      }
    }
  };

  const value = {
    user,
    token,
    login,
    logout,
    refreshUser,
    updateUser,
    isLoading,
    isAuthenticated: !!user && !!token,
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
