import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Mail, PencilRuler, Send, UserCog, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { API, PAYMENT_LABELS, StatusPill, auth } from "./serviceApi";

const Row = ({ k, v }) => <div className="flex gap-3 text-sm py-1 border-b border-border/50 last:border-0"><span className="w-36 shrink-0 text-muted-foreground">{k}</span><span className="min-w-0 break-words whitespace-pre-wrap">{v || "—"}</span></div>;
const Section = ({ title, icon: Icon, children, testId }) => <div className="rounded-2xl border border-border bg-card p-4" data-testid={testId}><h2 className="text-sm font-bold mb-3 inline-flex items-center gap-2">{Icon && <Icon className="w-4 h-4 text-primary" />}{title}</h2>{children}</div>;

export default function AdminOrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [o, setO] = useState(null);
  const [access, setAccess] = useState({ staff: false, admin: false });
  const [note, setNote] = useState("");
  const [pay, setPay] = useState({ status: "paid", reference: "", note: "" });
  const [recipient, setRecipient] = useState({ email: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => axios.get(`${API}/orders/${orderId}`, auth(token)).then((r) => setO(r.data)).catch((e) => setError(e.response?.status === 403 ? "Acceso solo para el equipo autorizado." : "No se pudo cargar el pedido."));
  useEffect(() => { if (token) { load(); axios.get(`${API}/me/access`, auth(token)).then((r) => setAccess(r.data)).catch(() => {}); } }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn, ok) => { setBusy(true); try { const r = await fn(); if (ok) brunoToast.success(typeof ok === "function" ? ok(r.data) : ok); await load(); return r.data; } catch (e) { const d = e.response?.data?.detail; brunoToast.error(typeof d === "string" ? d : d?.error || "No se pudo completar"); return null; } finally { setBusy(false); } };
  const openEditor = async () => { const r = await act(() => axios.post(`${API}/orders/${orderId}/card`, {}, auth(token))); if (r?.card_id) navigate(`/cards/${r.card_id}/edit?order=${orderId}`); };

  if (error) return <div className="min-h-screen flex items-center justify-center p-6 text-center text-sm text-destructive" data-testid="admin-order-error">{error}</div>;
  if (!o) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando…</div>;
  const ps = o.production_status || "received";
  const canEdit = !["delivered", "cancelled"].includes(ps);
  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-28" data-testid="admin-order-detail">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/pedidos")} data-testid="admin-order-back"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-0"><h1 className="text-lg font-bold truncate">{o.card_name}</h1><p className="font-mono text-xs text-muted-foreground break-all" data-testid="admin-order-id">{o.id}</p></div>
          <StatusPill kind="production" value={ps} testId="admin-order-production" lang="es" /><StatusPill kind="payment" value={o.payment_status || "unpaid"} testId="admin-order-payment" lang="es" />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Section title="Cliente y pedido" icon={FileText} testId="admin-order-info">
            <Row k="Contacto" v={`${o.name} · ${o.email}${o.phone ? " · " + o.phone : ""}`} />
            <Row k="Destinatario" v={o.recipient ? `${o.recipient.name} (${o.recipient.email}) · cuenta verificada` : "Sin cuenta vinculada · correo pendiente de verificar"} />
            <Row k="Tipo / plantilla" v={`${o.type}${o.template ? " · " + o.template : ""}`} />
            <Row k="País / importe" v={`${o.market} · ${o.currency} ${o.amount?.toLocaleString("es-CO")} · ${o.market === "CO" ? "Wompi" : "Stripe"}`} />
            <Row k="Transacción" v={o.payment_transaction_id ? `${o.payment_provider} · ${o.payment_transaction_id}` : "—"} />
            <Row k="Idioma" v={o.language} />
            <Row k="Descripción" v={o.description} />
            <Row k="Enlaces" v={o.links} />
            <Row k="Indicaciones" v={o.notes} />
            <Row k="Correo al equipo" v={o.email_status} />
            <Row k="Autorización" v={o.consent_at} />
          </Section>
          <Section title="Materiales privados" icon={Download} testId="admin-order-files">
            {o.files?.length ? o.files.map((f) => <a key={f.url} href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0 hover:text-primary" data-testid="admin-order-file"><span>{f.field} · {f.name}</span><span className="text-xs text-muted-foreground">{Math.round(f.size / 1024)} KB</span></a>) : <p className="text-sm text-muted-foreground">Sin adjuntos.</p>}
            <p className="text-[11px] text-muted-foreground mt-2">Enlaces firmados de 15 minutos.</p>
          </Section>
          <Section title="Producción" icon={PencilRuler} testId="admin-order-production-actions">
            <div className="text-sm space-y-1 mb-3">
              <Row k="Tarjeta" v={o.card ? `${o.card.title || "(sin título)"} · ${o.card.is_draft ? "borrador privado" : "entregada"}${o.card.is_public ? " · pública" : " · privada"}` : "Aún no creada"} />
              <Row k="Versión enviada" v={o.review_version ? `v${o.review_version} · ${(o.review_sent_at || "").slice(0, 16)}${o.card_changed_since_review ? " · ⚠ modificada después del envío" : ""}` : "—"} />
              <Row k="Aprobación" v={o.approval ? `v${o.approval.version} · ${o.approval.at.slice(0, 16)} · publicar: ${o.approval.publish ? "sí" : "no"}` : "—"} />
              <Row k="Rondas de ajustes" v={`${o.adjustment_rounds || 0} (1 incluida)`} />
            </div>
            {o.change_requests?.length > 0 && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 mb-3 text-sm" data-testid="admin-order-change-requests">{o.change_requests.map((c, i) => <p key={i}><b>v{c.version}</b> · {c.at.slice(0, 16)}: {c.message}</p>)}</div>}
            {canEdit && <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" disabled={busy || !["paid", "in_preparation", "changes_requested", "pending_approval", "received", "pending_payment"].includes(ps)} onClick={openEditor} data-testid="admin-order-open-editor"><PencilRuler className="w-4 h-4 mr-1.5" />{o.card_id ? "Editar tarjeta" : "Crear tarjeta"}</Button>
              {o.card_id && ps !== "approved" && <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => act(() => axios.post(`${API}/orders/${orderId}/send-review`, { note }, auth(token)), (d) => { try { navigator.clipboard?.writeText(d.review_url); } catch { /* ignore */ } return `Enviada para aprobación · v${d.version} · correo ${d.email_status} · enlace copiado`; })} data-testid="admin-order-send-review"><Send className="w-4 h-4 mr-1.5" />{ps === "pending_approval" ? "Reenviar invitación" : "Enviar para aprobación"}</Button>}
              <Button variant="ghost" className="rounded-full text-destructive" disabled={busy} onClick={() => window.confirm("¿Cancelar este pedido? La tarjeta en preparación se conserva como borrador privado.") && act(() => axios.post(`${API}/orders/${orderId}/status`, { production_status: "cancelled", note }, auth(token)), "Pedido cancelado")} data-testid="admin-order-cancel"><XCircle className="w-4 h-4 mr-1.5" />Cancelar pedido</Button>
            </div>}
            {canEdit && o.card_id && <Textarea className="mt-3" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota para el cliente al enviar (opcional)" data-testid="admin-order-note" />}
            {!o.payment_status || o.payment_status !== "paid" ? <p className="text-[11px] text-muted-foreground mt-3">Puedes preparar la tarjeta antes del pago, pero la entrega solo ocurre con pago confirmado y aprobación del cliente.</p> : null}
          </Section>
          <Section title="Pago" icon={Wallet} testId="admin-order-payment-section">
            {o.payments?.length ? o.payments.map((p) => <Row key={p.id} k={`${p.provider} #${p.attempt}`} v={`${p.status}${p.provider_ref ? " · " + p.provider_ref : ""}${p.transaction_id ? " · " + p.transaction_id : ""}`} />) : <p className="text-sm text-muted-foreground">Sin intentos de pago.</p>}
            {access.admin && o.payment_status !== "paid" && ps !== "cancelled" && <div className="mt-3 space-y-2" data-testid="admin-order-manual-payment">
              <p className="text-xs font-semibold">Conciliación manual (solo administradores, con referencia del proveedor)</p>
              <div className="flex flex-wrap gap-2">
                <select value={pay.status} onChange={(e) => setPay({ ...pay, status: e.target.value })} className="h-9 rounded-lg bg-muted px-2 text-sm" data-testid="admin-pay-status">{Object.keys(PAYMENT_LABELS).map((k) => <option key={k} value={k}>{PAYMENT_LABELS[k][0]}</option>)}</select>
                <Input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} placeholder="Referencia / ID de transacción" className="flex-1 min-w-[160px]" data-testid="admin-pay-reference" />
              </div>
              <Input value={pay.note} onChange={(e) => setPay({ ...pay, note: e.target.value })} placeholder="Nota (opcional)" data-testid="admin-pay-note" />
              <Button size="sm" className="rounded-full" disabled={busy || pay.reference.trim().length < 4} onClick={() => act(() => axios.post(`${API}/orders/${orderId}/payment`, pay, auth(token)), "Pago actualizado")} data-testid="admin-pay-submit">Registrar</Button>
            </div>}
            {access.admin && o.payment_status === "paid" && ps !== "cancelled" && <div className="mt-3 flex gap-2">
              {["refunded", "disputed"].map((s) => <Button key={s} size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => { const ref = window.prompt("Referencia del proveedor"); if (ref) act(() => axios.post(`${API}/orders/${orderId}/payment`, { status: s, reference: ref }, auth(token)), "Registrado"); }} data-testid={`admin-pay-${s}`}>{PAYMENT_LABELS[s][0]}</Button>)}
            </div>}
          </Section>
          {canEdit && <Section title="Destinatario" icon={UserCog} testId="admin-order-recipient">
            <p className="text-xs text-muted-foreground mb-2">Cambiar el correo destinatario invalida los enlaces de revisión y exige verificar el nuevo correo. Queda registrado en el historial.</p>
            <div className="flex flex-wrap gap-2">
              <Input value={recipient.email} onChange={(e) => setRecipient({ ...recipient, email: e.target.value })} placeholder="nuevo@correo.com" className="flex-1 min-w-[160px]" data-testid="admin-recipient-email" />
              <Input value={recipient.reason} onChange={(e) => setRecipient({ ...recipient, reason: e.target.value })} placeholder="Motivo verificado" className="flex-1 min-w-[160px]" data-testid="admin-recipient-reason" />
              <Button size="sm" variant="outline" className="rounded-full" disabled={busy || !recipient.email.includes("@") || recipient.reason.trim().length < 5} onClick={() => act(() => axios.post(`${API}/orders/${orderId}/recipient`, recipient, auth(token)), "Destinatario actualizado")} data-testid="admin-recipient-submit">Cambiar</Button>
            </div>
          </Section>}
          <Section title="Historial" icon={Mail} testId="admin-order-history">
            <div className="max-h-72 overflow-y-auto text-xs space-y-1">
              {(o.history || []).slice().reverse().map((h, i) => <p key={i}><span className="text-muted-foreground">{h.at.slice(0, 19).replace("T", " ")}</span> · <b>{h.action}</b>{h.by ? ` · ${h.by.slice(0, 8)}` : ""}{Object.entries(h).filter(([k]) => !["at", "action", "by"].includes(k)).map(([k, v]) => ` · ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("")}</p>)}
              {(o.client_emails || []).map((e, i) => <p key={`e${i}`} className="text-muted-foreground">{e.at.slice(0, 19).replace("T", " ")} · correo cliente «{e.kind}» · {e.status}</p>)}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
