/* Recuperar contraseña (/forgot-password) y crear nueva (/reset-password?token=) con identidad BRUNO/OVC. */
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OvcAttribution } from "@/components/brand/OvcAttribution";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const detail = (e, fb) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x.msg).join(" ") : fb; };

const Shell = ({ title, description, children, testid }) => (
  <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" data-testid={testid}>
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/15 rounded-full blur-3xl" />
    </div>
    <Card className="w-full max-w-md relative z-10 backdrop-blur-xl bg-card/95 shadow-2xl">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4"><img src="/bruno-mascot.png" alt="BRUNO" className="h-20" /></div>
        <CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
        <CardDescription className="text-center">{description}</CardDescription>
        <div className="flex justify-center pt-1"><OvcAttribution variant="inline" /></div>
      </CardHeader>
      <CardContent>
        {children}
        <OvcAttribution className="mt-6 pt-5 border-t border-border/60" />
      </CardContent>
    </Card>
  </div>
);

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState({ loading: false, sent: false, error: "" });
  const submit = async (e) => {
    e.preventDefault();
    setState({ loading: true, sent: false, error: "" });
    try { await axios.post(`${API}/auth/forgot-password`, { email }); setState({ loading: false, sent: true, error: "" }); }
    catch (err) { setState({ loading: false, sent: false, error: detail(err, "No se pudo enviar el correo. Inténtalo de nuevo.") }); }
  };
  return (
    <Shell title="Recuperar cuenta" description="Te enviamos un enlace para crear una contraseña nueva" testid="forgot-password-page">
      {state.sent ? (
        <div className="text-center space-y-3" data-testid="forgot-sent">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-sm">Si <strong>{email}</strong> está registrado en BRUNO, recibirás un correo en unos minutos. Revisa también la carpeta de spam.</p>
          <p className="text-xs text-muted-foreground">El enlace caduca en 60 minutos y solo puede usarse una vez.</p>
          <Link to="/login"><Button variant="outline" className="rounded-full mt-2" data-testid="forgot-back-login"><ArrowLeft className="w-4 h-4 mr-1.5" /> Volver a iniciar sesión</Button></Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {state.error && <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="forgot-error"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{state.error}</div>}
          <div className="space-y-2">
            <label className="text-sm font-medium">Correo de tu cuenta</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" className="pl-10" data-testid="forgot-email-input" />
            </div>
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={state.loading} data-testid="forgot-submit">{state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviarme el enlace"}</Button>
          <p className="text-center text-sm text-muted-foreground"><Link to="/login" className="hover:text-primary">← Volver a iniciar sesión</Link></p>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [valid, setValid] = useState(null);
  const [hint, setHint] = useState("");
  const [pw, setPw] = useState({ a: "", b: "" });
  const [show, setShow] = useState(false);
  const [state, setState] = useState({ loading: false, done: false, error: "" });

  useEffect(() => {
    if (!token) { setValid(false); return; }
    axios.get(`${API}/auth/reset-password/validate`, { params: { token } }).then((r) => { setValid(true); setHint(r.data.email_hint); }).catch((e) => { setValid(false); setState((s) => ({ ...s, error: detail(e, "El enlace no es válido o ya caducó.") })); });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (pw.a.length < 8) return setState({ loading: false, done: false, error: "La contraseña debe tener al menos 8 caracteres" });
    if (pw.a !== pw.b) return setState({ loading: false, done: false, error: "Las contraseñas no coinciden" });
    setState({ loading: true, done: false, error: "" });
    try { await axios.post(`${API}/auth/reset-password`, { token, new_password: pw.a }); setState({ loading: false, done: true, error: "" }); setTimeout(() => navigate("/login"), 2500); }
    catch (err) { setState({ loading: false, done: false, error: detail(err, "No se pudo cambiar la contraseña.") }); }
  };

  return (
    <Shell title="Nueva contraseña" description={hint ? `Para la cuenta ${hint}` : "Crea una contraseña segura para tu cuenta"} testid="reset-password-page">
      {valid === null ? <div className="grid place-items-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        : valid === false ? (
          <div className="text-center space-y-3" data-testid="reset-invalid">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-sm">{state.error || "El enlace no es válido o ya caducó."}</p>
            <Link to="/forgot-password"><Button className="rounded-full mt-2" data-testid="reset-request-new">Solicitar un enlace nuevo</Button></Link>
          </div>
        ) : state.done ? (
          <div className="text-center space-y-3" data-testid="reset-done">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium">Contraseña actualizada. Te llevamos a iniciar sesión…</p>
            <Link to="/login"><Button variant="outline" className="rounded-full">Iniciar sesión</Button></Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {state.error && <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" data-testid="reset-error"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />{state.error}</div>}
            {[["a", "Nueva contraseña", "reset-password-input"], ["b", "Repite la contraseña", "reset-password-confirm"]].map(([k, label, tid]) => (
              <div key={k} className="space-y-2">
                <label className="text-sm font-medium">{label}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input type={show ? "text" : "password"} required minLength={8} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} className="pl-10 pr-10" data-testid={tid} />
                  {k === "a" && <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-8 h-8 rounded-full text-muted-foreground" aria-label="Mostrar contraseña">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>}
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres. Al guardar, cerraremos las sesiones que usen la contraseña anterior.</p>
            <Button type="submit" className="w-full rounded-full" disabled={state.loading} data-testid="reset-submit">{state.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Guardar contraseña"}</Button>
          </form>
        )}
    </Shell>
  );
}

export default ForgotPasswordPage;
