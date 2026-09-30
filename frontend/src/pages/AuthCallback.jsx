import React, { useEffect, useRef } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processAuth = async () => {
      try {
        // Extract session_id from URL fragment
        const hash = window.location.hash;
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          // error handled
          navigate('/login');
          return;
        }

        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/google`, { session_id: sessionId });
        
        // Login user - use access_token (JWT) for API calls
        const token = response.data.access_token || response.data.session_token;
        login(response.data.user, token);
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (error) {
        // error handled
        navigate('/login');
      }
    };

    processAuth();
  }, [navigate, login]);

  return (
    <BrunoLoader message="Procesando autenticación…" />
  );
};

export default AuthCallback;
