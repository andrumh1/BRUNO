import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";
import BrunoPublishMenu from "@/components/bruno/BrunoPublishMenu";
import axios from "axios";
import { isVideoFile, videoTooLarge, videoTooLargeMsg, setVideoLimit } from "@/lib/media";
import { uploadVideoDirect, getUploadLimits } from "@/lib/videoUpload";
import { setPendingMedia } from "@/lib/pendingMedia";
import { triggerHaptic } from "@/native/nativeApis";
import { motion } from "framer-motion";
import { 
  Film, Map, ShoppingBag, User, Plus, Bell, Search,
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
  const [unread, setUnread] = useState(0);

  // Contador real de notificaciones (se refresca al navegar, cada 30 s y con eventos realtime)
  useEffect(() => {
    if (!token) { setUnread(0); return; }
    let alive = true;
    const load = () => axios.get(`${API}/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => { if (alive) setUnread(r.data?.count || 0); }).catch(() => {});
    load();
    const iv = setInterval(load, 30000);
    window.addEventListener("bruno:notification", load);
    return () => { alive = false; clearInterval(iv); window.removeEventListener("bruno:notification", load); };
  }, [token, location.pathname]);
  
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
    document.documentElement.style.setProperty("--nav-reserve", minimized ? "calc(var(--safe-bottom) + 14px)" : "calc(var(--safe-bottom) + var(--nav-gap) + var(--nav-h))");
  }, [shouldHide, minimized]);

  if (shouldHide) return null;

  // Orden: Reels · Tienda · Mapa · Crear (+) · Buscar · Notificaciones · Perfil
  const navItems = [
    { id: 'reels', icon: Film, label: 'Reels', path: '/reels', matchPaths: ['/', '/feed', '/reels', '/lives', '/video'], hasIndicator: true },
    { id: 'marketplace', icon: ShoppingBag, label: 'Tienda', path: '/marketplace', matchPaths: ['/marketplace', '/store'] },
    { id: 'map', icon: Map, label: 'Mapa', path: '/map', matchPaths: ['/map'] },
    { id: 'create', icon: Plus, label: '', path: '/camera', isCreate: true },
    { id: 'search', icon: Search, label: 'Buscar', path: '/search', matchPaths: ['/search', '/hashtag'] },
    { id: 'notifications', icon: Bell, label: 'Notificaciones', path: '/notifications', matchPaths: ['/notifications', '/settings/notifications'], hasBadge: true },
    { id: 'profile', icon: User, label: 'Perfil', path: '/my-profile', matchPaths: ['/my-profile', '/dashboard'], showAvatar: true }
  ];

  // Pages that fill the viewport themselves (video/map/chat) must not get a trailing scroll reserve.
  const fixedViewport = ['/reels', '/video/', '/camera', '/chat', '/map', '/lives/', '/stories', '/call'].some((p) => location.pathname.startsWith(p));

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
        {!fixedViewport && <div className="h-3" />}
        <div
          className={`kb-hide fixed left-0 right-0 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
          style={{
            bottom: 'calc(var(--safe-bottom) + 4px)',
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
              <span className={`h-1 w-1 rounded-full transition-colors ${idle ? 'bg-foreground/30' : 'bg-foreground/60 animate-pulse'}`} />
              <span
                className="h-[3px] flex-1 rounded-full bg-foreground/25 group-hover:bg-foreground/40 group-active:bg-foreground/60 transition-colors"
              />
              <span className={`h-1 w-1 rounded-full transition-colors ${idle ? 'bg-foreground/30' : 'bg-foreground/60 animate-pulse'}`} />
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
      {/* Scroll reserve so the last rows/products are never hidden under the pill (not on fixed-viewport pages) */}
      {!fixedViewport && <div aria-hidden style={{ height: 'var(--content-bottom)' }} data-testid="nav-scroll-reserve" />}
      <nav 
        className={`kb-hide fixed left-3 right-3 animate-in slide-in-from-bottom-4 duration-300 ${cameraOpen ? "z-[125]" : "z-[9999]"}`}
        style={{ bottom: 'calc(var(--safe-bottom) + var(--nav-gap, 8px))', isolation: 'isolate' }}
        data-testid="mobile-bottom-nav"
        {...touchHandlers}
      >
        <div className="relative max-w-md mx-auto">
          {/* Fondo de la pill: vidrio ultra transparente */}
          <div className="absolute inset-0 bg-background/45 dark:bg-background/35 backdrop-blur-2xl rounded-2xl border border-white/40 dark:border-white/10 shadow-xl shadow-black/[0.08] pointer-events-none" />

          {/* Iconos: solo iconos, 7 celdas iguales, centrados */}
          <div className="relative grid grid-cols-7 items-center px-1" style={{ height: 'var(--nav-h, 48px)' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = !item.isCreate && isActive(item);
              const go = () => { triggerHaptic("light"); if (item.isCreate) setPublishMenuOpen(true); else navigate(item.path); };
              return (
                <button
                  key={item.id}
                  onClick={go}
                  className="relative flex items-center justify-center h-11 w-full min-w-[40px] rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 transition-transform duration-200 active:scale-90"
                  data-testid={`nav-${item.id}`}
                  aria-label={item.isCreate ? 'Crear' : item.label}
                  aria-current={active ? 'page' : undefined}
                  title={item.isCreate ? 'Crear' : item.label}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-active-bubble"
                      className="absolute inset-y-[5px] inset-x-[6px] rounded-[14px] bg-foreground/[0.09] dark:bg-white/[0.12] border border-white/50 dark:border-white/15 backdrop-blur-md shadow-[0_6px_14px_-8px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.45)] pointer-events-none"
                      transition={{ type: 'spring', stiffness: 560, damping: 30, mass: 0.75 }}
                      initial={false}
                      data-testid="nav-active-bubble"
                    >
                      <motion.span key={item.id} className="absolute inset-0 rounded-[14px]" initial={{ scale: 1.14, y: -3, opacity: 0.6 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 480, damping: 22 }} />
                    </motion.span>
                  )}
                  <span className="relative z-10 flex items-center justify-center">
                    {item.isCreate ? (
                      <span className="w-7 h-7 rounded-full border border-foreground/30 dark:border-white/30 flex items-center justify-center bg-foreground/[0.03]">
                        <Icon className="w-4 h-4 text-foreground/75" strokeWidth={2} />
                      </span>
                    ) : item.showAvatar && user?.avatar_url ? (
                      <span className={`block w-6 h-6 rounded-full overflow-hidden ${active ? 'ring-2 ring-zinc-600/70 dark:ring-zinc-200/70 ring-offset-1 ring-offset-background' : ''}`}>
                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      </span>
                    ) : (
                      <span className="relative">
                        <Icon
                          className={`w-[22px] h-[22px] transition-colors duration-200 ${active ? 'text-zinc-700 dark:text-zinc-100' : 'text-muted-foreground/75'}`}
                          strokeWidth={active ? 2.3 : 1.6}
                        />
                        {item.hasIndicator && !active && (
                          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        )}
                        {item.hasBadge && unread > 0 && (
                          <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 px-0.5 bg-red-500 rounded-full flex items-center justify-center text-[8px] leading-none text-white font-bold" data-testid="nav-notifications-badge">{unread > 99 ? "99+" : unread}</span>
                        )}
                      </span>
                    )}
                  </span>
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
            const isVideo = isVideoFile(mediaFile);
            if (isVideo) { const lim = await getUploadLimits(token).catch(() => null); if (lim?.video_max_bytes) setVideoLimit(lim.video_max_bytes); }
            if (videoTooLarge(mediaFile)) { brunoToast.error("Video demasiado grande", { description: videoTooLargeMsg() }); return; }
            try {
              let upData;
              if (isVideo) upData = await uploadVideoDirect(mediaFile, { token, folder: "bruno/stories" });
              else {
                const form = new FormData();
                form.append("file", mediaFile);
                const up = await axios.post(`${API}/upload/image?aspect=9:16`, form, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 0 });
                upData = up.data;
              }
              const mediaUrl = upData.url || upData.secure_url;
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
              brunoToast.error("No se pudo publicar", { description: e?.userMessage || e?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo." });
            }
          };

          // Helper: publish a FEED POST / REEL (permanent) given a file
          const publishPost = async (mediaFile, meta = {}) => {
            const { brunoToast } = await import("@/components/bruno/BrunoToast");
            const isVideo = isVideoFile(mediaFile);
            if (isVideo) { const lim = await getUploadLimits(token).catch(() => null); if (lim?.video_max_bytes) setVideoLimit(lim.video_max_bytes); }
            if (videoTooLarge(mediaFile)) { brunoToast.error("Video demasiado grande", { description: videoTooLargeMsg() }); return; }
            const tid = `publish-${Date.now()}`;
            brunoToast.loading(isVideo ? "Subiendo tu video… 0%" : "Publicando…", { id: tid, description: "No cierres la app." });
            try {
              let u;
              if (isVideo) {
                u = await uploadVideoDirect(mediaFile, { token, onProgress: (p) => brunoToast.loading(p.phase === "process" ? "Procesando tu video…" : p.phase === "retry" ? `Reintentando… ${p.pct}%` : `Subiendo tu video… ${p.pct}%`, { id: tid, description: p.phase === "retry" ? "Se reanuda donde se quedó." : "No cierres la app." }) });
              } else {
                const form = new FormData();
                form.append("file", mediaFile);
                const up = await axios.post(`${API}/upload/image`, form, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }, timeout: 0 });
                u = up.data || {};
              }
              const mediaUrl = u.url || u.secure_url;
              if (!mediaUrl) throw new Error("no url");
              const r = await axios.post(`${API}/posts`, {
                content: meta?.caption || "",
                media: [{ type: isVideo ? "video" : "image", url: mediaUrl, mp4_url: u.mp4_url || null, poster_url: u.poster_url || null, f_auto_url: u.f_auto_url || null, hls_url: u.hls_url || null, duration: u.duration || null }],
                post_type: isVideo ? "video" : "image",
                visibility: "public",
                audio: meta?.music?.url ? { source_post_id: meta.music.trackId, name: meta.music.title, url: meta.music.url } : null,
              }, { headers: { Authorization: `Bearer ${token}` } });
              brunoToast.dismiss(tid);
              brunoToast.publish(isVideo ? "Reel publicado" : "Publicación creada", { id: tid, description: "Ya aparece en tu perfil, el feed y Reels." });
              navigate(isVideo ? `/reels?id=${r.data.id}` : `/post/${r.data.id}`);
            } catch (e) {
              brunoToast.dismiss(tid);
              brunoToast.error("No se pudo publicar", { id: tid, description: e?.userMessage || e?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo." });
            }
          };

          // Route by type
          // Elegir un archivo NUNCA publica: va al editor (video) o al compositor (imagen) y se publica con un botón explícito.
          const toEditor = (f) => { setPendingMedia(f, { type }); navigate(isVideoFile(f) ? "/camera?import=1" : "/compose?import=1"); };
          if (type === "post") {
            if (source === "gallery" && file) { toEditor(file); return; }
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
            if (source === "gallery" && file) { toEditor(file); return; }
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
