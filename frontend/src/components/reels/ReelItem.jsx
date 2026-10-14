/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChaptersStrip, useResume, getChapters, isLongVideo, fmtClock } from "@/components/reels/LongVideoExtras";
import { Clapperboard } from "lucide-react";
import { Heart, MessageCircle, Music2, Play, User, Plus, Minimize2, Maximize2, RotateCcw, Scissors, Columns2, MoreHorizontal } from "lucide-react";
import ReelTextCard from "@/components/reels/ReelTextCard";
import ReelCarousel from "@/components/reels/ReelCarousel";
import ReelPlaybackControls from "@/components/reels/ReelPlaybackControls";
import ReelScrubPreview from "@/components/reels/ReelScrubPreview";
import ReelMinimizeMenu from "@/components/reels/ReelMinimizeMenu";

const RATE_KEY = "bruno_reel_rate";
const loadRate = () => { try { const r = parseFloat(localStorage.getItem(RATE_KEY)); return [1, 1.5, 2].includes(r) ? r : 1; } catch { return 1; } };

const fmtTime = (s) => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; };
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

/**
 * ReelItem — one full-screen reel. TikTok-grade playback + gestures.
 *  • isActive → play (retry muted if autoplay blocked); neighbors preload.
 *  • Tap = play/pause + controles (−10 · ▶︎ · +10 · sonido) · Double-tap centro = like · Double-tap lados = ±10 s.
 *  • Long-press = pause · Swipe L/R.
 *  • Bottom progress bar with drag-to-seek.
 */
export default function ReelItem({
  reel, isActive, isNear, globalMuted, onToggleMute, onLike, onFollow,
  onOpenComments, onOpenRemixes, onOpenSound, onOpenLikers, onOpenOptions, onSwipeLeft, onSwipeRight, onMinimize, hideChrome, currentUserId,
  longMode = false, onOpenChapters, token, noLoop = false, onEnded,
}) {
  const [expanded, setExpanded] = useState(false);
  const videoRef = useRef(null);
  const navigate = useNavigate();
  const chapters = longMode ? getChapters(reel) : [];
  const resume = useResume({ reel, videoRef, token, enabled: longMode || !!reel?.video_url });
  // "Continuar viendo": al dejar de estar activo guarda el punto exacto (cortos y largos)
  useEffect(() => { if (!isActive) { const v = videoRef.current; if (v && v.duration && v.currentTime > 3) resume.onProgress(v.currentTime, v.duration, true); } }, [isActive]); // eslint-disable-line
  const seekAbs = (t) => { const v = videoRef.current; if (!v) return; v.currentTime = Math.max(0, Math.min(t, (v.duration || t) - 0.05)); v.play?.().catch(() => {}); };
  const barRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [burst, setBurst] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const autoRetries = useRef(0);
  const retryTimer = useRef(null);
  const touch = useRef({ x: 0, y: 0, t: 0, lastTap: 0 });
  const stageRef = useRef(null);
  const tapTimer = useRef(null);
  const hideTimer = useRef(null);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [seekHint, setSeekHint] = useState(null);
  const [time, setTime] = useState({ cur: 0, dur: 0 });
  const [rate, setRate] = useState(loadRate);
  const [boosting, setBoosting] = useState(false);
  const rateRef = useRef(rate);
  const [scrub, setScrub] = useState(null);
  const [minOpen, setMinOpen] = useState(false);
  const [landscape, setLandscape] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  // 16:9 → pantalla completa girada (como Facebook); al salir se restaura la orientación.
  const toggleFullscreen = async () => {
    const v = videoRef.current, stage = stageRef.current;
    if (!v) return;
    try {
      if (document.fullscreenElement || v.webkitDisplayingFullscreen) {
        if (document.exitFullscreen) await document.exitFullscreen(); else v.webkitExitFullscreen?.();
        try { window.screen.orientation?.unlock?.(); } catch (_) { /* ignore */ }
        setFullscreen(false);
        return;
      }
      const target = stage?.requestFullscreen ? stage : v;
      if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: "hide" });
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
      if (landscape) { try { await window.screen.orientation?.lock?.("landscape"); } catch (_) { /* iOS no permite bloquear */ } }
      setFullscreen(true);
      if (v.paused) v.play().catch(() => {});
    } catch (_) { /* sin soporte */ }
  };
  useEffect(() => {
    const onFs = () => { if (!document.fullscreenElement) { setFullscreen(false); try { window.screen.orientation?.unlock?.(); } catch (_) { /* ignore */ } } };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const nativePipSupported = typeof document !== "undefined" && (!!document.pictureInPictureEnabled || typeof videoRef.current?.webkitSetPresentationMode === "function");
  const pickMinimize = async (mode) => {
    setMinOpen(false);
    const v = videoRef.current;
    if (mode === "native" && v) {
      try {
        if (v.requestPictureInPicture) await v.requestPictureInPicture();
        else if (v.webkitSetPresentationMode) v.webkitSetPresentationMode("picture-in-picture");
        if (v.paused) v.play().catch(() => {});
        return;
      } catch (_) { /* cae a ventana flotante */ }
      mode = "float";
    }
    onMinimize?.(reel, mode);
  };
  const longPress = useRef(null);
  const pausedByHold = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.muted = globalMuted;
      v.playbackRate = rateRef.current;
      const p = v.play();
      p?.then(() => setIsPlaying(true)).catch(() => {
        if (!v.muted) { v.muted = true; v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false)); }
        else setIsPlaying(false);
      });
    } else {
      try { v.pause(); v.currentTime = 0; } catch (_) { /* ignore */ }
      setIsPlaying(false); setProgress(0);
    }
  }, [isActive, globalMuted, retryKey]);

  useEffect(() => () => { clearTimeout(retryTimer.current); clearTimeout(tapTimer.current); clearTimeout(hideTimer.current); }, []);

  // Pausa al enviar la app a segundo plano / cambiar de pestaña; reanuda solo el reel activo.
  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current; if (!v) return;
      if (document.hidden) { v.pause(); setIsPlaying(false); }
      else if (isActive) v.play().then(() => setIsPlaying(true)).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("pagehide", onVis); };
  }, [isActive]);
  useEffect(() => { if (!isActive) { setControlsVisible(false); clearTimeout(hideTimer.current); } }, [isActive]);

  const showControls = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  };
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {}); else { v.pause(); setIsPlaying(false); }
    showControls();
  };
  const seekBy = (delta) => {
    const v = videoRef.current;
    if (!v) return;
    if (v.duration) {
      v.currentTime = Math.min(v.duration - 0.05, Math.max(0, v.currentTime + delta));
      setProgress((v.currentTime / v.duration) * 100);
    }
    setSeekHint({ side: delta < 0 ? "left" : "right", id: Date.now() });
    setTimeout(() => setSeekHint(null), 650);
    if (controlsVisible) showControls();
  };
  const cycleRate = () => {
    const next = rate >= 2 ? 1 : rate === 1 ? 1.5 : 2;
    rateRef.current = next; setRate(next);
    try { localStorage.setItem(RATE_KEY, String(next)); } catch { /* ignore */ }
    if (videoRef.current) videoRef.current.playbackRate = next;
    showControls();
  };
  const startBoost = () => {
    const v = videoRef.current;
    if (!v) return;
    setBoosting(true); v.playbackRate = 2;
    if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {});
  };
  const stopBoost = () => {
    setBoosting(false);
    if (videoRef.current) videoRef.current.playbackRate = rateRef.current;
  };

  // Freshly uploaded videos return 423 from Cloudinary while transcoding → auto-retry with backoff.
  const handleVideoError = (e) => {
    const v = e.currentTarget;
    if (!(v?.networkState === 3 && v.readyState === 0)) return;
    if (autoRetries.current < 5) {
      autoRetries.current += 1;
      setProcessing(true);
      clearTimeout(retryTimer.current);
      retryTimer.current = setTimeout(() => setRetryKey((k) => k + 1), 2500 * autoRetries.current);
      return;
    }
    setProcessing(false);
    setError(true);
  };

  const seekTo = (clientX) => {
    const v = videoRef.current; const bar = barRef.current;
    if (!v || !bar || !v.duration) return;
    const r = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = pct * v.duration; setProgress(pct * 100);
  };
  const barPct = (clientX) => {
    const bar = barRef.current; if (!bar) return 0;
    const r = bar.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const scrubMove = (clientX) => {
    const v = videoRef.current; if (!v?.duration) return;
    const pct = barPct(clientX);
    setScrub({ pct, time: pct * v.duration }); setProgress(pct * 100);
  };
  const scrubEnd = (clientX) => { if (clientX != null) seekTo(clientX); setScrub(null); showControls(); };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { ...touch.current, x: t.clientX, y: t.clientY, t: Date.now() };
    const w = stageRef.current?.clientWidth || window.innerWidth;
    const rightZone = t.clientX > w * 0.7;
    longPress.current = setTimeout(() => {
      const v = videoRef.current;
      if (!v || !src) return;
      if (rightZone) { pausedByHold.current = "boost"; startBoost(); return; }
      if (!v.paused) { v.pause(); setIsPlaying(false); pausedByHold.current = true; }
    }, 380);
  };
  const onTouchMove = (e) => {
    if (longPress.current && Math.abs(e.touches[0].clientY - touch.current.y) > 8) { clearTimeout(longPress.current); longPress.current = null; }
  };
  const onTouchEnd = (e) => {
    clearTimeout(longPress.current); longPress.current = null;
    const c = e.changedTouches[0];
    const dx = c.clientX - touch.current.x, dy = c.clientY - touch.current.y, dt = Date.now() - touch.current.t;
    if (pausedByHold.current === "boost") { pausedByHold.current = false; stopBoost(); return; }
    if (pausedByHold.current) { pausedByHold.current = false; videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {}); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 280) return handleTap(c.clientX, c.clientY);
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? onSwipeLeft : onSwipeRight)?.(reel);
  };
  // Single tap is deferred ~260 ms so a double tap on the sides (±10 s) or centre (like) never toggles playback.
  const handleTap = (x, y) => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current); tapTimer.current = null;
      const w = stageRef.current?.clientWidth || window.innerWidth;
      const zone = x < w * 0.3 ? "left" : x > w * 0.7 ? "right" : "center";
      if (src && zone !== "center") return seekBy(zone === "left" ? -10 : 10);
      if (!reel.is_liked) onLike?.(reel, true);
      setBurst({ x, y }); setTimeout(() => setBurst(null), 700);
      return;
    }
    tapTimer.current = setTimeout(() => { tapTimer.current = null; if (src) togglePlay(); }, 260);
  };

  const src = reel.video_url;
  const sources = [...new Set([reel.mp4_url, reel.f_auto_url, reel.original_url, src].filter(Boolean))];
  const authorId = reel.author?.id || reel.user_id;
  const isOwn = !!currentUserId && authorId === currentUserId;
  const caption = reel.content || reel.description || "";
  const renderCaption = (text) => text.split(/(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_.]+)/u).map((part, i) => {
    if (/^#/.test(part)) return <Link key={i} to={`/hashtag/${part.slice(1)}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto font-semibold text-white hover:underline" data-testid="reel-hashtag-link">{part}</Link>;
    if (/^@/.test(part)) return <Link key={i} to={`/u/${part.slice(1)}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto font-semibold text-white hover:underline" data-testid="reel-mention-link">{part}</Link>;
    return part;
  });

  return (
    <div
      ref={stageRef}
      className="reels-stage reels-surface relative h-full w-full snap-start snap-always overflow-hidden select-none"
      data-testid={`reel-item-${reel.id}`}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onClick={(e) => { if (!("ontouchstart" in window)) handleTap(e.clientX, e.clientY); }}
      onMouseDown={(e) => { if ("ontouchstart" in window || !src) return; const w = stageRef.current?.clientWidth || 1; if (e.clientX > w * 0.7) longPress.current = setTimeout(startBoost, 380); }}
      onMouseUp={() => { if ("ontouchstart" in window) return; clearTimeout(longPress.current); longPress.current = null; if (boosting) stopBoost(); }}
      onMouseLeave={() => { if (boosting) stopBoost(); }}
    >
      {/* Blurred backdrop so portrait/landscape mixes look premium */}
      {(reel.poster_url || reel.thumbnail_url) && (
        <div className="absolute inset-0 bg-center bg-cover scale-110 opacity-60" style={{ backgroundImage: `url(${reel.poster_url || reel.thumbnail_url})`, filter: "blur(30px)" }} />
      )}

      {src ? (
        <video
          key={retryKey}
          ref={videoRef}
          className={`absolute inset-0 h-full w-full ${landscape || fullscreen ? "object-contain" : "object-cover"}`}
          data-landscape={landscape ? "true" : "false"}
          loop={!noLoop} playsInline muted={globalMuted}
          onEnded={() => onEnded?.()}
          preload={isActive || isNear ? "auto" : "metadata"}
          poster={reel.poster_url || reel.thumbnail_url || undefined}
          onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) { setProgress((v.currentTime / v.duration) * 100); setTime({ cur: v.currentTime, dur: v.duration }); if (isActive) resume.onProgress(v.currentTime, v.duration); } }}
          onLoadedMetadata={(e) => { const v = e.currentTarget; setTime({ cur: v.currentTime, dur: v.duration || 0 }); v.playbackRate = rateRef.current; setLandscape(v.videoWidth > v.videoHeight); resume.applyResume(); }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setError(false); setProcessing(false); autoRetries.current = 0; }}
          onCanPlay={() => { setBuffering(false); setProcessing(false); }}
          onError={handleVideoError}
          data-testid={`reel-video-${reel.id}`}
        >
          {reel.hls_url && <source src={reel.hls_url} type="application/vnd.apple.mpegurl" data-testid="reel-hls-source" />}
          {sources.map((s) => <source key={s} src={s} type={/\.(webm)(\?|$)/i.test(s) ? "video/webm" : "video/mp4"} />)}
        </video>
      ) : reel.image_url || reel.thumbnail_url ? (
        <ReelCarousel reel={reel} images={[...new Set([reel.image_url || reel.thumbnail_url, ...(reel.media || []).filter((m) => m.type === "image" && m.url).map((m) => m.url)])]} />
      ) : (
        <ReelTextCard reel={reel} />
      )}

      {/* Play glyph / buffering / error */}
      {src && !isPlaying && !error && !processing && !controlsVisible && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none" data-testid="reel-paused-glyph">
          <div className="w-16 h-16 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,.45)] grid place-items-center reel-chrome"><Play className="w-8 h-8 text-white fill-white ml-1" /></div>
        </div>
      )}
      {src && landscape && !fullscreen && !controlsVisible && !error && (
        <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); toggleFullscreen(); }}
          className="absolute right-3 z-20 inline-flex items-center gap-1.5 h-8 px-3 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/35 text-white text-[11px] font-semibold reel-chrome active:scale-95"
          style={{ top: "calc(var(--safe-top) + 56px)" }} data-testid="reel-landscape-chip" aria-label="Ver en pantalla completa girando el teléfono">
          <Maximize2 className="w-3.5 h-3.5" /> Pantalla completa
        </button>
      )}
      {src && !error && !processing && (
        <ReelPlaybackControls
          visible={controlsVisible} isPlaying={isPlaying} muted={globalMuted} seekHint={seekHint} rate={rate} boosting={boosting} landscape={landscape} fullscreen={fullscreen} onFullscreen={toggleFullscreen}
          onToggle={togglePlay} onSeek={seekBy} onToggleMute={() => { onToggleMute(); showControls(); }} onCycleRate={cycleRate}
        />
      )}
      {processing && !error && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none" data-testid="reel-processing">
          <div className="flex flex-col items-center gap-2 text-white text-xs">
            <div className="h-9 w-9 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Procesando video…
          </div>
        </div>
      )}
      {buffering && isPlaying && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full border-2 border-white/30 border-t-white animate-spin pointer-events-none" />
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center">
          <button onClick={(e) => { e.stopPropagation(); setError(false); autoRetries.current = 0; setRetryKey((k) => k + 1); }} className="flex flex-col items-center gap-2 text-white text-xs" data-testid="reel-retry-btn">
            <RotateCcw className="w-6 h-6" /> No se pudo cargar · Reintentar
          </button>
        </div>
      )}
      {burst && (
        <div className="absolute pointer-events-none" style={{ left: burst.x - 48, top: burst.y - 48 }}>
          <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-ping-once" style={{ filter: "drop-shadow(0 0 12px rgba(255,0,80,.6))" }} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#474747]/90 via-[#474747]/35 to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-[#474747]/45 to-transparent pointer-events-none" />

      {!hideChrome && (
        <>
          {/* Right rail */}
          <div className="absolute right-2 flex flex-col items-center gap-4 z-10" style={{ bottom: "calc(var(--nav-reserve, 96px) + 118px)" }}>
            <div className="relative mb-1">
              <Link to={`/profile/${authorId}`} onClick={(e) => e.stopPropagation()} className="block w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-zinc-800" data-testid="reel-author-avatar">
                {reel.author?.avatar_url ? <img src={reel.author.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-white"><User className="w-5 h-5" /></div>}
              </Link>
              {!isOwn && !reel.is_following && (
              <button
                onClick={(e) => { e.stopPropagation(); onFollow?.(reel); }}
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full grid place-items-center border border-white/60 bg-primary text-white"
                data-testid="reel-follow-btn" aria-label="Seguir"
              >
                <Plus className="w-3 h-3" strokeWidth={3} />
              </button>
              )}
            </div>

            <Rail icon={<Heart className={`w-7 h-7 ${reel.is_liked ? "text-red-500 fill-red-500 scale-110" : "text-white"} transition-all`} />} label={fmt(reel.likes_count)} testid="reel-like-btn" onClick={() => onLike?.(reel, !reel.is_liked)} onLabelClick={() => onOpenLikers?.(reel)} labelTestid="reel-likes-count" />
            <Rail icon={<MessageCircle className="w-7 h-7 text-white" />} label={fmt(reel.comments_count)} testid="reel-comments-btn" onClick={() => onOpenComments?.(reel)} />
            <Rail icon={<Minimize2 className="w-6 h-6 text-white" />} label="PiP" testid="reel-minimize-btn" onClick={() => setMinOpen(true)} />
            <Rail icon={<MoreHorizontal className="w-6 h-6 text-white" />} label="Más" testid="reel-more-btn" onClick={() => onOpenOptions?.(reel)} />
            {src && (
            <button onClick={(e) => { e.stopPropagation(); onOpenSound?.(reel); }} className="mt-1 w-11 h-11 rounded-full bg-zinc-900 border-[3px] border-zinc-700 grid place-items-center overflow-hidden reel-disc active:scale-90" style={{ animationPlayState: isPlaying ? "running" : "paused" }} data-testid="reel-sound-disc" aria-label="Sonido">
              {reel.author?.avatar_url ? <img src={reel.author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" /> : <Music2 className="w-4 h-4 text-white" />}
            </button>
            )}
          </div>

          {/* Caption: creador + Seguir → audio → descripción */}
          <div className="absolute left-3 right-20 z-10 pointer-events-none" style={{ bottom: "calc(var(--nav-reserve, 96px) + 84px)" }} data-testid="reel-caption">
            <div className="flex items-center gap-2 min-w-0">
              <Link to={`/profile/${authorId}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto text-white font-bold text-[15px] drop-shadow truncate" data-testid="reel-author-name">
                @{reel.author?.username || reel.author?.name || "usuario"}
              </Link>
              {!isOwn && (
                <button onClick={(e) => { e.stopPropagation(); onFollow?.(reel); }} className={`pointer-events-auto shrink-0 h-6 px-2.5 rounded-md text-[11px] font-semibold border transition-colors ${reel.is_following ? "border-white/40 text-white/90 bg-white/10" : "border-white/70 text-white"}`} data-testid="reel-follow-pill" aria-pressed={!!reel.is_following}>
                  {reel.is_following ? "Siguiendo" : "Seguir"}
                </button>
              )}
            </div>
            {reel.remix?.source_post_id && (
              <button onClick={(e) => { e.stopPropagation(); onOpenRemixes?.({ id: reel.remix.source_post_id }); }} className="pointer-events-auto mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-white text-[11px]" data-testid="reel-remix-label">
                {reel.remix.type === "duet" ? <Columns2 className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                {reel.remix.type === "duet" ? "Dúo con" : "Stitch de"} @{reel.remix.source_username}
              </button>
            )}
            {src && (
            <button onClick={(e) => { e.stopPropagation(); onOpenSound?.(reel); }} className="pointer-events-auto flex items-center gap-1.5 mt-1.5 text-white/90 text-[12px] max-w-full drop-shadow" data-testid="reel-sound-label">
              <Music2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{reel.audio_name || `Audio original — ${reel.author?.name || reel.author?.username || "creador"}`}</span>
            </button>
            )}
            {caption && reel.kind !== "text" && (
              <p onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }} className={`pointer-events-auto text-white/95 text-[13px] mt-1.5 drop-shadow whitespace-pre-line ${expanded ? "max-h-[40vh] overflow-y-auto" : "line-clamp-2"}`} data-testid="reel-description" aria-expanded={expanded}>
                {renderCaption(caption)}{!expanded && caption.length > 90 && <span className="text-white/70 font-semibold"> … más</span>}
              </p>
            )}
          </div>

        </>
      )}

      {/* Progress / seek bar */}
      {src && (
        <div
          ref={barRef}
          className="absolute inset-x-0 z-20 h-6 flex items-end cursor-pointer"
          style={{ bottom: "calc(var(--nav-reserve, 64px) - 2px)" }}
          onClick={(e) => { e.stopPropagation(); seekTo(e.clientX); }}
          onTouchStart={(e) => { e.stopPropagation(); scrubMove(e.touches[0].clientX); }}
          onTouchMove={(e) => { e.stopPropagation(); scrubMove(e.touches[0].clientX); }}
          onTouchEnd={(e) => { e.stopPropagation(); scrubEnd(e.changedTouches[0]?.clientX); }}
          onMouseMove={(e) => { if (!("ontouchstart" in window)) { const v = videoRef.current; if (v?.duration) { const pct = barPct(e.clientX); setScrub({ pct, time: pct * v.duration }); } } }}
          onMouseLeave={() => setScrub(null)}
          data-testid="reel-progress-bar"
        >
          <div className={`relative w-full ${scrub ? "h-[5px]" : "h-[3px]"} bg-white/25 transition-[height]`}>
            <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
            {longMode && time.dur > 0 && chapters.slice(1).map((c, i) => <span key={i} className="absolute top-0 bottom-0 w-[2px] bg-black/60" style={{ left: `${(c.time / time.dur) * 100}%` }} />)}
          </div>
        </div>
      )}
      {src && longMode && !hideChrome && (
        <ChaptersStrip chapters={chapters} currentTime={time.cur} onSeek={seekAbs} onOpen={() => onOpenChapters?.(reel, seekAbs)} bottom="calc(var(--nav-reserve, 64px) + 30px)" />
      )}
      {src && longMode && resume.resumedFrom != null && (
        <div className="absolute left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/70 text-white text-xs px-3 py-1.5 reel-chrome" style={{ top: "calc(var(--safe-top, 0px) + 64px)" }} data-testid="long-resumed-toast">Reanudando desde {fmtClock(resume.resumedFrom)}</div>
      )}
      {src && !longMode && isLongVideo(reel) && !hideChrome && (
        <button onClick={(e) => { e.stopPropagation(); navigate(`/video/${reel.id}`); }} className="absolute left-3 z-30 inline-flex items-center gap-1.5 rounded-full bg-white text-black text-xs font-bold px-3 h-8 reel-chrome shadow-lg" style={{ bottom: "calc(var(--nav-reserve, 96px) + 150px)" }} data-testid="reel-watch-full-btn"><Clapperboard className="w-3.5 h-3.5" />Ver completo · {fmtClock(reel.duration)}</button>
      )}
      <ReelMinimizeMenu open={minOpen} onClose={() => setMinOpen(false)} onPick={pickMinimize} nativeSupported={nativePipSupported} />
      {src && (
        <ReelScrubPreview visible={!!scrub} pct={scrub?.pct || 0} time={scrub?.time || 0} sources={sources} poster={reel.poster_url || reel.thumbnail_url} bottom="calc(var(--nav-reserve, 64px) + 14px)" />
      )}
      {src && controlsVisible && (
        <div className="absolute left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 h-5 px-2.5 rounded-full backdrop-blur-xl bg-white/[0.06] border border-white/35 text-white text-[10px] font-semibold tabular-nums reel-chrome pointer-events-none" style={{ bottom: "calc(var(--nav-reserve, 64px) + 3px)" }} data-testid="reel-time-bar">
          <span data-testid="reel-time-current">{fmtTime(time.cur)}</span><span className="opacity-60">/</span><span data-testid="reel-time-duration">{fmtTime(time.dur)}</span>
        </div>
      )}
    </div>
  );
}

function Rail({ icon, label, onClick, testid, onLabelClick, labelTestid }) {
  return (
    <div className="flex flex-col items-center reel-chrome">
      <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className="active:scale-90 transition-transform" data-testid={testid}>{icon}</button>
      {onLabelClick ? (
        <button onClick={(e) => { e.stopPropagation(); onLabelClick(); }} className="text-white text-[11px] font-semibold mt-1 px-2 -mx-2 py-0.5 active:opacity-70" data-testid={labelTestid}>{label}</button>
      ) : (
        <span className="text-white text-[11px] font-semibold mt-1">{label}</span>
      )}
    </div>
  );
}
