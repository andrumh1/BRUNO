/**
 * MapProfilesBar — interactive pill bar on top of the map with bubbles for:
 *   - LIVE: usuarios compartiendo ubicacion en vivo
 *   - PIUP Cards: tarjetas reclamadas + tarjetas con direccion guardada
 *   - Stories: historias 24h con ubicacion adjunta
 *
 * Self-fetching: pings backend on mount + every 60s + listens to
 * `bounds_changed` style events via the `onSelect` callback parent provides.
 *
 * Tap behavior:
 *   - User bubble       → onSelect({kind:'user', ...}) (parent centers map)
 *   - Card / PIUP bubble→ onSelect + navigate to /c/{card_id}
 *   - Story bubble      → opens BrunoStoryViewer inline (no navigation)
 *
 * Position: floats just above the MobileBottomNav (uses var(--nav-reserve)).
 */
/* eslint-disable */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Users,
  MapPin,
  Lock,
  Briefcase,
  User as UserIcon,
  Radio,
  Sparkles,
  Play,
  Loader2,
  Navigation,
} from "lucide-react";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FILTERS = [
  { id: "all",      label: "Todos",    Icon: Users },
  { id: "piup",     label: "PIUP",     Icon: MapPin },
  { id: "stories",  label: "Stories",  Icon: Sparkles },
  { id: "live",     label: "En vivo",  Icon: Radio },
  { id: "near",     label: "Historias cerca de mí", Icon: Navigation },
];

const distM = (a, b) => {
  const R = 6371000, toR = (d) => (d * Math.PI) / 180;
  const dLat = toR(b.lat - a.lat), dLng = toR(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};
const fmtDist = (m) => (m == null ? "" : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

function typeBadge(item) {
  if (item.kind === "story") return { Icon: Play, color: "bg-fuchsia-500" };
  if (item.kind === "user") return { Icon: Radio, color: "bg-emerald-500" };
  if (item.kind === "piup") return { Icon: MapPin, color: "bg-orange-500" };
  if (item.card_type === "business" || item.type === "business") {
    return { Icon: Briefcase, color: "bg-blue-500" };
  }
  if (item.card_type === "place") return { Icon: MapPin, color: "bg-purple-500" };
  return { Icon: UserIcon, color: "bg-orange-500" };
}

function ProfileBubble({ item, onClick, testId }) {
  const isPrivate = item.share_scope === "private" || item.visibility === "private";
  const { Icon: Badge, color } = typeBadge(item);
  const avatar = item.avatar_url || item.image_url || item.logo_url || item.media_url;
  const name = item.display_name || item.name || item.title || item.user_name || item.username || "Bruno";

  const isStory = item.kind === "story";
  const ringClass = isStory
    ? "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-transparent"
    : item.kind === "piup"
      ? "ring-2 ring-orange-500/60"
      : "ring-2 ring-zinc-200 dark:ring-zinc-700";

  return (
    <motion.button
      layout
      onClick={() => onClick?.(item)}
      data-testid={testId}
      whileTap={{ scale: 0.92 }}
      whileHover={{ y: -2 }}
      className="shrink-0 flex flex-col items-center gap-1 group"
    >
      <div className="relative">
        <div className={`w-14 h-14 rounded-full overflow-hidden ${ringClass} bg-zinc-100 dark:bg-zinc-800 grid place-items-center`}>
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-6 h-6 text-zinc-400" />
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid place-items-center w-5 h-5 rounded-full ${color} text-white shadow ring-2 ring-white dark:ring-zinc-900`}
        >
          <Badge className="w-2.5 h-2.5" />
        </span>
        {isPrivate && (
          <span className="absolute -top-0.5 -right-0.5 grid place-items-center w-5 h-5 rounded-full bg-zinc-800 text-white shadow">
            <Lock className="w-2.5 h-2.5" />
          </span>
        )}
        {item.kind === "user" && (
          <span className="absolute inset-0 rounded-full ring-4 ring-emerald-500/20 animate-pulse pointer-events-none" />
        )}
      </div>
      <span className="text-[10px] font-semibold max-w-[64px] truncate text-zinc-700 dark:text-zinc-200 group-hover:text-orange-600">
        {name}
      </span>
      {item.place_name && (
        <span className="text-[9px] text-zinc-500 max-w-[64px] truncate">
          {item.place_name}
        </span>
      )}
      {item.distance_m != null && (
        <span className="text-[9px] font-bold text-orange-600 dark:text-orange-300" data-testid={`${testId}-distance`}>{fmtDist(item.distance_m)}</span>
      )}
    </motion.button>
  );
}

export default function MapProfilesBar({
  nearbyUsers = [],
  cards: cardsProp = [],
  cardItems = null, // si el padre la provee, es la lista exacta de tarjetas del mapa (sin re-fetch)
  onSelect,
  currentUserId,
  testId = "map-profiles-bar",
}) {
  const { token } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState("all");
  const [me, setMe] = useState(null);       // ubicación del usuario (solo al pedir "cerca de mí")
  const [meState, setMeState] = useState("idle"); // idle | asking | denied
  const askMyLocation = () => {
    if (!navigator.geolocation) { setMeState("denied"); return; }
    setMeState("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setMeState("ok"); },
      () => setMeState("denied"),
      { timeout: 8000, maximumAge: 120000, enableHighAccuracy: false },
    );
  };
  const [piupPins, setPiupPins] = useState([]);
  const [locatedCards, setLocatedCards] = useState([]);
  const [locatedStories, setLocatedStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openStory, setOpenStory] = useState(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      // Run all three in parallel; never block the bar on a single failure.
      const [pinsRes, cardsRes, storiesRes] = await Promise.allSettled([
        cardItems ? Promise.reject(new Error("provided")) : axios.get(`${API}/map-pins`, {
          params: { min_lat: -90, max_lat: 90, min_lng: -180, max_lng: 180, limit: 200 },
        }),
        cardItems ? Promise.reject(new Error("provided")) : axios.get(`${API}/map-pins/cards-located`, { params: { limit: 200 } }),
        axios.get(`${API}/stories/located`, { params: { limit: 100 } }),
      ]);
      if (pinsRes.status === "fulfilled") {
        setPiupPins((pinsRes.value.data?.pins || []).map((p) => ({ ...p, kind: "piup" })));
      }
      if (cardsRes.status === "fulfilled") {
        setLocatedCards((cardsRes.value.data?.cards || []).map((c) => ({ ...c, kind: "card" })));
      }
      if (storiesRes.status === "fulfilled") {
        setLocatedStories((storiesRes.value.data?.stories || []).map((s) => ({ ...s, kind: "story" })));
      }
    } catch (_) { /* swallow */ } finally {
      setLoading(false);
    }
  }, [cardItems !== null]);

  useEffect(() => {
    if (!cardItems) return;
    setPiupPins(cardItems.filter((i) => i.kind === "piup"));
    setLocatedCards(cardItems.filter((i) => i.kind === "card"));
  }, [cardItems]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  // Combine everything into the unified list
  // RULE: only items WITH a valid location (lat+lng or address) appear here.
  // The map bottom-bar's purpose is "places you can navigate to", so anything
  // missing geo info is filtered out — explicitly per user request.
  const hasLocation = (it) => {
    const lat = it.lat ?? it.location?.lat;
    const lng = it.lng ?? it.location?.lng;
    if (typeof lat === "number" && typeof lng === "number" && !Number.isNaN(lat) && !Number.isNaN(lng)) return true;
    // Stories use { location: { lat, lng } } too
    return false;
  };

  const items = useMemo(() => {
    const list = [];
    for (const u of nearbyUsers) {
      if (u.id === currentUserId) continue;
      if (!hasLocation(u)) continue;
      list.push({ ...u, kind: "user", share_scope: u.share_scope || "public" });
    }
    // PIUP claimed pins first (they have the brand styling)
    for (const p of piupPins) {
      if (!hasLocation(p)) continue;
      list.push({ ...p, name: p.title });
    }
    // Then located cards (deduplicated against PIUP pins by card_id)
    const piupCardIds = new Set(piupPins.map((p) => p.card_id));
    for (const c of cardsProp) {
      if (!hasLocation(c)) continue;
      if (!piupCardIds.has(c.id)) {
        list.push({ ...c, kind: "card" });
        piupCardIds.add(c.id);
      }
    }
    for (const c of locatedCards) {
      if (!hasLocation(c)) continue;
      if (!piupCardIds.has(c.id)) {
        list.push(c);
        piupCardIds.add(c.id);
      }
    }
    // Stories last (they have the most distinctive ring)
    for (const s of locatedStories) {
      if (!hasLocation(s)) continue;
      list.push(s);
    }
    return list;
  }, [nearbyUsers, currentUserId, piupPins, locatedCards, locatedStories, cardsProp]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "piup")
      return items.filter((i) => i.kind === "piup" || i.kind === "card");
    if (filter === "stories") return items.filter((i) => i.kind === "story");
    if (filter === "live") return items.filter((i) => i.kind === "user");
    if (filter === "near") {
      const stories = items.filter((i) => i.kind === "story" && i.lat != null && i.lng != null);
      if (!me) return stories;
      return stories.map((i) => ({ ...i, distance_m: distM(me, i) })).sort((a, b) => a.distance_m - b.distance_m);
    }
    return items;
  }, [items, filter, me]);

  const counts = useMemo(() => ({
    piup: piupPins.length + locatedCards.length,
    stories: locatedStories.length,
    live: items.filter((i) => i.kind === "user").length,
  }), [piupPins, locatedCards, locatedStories, items]);

  const handleSelect = async (item) => {
    onSelect?.(item);
    if (item.kind === "story") {
      // Load the user's full stories so the viewer can paginate
      try {
        const res = await axios.get(`${API}/stories/user/${item.user_id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const stories = res.data || [];
        setOpenStory({
          user_id: item.user_id,
          user_name: item.user_name || "Bruno",
          avatar_url: item.avatar_url,
          stories: stories.length > 0 ? stories : [item],
        });
      } catch (_) {
        setOpenStory({
          user_id: item.user_id,
          user_name: item.user_name || "Bruno",
          avatar_url: item.avatar_url,
          stories: [item],
        });
      }
      return;
    }
    if (item.kind === "piup" || item.kind === "card") {
      const id = item.card_id || item.id;
      if (id) navigate(`/c/${id}`);
    }
  };

  return (
    <>
      <motion.div
        layout
        data-testid={testId}
        className="fixed left-2 right-2 z-[40] pointer-events-none"
        style={{ bottom: "calc(var(--nav-reserve, 96px) + 8px)" }}
        animate={{ bottom: `calc(var(--nav-reserve, 96px) + 8px)` }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
      >
        <motion.div
          layout
          className="pointer-events-auto bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-3xl shadow-2xl border border-black/5 dark:border-white/10 overflow-hidden"
        >
          {/* Header bar */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            data-testid={`${testId}-toggle`}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-orange-500/5 transition-colors"
          >
            <span className="grid place-items-center h-7 w-7 rounded-full bg-orange-500/15 text-orange-500">
              <Users className="h-3.5 w-3.5" />
            </span>
            <span className="flex-1 text-left text-xs font-bold text-zinc-900 dark:text-zinc-50">
              {loading ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Cargando...
                </span>
              ) : (
                `${filtered.length} ${filtered.length === 1 ? "elemento" : "elementos"} en el mapa`
              )}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-orange-600 bg-orange-500/15 rounded-full px-1.5 py-0.5">
              <MapPin className="w-2.5 h-2.5" />
              PIUP {counts.piup}
            </span>
            {counts.stories > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-fuchsia-600 bg-fuchsia-500/15 rounded-full px-1.5 py-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                {counts.stories}
              </span>
            )}
            {counts.live > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/15 rounded-full px-1.5 py-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                LIVE
              </span>
            )}
            <motion.span
              animate={{ rotate: expanded ? 0 : 180 }}
              transition={{ duration: 0.25 }}
              className="text-zinc-500"
            >
              <ChevronDown className="h-4 w-4" />
            </motion.span>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.28 }}
                className="overflow-hidden"
              >
                {/* Filter chips */}
                <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto scrollbar-none">
                  {FILTERS.map(({ id, label, Icon }) => {
                    const active = filter === id;
                    return (
                      <button
                        key={id}
                        onClick={() => { setFilter(id); if (id === "near" && !me) askMyLocation(); }}
                        data-testid={`${testId}-filter-${id}`}
                        className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border transition-colors ${
                          active
                            ? "bg-orange-500 border-orange-500 text-white"
                            : "bg-transparent border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Bubble strip */}
                <div className="pb-3 px-3">
                  {filter === "near" && meState === "denied" && <p className="px-3 pb-1 text-[10px] text-amber-600 dark:text-amber-400" data-testid={`${testId}-near-denied`}>Sin permiso de ubicación: se muestran las historias con lugar sin ordenar. <button onClick={askMyLocation} className="underline font-semibold">Reintentar</button></p>}
                  {filter === "near" && meState === "asking" && <p className="px-3 pb-1 text-[10px] text-zinc-500" data-testid={`${testId}-near-asking`}>Obteniendo tu ubicación…</p>}
                  {filtered.length === 0 ? (
                    <div className="text-center py-3 text-xs text-zinc-500 dark:text-zinc-400">
                      Nada por aqui todavia. {filter === "piup" ? "Reclama tu primera PIUP en el mapa." : filter === "stories" ? "Publica una historia con ubicacion." : filter === "near" ? "No hay historias con lugar cerca por ahora." : "Activa la ubicacion para aparecer aqui."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto scrollbar-none -mx-1">
                      <div className="flex gap-2.5 px-1 py-1 w-max">
                        {filtered.map((item, idx) => (
                          <ProfileBubble
                            key={`${item.kind}-${item.id || idx}`}
                            item={item}
                            onClick={handleSelect}
                            testId={`${testId}-bubble-${item.id || idx}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Story viewer (story bubble tapped) */}
      {openStory && (
        <BrunoStoryViewer
          userStories={openStory}
          allUsers={[]}
          onClose={() => setOpenStory(null)}
        />
      )}
    </>
  );
}
