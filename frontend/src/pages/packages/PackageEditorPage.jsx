import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, CreditCard, Eye, History, Link2, PencilRuler, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import DeliveryCard from "./DeliveryCard";
import { api, DELIV, PAY, PREP, Pill } from "./packagesApi";

const F = [["name", "Nombre completo"], ["profession", "Profesión / rol"], ["company", "Empresa"], ["phone", "Teléfono"], ["email", "Correo de contacto"], ["website", "Sitio web"], ["location", "Ciudad / país"]];
const Box = ({ title, icon: Icon, children, testId }) => <section className="rounded-2xl border border-border bg-card p-4" data-testid={testId}><h2 className="text-sm font-bold mb-3 inline-flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</h2>{children}</section>;

export default function PackageEditorPage() {
  const { packageId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [p, setP] = useState(null);
  const [access, setAccess] = useState({});
  const [client, setClient] = useState(null);
  const [saving, setSaving] = useState("");
  const [fin, setFin] = useState({ advisor_handle: "", market: "CO", payment_method: "virtual" });
  const [cash, setCash] = useState({ amount_received: "", receipt_ref: "", note: "" });
  const [reassign, setReassign] = useState({ advisor_email: "", reason: "" });
  const [preview, setPreview] = useState(false);
  const timer = useRef(null);
  const load = () => api.get(token, packageId).then((d) => { setP(d); setClient((c) => c || d.client); setFin((f) => ({ ...f, advisor_handle: d.advisor_handle, market: d.market || f.market, payment_method: d.payment_method || f.payment_method })); }).catch((e) => brunoToast.error(e.response?.status === 403 ? "Este paquete pertenece a otro asesor" : "No se pudo cargar"));
  useEffect(() => { if (token) { load(); api.access(token).then(setAccess).catch(() => {}); } }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const locked = p?.delivery_status === "activated";
  const update = (k, v) => { const next = { ...client, [k]: v }; setClient(next); setSaving("Guardando…"); clearTimeout(timer.current); timer.current = setTimeout(async () => { try { await api.patch(token, packageId, next); setSaving("Guardado"); } catch { setSaving("No se pudo guardar"); } }, 700); };
  const uploadPhoto = async (file) => { if (!file) return; const fd = new FormData(); fd.append("file", file); setSaving("Subiendo foto…"); try { const r = await axios.post(`${process.env.REACT_APP_BACKEND_URL}/api/albums/upload`, fd, { headers: { Authorization: `Bearer ${token}` } }); update("avatar_url", r.data.url); } catch { brunoToast.error("No se pudo subir la foto"); setSaving(""); } };
  const run = async (fn, ok) => { try { const r = await fn(); if (ok) brunoToast.success(ok); await load(); return r; } catch (e) { const d = e.response?.data?.detail; brunoToast.error(typeof d === "string" ? d : d?.error || "No se pudo completar"); return null; } };
  if (!p || !client) return <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">Cargando…</div>;
  const price = fin.market === "CO" ? "COP $30.000" : "US$30";
  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-28" data-testid="package-editor">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/asesores")} data-testid="package-back"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-[180px]"><h1 className="text-lg font-bold truncate">Paquete {p.ref} · {client.name || "nuevo cliente"}</h1><p className="text-xs text-muted-foreground">Asesor @{p.advisor_handle} · {saving || "Autoguardado activo"}</p></div>
          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto"><Pill map={PREP} value={p.prep_status} force="es" testId="package-prep" /><Pill map={PAY} value={p.payment_status} force="es" testId="package-pay" /><Pill map={DELIV} value={p.delivery_status} force="es" testId="package-deliv" /></div>
        </div>
        {locked && <p className="text-sm rounded-2xl bg-emerald-50 border border-emerald-200 p-3 mb-4" data-testid="package-locked">Paquete entregado y activado. El contenido ahora pertenece al cliente; solo se conserva el registro comercial.</p>}
        <div className="grid md:grid-cols-2 gap-4">
          <Box title="Perfil del cliente" icon={Camera} testId="package-profile">
            <div className="flex items-center gap-3 mb-3">
              <label className="w-16 h-16 rounded-full bg-muted overflow-hidden grid place-items-center cursor-pointer border" data-testid="package-photo">{client.avatar_url ? <img src={client.avatar_url} alt="" className="w-full h-full object-cover" /> : <Camera className="w-5 h-5 text-muted-foreground" />}<input type="file" accept="image/*" className="hidden" disabled={locked} onChange={(e) => uploadPhoto(e.target.files?.[0])} data-testid="package-photo-input" /></label>
              <p className="text-xs text-muted-foreground">Foto de perfil del cliente (toca para subir). Nunca pedimos ni creamos su contraseña: el cliente activará el paquete con su propia cuenta.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">{F.map(([k, l]) => <Input key={k} value={client[k] || ""} disabled={locked} onChange={(e) => update(k, e.target.value)} placeholder={l} data-testid={`package-field-${k}`} />)}</div>
            <Textarea className="mt-2" rows={3} value={client.bio || ""} disabled={locked} onChange={(e) => update("bio", e.target.value)} placeholder="Presentación / biografía" data-testid="package-field-bio" />
            <Input className="mt-2" value={(client.social_links || []).map((s) => s.url || s).join(", ")} disabled={locked} onChange={(e) => update("social_links", e.target.value.split(",").map((s) => s.trim()).filter(Boolean).map((url) => ({ url })))} placeholder="Redes sociales (URLs separadas por coma)" data-testid="package-field-social" />
          </Box>
          <Box title="Las 3 tarjetas digitales" icon={PencilRuler} testId="package-cards">
            <div className="space-y-2">{(p.cards || []).map((c, i) => <div key={c.id} className="flex items-center gap-3 rounded-xl border p-2"><span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-bold">{i + 1}</span><span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate">{c.title || "Sin título"}</span><span className="text-[11px] text-muted-foreground">{c.card_type}</span></span>{!locked && <Button size="sm" variant="outline" className="rounded-full" onClick={() => navigate(`/cards/${c.id}/edit?package=${packageId}`)} data-testid={`package-card-edit-${i + 1}`}>Editar</Button>}<Button size="sm" variant="ghost" onClick={() => navigate(`/c/${c.id}`)} data-testid={`package-card-view-${i + 1}`}><Eye className="w-4 h-4" /></Button></div>)}</div>
            <p className="text-[11px] text-muted-foreground mt-2">Borradores privados del paquete: no aparecen en tu perfil personal. Cada tarjeta necesita al menos un título.</p>
            <Button variant="outline" className="rounded-full mt-3" onClick={() => setPreview(!preview)} data-testid="package-preview-toggle"><Eye className="w-4 h-4 mr-1.5" />{preview ? "Ocultar vista previa" : "Previsualizar paquete"}</Button>
            {preview && <div className="mt-3 rounded-2xl bg-muted/40 p-3 text-sm" data-testid="package-preview"><div className="flex items-center gap-3">{client.avatar_url && <img src={client.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />}<div><p className="font-semibold">{client.name || "—"}</p><p className="text-xs text-muted-foreground">{[client.profession, client.company, client.location].filter(Boolean).join(" · ")}</p></div></div><p className="mt-2 text-xs whitespace-pre-wrap">{client.bio}</p><p className="mt-2 text-xs">{(p.cards || []).map((c) => c.title || "Sin título").join(" · ")}</p></div>}
          </Box>
          {!locked && <Box title="¿Qué asesor creó este paquete? · país y pago" icon={Wallet} testId="package-finalize">
            <div className="grid sm:grid-cols-3 gap-2">
              <Input value={fin.advisor_handle} readOnly={!access.admin} onChange={(e) => setFin({ ...fin, advisor_handle: e.target.value })} placeholder="@asesor" data-testid="package-advisor-handle" />
              <select value={fin.market} disabled={p.payment_status === "confirmed"} onChange={(e) => setFin({ ...fin, market: e.target.value })} className="h-10 rounded-lg bg-muted px-2 text-sm" data-testid="package-market"><option value="CO">Colombia · COP $30.000</option><option value="US">Estados Unidos · US$30</option></select>
              <select value={fin.payment_method} onChange={(e) => setFin({ ...fin, payment_method: e.target.value })} className="h-10 rounded-lg bg-muted px-2 text-sm" data-testid="package-method"><option value="virtual">Virtual (Stripe / Wompi)</option><option value="cash">Efectivo</option></select>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Precio: <b data-testid="package-price">{price}</b> · perfil completo + 3 tarjetas digitales (pago único, no suscripción). Elegir un método no marca el paquete como pagado. El @ queda guardado con tu identificador permanente; solo un administrador reasigna ventas.</p>
            <Button className="rounded-full mt-3" onClick={() => run(() => api.finalize(token, packageId, fin), p.prep_status === "ready" ? "Paquete actualizado" : "Paquete listo para entregar")} data-testid="package-finalize-btn">{p.prep_status === "ready" ? "Actualizar y mostrar tarjeta de entrega" : "Finalizar: generar tarjeta de entrega"}</Button>
          </Box>}
          {p.claim_url && !locked && <div className="md:col-span-2"><DeliveryCard pkg={p} url={p.claim_url} /><div className="flex gap-2 mt-2"><Button size="sm" variant="outline" className="rounded-full" onClick={() => run(() => api.link(token, packageId, false), "Nuevo enlace generado (el anterior quedó invalidado)")} data-testid="package-link-regenerate"><Link2 className="w-4 h-4 mr-1" />Regenerar enlace</Button><Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => run(() => api.link(token, packageId, true), "Enlace revocado")} data-testid="package-link-revoke">Revocar enlace</Button><span className="text-[11px] text-muted-foreground self-center">Vence: {(p.claim_expires_at || "").slice(0, 10)}</span></div></div>}
          {p.payment_method === "cash" && p.prep_status === "ready" && p.payment_status !== "confirmed" && <Box title="Efectivo · pendiente de confirmar" icon={CreditCard} testId="package-cash">
            <p className="text-xs text-muted-foreground mb-2">Importe esperado: <b>{p.currency} {p.amount?.toLocaleString("es-CO")}</b>. Solo un asesor con permiso de cobro o un administrador confirma la recepción; el cliente no puede hacerlo.</p>
            {access.cash ? <div className="flex flex-wrap gap-2"><Input type="number" value={cash.amount_received} onChange={(e) => setCash({ ...cash, amount_received: e.target.value })} placeholder={`Importe recibido (${p.currency})`} className="w-44" data-testid="package-cash-amount" /><Input value={cash.receipt_ref} onChange={(e) => setCash({ ...cash, receipt_ref: e.target.value })} placeholder="Referencia del recibo" className="flex-1 min-w-[140px]" data-testid="package-cash-ref" /><Button className="rounded-full" onClick={() => run(() => api.cash(token, packageId, { amount_received: Number(cash.amount_received), currency: p.currency, receipt_ref: cash.receipt_ref, note: cash.note }), "Efectivo confirmado")} data-testid="package-cash-confirm">Confirmar efectivo recibido</Button></div> : <p className="text-xs text-amber-800" data-testid="package-cash-nopermission">No tienes permiso de cobro. Pide a un administrador que confirme el efectivo o que te asigne el permiso.</p>}
          </Box>}
          {p.receipt && <Box title="Comprobante de pago" icon={CreditCard} testId="package-receipt"><p className="text-sm">{p.receipt.id} · {p.receipt.method} · {p.receipt.currency} {p.receipt.amount} · {(p.receipt.at || "").slice(0, 16).replace("T", " ")}{p.receipt.receipt_ref ? ` · recibo ${p.receipt.receipt_ref}` : ""}{p.receipt.transaction_id ? ` · ${p.receipt.transaction_id}` : ""}{p.receipt.confirmed_by_handle ? ` · confirmó @${p.receipt.confirmed_by_handle}` : ""}</p></Box>}
          {p.delivery_status === "error" && <Box title="Transferencia con error" icon={History} testId="package-transfer-error"><p className="text-sm text-destructive mb-2">{p.transfer_error}</p><Button size="sm" className="rounded-full" onClick={() => run(() => api.retry(token, packageId), "Transferencia reintentada")} data-testid="package-retry-transfer">Reintentar transferencia (sin cobrar de nuevo)</Button></Box>}
          {access.admin && !locked && <Box title="Reasignar venta (solo administrador)" icon={History} testId="package-reassign"><div className="flex flex-wrap gap-2"><Input value={reassign.advisor_email} onChange={(e) => setReassign({ ...reassign, advisor_email: e.target.value })} placeholder="correo del asesor" className="flex-1 min-w-[160px]" data-testid="package-reassign-email" /><Input value={reassign.reason} onChange={(e) => setReassign({ ...reassign, reason: e.target.value })} placeholder="Motivo" className="flex-1 min-w-[160px]" data-testid="package-reassign-reason" /><Button size="sm" variant="outline" className="rounded-full" disabled={!reassign.advisor_email || reassign.reason.length < 3} onClick={() => run(() => api.reassign(token, packageId, reassign), "Venta reasignada")} data-testid="package-reassign-btn">Reasignar</Button></div></Box>}
          <Box title="Historial" icon={History} testId="package-history"><div className="max-h-60 overflow-y-auto text-xs space-y-1">{(p.history || []).slice().reverse().map((h, i) => <p key={i}><span className="text-muted-foreground">{h.at.slice(0, 19).replace("T", " ")}</span> · <b>{h.action}</b>{Object.entries(h).filter(([k]) => !["at", "action"].includes(k)).map(([k, v]) => ` · ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v).slice(0, 40)}`).join("")}</p>)}</div></Box>
        </div>
      </div>
    </div>
  );
}
