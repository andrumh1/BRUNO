import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";
import BrunoPublishMenu from "@/components/bruno/BrunoPublishMenu";
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
  const { minimized, setMinimized, touchHandlers, idle, bumpIdle } = useNavScroll();
  const { open: openCamera, isOpen: cameraOpen } = useBrunoCamera();
  const [publishMenuOpen, setPublishMenuOpen] = useState(false);
  
  const hiddenPaths = ['/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(path => location.pathname.startsWith(path)) || 
                     location.pathname.match(/^\/lives\/[^/]+$/) ||
                     location.pathname.startsWith('/chat/');

  // Auto-minimize when camera opens to free up the capture button space
  const wasMinimizedBeforeCamera = useRef(null);
  useEffect(() => {
    if (cameraOpen) {
      if (wasMinimizedBeforeCamera.current === null) {
        wasMinimizedBeforeCamera.current = minimized;
        if (!minimized) setMinimized(true);
      }
    } else if (wasMinimizedBeforeCamera.current !== null) {
      if (wasMinimizedBeforeCamera.current === false) setMinimized(false);
      wasMinimizedBeforeCamera.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOpen]);

  // Sync nav reserved space to a CSS var so screens (camera, map, etc.) can offset above it
  useEffect(() => {
    if (shouldHide) {
      document.documentElement.style.setProperty("--nav-reserve", "0px");
      return;
    }
    const reserve = minimized ? 14 : 88;
    document.documentElement.style.setProperty("--nav-reserve", `${reserve}px`);
  }, [shouldHide, minimized]);

  if (shouldHide) return null;

  const navItems = [
    { id: 'home', icon: Home, label: 'Inicio', path: '/feed', matchPaths: ['/', '/feed'] },
    { id: 'marketplace', icon: ShoppingBag, label: 'Tienda', path: '/marketplace', matchPaths: ['/marketplace'] },
    { id: 'reels', icon: Film, label: 'Reels', path: '/reels', matchPaths: ['/reels', '/lives'], hasIndicator: true },
    { id: 'create', icon: Plus, label: '', path: '/camera', isCreate: true },
    { id: 'map', icon: Map, label: 'Mapa', path: '/map', matchPaths: ['/map'] },
    { id: 'notifications', icon: Bell, label: 'Alertas', path: '/notifications', matchPaths: ['/notifications', '/settings/notifications'], hasBadge: true },
    { id: 'profile', icon: User, label: 'Perfil', path: '/my-profile', matchPaths: ['/my-profile', '/dashboard'], showAvatar: true }
  ];

  const isActive = (item) => {
    if (item.matchPaths) {
      return item.matchPaths.some(p => location.pathname === p || location.pathname.startsWith(p + '/'));
    }
    return location.pathname === item.path;
  };

  // MINIMIZED STATE — floating hairline pill lifted OFF the bottom edge
  // (safe-area + 12px) so it doesn't fight with the OS home-swipe gesture.
  // Fades to 40% opacity + heavy blur when idle, snaps back on any touch.
  if (minimized) {
    return (
      <>
        <div className="h-3" />
        <div
          className={`fixed left-0 right-0 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
            pointerEvents: 'none', // container passes-through, only button captures
          }}
          data-testid="mobile-bottom-nav"
        >
          <button
            onClick={(e) => { e.stopPropagation(); bumpIdle(); setMinimized(false); }}
            onTouchStart={(e) => { touchHandlers.onTouchStart(e); bumpIdle(); }}
            onTouchEnd={touchHandlers.onTouchEnd}
            className={`group block mx-auto outline-none focus:outline-none transition-all duration-300 ease-out ${
              idle ? 'opacity-40' : 'opacity-100'
            }`}
            style={{
              pointerEvents: 'auto',
              padding: '10px 20px', // generous invisible hitbox
              WebkitTapHighlightColor: 'transparent',
            }}
            aria-label="Mostrar barra de navegación"
            data-testid="nav-expand-btn"
          >
            <div className={`flex items-center justify-center gap-1.5 w-32 max-w-[40vw] transition-all duration-300 ${
              idle ? 'blur-[0.5px]' : ''
            }`}>
              <span className="h-1 w-1 rounded-full bg-orange-500/80 animate-pulse" />
              <span
                className="h-[3px] flex-1 rounded-full bg-foreground/25 group-hover:bg-foreground/40 group-active:bg-primary transition-colors"
              />
              <span className="h-1 w-1 rounded-full bg-orange-500/80 animate-pulse" />
            </div>
          </button>
        </div>
      </>
    );
  }

  // FULL STATE - floating bubble bar (lifted 24px from bottom to clear
  // the OS home indicator on iOS + Android).
  return (
    <>
      <div className="h-20" />
      <nav 
        className={`fixed left-3 right-3 animate-in slide-in-from-bottom-4 duration-300 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)' }}
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
                    onClick={() => setPublishMenuOpen(true)}
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

      <BrunoPublishMenu
        open={publishMenuOpen}
        onClose={() => setPublishMenuOpen(false)}
        onPick={async ({ type, source, file }) => {
          // Helper: publish a story given a file
          const publishStory = async (mediaFile, meta = {}) => {
            try {
              const form = new FormData();
              form.append("file", mediaFile);
              const isVideo = mediaFile.type.startsWith("video");
              const ep = isVideo ? "/upload/chat-file" : "/upload/image";
              const up = await axios.post(`${API}${ep}`, form, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
              });
              const mediaUrl = up.data.url || up.data.secure_url;
              if (!mediaUrl) throw new Error("no url");
              await axios.post(`${API}/stories/`, {
                media_url: mediaUrl,
                media_type: isVideo ? "video" : "image",
                caption: null,
                duration: isVideo ? 15 : 5,
                visibility: "public",
                music: meta?.music || null,
              }, { headers: { Authorization: `Bearer ${token}` } });
              const { brunoToast } = await import("@/components/bruno/BrunoToast");
              brunoToast.publish("Publicado en Story", { description: "Disponible durante 24h." });
            } catch (_) {
              const { brunoToast } = await import("@/components/bruno/BrunoToast");
              brunoToast.error("No se pudo publicar");
            }
          };

          // Route by type
          if (type === "post") {
            navigate("/feed?compose=1");
            return;
          }
          if (type === "status") {
            navigate("/my-profile?status=1");
            return;
          }
          if (type === "reel") {
            // Reels are always video; gallery source uploads, camera opens video mode
            if (source === "gallery" && file) {
              navigate("/reels?upload=1");
              return;
            }
            openCamera({
              mode: "video",
              onCapture: async (capturedFile) => {
                navigate("/reels?upload=1");
                await publishStory(capturedFile);
              },
            });
            return;
          }
          // type === "story"
          if (source === "gallery" && file) {
            await publishStory(file);
            return;
          }
          if (source === "private") {
            navigate("/my-profile?tab=stories&private=1");
            return;
          }
          // camera (live)
          openCamera({
            mode: "both",
            onCapture: async (capturedFile, meta) => publishStory(capturedFile, meta),
          });
        }}
      />
    </>
  );
};

export default MobileBottomNav;
