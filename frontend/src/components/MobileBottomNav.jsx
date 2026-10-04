import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";
import BrunoPublishMenu from "@/components/bruno/BrunoPublishMenu";
import axios from "axios";
import { isVideoFile, videoTooLarge, VIDEO_TOO_LARGE_MSG } from "@/lib/media";
import { 
  Film, Map, ShoppingBag, User, Plus, Bell,
  ChevronDown
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
    { id: 'reels', icon: Film, label: 'Reels', path: '/reels', matchPaths: ['/', '/feed', '/reels', '/lives'], hasIndicator: true },
    { id: 'marketplace', icon: ShoppingBag, label: 'Tienda', path: '/marketplace', matchPaths: ['/marketplace'] },
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

  // MINIMIZED STATE — floating hairline pill at a comfortable middle
  // height: high enough to avoid the OS home-swipe zone, low enough that
  // the user still perceives it as "the bottom bar". Fades to 20% opacity
  // + blur when idle so it visually disappears without leaving the DOM.
  if (minimized) {
    return (
      <>
        <div className="h-3" />
        <div
          className={`kb-hide fixed left-0 right-0 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
          style={{
            bottom: 'calc(var(--safe-bottom) + 6px)',
            pointerEvents: 'none',
            isolation: 'isolate', // prevents Google Maps stacking-context bleed
          }}
          data-testid="mobile-bottom-nav"
        >
          <button
            onClick={(e) => { e.stopPropagation(); bumpIdle(); setMinimized(false); }}
            onTouchStart={(e) => { touchHandlers.onTouchStart(e); bumpIdle(); }}
            onTouchEnd={touchHandlers.onTouchEnd}
            className={`group block mx-auto outline-none focus:outline-none transition-all duration-500 ease-out ${
              idle ? 'opacity-20' : 'opacity-90'
            }`}
            style={{
              pointerEvents: 'auto',
              padding: '10px 20px',
              WebkitTapHighlightColor: 'transparent',
              willChange: 'opacity, transform',
            }}
            aria-label="Mostrar barra de navegación"
            data-testid="nav-expand-btn"
          >
            <div className={`flex items-center justify-center gap-1.5 w-32 max-w-[40vw] transition-all duration-500 ${
              idle ? 'blur-[1px]' : ''
            }`}>
              <span className={`h-1 w-1 rounded-full transition-colors ${idle ? 'bg-foreground/30' : 'bg-orange-500/80 animate-pulse'}`} />
              <span
                className="h-[3px] flex-1 rounded-full bg-foreground/25 group-hover:bg-foreground/40 group-active:bg-primary transition-colors"
              />
              <span className={`h-1 w-1 rounded-full transition-colors ${idle ? 'bg-foreground/30' : 'bg-orange-500/80 animate-pulse'}`} />
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
        className={`kb-hide fixed left-3 right-3 animate-in slide-in-from-bottom-4 duration-300 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
        style={{ bottom: 'calc(var(--safe-bottom) + 16px)', isolation: 'isolate' }}
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
              background: 'linear-gradient(90deg, transparent, rgba(255,106,0,0.45), rgba(255,106,0,0.25), transparent)'
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
                    className="relative flex flex-col items-center justify-center w-10 h-11 rounded-xl transition-all duration-200 hover:scale-105 active:scale-90"
                    data-testid={`nav-${item.id}`}
                    aria-label="Publicar"
                  >
                    {/* Subtle contour ring — hints at "action" without shouting orange */}
                    <div className="relative w-7 h-7 rounded-full border border-foreground/25 flex items-center justify-center bg-foreground/[0.03] group-active:bg-primary/10 transition-colors">
                      <Icon
                        className="w-4 h-4 text-foreground/70"
                        strokeWidth={2}
                      />
                    </div>
                    <span className="text-[8px] mt-0.5 font-medium text-muted-foreground/70">
                      Crear
                    </span>
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
            const { brunoToast } = await import("@/components/bruno/BrunoToast");
            if (videoTooLarge(mediaFile)) { brunoToast.error("Video demasiado grande", { description: VIDEO_TOO_LARGE_MSG }); return; }
            try {
              const form = new FormData();
              form.append("file", mediaFile);
              const isVideo = isVideoFile(mediaFile);
              const ep = isVideo ? "/upload/chat-file" : "/upload/image";
              const up = await axios.post(`${API}${ep}`, form, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
                timeout: 0,
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
            } catch (e) {
              brunoToast.error("No se pudo publicar", { description: e?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo." });
            }
          };

          // Helper: publish a FEED POST / REEL (permanent) given a file
          const publishPost = async (mediaFile, meta = {}) => {
            const { brunoToast } = await import("@/components/bruno/BrunoToast");
            const isVideo = isVideoFile(mediaFile);
            if (videoTooLarge(mediaFile)) { brunoToast.error("Video demasiado grande", { description: VIDEO_TOO_LARGE_MSG }); return; }
            const tid = `publish-${Date.now()}`;
            brunoToast.loading(isVideo ? "Subiendo tu reel… 0%" : "Publicando…", { id: tid, description: "No cierres la app." });
            try {
              const form = new FormData();
              form.append("file", mediaFile);
              const ep = isVideo ? "/upload/chat-file" : "/upload/image";
              const up = await axios.post(`${API}${ep}`, form, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
                timeout: 0,
                onUploadProgress: (ev) => {
                  if (!ev.total) return;
                  const pct = Math.round((ev.loaded / ev.total) * 100);
                  brunoToast.loading(
                    pct >= 100 ? "Procesando tu video…" : `${isVideo ? "Subiendo tu reel" : "Subiendo"}… ${pct}%`,
                    { id: tid, description: "No cierres la app." }
                  );
                },
              });
              const u = up.data || {};
              const mediaUrl = u.url || u.secure_url;
              if (!mediaUrl) throw new Error("no url");
              const r = await axios.post(`${API}/posts`, {
                content: meta?.caption || "",
                media: [{ type: isVideo ? "video" : "image", url: mediaUrl, mp4_url: u.mp4_url || null, poster_url: u.poster_url || null, f_auto_url: u.f_auto_url || null }],
                post_type: isVideo ? "video" : "image",
                visibility: "public",
                audio: meta?.music?.url ? { source_post_id: meta.music.trackId, name: meta.music.title, url: meta.music.url } : null,
              }, { headers: { Authorization: `Bearer ${token}` } });
              brunoToast.dismiss(tid);
              brunoToast.publish(isVideo ? "Reel publicado" : "Publicación creada", { id: tid, description: "Ya aparece en tu perfil, el feed y Reels." });
              navigate(isVideo ? `/reels?id=${r.data.id}` : `/post/${r.data.id}`);
            } catch (e) {
              brunoToast.dismiss(tid);
              brunoToast.error("No se pudo publicar", { id: tid, description: e?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo." });
            }
          };

          // Route by type
          if (type === "post") {
            if (source === "gallery" && file) { await publishPost(file); return; }
            if (source === "camera") {
              openCamera({ mode: "both", onCapture: async (capturedFile, meta) => publishPost(capturedFile, meta) });
              return;
            }
            navigate("/compose");
            return;
          }
          if (type === "status") {
            navigate("/my-profile?status=1");
            return;
          }
          if (type === "reel") {
            // Reels are permanent video posts (not 24h stories)
            if (source === "gallery" && file) { await publishPost(file); return; }
            openCamera({
              mode: "video",
              onCapture: async (capturedFile, meta) => publishPost(capturedFile, meta),
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
