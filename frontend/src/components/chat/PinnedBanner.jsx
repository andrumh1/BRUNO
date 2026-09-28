import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, X } from "lucide-react";

/** PinnedBanner — pinned message strip under the chat header; tap → jump, ✕ → unpin (admin) */
const PinnedBanner = ({ pinned, canUnpin, onJump, onUnpin }) => (
  <AnimatePresence>
    {pinned && (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden border-b bg-primary/5" data-testid="pinned-banner">
        <div className="flex items-center gap-2.5 px-3 py-2">
          <span className="w-1 self-stretch rounded-full bg-primary shrink-0" />
          <button type="button" onClick={() => onJump?.(pinned.id)} className="flex-1 min-w-0 text-left" data-testid="pinned-banner-jump">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-primary flex items-center gap-1"><Pin className="w-3 h-3" /> Mensaje fijado · {pinned.sender_name}</p>
            <p className="text-xs truncate" data-testid="pinned-banner-text">{pinned.content}</p>
          </button>
          {canUnpin && (
            <button type="button" onClick={onUnpin} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground shrink-0" aria-label="Quitar fijado" data-testid="pinned-banner-unpin"><X className="w-4 h-4" /></button>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default PinnedBanner;
