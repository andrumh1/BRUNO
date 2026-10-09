import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import PremiumPage from "@/pages/PremiumPage";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const NEXT = { live_ticket: (ref) => `/lives/${ref}?paid=1`, gift: (ref) => `/lives/${ref}`, marketplace: (ref) => `/marketplace/product/${ref}`, piup: () => "/piup", promotion: () => "/monetization" };
const LABEL = { live_ticket: "Tu entrada está confirmada", gift: "Regalo enviado al creador", marketplace: "Pedido pagado", piup: "Pedido PIUP pagado", promotion: "Promoción activada" };

// Success page never grants anything by itself: it polls the server, which only flips to "paid" via Stripe (webhook or verified session).
export default function PaymentResultPage({ cancelled = false }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const kind = params.get("kind"); const ref = params.get("ref"); const sid = params.get("session_id");
  const [status, setStatus] = useState(cancelled ? "cancelled" : "checking");

  useEffect(() => {
    if (!kind || !sid || cancelled) return undefined;
    let tries = 0; let t;
    const poll = async () => {
      try { const r = await axios.get(`${API}/money/status/${sid}`); if (["paid", "failed", "expired"].includes(r.data.status)) { setStatus(r.data.status); return; } } catch { /* retry */ }
      if (++tries < 15) t = setTimeout(poll, 2000); else setStatus("timeout");
    };
    poll();
    return () => clearTimeout(t);
  }, [kind, sid, cancelled]);

  if (!kind) return <PremiumPage />;
  const next = NEXT[kind] ? NEXT[kind](ref) : "/";
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="payment-result" data-status={status}>
      <div className="max-w-sm space-y-4">
        {status === "checking" && <><Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" /><p className="font-semibold">Confirmando el pago con Stripe…</p><p className="text-sm text-muted-foreground">No cierres esta pantalla. Solo activamos la compra cuando el pago queda confirmado.</p></>}
        {status === "paid" && <><CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500" /><p className="font-bold text-lg">{LABEL[kind] || "Pago confirmado"}</p><p className="text-sm text-muted-foreground" data-testid="payment-receipt-note">Te hemos enviado el recibo a tu correo.</p><Button className="rounded-full" onClick={() => navigate(next)} data-testid="payment-continue-btn">Continuar</Button></>}
        {["failed", "expired", "cancelled", "timeout"].includes(status) && <><XCircle className="w-12 h-12 mx-auto text-destructive" /><p className="font-bold text-lg">{status === "cancelled" ? "Pago cancelado" : status === "timeout" ? "Aún sin confirmación" : "El pago no se completó"}</p><p className="text-sm text-muted-foreground">{status === "timeout" ? "Si Stripe lo confirma, aparecerá en tus compras automáticamente." : "No se ha realizado ningún cargo. Puedes intentarlo de nuevo."}</p><Button variant="outline" className="rounded-full" onClick={() => navigate(next)} data-testid="payment-back-btn">Volver</Button></>}
      </div>
    </div>
  );
}
