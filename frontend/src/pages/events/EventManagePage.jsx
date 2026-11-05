import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import QRCode from "qrcode";
import { ArrowLeft, Copy, ExternalLink, Loader2, Plus, QrCode, Save, Smartphone, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { isNative } from "@/native/capacitor";
import { api, errText, fmtBytes } from "@/pages/events/eventsApi";

const native = () => { try { return isNative(); } catch { return false; } };
const WEB = "https://brunocard.com";
const Field = ({ label, children }) => <label className="block text-xs font-semibold text-muted-foreground space-y-1"><span>{label}</span>{children}</label>;
const copy = async (t) => { try { await navigator.clipboard.writeText(t); brunoToast.success("Enlace copiado"); } catch { brunoToast.error("No se pudo copiar"); } };

/* Compra (activación o ampliación): en web abre la pasarela; en la app nativa muestra el producto y envía a pagar en brunocard.com. */
const BuyButton = ({ ev, kind, packId, label, price, settings, token, testId }) => {
  const [busy, setBusy] = useState(false);
  const webUrl = `${WEB}/events/${ev.id}/manage?buy=${kind}${packId ? `&pack=${packId}` : ""}`;
  if (native()) return <Button variant="outline" className="rounded-full" onClick={() => window.open(webUrl, "_blank")} data-testid={testId}><Smartphone className="w-4 h-4 mr-1.5" /> {label} · {price} · pagar en brunocard.com</Button>;
  const disabled = !settings?.activation?.payments_enabled || !settings?.providers?.[ev.market];
  const go = async () => { setBusy(true); try { const r = await api.checkout(token, ev.id, { kind, pack_id: packId }); window.location.assign(r.url); } catch (e) { brunoToast.error(errText(e, "No se pudo iniciar el pago")); setBusy(false); } };
  return (
    <div className="space-y-1">
      <Button className="rounded-full" onClick={go} disabled={busy || disabled} data-testid={testId}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 mr-1.5" />}{label} · {price}</Button>
      {disabled && <p className="text-[11px] text-muted-foreground" data-testid={`${testId}-disabled`}>{!settings?.activation?.payments_enabled ? "Pagos aún no habilitados. Escríbenos a bruno@brunocard.com." : "Pago en línea no disponible para tu país por ahora."}</p>}
    </div>
  );
};

const InviteRow = ({ inv, ev, onDelete }) => {
  const [qr, setQr] = useState("");
  const url = `${window.location.origin}/e/${ev.id}/i/${inv.id}`;
  const showQr = () => QRCode.toDataURL(url, { width: 320, margin: 1 }).then(setQr);
  return (
    <li className="rounded-xl border border-border p-3 text-sm space-y-2" data-testid={`invite-${inv.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0"><p className="font-semibold truncate">{inv.guest_name}</p><p className="text-[11px] text-muted-foreground">RSVP: {{ yes: "asistirá", no: "no asistirá", maybe: "quizás", pending: "sin responder" }[inv.rsvp]} · {inv.linked_card_id ? "tarjeta vinculada" : "sin tarjeta"} · {inv.views || 0} vistas</p></div>
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => copy(url)} aria-label="Copiar" data-testid={`invite-copy-${inv.id}`}><Copy className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={qr ? () => setQr("") : showQr} aria-label="QR" data-testid={`invite-qr-${inv.id}`}><QrCode className="w-4 h-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => onDelete(inv)} aria-label="Eliminar" data-testid={`invite-delete-${inv.id}`}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </div>
      {qr && <img src={qr} alt="QR de la invitación" className="w-40 h-40 rounded-lg mx-auto" />}
    </li>
  );
};

export default function EventManagePage() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [form, setForm] = useState(null);
  const [cards, setCards] = useState([]);
  const [saving, setSaving] = useState(false);
  const [guest, setGuest] = useState({ guest_name: "", message: "", seats: 1 });
  const load = () => api.manage(token, id).then((r) => { setD(r); setForm((f) => f || { title: r.title, date: r.date || "", location: r.location || "", description: r.description || "", cover_url: r.cover_url || "", organizer_card_id: r.organizer_card_id || "", company_card_id: r.company_card_id || "", allow_guest_uploads: r.allow_guest_uploads !== false, show_guest_cards: r.show_guest_cards !== false }); }).catch((e) => brunoToast.error(errText(e, "No se pudo cargar")));
  useEffect(() => { if (token) { load(); axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cards`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setCards(r.data || [])).catch(() => {}); } }, [token, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d || !form) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });
  const save = async () => { setSaving(true); try { await api.update(token, id, { ...form, market: d.market }); await load(); brunoToast.success("Evento guardado"); } catch (e) { brunoToast.error(errText(e, "No se pudo guardar")); } finally { setSaving(false); } };
  const publish = async () => { try { await api.publish(token, id); await load(); brunoToast.success("¡Evento publicado!"); } catch (e) { brunoToast.error(errText(e, "No se pudo publicar")); } };
  const invite = async () => { if (!guest.guest_name.trim()) return; try { await api.invite(token, id, guest); setGuest({ guest_name: "", message: "", seats: 1 }); await load(); } catch (e) { brunoToast.error(errText(e, "No se pudo crear")); } };
  const active = ["paid", "granted"].includes(d.activation.status);
  const st = d.storage; const pct = Math.min(100, Math.round(((st.used_bytes || 0) / st.total_bytes) * 100));
  const publicUrl = `${window.location.origin}/e/${id}`;
  return (
    <div className="min-h-screen bg-background px-4" style={{ paddingTop: "calc(var(--safe-top, 0px) + 12px)", paddingBottom: "calc(var(--content-bottom, 96px) + 24px)" }} data-testid="event-manage-page">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/events")} aria-label="Volver" data-testid="manage-back-btn"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="flex-1 min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-primary">{d.ref}</p><h1 className="text-lg font-black truncate">{d.title}</h1></div>
          <span className={`text-[11px] font-semibold rounded-full px-2.5 py-1 ${d.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`} data-testid="event-status-pill">{d.status === "active" ? "Publicado" : "Borrador"}</span>
        </div>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="activation-section">
          <h2 className="font-bold text-sm">Activación de la tarjeta de evento</h2>
          {active ? (
            <>
              <p className="text-xs text-emerald-700 font-semibold" data-testid="activation-active">Activa · {d.activation.status === "granted" ? "habilitada por BRUNO" : `pagada (${d.activation.provider})`}</p>
              {d.status !== "active" ? <Button className="rounded-full" onClick={publish} data-testid="publish-btn">Publicar evento</Button> : (
                <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="rounded-full" data-testid="open-public-btn"><Link to={`/e/${id}`}><ExternalLink className="w-4 h-4 mr-1.5" /> Ver tarjeta pública</Link></Button><Button variant="outline" className="rounded-full" onClick={() => copy(publicUrl)} data-testid="copy-public-btn"><Copy className="w-4 h-4 mr-1.5" /> Copiar enlace</Button></div>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Pago único, sin suscripción. Incluye álbum colaborativo de {fmtBytes(st.included_bytes)} / {st.max_photos} fotos durante {Math.round(st.retention_days / 30)} meses. Ver, conectar e interactuar con la tarjeta es gratis para todos.</p>
              <BuyButton ev={d} kind="activation" label="Activar tarjeta" price={d.price_label} settings={d.settings} token={token} testId="buy-activation-btn" />
            </>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="event-form">
          <h2 className="font-bold text-sm">Datos del evento</h2>
          <Field label="Título"><Input value={form.title} onChange={set("title")} data-testid="ev-title" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fecha y hora"><Input type="datetime-local" value={form.date} onChange={set("date")} data-testid="ev-date" /></Field>
            <Field label="Lugar"><Input value={form.location} onChange={set("location")} data-testid="ev-location" /></Field>
          </div>
          <Field label="Descripción"><Textarea rows={3} value={form.description} onChange={set("description")} data-testid="ev-description" /></Field>
          <Field label="Imagen de portada (URL)"><Input value={form.cover_url} onChange={set("cover_url")} placeholder="https://…" data-testid="ev-cover" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Tarjeta del organizador"><select className="w-full h-9 rounded-xl border border-border bg-background px-2 text-sm" value={form.organizer_card_id} onChange={set("organizer_card_id")} data-testid="ev-organizer-card"><option value="">—</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
            <Field label="Tarjeta de empresa"><select className="w-full h-9 rounded-xl border border-border bg-background px-2 text-sm" value={form.company_card_id} onChange={set("company_card_id")} data-testid="ev-company-card"><option value="">—</option>{cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
          </div>
          <label className="flex items-center justify-between text-xs"><span>Los invitados pueden subir fotos</span><Switch checked={form.allow_guest_uploads} onCheckedChange={set("allow_guest_uploads")} data-testid="ev-allow-uploads" /></label>
          <label className="flex items-center justify-between text-xs"><span>Mostrar tarjetas de invitados que lo autoricen</span><Switch checked={form.show_guest_cards} onCheckedChange={set("show_guest_cards")} data-testid="ev-show-guests" /></label>
          <Button onClick={save} disabled={saving} className="rounded-full" data-testid="ev-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Guardar</Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="storage-section">
          <h2 className="font-bold text-sm">Álbum y almacenamiento</h2>
          <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
          <p className="text-xs text-muted-foreground" data-testid="storage-usage">{fmtBytes(st.used_bytes)} de {fmtBytes(st.total_bytes)} · {st.photo_count}/{st.total_photos} fotos · máx. {fmtBytes(st.max_file_bytes)} por foto · se conservan hasta {new Date(st.retain_until).toLocaleDateString("es-CO")}</p>
          {st.full && <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2" data-testid="storage-full">Álbum lleno: las fotos existentes se conservan; amplía la capacidad para seguir recibiendo fotos.</p>}
          <div className="flex flex-wrap gap-2">
            {(d.settings?.packs || []).map((p) => <BuyButton key={p.id} ev={d} kind="storage_pack" packId={p.id} label={p.label} price={p.labels[d.market]} settings={d.settings} token={token} testId={`buy-pack-${p.id}`} />)}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="invitations-section">
          <h2 className="font-bold text-sm">Invitaciones ({d.invitations.length})</h2>
          <div className="grid grid-cols-[1fr_72px] gap-2">
            <Input placeholder="Nombre del invitado" value={guest.guest_name} onChange={(e) => setGuest({ ...guest, guest_name: e.target.value })} data-testid="invite-name" />
            <Input type="number" min={1} max={20} value={guest.seats} onChange={(e) => setGuest({ ...guest, seats: Number(e.target.value) })} data-testid="invite-seats" />
          </div>
          <Input placeholder="Mensaje personal (opcional)" value={guest.message} onChange={(e) => setGuest({ ...guest, message: e.target.value })} data-testid="invite-message" />
          <Button variant="outline" className="rounded-full" onClick={invite} disabled={!guest.guest_name.trim()} data-testid="invite-create-btn"><Plus className="w-4 h-4 mr-1.5" /> Crear invitación</Button>
          <ul className="space-y-2">{d.invitations.map((inv) => <InviteRow key={inv.id} inv={inv} ev={d} onDelete={async (i) => { await api.removeInvite(token, id, i.id); load(); }} />)}</ul>
        </section>

        {d.purchases.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-4" data-testid="purchases-section">
            <h2 className="font-bold text-sm mb-2">Compras</h2>
            <ul className="text-xs space-y-1">{d.purchases.map((p) => <li key={p.id} className="flex justify-between" data-testid={`purchase-${p.id}`}><span>{p.kind === "activation" ? "Activación" : `Ampliación ${p.pack_id}`}</span><span>{p.currency} {p.amount} · {p.status}</span></li>)}</ul>
          </section>
        )}
      </div>
    </div>
  );
}
