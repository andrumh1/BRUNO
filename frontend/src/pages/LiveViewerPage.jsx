/* eslint-disable react-hooks/exhaustive-deps */
/**
 * LiveViewerPage — watch a live (public or private-with-code).
 *  /lives/:liveId[?code=XXXXXX]   ·   /lives/join?code=XXXXXX (resolves the live by code)
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Loader2, Lock, KeyRound, Radio, VolumeX, Volume2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useLiveRTC } from "@/components/live/useLiveRTC";
import { LiveEvents, LiveInputRow, LiveTopBar } from "@/components/live/LiveOverlay";
import PrivacyShield from "@/components/live/PrivacyShield";
import LiveWaitingRoom from "@/components/live/LiveWaitingRoom";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function LiveViewerPage() {
  const { liveId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token, user, isLoading: authLoading } = useAuth();
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState((params.get("code") || "").toUpperCase());
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [muted, setMuted] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const videoRef = useRef(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const isJoinRoute = liveId === "join";

  // Resolve by code when arriving via /lives/join?code=
  useEffect(() => {
    if (!isJoinRoute) return;
    const c = (params.get("code") || "").toUpperCase();
    if (!c) { navigate("/lives"); return; }
    axios.get(`${API}/lives/by-code/${c}`).then((r) => navigate(`/lives/${r.data.id}?code=${c}`, { replace: true })).catch(() => { brunoToast.error("Código inválido o live finalizado"); navigate("/lives"); });
  }, [isJoinRoute]);

  useEffect(() => {
    if (isJoinRoute || authLoading) return;
    if (!token) { navigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; }
    axios.get(`${API}/lives/${liveId}`, { headers }).then((r) => { setLive(r.data); if (r.data.is_host) navigate("/lives/start", { replace: true }); }).catch(() => setNotFound(true)).finally(() => setLoading(false));
  }, [liveId, token, authLoading]);

  // Auto-join when public or when the code came in the URL
  useEffect(() => {
    if (!live || joined || joining) return;
    if (!live.requires_code || code.length === 6) join();
  }, [live]);

  const join = async () => {
    setJoining(true);
    try {
      const r = await axios.post(`${API}/lives/${liveId}/join`, { access_code: code || null }, { headers });
      setLive((l) => ({ ...l, ...r.data.live }));
      setJoined(true);
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo entrar al live"); }
    setJoining(false);
  };

  const rtc = useLiveRTC({ liveId, token, role: "viewer", accessCode: live?.requires_code ? code : null, enabled: joined && !!live });

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = rtc.remoteStream || null;
    if (!rtc.remoteStream) return;
    rtc.remoteStream.getTracks().forEach((t) => { t.enabled = true; });
    const kick = () => v.play().catch(() => {});
    kick();
    const t = setTimeout(kick, 400);
    v.addEventListener("loadedmetadata", kick);
    return () => { clearTimeout(t); v.removeEventListener("loadedmetadata", kick); };
  }, [rtc.remoteStream]);
  useEffect(() => { if (rtc.ended) { brunoToast.info?.("El live ha terminado"); setTimeout(() => navigate("/lives"), 1200); } }, [rtc.ended]);
  useEffect(() => { if (rtc.denied) { setJoined(false); brunoToast.error("Código de acceso rechazado"); } }, [rtc.denied]);
  useEffect(() => () => { if (joined && token) axios.post(`${API}/lives/${liveId}/leave`, {}, { headers }).catch(() => {}); }, [joined]);

  if (isJoinRoute || loading || authLoading) return <div className="fixed inset-0 bg-black grid place-items-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>;

  if (notFound || (live && live.status !== "live")) {
    return (
      <div className="fixed inset-0 bg-black grid place-items-center text-white p-8" data-testid="live-ended-page">
        <div className="text-center"><Radio className="w-10 h-10 mx-auto mb-3 text-white/60" /><p className="font-bold">Este live ha terminado</p>
          <button onClick={() => navigate("/lives")} className="mt-4 px-5 h-10 rounded-full bg-white text-black text-sm font-semibold">Ver otros lives</button></div>
      </div>
    );
  }

  /* Private gate */
  if (live?.requires_code && !joined) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden" data-testid="live-code-gate">
        <div className="absolute inset-0 bg-center bg-cover opacity-30" style={{ backgroundImage: live.host_avatar ? `url(${live.host_avatar})` : undefined, filter: "blur(28px)" }} />
        <button onClick={() => navigate(-1)} className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" style={{ top: "calc(var(--safe-top) + 10px)" }} data-testid="live-gate-back"><ArrowLeft className="w-5 h-5" /></button>
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bruno-glass rounded-[28px] border p-6 text-center" style={{ maxWidth: 400, marginInline: "auto" }}>
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 grid place-items-center mb-3"><Lock className="w-6 h-6 text-primary" /></div>
          <p className="font-bold">Live privado</p>
          <p className="text-sm text-muted-foreground mt-1">{live.host_name} está transmitiendo en privado. Ingresa el código que te compartió.</p>
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))} maxLength={6} placeholder="••••••"
            className="mt-4 w-full h-14 rounded-2xl bg-foreground/[0.06] text-center font-mono text-2xl tracking-[0.4em] outline-none focus:ring-2 ring-primary/40" data-testid="live-gate-code-input" />
          <button onClick={join} disabled={joining || code.length !== 6} className="mt-3 w-full h-12 rounded-full bg-primary text-white font-semibold text-sm inline-flex items-center justify-center gap-2 disabled:opacity-50" data-testid="live-gate-join-btn">
            {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />} Entrar al live
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden" data-testid="live-viewer-page">
      <PrivacyShield active={!!live?.is_private && !!live?.anti_capture} label={`BRUNO · ${user?.name || user?.email || "viewer"} · ${new Date().toLocaleTimeString()}`}>
        <div className="live-stage absolute inset-0 bg-black" onClick={() => setMuted((m) => !m)}>
          <video ref={videoRef} autoPlay playsInline muted={muted} className="absolute inset-0 w-full h-full object-cover" disablePictureInPicture controlsList="nodownload noremoteplayback" data-testid="live-remote-video" />
          {!rtc.remoteStream && <LiveWaitingRoom live={live} viewerCount={rtc.viewerCount} hostOnline={rtc.hostOnline} />}
        </div>
      </PrivacyShield>

      <LiveTopBar live={live} viewerCount={rtc.viewerCount} hostOnline={rtc.hostOnline} onClose={() => navigate(-1)}
        right={<button onClick={() => setMuted((m) => !m)} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-viewer-mute">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>} />
      {muted && rtc.remoteStream && <div className="absolute inset-x-0 top-1/2 z-20 text-center pointer-events-none"><span className="px-3 py-1 rounded-full bg-black/50 text-white text-xs">Toca para activar el sonido</span></div>}
      <LiveEvents events={rtc.events} hearts={rtc.hearts} />
      <LiveInputRow liveId={liveId} token={token} allowGifts={live?.allow_gifts} onHeart={rtc.sendHeart} />
    </div>
  );
}
