import React, { useEffect, useRef, useState } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { isNative } from "@/native/capacitor";
import { NATIVE_AUTH_DONE_LINK } from "@/lib/googleLogin";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const NONCE_RE = /^[a-f0-9]{48,96}$/;

const AuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const hasProcessed = useRef(false);
  const [handoff, setHandoff] = useState(null); // 'working' | 'done'
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

        // Web abierta desde la app nativa (?native_auth=<nonce>): canjear aquí y dejar la sesión nativa para la app; no iniciar sesión en esta web.
        const nonce = new URLSearchParams(window.location.search).get('native_auth');
        if (!isNative() && nonce && NONCE_RE.test(nonce)) {
          setHandoff('working');
          await axios.post(`${API}/auth/native-handoff`, { nonce, session_id: sessionId }, { __skipAuthRetry: true, timeout: 20000 });
          setHandoff('done');
          window.history.replaceState(null, '', '/dashboard?native_auth=done');
          return;
        }

        // Exchange session_id for user data
        const response = await axios.post(`${API}/auth/google`, { session_id: sessionId, platform: isNative() ? "native" : "web" }, { withCredentials: true, __skipAuthRetry: true, timeout: 20000 });
        
        // Login user - use access_token (JWT) for API calls
        const token = response.data.access_token || response.data.session_token;
        await login(response.data.user, token, true, response.data.refresh_token || null);
        
        // Redirect to dashboard
        navigate('/dashboard', { replace: true });
      } catch (err) {
        const msg = err?.response?.data?.detail || (err?.code === 'ERR_NETWORK' ? 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.' : 'No se pudo completar el inicio de sesión con Google.');
        setError(typeof msg === 'string' ? msg : 'No se pudo completar el inicio de sesión con Google.');
        setHandoff(null);
        setTimeout(() => navigate('/login', { replace: true }), 2500);
      }
    };

    processAuth();
  }, [navigate, login]);

  if (handoff) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" data-testid="auth-native-bounce">
        {handoff === 'working' ? (
          <p className="text-base" data-testid="auth-native-bounce-text">Conectando con BRUNO…</p>
        ) : (
          <>
            <p className="text-base font-semibold" data-testid="auth-native-bounce-text">¡Listo! Tu sesión ya está en la app BRUNO.</p>
            <p className="text-sm text-muted-foreground">Cierra esta ventana o vuelve a la app.</p>
            <a href={NATIVE_AUTH_DONE_LINK} className="inline-flex items-center justify-center rounded-full bg-orange-500 text-white px-6 py-3 text-sm font-semibold" data-testid="auth-native-bounce-link">Abrir BRUNO</a>
          </>
        )}
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
