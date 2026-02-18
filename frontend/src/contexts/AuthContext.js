import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  refreshUser: () => {},
  isLoading: true,
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  // Function to refresh user data from server
  const refreshUser = useCallback(async (authToken = null) => {
    const currentToken = authToken || token || localStorage.getItem("token");
    if (!currentToken) {
      setIsLoading(false);
      return null;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      setUser(response.data);
      setToken(currentToken);
      return response.data;
    } catch (error) {
      console.error("Auth refresh failed:", error);
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    
    // Also refresh from server to ensure we have latest data
    await refreshUser(userToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("token");
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, refreshUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined)
    throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
