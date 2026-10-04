/* eslint-disable react-hooks/exhaustive-deps */
/**
 * StartLivePage — host flow: setup (title · categoría · privado + código) → EN VIVO.
 * Video goes out via WebRTC to each viewer (useLiveRTC). Private lives show the
 * access-code panel (copy / share / rotate) that only the host can see.
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowLeft, Radio, Lock, Globe, ShieldCheck, Copy, Share2, RefreshCw, FlipHorizontal, Mic, MicOff, Loader2, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useLiveRTC } from "@/components/live/useLiveRTC";
import { LiveEvents, LiveInputRow, LiveTopBar } from "@/components/live/LiveOverlay";
import PrivacyShield from "@/components/live/PrivacyShield";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function StartLivePage() {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: "", category: "general", is_private: false, anti_capture: true, allow_comments: true, allow_gifts: true });
  const [live, setLive] = useState(null);
  const [starting, setStarting] = useState(false);
  const [stream, setStream] = useState(null);
  const [facing, setFacing] = useState("user");
  const [muted, setMuted] = useState(false);
  const [camError, setCamError] = useState(null);
  const [codePanel, setCodePanel] = useState(false);
  const videoRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { axios.get(`${API}/lives/categories`).then((r) => setCategories(r.data || [])).catch(() => {}); }, []);

  // Resume an already running live (page refresh)
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/lives/mine/active`, { headers }).then((r) => { if (r.data?.id) setLive(r.data); }).catch(() => {});
  }, [token]);

  const openCamera = async (face = facing) => {
    stream?.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: face, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      setStream(s); setCamError(null);
    } catch (e) { setCamError(e?.name === "NotAllowedError" ? "Permite el acceso a cámara y micrófono para transmitir" : "No se pudo acceder a la cámara"); }
  };
  useEffect(() => { openCamera(); return () => stream?.getTracks().forEach((t) => t.stop()); }, []);
  useEffect(() => { if (videoRef.current && stream) videoRef.current.srcObject = stream; }, [stream, live]);
  useEffect(() => { stream?.getAudioTracks().forEach((t) => (t.enabled = !muted)); }, [muted, stream]);

  const flip = () => { const f = facing === "user" ? "environment" : "user"; setFacing(f); openCamera(f); };

  const rtc = useLiveRTC({ liveId: live?.id, token, role: "host", localStream: stream, enabled: !!live });

  const start = async () => {
    if (!form.title.trim()) return brunoToast.error("Ponle un título a tu live");
    if (!stream) return brunoToast.error("Activa la cámara primero");
    setStarting(true);
    try { const r = await axios.post(`${API}/lives`, form, { headers }); setLive(r.data); if (r.data.is_private) setCodePanel(true); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo iniciar el live"); }
    setStarting(false);
  };
  const end = async () => {
    try { await axios.post(`${API}/lives/${live.id}/end`, {}, { headers }); } catch (_) { /* ignore */ }
    stream?.getTracks().forEach((t) => t.stop());
    brunoToast.success("Live finalizado");
    navigate("/lives");
  };
  const rotate = async () => {
    try { const r = await axios.post(`${API}/lives/${live.id}/rotate-code`, {}, { headers }); setLive((l) => ({ ...l, access_code: r.data.access_code })); brunoToast.success("Código renovado"); }
    catch (_) { brunoToast.error("No se pudo renovar"); }
  };
  const copyCode = async () => { try { await navigator.clipboard.writeText(live.access_code); brunoToast.success("Código copiado"); } catch (_) { /* ignore */ } };
  const shareInvite = async () => {
    const url = `${window.location.origin}/lives/${live.id}?code=${live.access_code}`;
    const text = `Únete a mi live privado en BRUNO · Código: ${live.access_code}`;
    if (navigator.share) { try { await navigator.share({ title: "Live privado BRUNO", text, url }); } catch (_) { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(`${text}\n${url}`); brunoToast.success("Invitación copiada"); } catch (_) { /* ignore */ } }
  };

  const stage = (
    <div className="live-stage absolute inset-0 bg-black">
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }} data-testid="live-host-video" />
      {camError && <div className="absolute inset-0 grid place-items-center text-white text-sm text-center px-8">{camError}</div>}
    </div>
  );

  /* ─── EN VIVO ─── */
  if (live) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden" data-testid="live-host-page">
        <PrivacyShield active={!!live.is_private && !!live.anti_capture} label={`BRUNO · ${user?.name || "host"} · anfitrión`}>
          {stage}
        </PrivacyShield>
        <LiveTopBar live={live} viewerCount={rtc.viewerCount} hostOnline={rtc.connected} onClose={end}
          right={live.is_private && <button onClick={() => setCodePanel((v) => !v)} className="h-9 px-3 rounded-full bg-primary text-white text-xs font-bold inline-flex items-center gap-1" data-testid="live-code-toggle"><KeyRound className="w-3.5 h-3.5" /> Código</button>} />

        {/* Host controls */}
        <div className="absolute right-3 z-30 flex flex-col gap-2" style={{ top: "calc(var(--safe-top) + 64px)" }}>
          <button onClick={flip} className="w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-flip-btn"><FlipHorizontal className="w-5 h-5" /></button>
          <button onClick={() => setMuted((m) => !m)} className={`w-10 h-10 rounded-full grid place-items-center ${muted ? "bg-red-500 text-white" : "bg-black/45 text-white"}`} data-testid="live-mute-btn">{muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}</button>
        </div>

        {live.is_private && codePanel && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="absolute left-3 right-3 z-30 bruno-glass rounded-[24px] border p-4" style={{ top: "calc(var(--safe-top) + 64px)", maxWidth: 420 }} data-testid="live-code-panel">
            <div className="flex items-center gap-2 mb-2"><Lock className="w-4 h-4 text-primary" /><p className="text-sm font-semibold">Live privado</p><span className="ml-auto text-[10px] text-muted-foreground inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3 text-emerald-500" /> Anti-captura</span></div>
            <p className="text-[11px] text-muted-foreground mb-2">Solo quien tenga este código puede entrar. Compártelo únicamente con tus invitados.</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-12 rounded-2xl bg-foreground/[0.06] grid place-items-center font-mono text-2xl tracking-[0.35em] font-bold" data-testid="live-access-code">{live.access_code}</div>
              <button onClick={copyCode} className="w-12 h-12 rounded-2xl bg-foreground/[0.06] grid place-items-center" data-testid="live-code-copy"><Copy className="w-5 h-5" /></button>
              <button onClick={shareInvite} className="w-12 h-12 rounded-2xl bg-primary text-white grid place-items-center" data-testid="live-code-share"><Share2 className="w-5 h-5" /></button>
            </div>
            <button onClick={rotate} className="mt-2 text-[11px] text-muted-foreground inline-flex items-center gap-1" data-testid="live-code-rotate"><RefreshCw className="w-3 h-3" /> Generar nuevo código (invalida el anterior)</button>
          </motion.div>
        )}

        <LiveEvents events={rtc.events} hearts={rtc.hearts} />
        <LiveInputRow liveId={live.id} token={token} allowGifts={false} isHost onHeart={rtc.sendHeart} />
      </div>
    );
  }

  /* ─── SETUP ─── */
  return (
    <div className="fixed inset-0 bg-black overflow-hidden" data-testid="live-setup-page">
      {stage}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />
      <div className="absolute inset-x-0 z-30 flex items-center px-3" style={{ top: "calc(var(--safe-top) + 10px)" }}>
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-setup-back"><ArrowLeft className="w-5 h-5" /></button>
        <p className="mx-auto text-white font-bold text-sm inline-flex items-center gap-1.5"><Radio className="w-4 h-4 text-red-500" /> Nuevo live</p>
        <button onClick={flip} className="w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-setup-flip"><FlipHorizontal className="w-5 h-5" /></button>
      </div>

      <div className="absolute inset-x-3 z-30 bruno-glass rounded-[28px] border p-4 space-y-3" style={{ bottom: "calc(var(--safe-bottom) + 16px)", maxWidth: 480, marginInline: "auto" }} data-testid="live-setup-card">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={80} placeholder="Título del live"
          className="w-full h-11 rounded-2xl bg-foreground/[0.06] px-4 text-sm outline-none focus:ring-2 ring-primary/40" data-testid="live-title-input" />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {categories.map((c) => (
            <button key={c.id} onClick={() => setForm({ ...form, category: c.id })} className={`shrink-0 h-8 px-3 rounded-full text-xs font-medium ${form.category === c.id ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid={`live-category-${c.id}`}>{c.name}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setForm({ ...form, is_private: false })} className={`h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold ${!form.is_private ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-visibility-public"><Globe className="w-4 h-4" /> Público</button>
          <button onClick={() => setForm({ ...form, is_private: true })} className={`h-12 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold ${form.is_private ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid="live-visibility-private"><Lock className="w-4 h-4" /> Privado</button>
        </div>
        {form.is_private && (
          <label className="flex items-center gap-3 rounded-2xl bg-foreground/[0.05] p-3 cursor-pointer" data-testid="live-anticapture-row">
            <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex-1 leading-tight"><p className="text-sm font-semibold">Protección anti-captura</p><p className="text-[11px] text-muted-foreground">Código de acceso · marca de agua · bloqueo de capturas (app nativa)</p></div>
            <input type="checkbox" checked={form.anti_capture} onChange={(e) => setForm({ ...form, anti_capture: e.target.checked })} className="accent-orange-500 w-5 h-5" data-testid="live-anticapture-toggle" />
          </label>
        )}
        <button onClick={start} disabled={starting || !!camError} className="w-full h-12 rounded-full bg-red-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="live-go-btn">
          {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radio className="w-4 h-4" />} {form.is_private ? "Iniciar live privado" : "Iniciar live"}
        </button>
      </div>
    </div>
  );
}
