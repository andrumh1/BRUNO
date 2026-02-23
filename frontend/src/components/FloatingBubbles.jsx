import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Sparkles, X } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FloatingBubbles = () => {
  const { user, token } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAITooltip, setShowAITooltip] = useState(false);

  // Fetch unread messages count
  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API}/chats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const total = response.data.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        setUnreadCount(total);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [token]);

  // Don't render if user is not logged in
  if (!user) return null;

  return (
    <>
      {/* Chat Bubble - Bottom Right */}
      <Link
        to="/chat"
        className="fixed bottom-6 right-6 z-50 group"
        data-testid="floating-chat-btn"
      >
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl group-hover:bg-primary/50 transition-all duration-300" />
          
          {/* Main button */}
          <div className="relative w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 cursor-pointer">
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </div>
          
          {/* Unread badge */}
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}
          
          {/* Tooltip */}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-card rounded-lg shadow-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            Mensajes
          </div>
        </div>
      </Link>

      {/* BRUNO AI Bubble - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-50 group">
        <div 
          className="relative cursor-pointer"
          onClick={() => setShowAITooltip(!showAITooltip)}
          data-testid="floating-ai-btn"
        >
          {/* Animated glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 rounded-full blur-xl group-hover:from-violet-500/50 group-hover:to-fuchsia-500/50 transition-all duration-300 animate-pulse" />
          
          {/* Main button */}
          <div className="relative w-14 h-14 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          
          {/* "AI" badge */}
          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-[10px] font-bold text-white shadow-md">
            IA
          </div>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-0 mb-2 px-3 py-1.5 bg-card rounded-lg shadow-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            BRUNO IA
          </div>
        </div>

        {/* AI Coming Soon Modal */}
        {showAITooltip && (
          <div className="absolute bottom-20 left-0 w-72 p-4 bg-card rounded-2xl shadow-2xl border border-border animate-in slide-in-from-bottom-2 duration-200">
            <button 
              onClick={() => setShowAITooltip(false)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h4 className="font-bold">BRUNO IA</h4>
                <p className="text-xs text-muted-foreground">Tu asistente personal</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              Pronto podrás usar BRUNO IA para:
            </p>
            
            <ul className="text-sm space-y-2 mb-4">
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                Generar diseños de tarjetas
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
                Obtener recomendaciones
              </li>
              <li className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Asistencia con la app
              </li>
            </ul>
            
            <div className="px-3 py-2 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 rounded-lg text-center">
              <span className="text-xs font-medium text-violet-600">Próximamente disponible</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingBubbles;
