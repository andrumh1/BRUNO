import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { InlineVerifiedBadge } from "@/components/VerifiedBadge";
import axios from "axios";
import {
  Radio,
  X,
  Send,
  Heart,
  Gift,
  Users,
  MessageCircle,
  Share2,
  MoreHorizontal,
  Sparkles,
  Star,
  Diamond,
  Rocket,
  Crown,
  Flower2,
  Eye,
  Clock,
  Settings,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RotateCcw,
  Loader2,
  ChevronLeft,
  Volume2,
  VolumeX
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const WS_URL = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Gift options with icons and values
const GIFTS = [
  { type: "rose", name: "Rosa", icon: Flower2, color: "#FF69B4", value: 1 },
  { type: "heart", name: "Corazón", icon: Heart, color: "#FF4444", value: 5 },
  { type: "star", name: "Estrella", icon: Star, color: "#FFD700", value: 10 },
  { type: "diamond", name: "Diamante", icon: Diamond, color: "#00CED1", value: 50 },
  { type: "rocket", name: "Cohete", icon: Rocket, color: "#FF6B35", value: 100 },
  { type: "crown", name: "Corona", icon: Crown, color: "#9B59B6", value: 500 }
];

// ============================================
// LIVE VIEWER COMPONENT
// ============================================

const LiveViewerPage = () => {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [showGifts, setShowGifts] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  
  const videoRef = useRef(null);
  const wsRef = useRef(null);
  const commentsEndRef = useRef(null);

  // Fetch live details
  useEffect(() => {
    const fetchLive = async () => {
      try {
        const response = await axios.get(`${API}/lives/${liveId}`);
        setLive(response.data);
        
        if (response.data.status === "ended") {
          setIsEnded(true);
        }
        
        // Join live
        if (token && response.data.status === "live") {
          await axios.post(
            `${API}/lives/${liveId}/join`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
        
        // Fetch initial comments
        const commentsRes = await axios.get(`${API}/lives/${liveId}/comments?limit=50`);
        setComments(commentsRes.data);
        
      } catch (err) {
        setError(err.response?.data?.detail || "Error loading live");
      } finally {
        setLoading(false);
      }
    };
    
    fetchLive();
    
    return () => {
      // Leave live on unmount
      if (token && !isEnded) {
        axios.post(
          `${API}/lives/${liveId}/leave`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(() => {});
      }
    };
  }, [liveId, token]);

  // WebSocket for real-time updates
  useEffect(() => {
    if (!token || isEnded) return;
    
    const ws = new WebSocket(`${WS_URL}/ws/live/${liveId}?token=${token}`);
    
    ws.onopen = () => {
      wsRef.current = ws;
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "new_comment") {
          setComments(prev => [...prev, data.comment].slice(-100));
          scrollToBottom();
        } else if (data.type === "new_gift") {
          // Show gift animation
          showGiftAnimation(data.gift);
        } else if (data.type === "viewer_count") {
          setLive(prev => prev ? {...prev, viewer_count: data.count} : prev);
        } else if (data.type === "live_ended") {
          setIsEnded(true);
        }
      } catch (e) {}
    };
    
    ws.onclose = () => {
    };
    
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token, liveId, isEnded]);

  const scrollToBottom = () => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const showGiftAnimation = () => {
    // TODO: Add gift animation overlay
  };

  const handleSendComment = async () => {
    if (!newComment.trim() || !token) return;
    
    try {
      await axios.post(
        `${API}/lives/${liveId}/comment`,
        { text: newComment },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewComment("");
    } catch (err) {
      // error handled
    }
  };

  const handleSendGift = async (giftType) => {
    if (!token) {
      navigate("/login");
      return;
    }
    
    try {
      await axios.post(
        `${API}/lives/${liveId}/gift`,
        { gift_type: giftType, amount: 1 },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setShowGifts(false);
    } catch (err) {
      alert(err.response?.data?.detail || "Error sending gift");
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (error || !live) {
    return (
      <div className="h-screen bg-black flex flex-col items-center justify-center text-white">
        <Radio className="w-16 h-16 mb-4 opacity-50" />
        <p className="text-xl mb-4">Live no encontrado</p>
        <Button onClick={() => navigate("/lives")}>Ver otros Lives</Button>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Video Stream */}
      <div className="absolute inset-0">
        {/* Placeholder for video - in production, use WebRTC */}
        <div className="w-full h-full bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
          {isEnded ? (
            <div className="text-center text-white">
              <Radio className="w-20 h-20 mx-auto mb-4 opacity-30" />
              <p className="text-xl font-bold mb-2">Live Terminado</p>
              <p className="text-muted-foreground mb-4">
                Duración: {Math.floor(live.duration_seconds / 60)}m {live.duration_seconds % 60}s
              </p>
              <Button onClick={() => navigate("/lives")}>Ver otros Lives</Button>
            </div>
          ) : (
            <div className="text-center">
              <div className="w-32 h-32 rounded-full bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 p-1 mx-auto mb-4 animate-pulse">
                {live.host_avatar ? (
                  <img 
                    src={live.host_avatar} 
                    alt={live.host_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-4xl font-bold text-white">
                    {live.host_name?.charAt(0) || "?"}
                  </div>
                )}
              </div>
              <p className="text-white text-lg font-bold">{live.host_name}</p>
              <p className="text-white/60 text-sm">Conectando...</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="w-6 h-6" />
            </Button>
            
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-500 to-red-500 p-0.5">
                {live.host_avatar ? (
                  <img 
                    src={live.host_avatar} 
                    alt={live.host_name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold text-white">
                    {live.host_name?.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <span className="text-white font-semibold text-sm">{live.host_name}</span>
                  <InlineVerifiedBadge tier={live.host_tier} />
                </div>
                <p className="text-white/60 text-xs">{live.title}</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-red-500/90 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-xs font-semibold">LIVE</span>
            </div>
            <div className="flex items-center gap-1 px-2 py-1 bg-black/50 rounded-full">
              <Eye className="w-3 h-3 text-white" />
              <span className="text-white text-xs">{live.viewer_count || 0}</span>
            </div>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Comments Overlay */}
      <div className="absolute bottom-24 left-0 right-0 max-h-[40vh] px-4 z-10">
        <div className="space-y-2 overflow-y-auto max-h-full scrollbar-hide">
          {comments.slice(-30).map((comment) => (
            <div 
              key={comment.id}
              className="flex items-start gap-2 bg-black/40 rounded-xl px-3 py-2 backdrop-blur-sm animate-in slide-in-from-bottom duration-300"
            >
              {comment.user_avatar ? (
                <img 
                  src={comment.user_avatar}
                  alt={comment.user_name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary/50 flex items-center justify-center text-[10px] text-white">
                  {comment.user_name?.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white/80 text-xs font-medium">{comment.user_name}</span>
                  <InlineVerifiedBadge tier={comment.user_tier} size="sm" />
                </div>
                <p className="text-white text-sm break-words">{comment.text}</p>
              </div>
            </div>
          ))}
          <div ref={commentsEndRef} />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="flex items-center gap-2">
          <Input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Escribe un comentario..."
            className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50 rounded-full"
            onKeyDown={(e) => e.key === "Enter" && handleSendComment()}
            disabled={!token || isEnded}
          />
          <Button 
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full"
            onClick={handleSendComment}
            disabled={!token || isEnded}
          >
            <Send className="w-5 h-5" />
          </Button>
          <Button 
            size="icon"
            className="bg-gradient-to-r from-pink-500 to-red-500 hover:opacity-90 rounded-full"
            onClick={() => setShowGifts(!showGifts)}
            disabled={isEnded}
          >
            <Gift className="w-5 h-5 text-white" />
          </Button>
          <Button 
            size="icon"
            variant="ghost"
            className="text-white hover:bg-white/20 rounded-full"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Gifts Panel */}
      {showGifts && (
        <div className="absolute bottom-20 left-0 right-0 p-4 bg-black/90 backdrop-blur-xl rounded-t-3xl z-20 animate-in slide-in-from-bottom duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">Enviar Regalo</h3>
            <Button 
              variant="ghost" 
              size="icon"
              className="text-white"
              onClick={() => setShowGifts(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="grid grid-cols-6 gap-2">
            {GIFTS.map((gift) => (
              <button
                key={gift.type}
                onClick={() => handleSendGift(gift.type)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${gift.color}20` }}
                >
                  <gift.icon className="w-6 h-6" style={{ color: gift.color }} />
                </div>
                <span className="text-white text-[10px]">{gift.name}</span>
                <span className="text-white/60 text-[10px]">{gift.value}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveViewerPage;
