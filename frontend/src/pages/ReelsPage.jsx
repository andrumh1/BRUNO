/* eslint-disable */
/**
 * ReelsPage — TikTok/Instagram-style vertical scroller.
 *
 * Features:
 *  • Auto-play via IntersectionObserver (75% visible). Cross-platform-safe:
 *    multi-<source> (MP4 + f_auto + original) so iOS/Android/Win/Mac all play.
 *  • Swipe UP/DOWN ⇒ next/previous reel (native scroll-snap)
 *  • Swipe LEFT  ⇒ go to author's profile Reels tab
 *  • Swipe RIGHT ⇒ go back to previous screen
 *  • Double-tap ⇒ like (red-heart burst animation)
 *  • Long-press ⇒ pause while held
 *  • History: stack of reel IDs viewed in this session
 *  • Profile mode (route: /profile/:id/reels): only that user's reels, chronological
 *  • Random/algorithmic order in /reels feed
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  Heart, MessageCircle, Share2, Bookmark, Music2, Play,
  Volume2, VolumeX, User, Loader2, Radio, Film, Plus, Eye, Minimize2, ArrowLeft
} from "lucide-react";
import { useNavScroll } from "@/contexts/NavScrollContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/* ─────────────────────────────────────────────────────────────────────────── */
/*  SINGLE REEL                                                               */
/* ─────────────────────────────────────────────────────────────────────────── */

const ReelItem = ({ reel, isActive, globalMuted, onToggleMute, onLike, onSwipeLeftToProfile }) => {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(reel.is_liked || false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const [error, setError] = useState(false);
  const { token } = useAuth();
  const { addMinimizedItem } = useNavScroll();
  const navigate = useNavigate();

  // Touch gesture refs — swipe + double-tap + long-press
  const touchStart = useRef({ x: 0, y: 0, t: 0, lastTap: 0 });
  const longPressTimer = useRef(null);
  const wasPausedByLongPress = useRef(false);

  /* ── Auto-play orchestration ─────────────────────────────────────────── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      // Ensure mute matches global state for autoplay policies
      v.muted = globalMuted;
      v.currentTime = 0;
      const p = v.play();
      if (p && typeof p.then === "function") {
        p.then(() => setIsPlaying(true)).catch(() => {
          // Autoplay blocked — try muted retry once
          if (!v.muted) {
            v.muted = true;
            v.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
          } else {
            setIsPlaying(false);
          }
        });
      }
    } else {
      try { v.pause(); v.currentTime = 0; } catch (_e) { /* ignore */ }
      setIsPlaying(false);
    }
  }, [isActive, globalMuted]);

  /* ── Gestures ───────────────────────────────────────────────────────── */
  const handleTouchStart = (e) => {
    const t = e.touches[0];
    touchStart.current.x = t.clientX;
    touchStart.current.y = t.clientY;
    touchStart.current.t = Date.now();
    // Long-press → pause
    longPressTimer.current = setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) { v.pause(); setIsPlaying(false); wasPausedByLongPress.current = true; }
    }, 380);
  };
  const handleTouchMove = (e) => {
    // Cancel long-press if user actually moves
    if (longPressTimer.current && Math.abs(e.touches[0].clientY - touchStart.current.y) > 8) {
      clearTimeout(longPressTimer.current); longPressTimer.current = null;
    }
  };
  const handleTouchEnd = (e) => {
    clearTimeout(longPressTimer.current); longPressTimer.current = null;
    const dx = (e.changedTouches[0]?.clientX || 0) - touchStart.current.x;
    const dy = (e.changedTouches[0]?.clientY || 0) - touchStart.current.y;
    const dt = Date.now() - touchStart.current.t;

    if (wasPausedByLongPress.current) {
      // resume after long-press release
      const v = videoRef.current;
      if (v) { v.play().then(() => setIsPlaying(true)).catch(() => {}); }
      wasPausedByLongPress.current = false;
      return;
    }

    // Treat tiny gestures as a tap
    const isTap = Math.abs(dx) < 8 && Math.abs(dy) < 8 && dt < 280;
    if (isTap) {
      const now = Date.now();
      if (now - touchStart.current.lastTap < 280) {
        // ── double-tap = like ──
        if (!isLiked) { setIsLiked(true); setLikesCount((p) => p + 1); onLike?.(reel.id); }
        setShowHeartBurst(true);
        setTimeout(() => setShowHeartBurst(false), 700);
        touchStart.current.lastTap = 0;
      } else {
        touchStart.current.lastTap = now;
        // single tap = play/pause toggle
        const v = videoRef.current;
        if (v) {
          if (v.paused) v.play().then(() => setIsPlaying(true)).catch(() => {});
          else { v.pause(); setIsPlaying(false); }
        }
      }
      return;
    }

    // Horizontal swipe: swipe LEFT → author profile, swipe RIGHT → back
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) {
        // LEFT swipe
        onSwipeLeftToProfile?.(reel);
      } else {
        // RIGHT swipe
        navigate(-1);
      }
    }
  };

  const handleLikeClick = (e) => {
    e.stopPropagation();
    const next = !isLiked;
    setIsLiked(next);
    setLikesCount((p) => p + (next ? 1 : -1));
    if (next) {
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 700);
    }
    onLike?.(reel.id, next);
  };

  const videoUrl = reel.video_url;
  const f_auto = videoUrl && videoUrl.includes("/upload/") && !videoUrl.includes("/upload/f_auto")
    ? videoUrl.replace("/upload/", "/upload/f_auto,q_auto/")
    : null;

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full bg-black snap-start snap-always overflow-hidden"
      data-testid={`reel-item-${reel.id}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {videoUrl ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          loop
          muted={globalMuted}
          playsInline
          preload="metadata"
          poster={reel.poster_url || reel.thumbnail_url || undefined}
          onError={(e) => {
            // Only set error after EVERY <source> has failed AND the video
            // hasn't successfully started. `e.currentTarget.networkState===3`
            // means "NETWORK_NO_SOURCE" — all sources exhausted.
            if (e.currentTarget?.networkState === 3 && e.currentTarget.readyState === 0) setError(true);
          }}
          onPlaying={() => setError(false)}
          onLoadedData={() => setError(false)}
        >
          {/* Prefer the explicit MP4 (Cloudinary eager). Falls back to f_auto
              (Cloudinary picks codec per UA), then the original. */}
          {reel.mp4_url && <source src={reel.mp4_url} type="video/mp4" />}
          {f_auto && <source src={f_auto} type="video/mp4" />}
          <source src={videoUrl} type={`video/${(videoUrl.split(".").pop() || "mp4").split("?")[0]}`} />
        </video>
      ) : (
        <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${reel.image_url || reel.thumbnail_url || ""})` }} />
      )}

      {!isPlaying && videoUrl && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
          No se pudo cargar este video
        </div>
      )}

      {/* Double-tap heart burst */}
      {showHeartBurst && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Heart className="w-24 h-24 text-red-500 fill-red-500 animate-ping-once" style={{ filter: "drop-shadow(0 0 12px rgba(255,0,80,.6))" }} />
        </div>
      )}

      {/* Bottom gradient */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />

      {/* Mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
        className="absolute top-4 right-4 p-2 bg-black/40 rounded-full z-20 backdrop-blur-sm"
        data-testid="reel-mute-toggle"
      >
        {globalMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      {/* Right action column */}
      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        <Link to={`/profile/${reel.author?.id || reel.user_id}`} className="relative" onClick={(e) => e.stopPropagation()}>
          <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-gray-800">
            {reel.author?.avatar_url ? (
              <img src={reel.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white"><User className="w-5 h-5" /></div>
            )}
          </div>
        </Link>

        <button onClick={handleLikeClick} className="flex flex-col items-center" data-testid="reel-like-btn">
          <Heart className={`w-7 h-7 transition-all ${isLiked ? "text-red-500 fill-red-500 scale-110" : "text-white"}`} />
          <span className="text-white text-[10px] mt-1">{likesCount}</span>
        </button>

        <button className="flex flex-col items-center">
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="text-white text-[10px] mt-1">{reel.comments_count || 0}</span>
        </button>

        <button className="flex flex-col items-center">
          <Share2 className="w-7 h-7 text-white" />
          <span className="text-white text-[10px] mt-1">Enviar</span>
        </button>

        <button onClick={(e) => {
          e.stopPropagation();
          addMinimizedItem({
            id: reel.id,
            itemType: "reel",
            title: (reel.content || reel.description || "").slice(0, 30) || "Reel",
            thumbnail: reel.thumbnail_url || reel.media?.[0]?.url || null,
            videoUrl: videoUrl,
          });
          navigate(-1);
        }} className="flex flex-col items-center" data-testid="reel-minimize-btn">
          <Minimize2 className="w-6 h-6 text-white" />
          <span className="text-[10px] text-white mt-0.5">PiP</span>
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute left-4 right-16 bottom-8 z-10 pointer-events-none">
        <Link to={`/profile/${reel.author?.id || reel.user_id}`} className="flex items-center gap-2 mb-2 pointer-events-auto" onClick={(e) => e.stopPropagation()}>
          <span className="text-white font-bold text-sm">@{reel.author?.username || reel.author?.name || "usuario"}</span>
        </Link>
        <p className="text-white text-xs line-clamp-2 opacity-90">{reel.content || reel.description}</p>
        {reel.audio_name && (
          <div className="flex items-center gap-2 mt-2 bg-black/30 rounded-full px-3 py-1 w-fit">
            <Music2 className="w-3 h-3 text-white animate-spin" style={{ animationDuration: "3s" }} />
            <span className="text-white text-[10px] truncate max-w-[180px]">{reel.audio_name}</span>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────────────────── */
/*  PAGE                                                                      */
/* ─────────────────────────────────────────────────────────────────────────── */

const ReelsPage = () => {
  const navigate = useNavigate();
  const { userId: profileUserId } = useParams();
  const [searchParams] = useSearchParams();
  const initialReelId = searchParams.get("id");
  const profileMode = !!profileUserId;
  const { token } = useAuth();
  const containerRef = useRef(null);
  const itemRefs = useRef([]);
  const [activeTab, setActiveTab] = useState("reels");
  const [reels, setReels] = useState([]);
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);
  // History of reel IDs viewed (newest last). Lets us restore position on back.
  const historyRef = useRef([]);

  /* ── Fetch ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const fetchContent = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const postsUrl = profileMode
          ? `${API}/posts?user_id=${profileUserId}&media_only=true`
          : `${API}/posts/recommended-videos?limit=40`;
        const [postsRes, livesRes] = await Promise.all([
          axios.get(postsUrl, { headers }).catch(() => ({ data: [] })),
          profileMode ? Promise.resolve({ data: [] }) : axios.get(`${API}/lives`, { headers }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        const list = (Array.isArray(postsRes.data) ? postsRes.data : [])
          .filter((p) => {
            const hasMediaArr = Array.isArray(p.media) && p.media.some((m) => m.url || m.secure_url);
            return hasMediaArr || p.media_url || p.image_url || (p.attachments?.length > 0);
          })
          .map((post) => {
            const firstMedia = (post.media || [])[0] || {};
            const firstAttach = (post.attachments || [])[0] || {};
            const url = firstMedia.url || firstMedia.secure_url || firstAttach.url || post.media_url || post.image_url;
            const isVideo = (firstMedia.type === "video") || /\.(mp4|webm|mov|m4v|ogv)(\?|$)/i.test(url || "");
            return {
              ...post,
              video_url: isVideo ? url : (post.video_url || null),
              mp4_url: firstMedia.mp4_url || firstAttach.mp4_url || post.mp4_url || null,
              poster_url: firstMedia.poster_url || firstAttach.poster_url || post.poster_url || post.thumbnail_url || null,
              image_url: !isVideo ? url : (post.image_url || post.thumbnail_url || null),
              thumbnail_url: post.thumbnail_url || firstMedia.poster_url || (!isVideo ? url : null),
              author: {
                id: post.user?.id || post.user_id,
                name: post.user?.display_name,
                username: post.user?.username,
                avatar_url: post.user?.avatar_url,
              },
            };
          });

        // Profile mode = chronological (newest first), main feed = randomized
        let ordered = list;
        if (profileMode) {
          ordered = list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
        } else {
          // Stable shuffle + video-first
          ordered = list
            .map((r) => ({ r, k: Math.random() }))
            .sort((a, b) => a.k - b.k)
            .map(({ r }) => r)
            .sort((a, b) => (b.video_url ? 1 : 0) - (a.video_url ? 1 : 0));
        }
        setReels(ordered);
        setLives(Array.isArray(livesRes.data) ? livesRes.data : livesRes.data?.lives || []);

        // Restore initial reel if a specific id was requested
        if (initialReelId) {
          const idx = ordered.findIndex((r) => r.id === initialReelId);
          if (idx >= 0) setActiveIndex(idx);
        }
      } catch (_e) { /* keep empty */ }
      finally { if (!cancelled) setLoading(false); }
    };
    fetchContent();
    return () => { cancelled = true; };
  }, [token, profileMode, profileUserId, initialReelId]);

  /* ── Scroll → activeIndex (and history) ─────────────────────────────── */
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio >= 0.75) {
          const i = Number(entry.target.dataset.index);
          if (!Number.isNaN(i)) {
            setActiveIndex(i);
            const id = reels[i]?.id;
            if (id && historyRef.current[historyRef.current.length - 1] !== id) {
              historyRef.current.push(id);
              // Tell the algorithm we watched this so it's deprioritized later
              try {
                const headers = token ? { Authorization: `Bearer ${token}` } : {};
                axios.post(`${API}/posts/${id}/view`, {}, { headers });
              } catch (_e) { /* ignore */ }
            }
          }
        }
      });
    }, { root, threshold: [0.25, 0.5, 0.75] });
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [reels]);

  // Once we know activeIndex (initial deep-link), scroll into view
  useEffect(() => {
    if (loading || reels.length === 0) return;
    const el = itemRefs.current[activeIndex];
    if (el) el.scrollIntoView({ block: "start", behavior: "instant" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleLike = useCallback(async (reelId) => {
    if (!token) return;
    try { await axios.post(`${API}/posts/${reelId}/like`, {}, { headers: { Authorization: `Bearer ${token}` } }); }
    catch (_e) { /* optimistic update already applied */ }
  }, [token]);

  const handleSwipeLeftToProfile = useCallback((reel) => {
    const uid = reel.author?.id || reel.user_id;
    if (uid) navigate(`/profile/${uid}/reels`);
  }, [navigate]);

  /* ── Render ─────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-black relative overflow-hidden" data-testid="reels-page">
      {/* Top tabs / header */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-3 pt-3 pb-2 bg-gradient-to-b from-black/70 to-transparent">
        {profileMode ? (
          <button onClick={() => navigate(-1)} className="p-1.5 rounded-full bg-black/40 text-white" data-testid="reels-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : <span className="w-9" />}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={() => setActiveTab("reels")}
            className={`text-sm font-bold transition-all ${activeTab === "reels" ? "text-white border-b-2 border-white pb-1" : "text-white/50"}`}
            data-testid="reels-tab"
          >
            {profileMode ? "Reels del perfil" : "Reels"}
          </button>
          {!profileMode && (
            <button
              onClick={() => setActiveTab("lives")}
              className={`text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === "lives" ? "text-white border-b-2 border-white pb-1" : "text-white/50"}`}
              data-testid="lives-tab"
            >
              <Radio className="w-3.5 h-3.5" /> En Vivo
            </button>
          )}
        </div>
        <span className="w-9" />
      </div>

      {/* Reels view */}
      {activeTab === "reels" && (
        <>
          {reels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white p-8">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4"><Film className="w-10 h-10" /></div>
              <h2 className="text-xl font-bold mb-2">{profileMode ? "Sin reels todavía" : "No hay reels"}</h2>
              <p className="text-white/50 text-sm text-center mb-6">{profileMode ? "Este perfil aún no publicó videos" : "Sé el primero en compartir un video corto"}</p>
              {!profileMode && (
                <Button onClick={() => navigate("/camera")} className="rounded-full bg-primary">
                  <Plus className="w-4 h-4 mr-2" /> Crear Reel
                </Button>
              )}
            </div>
          ) : (
            <div
              ref={containerRef}
              className="h-full overflow-y-scroll snap-y snap-mandatory"
              style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
            >
              {reels.map((reel, index) => (
                <div
                  key={reel.id}
                  ref={(el) => (itemRefs.current[index] = el)}
                  data-index={index}
                  className="h-full w-full"
                >
                  <ReelItem
                    reel={reel}
                    isActive={index === activeIndex}
                    globalMuted={globalMuted}
                    onToggleMute={() => setGlobalMuted((p) => !p)}
                    onLike={handleLike}
                    onSwipeLeftToProfile={handleSwipeLeftToProfile}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Progress dots */}
          {reels.length > 1 && (
            <div className="absolute top-12 left-4 right-4 flex gap-0.5 z-20">
              {reels.slice(0, 20).map((_, i) => (
                <div key={`_-${i}`} className={`h-0.5 flex-1 rounded-full transition-all ${i === activeIndex ? "bg-white" : "bg-white/20"}`} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Lives view */}
      {activeTab === "lives" && !profileMode && (
        <div className="h-full pt-14 pb-4 px-4 overflow-y-auto">
          {lives.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4"><Radio className="w-10 h-10" /></div>
              <h2 className="text-xl font-bold mb-2">No hay transmisiones</h2>
              <p className="text-white/50 text-sm text-center mb-6">No hay nadie en vivo ahora</p>
              <Button onClick={() => navigate("/lives/start")} className="rounded-full bg-red-500 hover:bg-red-600">
                <Radio className="w-4 h-4 mr-2" /> Iniciar Live
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lives.map((live) => (
                <Link key={live.id} to={`/lives/${live.id}`} className="relative rounded-xl overflow-hidden aspect-[3/4] bg-gray-900 group" data-testid={`live-item-${live.id}`}>
                  {live.thumbnail_url && <img src={live.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    <Radio className="w-2.5 h-2.5" /> EN VIVO
                  </div>
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px]">
                    <Eye className="w-2.5 h-2.5" /> {live.viewer_count || 0}
                  </div>
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-xs font-bold truncate">{live.title || "En vivo"}</p>
                    <p className="text-white/60 text-[10px] truncate">@{live.host?.username || "usuario"}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReelsPage;
