import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AtSign } from "lucide-react";

/** MentionPicker — floating list of group members while typing "@..." in a group chat */
const MentionPicker = ({ members = [], query, onPick, currentUserId }) => {
  if (query === null || query === undefined) return null;
  const q = query.toLowerCase();
  const list = members.filter((m) => m.id !== currentUserId && ((m.display_name || m.username || "").toLowerCase().includes(q))).slice(0, 6);
  return (
    <AnimatePresence>
      {list.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.14 }}
          className="no-glass mx-3 mb-1 rounded-2xl border shadow-xl overflow-hidden" style={{ background: "hsl(var(--card))" }} data-testid="mention-picker">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><AtSign className="w-3 h-3" /> Mencionar · avisa aunque el grupo esté silenciado</p>
          {list.map((m) => (
            <button key={m.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onPick(m)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-muted text-left" data-testid={`mention-option-${m.id}`}>
              {m.avatar_url ? <img src={m.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <span className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold text-xs flex items-center justify-center">{(m.display_name || m.username || "?")[0].toUpperCase()}</span>}
              <span className="text-sm font-medium truncate">{m.display_name || m.username}</span>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const mentionHandle = (m) => (m.display_name || m.username || "usuario").trim().split(/\s+/).slice(0, 2).join("");

export default MentionPicker;
