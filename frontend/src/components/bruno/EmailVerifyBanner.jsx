import React, { useState } from "react";
import axios from "axios";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const detail = (e, fb) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : fb; };

/** Aviso «confirma tu correo» (solo cuentas nuevas sin verificar): código de 6 dígitos o reenviar enlace. No bloquea el uso de BRUNO. */
export const EmailVerifyBanner = () => {
  const { user, token, refreshUser } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  if (!user || user.email_verified !== false) return null;
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const confirm = async () => {
    setBusy(true);
    try { await axios.post(`${API}/auth/verify-email/code`, { code }, auth); brunoToast.success("Correo confirmado"); await refreshUser(); }
    catch (e) { brunoToast.error(detail(e, "Código incorrecto")); } finally { setBusy(false); }
  };
  const resend = async () => {
    setBusy(true);
    try { await axios.post(`${API}/auth/verify-email/resend`, {}, auth); brunoToast.success(`Te enviamos un nuevo correo a ${user.email}`); }
    catch (e) { brunoToast.error(detail(e, "No pudimos enviar el correo")); } finally { setBusy(false); }
  };
  return (
    <div className="glass-card rounded-2xl p-3 border border-primary/30 flex flex-col sm:flex-row sm:items-center gap-2" data-testid="email-verify-banner">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <MailCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs leading-snug"><span className="font-semibold">Confirma tu correo.</span> Te enviamos un enlace y un código a <span className="break-all">{user.email}</span>.</p>
      </div>
      <div className="flex items-center gap-1.5">
        <Input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="Código" className="h-8 w-24 text-center text-xs tracking-widest" data-testid="email-verify-code-input" />
        <Button size="sm" className="h-8 rounded-full" onClick={confirm} disabled={busy || code.length !== 6} data-testid="email-verify-confirm-btn">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Confirmar"}</Button>
        <Button size="sm" variant="ghost" className="h-8 rounded-full text-xs" onClick={resend} disabled={busy} data-testid="email-verify-resend-btn">Reenviar</Button>
      </div>
    </div>
  );
};
