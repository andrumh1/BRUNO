/**
 * ReelsQuickRail — menú vertical de Reels bajo "Tu historia" (una sola columna):
 *   Tu historia (franja) → Feed → Explorar
 * Reutiliza las secciones existentes: historias (stories/feed + BrunoStoryViewer),
 * el Feed cronológico de publicaciones (ReelsFeedSheet) y Explorar tarjetas (CardsExplorer, antes en el Mapa).
 */
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Film, Compass, X } from "lucide-react";
import CardsExplorer from "@/components/CardsExplorer";
import ReelsFeedSheet from "@/components/reels/ReelsFeedSheet";


// Orden en pantalla: "Tu historia" (franja de historias) → Feed → Explorar
const ITEMS = [
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

export default function ReelsQuickRail({ token, user, visible }) {
  const [open, setOpen] = useState(null);
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.nav
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}
            className="absolute left-2 z-20 flex flex-col items-center gap-3 reel-chrome"
            style={{ top: "calc(var(--safe-top) + 140px)" }}
            aria-label="Menú de Reels"
            data-testid="reels-quick-rail"
          >
            {ITEMS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => setOpen(open === id ? null : id)}
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
        {open === "feed" && (
          <Sheet key="feed" title="Feed" onClose={() => setOpen(null)} testid="reels-feed-sheet">
            <ReelsFeedSheet token={token} user={user} onClose={() => setOpen(null)} />
          </Sheet>
        )}
        {open === "explore" && (
          <Sheet key="explore" title="Explorar tarjetas" onClose={() => setOpen(null)} testid="reels-explore-sheet">
            <CardsExplorer />
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
