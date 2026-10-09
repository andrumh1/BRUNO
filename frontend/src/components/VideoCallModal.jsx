/**
 * VideoCallModal — Daily.co powered 1:1 call screen (single source of UI for calls, driven by CallOrchestrator).
 *
 *  States: incoming (ringing) · outgoing (waiting for the other side) · in-call (Daily Prebuilt frame + our controls).
 *  Media/TURN/permissions are handled by Daily; we expose mute, camera on/off, flip camera and hang up.
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import DailyIframe from "@daily-co/daily-js";
import { Phone, PhoneOff, Video as VideoIcon, User as UserIcon, Loader2, Mic, MicOff, VideoOff, SwitchCamera } from "lucide-react";
import { motion } from "framer-motion";
import { brunoToast } from "@/components/bruno/BrunoToast";

// Ringtone synthesized with WebAudio (no asset needed) + haptics while an incoming call rings.
function useRingtone(active) {
  useEffect(() => {
    if (!active) return undefined;
    let ctx, timer, stopped = false;
    const pattern = [400, 200, 400, 1200];
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (_) { /* no haptics */ }
    const vib = setInterval(() => { try { navigator.vibrate?.(pattern); } catch (_) { /* ignore */ } }, 2200);
    const ring = () => {
      if (stopped) return;
      try {
        ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t0 = ctx.currentTime;
        [0, 0.6].forEach((off) => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = "sine"; o.frequency.setValueAtTime(880, t0 + off); o.frequency.setValueAtTime(660, t0 + off + 0.2);
          g.gain.setValueAtTime(0.0001, t0 + off); g.gain.exponentialRampToValueAtTime(0.25, t0 + off + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, t0 + off + 0.45);
          o.connect(g).connect(ctx.destination); o.start(t0 + off); o.stop(t0 + off + 0.5);
        });
      } catch (_) { /* autoplay blocked until user gesture */ }
      timer = setTimeout(ring, 2200);
    };
    ring();
    return () => { stopped = true; clearTimeout(timer); clearInterval(vib); try { navigator.vibrate?.(0); } catch (_) { /* ignore */ } try { ctx?.close(); } catch (_) { /* ignore */ } };
  }, [active]);
}

// Daily allows a single call instance per page: serialise destroy → create between consecutive calls.
let pendingDestroy = Promise.resolve();
const destroyInstance = (inst) => { if (!inst) return pendingDestroy; pendingDestroy = pendingDestroy.then(() => inst.destroy()).catch(() => {}); return pendingDestroy; };

const Avatar = ({ url, size = "w-32 h-32" }) => (
  <div className={`relative ${size} rounded-full overflow-hidden border-4 border-white/20 shadow-2xl`}>
    {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center bg-gradient-to-br from-orange-500 to-pink-500"><UserIcon className="w-14 h-14 text-white" /></div>}
  </div>
);

const Ctl = ({ on, onClick, OnIcon, OffIcon, label, testId, danger }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} data-testid={testId} className={`grid place-items-center w-14 h-14 rounded-full shadow-xl active:scale-95 transition-transform ${danger ? "bg-red-500 hover:bg-red-600" : on ? "bg-white/15 hover:bg-white/25" : "bg-white text-black"}`}>
    {on ? <OnIcon className={`w-6 h-6 ${danger ? "text-white" : "text-white"}`} /> : <OffIcon className="w-6 h-6" />}
  </button>
);

// Daily Prebuilt frame + our own controls. Reports peer join/leave and media errors to the parent.
function DailyStage({ roomUrl, callType, onLeft, onPeerJoined, onPeerLeft, children }) {
  const boxRef = useRef(null);
  const frameRef = useRef(null);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(callType === "video");
  const [joined, setJoined] = useState(false);
  const [canFlip, setCanFlip] = useState(false);

  useEffect(() => {
    if (!roomUrl || !boxRef.current) return undefined;
    let frame;
    let cancelled = false;
    (async () => {
    try {
      await destroyInstance(DailyIframe.getCallInstance?.());
      if (cancelled || !boxRef.current) return;
      frame = DailyIframe.createFrame(boxRef.current, {
        showLeaveButton: false, showFullscreenButton: false, showLocalVideo: true, showParticipantsBar: false,
        iframeStyle: { position: "absolute", top: 0, left: 0, width: "100%", height: "calc(100% + 84px)", border: "0", background: "#0c0a09" },
        theme: { colors: { accent: "#FF6A00", accentText: "#FFFFFF", background: "#0c0a09", backgroundAccent: "#1c1917", baseText: "#FFFFFF", mainAreaBg: "#0c0a09", mainAreaBgAccent: "#1c1917", mainAreaText: "#FFFFFF", supportiveText: "#d6d3d1" } },
      });
      frameRef.current = frame;
      frame.on("joined-meeting", async () => {
        setJoined(true);
        try { const devs = await frame.enumerateDevices(); setCanFlip((devs?.devices || []).filter((d) => d.kind === "videoinput").length > 1); } catch (_) { /* ignore */ }
      });
      frame.on("participant-joined", (ev) => { if (!ev?.participant?.local) onPeerJoined?.(); });
      frame.on("participant-left", (ev) => { if (!ev?.participant?.local) onPeerLeft?.(); });
      frame.on("left-meeting", () => onLeft?.());
      frame.on("camera-error", (ev) => {
        const t = ev?.errorMsg?.errorMsg || ev?.error?.type || "";
        brunoToast.error("Sin acceso a cámara o micrófono", { description: /denied|permission|NotAllowed/i.test(t) ? "Permite el acceso en los ajustes del navegador y vuelve a intentarlo." : "Comprueba que ningún otro programa esté usando la cámara." });
      });
      frame.on("error", (ev) => { brunoToast.error("La llamada se interrumpió", { description: ev?.errorMsg || "Pérdida de conexión" }); onLeft?.(); });
      frame.join({ url: roomUrl, startVideoOff: callType !== "video", startAudioOff: false }).catch((e) => { brunoToast.error("No se pudo conectar la llamada", { description: e?.message || "" }); onLeft?.(); });
    } catch (e) {
      brunoToast.error("No se pudo iniciar el video", { description: e?.message || "" });
      onLeft?.();
    }
    })();
    return () => { cancelled = true; const f = frame; frameRef.current = null; if (f) { pendingDestroy = pendingDestroy.then(() => f.leave().catch(() => {})).then(() => f.destroy()).catch(() => {}); } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUrl]);

  const toggleMic = () => { const v = !mic; setMic(v); frameRef.current?.setLocalAudio(v); };
  const toggleCam = () => { const v = !cam; setCam(v); frameRef.current?.setLocalVideo(v); };
  const flip = async () => { try { await frameRef.current?.cycleCamera(); } catch (_) { /* ignore */ } };
  const hangup = async () => { try { await frameRef.current?.leave(); } catch (_) { /* ignore */ } onLeft?.(); };

  return (
    <>
      <div ref={boxRef} className="absolute inset-0" data-testid="call-stage" data-joined={joined ? "1" : "0"} />
      {children}
      <div className="absolute inset-x-0 flex items-center justify-center gap-4 z-20" style={{ bottom: "calc(var(--safe-bottom) + 20px)" }} data-testid="call-controls">
        <Ctl on={mic} onClick={toggleMic} OnIcon={Mic} OffIcon={MicOff} label={mic ? "Silenciar micrófono" : "Activar micrófono"} testId="call-mic-btn" />
        <Ctl on={cam} onClick={toggleCam} OnIcon={VideoIcon} OffIcon={VideoOff} label={cam ? "Apagar cámara" : "Encender cámara"} testId="call-cam-btn" />
        {canFlip && cam && <Ctl on onClick={flip} OnIcon={SwitchCamera} OffIcon={SwitchCamera} label="Cambiar cámara" testId="call-flip-btn" />}
        <Ctl on danger onClick={hangup} OnIcon={PhoneOff} OffIcon={PhoneOff} label="Finalizar llamada" testId="call-hangup-btn" />
      </div>
    </>
  );
}

export default function VideoCallModal({ isOpen, onClose, roomUrl, remoteUserName = "Usuario", remoteAvatarUrl = null, isIncoming = false, isRinging = false, onAccept, onDecline, onPeerLeft, callType = "video" }) {
  const [peerIn, setPeerIn] = useState(false);
  useEffect(() => { if (!isOpen) return undefined; const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, [isOpen]);
  const ringingIn = isOpen && isIncoming;
  useRingtone(ringingIn);
  const handlePeerLeft = useCallback(() => { setPeerIn(false); onPeerLeft?.(); }, [onPeerLeft]);

  if (!isOpen) return null;

  if (isIncoming) {
    return (
      <div className="fixed inset-0 z-[20000] bg-gradient-to-br from-stone-950 via-orange-950 to-stone-950 flex flex-col items-center justify-center text-white" style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }} data-testid="incoming-call-screen">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 280, damping: 22 }} className="flex flex-col items-center">
          <div className="relative">
            {[0, 1, 2].map((i) => <span key={i} className="absolute inset-0 rounded-full bg-orange-500/20" style={{ animation: "pulse 1.6s ease-out infinite", animationDelay: `${i * 0.5}s`, transform: `scale(${1.4 + i * 0.3})` }} />)}
            <Avatar url={remoteAvatarUrl} />
          </div>
          <p className="mt-8 text-[11px] uppercase tracking-[0.3em] text-white/55">Llamada {callType === "audio" ? "de voz" : "de video"} entrante</p>
          <h2 className="mt-2 text-2xl font-bold" data-testid="incoming-caller-name">{remoteUserName}</h2>
        </motion.div>
        <div className="mt-14 flex items-end justify-center gap-14 w-full px-8">
          <div className="flex flex-col items-center gap-3">
            <button onClick={onDecline} className="grid place-items-center w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 shadow-2xl shadow-red-500/40 active:scale-95 transition-transform" aria-label="Rechazar" data-testid="call-decline-btn"><PhoneOff className="w-9 h-9 text-white" /></button>
            <span className="text-xs text-white/70">Rechazar</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <button onClick={onAccept} className="grid place-items-center w-20 h-20 rounded-full bg-green-500 hover:bg-green-600 shadow-2xl shadow-green-500/40 active:scale-95 transition-transform animate-bounce" aria-label="Aceptar" data-testid="call-accept-btn">{callType === "audio" ? <Phone className="w-9 h-9 text-white" /> : <VideoIcon className="w-9 h-9 text-white" />}</button>
            <span className="text-xs text-white/70">Aceptar</span>
          </div>
        </div>
      </div>
    );
  }

  // Outgoing while ringing without a room yet (room is created server-side right after)
  if (!roomUrl) {
    return (
      <div className="fixed inset-0 z-[20000] bg-stone-950 flex flex-col items-center justify-center text-white" data-testid="outgoing-call-screen">
        <Avatar url={remoteAvatarUrl} />
        <h2 className="mt-6 text-2xl font-bold">{remoteUserName}</h2>
        <div className="mt-3 flex items-center gap-2 text-white/60"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Iniciando llamada…</span></div>
        <button onClick={onClose} className="mt-12 grid place-items-center w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 shadow-xl active:scale-95" aria-label="Cancelar llamada" data-testid="call-cancel-btn"><PhoneOff className="w-7 h-7 text-white" /></button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[20000] bg-stone-950 text-white" data-testid="in-call-screen" data-ringing={isRinging ? "1" : "0"}>
      <DailyStage roomUrl={roomUrl} callType={callType} onLeft={onClose} onPeerJoined={() => setPeerIn(true)} onPeerLeft={handlePeerLeft}>
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-center gap-2 px-4 py-2.5 pointer-events-none" style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}>
          <div className={`w-2 h-2 rounded-full ${peerIn ? "bg-green-500" : "bg-amber-400 animate-pulse"}`} />
          <span className="text-xs font-semibold drop-shadow" data-testid="call-status-text">{remoteUserName} · {peerIn ? "Conectado" : isRinging ? "Llamando…" : "Conectando…"}</span>
        </div>
        {isRinging && !peerIn && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-stone-950/70 backdrop-blur-sm pointer-events-none" data-testid="outgoing-ringing-overlay">
            <Avatar url={remoteAvatarUrl} />
            <h2 className="mt-6 text-2xl font-bold">{remoteUserName}</h2>
            <div className="mt-3 flex items-center gap-2 text-white/70"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">Llamando… esperando respuesta</span></div>
          </div>
        )}
      </DailyStage>
    </div>
  );
}
