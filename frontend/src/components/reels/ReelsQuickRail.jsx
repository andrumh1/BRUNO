/**
 * ReelsQuickRail — menú vertical de Reels (una sola columna, en este orden):
 *   Historias → Feed → Explorar
 * Reutiliza las secciones existentes: historias (stories/feed + BrunoStoryViewer),
 * el feed de reels "Para ti" y Explorar tarjetas (CardsExplorer, antes en el Mapa).
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Film, Compass, Plus, X } from "lucide-react";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";
import CardsExplorer from "@/components/CardsExplorer";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const ITEMS = [
  { id: "stories", label: "Historias", Icon: Sparkles },
  { id: "feed", label: "Feed", Icon: Film },
  { id: "explore", label: "Explorar", Icon: Compass },
];

function Sheet({ title, onClose, children, testid }) {
  return (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute inset-x-0 bottom-0 z-[70] bg-background/95 backdrop-blur-2xl rounded-t-[28px] border-t border-border/50 shadow-2xl flex flex-col text-foreground"
      style={{ top: "calc(var(--safe-top) + 64px)" }}
      data-testid={testid}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="mx-auto absolute left-1/2 -translate-x-1/2 top-2 w-10 h-1 rounded-full bg-foreground/20" />
        <h2 className="font-bold text-base mt-2">{title}</h2>
        <button onClick={onClose} className="mt-2 w-8 h-8 rounded-full bg-muted grid place-items-center" data-testid={`${testid}-close`} aria-label="Cerrar"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-4" style={{ paddingBottom: "calc(var(--nav-reserve, 88px) + 16px)" }}>{children}</div>
    </motion.div>
  );
}

function StoriesSheet({ token, user, onClose }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState(null);
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    if (!token) { setGroups([]); return; }
    axios.get(`${API}/stories/feed`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setGroups(Array.isArray(r.data) ? r.data : [])).catch(() => setGroups([]));
  }, [token]);
  return (
    <>
      <Sheet title="Historias" onClose={onClose} testid="reels-stories-sheet">
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 pt-2">
          <button onClick={() => { onClose(); navigate("/camera"); }} className="flex flex-col items-center gap-1.5" data-testid="reels-stories-sheet-create">
            <div className="relative w-16 h-16 rounded-full border-2 border-border overflow-hidden bg-muted grid place-items-center">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover opacity-80" /> : null}
              <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary border-2 border-background grid place-items-center"><Plus className="w-3.5 h-3.5 text-white" strokeWidth={3} /></span>
            </div>
            <span className="text-[11px] font-medium">Tu historia</span>
          </button>
          {(groups || []).map((g) => (
            <button key={g.user_id} onClick={() => setViewing(g)} className="flex flex-col items-center gap-1.5" data-testid={`reels-stories-sheet-${g.user_id}`}>
              <div className={`w-16 h-16 rounded-full p-[2px] ${g.has_unseen ? "bg-gradient-to-tr from-primary via-pink-500 to-yellow-400" : "bg-border"}`}>
                <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                  {g.avatar_url ? <img src={g.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-sm font-bold">{(g.user_name || g.username || "?").charAt(0).toUpperCase()}</div>}
                </div>
              </div>
              <span className="text-[11px] font-medium max-w-[64px] truncate">{g.user_name || g.username || "usuario"}</span>
            </button>
          ))}
        </div>
        {groups && groups.length === 0 && <p className="text-sm text-muted-foreground text-center py-10" data-testid="reels-stories-sheet-empty">{token ? "Nadie que sigues publicó historias en las últimas 24 h." : "Inicia sesión para ver las historias de quienes sigues."}</p>}
      </Sheet>
      {viewing && <BrunoStoryViewer userStories={viewing} allUsers={groups || []} onClose={() => setViewing(null)} onNavigate={(g) => setViewing(g)} />}
    </>
  );
}

export default function ReelsQuickRail({ token, user, visible, onFeed }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.nav
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
            className="absolute left-2 z-20 flex flex-col items-center gap-3 reel-chrome"
            style={{ top: "calc(var(--safe-top) + 236px)" }}
            aria-label="Menú de Reels"
            data-testid="reels-quick-rail"
          >
            {ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { if (id === "feed") { setOpen(null); onFeed?.(); } else setOpen(id); }}
                className="flex flex-col items-center gap-1 group"
                data-testid={`reels-rail-${id}`}
                aria-label={label}
              >
                <span className={`w-10 h-10 rounded-full grid place-items-center backdrop-blur-md border border-white/25 transition-transform active:scale-90 ${open === id ? "bg-primary text-white" : "bg-black/35 text-white"}`}>
                  <Icon className="w-[18px] h-[18px]" />
                </span>
                <span className="text-[10px] font-semibold text-white drop-shadow">{label}</span>
              </button>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open === "stories" && <StoriesSheet key="stories" token={token} user={user} onClose={() => setOpen(null)} />}
        {open === "explore" && (
          <Sheet key="explore" title="Explorar tarjetas" onClose={() => setOpen(null)} testid="reels-explore-sheet">
            <CardsExplorer />
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
