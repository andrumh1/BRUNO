import axios from "axios";
import { serviceLang } from "@/components/bruno/ServicePromoBubble";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api/bruno-service`;
export const auth = (token) => (token ? { headers: { Authorization: `Bearer ${token}` } } : {});
export const lang = () => serviceLang();
export const t = (es, en) => (lang() === "en" ? en : es);

export const PRODUCTION_LABELS = {
  received: ["Solicitud recibida", "Request received"], pending_payment: ["Pendiente de pago", "Pending payment"], paid: ["Pago confirmado", "Payment confirmed"],
  in_preparation: ["En preparación", "In preparation"], pending_approval: ["Pendiente de aprobación", "Pending approval"], changes_requested: ["Ajustes solicitados", "Changes requested"],
  approved: ["Aprobada", "Approved"], delivered: ["Entregada", "Delivered"], cancelled: ["Cancelado", "Cancelled"],
};
export const PAYMENT_LABELS = {
  unpaid: ["Sin pago", "Unpaid"], pending: ["Verificando pago", "Verifying payment"], paid: ["Pagado", "Paid"], failed: ["Rechazado", "Declined"], refunded: ["Reembolsado", "Refunded"], disputed: ["En disputa", "Disputed"],
};
export const label = (map, key) => { const v = map[key]; return v ? t(v[0], v[1]) : key || "—"; };

export const getPublicOrder = (id) => axios.get(`${API}/orders/${id}/public`).then((r) => r.data);
export const startCheckout = (id) => axios.post(`${API}/orders/${id}/checkout`, {}).then((r) => r.data);
export const paymentStatus = (id, params) => axios.get(`${API}/orders/${id}/payment-status`, { params }).then((r) => r.data);
export const getReview = (token, jwt) => axios.get(`${API}/review/${token}`, auth(jwt)).then((r) => r.data);

export function StatusPill({ kind, value, testId }) {
  const map = kind === "payment" ? PAYMENT_LABELS : PRODUCTION_LABELS;
  const tone = value === "paid" || value === "delivered" || value === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : value === "cancelled" || value === "failed" || value === "disputed" ? "bg-red-50 text-red-700 border-red-200" : value === "pending" || value === "pending_approval" || value === "changes_requested" ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-orange-50 text-[#c84a17] border-orange-200";
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`} data-testid={testId}>{label(map, value)}</span>;
}

export const glass = "rounded-[28px] border border-white/70 bg-white/70 backdrop-blur-xl shadow-[inset_0_1px_0_#fff,0_18px_50px_rgba(52,59,50,0.10)]";
