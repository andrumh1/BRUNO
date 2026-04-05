import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineVerifiedBadge } from "@/components/VerifiedBadge";
import { ReportButton } from "@/components/ReportContentModal";
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
  Flame,
  Laugh,
  Frown,
  ThumbsUp,
  Repeat2,
  X
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const REACTIONS = [
  { type: "like", icon: Heart, label: "Me gusta", color: "text-red-500", bg: "bg-red-500/10", fill: true },
  { type: "love", icon: Heart, label: "Encanta", color: "text-pink-500", bg: "bg-pink-500/10", fill: true },
  { type: "fire", icon: Flame, label: "Fuego", color: "text-orange-500", bg: "bg-orange-500/10", fill: false },
  { type: "laugh", icon: Laugh, label: "Jaja", color: "text-yellow-500", bg: "bg-yellow-500/10", fill: false },
  { type: "wow", icon: ThumbsUp, label: "Wow", color: "text-blue-500", bg: "bg-blue-500/10", fill: false },
  { type: "sad", icon: Frown, label: "Triste", color: "text-purple-500", bg: "bg-purple-500/10", fill: false },
];

// Render content with clickable hashtags and @mentions
const RenderContent = ({ content }) => {
  if (!content) return null;
  
  const parts = content.split(/(#\w+|@\w+)/g);
  return (
    <p className="px-4 pb-3 text-sm whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          return (
            <Link key={i} to={`/hashtag/${part.slice(1)}`} className="text-primary font-medium hover:underline" data-testid={`hashtag-${part.slice(1)}`}>
              {part}
            </Link>
          );
        }
        if (part.startsWith("@")) {
          const username = part.slice(1);
          return (
            <Link key={i} to={`/profile/${username}`} className="text-sky-500 font-medium hover:underline" data-testid={`mention-${username}`}>
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
};

// Floating reaction particle animation
const ReactionParticle = ({ icon: Icon, color, fill }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{ 
      opacity: 0, 
      y: -60, 
      scale: 1.3,
      x: Math.random() * 40 - 20 
    }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.8, ease: "easeOut" }}
    className="absolute pointer-events-none"
  >
    <Icon className={`w-5 h-5 ${color} ${fill ? "fill-current" : ""}`} />
  </motion.div>
);

const PostCard = ({ post, onLike, onLikeUpdate, onComment, onDelete, onAvatarClick }) => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [isBookmarked, setIsBookmarked] = useState(post.is_bookmarked || false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [currentReaction, setCurrentReaction] = useState(null);
  const [particles, setParticles] = useState([]);
  const reactionTimeout = useRef(null);

  const spawnParticle = (reaction) => {
    const id = Date.now() + Math.random();
    setParticles(prev => [...prev, { id, ...reaction }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 900);
  };

  const handleLike = async () => {
    if (!token) return;
    try {
      const res = await axios.post(`${API}/posts/${post.id}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsLiked(res.data.liked);
      setLikesCount(res.data.likes_count);
      if (res.data.liked) spawnParticle(REACTIONS[0]);
      if (onLike) onLike(post.id, res.data);
      if (onLikeUpdate) onLikeUpdate(post.id, res.data);
    } catch (e) { console.error(e); }
  };

  const handleReaction = async (type) => {
    if (!token) return;
    setShowReactions(false);
    const reaction = REACTIONS.find(r => r.type === type);
    try {
      const res = await axios.post(`${API}/posts/${post.id}/react?reaction_type=${type}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.reacted) {
        setCurrentReaction(type);
        setIsLiked(true);
        setLikesCount(prev => prev + (isLiked ? 0 : 1));
        if (reaction) spawnParticle(reaction);
      } else {
        setCurrentReaction(null);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      }
    } catch (e) { console.error(e); }
  };

  const handleBookmark = async () => {
    if (!token) return;
    try {
      const res = await axios.post(`${API}/posts/${post.id}/bookmark`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsBookmarked(res.data.bookmarked);
    } catch (e) { console.error(e); }
  };

  const handleRepost = async () => {
    if (!token) return;
    try {
      await axios.post(`${API}/posts/${post.id}/repost`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert("Publicacion compartida en tu perfil!");
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.user?.display_name || post.user?.username}`,
          text: post.content,
          url: `${window.location.origin}/post/${post.id}`
        });
      } catch (e) {}
    } else {
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
    }
  };

  const loadComments = async () => {
    if (comments.length > 0) { setShowComments(!showComments); return; }
    setLoadingComments(true);
    try {
      const res = await axios.get(`${API}/posts/${post.id}/comments`);
      setComments(res.data);
      setShowComments(true);
    } catch (e) { console.error(e); } finally { setLoadingComments(false); }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !token) return;
    try {
      const res = await axios.post(`${API}/posts/${post.id}/comments`, { content: newComment }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments([res.data, ...comments]);
      setNewComment("");
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!window.confirm("Eliminar este post?")) return;
    try {
      await axios.delete(`${API}/posts/${post.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (onDelete) onDelete(post.id);
    } catch (e) { console.error(e); }
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

  const onLongPressStart = () => {
    reactionTimeout.current = setTimeout(() => setShowReactions(true), 400);
  };
  const onLongPressEnd = () => {
    if (reactionTimeout.current) clearTimeout(reactionTimeout.current);
  };

  const activeReaction = REACTIONS.find(r => r.type === currentReaction) || REACTIONS[0];
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
            {/* Avatar - opens stories if available */}
            <button 
              onClick={() => onAvatarClick ? onAvatarClick(post.user) : navigate(`/profile/${post.user?.id}`)}
              className="relative shrink-0 group"
              data-testid="post-user-avatar-btn"
            >
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-full bg-background p-[1px]">
                  <div className="w-full h-full rounded-full overflow-hidden">
                    {post.user?.avatar_url ? (
                      <img src={post.user.avatar_url} alt={post.user.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                        {(post.user?.display_name || post.user?.username || "U")[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
              <Link key={i} to={`/hashtag/${tag}`} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors" data-testid={`hashtag-pill-${tag}`}>
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className={`grid gap-1 ${post.media.length === 1 ? '' : 'grid-cols-2'}`}>
            {post.media.slice(0, 4).map((media, i) => (
              <div key={i} className={`relative ${post.media.length === 1 ? 'aspect-video' : 'aspect-square'} bg-muted overflow-hidden`}>
                {media.type === "image" ? (
                  <img src={media.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                ) : media.type === "video" ? (
                  <div className="relative w-full h-full">
                    <video src={media.url} className="w-full h-full object-cover" controls />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Play className="w-12 h-12 text-white/80" />
                    </div>
                  </div>
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

        {/* Animated Reactions popup */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="px-4 pb-1"
            >
              <div className="inline-flex items-center gap-0.5 bg-card border rounded-full p-1.5 shadow-xl" data-testid="reactions-popup">
                {REACTIONS.map((r, idx) => (
                  <motion.button
                    key={r.type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, type: "spring", stiffness: 500 }}
                    onClick={() => handleReaction(r.type)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${currentReaction === r.type ? r.bg + " scale-110" : "hover:bg-muted"}`}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.85 }}
                    title={r.label}
                    data-testid={`reaction-${r.type}`}
                  >
                    <r.icon className={`w-4.5 h-4.5 ${r.color} ${currentReaction === r.type && r.fill ? "fill-current" : ""}`} />
                  </motion.button>
                ))}
                <motion.button
                  onClick={() => setShowReactions(false)}
                  className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted ml-0.5"
                  whileHover={{ rotate: 90 }}
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t relative">
          {/* Floating reaction particles */}
          <div className="absolute left-6 bottom-8 pointer-events-none">
            <AnimatePresence>
              {particles.map(p => (
                <ReactionParticle key={p.id} icon={p.icon} color={p.color} fill={p.fill} />
              ))}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              onClick={handleLike}
              onMouseDown={onLongPressStart}
              onMouseUp={onLongPressEnd}
              onTouchStart={onLongPressStart}
              onTouchEnd={onLongPressEnd}
              whileTap={{ scale: 0.85 }}
              className={`flex items-center gap-1.5 transition-all ${isLiked ? activeReaction.color : "text-muted-foreground hover:text-red-500"}`}
              data-testid="post-like-btn"
            >
              <motion.div
                key={currentReaction || "default"}
                initial={{ scale: 0.5, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <activeReaction.icon className={`w-5 h-5 ${isLiked && activeReaction.fill ? "fill-current" : ""}`} />
              </motion.div>
              <span className="text-sm font-medium">{likesCount}</span>
            </motion.button>
            
            <button onClick={loadComments} className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors" data-testid="post-comment-btn">
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.comments_count || 0}</span>
            </button>
            
            <button onClick={handleRepost} className="flex items-center gap-1.5 text-muted-foreground hover:text-green-500 transition-colors" data-testid="post-repost-btn">
              <Repeat2 className="w-5 h-5" />
              <span className="text-sm font-medium">{post.shares_count || 0}</span>
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
                  <div key={c.id} className="flex gap-2">
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
