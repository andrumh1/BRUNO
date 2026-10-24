import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, paymentStatus, t, glass } from "./serviceApi";

export default function ServicePaymentReturnPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const q = new URLSearchParams(window.location.search);
  const cancelled = q.get("cancel") === "1";
  const params = { session_id: q.get("session_id") || undefined, id: q.get("id") || undefined };
  const [order, setOrder] = useState(null);
  const [tries, setTries] = useState(0);
  const timer = useRef(null);

  useEffect(() => {
    let alive = true;
    const tick = async (n) => {
      try { const o = await paymentStatus(orderId, params); if (!alive) return; setOrder(o); if (o.payment_status === "paid" || n >= 8) return; }
      catch { if (n >= 8) return; }
      timer.current = setTimeout(() => { setTries(n + 1); tick(n + 1); }, 3000);
    };
    if (!cancelled) tick(0); else paymentStatus(orderId, { cancel: 1 }).then((o) => alive && setOrder(o)).catch(() => {});
    return () => { alive = false; clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const paid = order?.payment_status === "paid";
  const failed = order?.payment_status === "failed";
  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#fff7f1,#ffffff_45%,#fff1e6)] px-4 py-10" data-testid="service-payment-return">
      <div className={`${glass} max-w-lg mx-auto p-8 text-center`}>
        {paid ? <CheckCircle2 className="w-14 h-14 mx-auto text-emerald-500 mb-3" /> : cancelled || failed ? <XCircle className="w-14 h-14 mx-auto text-red-400 mb-3" /> : <Clock className="w-14 h-14 mx-auto text-amber-500 mb-3 animate-pulse" />}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2" data-testid="payment-return-title">
          {paid ? t("Pago confirmado", "Payment confirmed") : cancelled ? t("Pago cancelado", "Payment cancelled") : failed ? t("Pago rechazado", "Payment declined") : t("Estamos verificando tu pago", "We are verifying your payment")}
        </h1>
        <p className="text-sm text-gray-600 mb-5" data-testid="payment-return-text">
          {paid ? t("Gracias. Prepararemos tu tarjeta y te avisaremos por correo cuando esté lista para revisar.", "Thank you. We will prepare your card and email you when it is ready for review.")
            : cancelled ? t("No se realizó ningún cobro. Tu solicitud y tus archivos se conservan; puedes reintentar el pago cuando quieras.", "You were not charged. Your request and files are kept; you can retry the payment whenever you want.")
            : failed ? t("El proveedor rechazó el pago. No se realizó ningún cobro. Puedes intentarlo de nuevo.", "The provider declined the payment. You were not charged. You can try again.")
            : t("Esperamos la confirmación del proveedor. Si tarda, revisa esta página más tarde: no se entrega nada hasta que el pago esté confirmado.", "Waiting for the provider's confirmation. If it takes a while, check back later: nothing is delivered until the payment is confirmed.")}
        </p>
        {order && <div className="flex justify-center gap-2 mb-6"><StatusPill kind="production" value={order.production_status} testId="return-production-status" /><StatusPill kind="payment" value={order.payment_status} testId="return-payment-status" /></div>}
        {!paid && !cancelled && !failed && tries >= 8 && <p className="text-xs text-amber-800 mb-4" data-testid="payment-return-slow">{t("Aún sin confirmación. Puedes volver más tarde a tu pedido.", "No confirmation yet. You can return to your order later.")}</p>}
        <Button className="rounded-full" onClick={() => navigate(`/pedido/${orderId}`)} data-testid="payment-return-order-btn">{t("Ver mi pedido", "View my order")}</Button>
      </div>
    </div>
  );
}
