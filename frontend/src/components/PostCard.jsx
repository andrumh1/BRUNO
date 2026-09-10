import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import FeedVideo from "@/components/FeedVideo";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineVerifiedBadge } from "@/components/VerifiedBadge";
import { ReportButton } from "@/components/ReportContentModal";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";
import ReactionBubble, { useReactionTrigger, BRUNO_REACTIONS } from "@/components/bruno/ReactionBubble";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Send,
  Bookmark,
  BookmarkCheck,
  Play,
  Repeat2,
  Minimize2
} from "lucide-react";
import { useNavScroll } from "@/contexts/NavScrollContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const REACTIONS = BRUNO_REACTIONS; // legacy fallback - same emoji list

// Render content with clickable hashtags and @mentions
const RenderContent = ({ content }) => {
  if (!content) return null;
  
  const parts = content.split(/(#\w+|@\w+)/g);
  return (
    <p className="px-4 pb-3 text-sm whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <Link key={`h-${i}-${part}`} to={`/hashtag/${part.slice(1)}`} className="text-primary font-medium hover:underline" data-testid={`hashtag-${part.slice(1)}`}>
              {part}
            </Link>
          );
        }
        if (part.startsWith("@")) {
          const username = part.slice(1);
          return (
            <Link key={`m-${i}-${username}`} to={`/profile/${username}`} className="text-sky-500 font-medium hover:underline" data-testid={`mention-${username}`}>
              {part}
            </Link>
          );
        }
        return <span key={`t-${i}`}>{part}</span>;
      })}
    </p>
  );
};

// Floating reaction particle animation (emoji-based)
const ReactionParticle = ({ emoji }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{ 
      opacity: 0, 
      y: -60, 
      scale: 1.5,
      x: Math.random() * 40 - 20 
    }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="absolute pointer-events-none text-2xl"
  >
    {emoji}
  </motion.div>
);

const PostCard = ({ post, onLike, onLikeUpdate, onComment, onDelete, onAvatarClick, defaultShowComments = false, highlightCommentId = null }) => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { addMinimizedItem } = useNavScroll();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [sharesCount, setSharesCount] = useState(post.shares_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(post.user_reaction || null);
  const [particles, setParticles] = useState([]);

  const spawnParticle = (emoji) => {
    const id = Date.now() + Math.random();
    setParticles(prev => [...prev, { id, emoji }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 900);
  };

  // Optimistic like: flip UI first, rollback on error
  const handleLike = async () => {
    if (!token) return;
    const wasLiked = isLiked;
    const prevCount = likesCount;
    setIsLiked(!wasLiked);
    setLikesCount(prev => prev + (wasLiked ? -1 : 1));
    if (!wasLiked) spawnParticle("👍");
    try {
      const res = await axios.post(`${API}/posts/${post.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Reconcile with server
      setIsLiked(res.data.liked);
      setLikesCount(res.data.likes_count);
      if (onLike) onLike(post.id, res.data);
      if (onLikeUpdate) onLikeUpdate(post.id, res.data);
    } catch (e) {
      // rollback
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
    }
  };

  // Long-press emoji reaction: optimistic + server sync
  const handleReactionPick = async (reaction) => {
    if (!token || !reaction) return;
    const prev = { isLiked, likesCount, currentReaction };
    setCurrentReaction(reaction.key);
    setIsLiked(true);
    if (!isLiked) setLikesCount(c => c + 1);
    spawnParticle(reaction.emoji);
    try {
      const res = await axios.post(`${API}/posts/${post.id}/react?reaction_type=${reaction.key}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.data.reacted) {
        setCurrentReaction(null);
        setIsLiked(false);
        setLikesCount(c => Math.max(0, c - 1));
      }
    } catch (e) {
      setIsLiked(prev.isLiked);
      setLikesCount(prev.likesCount);
      setCurrentReaction(prev.currentReaction);
    }
  };

  const reactionTrigger = useReactionTrigger({
    onTap: handleLike,
    onReact: handleReactionPick,
  });

  const handleBookmark = async () => {
    if (!token) return;
    try {
      const res = await axios.post(`${API}/posts/${post.id}/bookmark`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsBookmarked(res.data.bookmarked);
    } catch (e) { }
  };

  const handleRepost = async () => {
    if (!token) return;
    setSharesCount(c => c + 1);
    try {
      await axios.post(`${API}/posts/${post.id}/repost`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const { brunoToast } = await import("@/components/bruno/BrunoToast");
      brunoToast.success("Compartido", { description: "La publicación está ahora en tu perfil." });
    } catch (e) {
      setSharesCount(c => Math.max(0, c - 1));
      const { brunoToast } = await import("@/components/bruno/BrunoToast");
      brunoToast.error("No se pudo compartir");
    }
  };

  const handleShare = async () => {
    // Use BRUNO meta-card URL for rich previews on WhatsApp/Twitter/Telegram
    const shareUrl = `${process.env.REACT_APP_BACKEND_URL}/api/share/p/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.user?.display_name || post.user?.username || "BRUNO"}`,
          text: post.content || "Mira esta publicacion en BRUNO",
          url: shareUrl,
        });
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.success("Compartido");
      } catch (e) {
        // user cancelled — no feedback needed
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.success("Link copiado", { description: "Pégalo donde quieras compartir." });
      } catch (e) {
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.error("No se pudo copiar el link");
      }
    }
  };

  const loadComments = async () => {
    if (comments.length > 0) { setShowComments(!showComments); return; }
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/posts/${post.id}/comments`);
      setComments(res.data);
      setShowComments(true);
    } catch (e) { } finally { setLoadingComments(false); }
  };

  useEffect(() => {
    if (defaultShowComments && comments.length === 0) loadComments();
  }, [defaultShowComments]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlightCommentId || !showComments || comments.length === 0) return;
    const t = setTimeout(() => document.getElementById(`comment-${highlightCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
    return () => clearTimeout(t);
  }, [highlightCommentId, showComments, comments.length]);

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !token) return;
    const text = newComment.trim();
    setNewComment("");
    // Optimistic comment: render immediately with a temp id
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      content: text,
      user: { id: user?.id, username: user?.username, display_name: user?.display_name, avatar_url: user?.avatar_url },
      _optimistic: true,
    };
    setComments(prev => [optimistic, ...prev]);
    setCommentsCount(c => c + 1);
    try {
      const res = await axios.post(`${API}/posts/${post.id}/comments`, { content: text }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(prev => prev.map(c => c.id === tempId ? res.data : c));
    } catch (e) {
      // rollback on error
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentsCount(c => Math.max(0, c - 1));
      setNewComment(text);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Eliminar este post?")) return;
    try {
      await axios.delete(`${API}/posts/${post.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (onDelete) onDelete(post.id);
    } catch (e) { }
  };

  const formatDate = (dateString) => {
    const diff = Date.now() - new Date(dateString);
    const m = Math.floor(diff / 60000);
    if (m < 1) return "Ahora";
    if (m < 60) return `${m}m`;
    const h = Math.floor(diff / 3600000);
    if (h < 24) return `${h}h`;
    const d = Math.floor(diff / 86400000);
    if (d < 7) return `${d}d`;
    return new Date(dateString).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };

  const onLongPressStart = () => {};
  const onLongPressEnd = () => {};

  const activeReaction = BRUNO_REACTIONS.find(r => r.key === currentReaction) || BRUNO_REACTIONS[0];
  const isRepost = post.post_type === "repost";

  return (
    <Card className="glass-card spring-item overflow-hidden" data-testid={`post-card-${post.id}`}>
      <CardContent className="p-0">
        {/* Repost header */}
        {isRepost && (
          <div className="px-4 pt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Repeat2 className="w-3.5 h-3.5" />
            <span>Compartido por {post.user?.display_name || post.user?.username}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-3">
            {/* Avatar with story ring (global sync) */}
            <button
              onClick={() => onAvatarClick ? onAvatarClick(post.user) : navigate(`/profile/${post.user?.id}`)}
              className="relative shrink-0 group hover:scale-105 transition-transform"
              data-testid="post-user-avatar-btn"
            >
              <BrunoAvatar
                userId={post.user?.id}
                src={post.user?.avatar_url}
                name={post.user?.display_name || post.user?.username}
                size={40}
                thickness={2}
              />
            </button>
            {/* Name - navigates to profile */}
            <Link to={`/profile/${post.user?.id}`} className="hover:opacity-80 transition-opacity" data-testid="post-user-profile-link">
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm">{post.user?.display_name || post.user?.username}</span>
                <InlineVerifiedBadge tier={post.user?.subscription_tier} />
              </div>
              <span className="text-xs text-muted-foreground">{formatDate(post.created_at)}</span>
            </Link>
          </div>
          
          <div className="relative">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowMenu(!showMenu)} data-testid="post-menu-btn">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 bg-card border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                  {user?.id === post.user_id && (
                    <button onClick={handleDelete} className="w-full px-4 py-2 text-sm text-left hover:bg-muted text-destructive" data-testid="post-delete-btn">
                      Eliminar
                    </button>
                  )}
                  <button onClick={() => { handleRepost(); setShowMenu(false); }} className="w-full px-4 py-2 text-sm text-left hover:bg-muted flex items-center gap-2">
                    <Repeat2 className="w-3.5 h-3.5" /> Compartir en mi perfil
                  </button>
                  <button onClick={() => {
                    addMinimizedItem({
                      id: post.id,
                      itemType: 'post',
                      title: (post.content || '').slice(0, 40) + ((post.content || '').length > 40 ? '...' : ''),
                      thumbnail: post.media?.[0]?.url || post.user?.avatar_url || null,
                    });
                    setShowMenu(false);
                  }} className="w-full px-4 py-2 text-sm text-left hover:bg-muted flex items-center gap-2" data-testid="post-minimize-btn">
                    <Minimize2 className="w-3.5 h-3.5" /> Minimizar
                  </button>
                  {user?.id !== post.user_id && (
                    <ReportButton
                      contentType="post" contentId={post.id}
                      variant="ghost" size="sm"
                      className="w-full justify-start px-4 py-2 text-sm text-left hover:bg-muted text-destructive rounded-none h-auto"
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Content with hashtags and @mentions */}
        <RenderContent content={post.content} />

        {/* Hashtag pills */}
        {post.hashtags && post.hashtags.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-1.5">
            {post.hashtags.map((tag, i) => (
              <Link key={`tag-${i}`} to={`/hashtag/${tag}`} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors" data-testid={`hashtag-pill-${tag}`}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className={`grid gap-1 ${post.media.length === 1 ? '' : 'grid-cols-2'}`}>
            {post.media.slice(0, 4).map((media, i) => (
              <div key={`media-${i}`} className={`relative ${post.media.length === 1 ? 'aspect-video' : 'aspect-square'} bg-muted overflow-hidden`}>
                {media.type === "image" ? (
                  <img src={media.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : media.type === "video" ? (
                  <FeedVideo media={media} />
                ) : null}
                {i === 3 && post.media.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">+{post.media.length - 4}</div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Shared Card */}
        {post.card_id && post.post_type === "card_share" && (
          <Link to={`/c/${post.card_id}`} className="block mx-4 mb-3">
            <div className="border rounded-xl p-3 hover:bg-muted/50 transition-colors">
              <p className="text-sm text-muted-foreground">Tarjeta compartida</p>
            </div>
          </Link>
        )}

        {/* Long-press reaction bubble (rendered as fixed-position via portal-like flow) */}
        <ReactionBubble
          bubble={reactionTrigger.bubble}
          hover={reactionTrigger.hover}
          onPick={(r) => { reactionTrigger.close(r); }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t relative">
          {/* Floating reaction particles (emoji) */}
          <div className="absolute left-6 bottom-8 pointer-events-none">
            <AnimatePresence>
              {particles.map(p => (
                <ReactionParticle key={p.id} emoji={p.emoji} />
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              ref={reactionTrigger.triggerRef}
              {...reactionTrigger.handlers}
              onClick={(e) => {
                // Suppress tap action if the long-press bubble fired (user picked
                // an emoji via the bubble flow instead).
                if (reactionTrigger.longPressFired?.current) {
                  reactionTrigger.longPressFired.current = false;
                  return;
                }
                handleLike();
              }}
              className={`flex items-center gap-1.5 transition-all active:scale-90 ${isLiked ? "text-orange-500" : "text-muted-foreground hover:text-red-500"}`}
              data-testid="post-like-btn"
              aria-label={isLiked ? `Reaccion: ${activeReaction.label}` : "Me gusta"}
            >
              <motion.div
                key={currentReaction || "default"}
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
                className="grid place-items-center"
              >
                {currentReaction ? (
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{activeReaction.emoji}</span>
                ) : (
                  <Heart className={`w-5 h-5 ${isLiked ? "fill-current text-orange-500" : ""}`} />
                )}
              </motion.div>
              <span className="text-sm font-medium">{likesCount}</span>
            </button>
            
            <button onClick={loadComments} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors" data-testid="post-comment-btn">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{commentsCount}</span>
            </button>
            
            <button onClick={handleRepost} className="flex items-center gap-1.5 text-muted-foreground hover:text-green-500 transition-colors" data-testid="post-repost-btn">
              <Repeat2 className="w-5 h-5" />
              <span className="text-sm font-medium">{sharesCount}</span>
            </button>

            <button onClick={handleShare} className="text-muted-foreground hover:text-primary transition-colors" data-testid="post-share-btn">
              <Share2 className="w-4.5 h-4.5" />
            </button>
          </div>
          
          <motion.button
            onClick={handleBookmark}
            whileTap={{ scale: 0.8 }}
            className={`transition-colors ${isBookmarked ? "text-primary" : "text-muted-foreground hover:text-primary"}`}
            data-testid="post-bookmark-btn"
          >
            <motion.div
              key={isBookmarked ? "saved" : "unsaved"}
              initial={{ scale: 0.7 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500 }}
            >
              {isBookmarked ? <BookmarkCheck className="w-5 h-5 fill-current" /> : <Bookmark className="w-5 h-5" />}
            </motion.div>
          </motion.button>
        </div>

        {/* Comments */}
        {showComments && (
          <div className="border-t px-4 py-3 space-y-3">
            {token && (
              <form onSubmit={handleComment} className="flex gap-2">
                <Input value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escribe un comentario... usa @usuario para mencionar" className="flex-1 h-9 text-sm" data-testid="comment-input" />
                <Button type="submit" size="sm" disabled={!newComment.trim()} data-testid="comment-submit"><Send className="w-4 h-4" /></Button>
              </form>
            )}
            {loadingComments ? (
              <p className="text-sm text-muted-foreground text-center py-2">Cargando...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No hay comentarios</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => (
                  <div key={c.id} id={`comment-${c.id}`} data-testid={`post-comment-${c.id}`} className={`flex gap-2 rounded-xl transition-colors ${highlightCommentId === c.id ? "bg-primary/10 ring-2 ring-primary/40 p-2 -m-1" : ""}`}>
                    <Link to={`/profile/${c.user?.id}`}>
                      {c.user?.avatar_url ? (
                        <img src={c.user.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                          {(c.user?.username || "U")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2">
                      <Link to={`/profile/${c.user?.id}`} className="font-medium text-sm hover:underline">
                        {c.user?.display_name || c.user?.username}
                      </Link>
                      <RenderContent content={c.content} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PostCard;
