import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Bell,
  BellRing,
  BellOff,
  Settings,
  Check,
  CheckCheck,
  ChevronDown,
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
  Loader2,
  Inbox,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const NOTIFICATION_ICONS = {
  incoming_call: Phone,
  new_message: MessageCircle,
  new_follower: UserPlus,
  post_like: Heart,
  post_comment: MessageCircle,
  product_favorited: Star,
  product_cart_added: ShoppingCart,
  new_story: Camera,
  mention: AtSign,
  order_update: Package,
  promotion: Tag,
  deal_commission: Sparkles,
};

const NOTIFICATION_COLORS = {
  incoming_call: "text-emerald-500 bg-emerald-500/10",
  new_message: "text-blue-500 bg-blue-500/10",
  new_follower: "text-purple-500 bg-purple-500/10",
  post_like: "text-pink-500 bg-pink-500/10",
  post_comment: "text-blue-500 bg-blue-500/10",
  mention: "text-orange-500 bg-orange-500/10",
  product_favorited: "text-amber-500 bg-amber-500/10",
  product_cart_added: "text-amber-500 bg-amber-500/10",
  new_story: "text-purple-500 bg-purple-500/10",
  order_update: "text-cyan-500 bg-cyan-500/10",
  promotion: "text-orange-500 bg-orange-500/10",
  deal_commission: "text-orange-500 bg-orange-500/10",
};

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "unread", label: "No leídas" },
  { id: "mentions", label: "Menciones", types: ["mention"] },
  { id: "social", label: "Social", types: ["post_like", "post_comment", "new_follower", "new_story"] },
  { id: "deal", label: "DEAL", types: ["deal_commission", "order_update", "product_favorited", "product_cart_added"] },
];

function NotificationRow({ notif, onMark, onClick }) {
  const Icon = NOTIFICATION_ICONS[notif.type] || Bell;
  const color = NOTIFICATION_COLORS[notif.type] || "text-zinc-500 bg-zinc-500/10";
  const isUnread = !notif.is_read && !notif.read;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -40 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (isUnread) onMark?.(notif.id);
        onClick?.(notif);
      }}
      data-testid={`notif-${notif.id}`}
      className={`w-full flex items-start gap-3 p-3 rounded-2xl text-left transition-colors ${
        isUnread ? "bg-orange-500/[0.06] hover:bg-orange-500/10" : "hover:bg-muted/50"
      }`}
    >
      <div className={`shrink-0 grid place-items-center h-10 w-10 rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold truncate">
            {notif.actor?.username || notif.title || "Bruno"}
          </p>
          {isUnread && <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2">
          {notif.body || notif.message || notif.title || ""}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{timeAgo(notif.created_at)}</p>
      </div>
    </motion.button>
  );
}

export default function NotificationsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { isSubscribed, permission, subscribe, unsubscribe, isSupported } = usePushNotifications();

  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/notifications?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs(Array.isArray(res.data) ? res.data : []);
    } catch (_) {
      setNotifs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) return;
    load();
    // poll every 60s
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [token]);

  const handleMark = async (id) => {
    setNotifs((arr) =>
      arr.map((n) => (n.id === id ? { ...n, is_read: true, read: true } : n))
    );
    try {
      await axios.post(
        `${API}/notifications/mark-read/${id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (_) {
      /* ignore */
    }
  };

  const handleMarkAll = async () => {
    setMarking(true);
    try {
      await axios.put(`${API}/notifications/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifs((arr) => arr.map((n) => ({ ...n, is_read: true, read: true })));
      brunoToast.success("Todas marcadas como leídas");
    } catch (_) {
      brunoToast.error("No se pudo marcar todas");
    } finally {
      setMarking(false);
    }
  };

  const handleClick = (n) => {
    const url = n.action_url || n.url;
    if (url) navigate(url);
  };

  const togglePush = async () => {
    try {
      if (isSubscribed) await unsubscribe();
      else await subscribe();
    } catch (_) {
      brunoToast.error("Error en notificaciones push");
    }
  };

  // Apply filter
  const filtered = (() => {
    const f = FILTERS.find((x) => x.id === filter);
    if (!f) return notifs;
    if (filter === "all") return notifs;
    if (filter === "unread") return notifs.filter((n) => !(n.is_read || n.read));
    if (f.types) return notifs.filter((n) => f.types.includes(n.type));
    return notifs;
  })();

  const unreadCount = notifs.filter((n) => !(n.is_read || n.read)).length;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="notifications-page">
      {/* Minimal header */}
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {unreadCount > 0 ? (
              <BellRing className="w-5 h-5 text-orange-500" />
            ) : (
              <Bell className="w-5 h-5 text-orange-500" />
            )}
            <h1 className="font-bold text-base">Notificaciones</h1>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-orange-500 rounded-full px-2 py-0.5">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAll}
              disabled={marking}
              data-testid="notifs-mark-all"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 disabled:opacity-50"
            >
              {marking ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Marcar todas
            </button>
          )}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-3 py-3">
        {/* Collapsible settings — minimized single pill */}
        <motion.div layout className="mb-3">
          <button
            onClick={() => setShowSettings((v) => !v)}
            data-testid="notif-settings-toggle"
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4 text-orange-500 shrink-0" />
            <span className="flex-1 text-left text-sm font-semibold">
              Configuración de notificaciones
            </span>
            {isSupported && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5 ${
                  isSubscribed
                    ? "bg-emerald-500/15 text-emerald-600"
                    : "bg-zinc-500/15 text-zinc-500"
                }`}
              >
                {isSubscribed ? "ON" : "OFF"}
              </span>
            )}
            <motion.span
              animate={{ rotate: showSettings ? 180 : 0 }}
              transition={{ duration: 0.25 }}
              className="text-muted-foreground"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {showSettings && (
              <motion.div
                key="settings-panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
                data-testid="notif-settings-panel"
              >
                <div className="mt-2 rounded-2xl bg-card border border-border/60 p-3 space-y-2.5">
                  {isSupported && (
                    <button
                      onClick={togglePush}
                      className="w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/60 text-left"
                    >
                      <span className="grid place-items-center h-9 w-9 rounded-lg bg-orange-500/10 text-orange-500">
                        {isSubscribed ? <BellRing className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {isSubscribed ? "Push activadas" : "Activar push"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Recibe alertas instantáneas en este navegador
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${isSubscribed ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-500/15 text-zinc-500"}`}>
                        {isSubscribed ? "ON" : "OFF"}
                      </span>
                    </button>
                  )}
                  <Link
                    to="/settings/notifications"
                    className="w-full flex items-center gap-3 rounded-xl p-2.5 hover:bg-muted/60"
                  >
                    <span className="grid place-items-center h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500">
                      <Settings className="h-4 w-4" />
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Preferencias detalladas</p>
                      <p className="text-[11px] text-muted-foreground">
                        Activa/desactiva cada tipo de notificación
                      </p>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Filter chips */}
        <div className="overflow-x-auto scrollbar-none mb-3 -mx-3 px-3">
          <div className="flex gap-2 w-max">
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  data-testid={`notif-filter-${f.id}`}
                  className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                    active
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-card border-border/60 text-foreground hover:bg-muted/60"
                  }`}
                >
                  {f.label}
                  {f.id === "unread" && unreadCount > 0 && (
                    <span className={`ml-1.5 text-[10px] font-bold rounded-full px-1.5 py-px ${active ? "bg-white/20" : "bg-orange-500/20 text-orange-500"}`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notifications list */}
        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
          </div>
        ) : filtered.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 px-4"
          >
            <div className="mx-auto h-16 w-16 rounded-2xl bg-orange-500/10 grid place-items-center mb-3">
              <Inbox className="h-8 w-8 text-orange-500" />
            </div>
            <p className="font-semibold text-sm">
              {filter === "all" ? "Sin notificaciones" : "Nada por aquí"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              {filter === "all"
                ? "Cuando ocurra algo importante te avisaremos aquí."
                : "No hay notificaciones que coincidan con este filtro."}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-1.5" data-testid="notifs-list">
            <AnimatePresence initial={false}>
              {filtered.map((n) => (
                <NotificationRow
                  key={n.id}
                  notif={n}
                  onMark={handleMark}
                  onClick={handleClick}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
