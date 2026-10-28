import axios from "axios";
import { lang, t } from "@/pages/service/serviceApi";

export const PKG_API = `${process.env.REACT_APP_BACKEND_URL}/api/packages`;
export const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
export { lang, t };

export const PREP = { draft: ["Borrador", "Draft"], ready: ["Listo para entregar", "Ready to deliver"] };
export const PAY = { pending: ["Pago pendiente", "Payment pending"], processing: ["Procesando pago", "Processing payment"], confirmed: ["Pago confirmado", "Payment confirmed"], failed: ["Pago fallido", "Payment failed"], refunded: ["Reembolsado", "Refunded"], disputed: ["En disputa", "Disputed"] };
export const DELIV = { pending_acceptance: ["Pendiente de aceptación", "Pending acceptance"], transferring: ["Transfiriendo", "Transferring"], activated: ["Activado", "Activated"], error: ["Error de transferencia", "Transfer error"] };
export const label = (map, k, force) => { const v = map[k]; if (!v) return k || "—"; return force === "es" ? v[0] : force === "en" ? v[1] : t(v[0], v[1]); };
const tone = (k) => ["confirmed", "activated", "ready"].includes(k) ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ["failed", "error", "disputed"].includes(k) ? "bg-red-50 text-red-700 border-red-200" : ["processing", "transferring", "pending_acceptance"].includes(k) ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-orange-50 text-[#c84a17] border-orange-200";
export const Pill = ({ map, value, force, testId }) => <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${tone(value)}`} data-testid={testId}>{label(map, value, force)}</span>;
export const PKG_LABEL = () => t("Perfil completo + 3 tarjetas digitales", "Complete profile + 3 digital cards");
export const errText = (e, fb) => { const d = e?.response?.data?.detail; if (!d) return fb; if (typeof d === "string") return d; return (lang() === "en" ? d.errorEn || d.error : d.error || d.errorEn) || fb; };
export const api = {
  access: (tk) => axios.get(`${PKG_API}/me/access`, auth(tk)).then((r) => r.data),
  list: (tk, params) => axios.get(PKG_API, { ...auth(tk), params }).then((r) => r.data),
  create: (tk) => axios.post(PKG_API, {}, auth(tk)).then((r) => r.data),
  get: (tk, id) => axios.get(`${PKG_API}/${id}`, auth(tk)).then((r) => r.data),
  patch: (tk, id, client) => axios.patch(`${PKG_API}/${id}`, { client }, auth(tk)).then((r) => r.data),
  finalize: (tk, id, body) => axios.post(`${PKG_API}/${id}/finalize`, body, auth(tk)).then((r) => r.data),
  link: (tk, id, revoke) => axios.post(`${PKG_API}/${id}/claim-link${revoke ? "?revoke_only=true" : ""}`, {}, auth(tk)).then((r) => r.data),
  cash: (tk, id, body) => axios.post(`${PKG_API}/${id}/cash-confirm`, body, auth(tk)).then((r) => r.data),
  reassign: (tk, id, body) => axios.post(`${PKG_API}/${id}/reassign`, body, auth(tk)).then((r) => r.data),
  retry: (tk, id) => axios.post(`${PKG_API}/${id}/retry-transfer`, {}, auth(tk)).then((r) => r.data),
  claim: (tk, token) => axios.get(`${PKG_API}/claim/${token}`, tk ? auth(tk) : {}).then((r) => r.data),
  accept: (tk, token, body) => axios.post(`${PKG_API}/claim/${token}/accept`, body, auth(tk)).then((r) => r.data),
  checkout: (tk, id) => axios.post(`${PKG_API}/${id}/checkout`, {}, auth(tk)).then((r) => r.data),
  paymentStatus: (tk, id, params) => axios.get(`${PKG_API}/${id}/payment-status`, { ...auth(tk), params }).then((r) => r.data),
  salesReport: (tk, month) => axios.get(`${PKG_API}/report/sales`, { ...auth(tk), params: { month } }).then((r) => r.data),
  salesXlsx: (tk, month) => axios.get(`${PKG_API}/report/sales.xlsx`, { ...auth(tk), params: { month }, responseType: "blob" }).then((r) => r.data),
};
