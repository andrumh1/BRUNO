import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  Heart, MessageCircle, Share2, Bookmark, Music2, Play, Pause,
  Volume2, VolumeX, User, Loader2, Radio, Film, Plus,
  MoreVertical, Home, Eye, Minimize2
} from "lucide-react";
import { useNavScroll } from "@/contexts/NavScrollContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const ReelItem = ({ reel, isActive }) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isLiked, setIsLiked] = useState(reel.is_liked || false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likes_count || 0);
  const { token } = useAuth();
  const { addMinimizedItem } = useNavScroll();
  const navigate = useNavigate();

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
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleLike = async (e) => {
    e.stopPropagation();
    setIsLiked(!isLiked);
    setLikesCount((p) => (isLiked ? p - 1 : p + 1));
    if (token) {
      try {
        await axios.post(`${API}/posts/${reel.id}/like`, {}, { headers: { Authorization: `Bearer ${token}` } });
      } catch (_) {}
    }
  };

  return (
    <div className="relative h-full w-full bg-black snap-start snap-always" data-testid={`reel-item-${reel.id}`}>
      <div className="absolute inset-0" onClick={togglePlay}>
        {reel.video_url ? (
          <video ref={videoRef} src={reel.video_url} className="h-full w-full object-cover" loop muted={isMuted} playsInline poster={reel.thumbnail_url} />
        ) : (
          <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${reel.image_url || reel.thumbnail_url || ""})` }} />
        )}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

      <button onClick={(e) => { e.stopPropagation(); if (videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="absolute top-4 right-4 p-2 bg-black/40 rounded-full z-10">
        {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
      </button>

      <div className="absolute right-3 bottom-28 flex flex-col items-center gap-5 z-10">
        <Link to={`/profile/${reel.author?.id || reel.user_id}`} className="relative">
          <div className="w-11 h-11 rounded-full border-2 border-white overflow-hidden bg-gray-800">
            {reel.author?.avatar_url ? (
              <img src={reel.author.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white"><User className="w-5 h-5" /></div>
            )}
          </div>
        </Link>

        <button onClick={handleLike} className="flex flex-col items-center" data-testid="reel-like-btn">
          <Heart className={`w-7 h-7 ${isLiked ? "text-red-500 fill-red-500" : "text-white"}`} />
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

        <button onClick={(e) => { e.stopPropagation(); setIsSaved(!isSaved); }} className="flex flex-col items-center">
          <Bookmark className={`w-7 h-7 ${isSaved ? "text-yellow-400 fill-yellow-400" : "text-white"}`} />
        </button>

        <button onClick={(e) => {
          e.stopPropagation();
          addMinimizedItem({
            id: reel.id,
            itemType: 'reel',
            title: (reel.content || reel.description || '').slice(0, 30) || 'Reel',
            thumbnail: reel.thumbnail_url || reel.media?.[0]?.url || null,
            videoUrl: reel.media?.[0]?.url || reel.video_url || null,
          });
          navigate(-1);
        }} className="flex flex-col items-center" data-testid="reel-minimize-btn">
          <Minimize2 className="w-6 h-6 text-white" />
          <span className="text-[10px] text-white mt-0.5">PiP</span>
        </button>
      </div>

      <div className="absolute left-4 right-16 bottom-8 z-10">
        <Link to={`/profile/${reel.author?.id || reel.user_id}`} className="flex items-center gap-2 mb-2">
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

const ReelsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const containerRef = useRef(null);
  const [activeTab, setActiveTab] = useState("reels");
  const [reels, setReels] = useState([]);
  const [lives, setLives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    fetchContent();
  }, [token]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [postsRes, livesRes] = await Promise.all([
        axios.get(`${API}/posts?media_only=true`, { headers }).catch(() => ({ data: [] })),
        axios.get(`${API}/lives`, { headers }).catch(() => ({ data: [] })),
      ]);

      const reelsData = (Array.isArray(postsRes.data) ? postsRes.data : [])
        .filter((p) => p.media_url || p.image_url || p.attachments?.length > 0)
        .map((post) => ({
          ...post,
          video_url: post.video_url || post.media_url,
          image_url: post.image_url || post.attachments?.[0]?.url,
          thumbnail_url: post.thumbnail_url || post.image_url || post.attachments?.[0]?.url,
          author: { id: post.user?.id, name: post.user?.display_name, username: post.user?.username, avatar_url: post.user?.avatar_url },
        }));
      setReels(reelsData);
      setLives(Array.isArray(livesRes.data) ? livesRes.data : livesRes.data?.lives || []);
    } catch (err) {
      console.error("Error fetching reels/lives:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const newIndex = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < reels.length) setActiveIndex(newIndex);
  }, [activeIndex, reels.length]);

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-white animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-black relative overflow-hidden" data-testid="reels-page">
      {/* Top tabs */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-center gap-6 pt-3 pb-2 bg-gradient-to-b from-black/60 to-transparent">
        <button
          onClick={() => setActiveTab("reels")}
          className={`text-sm font-bold transition-all ${activeTab === "reels" ? "text-white border-b-2 border-white pb-1" : "text-white/50"}`}
          data-testid="reels-tab"
        >
          Reels
        </button>
        <button
          onClick={() => setActiveTab("lives")}
          className={`text-sm font-bold transition-all flex items-center gap-1.5 ${activeTab === "lives" ? "text-white border-b-2 border-white pb-1" : "text-white/50"}`}
          data-testid="lives-tab"
        >
          <Radio className="w-3.5 h-3.5" />
          En Vivo
        </button>
      </div>

      {/* Reels View */}
      {activeTab === "reels" && (
        <>
          {reels.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white p-8">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Film className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2">No hay reels</h2>
              <p className="text-white/50 text-sm text-center mb-6">Se el primero en compartir un video corto</p>
              <Button onClick={() => navigate("/camera")} className="rounded-full bg-primary">
                <Plus className="w-4 h-4 mr-2" />
                Crear Reel
              </Button>
            </div>
          ) : (
            <div
              ref={containerRef}
              className="h-full overflow-y-scroll snap-y snap-mandatory"
              onScroll={handleScroll}
              style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {reels.map((reel, index) => (
                <div key={reel.id} className="h-full w-full">
                  <ReelItem reel={reel} isActive={index === activeIndex} />
                </div>
              ))}
            </div>
          )}

          {/* Progress dots */}
          {reels.length > 1 && (
            <div className="absolute top-12 left-4 right-4 flex gap-0.5 z-20">
              {reels.slice(0, 20).map((_, i) => (
                <div key={i} className={`h-0.5 flex-1 rounded-full transition-all ${i === activeIndex ? "bg-white" : "bg-white/20"}`} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Lives View */}
      {activeTab === "lives" && (
        <div className="h-full pt-14 pb-4 px-4 overflow-y-auto">
          {lives.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-white">
              <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <Radio className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold mb-2">No hay transmisiones</h2>
              <p className="text-white/50 text-sm text-center mb-6">No hay nadie en vivo ahora</p>
              <Button onClick={() => navigate("/lives/start")} className="rounded-full bg-red-500 hover:bg-red-600">
                <Radio className="w-4 h-4 mr-2" />
                Iniciar Live
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {lives.map((live) => (
                <Link
                  key={live.id}
                  to={`/lives/${live.id}`}
                  className="relative rounded-xl overflow-hidden aspect-[3/4] bg-gray-900 group"
                  data-testid={`live-item-${live.id}`}
                >
                  {live.thumbnail_url && (
                    <img src={live.thumbnail_url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    <Radio className="w-2.5 h-2.5" />
                    EN VIVO
                  </div>
                  <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px]">
                    <Eye className="w-2.5 h-2.5" />
                    {live.viewer_count || 0}
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
