import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Building2, CalendarDays, Sparkles, UserRound, Users } from "lucide-react";
import { api, peekTrail, popTrail, pushTrail } from "@/pages/events/eventsApi";

const ICON = { organizer: UserRound, company: Building2, service: Sparkles, guest: Users, event: CalendarDays, attends: CalendarDays, sibling: Sparkles };

/** Conexiones relevantes de una tarjeta/evento (Empresa → Evento → Invitación → Organizador → Tarjeta personal → Servicios) + volver a la anterior. */
export const CardConnections = ({ cardId, items: given, title = "Conexiones", current }) => {
  const [items, setItems] = useState(given || []);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => { if (given) setItems(given); else if (cardId) api.connections(cardId).then((r) => setItems(r.items || [])).catch(() => setItems([])); }, [cardId, given]);
  useEffect(() => { if (current) pushTrail({ path: location.pathname, title: current }); }, [location.pathname, current]);
  const prev = peekTrail(location.pathname);
  if (!items.length && !prev) return null;
  const go = (it) => navigate(it.type === "event" ? `/e/${it.id}` : `/c/${it.id}`);
  return (
    <section className="mt-5 space-y-2" data-testid="card-connections">
      {prev && (
        <button type="button" onClick={() => { const p = popTrail(location.pathname); navigate(p?.path || -1); }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="connections-back-btn">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a {prev.title || "la tarjeta anterior"}
        </button>
      )}
      {items.length > 0 && (
        <>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h3>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
            {items.map((it, i) => { const Icon = ICON[it.role] || Sparkles; return (
              <button key={`${it.id}-${i}`} type="button" onClick={() => go(it)} className="snap-start shrink-0 w-40 text-left rounded-2xl border border-border bg-card p-3 hover:border-primary/50 hover:-translate-y-0.5 transition-[transform,border-color]" data-testid={`connection-${it.role}-${it.id}`}>
                <div className="flex items-center gap-2 mb-2">
                  {it.avatar_url ? <img src={it.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full flex items-center justify-center text-white" style={{ background: it.background_color || "#F26A1B" }}><Icon className="w-4 h-4" /></span>}
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">{it.label}</span>
                </div>
                <p className="text-sm font-semibold leading-tight line-clamp-2">{it.title}</p>
                {it.subtitle && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{it.subtitle}</p>}
              </button>
            ); })}
          </div>
        </>
      )}
    </section>
  );
};
