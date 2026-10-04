/**
 * VideoNoteRecorder — Telegram/WhatsApp-style circular video note.
 *
 *  Records up to 30s of front-camera video inside a circular preview.
 *  Hold-to-record (mouse/touch). On release, fires `onCapture(file)`.
 *
 *  The resulting Blob is `video/webm` and is uploaded by the parent
 *  (ChatPage) just like an audio note. Render it back in the chat with
 *  `<CircularVideoMessage />`.
 */
/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Video as VideoIcon } from "lucide-react";

const MAX_SECONDS = 30;

export default function VideoNoteRecorder({ open, onClose, onCapture }) {
  const videoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);

  // Start camera when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 720, height: 720 },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => { /* ignore */ });
        }
      } catch (_e) {
        onClose?.();
      }
    })();
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open]);

  const stopAll = () => {
    try { recorderRef.current?.stop?.(); } catch (_e) { /* ignore */ }
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks?.().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  };

  const start = () => {
    if (!streamRef.current || recording) return;
    chunksRef.current = [];
    const rec = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    rec.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      if (blob.size > 0) {
        const file = new File([blob], `videonote-${Date.now()}.webm`, { type: "video/webm" });
        onCapture?.(file);
      }
      stopAll();
      onClose?.();
    };
    rec.start();
    recorderRef.current = rec;
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          // Auto-stop at the limit
          try { rec.stop(); } catch (_e) { /* ignore */ }
          setRecording(false);
          clearInterval(timerRef.current);
        }
        return s + 1;
      });
    }, 1000);
  };

  const stop = () => {
    if (!recording) return;
    setRecording(false);
    try { recorderRef.current?.stop(); } catch (_e) { /* ignore */ }
    if (timerRef.current) clearInterval(timerRef.current);
  };

  if (!open) return null;

  const progress = (seconds / MAX_SECONDS) * 100;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[140] bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6"
        data-testid="video-note-recorder"
      >
        {/* Close */}
        <button
          onClick={() => { stop(); onClose?.(); }}
          className="absolute right-4 grid place-items-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white" style={{ top: "calc(var(--safe-top) + 1rem)" }}
          aria-label="Cerrar"
          data-testid="video-note-close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Circular preview with ring progress */}
        <div className="relative">
          <svg className="absolute inset-0 -rotate-90" width="260" height="260" viewBox="0 0 260 260">
            <circle cx="130" cy="130" r="124" stroke="rgba(255,255,255,0.1)" strokeWidth="6" fill="none" />
            <circle
              cx="130" cy="130" r="124"
              stroke="#FF6A00"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 124}
              strokeDashoffset={2 * Math.PI * 124 * (1 - progress / 100)}
              style={{ transition: "stroke-dashoffset 0.25s linear" }}
            />
          </svg>
          <div className="w-[260px] h-[260px] rounded-full overflow-hidden border-4 border-white/10 shadow-2xl shadow-orange-500/30">
            <video
              ref={videoRef}
              className="w-full h-full object-cover scale-x-[-1]"
              muted
              playsInline
            />
          </div>
          {recording && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              {seconds}s
            </div>
          )}
        </div>

        {/* Hint + record button */}
        <p className="mt-6 text-white/70 text-xs">
          {recording ? "Suelta para enviar" : "Mantén pulsado el botón para grabar"}
        </p>
        <button
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onPointerCancel={stop}
          className={`mt-4 w-20 h-20 rounded-full grid place-items-center transition-all shadow-2xl ${
            recording
              ? "bg-red-500 ring-4 ring-red-500/40 scale-105"
              : "bg-white text-orange-500"
          }`}
          data-testid="video-note-record-btn"
          aria-label="Grabar nota de video"
        >
          <VideoIcon className={`w-7 h-7 ${recording ? "text-white" : "text-orange-500"}`} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
