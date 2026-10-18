import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  MessageCircle,
  Heart,
  UserPlus,
  Phone,
  ShoppingCart,
  Star,
  Camera,
  AtSign,
  Package,
  Tag,
  Sparkles,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { makeBackoff, onBackOnline } from "@/lib/wsBackoff";

const NotifCtx = createContext({
  lastEvent: null,
  connected: false,
  subscribe: () => () => {},
});

export const useRealtimeNotifications = () => useContext(NotifCtx);

const ICONS = {
  incoming_call: Phone,
  new_message: MessageCircle,
  new_follower: UserPlus,
  post_like: Heart,
  post_comment: MessageCircle,
  mention: AtSign,
  product_favorited: Star,
  product_cart_added: ShoppingCart,
  new_story: Camera,
  order_update: Package,
  promotion: Tag,
  deal_commission: Sparkles,
};
const COLORS = {
  incoming_call: { bg: "bg-emerald-500/15", text: "text-emerald-500" },
  new_message: { bg: "bg-blue-500/15", text: "text-blue-500" },
  new_follower: { bg: "bg-purple-500/15", text: "text-purple-500" },
  post_like: { bg: "bg-pink-500/15", text: "text-pink-500" },
  post_comment: { bg: "bg-blue-500/15", text: "text-blue-500" },
  mention: { bg: "bg-orange-500/15", text: "text-orange-500" },
  deal_commission: { bg: "bg-orange-500/15", text: "text-orange-500" },
  default: { bg: "bg-zinc-500/15", text: "text-zinc-500" },
};

const SUPPRESS_PATTERNS = [/^\/chat\//, /^\/notifications/, /^\/login/, /^\/register/];

function Banner({ notif, onClick, onClose }) {
  const Icon = ICONS[notif.type] || Bell;
  const color = COLORS[notif.type] || COLORS.default;

  return (
    <motion.div
      layout
      initial={{ y: -120, opacity: 0, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      exit={{ y: -120, opacity: 0, scale: 0.94 }}
      transition={{ type: "spring", stiffness: 380, damping: 32 }}
      drag="y"
      dragConstraints={{ top: -200, bottom: 0 }}
      dragElastic={{ top: 0.6, bottom: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -50) onClose();
      }}
      role="status"
      data-testid={`realtime-notif-${notif.id || notif.type}`}
      className="pointer-events-auto w-[92vw] max-w-md cursor-pointer select-none"
    >
      <button
        onClick={onClick}
        type="button"
        className="w-full text-left rounded-3xl bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
      >
        {/* Orange top stripe */}
        <span aria-hidden className="block h-1 bg-orange-500" />
        <div className="flex items-start gap-3 px-4 py-3">
          <img
            src="/bruno-icon.png"
            alt="Bruno"
            className="h-8 w-8 rounded-lg object-contain bg-orange-50 dark:bg-orange-500/10 p-1 shrink-0"
          />
          <div className={`grid place-items-center h-9 w-9 rounded-full shrink-0 ${color.bg} ${color.text}`}>
            <Icon className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50 leading-tight truncate">
              {notif.title || "Nueva alerta"}
            </p>
            {(notif.body || notif.message) && (
              <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2 mt-0.5">
                {notif.body || notif.message}
              </p>
            )}
          </div>
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="shrink-0 grid place-items-center h-7 w-7 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </span>
        </div>
        {/* Auto-dismiss progress bar */}
        <motion.span
          aria-hidden
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 5, ease: "linear" }}
          style={{ originX: 0 }}
          className="block h-[2px] bg-orange-500/70"
        />
      </button>
    </motion.div>
  );
}

export const RealtimeNotificationProvider = ({ children }) => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const subscribersRef = useRef(new Set());
  const [banners, setBanners] = useState([]);
  const [connected, setConnected] = useState(false);

  const dismiss = useCallback((id) => {
    setBanners((arr) => arr.filter((b) => b.__bannerId !== id));
  }, []);

  const subscribe = useCallback((cb) => {
    subscribersRef.current.add(cb);
    return () => subscribersRef.current.delete(cb);
  }, []);

  const broadcast = useCallback((notif) => {
    for (const cb of subscribersRef.current) {
      try {
        cb(notif);
      } catch (_) {
        /* ignore */
      }
    }
  }, []);

  const queueBanner = useCallback(
    (notif) => {
      // Suppress while user is in chat / notifications page / auth screens
      if (SUPPRESS_PATTERNS.some((rx) => rx.test(window.location.pathname))) return;
      const bannerId = `${notif.id || notif.type}-${Date.now()}-${Math.random()}`;
      const enriched = { ...notif, __bannerId: bannerId };
      setBanners((arr) => [enriched, ...arr].slice(0, 3));
      // Auto-dismiss after 5 s
      setTimeout(() => dismiss(bannerId), 5200);
    },
    [dismiss]
  );

  // Connect WebSocket
  useEffect(() => {
    if (!token || !user) return;

    const url = process.env.REACT_APP_BACKEND_URL.replace(/^http/, "ws") + `/api/ws/chat/${token}`;
    let cancelled = false;
    const backoff = makeBackoff();

    const connect = () => {
      if (cancelled) return;
      try {
        const ws = new WebSocket(url);
        wsRef.current = ws;
        ws.onopen = () => {
          backoff.reset();
          setConnected(true);
          if (reconnectRef.current) {
            clearTimeout(reconnectRef.current);
            reconnectRef.current = null;
          }
        };
        ws.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data.type === "notification" && data.notification) {
              const notif = data.notification;
              broadcast(notif);
              queueBanner(notif);
            }
          } catch (_) {
            /* ignore */
          }
        };
        ws.onclose = () => {
          setConnected(false);
          if (cancelled) return;
          // Reconnect with backoff
          reconnectRef.current = setTimeout(connect, backoff.next());
        };
        ws.onerror = () => { try { ws.close(); } catch (_) { /* ignore */ } };
      } catch (_) {
        if (!cancelled) reconnectRef.current = setTimeout(connect, backoff.next());
      }
    };

    connect();
    const offOnline = onBackOnline(() => { if (!cancelled && wsRef.current?.readyState !== WebSocket.OPEN) { clearTimeout(reconnectRef.current); backoff.reset(); connect(); } });
    return () => {
      cancelled = true;
      offOnline();
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current && wsRef.current.readyState <= 1) wsRef.current.close();
    };
  }, [token, user, broadcast, queueBanner]);

  const handleClick = (notif) => {
    dismiss(notif.__bannerId);
    const url = notif.url || notif.action_url || (notif.target_type === "post" && notif.target_id ? `/post/${notif.target_id}` : "/notifications");
    navigate(url);
  };

  return (
    <NotifCtx.Provider value={{ connected, subscribe, lastEvent: banners[0] || null }}>
      {children}
      {/* Slide-in stack — fixed top-center */}
      <div
        className="pointer-events-none fixed top-2 inset-x-0 z-[200] flex flex-col items-center gap-2 px-2 sm:top-3"
        data-testid="realtime-notif-stack"
      >
        <AnimatePresence initial={false}>
          {banners.map((b) => (
            <Banner
              key={b.__bannerId}
              notif={b}
              onClick={() => handleClick(b)}
              onClose={() => dismiss(b.__bannerId)}
            />
          ))}
        </AnimatePresence>
      </div>
    </NotifCtx.Provider>
  );
};

export default RealtimeNotificationProvider;
