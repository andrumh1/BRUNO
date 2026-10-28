import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { glass } from "@/pages/service/serviceApi";
import { api, DELIV, PAY, Pill, t } from "./packagesApi";

/** Retorno del checkout: solo consulta y re-verifica con la pasarela; nunca activa por sí mismo. */
export default function PackagePaymentReturnPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { token, isLoading } = useAuth();
  const q = new URLSearchParams(window.location.search);
  const cancelled = q.get("cancel") === "1";
  const [p, setP] = useState(null);
  const [tries, setTries] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    if (isLoading) return undefined;
    if (!token) { navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return undefined; }
    let alive = true;
    const params = cancelled ? { cancel: 1 } : { session_id: q.get("session_id") || undefined, id: q.get("id") || undefined };
    const tick = async (n) => { try { const r = await api.paymentStatus(token, packageId, n === 0 ? params : {}); if (!alive) return; setP(r); if (r.payment_status === "confirmed" || cancelled || n >= 8) return; } catch { if (n >= 8) return; } timer.current = setTimeout(() => { setTries(n + 1); tick(n + 1); }, 3000); };
    tick(0);
    return () => { alive = false; clearTimeout(timer.current); };
  }, [token, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const paid = p?.payment_status === "confirmed", failed = p?.payment_status === "failed";
  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fff7f1,#ffffff_45%,#fff1e6)] px-4 py-10" data-testid="package-payment-return">
      <div className={`${glass} max-w-lg mx-auto p-8 text-center`}>
        {paid ? <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500 mb-3" /> : cancelled || failed ? <XCircle className="w-14 h-14 mx-auto text-red-400 mb-3" /> : <Clock className="w-14 h-14 mx-auto text-amber-500 mb-3 animate-pulse" />}
        <h1 className="text-2xl font-semibold mb-2" data-testid="package-return-title">{paid ? t("Pago confirmado", "Payment confirmed") : cancelled ? t("Pago cancelado", "Payment cancelled") : failed ? t("Pago rechazado", "Payment declined") : t("Estamos verificando tu pago", "We are verifying your payment")}</h1>
        <p className="text-sm text-gray-600 mb-4">{paid ? (p.delivery_status === "activated" ? t("Tu paquete ya está activo en tu cuenta.", "Your package is now active in your account.") : t("Estamos activando tu paquete.", "We are activating your package.")) : cancelled ? t("No se realizó ningún cobro. Tu paquete se conserva para reintentar.", "You were not charged. Your package is kept to retry.") : failed ? t("La pasarela rechazó el pago. No se realizó ningún cobro.", "The gateway declined the payment. You were not charged.") : t("Esperamos la confirmación verificada de la pasarela.", "Waiting for the gateway's verified confirmation.")}</p>
        {p && <div className="flex justify-center gap-2 mb-5"><Pill map={PAY} value={p.payment_status} testId="package-return-pay" /><Pill map={DELIV} value={p.delivery_status} testId="package-return-deliv" /></div>}
        {tries >= 8 && !paid && <p className="text-xs text-amber-800 mb-3">{t("Aún sin confirmación; vuelve más tarde desde tu enlace de activación.", "No confirmation yet; come back later from your activation link.")}</p>}
        <Button className="rounded-full" onClick={() => navigate(p?.delivery_status === "activated" ? "/my-profile?tab=cards" : "/my-profile")} data-testid="package-return-btn">{p?.delivery_status === "activated" ? t("Ver mi perfil y tarjetas", "See my profile and cards") : t("Ir a mi perfil", "Go to my profile")}</Button>
      </div>
    </div>
  );
}
