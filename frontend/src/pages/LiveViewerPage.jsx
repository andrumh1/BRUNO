/* eslint-disable react-hooks/exhaustive-deps */
/**
 * LiveViewerPage — watch a live (public or private-with-code).
 *  /lives/:liveId[?code=XXXXXX]   ·   /lives/join?code=XXXXXX (resolves the live by code)
 */
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Loader2, Lock, KeyRound, Radio, VolumeX, Volume2, ArrowLeft, Share2, Flag, UserPlus, Check, Pin, WifiOff, Shield } from "lucide-react";
import { useDailyLive } from "@/components/live/useDailyLive";
import LiveModerationSheet from "@/components/live/LiveModerationSheet";
import LiveInteractSheet, { LivePollCard, GuestTiles } from "@/components/live/LiveInteractSheet";
import { Sparkles, Hand } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBrunoCheckout } from "@/hooks/useBrunoCheckout";
import { QuoteCard } from "@/components/money/QuoteCard";
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
  const [ticket, setTicket] = useState(null);
  const checkout = useBrunoCheckout();
  const [muted, setMuted] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [rtcInfo, setRtcInfo] = useState(null);
  const [following, setFollowing] = useState(false);
  const [isMod, setIsMod] = useState(false);
  const [modOpen, setModOpen] = useState(false);
  const [interactOpen, setInteractOpen] = useState(false);
  const [needsGesture, setNeedsGesture] = useState(false);
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
    axios.get(`${API}/lives/${liveId}`, { headers }).then((r) => {
      setLive(r.data); setIsMod(!!r.data.is_moderator);
      if (r.data.is_host) navigate("/lives/start", { replace: true });
      if (r.data.host_id) axios.get(`${API}/users/${r.data.host_id}/profile`, { headers }).then((p) => setFollowing(!!p.data?.is_following)).catch(() => {});
    }).catch(() => setNotFound(true)).finally(() => setLoading(false));
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
      setIsMod(!!r.data.is_moderator);
      setRtcInfo(r.data.rtc || null);
      setJoined(true);
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (e?.response?.status === 402 && d?.code === "ticket_required") { setTicket({ price_minor: d.price_minor, currency: d.currency }); const q = await checkout.getQuote({ kind: "live_ticket", ref_id: liveId }); if (!q) setTicket(null); }
      else brunoToast.error((typeof d === "string" ? d : d?.message) || "No se pudo entrar al live");
    }
    setJoining(false);
  };
  // Auto-join after returning from a paid ticket checkout
  useEffect(() => { if (params.get("paid") === "1" && live && !joined) { join(); } /* eslint-disable-next-line */ }, [live?.id]);

  const rtc = useLiveRTC({ liveId, token, role: "viewer", accessCode: live?.requires_code ? code : null, enabled: joined && !!live });
  const asGuest = rtc.guestStatus === "accepted" && !!rtc.guestRtc?.token;
  const daily = useDailyLive({ url: asGuest ? rtc.guestRtc.url : rtcInfo?.url, token: asGuest ? rtc.guestRtc.token : rtcInfo?.token, role: asGuest ? "guest" : "viewer", hostId: live?.host_id, enabled: joined && !!(asGuest || rtcInfo) });
  useEffect(() => { if (rtc.guestStatus === "accepted") brunoToast.success("¡Estás en el live!", { description: "Tu cámara y micrófono ahora se transmiten." }); if (rtc.guestStatus === "rejected") brunoToast.info?.("El anfitrión no aceptó tu solicitud"); }, [rtc.guestStatus]);
  const remoteStream = daily.remoteStream;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.srcObject = remoteStream || null;
    if (!remoteStream) return;
    const kick = () => v.play().then(() => setNeedsGesture(false)).catch(() => setNeedsGesture(true));
    kick();
    const t = setTimeout(kick, 400);
    v.addEventListener("loadedmetadata", kick);
    return () => { clearTimeout(t); v.removeEventListener("loadedmetadata", kick); };
  }, [remoteStream, muted]);
  useEffect(() => { if (rtc.ended) { brunoToast.info?.("El live ha terminado"); setTimeout(() => navigate("/lives"), 1200); } }, [rtc.ended]);
  useEffect(() => { if (rtc.kicked) { setJoined(false); } }, [rtc.kicked]);

  const toggleFollow = async () => {
    if (!live?.host_id) return;
    const next = !following; setFollowing(next);
    try { await axios.post(`${API}/users/${live.host_id}/follow`, {}, { headers }); brunoToast.success(next ? `Ahora sigues a ${live.host_name}` : "Dejaste de seguir"); }
    catch (_) { setFollowing(!next); brunoToast.error("No se pudo actualizar"); }
  };
  const shareLive = async () => {
    const url = `${window.location.origin}/lives/${liveId}${live?.requires_code && code ? `?code=${code}` : ""}`;
    if (navigator.share) { try { await navigator.share({ title: live?.title || "Live en BRUNO", text: `${live?.host_name} está en vivo en BRUNO`, url }); return; } catch (_) { /* cancelado */ } }
    try { await navigator.clipboard.writeText(url); brunoToast.success("Enlace copiado"); } catch (_) { brunoToast.error("No se pudo copiar"); }
  };
  const reportLive = async () => {
    const reason = window.prompt("¿Por qué reportas este live? (spam, acoso, contenido inapropiado, otro)");
    if (!reason) return;
    try { await axios.post(`${API}/reports`, { content_type: "live", content_id: liveId, reason: reason.trim().slice(0, 200) }, { headers }); brunoToast.success("Reporte enviado. Gracias por ayudar a cuidar BRUNO"); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo enviar el reporte"); }
  };
  useEffect(() => { if (rtc.denied) { setJoined(false); brunoToast.error("Código de acceso rechazado"); } }, [rtc.denied]);
  useEffect(() => () => { if (joined && token) axios.post(`${API}/lives/${liveId}/leave`, {}, { headers }).catch(() => {}); }, [joined]);

  if (isJoinRoute || loading || authLoading) return <div className="fixed inset-0 bg-black grid place-items-center"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>;

  if (rtc.kicked) {
    return (
      <div className="fixed inset-0 bg-black grid place-items-center text-white p-8" data-testid="live-kicked-page">
        <div className="text-center"><Shield className="w-10 h-10 mx-auto mb-3 text-white/60" /><p className="font-bold">El anfitrión te expulsó de este live</p>
          <button onClick={() => navigate("/lives")} className="mt-4 px-5 h-10 rounded-full bg-white text-black text-sm font-semibold">Ver otros lives</button></div>
      </div>
    );
  }

  if (notFound || (live && live.status !== "live")) {
    return (
      <div className="fixed inset-0 bg-black grid place-items-center text-white p-8" data-testid="live-ended-page">
        <div className="text-center"><Radio className="w-10 h-10 mx-auto mb-3 text-white/60" /><p className="font-bold">Este live ha terminado</p>
          <button onClick={() => navigate("/lives")} className="mt-4 px-5 h-10 rounded-full bg-white text-black text-sm font-semibold">Ver otros lives</button></div>
      </div>
    );
  }

  /* Paid ticket gate — access is only granted server-side after the payment is confirmed */
  if (ticket && !joined) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden" data-testid="live-ticket-gate">
        <button onClick={() => navigate(-1)} className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/45 text-white grid place-items-center" style={{ top: "calc(var(--safe-top) + 10px)" }} aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
        <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 bruno-glass rounded-[28px] border p-5 text-center space-y-3" style={{ maxWidth: 420, marginInline: "auto" }}>
          <div className="w-14 h-14 mx-auto rounded-full bg-primary/15 grid place-items-center"><Lock className="w-6 h-6 text-primary" /></div>
          <p className="font-bold">Live privado de pago</p>
          <p className="text-sm text-muted-foreground">{live?.host_name} cobra entrada para este live. El acceso se activa solo cuando el pago está confirmado.</p>
          <QuoteCard quote={checkout.quote} busy={checkout.busy} cta="Comprar entrada" onPay={() => checkout.pay({ kind: "live_ticket", ref_id: liveId })} />
        </div>
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
          {!remoteStream && <LiveWaitingRoom live={live} viewerCount={rtc.viewerCount} hostOnline={rtc.hostOnline && daily.state !== "error"} />}
          {!remoteStream && !rtcInfo && joined && <div className="absolute inset-x-6 bottom-40 z-20 rounded-2xl bg-black/60 text-white text-xs p-3 text-center" data-testid="live-no-rtc">El servidor de video no está configurado (DAILY_API_KEY). Solo chat disponible.</div>}
        </div>
      </PrivacyShield>
      {rtc.recording && <div className="absolute left-3 z-30 h-7 px-2.5 rounded-full bg-red-600 text-white text-[11px] font-bold inline-flex items-center gap-1.5" style={{ top: "calc(var(--safe-top) + 64px)" }} data-testid="live-viewer-rec-banner"><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> REC · Este live se está grabando</div>}

      <LiveTopBar live={live} viewerCount={rtc.viewerCount} hostOnline={rtc.hostOnline} onClose={() => navigate(-1)}
        right={<div className="flex items-center gap-1.5">
          {live?.host_id !== user?.id && <button onClick={toggleFollow} className={`h-9 px-3 rounded-full text-xs font-bold inline-flex items-center gap-1 ${following ? "bg-white/20 text-white" : "bg-primary text-white"}`} data-testid="live-follow-btn" aria-pressed={following}>{following ? <Check className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}{following ? "Siguiendo" : "Seguir"}</button>}
          <button onClick={shareLive} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-share-btn" aria-label="Compartir"><Share2 className="w-4 h-4" /></button>
          {isMod && <button onClick={() => setModOpen(true)} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-viewer-moderation-btn" aria-label="Moderación"><Shield className="w-4 h-4" /></button>}
          <button onClick={reportLive} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-report-btn" aria-label="Reportar"><Flag className="w-4 h-4" /></button>
          <button onClick={() => setMuted((m) => !m)} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-viewer-mute">{muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}</button>
        </div>} />
      {(daily.state === "interrupted" || rtc.reconnecting) && <div className="absolute inset-x-0 z-30 flex justify-center" style={{ top: "calc(var(--safe-top) + 60px)" }}><span className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full bg-amber-500/90 text-black text-xs font-semibold" data-testid="live-reconnecting"><WifiOff className="w-3.5 h-3.5" /> Conexión inestable · reconectando…</span></div>}
      {rtc.pinned && <div className="absolute left-3 right-3 z-20 rounded-2xl bg-primary/90 text-white px-3 py-2 text-xs flex items-start gap-2" style={{ top: "calc(var(--safe-top) + 96px)" }} data-testid="live-pinned-bar"><Pin className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span className="truncate"><b>{rtc.pinned.user_name}</b>: {rtc.pinned.text}</span></div>}
      {remoteStream && (muted || needsGesture) && <button onClick={(e) => { e.stopPropagation(); setMuted(false); videoRef.current?.play().catch(() => {}); }} className="absolute inset-x-0 top-1/2 z-20 text-center" data-testid="live-enable-audio"><span className="px-4 py-2 rounded-full bg-black/60 text-white text-xs font-semibold inline-flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /> Toca para activar el sonido</span></button>}
      <GuestTiles participants={daily.remoteParticipants} />
      {asGuest && daily.localStream && <div className="absolute left-3 z-20 w-24 h-32 rounded-2xl overflow-hidden ring-2 ring-emerald-400" style={{ top: "calc(var(--safe-top) + 150px)" }} data-testid="live-my-guest-tile"><video autoPlay playsInline muted ref={(el) => { if (el && el.srcObject !== daily.localStream) { el.srcObject = daily.localStream; el.play?.().catch(() => {}); } }} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} /><span className="absolute bottom-1 left-1 text-[10px] text-white">Tú</span></div>}
      {rtc.poll?.id && <LivePollCard poll={rtc.poll} liveId={liveId} token={token} canModerate={isMod} onClose={() => rtc.setPoll(null)} />}
      <button onClick={() => setInteractOpen(true)} className="absolute right-3 z-30 h-10 px-3 rounded-full bg-black/55 text-white text-xs font-semibold inline-flex items-center gap-1.5" style={{ bottom: "calc(var(--safe-bottom) + 76px)" }} data-testid="live-interact-btn">{rtc.guestStatus === "pending" ? <Hand className="w-4 h-4 animate-pulse" /> : <Sparkles className="w-4 h-4" />}{rtc.guestStatus === "pending" ? "Esperando…" : "Participar"}</button>
      {interactOpen && <LiveInteractSheet live={live} token={token} rtc={rtc} canModerate={isMod} isHost={false} userId={user?.id} onClose={() => setInteractOpen(false)} />}
      <LiveEvents events={rtc.events} hearts={rtc.hearts} />
      <LiveInputRow liveId={liveId} token={token} allowGifts={live?.allow_gifts} allowComments={rtc.settings.allow_comments ?? live?.allow_comments} onHeart={rtc.sendHeart} />
      {modOpen && <LiveModerationSheet live={live} events={rtc.events} pinned={rtc.pinned} mutedIds={rtc.mutedIds} isHost={false} token={token} onClose={() => setModOpen(false)} onLiveChange={(patch) => setLive((l) => ({ ...l, ...patch }))} />}
    </div>
  );
}
