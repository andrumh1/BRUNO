/* eslint-disable react-hooks/exhaustive-deps */
/**
 * ReelsPage — TikTok-class vertical video feed with BRUNO identity.
 *  Tabs: Siguiendo · Para ti · En vivo   ·   History sheet   ·   Create shortcut
 *  Engine: useReelsFeed (algorithmic, paginated, dedupe) + windowed rendering
 *  (only active ±2 reels mount a <video>) + IntersectionObserver snapping.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useShareHit } from "@/lib/shareStats";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import axios from "axios";
import { Loader2, Radio, Film, Plus, Eye, ArrowLeft, Clock, Camera, Lock, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import ReelItem from "@/components/reels/ReelItem";
import { useReelsFeed, rememberFeedPosition } from "@/components/reels/useReelsFeed";
import UpcomingLives from "@/components/live/UpcomingLives";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { ReelCommentsSheet, ReelShareSheet, ReelHistorySheet, ReelRemixSheet, ReelRemixesSheet, ReelSoundSheet, ReelLikersSheet, ReelOptionsSheet, ReelEditSheet } from "@/components/reels/ReelSheets";
import RemixStudio from "@/components/reels/RemixStudio";
import ReelsStoriesStrip from "@/components/reels/ReelsStoriesStrip";
import ContinueWatchingRow from "@/components/reels/ContinueWatchingRow";
import ReelsQuickRail from "@/components/reels/ReelsQuickRail";
import { ChaptersSheet, getChapters } from "@/components/reels/LongVideoExtras";
import { AnimatePresence } from "framer-motion";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function ReelsPage() {
  const navigate = useNavigate();
  const { userId: profileUserId, videoId } = useParams();
  const [searchParams] = useSearchParams();
  useShareHit("reel");
  const longMode = !!videoId || window.location.pathname.startsWith("/video");
  const seriesId = longMode ? searchParams.get("series") : null;
  const initialReelId = videoId || searchParams.get("id");
  const [autoNext, setAutoNext] = useState(null); // { toIndex, secondsLeft }
  const profileMode = !!profileUserId;
  const [chaptersFor, setChaptersFor] = useState(null); // { reel, seek }
  const { token, user } = useAuth();
  const { addMinimizedItem } = useNavScroll();

  const [tab, setTab] = useState(window.location.pathname.startsWith("/lives") ? "lives" : "for_you");
  const [activeIndex, setActiveIndex] = useState(0);
  const [globalMuted, setGlobalMuted] = useState(true);
  const [commentsFor, setCommentsFor] = useState(null);
  const [shareFor, setShareFor] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [remixFor, setRemixFor] = useState(null);      // reel → choose duet/stitch
  const [studio, setStudio] = useState(null);          // { reel, mode }
  const [remixesOf, setRemixesOf] = useState(null);    // source post id
  const [soundFor, setSoundFor] = useState(null);      // reel → sound sheet
  const [likersFor, setLikersFor] = useState(null);    // reel → who liked
  const [optionsFor, setOptionsFor] = useState(null);  // reel → "…" options
  const [editFor, setEditFor] = useState(null);        // reel → edit sheet
  const highlightCommentId = searchParams.get("comment");
  const containerRef = useRef(null);
  const itemRefs = useRef([]);

  const feedMode = longMode ? "long" : tab === "following" ? "following" : "for_you";
  const { reels, loading, loadingMore, loadMore, trackView, patchReel, removeReel, removeByAuthor, restoredIndex, cacheKey } = useReelsFeed({ token, mode: feedMode, profileUserId, initialReelId, seriesId });
  // Serie: empezar en el video pedido (orden de la serie) y autoplay del siguiente con cuenta atrás cancelable
  const seriesStarted = useRef(false);
  useEffect(() => {
    if (!seriesId || loading || seriesStarted.current || !reels.length) return;
    seriesStarted.current = true;
    const idx = Math.max(0, reels.findIndex((r) => r.id === initialReelId));
    if (idx > 0) setTimeout(() => { const el = itemRefs.current[idx]; const c = containerRef.current; if (el && c) c.scrollTop = el.offsetTop; }, 50);
  }, [seriesId, loading, reels, initialReelId]);
  useEffect(() => {
    if (!autoNext) return;
    if (autoNext.secondsLeft <= 0) { itemRefs.current[autoNext.toIndex]?.scrollIntoView({ behavior: "smooth" }); setAutoNext(null); return; }
    const t = setTimeout(() => setAutoNext((a) => (a ? { ...a, secondsLeft: a.secondsLeft - 1 } : null)), 1000);
    return () => clearTimeout(t);
  }, [autoNext]);
  useEffect(() => { setAutoNext(null); }, [activeIndex]);
  const onEndedInSeries = (idx) => { if (seriesId && idx < reels.length - 1) setAutoNext({ toIndex: idx + 1, secondsLeft: 5 }); };
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  /* Restaurar la posición del feed al volver de un perfil / comentarios */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || loading || !restoredIndex || !containerRef.current) return;
    restoredRef.current = true;
    const apply = () => { const el = itemRefs.current[restoredIndex]; const c = containerRef.current; if (el && c) { c.scrollTop = el.offsetTop; } };
    apply(); setActiveIndex(restoredIndex);
    const raf = requestAnimationFrame(apply); const t = setTimeout(apply, 120);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [loading, restoredIndex]);
  useEffect(() => { if (restoredIndex && !restoredRef.current) return; rememberFeedPosition(cacheKey, activeIndex); }, [activeIndex, cacheKey]);

  /* Active reel tracking via IntersectionObserver */
  useEffect(() => {
    const root = containerRef.current;
    if (!root || reels.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.intersectionRatio >= 0.6) {
          const i = Number(en.target.dataset.index);
          if (!Number.isNaN(i)) setActiveIndex(i);
        }
      });
    }, { root, threshold: [0.6] });
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length, tab]);

  useEffect(() => {
    const r = reels[activeIndex];
    if (r) trackView(r.id);
    if (activeIndex >= reels.length - 3) loadMore();
  }, [activeIndex, reels.length]);

  const prevTab = useRef(tab);
  useEffect(() => { if (prevTab.current === tab) return; prevTab.current = tab; setActiveIndex(0); if (containerRef.current) containerRef.current.scrollTop = 0; }, [tab]);

  /* Deep-link from notifications: /reels?id=X&comments=1 opens the comments sheet */
  const openedCommentsRef = useRef(false);
  useEffect(() => {
    if (openedCommentsRef.current || loading || !initialReelId || (searchParams.get("comments") !== "1" && !highlightCommentId)) return;
    const r = reels.find((x) => x.id === initialReelId);
    if (r) { openedCommentsRef.current = true; setCommentsFor(r); }
  }, [loading, reels, initialReelId]);

  /* Keyboard for desktop */
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, Math.min(reels.length - 1, activeIndex + (e.key === "ArrowDown" ? 1 : -1)));
        itemRefs.current[next]?.scrollIntoView({ behavior: "smooth" });
      } else if (e.key === "m") setGlobalMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, reels.length]);

  /* Actions */
  const requireAuth = () => { if (!token) { brunoToast.error("Inicia sesión para continuar"); navigate("/login"); return false; } return true; };
  const handleLike = useCallback(async (reel, next) => {
    if (!requireAuth()) return;
    patchReel(reel.id, (r) => ({ is_liked: next, likes_count: Math.max(0, (r.likes_count || 0) + (next ? 1 : -1)) }));
    try {
      const res = await axios.post(`${API}/posts/${reel.id}/like`, {}, { headers });
      patchReel(reel.id, { is_liked: !!res.data?.liked, likes_count: res.data?.likes_count ?? 0 });
    }
    catch (_) { patchReel(reel.id, (r) => ({ is_liked: !next, likes_count: Math.max(0, (r.likes_count || 0) + (next ? -1 : 1)) })); }
  }, [token]);
  const handleFollow = useCallback(async (reel) => {
    if (!requireAuth()) return;
    const uid = reel.author?.id || reel.user_id;
    if (uid === user?.id) return brunoToast.info?.("Es tu propio reel") || null;
    const next = !reel.is_following;
    const setAll = (val) => reels.forEach((r) => { if ((r.author?.id || r.user_id) === uid) patchReel(r.id, { is_following: val }); });
    setAll(next);
    try {
      const res = await axios.post(`${API}/users/${uid}/follow`, {}, { headers });
      const following = !!res.data?.following;
      setAll(following);
      brunoToast.success(following ? `Ahora sigues a @${reel.author?.username || reel.author?.name || "este creador"}` : "Dejaste de seguir");
    } catch (e) { setAll(!next); brunoToast.error(e?.response?.data?.detail || "No se pudo seguir al creador"); }
  }, [token, reels, user?.id]);
  const handleSave = useCallback(async (reel) => {
    if (!requireAuth()) return;
    patchReel(reel.id, { is_bookmarked: !reel.is_bookmarked });
    try { const r = await axios.post(`${API}/posts/${reel.id}/bookmark`, {}, { headers }); patchReel(reel.id, { is_bookmarked: !!r.data?.bookmarked }); brunoToast.success(r.data?.bookmarked ? "Guardado en favoritos" : "Quitado de favoritos"); }
    catch (_) { patchReel(reel.id, { is_bookmarked: reel.is_bookmarked }); }
  }, [token]);
  const handleMinimize = (reel, mode = "float") => {
    addMinimizedItem({ id: reel.id, itemType: "reel", title: (reel.content || "").slice(0, 30) || "Reel", thumbnail: reel.thumbnail_url || reel.poster_url || null, videoUrl: mode === "bar" ? null : reel.video_url });
    navigate(-1);
  };
  const swipeLeft = (reel) => { const uid = reel.author?.id || reel.user_id; if (uid) navigate(`/profile/${uid}/reels`); };
  const swipeRight = () => navigate(-1);
  const openFromHistory = (r) => { setHistoryOpen(false); navigate(`/reels?id=${r.id}`); };

  const topPad = "calc(var(--safe-top) + 8px)";

  return (
    <div className="fixed inset-0 reels-surface overflow-hidden" data-testid="reels-page">
      {/* Header */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-3 pb-3 bg-gradient-to-b from-black/70 via-black/30 to-transparent reel-chrome pointer-events-none [&>*]:pointer-events-auto" style={{ paddingTop: topPad }} data-no-safe-top>
        {(profileMode || longMode) ? (
          <button onClick={() => navigate(-1)} className="w-9 h-9 grid place-items-center rounded-full bg-black/35 text-white" data-testid="reels-back-btn"><ArrowLeft className="w-5 h-5" /></button>
        ) : (
          <button onClick={() => setHistoryOpen(true)} className="w-9 h-9 grid place-items-center rounded-full bg-black/35 text-white" data-testid="reels-history-btn" aria-label="Historial"><Clock className="w-5 h-5" /></button>
        )}
        {longMode ? (
          <button onClick={() => seriesId && navigate(`/series/${seriesId}`)} className="text-white font-bold text-sm max-w-[60vw] truncate" data-testid="long-player-title">{seriesId && reels[activeIndex]?.series ? `${reels[activeIndex].series.title} · ${reels[activeIndex].series.index + 1}/${reels[activeIndex].series.count}` : "Videos largos"}</button>
        ) : profileMode ? (
          <span className="text-white font-bold text-sm">Reels del perfil</span>
        ) : (
          <div className="flex items-center gap-5" data-testid="reels-tabs">
            {[["following", "Siguiendo"], ["for_you", "Para ti"], ["lives", "En vivo"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} data-testid={`reels-tab-${id}`}
                className={`relative text-[15px] font-bold transition-colors flex items-center gap-1 ${tab === id ? "text-white" : "text-white/55"}`}>
                {id === "lives" && <Radio className="w-3.5 h-3.5" />}{label}
                {tab === id && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-[2.5px] rounded-full bg-white" />}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => navigate(tab === "lives" ? "/lives/start" : "/camera")} className="w-9 h-9 grid place-items-center rounded-full bg-black/35 text-white" data-testid="reels-create-btn" aria-label="Crear">
          {tab === "lives" ? <Radio className="w-5 h-5" /> : <Camera className="w-5 h-5" />}
        </button>
      </div>

      {!profileMode && !longMode && tab !== "lives" && <ReelsStoriesStrip token={token} user={user} visible={activeIndex === 0 && !loading && reels.length > 0} />}
      {!profileMode && !longMode && tab !== "lives" && <ContinueWatchingRow token={token} variant="reels" visible={activeIndex === 0 && !loading && reels.length > 0} />}
      <ReelsQuickRail token={token} user={user} visible={!profileMode && !longMode && tab !== "lives" && !loading}
        onFeed={() => { setTab("for_you"); setActiveIndex(0); if (containerRef.current) containerRef.current.scrollTop = 0; }} />

      {tab !== "lives" ? (
        loading ? (
          <BrunoLoader fullScreen={false} className="h-full" />
        ) : reels.length === 0 ? (
          <EmptyReels profileMode={profileMode} following={tab === "following"} onCreate={() => navigate("/camera")} onForYou={() => setTab("for_you")} />
        ) : (
          <div ref={containerRef} className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }} data-testid="reels-scroller">
            {reels.map((reel, index) => (
              <div key={reel.id} ref={(el) => (itemRefs.current[index] = el)} data-index={index} className="h-full w-full snap-start snap-always">
                {Math.abs(index - activeIndex) <= 2 ? (
                  <ReelItem
                    reel={reel} isActive={index === activeIndex} isNear={Math.abs(index - activeIndex) === 1}
                    globalMuted={globalMuted} onToggleMute={() => setGlobalMuted((m) => !m)}
                    onLike={handleLike} onFollow={handleFollow}
                    onOpenComments={setCommentsFor} onMinimize={handleMinimize}
                    onOpenRemixes={(r) => setRemixesOf(r.id)} onOpenSound={setSoundFor} onOpenLikers={setLikersFor} onOpenOptions={setOptionsFor}
                    onSwipeLeft={swipeLeft} onSwipeRight={swipeRight} currentUserId={user?.id}
                    longMode={longMode} token={token} onOpenChapters={(r, seek) => setChaptersFor({ reel: r, seek })}
                    noLoop={!!seriesId} onEnded={() => onEndedInSeries(index)}
                  />
                ) : (
                  <div className="h-full w-full reels-surface bg-center bg-cover opacity-70" style={{ backgroundImage: reel.poster_url || reel.thumbnail_url ? `url(${reel.poster_url || reel.thumbnail_url})` : undefined }} />
                )}
              </div>
            ))}
            {loadingMore && <div className="absolute bottom-24 inset-x-0 grid place-items-center pointer-events-none"><Loader2 className="w-5 h-5 text-white/70 animate-spin" /></div>}
          </div>
        )
      ) : (
        <LivesGrid token={token} navigate={navigate} />
      )}

      <ReelCommentsSheet reel={commentsFor} token={token} currentUserId={user?.id} highlightId={commentsFor?.id === initialReelId ? highlightCommentId : null} onClose={() => setCommentsFor(null)} onPosted={(id) => patchReel(id, (r) => ({ comments_count: (r.comments_count || 0) + 1 }))} onDeleted={(id, count) => patchReel(id, (r) => ({ comments_count: count ?? Math.max(0, (r.comments_count || 0) - 1) }))} />
      {optionsFor && <ReelOptionsSheet reel={optionsFor} token={token} currentUserId={user?.id} onClose={() => setOptionsFor(null)} onDeleted={(id) => removeReel(id)} onEdit={setEditFor} onHidden={(id) => removeReel(id)} onBlocked={(uid) => removeByAuthor(uid)} onSave={handleSave} onShare={setShareFor} onRemix={(r) => { if (requireAuth()) setRemixFor(r); }} />}
      {editFor && <ReelEditSheet reel={editFor} token={token} onClose={() => setEditFor(null)} onSaved={(id, patch) => patchReel(id, patch)} />}
      {autoNext && reels[autoNext.toIndex] && (
        <div className="absolute inset-x-4 z-40 rounded-2xl bg-black/80 backdrop-blur-md text-white p-3 flex items-center gap-3 reel-chrome" style={{ bottom: "calc(var(--nav-reserve, 64px) + 70px)" }} data-testid="series-autonext">
          <div className="w-16 h-10 rounded-lg overflow-hidden bg-white/10 shrink-0">{reels[autoNext.toIndex].thumbnail_url && <img src={reels[autoNext.toIndex].thumbnail_url} alt="" className="w-full h-full object-cover" />}</div>
          <div className="min-w-0 flex-1"><p className="text-[11px] text-white/70">Siguiente en {autoNext.secondsLeft} s</p><p className="text-sm font-semibold truncate">{(reels[autoNext.toIndex].content || "Siguiente video").split("\n")[0]}</p></div>
          <button onClick={() => setAutoNext((a) => ({ ...a, secondsLeft: 0 }))} className="h-8 px-3 rounded-full bg-white text-black text-xs font-bold" data-testid="series-autonext-now">Ver ya</button>
          <button onClick={() => setAutoNext(null)} className="h-8 px-3 rounded-full bg-white/15 text-xs font-semibold" data-testid="series-autonext-cancel">Cancelar</button>
        </div>
      )}
      {chaptersFor && <ChaptersSheet reel={chaptersFor.reel} chapters={getChapters(chaptersFor.reel)} currentTime={0} onSeek={chaptersFor.seek} isOwner={user?.id && user.id === (chaptersFor.reel.user_id || chaptersFor.reel.author?.id)} token={token} onSaved={(p) => patchReel(chaptersFor.reel.id, { chapters: p.chapters })} onClose={() => setChaptersFor(null)} />}
      {soundFor && <ReelSoundSheet reel={soundFor} token={token} onClose={() => setSoundFor(null)} onPick={(r) => { setSoundFor(null); navigate(`/reels?id=${r.id}`); }} />}
      <ReelLikersSheet reel={likersFor} token={token} onClose={() => setLikersFor(null)} onFollow={(uid, next) => reels.forEach((r) => { if ((r.author?.id || r.user_id) === uid) patchReel(r.id, { is_following: next }); })} />
      {shareFor && <ReelShareSheet reel={shareFor} token={token} onClose={() => setShareFor(null)} />}
      <ReelHistorySheet open={historyOpen} token={token} onClose={() => setHistoryOpen(false)} onPick={openFromHistory} />
      {remixFor && <ReelRemixSheet reel={remixFor} onClose={() => setRemixFor(null)} onPick={(m) => { const r = remixFor; setRemixFor(null); if (m === "list") setRemixesOf(r.id); else setStudio({ reel: r, mode: m }); }} />}
      <ReelRemixesSheet sourceId={remixesOf} token={token} onClose={() => setRemixesOf(null)} onPick={(r) => { setRemixesOf(null); navigate(`/reels?id=${r.id}`); }} />
      <AnimatePresence>
        {studio && (
          <RemixStudio reel={studio.reel} mode={studio.mode} token={token} onClose={() => setStudio(null)}
            onPublished={(post) => { setStudio(null); patchReel(studio.reel.id, (r) => ({ remix_count: (r.remix_count || 0) + 1 })); if (post?.id) navigate(`/reels?id=${post.id}`); }} />
        )}
      </AnimatePresence>
    </div>
  );
}

function EmptyReels({ profileMode, following, onCreate, onForYou }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-foreground p-8 relative bruno-watermark" data-testid="reels-empty">
      <div className="relative w-24 h-24 rounded-[28px] bg-card border border-border/60 shadow-sm grid place-items-center mb-5">
        <span className="absolute inset-0 rounded-[28px] bg-primary/10 blur-xl" />
        <BrunoLogo variant="icon" tone="orange" className="relative w-14 bubble-float" />
      </div>
      <h2 className="text-xl font-bold mb-2">{profileMode ? "Sin reels todavía" : following ? "Sigue a creadores" : "No hay reels"}</h2>
      <p className="text-muted-foreground text-sm text-center mb-6">{profileMode ? "Este perfil aún no publicó videos" : following ? "Los reels de quienes sigues aparecerán aquí" : "Sé el primero en compartir un video corto"}</p>
      {!profileMode && (following
        ? <button onClick={onForYou} className="px-5 h-10 rounded-full bg-foreground text-background text-sm font-semibold" data-testid="reels-goto-foryou">Explorar Para ti</button>
        : <button onClick={onCreate} className="px-5 h-10 rounded-full bg-primary text-white text-sm font-semibold inline-flex items-center gap-2 shadow-lg shadow-primary/25" data-testid="reels-create-first"><Plus className="w-4 h-4" /> Crear Reel</button>)}
    </div>
  );
}

function LivesGrid({ token, navigate }) {
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () => axios.get(`${API}/lives`).then((r) => alive && setLives(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => alive && setLoading(false));
    load();
    const t = setInterval(load, 15000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const joinPrivate = () => {
    const c = code.trim().toUpperCase();
    if (c.length < 6) return brunoToast.error("Ingresa el código de 6 caracteres");
    navigate(`/lives/join?code=${c}`);
  };

  return (
    <div className="h-full overflow-y-auto px-4 pb-32" style={{ paddingTop: "calc(var(--safe-top) + 64px)" }} data-testid="lives-grid">
      <UpcomingLives token={token} />
      {/* Private access */}
      <div className="bruno-glass rounded-[22px] border p-3 mb-4 flex items-center gap-2" data-testid="lives-private-join">
        <Lock className="w-4 h-4 text-primary shrink-0" />
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))} placeholder="Código de live privado" maxLength={6}
          className="flex-1 bg-transparent outline-none text-sm tracking-[0.2em] font-mono placeholder:tracking-normal placeholder:font-sans" data-testid="lives-private-code-input" />
        <button onClick={joinPrivate} className="h-9 px-3 rounded-full bg-primary text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="lives-private-join-btn"><KeyRound className="w-3.5 h-3.5" /> Entrar</button>
      </div>

      {loading ? <div className="grid place-items-center py-16"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>
        : lives.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-white py-16" data-testid="lives-empty">
            <div className="w-20 h-20 bg-white/10 rounded-full grid place-items-center mb-4"><Radio className="w-10 h-10" /></div>
            <h2 className="text-xl font-bold mb-2">No hay transmisiones</h2>
            <p className="text-white/50 text-sm text-center mb-6">Nadie está en vivo ahora. ¡Sé el primero!</p>
            <button onClick={() => navigate(token ? "/lives/start" : "/login")} className="px-5 h-11 rounded-full bg-red-500 text-white text-sm font-semibold inline-flex items-center gap-2" data-testid="lives-start-btn"><Radio className="w-4 h-4" /> Iniciar Live</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {lives.map((live) => (
              <Link key={live.id} to={`/lives/${live.id}`} className="relative rounded-2xl overflow-hidden aspect-[3/4] bg-zinc-900 no-glass" data-testid={`live-item-${live.id}`}>
                {live.host_avatar && <img src={live.host_avatar} alt="" className="w-full h-full object-cover opacity-80" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold"><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> EN VIVO</div>
                <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px]"><Eye className="w-2.5 h-2.5" /> {live.viewer_count || 0}</div>
                <div className="absolute bottom-2 left-2 right-2">
                  <p className="text-white text-xs font-bold truncate">{live.title || "En vivo"}</p>
                  <p className="text-white/60 text-[10px] truncate">@{live.host_name || "usuario"}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
    </div>
  );
}
