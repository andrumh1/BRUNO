import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { OvcAttribution } from "@/components/brand/OvcAttribution";
import { isNative } from "@/native/capacitor";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const LoginPage = () => {
  const navigate = useNavigate();
  const { login, logout, user: sessionUser, isAuthenticated, isLoading: authLoading } = useAuth();
  const [switching, setSwitching] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [keepActive, setKeepActive] = useState(true);

  // Restore remembered email on mount
  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem("bruno_remembered_email");
      if (rememberedEmail) {
        setFormData((p) => ({ ...p, email: rememberedEmail }));
        setRememberMe(true);
      }
    } catch (_) { /* no-op */ }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|Opera Mini|IEMobile/i.test(navigator.userAgent);
      const payload = {
        ...formData,
        platform: isNative() ? "native" : isMobile ? "mobile" : "web",
        keep_session_active: keepActive,
        remember: keepActive,
      };
      const response = await axios.post(`${API}/auth/login`, payload, { withCredentials: true });
      if (!response.data?.access_token || !response.data?.user) throw new Error("Respuesta de acceso inválida");
      if (isAuthenticated && sessionUser && sessionUser.id !== response.data.user.id) await logout();
      // Persist preferences
      try {
        if (rememberMe) {
          localStorage.setItem("bruno_remembered_email", formData.email);
        } else {
          localStorage.removeItem("bruno_remembered_email");
        }
        localStorage.setItem("bruno_keep_session_active", keepActive ? "1" : "0");
      } catch (_) { /* no-op */ }
      await login(response.data.user, response.data.access_token);
      const next = new URLSearchParams(window.location.search).get("next");
      navigate(next && next.startsWith("/") ? next : "/my-profile");
    } catch (err) {
      const status = err.response?.status;
      setError(status === 429 ? (err.response?.data?.detail || "Demasiados intentos. Espera unos minutos.") : status === 401 ? "Correo o contraseña incorrectos" : (err.response?.data?.detail || "No se pudo iniciar sesión. Inténtalo de nuevo."));
    } finally {
      setLoading(false);
    }
  };

  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleGoogleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Blurred Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <Card className="w-full max-w-md relative z-10 backdrop-blur-xl bg-card/95 shadow-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img src="/bruno-mascot.png" alt="BRUNO" className="h-20" />
          </div>
          <CardTitle className="text-3xl font-bold text-center">Iniciar Sesión</CardTitle>
          <CardDescription className="text-center">
            Accede a tu cuenta de BRUNO
          </CardDescription>
          <div className="flex justify-center pt-1"><OvcAttribution variant="inline" /></div>
        </CardHeader>
        <CardContent>
          {!authLoading && isAuthenticated && sessionUser && !switching && (
            <div className="mb-4 p-3 rounded-xl border border-primary/30 bg-primary/5 text-sm space-y-2" data-testid="existing-session-banner">
              <p>Ya tienes sesión iniciada como <strong data-testid="existing-session-name">{sessionUser.name || sessionUser.email}</strong>.</p>
              <div className="flex gap-2">
                <Button type="button" size="sm" className="rounded-full flex-1" onClick={() => navigate("/my-profile")} data-testid="existing-session-continue">Continuar</Button>
                <Button type="button" size="sm" variant="outline" className="rounded-full flex-1" onClick={async () => { await logout(); setSwitching(true); setFormData({ email: "", password: "" }); }} data-testid="existing-session-switch">Cambiar de cuenta</Button>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm" role="alert" data-testid="login-error">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  name="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="pl-10"
                  required
                  data-testid="login-email-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  className="pl-10 pr-10"
                  required
                  data-testid="login-password-input"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  data-testid="login-password-toggle"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me + Keep session */}
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-orange-300 text-primary accent-orange-500 focus:ring-2 focus:ring-orange-400"
                  data-testid="login-remember-me"
                />
                <span className="text-sm">Recordar mi correo</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepActive}
                  onChange={(e) => setKeepActive(e.target.checked)}
                  className="h-4 w-4 rounded border-orange-300 text-primary accent-orange-500 focus:ring-2 focus:ring-orange-400"
                  data-testid="login-keep-active"
                />
                <span className="text-sm">Mantener sesión activa</span>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={loading} data-testid="login-submit">
              {loading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">O continúa con</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            data-testid="login-google-btn"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar con Google
          </Button>

          <p className="text-center text-sm text-muted-foreground mt-6">
            ¿No tienes una cuenta?{" "}
            <Link to="/register" className="text-primary font-medium hover:underline">
              Regístrate
            </Link>
          </p>

          <p className="text-center text-sm text-muted-foreground mt-4">
            <Link to="/" className="hover:text-primary transition-colors">
              ← Volver al inicio
            </Link>
          </p>
          <OvcAttribution className="mt-6 pt-5 border-t border-border/60" />
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
