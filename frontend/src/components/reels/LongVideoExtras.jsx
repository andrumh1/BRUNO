import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BookOpen, Loader2, Save, Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/reels/ReelSheets";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const LINE_RX = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:·]?\s*(.+?)\s*$/;

export const LONG_MIN = 180;
export const isLongVideo = (reel) => (reel?.duration || 0) >= LONG_MIN;
export const fmtClock = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60; return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`; };

/** Capítulos escritos en la descripción con formato "00:00 Intro" / "1:02:30 Cierre". */
export function parseChapters(text) {
  const out = [];
  for (const line of String(text || "").split(/\n/)) {
    const m = line.match(LINE_RX);
    if (!m) continue;
    const t = (parseInt(m[1] || "0", 10) * 3600) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
    out.push({ time: t, title: m[4].slice(0, 80) });
  }
  return out.sort((a, b) => a.time - b.time);
}

/** Capítulos efectivos: los editados por el creador > los de la descripción > tramos automáticos de 5 min. */
export function getChapters(reel) {
  if (reel?.chapters?.length) return reel.chapters;
  const parsed = parseChapters(reel?.content);
  if (parsed.length) return parsed;
  const dur = reel?.duration || 0;
  if (dur < LONG_MIN) return [];
  const step = dur > 1800 ? 600 : 300;
  const auto = [];
  for (let t = 0, i = 1; t < dur - 30; t += step, i += 1) auto.push({ time: t, title: `Parte ${i}`, auto: true });
  return auto;
}
export const chaptersToText = (chs) => chs.map((c) => `${fmtClock(c.time)} ${c.title}`).join("\n");
export const currentChapterIndex = (chs, t) => { let idx = -1; chs.forEach((c, i) => { if (t >= c.time) idx = i; }); return idx; };

/** Fila de capítulos sobre la barra de progreso. */
export function ChaptersStrip({ chapters, currentTime, onSeek, onOpen, bottom }) {
  const ref = useRef(null);
  const idx = currentChapterIndex(chapters, currentTime);
  useEffect(() => { const el = ref.current?.children?.[idx]; el?.scrollIntoView?.({ inline: "center", block: "nearest", behavior: "smooth" }); }, [idx]);
  if (!chapters.length) return null;
  return (
    <div className="absolute inset-x-0 z-20 flex items-center gap-1.5 px-3 reel-chrome" style={{ bottom }} data-testid="long-chapters-strip">
      <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="shrink-0 w-7 h-7 rounded-full bg-black/45 text-white grid place-items-center" aria-label="Capítulos" data-testid="long-chapters-open"><BookOpen className="w-3.5 h-3.5" /></button>
      <div ref={ref} className="flex gap-1.5 overflow-x-auto scrollbar-hide" onClick={(e) => e.stopPropagation()}>
        {chapters.map((c, i) => (
          <button key={`${c.time}-${i}`} onClick={(e) => { e.stopPropagation(); onSeek(c.time); }} className={`shrink-0 rounded-full px-2.5 h-7 text-[11px] font-semibold backdrop-blur-md border transition-colors ${i === idx ? "bg-white text-black border-white" : "bg-black/35 text-white border-white/30"}`} data-testid={`long-chapter-${i}`}>
            <span className="opacity-70 tabular-nums mr-1">{fmtClock(c.time)}</span>{c.title}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Lista de capítulos + edición para el creador. */
export function ChaptersSheet({ reel, chapters, currentTime, onSeek, isOwner, token, onSaved, onClose }) {
  const [text, setText] = useState(chaptersToText(chapters.filter((c) => !c.auto)));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [suggested, setSuggested] = useState(reel?.chapters_suggested || null);
  const idx = currentChapterIndex(chapters, currentTime);
  const generate = async () => {
    setGenerating(true);
    try { const r = await axios.post(`${API}/posts/${reel.id}/chapters/ai`, {}, { headers: { Authorization: `Bearer ${token}` } }); setSuggested(r.data.chapters); setText(chaptersToText(r.data.chapters)); brunoToast.success("Propuesta lista: revísala y guarda"); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "BRUNO IA no pudo generar capítulos"); }
    finally { setGenerating(false); }
  };
  const save = async () => {
    const parsed = parseChapters(text);
    if (text.trim() && !parsed.length) { brunoToast.error("Formato: 00:00 Título (una línea por capítulo)"); return; }
    setSaving(true);
    try { const r = await axios.put(`${API}/posts/${reel.id}`, { chapters: parsed }, { headers: { Authorization: `Bearer ${token}` } }); onSaved?.(r.data); brunoToast.success(parsed.length ? "Capítulos guardados" : "Capítulos eliminados"); onClose(); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudieron guardar"); }
    finally { setSaving(false); }
  };
  return (
    <BottomSheet open onClose={onClose} title="Capítulos" testid="long-chapters-sheet" height="70vh">
      <div className="px-4 pb-8 space-y-4 overflow-y-auto">
        <ul className="space-y-1" data-testid="long-chapters-list">
          {chapters.map((c, i) => (
            <li key={`${c.time}-${i}`}><button onClick={() => { onSeek(c.time); onClose(); }} className={`w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left ${i === idx ? "bg-primary/10" : "hover:bg-foreground/[0.04]"}`} data-testid={`long-chapter-row-${i}`}><span className="text-xs tabular-nums text-muted-foreground w-14">{fmtClock(c.time)}</span><span className="text-sm font-medium flex-1 truncate">{c.title}</span>{c.auto && <span className="text-[10px] text-muted-foreground">auto</span>}</button></li>
          ))}
        </ul>
        {isOwner && (
          <div className="space-y-2 rounded-2xl bg-foreground/[0.04] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Editar capítulos <span className="text-muted-foreground font-normal">· una línea por capítulo: <code>02:30 Tema</code></span></p>
              <button onClick={generate} disabled={generating} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 h-8 text-[11px] font-semibold" data-testid="long-chapters-ai">{generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{generating ? "Transcribiendo…" : "Generar con IA"}</button>
            </div>
            {suggested?.length > 0 && <button onClick={() => setText(chaptersToText(suggested))} className="text-[11px] text-primary font-semibold inline-flex items-center gap-1" data-testid="long-chapters-apply-suggested"><Sparkles className="w-3 h-3" />Usar la propuesta de BRUNO IA ({suggested.length} capítulos) · revisa antes de guardar</button>}
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder={"00:00 Intro\n02:30 Primer tema"} className="w-full rounded-xl bg-background/70 border border-border/50 px-3 py-2 text-sm outline-none" data-testid="long-chapters-editor" />
            <button onClick={save} disabled={saving} className="h-10 px-4 rounded-full bg-primary text-white text-sm font-semibold inline-flex items-center gap-1.5" data-testid="long-chapters-save">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar</button>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/** Reanudar: posición guardada en el dispositivo y en el servidor (sincroniza entre dispositivos). */
export function useResume({ reel, videoRef, token, enabled }) {
  const lastSave = useRef(0);
  const key = `bruno_resume_${reel?.id}`;
  const [resumedFrom, setResumedFrom] = useState(null);
  const applyResume = async () => {
    const v = videoRef.current; if (!v || !enabled) return;
    let pos = parseFloat(localStorage.getItem(key) || "0") || 0;
    if (token) { try { const r = await axios.get(`${API}/posts/${reel.id}/progress`, { headers: { Authorization: `Bearer ${token}` } }); if ((r.data?.position || 0) > pos) pos = r.data.position; } catch { /* offline */ } }
    const dur = v.duration || reel.duration || 0;
    if (pos > 5 && dur && pos < dur - 10) { v.currentTime = pos; setResumedFrom(pos); setTimeout(() => setResumedFrom(null), 3500); }
  };
  const onProgress = (t, dur) => {
    if (!enabled || !reel?.id) return;
    const now = Date.now(); if (now - lastSave.current < 5000) return; lastSave.current = now;
    try { localStorage.setItem(key, String(dur && t >= dur - 8 ? 0 : t)); } catch { /* ignore */ }
    if (token) axios.post(`${API}/posts/${reel.id}/progress`, { position: t, duration: dur }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  };
  return { applyResume, onProgress, resumedFrom };
}
