import React, { useEffect, useState } from "react";
import { Radio, Eye, Lock, ShieldCheck } from "lucide-react";

/** Waiting room shown to viewers until the host's video arrives: cover, countdown ring, tips. */
export default function LiveWaitingRoom({ live, viewerCount, hostOnline }) {
  const [count, setCount] = useState(10);
  useEffect(() => {
    setCount(10);
    const t = setInterval(() => setCount((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [hostOnline]);
  const pct = ((10 - count) / 10) * 100;
  return (
    <div className="absolute inset-0 overflow-hidden" data-testid="live-waiting-room">
      <div className="absolute inset-0 bg-center bg-cover scale-110" style={{ backgroundImage: live?.host_avatar ? `url(${live.host_avatar})` : undefined, filter: "blur(30px) brightness(.45)" }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
      <div className="relative h-full flex flex-col items-center justify-center text-white px-8 text-center">
        <div className="relative w-36 h-36 mb-5">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4" />
            <circle cx="50" cy="50" r="46" fill="none" stroke="#ff6a00" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${pct * 2.89} 289`} className="transition-[stroke-dasharray] duration-1000" />
          </svg>
          <div className="absolute inset-3 rounded-full overflow-hidden bg-white/10 grid place-items-center ring-2 ring-white/30">
            {live?.host_avatar ? <img src={live.host_avatar} alt="" className="w-full h-full object-cover" /> : <Radio className="w-10 h-10" />}
          </div>
          {count > 0 && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-primary text-[11px] font-bold tabular-nums" data-testid="live-waiting-countdown">{count}</span>}
        </div>
        <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-1">{live?.is_private ? "Live privado" : "En vivo"}</p>
        <h2 className="text-lg font-bold leading-tight">{live?.title || "El live empieza pronto"}</h2>
        <p className="text-sm text-white/70 mt-1">con @{live?.host_name || "anfitrión"}</p>
        <p className="mt-5 text-sm text-white/85" data-testid="live-waiting-status">
          {count > 0 ? "Conectando con la transmisión…" : hostOnline ? "El anfitrión está preparando la cámara…" : "Esperando a que el anfitrión inicie…"}
        </p>
        <div className="mt-6 flex items-center gap-3 text-[11px] text-white/70">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10"><Eye className="w-3 h-3" /> {viewerCount} esperando</span>
          {live?.is_private && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10"><Lock className="w-3 h-3" /> Solo invitados</span>}
          {live?.anti_capture && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10"><ShieldCheck className="w-3 h-3 text-emerald-400" /> Protegido</span>}
        </div>
        <p className="mt-8 text-[11px] text-white/50 max-w-[260px]">Puedes saludar en el chat mientras esperas. El video aparecerá automáticamente.</p>
      </div>
    </div>
  );
}
