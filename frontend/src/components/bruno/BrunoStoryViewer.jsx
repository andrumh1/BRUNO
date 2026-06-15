import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { X, ChevronLeft, ChevronRight, Eye, Send, Volume2, VolumeX, BarChart3 } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import StoryInsightsModal from "@/components/bruno/StoryInsightsModal";

/**
 * BrunoStoryViewer — Instagram/TikTok-style story viewer with:
 *   • Tap-right to advance, tap-left to go back
 *   • Press-and-hold to pause (timer freezes, video pauses)
 *   • Swipe-down to close (drag-to-dismiss with opacity + scale)
 *   • Quick reactions bar (emoji burst animation on tap)
 *   • Progress bars + view count + Bruno-branded header
 *   • Mark viewed on display, multi-user navigation
 *
 * Props (same shape as legacy StoryViewer):
 *   userStories: { user_id, user_name, avatar_url, stories: [...] }
 *   allUsers: array
 *   onClose()
 *   onNavigate(userStories)
 */

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export default function BrunoStoryViewer({
  userStories,
  allUsers = [],
  onClose,
  onNavigate,
}) {
  const { token, user } = useAuth();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [bursts, setBursts] = useState([]); // floating reaction emojis
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [answersCount, setAnswersCount] = useState(0);

  const videoRef = useRef(null);
  const rafRef = useRef(null);
  const startedAtRef = useRef(0);
  const elapsedBeforePauseRef = useRef(0);

  const stories = userStories?.stories || [];
  const story = stories[index];
  const durationMs = (story?.duration || 5) * 1000;

  const dragY = useMotionValue(0);
  const overlayOpacity = useTransform(dragY, [0, 240], [1, 0.2]);
  const cardScale = useTransform(dragY, [0, 240], [1, 0.85]);

  // ─── Mark viewed ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story || !token) return;
    axios
      .post(
        `${API}/stories/${story.id}/view`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .catch(() => {});
  }, [story?.id, token]);

  // ─── Fetch answers count (for "X respuestas · Ver resultados" badge) ────
  useEffect(() => {
    if (!story) { setAnswersCount(0); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/stories/${story.id}/public-insights`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) setAnswersCount(r.data?.answers_count || 0);
      } catch (_e) {
        if (!cancelled) setAnswersCount(0);
      }
    })();
    return () => { cancelled = true; };
  }, [story?.id, token]);

  // ─── Progress + auto-advance ────────────────────────────────────────────
  const goNext = useCallback(() => {
    if (index < stories.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      const i = allUsers.findIndex((u) => u.user_id === userStories.user_id);
      if (i >= 0 && i < allUsers.length - 1) {
        onNavigate?.(allUsers[i + 1]);
      } else {
        onClose?.();
      }
    }
  }, [index, stories.length, allUsers, userStories?.user_id, onNavigate, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
      elapsedBeforePauseRef.current = 0;
    } else {
      const i = allUsers.findIndex((u) => u.user_id === userStories.user_id);
      if (i > 0) onNavigate?.(allUsers[i - 1]);
    }
  }, [index, allUsers, userStories?.user_id, onNavigate]);

  useEffect(() => {
    if (!story || paused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    startedAtRef.current = performance.now() - elapsedBeforePauseRef.current;

    const tick = () => {
      const elapsed = performance.now() - startedAtRef.current;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        elapsedBeforePauseRef.current = 0;
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      elapsedBeforePauseRef.current = performance.now() - startedAtRef.current;
    };
  }, [index, paused, durationMs, goNext, story?.id]);

  // ─── Video pause/play on press-and-hold ─────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else v.play?.().catch(() => {});
  }, [paused, story?.id]);

  // ─── Hold-to-pause handlers ─────────────────────────────────────────────
  const holdTimerRef = useRef(null);
  const tappedRef = useRef(false);

  const handlePointerDown = (e) => {
    tappedRef.current = true;
    holdTimerRef.current = setTimeout(() => {
      tappedRef.current = false;
      setPaused(true);
    }, 220);
  };
  const handlePointerUp = (e) => {
    clearTimeout(holdTimerRef.current);
    if (paused) {
      setPaused(false);
      return;
    }
    if (!tappedRef.current) return;
    // It was a tap (not a hold) — advance/back based on x position
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0) - rect.left;
    if (x < rect.width / 2) goPrev();
    else goNext();
  };
  const handlePointerCancel = () => {
    clearTimeout(holdTimerRef.current);
    if (paused) setPaused(false);
  };

  // ─── Quick reactions ────────────────────────────────────────────────────
  const sendReaction = async (emoji) => {
    setBursts((arr) => [
      ...arr,
      { id: Math.random().toString(36).slice(2), emoji, x: 30 + Math.random() * 40 },
    ]);
    setTimeout(
      () => setBursts((arr) => arr.slice(1)),
      1100
    );
    if (!token || !story) return;
    try {
      await axios.post(
        `${API}/stories/${story.id}/react?reaction=${encodeURIComponent(emoji)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {
      /* non-blocking */
    }
  };

  // ─── Send reply (as DM) ─────────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!replyText.trim() || !story) return;
    try {
      // Find or create chat with story author
      const chatRes = await axios.post(
        `${API}/chats`,
        { participant_id: story.user_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const chatId = chatRes.data?.id || chatRes.data?.chat_id;
      if (!chatId) throw new Error("no chat id");
      await axios.post(
        `${API}/chats/${chatId}/messages`,
        {
          content: `↩️ Respondiendo a story: ${replyText}`,
          message_type: "text",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      brunoToast.success("Respuesta enviada");
      setReplyText("");
      setShowReply(false);
    } catch (_) {
      brunoToast.error("No se pudo enviar la respuesta");
    }
  };

  if (!story) return null;

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{ opacity: overlayOpacity }}
        className="fixed inset-0 z-[140] bg-black grid place-items-center"
        data-testid="bruno-story-viewer"
      >
        <motion.div
          drag="y"
          dragDirectionLock
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.5 }}
          style={{ y: dragY, scale: cardScale }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 140 || info.velocity.y > 700) {
              onClose?.();
            }
          }}
          className="relative w-full max-w-md h-full sm:h-[90vh] sm:rounded-2xl overflow-hidden bg-black"
        >
          {/* Media stage */}
          <div
            className="absolute inset-0 select-none"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            data-testid="bruno-story-stage"
          >
            {story.media_type === "video" ? (
              <video
                ref={videoRef}
                key={story.id}
                src={story.media_url}
                autoPlay
                playsInline
                muted={muted}
                loop={false}
                className="h-full w-full object-cover"
                onEnded={goNext}
              />
            ) : (
              <img
                src={story.media_url}
                alt="story"
                className="h-full w-full object-cover"
                draggable={false}
              />
            )}

            {/* Caption */}
            {story.caption && (
              <motion.div
                key={`cap-${story.id}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute left-4 right-4 bottom-40 sm:bottom-32 text-center"
              >
                <p className="inline-block text-white text-sm font-medium bg-black/40 backdrop-blur-sm rounded-2xl px-3 py-2 max-w-full">
                  {story.caption}
                </p>
              </motion.div>
            )}

            {/* Pause indicator */}
            <AnimatePresence>
              {paused && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 grid place-items-center pointer-events-none"
                >
                  <div className="grid grid-cols-2 gap-1.5">
                    <span className="w-1.5 h-12 rounded-full bg-white/80" />
                    <span className="w-1.5 h-12 rounded-full bg-white/80" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Floating reaction bursts */}
            <AnimatePresence>
              {bursts.map((b) => (
                <motion.span
                  key={b.id}
                  initial={{ y: 0, opacity: 1, scale: 0.8 }}
                  animate={{ y: -260, opacity: 0, scale: 1.6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.05, ease: "easeOut" }}
                  style={{ left: `${b.x}%`, bottom: 100 }}
                  className="absolute text-5xl pointer-events-none"
                >
                  {b.emoji}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>

          {/* Progress bars */}
          <div className="absolute top-2 left-2 right-2 z-20 flex gap-1 pointer-events-none">
            {stories.map((s, idx) => (
              <div
                key={s?.id || `story-bar-${idx}`}
                className="flex-1 h-[3px] bg-white/25 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-white rounded-full"
                  style={{
                    width:
                      idx < index
                        ? "100%"
                        : idx === index
                        ? `${progress}%`
                        : "0%",
                    transition: idx === index ? "none" : "width 0.2s",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-5 left-3 right-3 z-20 flex items-center gap-2 pointer-events-none">
            <div className="flex items-center gap-2 pointer-events-auto">
              <div className="h-9 w-9 rounded-full overflow-hidden ring-2 ring-orange-500/70 bg-zinc-800">
                {userStories.avatar_url ? (
                  <img
                    src={userStories.avatar_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid place-items-center h-full text-white text-sm font-bold">
                    {userStories.user_name?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="leading-tight">
                <p className="text-white text-sm font-semibold">
                  {userStories.user_name || "Bruno"}
                </p>
                <p className="text-white/60 text-[10px] uppercase tracking-wider">
                  {timeAgo(story.created_at)}
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1 pointer-events-auto">
              {story.media_type === "video" && (
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="grid place-items-center h-9 w-9 rounded-full bg-white/10 backdrop-blur text-white"
                  aria-label="Mute"
                  data-testid="bruno-story-mute"
                >
                  {muted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
              )}
              <button
                onClick={onClose}
                className="grid place-items-center h-9 w-9 rounded-full bg-white/10 backdrop-blur text-white"
                aria-label="Cerrar"
                data-testid="bruno-story-close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Side navigation hints (desktop only) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            className="hidden sm:grid absolute left-2 top-1/2 -translate-y-1/2 z-10 place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
            aria-label="Anterior"
            data-testid="bruno-story-prev"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            className="hidden sm:grid absolute right-2 top-1/2 -translate-y-1/2 z-10 place-items-center h-10 w-10 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20"
            aria-label="Siguiente"
            data-testid="bruno-story-next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Bottom — reactions + reply */}
          <div className="absolute bottom-0 left-0 right-0 z-20 pb-4 pt-12 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
            {/* Reply input — toggleable */}
            <AnimatePresence>
              {showReply && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  className="px-4 mb-3"
                >
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur rounded-full border border-white/20 px-3 py-2">
                    <input
                      autoFocus
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onFocus={() => setPaused(true)}
                      onBlur={() => setPaused(false)}
                      onKeyDown={(e) =>
                        e.key === "Enter" ? handleSendReply() : null
                      }
                      placeholder="Responder al story..."
                      data-testid="bruno-story-reply-input"
                      className="flex-1 bg-transparent text-white text-sm placeholder:text-white/50 outline-none"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      data-testid="bruno-story-reply-send"
                      className="grid place-items-center h-8 w-8 rounded-full bg-orange-500 text-white disabled:opacity-40"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Insights link — shown when story has interactive content */}
            {(story.poll_id || answersCount > 0 || story.user_id === user?.id) && (
              <div className="px-4 mb-2 flex items-center justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); setPaused(true); setInsightsOpen(true); }}
                  data-testid="bruno-story-insights-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur text-white text-xs font-semibold border border-white/15 hover:bg-white/20"
                >
                  <BarChart3 className="h-3.5 w-3.5" />
                  {story.user_id === user?.id
                    ? "Insights"
                    : answersCount > 0
                      ? `${answersCount} ${answersCount === 1 ? "respuesta" : "respuestas"} · Ver resultados`
                      : "Ver resultados"}
                </button>
              </div>
            )}

            {/* Quick reactions row */}
            <div className="flex items-center justify-center gap-1.5 px-4">
              {QUICK_REACTIONS.map((e) => (
                <motion.button
                  key={e}
                  whileTap={{ scale: 0.7 }}
                  whileHover={{ scale: 1.15 }}
                  onClick={() => sendReaction(e)}
                  data-testid={`bruno-story-react-${e}`}
                  className="text-2xl rounded-full h-11 w-11 grid place-items-center bg-white/10 backdrop-blur hover:bg-white/20"
                >
                  {e}
                </motion.button>
              ))}
              {!showReply && (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowReply(true)}
                  data-testid="bruno-story-reply-toggle"
                  className="ml-1 text-xs font-semibold rounded-full px-3 h-11 bg-orange-500 text-white"
                >
                  Responder
                </motion.button>
              )}
            </div>

            {/* Own-story view count */}
            {story.user_id === user?.id && (
              <p className="mt-3 text-center text-white/60 text-xs flex items-center justify-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {(story.views || []).length} vistas
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Insights modal */}
      <StoryInsightsModal
        open={insightsOpen}
        onClose={() => { setInsightsOpen(false); setPaused(false); }}
        storyId={story?.id}
        isOwner={story?.user_id === user?.id}
      />
    </AnimatePresence>
  );
}

function timeAgo(iso) {
  if (!iso) return "ahora";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
