import React, { useEffect, useRef, useState } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { isNative } from "@/native/capacitor";
import { NATIVE_AUTH_SCHEME, closeNativeBrowser } from "@/lib/googleLogin";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);
  const [bounceUrl, setBounceUrl] = useState(null);
  const [error, setError] = useState(null);

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

        // Web abierta desde la app nativa (?native_auth=1): devolver el session_id a la app por su esquema, no iniciar sesión aquí.
        if (!isNative() && new URLSearchParams(window.location.search).get('native_auth') === '1') {
          const target = `${NATIVE_AUTH_SCHEME}#session_id=${encodeURIComponent(sessionId)}`;
          setBounceUrl(target);
          window.location.replace(target);
          return;
        }

        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/google`, { session_id: sessionId, platform: isNative() ? "native" : "web" }, { withCredentials: true, __skipAuthRetry: true, timeout: 20000 });
        
        // Login user - use access_token (JWT) for API calls
        const token = response.data.access_token || response.data.session_token;
        await login(response.data.user, token, true, response.data.refresh_token || null);
        if (isNative()) closeNativeBrowser();
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const msg = err?.response?.data?.detail || (err?.code === 'ERR_NETWORK' ? 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' : 'No se pudo completar el inicio de sesión con Google.');
        setError(typeof msg === 'string' ? msg : 'No se pudo completar el inicio de sesión con Google.');
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    };

    processAuth();
  }, [navigate, login]);

  if (bounceUrl) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" data-testid="auth-native-bounce">
        <p className="text-base">Volviendo a la app BRUNO…</p>
        <a href={bounceUrl} className="underline text-sm" data-testid="auth-native-bounce-link">Si no se abre sola, toca aquí para abrir BRUNO</a>
      </div>
    );
  }
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-sm text-red-600" data-testid="auth-callback-error">{error}</p>
      </div>
    );
  }
  return (
    <BrunoLoader message="Procesando autenticación…" />
  );
};

export default AuthCallback;
