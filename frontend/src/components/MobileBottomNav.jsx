import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";
import axios from "axios";
import { 
  Home, Film, Map, ShoppingBag, User, Plus, Bell,
  ChevronUp, ChevronDown
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const { minimized, setMinimized, touchHandlers } = useNavScroll();
  const { open: openCamera } = useBrunoCamera();
  
  const hiddenPaths = ['/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path)) || 
                     location.pathname.match(/^\/lives\/[^/]+$/) ||
                     location.pathname.startsWith('/chat/');

  if (shouldHide) return null;

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio', path: '/feed', matchPaths: ['/', '/feed'] },
    { id: 'marketplace', icon: ShoppingBag, label: 'Tienda', path: '/marketplace', matchPaths: ['/marketplace'] },
    { id: 'reels', icon: Film, label: 'Reels', path: '/reels', matchPaths: ['/reels', '/lives'], hasIndicator: true },
    { id: 'create', icon: Plus, label: '', path: '/camera', isCreate: true },
    { id: 'map', icon: Map, label: 'Mapa', path: '/map', matchPaths: ['/map'] },
    { id: 'notifications', icon: Bell, label: 'Alertas', path: '/settings/notifications', matchPaths: ['/settings/notifications'], hasBadge: true },
    { id: 'profile', icon: User, label: 'Perfil', path: '/my-profile', matchPaths: ['/my-profile', '/dashboard'], showAvatar: true }
  ];

  const isActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    }
    return location.pathname === item.path;
  };

  // MINIMIZED STATE - compact pill
  if (minimized) {
    return (
      <>
        <div className="h-10" />
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          data-testid="mobile-bottom-nav"
        >
          <button
            onClick={() => setMinimized(false)}
            {...touchHandlers}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-background/90 backdrop-blur-2xl border border-border/50 shadow-xl shadow-black/10 hover:shadow-black/20 transition-all duration-300 active:scale-95"
            data-testid="nav-expand-btn"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">BRUNO</span>
          </button>
        </div>
      </>
    );
  }

  // FULL STATE - floating bubble bar
  return (
    <>
      <div className="h-20" />
      <nav 
        className="fixed bottom-3 left-3 right-3 z-[9999] animate-in slide-in-from-bottom-4 duration-300"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        data-testid="mobile-bottom-nav"
        {...touchHandlers}
      >
        <div className="relative max-w-md mx-auto">
          {/* Floating bubble background */}
          <div className="absolute inset-0 bg-background/85 backdrop-blur-2xl rounded-2xl border border-border/40 shadow-xl shadow-black/10" />
          
          {/* Subtle top glow */}
          <div 
            className="absolute top-0 left-4 right-4 h-[1px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,107,53,0.25), rgba(236,72,153,0.2), transparent)'
            }}
          />

          {/* Navigation Items */}
          <div className="relative flex items-center justify-around px-1 py-1.5 h-14">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item);
              
              if (item.isCreate) {
                return (
                  <button
                    key={item.id}
                    onClick={() => openCamera({
                      mode: "both",
                      onCapture: async (file, meta) => {
                        // Upload + auto-publish as story (default flow for the "+" button)
                        try {
                          const form = new FormData();
                          form.append("file", file);
                          const ep = file.type.startsWith("video") ? "/upload/chat-file" : "/upload/image";
                          const up = await axios.post(`${API}${ep}`, form, {
                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
                          });
                          const mediaUrl = up.data.url || up.data.secure_url;
                          if (!mediaUrl) throw new Error("no url");
                          await axios.post(`${API}/stories/`, {
                            media_url: mediaUrl,
                            media_type: file.type.startsWith("video") ? "video" : "image",
                            caption: null,
                            duration: file.type.startsWith("video") ? 15 : 5,
                            visibility: "public",
                            music: meta?.music || null,
                          }, { headers: { Authorization: `Bearer ${token}` } });
                          const { brunoToast } = await import("@/components/bruno/BrunoToast");
                          brunoToast.publish("Publicado en Story", {
                            description: "Disponible durante 24h en tu perfil.",
                          });
                        } catch (_) {
                          const { brunoToast } = await import("@/components/bruno/BrunoToast");
                          brunoToast.error("No se pudo publicar");
                        }
                      }
                    })}
                    className="relative flex items-center justify-center w-11 h-11 -mt-4"
                    data-testid={`nav-${item.id}`}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-primary to-orange-500 shadow-lg shadow-primary/30 hover:shadow-primary/50 transition-all hover:scale-110 active:scale-95">
                      <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                  </button>
                );
              }
              
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`relative flex flex-col items-center justify-center w-10 h-11 rounded-xl transition-all duration-200 ${
                    active ? 'scale-105' : 'hover:scale-105 active:scale-95'
                  }`}
                  data-testid={`nav-${item.id}`}
                >
                  {active && (
                    <div className="absolute -top-0.5 w-4 h-1 rounded-full bg-primary" />
                  )}
                  
                  <div className="relative flex flex-col items-center">
                    {item.showAvatar && user?.avatar_url ? (
                      <div className={`w-5.5 h-5.5 rounded-full overflow-hidden ${active ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}`}>
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="relative">
                        <Icon 
                          className={`w-5 h-5 transition-all duration-200 ${active ? 'text-primary' : 'text-muted-foreground'}`}
                          strokeWidth={active ? 2.5 : 1.5}
                        />
                        {item.hasIndicator && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        )}
                        {item.hasBadge && (
                          <span className="absolute -top-1 -right-1.5 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-[6px] text-white font-bold">!</span>
                        )}
                      </div>
                    )}
                    
                    <span className={`text-[8px] mt-0.5 font-medium transition-colors ${active ? 'text-primary' : 'text-muted-foreground/70'}`}>
                      {item.label}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Minimize handle */}
          <button 
            onClick={() => setMinimized(true)}
            className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-3 flex items-center justify-center rounded-t-lg bg-border/40 backdrop-blur-sm hover:bg-border/60 transition-colors"
            data-testid="nav-minimize-btn"
          >
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </button>
        </div>
      </nav>
    </>
  );
};

export default MobileBottomNav;
