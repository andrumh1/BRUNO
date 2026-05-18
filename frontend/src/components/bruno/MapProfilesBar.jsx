import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronUp,
  ChevronDown,
  Users,
  MapPin,
  Eye,
  Lock,
  Briefcase,
  User as UserIcon,
  Radio,
  Filter,
} from "lucide-react";

/**
 * MapProfilesBar — horizontal collapsible bar with avatars of profiles
 * currently sharing their location (public or private-with-access).
 *
 * Positioned ABOVE the floating MobileBottomNav (uses CSS var --nav-reserve).
 *
 * Props:
 *   nearbyUsers   — array of users from WS `users_nearby`
 *   cards         — array of cards with public locations
 *   onSelect(item) — focus map on this profile
 *   currentUserId
 */

const FILTERS = [
  { id: "all", label: "Todos", Icon: Users },
  { id: "people", label: "Personas", Icon: UserIcon },
  { id: "business", label: "Negocios", Icon: Briefcase },
  { id: "live", label: "En vivo", Icon: Radio },
];

function typeBadge(item) {
  if (item.kind === "user") return { Icon: Radio, color: "bg-emerald-500" };
  if (item.card_type === "business" || item.type === "business") {
    return { Icon: Briefcase, color: "bg-blue-500" };
  }
  if (item.card_type === "place") return { Icon: MapPin, color: "bg-purple-500" };
  return { Icon: UserIcon, color: "bg-orange-500" };
}

function ProfileBubble({ item, onClick, testId }) {
  const isPrivate = item.share_scope === "private" || item.visibility === "private";
  const { Icon: Badge, color } = typeBadge(item);
  const avatar = item.avatar_url || item.image_url || item.logo_url;
  const name = item.display_name || item.name || item.title || item.username || "Bruno";

  return (
    <motion.button
      layout
      onClick={() => onClick?.(item)}
      data-testid={testId}
      whileTap={{ scale: 0.9 }}
      whileHover={{ y: -2 }}
      className="shrink-0 flex flex-col items-center gap-1 group"
    >
      <div className="relative">
        <div
          className={`h-14 w-14 rounded-full overflow-hidden ring-2 ${
            item.kind === "user" ? "ring-emerald-500" : "ring-orange-500"
          } shadow-lg`}
        >
          {avatar ? (
            <img
              src={avatar}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full grid place-items-center text-sm font-bold text-white bg-gradient-to-br from-orange-400 to-orange-600">
              {name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 grid place-items-center h-5 w-5 rounded-full ${color} text-white shadow-md border-2 border-white dark:border-zinc-900`}
        >
          <Badge className="h-2.5 w-2.5" />
        </span>
        {isPrivate && (
          <span
            title="Compartido contigo"
            className="absolute -top-0.5 -left-0.5 grid place-items-center h-4 w-4 rounded-full bg-zinc-800 text-white shadow"
          >
            <Lock className="h-2 w-2" />
          </span>
        )}
        {item.kind === "user" && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-4 ring-emerald-500/20 animate-pulse pointer-events-none"
          />
        )}
      </div>
      <span className="text-[10px] font-semibold max-w-[64px] truncate text-zinc-700 dark:text-zinc-200 group-hover:text-orange-600">
        {name}
      </span>
    </motion.button>
  );
}

export default function MapProfilesBar({
  nearbyUsers = [],
  cards = [],
  onSelect,
  currentUserId,
  testId = "map-profiles-bar",
}) {
  const [expanded, setExpanded] = useState(true);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  // Combine users + cards into a unified list
  const items = useMemo(() => {
    const list = [];
    for (const u of nearbyUsers) {
      if (u.id === currentUserId) continue;
      list.push({
        ...u,
        kind: "user",
        share_scope: u.share_scope || "public",
      });
    }
    for (const c of cards) {
      list.push({
        ...c,
        kind: "card",
        share_scope: c.location?.visibility || c.visibility || "public",
      });
    }
    return list;
  }, [nearbyUsers, cards, currentUserId]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "people") return items.filter((i) => i.kind === "user" || i.card_type === "personal");
    if (filter === "business")
      return items.filter((i) => i.card_type === "business" || i.card_type === "place" || i.type === "business");
    if (filter === "live") return items.filter((i) => i.kind === "user");
    return items;
  }, [items, filter]);

  const handleSelect = (item) => {
    onSelect?.(item);
    if (item.kind === "card" && item.id) navigate(`/c/${item.id}`);
  };

  return (
    <motion.div
      layout
      data-testid={testId}
      className="fixed left-2 right-2 z-[40] pointer-events-none"
      style={{
        bottom: "calc(var(--nav-reserve, 96px) + 8px)",
      }}
      animate={{
        bottom: `calc(var(--nav-reserve, 96px) + 8px)`,
      }}
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
            {filtered.length} {filtered.length === 1 ? "perfil" : "perfiles"} compartiendo ubicación
          </span>
          {filtered.some((i) => i.kind === "user") && (
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
                      onClick={() => setFilter(id)}
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
                {filtered.length === 0 ? (
                  <div className="text-center py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    Nadie está compartiendo su ubicación ahora mismo.
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
  );
}
