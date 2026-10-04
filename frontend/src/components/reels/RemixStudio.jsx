/* eslint-disable react-hooks/exhaustive-deps */
/**
 * RemixStudio — Dúo (split-screen with the original) & Stitch (clip of the
 * original + your reaction) recorded client-side into ONE video via a canvas
 * pipeline (original frames + camera frames, original audio + mic mixed).
 */
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import axios from "axios";
import { X, Loader2, Scissors, Columns2, RotateCcw, Send, FlipHorizontal, Square } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const W = 720, H = 1280, MAX_SEC = 60, MAX_CLIP = 5;

const cover = (ctx, el, x, y, w, h, mirror = false) => {
  const vw = el.videoWidth, vh = el.videoHeight;
  if (!vw || !vh) return;
  const s = Math.max(w / vw, h / vh);
  const dw = vw * s, dh = vh * s;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  if (mirror) { ctx.translate(x + w, 0); ctx.scale(-1, 1); x = 0; }
  ctx.drawImage(el, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
};

export default function RemixStudio({ reel, mode, token, onClose, onPublished }) {
  const isDuet = mode === "duet";
  const [step, setStep] = useState(isDuet ? "record" : "trim");
  const [range, setRange] = useState({ start: 0, end: MAX_CLIP });
  const [duration, setDuration] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [recording, setRecording] = useState(false);
  const [phase, setPhase] = useState("source");   // stitch: source → camera
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState(null);
  const [facing, setFacing] = useState("user");

  const canvasRef = useRef(null);
  const origRef = useRef(null);
  const camRef = useRef(null);
  const camStream = useRef(null);
  const audioCtx = useRef(null);
  const audioDest = useRef(null);
  const origSrcNode = useRef(null);
  const recorder = useRef(null);
  const chunks = useRef([]);
  const raf = useRef(null);
  const phaseRef = useRef("source");
  const recordingRef = useRef(false);
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  const srcUrl = reel.mp4_url || reel.video_url;

  /* Camera */
  const openCam = async (face = facing) => {
    camStream.current?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
      camStream.current = s;
      if (camRef.current) { camRef.current.srcObject = s; camRef.current.play().catch(() => {}); }
      if (audioCtx.current && audioDest.current) audioCtx.current.createMediaStreamSource(s).connect(audioDest.current);
    } catch (e) { setError(e?.name === "NotAllowedError" ? "Permite cámara y micrófono para grabar" : "No se pudo abrir la cámara"); }
  };
  useEffect(() => {
    openCam();
    return () => { camStream.current?.getTracks().forEach((t) => t.stop()); cancelAnimationFrame(raf.current); audioCtx.current?.close().catch(() => {}); };
  }, []);

  /* Audio graph (original + mic → one destination) */
  const ensureAudio = () => {
    if (audioCtx.current) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.current = ctx;
    audioDest.current = ctx.createMediaStreamDestination();
    if (camStream.current) ctx.createMediaStreamSource(camStream.current).connect(audioDest.current);
    try {
      origSrcNode.current = ctx.createMediaElementSource(origRef.current);
      origSrcNode.current.connect(audioDest.current);
      origSrcNode.current.connect(ctx.destination);
    } catch (_) { /* already connected */ }
  };

  /* Draw loop — the canvas IS the viewfinder */
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const draw = () => {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const o = origRef.current, cam = camRef.current;
      const mirror = facing === "user";
      if (isDuet) {
        if (o) cover(ctx, o, 0, 0, W / 2, H);
        if (cam) cover(ctx, cam, W / 2, 0, W / 2, H, mirror);
        ctx.fillStyle = "rgba(255,255,255,.35)"; ctx.fillRect(W / 2 - 1, 0, 2, H);
      } else if (stepRef.current === "trim" || (recordingRef.current && phaseRef.current === "source")) {
        if (o) cover(ctx, o, 0, 0, W, H);
      } else if (cam) cover(ctx, cam, 0, 0, W, H, mirror);
      raf.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [facing, isDuet]);

  /* Stitch trim preview loop */
  useEffect(() => {
    const o = origRef.current; if (!o || step !== "trim") return;
    const onTime = () => { if (o.currentTime >= range.end || o.currentTime < range.start) o.currentTime = range.start; };
    o.addEventListener("timeupdate", onTime);
    o.currentTime = range.start; o.muted = true; o.play().catch(() => {});
    return () => { o.removeEventListener("timeupdate", onTime); o.pause(); };
  }, [step, range.start, range.end]);

  /* Recording */
  const start = async () => {
    setError(null);
    const o = origRef.current;
    ensureAudio(); await audioCtx.current.resume();
    o.muted = false; o.loop = false;
    o.currentTime = isDuet ? 0 : range.start;
    phaseRef.current = "source"; setPhase("source");
    let stream;
    try { stream = canvasRef.current.captureStream(30); } catch (_) { return setError("Tu navegador no permite componer este video"); }
    audioDest.current.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined);
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: rec.mimeType || "video/webm" });
      setPreview({ blob, url: URL.createObjectURL(blob) }); setStep("preview");
    };
    recorder.current = rec;
    await o.play().catch(() => {});
    rec.start(250); recordingRef.current = true; setRecording(true); setElapsed(0);
    const t0 = Date.now();
    const tick = setInterval(() => {
      const s = (Date.now() - t0) / 1000; setElapsed(s);
      const oo = origRef.current;
      if (!isDuet && phaseRef.current === "source" && oo && oo.currentTime >= range.end) { oo.pause(); phaseRef.current = "camera"; setPhase("camera"); }
      if (s >= MAX_SEC || (isDuet && oo?.ended)) stop();
    }, 100);
    rec._tick = tick;
  };
  const stop = () => {
    const rec = recorder.current; if (!rec || rec.state === "inactive") return;
    clearInterval(rec._tick); rec.stop();
    recordingRef.current = false; setRecording(false);
    origRef.current?.pause();
  };
  const armCountdown = () => {
    let n = 3; setCountdown(n);
    const iv = setInterval(() => { n -= 1; if (n <= 0) { clearInterval(iv); setCountdown(0); start(); } else setCountdown(n); }, 1000);
  };
  const retake = () => { setPreview(null); setStep("record"); origRef.current && (origRef.current.currentTime = isDuet ? 0 : range.start); };

  const publish = async () => {
    if (!preview) return;
    setPublishing(true);
    try {
      const fd = new FormData();
      fd.append("file", preview.blob, `bruno-${mode}-${Date.now()}.${preview.blob.type.includes("mp4") ? "mp4" : "webm"}`);
      const up = await axios.post(`${API}/upload/image`, fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
      const u = up.data || {};
      const r = await axios.post(`${API}/posts`, {
        content: caption || (isDuet ? `Dúo con @${reel.author?.username || reel.author?.name}` : `Stitch de @${reel.author?.username || reel.author?.name}`),
        media: [{ type: "video", url: u.url, mp4_url: u.mp4_url, poster_url: u.poster_url, f_auto_url: u.f_auto_url }],
        post_type: "video", visibility: "public",
        remix: { type: mode, source_post_id: reel.id, source_start: isDuet ? 0 : range.start, source_end: isDuet ? 0 : range.end },
      }, { headers: { Authorization: `Bearer ${token}` } });
      brunoToast.success(isDuet ? "¡Dúo publicado!" : "¡Stitch publicado!");
      onPublished?.(r.data);
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo publicar"); }
    setPublishing(false);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const clipLen = Math.max(0, range.end - range.start);

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10600] bg-black no-glass" data-testid={`remix-studio-${mode}`}>
      {/* hidden sources */}
      <video ref={origRef} src={srcUrl} crossOrigin="anonymous" playsInline preload="auto" className="hidden" onLoadedMetadata={(e) => { const d = e.currentTarget.duration || 0; setDuration(d); setRange({ start: 0, end: Math.min(MAX_CLIP, d || MAX_CLIP) }); }} />
      <video ref={camRef} muted playsInline className="hidden" />

      {/* viewfinder */}
      <div className="absolute inset-0 grid place-items-center">
        {step === "preview" && preview ? (
          <video src={preview.url} controls autoPlay loop playsInline className="max-h-full max-w-full" data-testid="remix-preview-video" />
        ) : (
          <canvas ref={canvasRef} className="max-h-full max-w-full" style={{ aspectRatio: "9/16" }} data-testid="remix-canvas" />
        )}
      </div>

      {/* top bar */}
      <div className="absolute inset-x-0 z-10 flex items-center px-3" style={{ top: "calc(var(--safe-top) + 10px)" }}>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" data-testid="remix-close"><X className="w-5 h-5" /></button>
        <div className="mx-auto inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-black/45 text-white text-xs font-bold">
          {isDuet ? <Columns2 className="w-3.5 h-3.5" /> : <Scissors className="w-3.5 h-3.5" />} {isDuet ? "Dúo" : "Stitch"} · @{reel.author?.username || reel.author?.name}
        </div>
        {step === "record" && !recording && <button onClick={() => { const f = facing === "user" ? "environment" : "user"; setFacing(f); openCam(f); }} className="w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" data-testid="remix-flip"><FlipHorizontal className="w-5 h-5" /></button>}
      </div>

      {recording && (
        <div className="absolute top-20 inset-x-0 z-10 flex justify-center">
          <span className="inline-flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold" data-testid="remix-rec-badge">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" /> {fmt(elapsed)}{!isDuet && ` · ${phase === "source" ? "Original" : "Tu parte"}`}
          </span>
        </div>
      )}
      {countdown > 0 && <div className="absolute inset-0 z-20 grid place-items-center pointer-events-none" data-testid="remix-countdown"><span className="text-white text-8xl font-black drop-shadow-2xl">{countdown}</span></div>}
      {error && <div className="absolute top-32 inset-x-6 z-10 text-center text-white text-sm bg-red-500/80 rounded-2xl p-3" data-testid="remix-error">{error}</div>}

      {/* bottom controls */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 to-transparent px-5 pb-6 pt-10" style={{ paddingBottom: "calc(var(--safe-bottom) + 20px)" }}>
        {step === "trim" && (
          <div className="space-y-3" data-testid="remix-trim">
            <p className="text-white text-xs text-center">Elige hasta {MAX_CLIP}s del original · <b>{clipLen.toFixed(1)}s</b> seleccionados</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-white/80 text-[11px]">Inicio {fmt(range.start)}
                <input type="range" min={0} max={Math.max(0, duration - 1)} step={0.1} value={range.start} onChange={(e) => { const s = Number(e.target.value); setRange({ start: s, end: Math.min(duration || MAX_CLIP, Math.max(s + 1, Math.min(range.end, s + MAX_CLIP))) }); }} className="flex-1 accent-orange-500" data-testid="remix-trim-start" /></label>
              <label className="flex items-center gap-2 text-white/80 text-[11px]">Fin &nbsp;&nbsp;&nbsp;{fmt(range.end)}
                <input type="range" min={0} max={duration || MAX_CLIP} step={0.1} value={range.end} onChange={(e) => { const en = Number(e.target.value); setRange({ start: Math.max(0, Math.min(range.start, en - 1)), end: Math.max(en, Math.min(duration, range.start + 1)) > range.start + MAX_CLIP ? range.start + MAX_CLIP : Math.max(en, range.start + 1) }); }} className="flex-1 accent-orange-500" data-testid="remix-trim-end" /></label>
            </div>
            <button onClick={() => setStep("record")} className="w-full h-12 rounded-full bg-primary text-white font-bold text-sm" data-testid="remix-trim-next">Continuar · grabar mi parte</button>
          </div>
        )}
        {step === "record" && (
          <div className="flex items-center justify-center gap-10">
            {!isDuet && !recording && <button onClick={() => setStep("trim")} className="text-white/80 text-xs inline-flex items-center gap-1" data-testid="remix-back-trim"><Scissors className="w-4 h-4" /> Recortar</button>}
            <motion.button whileTap={{ scale: 0.9 }} onClick={recording ? stop : armCountdown} disabled={!!countdown || !!error} className={`relative grid place-items-center h-20 w-20 rounded-full ${recording ? "bg-red-500" : "bg-white"} disabled:opacity-50`} data-testid="remix-shutter">
              {recording ? <Square className="w-7 h-7 text-white fill-white" /> : <span className="h-16 w-16 rounded-full border-[3px] border-zinc-800" />}
            </motion.button>
            {!isDuet && !recording && <span className="text-white/60 text-xs w-16 text-center">{clipLen.toFixed(1)}s + tú</span>}
          </div>
        )}
        {step === "preview" && (
          <div className="space-y-3" data-testid="remix-publish">
            <input value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={200} placeholder="Escribe una descripción…" className="w-full h-11 rounded-full bg-white/10 text-white px-4 text-sm outline-none placeholder:text-white/50" data-testid="remix-caption" />
            <div className="flex items-center gap-3">
              <button onClick={retake} className="h-12 w-12 rounded-full bg-white/15 text-white grid place-items-center" data-testid="remix-retake"><RotateCcw className="w-5 h-5" /></button>
              <button onClick={publish} disabled={publishing} className="flex-1 h-12 rounded-full bg-primary text-white font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="remix-publish-btn">
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Publicar {isDuet ? "Dúo" : "Stitch"}
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.div>,
    document.body
  );
}
