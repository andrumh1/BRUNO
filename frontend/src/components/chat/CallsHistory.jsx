import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, Trash2, Users, Video } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const fmtWhen = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === now.toDateString()) return `Hoy · ${time}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Ayer · ${time}`;
  return `${d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })} · ${time}`;
};

const Avatar = ({ peer, isGroup }) =>
  peer?.avatar_url ? (
    <img src={peer.avatar_url} alt={peer.name} className="w-12 h-12 rounded-full object-cover shrink-0" />
  ) : (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold shrink-0">
      {isGroup ? <Users className="w-5 h-5" /> : (peer?.name || "?")[0].toUpperCase()}
    </div>
  );

/** CallsHistory — every call (incoming / outgoing / missed) with duration, filters and redial */
const CallsHistory = ({ token }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/calls/history`, { params: { filter, q }, headers: { Authorization: `Bearer ${token}` } });
      setCalls(r.data.calls || []);
    } catch (_) { /* ignore */ } finally { setLoading(false); }
  }, [filter, q, token]);

  useEffect(() => { const t = setTimeout(load, q ? 250 : 0); return () => clearTimeout(t); }, [load, q]);

  const redial = (c, type) => navigate(`/chat/${c.chat_id}?call=${type}`);
  const remove = async (c) => {
    try { await axios.delete(`${API}/calls/history`, { params: { call_id: c.id }, headers: { Authorization: `Bearer ${token}` } }); setCalls((p) => p.filter((x) => x.id !== c.id)); } catch (_) { /* ignore */ }
  };
  const clearAll = async () => {
    try { await axios.delete(`${API}/calls/history`, { headers: { Authorization: `Bearer ${token}` } }); setCalls([]); brunoToast.success("Historial borrado"); } catch (_) { /* ignore */ }
  };

  const StatusIcon = (c) => {
    if (c.missed) return <PhoneMissed className="w-3.5 h-3.5 text-red-500" />;
    if (c.direction === "outgoing") return <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-500" />;
    return <PhoneIncoming className="w-3.5 h-3.5 text-sky-500" />;
  };
  const statusLabel = (c) => {
    if (c.dnd) return "Perdida (No molestar)";
    if (c.missed) return c.status === "declined" ? "Rechazada" : "Perdida";
    if (c.status === "declined") return "No contestaron";
    if (c.status === "missed") return "Sin respuesta";
    return `${c.direction === "outgoing" ? "Saliente" : "Entrante"}${c.duration ? ` · ${c.duration}` : ""}`;
  };

  return (
    <div className="flex-1 flex flex-col min-h-0" data-testid="calls-history">
      <div className="px-4 pb-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por contacto..." className="pl-10 rounded-xl bg-muted/50 border-0 h-10" data-testid="calls-search-input" />
        </div>
        <div className="flex items-center gap-2">
          {[{ id: "all", label: "Todas" }, { id: "missed", label: "Perdidas" }].map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${filter === f.id ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/70"}`} data-testid={`calls-filter-${f.id}`}>{f.label}</button>
          ))}
          <div className="flex-1" />
          {calls.length > 0 && (
            <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1" data-testid="calls-clear-btn"><Trash2 className="w-3.5 h-3.5" /> Borrar</button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-24">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : calls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3"><Phone className="w-7 h-7 text-primary" /></div>
            <p className="text-sm text-muted-foreground">{filter === "missed" ? "No tienes llamadas perdidas" : "Aún no hay llamadas"}</p>
          </div>
        ) : calls.map((c, i) => (
          <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
            className="flex items-center gap-3 p-3 my-0.5 rounded-xl hover:bg-muted/60 group" data-testid={`call-item-${c.id}`}>
            <Avatar peer={c.peer} isGroup={c.is_group} />
            <div className="flex-1 min-w-0" onClick={() => navigate(`/chat/${c.chat_id}`)} role="button">
              <p className={`font-semibold text-sm truncate ${c.missed ? "text-red-500" : ""}`} data-testid="call-peer-name">{c.peer?.name}{c.is_group && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">grupo · {c.peer?.members}</span>}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                {StatusIcon(c)}
                <span data-testid="call-status-label">{statusLabel(c)}</span>
                <span>· {fmtWhen(c.started_at)}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex" onClick={() => remove(c)} aria-label="Eliminar" data-testid={`call-delete-${c.id}`}><Trash2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" className={`rounded-full h-9 w-9 ${c.call_type === "video" ? "text-blue-500 hover:bg-blue-500/10" : "text-green-500 hover:bg-green-500/10"}`} onClick={() => redial(c, c.call_type)} aria-label="Volver a llamar" data-testid={`call-redial-${c.id}`}>
              {c.call_type === "video" ? <Video className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
            </Button>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CallsHistory;
