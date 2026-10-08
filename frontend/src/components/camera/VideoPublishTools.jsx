import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { Scissors, Image as ImageIcon, FileVideo, Trash2, RotateCw } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Recorte (inicio/fin) + portada: lo que se ve aquí es lo que publica Cloudinary (so_/eo_). */
export function VideoTrimCover({ src, trim, onTrim, coverAt, onCover }) {
  const vRef = useRef(null);
  const [dur, setDur] = useState(0);
  useEffect(() => { onTrim({ start: 0, end: 0 }); onCover(null); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  const seek = (t) => { const v = vRef.current; if (v && Number.isFinite(t)) { v.currentTime = Math.min(Math.max(0, t), Math.max(0, dur - 0.05)); } };
  const end = trim.end || dur;
  return (
    <div className="rounded-2xl bg-black/50 backdrop-blur-md text-white p-3 space-y-3" data-testid="video-trim-cover">
      <div className="flex gap-3">
        <video ref={vRef} src={src} muted playsInline preload="metadata" onLoadedMetadata={(e) => setDur(e.target.duration || 0)} className="w-16 h-24 rounded-lg object-cover bg-black shrink-0" data-testid="video-trim-preview" />
        <div className="flex-1 space-y-2 min-w-0">
          <p className="text-[11px] font-semibold inline-flex items-center gap-1"><Scissors className="w-3 h-3" /> Recortar · {fmt(trim.start)} → {fmt(end)} ({fmt(Math.max(0, end - trim.start))})</p>
          <label className="block text-[10px] text-white/70">Inicio<input type="range" min={0} max={Math.max(0, dur - 1)} step={0.1} value={trim.start} onChange={(e) => { const s = Math.min(+e.target.value, end - 1); onTrim({ ...trim, start: s }); seek(s); }} className="w-full accent-orange-500" data-testid="video-trim-start" /></label>
          <label className="block text-[10px] text-white/70">Fin<input type="range" min={1} max={dur || 1} step={0.1} value={end} onChange={(e) => { const en = Math.max(+e.target.value, trim.start + 1); onTrim({ ...trim, end: en >= dur - 0.05 ? 0 : en }); seek(en); }} className="w-full accent-orange-500" data-testid="video-trim-end" /></label>
          <p className="text-[11px] font-semibold inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> Portada · {coverAt == null ? "automática" : fmt(coverAt)}</p>
          <input type="range" min={0} max={dur || 1} step={0.1} value={coverAt ?? trim.start} onChange={(e) => { onCover(+e.target.value); seek(+e.target.value); }} className="w-full accent-orange-500" data-testid="video-cover-at" />
        </div>
      </div>
    </div>
  );
}

/** Barra de progreso de subida/procesamiento con reintento. */
export function UploadProgress({ pct, phase, error, onRetry }) {
  if (!phase && !error) return null;
  return (
    <div className="rounded-2xl bg-black/60 text-white p-3 text-xs" data-testid="upload-progress" data-phase={error ? "error" : phase}>
      {error ? (
        <div className="flex items-center gap-2"><span className="flex-1">{error}</span><button onClick={onRetry} className="h-8 px-3 rounded-full bg-primary text-white font-semibold inline-flex items-center gap-1" data-testid="upload-retry-btn"><RotateCw className="w-3.5 h-3.5" /> Reintentar</button></div>
      ) : (
        <>
          <div className="flex justify-between mb-1"><span>{phase === "upload" ? `Subiendo… ${pct}%` : phase === "process" ? "Procesando video…" : "Publicando…"}</span><span>{phase === "upload" ? `${pct}%` : ""}</span></div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden"><div className={`h-full bg-primary transition-[width] ${phase !== "upload" ? "animate-pulse w-full" : ""}`} style={phase === "upload" ? { width: `${pct}%` } : undefined} /></div>
        </>
      )}
    </div>
  );
}

/** Lista de borradores guardados (media ya subido). */
export function DraftsSheet({ token, onResume, onClose }) {
  const [items, setItems] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };
  useEffect(() => { axios.get(`${API}/post-drafts`, { headers }).then((r) => setItems(r.data)).catch(() => setItems([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const del = async (id) => { await axios.delete(`${API}/post-drafts/${id}`, { headers }).catch(() => {}); setItems((p) => p.filter((d) => d.id !== id)); };
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 flex items-end" onClick={onClose} data-testid="drafts-sheet">
      <div className="w-full max-h-[70vh] overflow-y-auto rounded-t-3xl bg-background p-4 pb-10" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-bold mb-3 inline-flex items-center gap-2"><FileVideo className="w-4 h-4 text-primary" /> Borradores</h3>
        {items === null && <p className="text-xs text-muted-foreground">Cargando…</p>}
        {items?.length === 0 && <p className="text-xs text-muted-foreground">No tienes borradores. Guarda uno desde el editor con «Guardar borrador».</p>}
        <div className="space-y-2">
          {items?.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-border p-2" data-testid={`draft-${d.id}`}>
              <div className="w-14 h-20 rounded-xl bg-black overflow-hidden shrink-0">{d.poster_url ? <img src={d.poster_url} alt="" className="w-full h-full object-cover" /> : <video src={d.media_url} muted className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0"><p className="text-sm truncate">{d.caption || "Sin descripción"}</p><p className="text-[11px] text-muted-foreground">{new Date(d.updated_at).toLocaleString()}</p></div>
              <button onClick={() => onResume(d)} className="h-9 px-3 rounded-full bg-primary text-white text-xs font-semibold" data-testid={`draft-resume-${d.id}`}>Retomar</button>
              <button onClick={() => del(d.id)} className="w-9 h-9 rounded-full grid place-items-center text-destructive" data-testid={`draft-delete-${d.id}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
