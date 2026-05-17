import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Camera,
  Video,
  RotateCcw,
  FlipHorizontal,
  Send,
  Check,
  Loader2,
  Sparkles,
  Sun,
  Moon,
  Zap,
} from "lucide-react";

/**
 * BrunoQuickCamera — pro modal camera with TikTok-style real-time CSS filters.
 *
 * Props:
 *   open
 *   onClose
 *   onCapture(file: File, meta: { type: "image"|"video", filterId: string })
 *   mode: "photo" | "video" | "both" (default both)
 *
 * Lightweight (CSS filters, no face-api) — for the full AR experience use /camera.
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
];

const QUICK_ICONS = [Sparkles, Sun, Zap, Moon];

export default function BrunoQuickCamera({
  open,
  onClose,
  onCapture,
  mode = "both",
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [facing, setFacing] = useState("user");
  const [filter, setFilter] = useState(FILTERS[0]);
  const [captureMode, setCaptureMode] = useState(mode === "video" ? "video" : "photo");
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [preview, setPreview] = useState(null); // { url, blob, type }
  const [sending, setSending] = useState(false);
  const [streamError, setStreamError] = useState(null);
  const [mirrored, setMirrored] = useState(true);

  // ─── Stream lifecycle ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: captureMode === "video",
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStreamError(null);
      } catch (e) {
        setStreamError(e?.message || "No se pudo acceder a la cámara");
      }
    };
    startStream();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, facing, captureMode]);

  // Stop on close
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setRecording(false);
      setRecordTime(0);
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
    ctx.filter = filter.filter || "none";
    ctx.drawImage(video, 0, 0, w, h);
    if (mirrored && facing === "user") ctx.restore();
    return canvas;
  };

  const snapPhoto = async () => {
    const canvas = drawFrame();
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        setPreview({ url, blob, type: "image" });
      },
      "image/jpeg",
      0.92
    );
  };

  const startRecord = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setPreview({ url, blob, type: "video" });
    };
    recorder.start();
    setRecording(true);
    setRecordTime(0);
  };

  const stopRecord = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop();
      setRecording(false);
    }
  };

  const handleShutter = () => {
    if (captureMode === "photo") {
      snapPhoto();
    } else {
      if (recording) stopRecord();
      else startRecord();
    }
  };

  const handleSend = async () => {
    if (!preview) return;
    setSending(true);
    try {
      const ext = preview.type === "image" ? "jpg" : "webm";
      const mime = preview.type === "image" ? "image/jpeg" : "video/webm";
      const file = new File(
        [preview.blob],
        `bruno-${Date.now()}.${ext}`,
        { type: mime }
      );
      await onCapture?.(file, { type: preview.type, filterId: filter.id });
      // Cleanup
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

  // ─── UI ──────────────────────────────────────────────────────────────────
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
          <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
            <button
              onClick={onClose}
              className="grid place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
              aria-label="Cerrar"
              data-testid="quick-camera-close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <img
                src="/bruno-icon.png"
                alt="Bruno"
                className="h-7 w-7 rounded-lg object-contain"
              />
              <span className="text-white text-sm font-bold tracking-tight">
                BRUNO Camera
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

          {/* Preview / Video stage */}
          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            {streamError && (
              <div className="text-white text-sm text-center px-6 max-w-sm">
                <p className="font-semibold mb-1">Cámara no disponible</p>
                <p className="text-white/60 text-xs">{streamError}</p>
              </div>
            )}

            {preview ? (
              preview.type === "image" ? (
                <img
                  src={preview.url}
                  alt="captured"
                  className="max-h-full max-w-full object-contain"
                  data-testid="quick-camera-preview-img"
                />
              ) : (
                <video
                  src={preview.url}
                  controls
                  autoPlay
                  loop
                  className="max-h-full max-w-full"
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
                  filter: filter.filter,
                  transform: mirrored && facing === "user" ? "scaleX(-1)" : undefined,
                }}
                className="h-full w-full object-cover"
                data-testid="quick-camera-video"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

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

          {/* Bottom controls */}
          <div className="absolute bottom-0 inset-x-0 z-20 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            {!preview ? (
              <>
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
                        captureMode === "photo"
                          ? "bg-white text-black"
                          : "text-white/70"
                      }`}
                    >
                      FOTO
                    </button>
                    <button
                      onClick={() => setCaptureMode("video")}
                      data-testid="quick-camera-mode-video"
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-colors ${
                        captureMode === "video"
                          ? "bg-white text-black"
                          : "text-white/70"
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
                    <span className="absolute inset-0 rounded-full ring-2 ring-orange-500/0 hover:ring-orange-500/80 transition-all" />
                  </motion.button>

                  <button
                    onClick={() => {
                      if (captureMode === "photo") setCaptureMode("video");
                      else setCaptureMode("photo");
                    }}
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
                <p className="text-white/70 text-xs">
                  {preview.type === "image" ? "Foto lista" : "Video listo"} ·{" "}
                  <span className="font-semibold text-orange-300">{filter.name}</span>
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
