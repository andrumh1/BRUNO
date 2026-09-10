/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, Bookmark, Music2, Play, Volume2, VolumeX, User, Plus, Check, Minimize2, RotateCcw, Layers, Scissors, Columns2 } from "lucide-react";

const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

/**
 * ReelItem — one full-screen reel. TikTok-grade playback + gestures.
 *  • isActive → play (retry muted if autoplay blocked); neighbors preload.
 *  • Tap = play/pause · Double-tap = like · Long-press = pause · Swipe L/R.
 *  • Bottom progress bar with drag-to-seek.
 */
export default function ReelItem({
  reel, isActive, isNear, globalMuted, onToggleMute, onLike, onFollow, onSave,
  onOpenComments, onOpenShare, onOpenRemix, onOpenRemixes, onOpenSound, onSwipeLeft, onSwipeRight, onMinimize, hideChrome,
}) {
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [burst, setBurst] = useState(null);
  const [retryKey, setRetryKey] = useState(0);
  const touch = useRef({ x: 0, y: 0, t: 0, lastTap: 0 });
  const longPress = useRef(null);
  const pausedByHold = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.muted = globalMuted;
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

  const seekTo = (clientX) => {
    const v = videoRef.current; const bar = barRef.current;
    if (!v || !bar || !v.duration) return;
    const r = bar.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = pct * v.duration; setProgress(pct * 100);
  };

  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { ...touch.current, x: t.clientX, y: t.clientY, t: Date.now() };
    longPress.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) { v.pause(); setIsPlaying(false); pausedByHold.current = true; }
    }, 380);
  };
  const onTouchMove = (e) => {
    if (longPress.current && Math.abs(e.touches[0].clientY - touch.current.y) > 8) { clearTimeout(longPress.current); longPress.current = null; }
  };
  const onTouchEnd = (e) => {
    clearTimeout(longPress.current); longPress.current = null;
    const c = e.changedTouches[0];
    const dx = c.clientX - touch.current.x, dy = c.clientY - touch.current.y, dt = Date.now() - touch.current.t;
    if (pausedByHold.current) { pausedByHold.current = false; videoRef.current?.play().then(() => setIsPlaying(true)).catch(() => {}); return; }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 280) return handleTap(c.clientX, c.clientY);
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) (dx < 0 ? onSwipeLeft : onSwipeRight)?.(reel);
  };
  const handleTap = (x, y) => {
    const now = Date.now();
    if (now - touch.current.lastTap < 280) {
      touch.current.lastTap = 0;
      if (!reel.is_liked) onLike?.(reel, true);
      setBurst({ x, y }); setTimeout(() => setBurst(null), 700);
      return;
    }
    touch.current.lastTap = now;
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {}); else { v.pause(); setIsPlaying(false); }
  };

  const src = reel.video_url;
  const fAuto = src && src.includes("/upload/") && !src.includes("/upload/f_auto") ? src.replace("/upload/", "/upload/f_auto,q_auto/") : null;
  const authorId = reel.author?.id || reel.user_id;

  return (
    <div
      className="reels-stage relative h-full w-full bg-black snap-start snap-always overflow-hidden select-none"
      data-testid={`reel-item-${reel.id}`}
      onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      onClick={(e) => { if (!("ontouchstart" in window)) handleTap(e.clientX, e.clientY); }}
    >
      {/* Blurred backdrop so portrait/landscape mixes look premium */}
      {(reel.poster_url || reel.thumbnail_url) && (
        <div className="absolute inset-0 bg-center bg-cover scale-110 opacity-60" style={{ backgroundImage: `url(${reel.poster_url || reel.thumbnail_url})`, filter: "blur(30px)" }} />
      )}

      {src ? (
        <video
          key={retryKey}
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-contain sm:object-cover"
          loop playsInline muted={globalMuted}
          preload={isActive || isNear ? "auto" : "metadata"}
          poster={reel.poster_url || reel.thumbnail_url || undefined}
          onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setProgress((v.currentTime / v.duration) * 100); }}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => { setBuffering(false); setError(false); }}
          onCanPlay={() => setBuffering(false)}
          onError={(e) => { if (e.currentTarget?.networkState === 3 && e.currentTarget.readyState === 0) setError(true); }}
          data-testid={`reel-video-${reel.id}`}
        >
          {reel.mp4_url && <source src={reel.mp4_url} type="video/mp4" />}
          {fAuto && <source src={fAuto} type="video/mp4" />}
          <source src={src} />
        </video>
      ) : (
        <img src={reel.image_url || reel.thumbnail_url} alt="" className="absolute inset-0 h-full w-full object-contain" />
      )}

      {/* Play glyph / buffering / error */}
      {src && !isPlaying && !error && (
        <div className="absolute inset-0 grid place-items-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm grid place-items-center"><Play className="w-8 h-8 text-white fill-white ml-1" /></div>
        </div>
      )}
      {buffering && isPlaying && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-9 w-9 rounded-full border-2 border-white/30 border-t-white animate-spin pointer-events-none" />
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center">
          <button onClick={(e) => { e.stopPropagation(); setError(false); setRetryKey((k) => k + 1); }} className="flex flex-col items-center gap-2 text-white text-xs" data-testid="reel-retry-btn">
            <RotateCcw className="w-6 h-6" /> No se pudo cargar · Reintentar
          </button>
        </div>
      )}
      {burst && (
        <div className="absolute pointer-events-none" style={{ left: burst.x - 48, top: burst.y - 48 }}>
          <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-ping-once" style={{ filter: "drop-shadow(0 0 12px rgba(255,0,80,.6))" }} />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

      {!hideChrome && (
        <>
          {/* Right rail */}
          <div className="absolute right-2 flex flex-col items-center gap-4 z-10" style={{ bottom: "calc(var(--nav-reserve, 64px) + 56px)" }}>
            <div className="relative mb-1">
              <Link to={`/profile/${authorId}`} onClick={(e) => e.stopPropagation()} className="block w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-zinc-800" data-testid="reel-author-avatar">
                {reel.author?.avatar_url ? <img src={reel.author.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-white"><User className="w-5 h-5" /></div>}
              </Link>
              <button
                onClick={(e) => { e.stopPropagation(); onFollow?.(reel); }}
                className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full grid place-items-center border border-white/60 transition-colors ${reel.is_following ? "bg-white text-primary" : "bg-primary text-white"}`}
                data-testid="reel-follow-btn" aria-label="Seguir"
              >
                {reel.is_following ? <Check className="w-3 h-3" strokeWidth={3} /> : <Plus className="w-3 h-3" strokeWidth={3} />}
              </button>
            </div>

            <Rail icon={<Heart className={`w-7 h-7 ${reel.is_liked ? "text-red-500 fill-red-500 scale-110" : "text-white"} transition-all`} />} label={fmt(reel.likes_count)} testid="reel-like-btn" onClick={() => onLike?.(reel, !reel.is_liked)} />
            <Rail icon={<MessageCircle className="w-7 h-7 text-white" />} label={fmt(reel.comments_count)} testid="reel-comments-btn" onClick={() => onOpenComments?.(reel)} />
            <Rail icon={<Bookmark className={`w-7 h-7 ${reel.is_bookmarked ? "text-primary fill-primary" : "text-white"}`} />} label={reel.is_bookmarked ? "Guardado" : "Guardar"} testid="reel-save-btn" onClick={() => onSave?.(reel)} />
            <Rail icon={<Share2 className="w-7 h-7 text-white" />} label="Enviar" testid="reel-share-btn" onClick={() => onOpenShare?.(reel)} />
            {src && <Rail icon={<Layers className="w-7 h-7 text-white" />} label={reel.remix_count ? fmt(reel.remix_count) : "Remix"} testid="reel-remix-btn" onClick={() => onOpenRemix?.(reel)} />}
            <Rail icon={<Minimize2 className="w-6 h-6 text-white" />} label="PiP" testid="reel-minimize-btn" onClick={() => onMinimize?.(reel)} />
            <button onClick={(e) => { e.stopPropagation(); onOpenSound?.(reel); }} className="mt-1 w-11 h-11 rounded-full bg-zinc-900 border-[3px] border-zinc-700 grid place-items-center overflow-hidden reel-disc active:scale-90" style={{ animationPlayState: isPlaying ? "running" : "paused" }} data-testid="reel-sound-disc" aria-label="Sonido">
              {reel.author?.avatar_url ? <img src={reel.author.avatar_url} alt="" className="w-6 h-6 rounded-full object-cover" /> : <Music2 className="w-4 h-4 text-white" />}
            </button>
          </div>

          {/* Caption */}
          <div className="absolute left-3 right-20 z-10 pointer-events-none" style={{ bottom: "calc(var(--nav-reserve, 64px) + 22px)" }}>
            <Link to={`/profile/${authorId}`} onClick={(e) => e.stopPropagation()} className="pointer-events-auto text-white font-bold text-[15px] drop-shadow" data-testid="reel-author-name">
              @{reel.author?.username || reel.author?.name || "usuario"}
            </Link>
            {reel.remix?.source_post_id && (
              <button onClick={(e) => { e.stopPropagation(); onOpenRemixes?.({ id: reel.remix.source_post_id }); }} className="pointer-events-auto mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 backdrop-blur-sm px-2 py-0.5 text-white text-[11px]" data-testid="reel-remix-label">
                {reel.remix.type === "duet" ? <Columns2 className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                {reel.remix.type === "duet" ? "Dúo con" : "Stitch de"} @{reel.remix.source_username}
              </button>
            )}
            {(reel.content || reel.description) && <p className="text-white/95 text-[13px] mt-1 line-clamp-2 drop-shadow">{reel.content || reel.description}</p>}
            <button onClick={(e) => { e.stopPropagation(); onOpenSound?.(reel); }} className="pointer-events-auto flex items-center gap-1.5 mt-2 text-white/90 text-[11px] max-w-full" data-testid="reel-sound-label">
              <Music2 className="w-3 h-3 shrink-0" />
              <span className="truncate">{reel.audio_name || `Sonido original · @${reel.author?.username || reel.author?.name || "usuario"}`}</span>
            </button>
          </div>

          {/* Mute */}
          <button onClick={(e) => { e.stopPropagation(); onToggleMute(); }} className="absolute right-3 z-20 p-2 rounded-full bg-black/35 backdrop-blur-sm" style={{ top: "calc(env(safe-area-inset-top, 0px) + 52px)" }} data-testid="reel-mute-toggle">
            {globalMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
          </button>
        </>
      )}

      {/* Progress / seek bar */}
      {src && (
        <div
          ref={barRef}
          className="absolute inset-x-0 z-20 h-6 flex items-end cursor-pointer"
          style={{ bottom: "calc(var(--nav-reserve, 64px) - 2px)" }}
          onClick={(e) => { e.stopPropagation(); seekTo(e.clientX); }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => { e.stopPropagation(); seekTo(e.touches[0].clientX); }}
          onTouchEnd={(e) => e.stopPropagation()}
          data-testid="reel-progress-bar"
        >
          <div className="w-full h-[3px] bg-white/25">
            <div className="h-full bg-white transition-[width] duration-100" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function Rail({ icon, label, onClick, testid }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} className="flex flex-col items-center active:scale-90 transition-transform" data-testid={testid}>
      {icon}
      <span className="text-white text-[11px] font-semibold mt-1 drop-shadow">{label}</span>
    </button>
  );
}
