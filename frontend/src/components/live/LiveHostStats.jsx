import React, { useEffect, useState } from "react";
import axios from "axios";
import { ChevronDown, ChevronUp, Coins } from "lucide-react";
import { fmtMoney } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Panel económico del anfitrión (solo host; datos del servidor, nunca enviados a espectadores). Contraíble. */
export default function LiveHostStats({ liveId, token, elapsed, connection }) {
  const [s, setS] = useState(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!liveId || !token) return;
    const load = () => axios.get(`${API}/lives/${liveId}/host-stats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setS(r.data)).catch(() => {});
    load(); const id = setInterval(load, 15000); return () => clearInterval(id);
  }, [liveId, token]);
  if (!s) return null;
  const m = (v) => fmtMoney((v || 0) / 100, s.currency);
  const Row = ({ k, v, bold }) => <div className={`flex justify-between ${bold ? "font-bold" : ""}`}><span className="text-muted-foreground">{k}</span><span>{v}</span></div>;
  return (
    <div className="absolute left-3 z-30 bruno-glass rounded-2xl border text-[11px] overflow-hidden" style={{ top: "calc(var(--safe-top) + 100px)", maxWidth: 230 }} data-testid="live-host-stats">
      <button onClick={() => setOpen((o) => !o)} className="w-full h-8 px-3 flex items-center gap-1.5 font-semibold" data-testid="live-host-stats-toggle" aria-expanded={open}>
        <Coins className="w-3.5 h-3.5 text-primary" /> {m(s.estimated_pending_minor)} · {s.unique_viewers} únicos
        <span className="ml-auto">{open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}</span>
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-0.5" data-testid="live-host-stats-body">
          <Row k="Tiempo" v={elapsed} /><Row k="Conexión" v={connection} />
          <Row k="Ahora · únicos · pico" v={`${s.viewers_now} · ${s.unique_viewers} · ${s.peak_viewers}`} />
          <Row k="Likes · comentarios" v={`${s.hearts} · ${s.comments}`} />
          <Row k={`Regalos (${s.gifts.count})`} v={m(s.gifts.gross)} />
          <Row k={`Entradas (${s.tickets.count})`} v={m(s.tickets.gross)} />
          <Row k="Comisión BRUNO" v={`−${m(s.bruno_fee_minor)}`} />
          <Row k="Ganancia estimada pendiente" v={m(s.estimated_pending_minor)} bold />
          <p className="text-[10px] text-muted-foreground pt-1">{s.note}</p>
        </div>
      )}
    </div>
  );
}
