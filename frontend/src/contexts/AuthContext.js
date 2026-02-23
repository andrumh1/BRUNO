import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

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

// Storage keys
const TOKEN_KEY = "bruno_token";
const USER_KEY = "bruno_user";
const SESSION_PERSISTENT_KEY = "bruno_session_persistent";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionPersistent, setSessionPersistent] = useState(true);

  // Initialize from storage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedPersistent = localStorage.getItem(SESSION_PERSISTENT_KEY);
        const isPersistent = storedPersistent !== "false";
        setSessionPersistent(isPersistent);

        // Try to get token from localStorage or sessionStorage
        let storedToken = localStorage.getItem(TOKEN_KEY);
        if (!storedToken && !isPersistent) {
          storedToken = sessionStorage.getItem(TOKEN_KEY);
        }

        if (storedToken) {
          // Try to get cached user first for faster load
          const cachedUser = localStorage.getItem(USER_KEY);
          if (cachedUser) {
            try {
              setUser(JSON.parse(cachedUser));
            } catch (e) {
              console.error("Error parsing cached user:", e);
            }
          }

          setToken(storedToken);
          
          // Validate token with server in background
          await refreshUser(storedToken);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // Clear all auth data
  const clearAuth = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  // Refresh user data from server
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
      setUser(userData);
      setToken(currentToken);
      
      // Cache user data for faster loads
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      
      return userData;
    } catch (error) {
      console.error("Auth refresh failed:", error);
      
      // Only clear auth if it's an authentication error (401/403)
      if (error.response?.status === 401 || error.response?.status === 403) {
        clearAuth();
      }
      
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Login function
  const login = async (userData, userToken, keepSession = true) => {
    // Store token based on session preference
    if (keepSession) {
      localStorage.setItem(TOKEN_KEY, userToken);
      localStorage.setItem(SESSION_PERSISTENT_KEY, "true");
    } else {
      sessionStorage.setItem(TOKEN_KEY, userToken);
      localStorage.setItem(SESSION_PERSISTENT_KEY, "false");
    }
    
    // Cache user data
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    
    setToken(userToken);
    setUser(userData);
    setSessionPersistent(keepSession);
    
    // Refresh from server to ensure we have latest data
    await refreshUser(userToken);
  };

  // Update user data locally and on server
  const updateUser = async (updates) => {
    if (!token || !user) return false;

    try {
      const response = await axios.put(
        `${API}/auth/me`,
        updates,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const updatedUser = response.data;
      setUser(updatedUser);
      localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      
      return true;
    } catch (error) {
      console.error("Error updating user:", error);
      return false;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      // Notify server (optional - for audit logging)
      if (token) {
        await axios.post(
          `${API}/auth/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {}); // Ignore errors
      }
    } finally {
      clearAuth();
    }
  };

  // Toggle session persistence
  const setKeepSession = (keep) => {
    setSessionPersistent(keep);
    localStorage.setItem(SESSION_PERSISTENT_KEY, keep ? "true" : "false");
    
    if (token) {
      if (keep) {
        localStorage.setItem(TOKEN_KEY, token);
        sessionStorage.removeItem(TOKEN_KEY);
      } else {
        sessionStorage.setItem(TOKEN_KEY, token);
        localStorage.removeItem(TOKEN_KEY);
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
