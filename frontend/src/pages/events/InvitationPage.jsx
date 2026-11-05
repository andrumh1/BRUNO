import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, CalendarDays, Check, Loader2, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { CardConnections } from "@/components/bruno/CardConnections";
import { JoinBrunoNudge } from "@/components/bruno/JoinBrunoNudge";
import { api, errText, fmtDate } from "@/pages/events/eventsApi";

const RSVP = [["yes", "Asistiré"], ["maybe", "Quizás"], ["no", "No podré"]];

/** Invitación pública: se ve sin cuenta; confirmar asistencia y vincular la tarjeta personal requieren sesión. */
export default function InvitationPage() {
  const { id, iid } = useParams();
  const { token, user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [cards, setCards] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.publicInvitation(iid, token).then(setData).catch((e) => setError(errText(e, "Invitación no disponible")));
  useEffect(() => { if (!isLoading) load(); }, [iid, token, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (token) axios.get(`${process.env.REACT_APP_BACKEND_URL}/api/cards`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setCards(r.data || [])).catch(() => {}); }, [token]);
  const respond = async (body) => { setBusy(true); try { await api.respond(token, iid, body); await load(); brunoToast.success("Respuesta guardada"); } catch (e) { brunoToast.error(errText(e, "No se pudo guardar")); } finally { setBusy(false); } };
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center" data-testid="invitation-error"><p className="text-sm text-muted-foreground">{error}</p><Button asChild variant="outline" className="rounded-full"><Link to="/">Ir a BRUNO</Link></Button></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const { invitation: inv, event, viewer } = data;
  return (
    <div className="min-h-screen bg-background px-4 pt-4" style={{ paddingTop: "calc(var(--safe-top, 0px) + 12px)", paddingBottom: "calc(var(--content-bottom, 96px) + 24px)" }} data-testid="invitation-page">
      <div className="max-w-md mx-auto">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-3" data-testid="invitation-back-btn"><ArrowLeft className="w-4 h-4" /> Volver</button>
        <article className="rounded-3xl overflow-hidden border border-border shadow-sm bg-card" data-testid="invitation-card">
          <div className="relative h-44 bg-foreground">
            {event.cover_url ? <img src={event.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#F26A1B,#1c1c1a)" }} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-orange-300 flex items-center gap-1"><Ticket className="w-3 h-3" /> Invitación</p>
              <h1 className="text-2xl font-black leading-tight">{event.title}</h1>
            </div>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-lg font-semibold" data-testid="invitation-guest">Para {inv.guest_name}{inv.seats > 1 ? ` · ${inv.seats} lugares` : ""}</p>
            {inv.message && <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="invitation-message">{inv.message}</p>}
            <div className="text-sm space-y-1">
              {event.date && <p className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-primary" />{fmtDate(event.date)}</p>}
              {event.location && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" />{event.location}</p>}
            </div>
            <Button asChild variant="outline" className="w-full rounded-full" data-testid="invitation-open-event"><Link to={`/e/${event.id}`}>Ver el evento y su álbum</Link></Button>
            {viewer.logged_in && viewer.can_respond && (
              <div className="pt-2 border-t border-border space-y-3" data-testid="invitation-respond">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">¿Asistirás?</p>
                <div className="grid grid-cols-3 gap-2">
                  {RSVP.map(([v, l]) => <Button key={v} variant={inv.rsvp === v ? "default" : "outline"} size="sm" className="rounded-full" disabled={busy} onClick={() => respond({ rsvp: v })} data-testid={`rsvp-${v}`}>{inv.rsvp === v && <Check className="w-3.5 h-3.5 mr-1" />}{l}</Button>)}
                </div>
                <div>
                  <label className="text-xs font-semibold" htmlFor="link-card">Vincular mi tarjeta personal</label>
                  <select id="link-card" className="mt-1 w-full h-9 rounded-xl border border-border bg-background px-2 text-sm" value={inv.linked_card_id || ""} disabled={busy} onChange={(e) => respond({ card_id: e.target.value })} data-testid="invitation-link-card">
                    <option value="">Sin tarjeta</option>
                    {cards.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  {cards.length === 0 && <p className="text-[11px] text-muted-foreground mt-1">Aún no tienes tarjeta. <Link to="/cards/new" className="text-primary underline">Crea una gratis</Link>.</p>}
                </div>
                {inv.linked_card_id && (
                  <label className="flex items-center justify-between gap-3 text-xs"><span>Mostrar mi tarjeta en las conexiones del evento</span><Switch checked={!!inv.show_card} disabled={busy} onCheckedChange={(v) => respond({ show_card: v })} data-testid="invitation-show-card" /></label>
                )}
              </div>
            )}
            {viewer.logged_in && !viewer.can_respond && <p className="text-xs text-muted-foreground" data-testid="invitation-taken">Esta invitación ya fue vinculada por otra cuenta.</p>}
            {!viewer.logged_in && <JoinBrunoNudge reason="Inicia sesión para confirmar tu asistencia" benefits={data.join_benefits} />}
          </div>
        </article>
        <CardConnections items={data.connections} title="Conexiones" current={`invitación a ${event.title}`} />
      </div>
    </div>
  );
}
