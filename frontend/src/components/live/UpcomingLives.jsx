import React, { useEffect, useState } from "react";
import axios from "axios";
import { CalendarClock, Bell, BellRing } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** Próximos lives programados con botón «Avisarme» (recordatorio 10 min antes + aviso al empezar). */
export default function UpcomingLives({ token }) {
  const [items, setItems] = useState([]);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  useEffect(() => { axios.get(`${API}/lives/upcoming`, { headers }).then((r) => setItems(r.data || [])).catch(() => {}); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null;
  const toggle = async (l) => {
    if (!token) return brunoToast.error("Inicia sesión para recibir avisos");
    try { const r = await axios.post(`${API}/lives/${l.id}/remind`, {}, { headers }); setItems((p) => p.map((x) => (x.id === l.id ? { ...x, reminded: r.data.reminded, reminder_count: (x.reminder_count || 0) + (r.data.reminded ? 1 : -1) } : x))); brunoToast.success(r.data.reminded ? "Te avisaremos 10 minutos antes y al empezar" : "Aviso cancelado"); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar"); }
  };
  return (
    <section className="mb-5" data-testid="upcoming-lives">
      <h2 className="text-base md:text-lg font-bold inline-flex items-center gap-2 mb-2"><CalendarClock className="w-4 h-4 text-primary" /> Próximos lives</h2>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
        {items.map((l) => (
          <div key={l.id} className="shrink-0 w-64 rounded-2xl border border-border bg-card p-3" data-testid={`upcoming-live-${l.id}`}>
            <div className="flex items-center gap-2 mb-2"><div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0">{l.host_avatar && <img src={l.host_avatar} alt="" className="w-full h-full object-cover" />}</div><div className="min-w-0 leading-tight"><p className="text-sm font-semibold truncate">{l.title}</p><p className="text-[11px] text-muted-foreground truncate">{l.host_name}</p></div></div>
            <p className="text-xs text-muted-foreground">{new Date(l.scheduled_at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-muted-foreground">{l.reminder_count || 0} esperando</span>
              {!l.is_host && <button onClick={() => toggle(l)} className={`h-8 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${l.reminded ? "bg-primary/15 text-primary" : "bg-primary text-white"}`} data-testid={`upcoming-remind-${l.id}`} aria-pressed={!!l.reminded}>{l.reminded ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}{l.reminded ? "Avisar activado" : "Avisarme"}</button>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
