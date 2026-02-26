import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineVerifiedBadge } from "@/components/VerifiedBadge";
import { ReportButton } from "@/components/ReportContentModal";
import axios from "axios";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  MoreHorizontal,
  Send,
  Bookmark,
  Play,
  Flag
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PostCard = ({ post, onLike, onComment, onDelete }) => {
  const { user, token } = useAuth();
  const [isLiked, setIsLiked] = useState(post.is_liked || false);
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleLike = async () => {
    if (!token) return;
    
    try {
      const response = await axios.post(
        `${API}/posts/${post.id}/like`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsLiked(response.data.liked);
      setLikesCount(response.data.likes_count);
      if (onLike) onLike(post.id, response.data);
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const loadComments = async () => {
    if (comments.length > 0) {
      setShowComments(!showComments);
      return;
    }
    
    setLoadingComments(true);
    try {
      const response = await axios.get(`${API}/posts/${post.id}/comments`);
      setComments(response.data);
      setShowComments(true);
    } catch (error) {
      console.error("Error loading comments:", error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !token) return;
    
    try {
      const response = await axios.post(
        `${API}/posts/${post.id}/comments`,
        { content: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setComments([response.data, ...comments]);
      setNewComment("");
      if (onComment) onComment(post.id, response.data);
    } catch (error) {
      console.error("Error posting comment:", error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.user?.display_name || post.user?.username}`,
          text: post.content,
          url: `${window.location.origin}/post/${post.id}`
        });
      } catch (error) {
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy link
      navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
      alert("Link copiado!");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("¿Eliminar este post?")) return;
    
    try {
      await axios.delete(`${API}/posts/${post.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (onDelete) onDelete(post.id);
    } catch (error) {
      console.error("Error deleting post:", error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  return (
    <Card className="glass-card spring-item overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-3">
          <Link to={`/profile/${post.user?.id}`} className="flex items-center gap-3">
            {post.user?.avatar_url ? (
              <img 
                src={post.user.avatar_url} 
                alt={post.user.username}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                {(post.user?.display_name || post.user?.username || "U")[0].toUpperCase()}
              </div>
            )}
            <div>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-sm">
                  {post.user?.display_name || post.user?.username}
                </span>
                <InlineVerifiedBadge tier={post.user?.subscription_tier} />
              </div>
              <span className="text-xs text-muted-foreground">
                {formatDate(post.created_at)}
              </span>
            </div>
          </Link>
          
          {/* Menu for post owner OR report button for others */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-background border rounded-lg shadow-lg py-1 z-50 min-w-[140px]">
                {user?.id === post.user_id ? (
                  <button 
                    onClick={handleDelete}
                    className="w-full px-4 py-2 text-sm text-left hover:bg-muted text-destructive"
                  >
                    Eliminar
                  </button>
                ) : (
                  <ReportButton
                    contentType="post"
                    contentId={post.id}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start px-4 py-2 text-sm text-left hover:bg-muted text-destructive rounded-none h-auto"
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        {post.content && (
          <p className="px-4 pb-3 text-sm whitespace-pre-wrap">{post.content}</p>
        )}

        {/* Media */}
        {post.media && post.media.length > 0 && (
          <div className={`grid gap-1 ${post.media.length === 1 ? '' : post.media.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
            {post.media.slice(0, 4).map((media, index) => (
              <div 
                key={index} 
                className={`relative ${post.media.length === 1 ? 'aspect-video' : 'aspect-square'} bg-muted`}
              >
                {media.type === "image" ? (
                  <img 
                    src={media.url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : media.type === "video" ? (
                  <div className="relative w-full h-full">
                    <video 
                      src={media.url} 
                      className="w-full h-full object-cover"
                      controls
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <Play className="w-12 h-12 text-white/80" />
                    </div>
                  </div>
                ) : null}
                {index === 3 && post.media.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xl font-bold">
                    +{post.media.length - 4}
                  </div>
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

        {/* Actions */}
        <div className="flex items-center justify-between px-4 py-3 border-t">
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLike}
              className={`flex items-center gap-1.5 transition-colors ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="text-sm font-medium">{likesCount}</span>
            </button>
            
            <button 
              onClick={loadComments}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{post.comments_count || 0}</span>
            </button>
            
            <button 
              onClick={handleShare}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
          
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <Bookmark className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="border-t px-4 py-3 space-y-3">
            {/* Comment Input */}
            {token && (
              <form onSubmit={handleComment} className="flex gap-2">
                <Input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe un comentario..."
                  className="flex-1 h-9 text-sm"
                />
                <Button type="submit" size="sm" disabled={!newComment.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            )}
            
            {/* Comments List */}
            {loadingComments ? (
              <p className="text-sm text-muted-foreground text-center py-2">Cargando...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No hay comentarios</p>
            ) : (
              <div className="space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2">
                    <Link to={`/profile/${comment.user?.id}`}>
                      {comment.user?.avatar_url ? (
                        <img 
                          src={comment.user.avatar_url} 
                          alt=""
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                          {(comment.user?.username || "U")[0].toUpperCase()}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 bg-muted/50 rounded-xl px-3 py-2">
                      <Link to={`/profile/${comment.user?.id}`} className="font-medium text-sm hover:underline">
                        {comment.user?.display_name || comment.user?.username}
                      </Link>
                      <p className="text-sm">{comment.content}</p>
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
