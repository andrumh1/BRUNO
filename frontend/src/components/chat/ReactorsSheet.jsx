import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** ReactorsSheet — who reacted to a message, grouped by emoji; tap my own to remove it */
const ReactorsSheet = ({ chatId, messageId, token, isOpen, onClose, onToggle }) => {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("all");

  useEffect(() => {
    if (!isOpen || !messageId) { setData(null); setTab("all"); return; }
    axios.get(`${API}/chats/${chatId}/messages/${messageId}/reactions`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setData(r.data)).catch(() => setData({ total: 0, groups: [] }));
  }, [isOpen, messageId, chatId, token]);

  const users = data ? (tab === "all" ? data.groups.flatMap((g) => g.users.map((u) => ({ ...u, emoji: g.emoji }))) : (data.groups.find((g) => g.emoji === tab)?.users || []).map((u) => ({ ...u, emoji: tab }))) : [];

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="reactors-sheet">
          <motion.div className="w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" style={{ maxHeight: "60vh" }}
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="font-bold text-sm">Reacciones {data ? `· ${data.total}` : ""}</h3>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" data-testid="reactors-close"><X className="w-4 h-4" /></button>
            </div>
            {!data ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
              <>
                <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto">
                  <button onClick={() => setTab("all")} className={`px-3 h-8 rounded-full text-xs font-semibold shrink-0 ${tab === "all" ? "bg-primary text-white" : "bg-muted"}`} data-testid="reactors-tab-all">Todas {data.total}</button>
                  {data.groups.map((g) => (
                    <button key={g.emoji} onClick={() => setTab(g.emoji)} className={`px-3 h-8 rounded-full text-xs font-semibold shrink-0 ${tab === g.emoji ? "bg-primary text-white" : "bg-muted"}`} data-testid={`reactors-tab-${g.emoji}`}>{g.emoji} {g.count}</button>
                  ))}
                </div>
                <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "40vh" }}>
                  {users.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Nadie ha reaccionado aún · doble toque = ❤️</p>}
                  {users.map((u, i) => (
                    <div key={`${u.id}-${u.emoji}-${i}`} className="flex items-center gap-3 px-2 py-2 rounded-xl" data-testid={`reactor-${u.id}`}>
                      {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">{(u.name || "?")[0].toUpperCase()}</span>}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.is_me ? "Tú" : u.name}</p>
                        {u.is_me && <button onClick={() => { onToggle?.(u.emoji); onClose(); }} className="text-[11px] text-primary" data-testid="reactor-remove-mine">Quitar reacción</button>}
                      </div>
                      <span className="text-xl">{u.emoji}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ReactorsSheet;
