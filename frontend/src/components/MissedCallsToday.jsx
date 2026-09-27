import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PhoneMissed, Phone, Video, User } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Alerts page: missed/declined incoming calls of the last 24h with one-tap redial.
export default function MissedCallsToday({ token }) {
  const navigate = useNavigate();
  const [calls, setCalls] = useState([]);
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/calls/missed/today`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCalls(r.data?.calls || [])).catch(() => setCalls([]));
  }, [token]);
  if (!calls.length) return null;
  const fmt = (iso) => new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="max-w-2xl mx-auto px-4 pt-4" data-testid="missed-calls-today">
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <PhoneMissed className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold">Llamadas perdidas hoy</h2>
          <span className="ml-auto text-xs text-muted-foreground" data-testid="missed-calls-count">{calls.length}</span>
        </div>
        <div className="space-y-1.5">
          {calls.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl bg-background/70 p-2" data-testid={`missed-call-${c.id}`}>
              <div className="w-10 h-10 rounded-full bg-muted overflow-hidden grid place-items-center shrink-0">
                {c.caller.avatar_url ? <img src={c.caller.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.caller.name}</p>
                <p className="text-[11px] text-muted-foreground">{c.call_type === "video" ? "Videollamada" : "Llamada"} {c.status === "declined" ? "rechazada" : "perdida"} · {fmt(c.created_at)}</p>
              </div>
              <button onClick={() => navigate(`/chat/${c.chat_id}?call=${c.call_type}`)} className="h-9 px-3 rounded-full bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform" data-testid={`missed-call-redial-${c.id}`}>
                {c.call_type === "video" ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />} Devolver
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
