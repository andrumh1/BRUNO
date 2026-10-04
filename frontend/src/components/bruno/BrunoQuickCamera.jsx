import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Video,
  RotateCcw,
  FlipHorizontal,
  Send,
  Loader2,
  Sparkles,
  Sun,
  Moon,
  Zap,
  Music2,
  ZoomIn,
  Timer,
  Grid3X3,
  Wand2,
  Flashlight,
} from "lucide-react";
import MusicPicker from "./MusicPicker";

/**
 * BrunoQuickCamera — Pro modal camera (TikTok-class).
 *
 * Features:
 *   • Highest-quality stream the device supports (asks for 4K → 1080p fallback)
 *   • Native aspect-ratio container — no awful crops, no distortions
 *   • Pinch / slider zoom (uses MediaTrackConstraints when supported)
 *   • 14 real-time CSS filters
 *   • Music: search library, volume, trim — attaches metadata to the capture
 *   • Photo / Video modes, recording timer, mirror toggle
 *
 * Props:
 *   open
 *   onClose
 *   onCapture(file: File, meta: { type, filterId, music?, aspectRatio, zoom })
 *   mode: "photo" | "video" | "both"
 */

const FILTERS = [
  { id: "none", name: "Original", filter: "" },
  { id: "beauty", name: "Beauty", filter: "brightness(1.05) contrast(0.95) saturate(1.1) blur(0.2px)" },
  { id: "glow", name: "Glow", filter: "brightness(1.15) contrast(0.9) saturate(1.2)" },
  { id: "warm", name: "Cálido", filter: "sepia(0.25) saturate(1.4) brightness(1.05)" },
  { id: "cool", name: "Fresco", filter: "hue-rotate(15deg) saturate(1.1) brightness(1.05)" },
  { id: "sunset", name: "Sunset", filter: "sepia(0.4) saturate(1.6) contrast(1.1) brightness(1.1)" },
  { id: "vintage", name: "Vintage", filter: "sepia(0.5) contrast(1.1) brightness(0.95)" },
  { id: "drama", name: "Drama", filter: "contrast(1.4) saturate(0.7) brightness(0.9)" },
  { id: "bw", name: "B&N", filter: "grayscale(1) contrast(1.3)" },
  { id: "cinema", name: "Cinema", filter: "contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.15)" },
  { id: "neon", name: "Neon", filter: "saturate(2) contrast(1.2) brightness(1.1) hue-rotate(-10deg)" },
  { id: "dreamy", name: "Dreamy", filter: "brightness(1.2) contrast(0.8) saturate(1.3)" },
  { id: "noir", name: "Noir", filter: "grayscale(0.8) contrast(1.5) brightness(0.85)" },
  { id: "fade", name: "Fade", filter: "brightness(1.1) contrast(0.85) saturate(0.75)" },
  { id: "tealorange", name: "Teal&Orange", filter: "contrast(1.15) saturate(1.35) sepia(0.2) hue-rotate(-8deg)" },
  { id: "golden", name: "Golden Hour", filter: "sepia(0.35) saturate(1.5) brightness(1.08) contrast(1.05) hue-rotate(-6deg)" },
  { id: "pastel", name: "Pastel", filter: "brightness(1.12) contrast(0.82) saturate(0.9) sepia(0.08)" },
  { id: "cyber", name: "Cyberpunk", filter: "contrast(1.3) saturate(1.8) hue-rotate(25deg) brightness(0.95)" },
  { id: "vhs", name: "Retro VHS", filter: "contrast(1.1) saturate(1.3) sepia(0.3) blur(0.35px) brightness(1.02)" },
  { id: "frost", name: "Frost", filter: "brightness(1.1) saturate(0.7) hue-rotate(180deg) contrast(1.05)" },
  { id: "monoblue", name: "Mono Azul", filter: "grayscale(1) sepia(0.4) hue-rotate(180deg) saturate(1.6) contrast(1.15)" },
  { id: "film", name: "Film 35mm", filter: "contrast(1.08) saturate(0.9) sepia(0.22) brightness(0.97)" },
];

const TIMERS = [0, 3, 10];
const beautyFilter = (b) => (b > 0 ? `brightness(${(1 + b * 0.06).toFixed(3)}) contrast(${(1 - b * 0.08).toFixed(3)}) saturate(${(1 + b * 0.12).toFixed(3)}) blur(${(b * 0.7).toFixed(2)}px)` : "");

const QUICK_ICONS = [Sparkles, Sun, Zap, Moon];

// Resolution tiers to try, in order of preference.
const RES_TIERS = [
  { label: "4K", width: 3840, height: 2160 },
  { label: "QHD", width: 2560, height: 1440 },
  { label: "FHD", width: 1920, height: 1080 },
  { label: "HD", width: 1280, height: 720 },
];

export default function BrunoQuickCamera({
  open,
  onClose,
  onCapture,
  mode = "both",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const trackRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const musicAudioRef = useRef(null);

  const [facing, setFacing] = useState("user");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [captureMode, setCaptureMode] = useState(mode === "video" ? "video" : "photo");
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [mirrored, setMirrored] = useState(true);
  const [resolutionLabel, setResolutionLabel] = useState("HD");
  const [aspectRatio, setAspectRatio] = useState(null); // e.g. 9/16, 16/9
  // Zoom
  const [zoomCaps, setZoomCaps] = useState(null); // { min, max, step }
  const [zoom, setZoom] = useState(1);
  const [showZoom, setShowZoom] = useState(false);
  // Music
  const [showMusic, setShowMusic] = useState(false);
  const [music, setMusic] = useState(null); // {track, volume, start, end}
  // Pro tools
  const [beauty, setBeauty] = useState(0);        // 0..1 smoothing intensity
  const [showBeauty, setShowBeauty] = useState(false);
  const [timer, setTimer] = useState(0);          // 0 | 3 | 10 seconds
  const [countdown, setCountdown] = useState(0);
  const [grid, setGrid] = useState(false);
  const [torch, setTorch] = useState(false);
  const [torchCaps, setTorchCaps] = useState(false);
  const renderLoopRef = useRef(null);
  const recordCanvasRef = useRef(null);
  const effectiveFilter = [filter.filter, beautyFilter(beauty)].filter(Boolean).join(" ");

  // ─── Stream lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    const startStream = async () => {
      let stream = null;
      for (const tier of RES_TIERS) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facing,
              width: { ideal: tier.width },
              height: { ideal: tier.height },
              frameRate: { ideal: 30 },
            },
            audio: captureMode === "video",
          });
          setResolutionLabel(tier.label);
          break;
        } catch (_) {
          continue;
        }
      }
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: captureMode === "video",
          });
          setResolutionLabel("Auto");
        } catch (e) {
          setStreamError(e?.message || "No se pudo acceder a la cámara");
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;

      // Probe device capabilities for zoom
      try {
        const caps = track.getCapabilities?.();
        if (caps?.zoom) {
          setZoomCaps({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
          const settings = track.getSettings?.();
          setZoom(settings?.zoom || caps.zoom.min || 1);
        } else {
          setZoomCaps(null);
        }
      } catch (_) {
        setZoomCaps(null);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          const w = videoRef.current.videoWidth;
          const h = videoRef.current.videoHeight;
          if (w && h) setAspectRatio(w / h);
        };
      }
      setStreamError(null);
    };

    startStream();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        trackRef.current = null;
      }
    };
  }, [open, facing, captureMode]);

  // Apply zoom via constraints
  useEffect(() => {
    const track = trackRef.current;
    if (!track || !zoomCaps) return;
    try {
      track.applyConstraints({ advanced: [{ zoom }] }).catch(() => {});
    } catch (_) {
      /* unsupported */
    }
  }, [zoom, zoomCaps]);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setRecording(false);
      setRecordTime(0);
      setShowMusic(false);
      setShowZoom(false);
      setMusic(null);
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    }
  }, [open]);

  // Record timer
  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecordTime((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // ─── Capture ────────────────────────────────────────────────────────────
  const drawFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (mirrored && facing === "user") {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.filter = effectiveFilter || "none";
    ctx.drawImage(video, 0, 0, w, h);
    if (mirrored && facing === "user") ctx.restore();
    return canvas;
  };

  const snapPhoto = () => {
    const canvas = drawFrame();
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreview({ url, blob, type: "image" });
      },
      "image/jpeg",
      0.95
    );
  };

  const startRecord = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    // Music preview during recording (best-effort browser playback)
    if (music?.track) {
      const audio = new Audio(music.track.url);
      audio.volume = music.volume ?? 0.7;
      audio.currentTime = music.start || 0;
      audio.play().catch(() => {});
      musicAudioRef.current = audio;
    }

    const mimePref = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ].find((m) => MediaRecorder.isTypeSupported(m));
    // Bake filters/beauty/mirror into the recording via a canvas pipeline
    let recStream = streamRef.current;
    const video = videoRef.current;
    if ((effectiveFilter || (mirrored && facing === "user")) && video?.videoWidth && typeof HTMLCanvasElement.prototype.captureStream === "function") {
      const c = document.createElement("canvas");
      c.width = video.videoWidth; c.height = video.videoHeight;
      const ctx = c.getContext("2d");
      const mirror = mirrored && facing === "user";
      const draw = () => {
        ctx.save();
        if (mirror) { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
        ctx.filter = effectiveFilter || "none";
        ctx.drawImage(video, 0, 0, c.width, c.height);
        ctx.restore();
        renderLoopRef.current = requestAnimationFrame(draw);
      };
      draw();
      recordCanvasRef.current = c;
      const cs = c.captureStream(30);
      streamRef.current.getAudioTracks().forEach((t) => cs.addTrack(t));
      recStream = cs;
    }
    const recorder = new MediaRecorder(recStream, mimePref ? { mimeType: mimePref, videoBitsPerSecond: 6_000_000 } : { videoBitsPerSecond: 6_000_000 });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (renderLoopRef.current) { cancelAnimationFrame(renderLoopRef.current); renderLoopRef.current = null; }
      recordCanvasRef.current = null;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreview({ url, blob, type: "video" });
      if (musicAudioRef.current) {
        musicAudioRef.current.pause();
        musicAudioRef.current = null;
      }
    };
    recorder.start(250);
    setRecording(true);
    setRecordTime(0);
  };

  const stopRecord = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
    if (musicAudioRef.current) {
      musicAudioRef.current.pause();
      musicAudioRef.current = null;
    }
  };

  const fire = () => {
    if (captureMode === "photo") snapPhoto();
    else if (recording) stopRecord();
    else startRecord();
  };

  const handleShutter = () => {
    if (countdown) return;
    if (timer > 0 && !recording) {
      let n = timer;
      setCountdown(n);
      const tick = setInterval(() => {
        n -= 1;
        if (n <= 0) { clearInterval(tick); setCountdown(0); fire(); } else setCountdown(n);
      }, 1000);
      return;
    }
    fire();
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    try { await track.applyConstraints({ advanced: [{ torch: !torch }] }); setTorch((t) => !t); } catch (_) { /* unsupported */ }
  };

  useEffect(() => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    try { setTorchCaps(!!track?.getCapabilities?.().torch); } catch (_) { setTorchCaps(false); }
  }, [facing, streamError]);

  const handleSend = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const ext = preview.type === "image" ? "jpg" : "webm";
      const mime = preview.type === "image" ? "image/jpeg" : preview.blob.type || "video/webm";
      const file = new File(
        [preview.blob],
        `bruno-${Date.now()}.${ext}`,
        { type: mime }
      );
      await onCapture?.(file, {
        type: preview.type,
        filterId: filter.id,
        beauty,
        resolution: resolutionLabel,
        aspectRatio,
        zoom,
        music: music
          ? {
              trackId: music.track.id,
              title: music.track.title,
              url: music.track.url,
              volume: music.volume,
              start: music.start,
              end: music.end,
            }
          : null,
      });
      URL.revokeObjectURL(preview.url);
      setPreview(null);
      onClose?.();
    } finally {
      setSending(false);
    }
  };

  const retake = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  // Container style: respect native aspect-ratio when known
  const stageStyle = aspectRatio
    ? { aspectRatio: `${aspectRatio}` }
    : { aspectRatio: "9/16" };

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black"
          data-testid="bruno-quick-camera"
        >
          {/* Top bar */}
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent" style={{ paddingTop: "calc(var(--safe-top) + 0.75rem)" }}>
            <button
              onClick={onClose}
              className="grid place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
              aria-label="Cerrar"
              data-testid="quick-camera-close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img src="/bruno-icon.png" alt="Bruno" className="h-7 w-7 rounded-lg object-contain" />
              <span className="text-white text-sm font-bold tracking-tight">BRUNO Camera</span>
              <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-orange-300 bg-orange-500/20 rounded-full px-2 py-0.5">
                {resolutionLabel}
              </span>
            </div>
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              className="grid place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
              aria-label="Cambiar cámara"
              data-testid="quick-camera-flip"
            >
              <FlipHorizontal className="h-5 w-5" />
            </button>
          </div>

          {/* Stage — native aspect ratio */}
          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            {streamError && (
              <div className="text-white text-sm text-center px-6 max-w-sm">
                <p className="font-semibold mb-1">Cámara no disponible</p>
                <p className="text-white/60 text-xs">{streamError}</p>
              </div>
            )}

            <div
              className="relative max-h-full max-w-full"
              style={stageStyle}
            >
              {preview ? (
                preview.type === "image" ? (
                  <img
                    src={preview.url}
                    alt="captured"
                    className="h-full w-full object-contain"
                    data-testid="quick-camera-preview-img"
                  />
                ) : (
                  <video
                    src={preview.url}
                    controls
                    autoPlay
                    loop
                    className="h-full w-full"
                    data-testid="quick-camera-preview-video"
                  />
                )
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    filter: effectiveFilter,
                    transform: mirrored && facing === "user" ? "scaleX(-1)" : undefined,
                  }}
                  className="h-full w-full object-contain"
                  data-testid="quick-camera-video"
                />
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            {grid && !preview && (
              <div className="pointer-events-none absolute inset-0 z-10" data-testid="quick-camera-grid"
                style={{ backgroundImage: "linear-gradient(to right, rgba(255,255,255,.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.35) 1px, transparent 1px)", backgroundSize: "33.34% 33.34%" }} />
            )}
            {countdown > 0 && (
              <motion.div key={countdown} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute inset-0 z-30 grid place-items-center pointer-events-none" data-testid="quick-camera-countdown">
                <span className="text-white text-8xl font-black drop-shadow-2xl">{countdown}</span>
              </motion.div>
            )}
          </div>

          {/* Right-side vertical zoom slider — only if device supports zoom */}
          {!preview && zoomCaps && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1">
              <button
                onClick={() => setShowZoom((v) => !v)}
                className="grid place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white"
                data-testid="quick-camera-zoom-toggle"
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <AnimatePresence>
                {showZoom && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 180 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center"
                  >
                    <input
                      type="range"
                      min={zoomCaps.min}
                      max={zoomCaps.max}
                      step={zoomCaps.step}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      data-testid="quick-camera-zoom-slider"
                      className="accent-orange-500"
                      style={{
                        writingMode: "bt-lr",
                        WebkitAppearance: "slider-vertical",
                        height: 160,
                        width: 20,
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              <span className="text-white text-[10px] font-bold bg-black/40 rounded-full px-2 py-0.5">
                {zoom.toFixed(1)}x
              </span>
            </div>
          )}

          {/* Recording badge */}
          {recording && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              {String(Math.floor(recordTime / 60)).padStart(2, "0")}:
              {String(recordTime % 60).padStart(2, "0")}
            </motion.div>
          )}

          {/* Music chip — top center under header */}
          {!preview && captureMode === "video" && (
            <button
              onClick={() => setShowMusic(true)}
              data-testid="quick-camera-music-btn"
              className={`absolute top-16 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                music
                  ? "bg-orange-500 border-orange-500 text-white"
                  : "bg-white/10 border-white/20 text-white backdrop-blur"
              }`}
            >
              <Music2 className="h-3.5 w-3.5" />
              <span className="max-w-[140px] truncate">
                {music ? music.track.title : "Añadir música"}
              </span>
            </button>
          )}

          {/* Bottom controls — animated padding to accommodate the nav pill */}
          <motion.div
            layout
            animate={{ paddingBottom: `calc(24px + var(--nav-reserve, 0px))` }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
          >
            {!preview ? (
              <>
                {/* Pro tools row */}
                <div className="flex items-center justify-center gap-2 px-3 pb-2" data-testid="quick-camera-tools">
                  <button onClick={() => setTimer(TIMERS[(TIMERS.indexOf(timer) + 1) % TIMERS.length])} data-testid="quick-camera-timer"
                    className={`h-9 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1 border ${timer ? "bg-orange-500 border-orange-500 text-white" : "bg-white/10 border-white/20 text-white"}`}>
                    <Timer className="h-3.5 w-3.5" /> {timer ? `${timer}s` : "Timer"}
                  </button>
                  <button onClick={() => setGrid((g) => !g)} data-testid="quick-camera-grid-toggle" aria-label="Cuadrícula"
                    className={`h-9 w-9 rounded-full grid place-items-center border ${grid ? "bg-orange-500 border-orange-500 text-white" : "bg-white/10 border-white/20 text-white"}`}>
                    <Grid3X3 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setShowBeauty((v) => !v)} data-testid="quick-camera-beauty-toggle"
                    className={`h-9 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1 border ${beauty > 0 ? "bg-orange-500 border-orange-500 text-white" : "bg-white/10 border-white/20 text-white"}`}>
                    <Wand2 className="h-3.5 w-3.5" /> Beauty{beauty > 0 ? ` ${Math.round(beauty * 100)}%` : ""}
                  </button>
                  {torchCaps && (
                    <button onClick={toggleTorch} data-testid="quick-camera-torch" aria-label="Flash"
                      className={`h-9 w-9 rounded-full grid place-items-center border ${torch ? "bg-yellow-400 border-yellow-400 text-black" : "bg-white/10 border-white/20 text-white"}`}>
                      <Flashlight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showBeauty && (
                  <div className="px-6 pb-2 flex items-center gap-3" data-testid="quick-camera-beauty-slider-row">
                    <span className="text-white/70 text-[10px]">Suavizado</span>
                    <input type="range" min={0} max={1} step={0.05} value={beauty} onChange={(e) => setBeauty(Number(e.target.value))} className="flex-1 accent-orange-500" data-testid="quick-camera-beauty-slider" />
                    <span className="text-white text-[10px] font-bold w-8 text-right">{Math.round(beauty * 100)}%</span>
                  </div>
                )}

                {/* Filter strip */}
                <div className="overflow-x-auto px-3 pb-3 scrollbar-none">
                  <div className="flex gap-2 w-max">
                    {FILTERS.map((f, i) => {
                      const Icon = QUICK_ICONS[i % QUICK_ICONS.length];
                      const active = filter.id === f.id;
                      return (
                        <motion.button
                          key={f.id}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => setFilter(f)}
                          data-testid={`quick-camera-filter-${f.id}`}
                          className={`shrink-0 rounded-2xl px-3 py-2 text-xs font-semibold inline-flex items-center gap-1.5 border transition-colors ${
                            active
                              ? "bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-500/30"
                              : "bg-white/10 backdrop-blur text-white border-white/20 hover:bg-white/20"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {f.name}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>

                {/* Mode toggle */}
                {mode === "both" && (
                  <div className="flex justify-center gap-1 mb-3">
                    <button
                      onClick={() => setCaptureMode("photo")}
                      data-testid="quick-camera-mode-photo"
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-colors ${
                        captureMode === "photo" ? "bg-white text-black" : "text-white/70"
                      }`}
                    >
                      FOTO
                    </button>
                    <button
                      onClick={() => setCaptureMode("video")}
                      data-testid="quick-camera-mode-video"
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-colors ${
                        captureMode === "video" ? "bg-white text-black" : "text-white/70"
                      }`}
                    >
                      VIDEO
                    </button>
                  </div>
                )}

                {/* Shutter row */}
                <div className="flex items-center justify-around px-8">
                  <button
                    onClick={() => setMirrored((m) => !m)}
                    className="grid place-items-center h-12 w-12 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
                    aria-label="Espejar"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>

                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={handleShutter}
                    aria-label="Capturar"
                    data-testid="quick-camera-shutter"
                    className={`relative grid place-items-center h-20 w-20 rounded-full transition-colors ${
                      recording ? "bg-red-500" : "bg-white"
                    }`}
                  >
                    <span
                      className={`rounded-full transition-all ${
                        recording ? "h-7 w-7 bg-white" : "h-16 w-16 border-[3px] border-zinc-800"
                      }`}
                    />
                  </motion.button>

                  <button
                    onClick={() => setCaptureMode(captureMode === "photo" ? "video" : "photo")}
                    className="grid place-items-center h-12 w-12 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
                    aria-label="Cambiar modo"
                  >
                    {captureMode === "photo" ? (
                      <Video className="h-5 w-5" />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between px-6">
                <button
                  onClick={retake}
                  data-testid="quick-camera-retake"
                  className="grid place-items-center h-14 w-14 rounded-full bg-white/15 backdrop-blur text-white"
                  aria-label="Repetir"
                >
                  <RotateCcw className="h-6 w-6" />
                </button>
                <p className="text-white/70 text-xs text-center">
                  {preview.type === "image" ? "Foto" : "Video"} ·{" "}
                  <span className="font-semibold text-orange-300">{filter.name}</span>
                  {music && (
                    <>
                      {" "}· <span className="font-semibold text-orange-300">🎵 {music.track.title}</span>
                    </>
                  )}
                </p>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={sending}
                  data-testid="quick-camera-send"
                  className="grid place-items-center h-14 w-14 rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/40 disabled:opacity-50"
                  aria-label="Enviar"
                >
                  {sending ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Send className="h-6 w-6" />
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>

          {/* Music Picker overlay */}
          <MusicPicker
            open={showMusic}
            onClose={() => setShowMusic(false)}
            current={music}
            onApply={setMusic}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
