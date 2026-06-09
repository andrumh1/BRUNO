/**
 * VideoCallModal — Jitsi-powered call screen for chat.
 *
 *  Why Jitsi? It's a free public WebRTC service with built-in STUN/TURN
 *  that works behind NATs without any API key. We embed `meet.jit.si` in
 *  an iframe — Bruno's backend generates a unique room URL per call so
 *  only the two chat participants can join.
 *
 *  The component handles 3 states:
 *    1. Outgoing call — "Calling…" + Cancel
 *    2. Incoming call — "{name} is calling you" + Accept/Decline
 *    3. In-call — iframe rendering the Jitsi room
 */
import React, { useEffect } from "react";
import { Phone, PhoneOff, Video as VideoIcon, X, User as UserIcon, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function VideoCallModal({
  isOpen,
  onClose,
  roomUrl,
  remoteUserName = "Usuario",
  remoteAvatarUrl = null,
  isIncoming = false,
  isConnecting = false,
  onAccept,
  onDecline,
  callType = "video",
}) {
  // Lock body scroll while a call is active
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [isOpen]);

  if (!isOpen) return null;

  // ─── Incoming call (ringing) ─────────────────────────────────────────
  if (isIncoming && !isConnecting) {
    return (
      <div className="fixed inset-0 z-[150] bg-gradient-to-br from-stone-950 via-orange-950 to-stone-950 flex flex-col items-center justify-center text-white" data-testid="incoming-call-screen">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 22 }}
          className="flex flex-col items-center"
        >
          <div className="relative">
            {/* Pulsing rings */}
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="absolute inset-0 rounded-full bg-orange-500/20"
                style={{ animation: `pulse 1.6s ease-out infinite`, animationDelay: `${i * 0.5}s`, transform: `scale(${1.4 + i * 0.3})` }}
              />
            ))}
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl">
              {remoteAvatarUrl ? (
                <img src={remoteAvatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full grid place-items-center bg-gradient-to-br from-orange-500 to-pink-500">
                  <UserIcon className="w-14 h-14 text-white" />
                </div>
              )}
            </div>
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-white/55">
            Llamada {callType === "audio" ? "de voz" : "de video"} entrante
          </p>
          <h2 className="mt-2 text-2xl font-bold">{remoteUserName}</h2>
        </motion.div>

        <div className="mt-12 flex items-center gap-12">
          <button
            onClick={onDecline}
            className="grid place-items-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/40 active:scale-95"
            aria-label="Rechazar"
            data-testid="call-decline-btn"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <button
            onClick={onAccept}
            className="grid place-items-center w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 shadow-xl shadow-green-500/40 active:scale-95 animate-bounce"
            aria-label="Aceptar"
            data-testid="call-accept-btn"
          >
            {callType === "audio" ? <Phone className="w-7 h-7 text-white" /> : <VideoIcon className="w-7 h-7 text-white" />}
          </button>
        </div>
      </div>
    );
  }

  // ─── Outgoing call (waiting for answer) ──────────────────────────────
  if (!roomUrl) {
    return (
      <div className="fixed inset-0 z-[150] bg-gradient-to-br from-stone-950 via-orange-950 to-stone-950 flex flex-col items-center justify-center text-white" data-testid="outgoing-call-screen">
        <div className="w-28 h-28 rounded-full grid place-items-center bg-gradient-to-br from-orange-500 to-pink-500 shadow-2xl shadow-orange-500/40">
          <UserIcon className="w-12 h-12 text-white" />
        </div>
        <p className="mt-6 text-[11px] uppercase tracking-[0.3em] text-white/55">
          Llamando a
        </p>
        <h2 className="mt-2 text-2xl font-bold">{remoteUserName}</h2>
        <div className="mt-3 flex items-center gap-2 text-white/60">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Estableciendo conexión…</span>
        </div>
        <button
          onClick={onClose}
          className="mt-12 grid place-items-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-xl shadow-red-500/40 active:scale-95"
          aria-label="Cancelar llamada"
          data-testid="call-cancel-btn"
        >
          <PhoneOff className="w-7 h-7 text-white" />
        </button>
      </div>
    );
  }

  // ─── In-call (Jitsi iframe) ──────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[150] bg-black flex flex-col"
        data-testid="in-call-screen"
      >
        {/* Title bar */}
        <div className="flex items-center justify-between px-3 py-2.5 bg-black/85 text-white border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold">{remoteUserName}</span>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center w-8 h-8 rounded-full bg-red-500 hover:bg-red-600"
            aria-label="Colgar"
            data-testid="call-hangup-btn"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Jitsi iframe */}
        <iframe
          title="BRUNO call"
          src={roomUrl}
          className="flex-1 w-full bg-stone-950"
          allow="camera; microphone; fullscreen; display-capture; autoplay; speaker-selection"
          allowFullScreen
          data-testid="call-iframe"
        />
      </motion.div>
    </AnimatePresence>
  );
}
