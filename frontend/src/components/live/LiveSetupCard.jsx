import React, { useEffect, useState } from "react";
import axios from "axios";
import { Radio, Lock, Globe, ShieldCheck, Loader2, Camera, CalendarClock, MessageCircle, Heart, Gift, Share2, Disc3, CreditCard, Ticket, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const CURRENCIES = ["usd", "eur", "mxn", "cop", "brl", "gbp", "cad"];

const Toggle = ({ icon: Icon, label, hint, value, onChange, testid }) => (
  <label className="flex items-center gap-3 rounded-2xl bg-foreground/[0.05] px-3 py-2.5 cursor-pointer" data-testid={`${testid}-row`}>
    <Icon className="w-4 h-4 text-primary shrink-0" />
    <div className="flex-1 leading-tight min-w-0"><p className="text-sm font-semibold">{label}</p>{hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}</div>
    <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="accent-orange-500 w-5 h-5" data-testid={testid} />
  </label>
);

/** Formulario completo del live (no inicia nada: solo "Iniciar en vivo" lo hace). Desplazable en pantallas pequeñas. */
export default function LiveSetupCard({ form, setForm, categories, videoRef, onStart, starting, camError, upcoming, onGoLive, scheduleAt, setScheduleAt, onSchedule }) {
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [coverBusy, setCoverBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  useEffect(() => { if (token) axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setCards(Array.isArray(r.data) ? r.data : r.data?.cards || [])).catch(() => {}); }, [token]);

  const captureCover = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return brunoToast.error("Activa la cámara para capturar la portada");
    setCoverBusy(true);
    try {
      const c = document.createElement("canvas"); c.width = 720; c.height = 1280;
      const ctx = c.getContext("2d"); const scale = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
      const w = v.videoWidth * scale, h = v.videoHeight * scale;
      ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
      const blob = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.88));
      const fd = new FormData(); fd.append("file", blob, "cover.jpg");
      const r = await axios.post(`${API}/upload/image?aspect=story&folder=bruno/live-covers`, fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
      set("cover_url")(r.data.url); brunoToast.success("Portada capturada");
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar la portada"); }
    finally { setCoverBusy(false); }
  };
  const pickCover = async (file) => {
    if (!file) return;
    setCoverBusy(true);
    try { const fd = new FormData(); fd.append("file", file); const r = await axios.post(`${API}/upload/image?aspect=story&folder=bruno/live-covers`, fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } }); set("cover_url")(r.data.url); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo subir la portada"); }
    finally { setCoverBusy(false); }
  };

  const paid = form.is_private && form.ticket_mode === "paid";
  const missing = [];
  if (!form.title.trim()) missing.push("título");
  if (paid && !(Number(form.ticket_price) >= 0.5)) missing.push("precio de entrada (mín. 0,50)");
  if (camError) missing.push("permiso de cámara/micrófono");

  return (
    <div className="absolute inset-x-3 z-30 bruno-glass rounded-[28px] border flex flex-col" style={{ bottom: "calc(var(--safe-bottom) + 12px)", top: "calc(var(--safe-top) + 64px)", maxWidth: 480, marginInline: "auto" }} data-testid="live-setup-card">
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 no-scrollbar">
        <div className="flex gap-3">
          <button onClick={captureCover} disabled={coverBusy} className="relative w-[72px] h-[108px] shrink-0 rounded-2xl bg-foreground/[0.06] overflow-hidden grid place-items-center" data-testid="live-cover-btn" aria-label="Portada">
            {form.cover_url ? <img src={form.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : null}
            {coverBusy ? <Loader2 className="w-5 h-5 animate-spin relative" /> : <Camera className="w-5 h-5 relative text-primary" />}
            {!form.cover_url && !coverBusy && <span className="relative text-[9px] font-semibold mt-1">Portada</span>}
          </button>
          <div className="flex-1 space-y-2 min-w-0">
            <input value={form.title} onChange={(e) => set("title")(e.target.value)} maxLength={80} placeholder="Título del live *" className="w-full h-11 rounded-2xl bg-foreground/[0.06] px-4 text-sm outline-none focus:ring-2 ring-primary/40" data-testid="live-title-input" />
            <textarea value={form.description} onChange={(e) => set("description")(e.target.value)} maxLength={300} rows={2} placeholder="Descripción (opcional)" className="w-full rounded-2xl bg-foreground/[0.06] px-4 py-2 text-sm outline-none focus:ring-2 ring-primary/40 resize-none" data-testid="live-description-input" />
            <label className="text-[11px] text-primary font-semibold cursor-pointer">Elegir portada de la galería<input type="file" accept="image/*" className="hidden" onChange={(e) => pickCover(e.target.files?.[0])} data-testid="live-cover-file" /></label>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
          {categories.map((c) => <button key={c.id} onClick={() => set("category")(c.id)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium ${form.category === c.id ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid={`live-category-${c.id}`}>{c.name}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => set("is_private")(false)} className={`h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold ${!form.is_private ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-visibility-public"><Globe className="w-4 h-4" /> Público</button>
          <button onClick={() => set("is_private")(true)} className={`h-11 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold ${form.is_private ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-visibility-private"><Lock className="w-4 h-4" /> Privado</button>
        </div>
        {form.is_private && (
          <div className="space-y-2 rounded-2xl border border-primary/30 p-3" data-testid="live-private-box">
            <p className="text-[11px] text-muted-foreground">Privado = solo con PIN · solo mayores de 18 años (se valida con la fecha de nacimiento del perfil).</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => set("ticket_mode")("free")} className={`h-10 rounded-xl text-xs font-semibold ${form.ticket_mode !== "paid" ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-ticket-free">Entrada gratuita</button>
              <button onClick={() => set("ticket_mode")("paid")} className={`h-10 rounded-xl text-xs font-semibold inline-flex items-center justify-center gap-1 ${form.ticket_mode === "paid" ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-ticket-paid"><Ticket className="w-3.5 h-3.5" /> De pago</button>
            </div>
            {paid && (
              <div className="flex gap-2">
                <input type="number" min="0.5" step="0.5" value={form.ticket_price} onChange={(e) => set("ticket_price")(e.target.value)} placeholder="Precio" className="flex-1 min-w-0 h-10 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid="live-ticket-price" />
                <select value={form.ticket_currency} onChange={(e) => set("ticket_currency")(e.target.value)} className="h-10 rounded-xl bg-foreground/[0.06] px-2 text-sm" data-testid="live-ticket-currency">{CURRENCIES.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}</select>
              </div>
            )}
            {paid && <p className="text-[11px] text-muted-foreground">El comprador ve precio y total antes de pagar. BRUNO retiene su comisión sobre el importe base; el resto queda en tu saldo de creador. Si el live se cancela o no llega a empezar, las entradas se reembolsan.</p>}
            <Toggle icon={ShieldCheck} label="Protección anti-captura" hint="marca de agua · bloqueo de capturas (app nativa)" value={form.anti_capture} onChange={set("anti_capture")} testid="live-anticapture-toggle" />
          </div>
        )}
        <div className="grid grid-cols-1 gap-1.5">
          <Toggle icon={MessageCircle} label="Comentarios" value={form.allow_comments} onChange={set("allow_comments")} testid="live-toggle-comments" />
          <Toggle icon={Heart} label="Likes (corazones gratis)" value={form.allow_likes} onChange={set("allow_likes")} testid="live-toggle-likes" />
          <Toggle icon={Gift} label="Regalos" hint="los espectadores pueden enviarte regalos de pago" value={form.allow_gifts} onChange={set("allow_gifts")} testid="live-toggle-gifts" />
          <Toggle icon={Share2} label="Permitir compartir" hint={form.is_private ? "comparte la invitación; nunca salta PIN, edad ni pago" : undefined} value={form.allow_share} onChange={set("allow_share")} testid="live-toggle-share" />
          <Toggle icon={Disc3} label="Grabar el live" hint="se avisa a los espectadores · tú decides al final si lo publicas" value={form.record} onChange={set("record")} testid="live-toggle-record" />
        </div>
        {cards.length > 0 && (
          <div className="flex items-center gap-2 rounded-2xl bg-foreground/[0.05] px-3 py-2" data-testid="live-card-row">
            <CreditCard className="w-4 h-4 text-primary shrink-0" />
            <select value={form.card_id || ""} onChange={(e) => set("card_id")(e.target.value || null)} className="flex-1 bg-transparent text-sm outline-none" data-testid="live-card-select">
              <option value="">Sin tarjeta BRUNO vinculada</option>
              {cards.map((c) => <option key={c.id} value={c.id}>{c.title || c.name || "Tarjeta"}</option>)}
            </select>
            {form.card_id && <button onClick={() => set("card_id")(null)} aria-label="Quitar tarjeta"><X className="w-4 h-4" /></button>}
          </div>
        )}
        {upcoming.length > 0 && (
          <div className="space-y-2" data-testid="live-upcoming-mine">
            {upcoming.map((l) => <div key={l.id} className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2"><CalendarClock className="w-4 h-4 text-primary shrink-0" /><div className="flex-1 min-w-0 leading-tight"><p className="text-sm font-semibold truncate">{l.title}</p><p className="text-[11px] text-muted-foreground">{new Date(l.scheduled_at).toLocaleString()} · {l.reminder_count || 0} avisos</p></div><button onClick={() => onGoLive(l.id)} className="h-8 px-3 rounded-full bg-red-500 text-white text-xs font-bold" data-testid={`live-golive-${l.id}`}>Iniciar ahora</button></div>)}
          </div>
        )}
        <details className="rounded-2xl border border-border p-3" data-testid="live-schedule-box">
          <summary className="text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"><CalendarClock className="w-3.5 h-3.5" /> Programar para después</summary>
          <div className="flex gap-2 mt-2"><input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="flex-1 min-w-0 h-10 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid="live-schedule-input" /><button onClick={onSchedule} className="h-10 px-3 rounded-xl bg-primary text-white text-xs font-semibold" data-testid="live-schedule-btn">Programar</button></div>
        </details>
      </div>
      <div className="p-3 pt-2 border-t border-border/40 space-y-1.5">
        {missing.length > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400" data-testid="live-missing">Falta: {missing.join(" · ")}</p>}
        <button onClick={onStart} disabled={starting || missing.length > 0} className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="live-go-btn">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} {form.is_private ? "Iniciar live privado" : "Iniciar en vivo"}
        </button>
      </div>
    </div>
  );
}
