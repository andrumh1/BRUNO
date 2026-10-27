import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, RefreshCw, UploadCloud, X } from "lucide-react";
import { useUploads, dismissUpload, retryUpload } from "@/lib/uploadQueue";

const LABEL = { uploading: "Subiendo video", processing: "Procesando", publishing: "Publicando", done: "Reel publicado", error: "No se pudo publicar" };

function Ring({ pct, status }) {
  const r = 14, c = 2 * Math.PI * r, p = status === "done" ? 100 : Math.max(2, Math.min(100, pct || 0));
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90 shrink-0" aria-hidden="true">
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke={status === "error" ? "#f87171" : "#fa632e"} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * p) / 100} style={{ transition: "stroke-dashoffset .4s ease" }} className={status === "processing" || status === "publishing" ? "animate-pulse" : ""} />
    </svg>
  );
}

/** Chip flotante con el progreso de los videos que se publican en segundo plano. */
export default function UploadChip() {
  const jobs = useUploads();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [expanded, setExpanded] = useState(false);
  useEffect(() => { const h = (e) => navigate(e.detail); window.addEventListener("bruno:navigate", h); return () => window.removeEventListener("bruno:navigate", h); }, [navigate]);
  const visible = jobs.filter((j) => !(j.status === "done" && Date.now() - (j.finishedAt || 0) > 12_000));
  if (!visible.length || pathname.startsWith("/live/") || pathname.startsWith("/login")) return null;
  const main = visible.find((j) => j.status === "error") || visible.find((j) => j.status !== "done") || visible[0];
  const active = visible.filter((j) => !["done", "error"].includes(j.status)).length;
  const open = (j) => { if (j.status === "done") { navigate(`/reels?id=${j.postId || ""}`); dismissUpload(j.id); } else setExpanded((v) => !v); };
  return (
    <div className="fixed left-3 right-3 sm:left-auto sm:right-5 sm:w-80 z-[70] pointer-events-none" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }} data-testid="upload-chip-root">
      <AnimatePresence>
        {expanded && visible.length > 1 && (
          <motion.ul initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="pointer-events-auto mb-2 rounded-2xl bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-white text-xs divide-y divide-white/10 overflow-hidden" data-testid="upload-chip-list">
            {visible.map((j) => <li key={j.id} className="flex items-center gap-2 px-3 py-2"><Ring pct={j.pct} status={j.status} /><span className="flex-1 truncate">{LABEL[j.status]}{j.status === "uploading" ? ` · ${j.pct}%` : ""} · {j.title}</span>{j.status === "error" && <button type="button" onClick={() => retryUpload(j.id)} className="p-1 rounded-full hover:bg-white/10" aria-label="Reintentar"><RefreshCw className="w-3.5 h-3.5" /></button>}<button type="button" onClick={() => dismissUpload(j.id)} className="p-1 rounded-full hover:bg-white/10" aria-label="Quitar"><X className="w-3.5 h-3.5" /></button></li>)}
          </motion.ul>
        )}
      </AnimatePresence>
      <motion.div key={main.id + main.status} initial={{ opacity: 0, y: 16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="pointer-events-auto flex items-center gap-3 rounded-full bg-zinc-900/90 backdrop-blur-xl border border-white/10 text-white pl-2 pr-2 py-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.35)]" data-testid="upload-chip" data-status={main.status}>
        <button type="button" onClick={() => open(main)} className="flex items-center gap-3 flex-1 min-w-0 text-left" data-testid="upload-chip-main">
          <span className="relative grid place-items-center">{main.poster ? <img src={main.poster} alt="" className="w-9 h-9 rounded-full object-cover absolute inset-0 opacity-60" /> : null}<Ring pct={main.pct} status={main.status} /><span className="absolute inset-0 grid place-items-center">{main.status === "done" ? <Check className="w-4 h-4" /> : main.status === "error" ? <AlertTriangle className="w-4 h-4 text-red-300" /> : <UploadCloud className="w-3.5 h-3.5 opacity-80" />}</span></span>
          <span className="min-w-0">
            <span className="block text-xs font-semibold truncate" data-testid="upload-chip-label">{LABEL[main.status]}{main.status === "uploading" ? ` · ${main.pct}%` : ""}{active > 1 ? ` · ${active} videos` : ""}</span>
            <span className="block text-[11px] text-white/70 truncate">{main.status === "done" ? "Toca para verlo" : main.status === "error" ? main.error : "Puedes seguir usando BRUNO"}</span>
          </span>
        </button>
        {main.status === "error" && <button type="button" onClick={() => retryUpload(main.id)} className="h-8 px-3 rounded-full bg-[#fa632e] text-xs font-semibold" data-testid="upload-chip-retry">Reintentar</button>}
        {["done", "error"].includes(main.status) && <button type="button" onClick={() => dismissUpload(main.id)} className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10" aria-label="Cerrar" data-testid="upload-chip-dismiss"><X className="w-4 h-4" /></button>}
      </motion.div>
    </div>
  );
}
