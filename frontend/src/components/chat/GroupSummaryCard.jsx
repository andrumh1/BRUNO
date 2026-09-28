import React, { useEffect, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Sparkles, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const MIN_UNREAD = 5;

/** GroupSummaryCard — "Lo que te perdiste": AI summary shown when opening a chat with many unread messages */
const GroupSummaryCard = ({ chatId, unreadCount, token }) => {
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const key = `bruno_summary_seen_${chatId}`;

  useEffect(() => {
    if (!chatId || !unreadCount || unreadCount < MIN_UNREAD) return undefined;
    try { if (sessionStorage.getItem(key) === String(unreadCount)) return undefined; } catch { /* ignore */ }
    let alive = true;
    setState("loading");
    axios.post(`${API}/chats/${chatId}/summary`, null, { params: { count: unreadCount }, headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (!alive) return; if (r.data?.summary) { setData(r.data); setState("shown"); } else setState("idle"); })
      .catch(() => alive && setState("idle"));
    return () => { alive = false; };
  }, [chatId]); // eslint-disable-line

  const dismiss = () => { try { sessionStorage.setItem(key, String(unreadCount)); } catch { /* ignore */ } setState("idle"); };
  if (state === "idle") return null;
  const bullets = (data?.summary || "").split("\n").map((l) => l.replace(/^[•\-*]\s*/, "").trim()).filter(Boolean);

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mx-3 mt-3 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/10 to-orange-400/5 p-3.5 shadow-sm" data-testid="group-summary-card">
        <div className="flex items-start gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Lo que te perdiste</p>
            <p className="text-[11px] text-muted-foreground">{state === "loading" ? "Resumiendo mensajes nuevos…" : `${data?.count} mensajes nuevos · resumen con IA`}</p>
          </div>
          {state === "shown" && <button onClick={dismiss} className="p-1 rounded-full hover:bg-muted text-muted-foreground" aria-label="Cerrar resumen" data-testid="group-summary-close"><X className="w-4 h-4" /></button>}
        </div>
        {state === "loading" ? (
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Un momento…</div>
        ) : (
          <ul className="mt-2.5 space-y-1.5" data-testid="group-summary-bullets">
            {bullets.map((b, i) => (
              <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className="text-xs leading-snug flex gap-2"><span className="text-primary">•</span><span>{b.split(/(\*\*[^*]+\*\*)/g).map((seg, j) => (seg.startsWith("**") ? <b key={j}>{seg.slice(2, -2)}</b> : seg))}</span></motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default GroupSummaryCard;
