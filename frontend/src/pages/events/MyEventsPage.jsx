import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { api, errText, fmtBytes, fmtDate } from "@/pages/events/eventsApi";

/** Mis tarjetas de evento: lista + alta rápida (el detalle se completa en la gestión). */
export default function MyEventsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [settings, setSettings] = useState(null);
  const [title, setTitle] = useState("");
  const [market, setMarket] = useState("US");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (token) { api.mine(token).then(setRows).catch(() => setRows([])); api.settings().then(setSettings).catch(() => {}); } }, [token]);
  const create = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try { const ev = await api.create(token, { title: title.trim(), market }); navigate(`/events/${ev.id}/manage`); }
    catch (e) { brunoToast.error(errText(e, "No se pudo crear el evento")); setBusy(false); }
  };
  return (
    <div className="min-h-screen bg-background px-4" style={{ paddingTop: "calc(var(--safe-top, 0px) + 12px)", paddingBottom: "calc(var(--content-bottom, 96px) + 24px)" }} data-testid="my-events-page">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver" data-testid="events-back-btn"><ArrowLeft className="w-5 h-5" /></Button>
          <h1 className="text-xl font-black">Mis tarjetas de evento</h1>
        </div>
        <section className="rounded-2xl border border-primary/30 bg-card p-4 space-y-3" data-testid="create-event">
          <p className="text-sm"><span className="font-semibold">Crea una tarjeta de evento</span> con álbum colaborativo e invitaciones. Activación única{settings ? ` (${settings.activation.labels[market]})` : ""}, sin suscripción. Verla y conectar es gratis para todos.</p>
          {settings && <p className="text-[11px] text-muted-foreground">Incluye {fmtBytes(settings.storage.included_bytes)} · {settings.storage.max_photos} fotos · {Math.round(settings.storage.retention_days / 30)} meses de conservación.</p>}
          <div className="flex gap-2">
            <Input placeholder="Nombre del evento" value={title} onChange={(e) => setTitle(e.target.value)} data-testid="new-event-title" />
            <select className="h-9 rounded-xl border border-border bg-background px-2 text-sm" value={market} onChange={(e) => setMarket(e.target.value)} data-testid="new-event-market"><option value="US">EE. UU. (USD)</option><option value="CO">Colombia (COP)</option></select>
          </div>
          <Button onClick={create} disabled={busy || !title.trim()} className="rounded-full" data-testid="new-event-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarPlus className="w-4 h-4 mr-1.5" />} Crear evento</Button>
        </section>
        {rows === null ? <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" /> : rows.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6" data-testid="events-empty">Aún no tienes eventos.</p> : (
          <ul className="space-y-2" data-testid="events-list">
            {rows.map((e) => (
              <li key={e.id}>
                <Link to={`/events/${e.id}/manage`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:border-primary/50" data-testid={`event-row-${e.id}`}>
                  <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0">{e.cover_url && <img src={e.cover_url} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0"><p className="font-semibold truncate">{e.title}</p><p className="text-[11px] text-muted-foreground">{e.date ? fmtDate(e.date) : "Sin fecha"} · {e.storage.photo_count} fotos</p></div>
                  <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${e.status === "active" ? "bg-emerald-100 text-emerald-800" : ["paid", "granted"].includes(e.activation.status) ? "bg-blue-100 text-blue-800" : "bg-muted"}`}>{e.status === "active" ? "Publicado" : ["paid", "granted"].includes(e.activation.status) ? "Activo · sin publicar" : "Pendiente de activar"}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
