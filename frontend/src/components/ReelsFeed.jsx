import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { 
  Heart, 
  MessageCircle, 
  Share2, 
  Bookmark,
  Music2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronDown,
  MoreVertical,
  User,
  Loader2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Single Reel Component
const ReelItem = ({ reel, isActive, onLike, onComment, onShare, onSave }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(reel.is_liked || false);
  const [isSaved, setIsSaved] = useState(reel.is_saved || false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const [showComments, setShowComments] = useState(false);

  // Auto-play when active
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? prev - 1 : prev + 1);
    if (onLike) onLike(reel.id, !isLiked);
  };

  const handleSave = (e) => {
    e.stopPropagation();
    setIsSaved(!isSaved);
    if (onSave) onSave(reel.id, !isSaved);
  };

  return (
    <div className="relative h-full w-full bg-black snap-start snap-always">
      {/* Video */}
      <div className="absolute inset-0" onClick={togglePlay}>
        {reel.video_url ? (
          <video
            ref={videoRef}
            src={reel.video_url}
            className="h-full w-full object-cover"
            loop
            muted={isMuted}
            playsInline
            poster={reel.thumbnail_url}
          />
        ) : (
          // Fallback for image posts displayed as reels
          <div 
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${reel.image_url || reel.thumbnail_url})` }}
          />
        )}
        
        {/* Play/Pause indicator */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="w-10 h-10 text-white fill-white ml-1" />
            </div>
          </div>
        )}
      </div>

      {/* Gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

      {/* Mute button */}
      <button
        onClick={toggleMute}
        className="absolute top-4 right-4 p-2 bg-black/40 rounded-full z-10"
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </button>

      {/* Right side actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5 z-10">
        {/* User avatar */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden bg-gray-800">
            {reel.author?.avatar_url ? (
              <img src={reel.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white">
                <User className="w-6 h-6" />
              </div>
            )}
          </div>
          <button className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full flex items-center justify-center border-2 border-black">
            <span className="text-white text-lg leading-none">+</span>
          </button>
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center">
          <div className={`p-2 rounded-full ${isLiked ? 'text-red-500' : 'text-white'}`}>
            <Heart className={`w-8 h-8 ${isLiked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-white text-xs font-medium">{likesCount}</span>
        </button>

        {/* Comment */}
        <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
          <div className="p-2 text-white">
            <MessageCircle className="w-8 h-8" />
          </div>
          <span className="text-white text-xs font-medium">{reel.comments_count || 0}</span>
        </button>

        {/* Share */}
        <button onClick={(e) => { e.stopPropagation(); onShare?.(reel); }} className="flex flex-col items-center">
          <div className="p-2 text-white">
            <Share2 className="w-8 h-8" />
          </div>
          <span className="text-white text-xs font-medium">Share</span>
        </button>

        {/* Save */}
        <button onClick={handleSave} className="flex flex-col items-center">
          <div className={`p-2 ${isSaved ? 'text-yellow-400' : 'text-white'}`}>
            <Bookmark className={`w-8 h-8 ${isSaved ? 'fill-current' : ''}`} />
          </div>
        </button>

        {/* More */}
        <button className="p-2 text-white">
          <MoreVertical className="w-6 h-6" />
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute left-4 right-20 bottom-6 z-10">
        {/* Author */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-white font-bold">@{reel.author?.username || reel.author?.name || 'usuario'}</span>
          {reel.author?.is_verified && (
            <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-white text-sm line-clamp-2 mb-3">
          {reel.content || reel.description}
        </p>

        {/* Music/Audio */}
        {reel.audio_name && (
          <div className="flex items-center gap-2 bg-black/30 rounded-full px-3 py-1 w-fit">
            <Music2 className="w-4 h-4 text-white animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-white text-xs truncate max-w-[200px]">{reel.audio_name}</span>
          </div>
        )}
      </div>

      {/* Comments Modal */}
      {showComments && (
        <div 
          className="absolute inset-0 bg-black/50 z-20 flex items-end"
          onClick={() => setShowComments(false)}
        >
          <div 
            className="bg-card rounded-t-3xl w-full max-h-[70%] p-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h3 className="text-lg font-bold mb-4">{reel.comments_count || 0} comentarios</h3>
            <div className="h-64 overflow-y-auto">
              {reel.comments?.length > 0 ? (
                reel.comments.map((comment, i) => (
                  <div key={i} className="flex gap-3 mb-4">
                    <div className="w-8 h-8 rounded-full bg-muted" />
                    <div>
                      <p className="text-sm"><strong>{comment.author}</strong> {comment.text}</p>
                      <p className="text-xs text-muted-foreground">{comment.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">No hay comentarios aún</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Reels Feed Component
const ReelsFeed = () => {
  const { token } = useAuth();
  const containerRef = useRef(null);
  const [reels, setReels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Fetch reels (posts with video/media)
  useEffect(() => {
    const fetchReels = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        // Fetch posts that have media (videos or images)
        const response = await axios.get(`${API}/posts?media_only=true`, { headers });
        // Filter for video content or transform image posts to reels format
        const reelsData = response.data.filter(post => 
          post.media_url || post.image_url || post.attachments?.length > 0
        ).map(post => ({
          ...post,
          video_url: post.video_url || post.media_url,
          image_url: post.image_url || post.attachments?.[0]?.url,
          thumbnail_url: post.thumbnail_url || post.image_url || post.attachments?.[0]?.url,
          author: {
            id: post.author_id,
            name: post.author_name,
            username: post.author_name?.toLowerCase().replace(/\s/g, ''),
            avatar_url: post.author_avatar
          }
        }));
        setReels(reelsData);
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    fetchReels();
  }, [token]);

  // Handle scroll to change active reel
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const itemHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, reels.length]);

  // Navigate to next/previous reel
  const goToReel = (direction) => {
    if (!containerRef.current) return;
    const newIndex = activeIndex + direction;
    if (newIndex >= 0 && newIndex < reels.length) {
      const itemHeight = containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: newIndex * itemHeight,
        behavior: 'smooth'
      });
      setActiveIndex(newIndex);
    }
  };

  const handleLike = async (reelId, liked) => {
    if (!token) return;
    try {
      await axios.post(`${API}/posts/${reelId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      // error handled
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  if (reels.length === 0) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white p-8">
        <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6">
          <Play className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">No hay reels todavía</h2>
        <p className="text-white/60 text-center mb-6">
          Sé el primero en compartir un video corto
        </p>
        <Button className="bg-primary hover:bg-primary/90">
          Crear Reel
        </Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Reels container */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((reel, index) => (
          <div key={reel.id} className="h-screen w-full">
            <ReelItem
              reel={reel}
              isActive={index === activeIndex}
              onLike={handleLike}
            />
          </div>
        ))}
      </div>

      {/* Navigation arrows */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-20">
        <button
          onClick={() => goToReel(-1)}
          disabled={activeIndex === 0}
          className="p-2 bg-black/40 rounded-full disabled:opacity-30"
        >
          <ChevronUp className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => goToReel(1)}
          disabled={activeIndex === reels.length - 1}
          className="p-2 bg-black/40 rounded-full disabled:opacity-30"
        >
          <ChevronDown className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Progress indicator */}
      <div className="absolute top-4 left-4 right-16 flex gap-1 z-20">
        {reels.map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full transition-all ${
              index === activeIndex ? 'bg-white' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default ReelsFeed;
