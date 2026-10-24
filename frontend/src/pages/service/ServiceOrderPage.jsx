import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CreditCard, Mail, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { StatusPill, getPublicOrder, startCheckout, t, glass } from "./serviceApi";

export default function ServiceOrderPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const from = new URLSearchParams(window.location.search).get("from");

  useEffect(() => { getPublicOrder(orderId).then(setOrder).catch(() => setError(t("No encontramos este pedido.", "We could not find this order."))); }, [orderId]);

  const pay = async () => {
    setPaying(true); setError("");
    try { const r = await startCheckout(orderId); window.location.assign(r.url); }
    catch (e) { setError(e.response?.data?.errorEn && window.navigator.language.startsWith("en") ? e.response.data.errorEn : e.response?.data?.error || e.response?.data?.detail || t("No se pudo iniciar el pago.", "Could not start the payment.")); setPaying(false); }
  };

  const canPay = order && order.payment_status !== "paid" && order.production_status !== "cancelled";
  const provider = order?.market === "CO" ? "Wompi" : "Stripe";
  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fff7f1,#ffffff_45%,#fff1e6)] px-4 py-8" data-testid="service-order-page">
      <div className="max-w-xl mx-auto">
        <button type="button" onClick={() => (from && from.startsWith("/") ? window.location.assign(from) : navigate(-1))} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6" data-testid="order-back-btn"><ArrowLeft className="w-4 h-4" />{t("Volver", "Back")}</button>
        <div className={`${glass} p-7 sm:p-9`}>
          <p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e] mb-2">BRUNO × OVC</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight mb-1">{t("Tu pedido", "Your order")}</h1>
          <p className="text-xs text-gray-500 break-all mb-5" data-testid="order-reference">{t("Referencia", "Reference")}: {orderId}</p>
          {error && <p className="text-sm text-red-600 mb-4" data-testid="order-error">{error}</p>}
          {order && (
            <>
              <div className="flex flex-wrap gap-2 mb-6"><StatusPill kind="production" value={order.production_status} testId="order-production-status" /><StatusPill kind="payment" value={order.payment_status} testId="order-payment-status" /></div>
              <div className="rounded-2xl bg-white/80 border border-orange-100 p-4 mb-6 text-sm text-gray-700 space-y-1">
                <div className="flex justify-between"><span>{t("Servicio", "Service")}</span><b>{t("Diseño + configuración de tarjeta", "Card design + setup")}</b></div>
                <div className="flex justify-between"><span>{t("País", "Country")}</span><b>{order.market === "CO" ? "Colombia" : t("Estados Unidos", "United States")}</b></div>
                <div className="flex justify-between"><span>{t("Importe", "Amount")}</span><b data-testid="order-amount">{order.label}</b></div>
                <div className="flex justify-between"><span>{t("Comercio receptor", "Merchant")}</span><b>Octopus Vision Company (OVC)</b></div>
                <div className="flex justify-between"><span>{t("Proveedor de pago", "Payment provider")}</span><b>{provider}</b></div>
              </div>
              {order.payment_status === "pending" && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4" data-testid="order-verifying">{t("Estamos verificando tu pago. Actualizaremos el estado cuando el proveedor lo confirme.", "We are verifying your payment. The status will update when the provider confirms it.")}</p>}
              {canPay && (order.provider_ready ? (
                <Button onClick={pay} disabled={paying} className="w-full rounded-full h-12 text-base" data-testid="order-pay-btn"><CreditCard className="w-4 h-4 mr-2" />{paying ? t("Abriendo pago seguro…", "Opening secure payment…") : t(`Pagar ${order.label} con ${provider}`, `Pay ${order.label} with ${provider}`)}</Button>
              ) : (
                <div className="text-sm text-gray-700 bg-white/80 border border-orange-100 rounded-2xl p-4" data-testid="order-payment-unavailable"><p className="mb-2">{t("El pago en línea para este país todavía no está habilitado. Coordinaremos el pago contigo por correo antes de preparar la tarjeta.", "Online payment for this country is not enabled yet. We will arrange payment with you by email before preparing the card.")}</p><a className="inline-flex items-center gap-2 font-semibold text-[#c84a17]" href={`mailto:bruno@brunocard.com?subject=${encodeURIComponent(`BRUNO · ${orderId}`)}`}><Mail className="w-4 h-4" />bruno@brunocard.com</a></div>
              ))}
              {order.payment_status === "paid" && order.production_status !== "delivered" && <p className="text-sm text-gray-700" data-testid="order-paid-note">{t("Pago confirmado. Te avisaremos por correo cuando tu tarjeta esté lista para revisar y aprobar.", "Payment confirmed. We will email you when your card is ready to review and approve.")}</p>}
              {order.production_status === "pending_approval" && <p className="text-sm text-gray-700 mt-3" data-testid="order-review-note">{t("Tu tarjeta está lista: revisa el correo «Revisar mi tarjeta» para aprobarla o pedir ajustes.", "Your card is ready: check the “Review my card” email to approve it or request changes.")}</p>}
              {order.production_status === "delivered" && <Button className="w-full rounded-full mt-2" onClick={() => navigate(isAuthenticated ? "/my-profile?tab=cards" : "/login?next=/my-profile%3Ftab%3Dcards")} data-testid="order-open-cards">{t("Ver en Perfil → Tarjetas", "Open Profile → Cards")}</Button>}
              <p className="text-[11px] text-gray-500 mt-5 inline-flex items-start gap-1.5"><ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />{t("El pago se confirma únicamente con la notificación verificada del proveedor. Abrir un enlace o volver a esta página no marca el pedido como pagado.", "Payment is confirmed only through the provider's verified notification. Opening a link or returning to this page does not mark the order as paid.")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
