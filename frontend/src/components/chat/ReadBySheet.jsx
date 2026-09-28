import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CheckCheck, Loader2, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Row = ({ u, seen }) => (
  <div className="flex items-center gap-3 px-2 py-2" data-testid={`readby-${seen ? "seen" : "pending"}-${u.id}`}>
    {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <span className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">{(u.name || "?")[0].toUpperCase()}</span>}
    <p className="flex-1 text-sm font-medium truncate">{u.name}</p>
    {seen ? <CheckCheck className="w-4 h-4 text-sky-500" /> : <Check className="w-4 h-4 text-muted-foreground/50" />}
  </div>
);

/** ReadBySheet — who has seen my message (groups) */
const ReadBySheet = ({ chatId, messageId, token, isOpen, onClose }) => {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!isOpen || !messageId) { setData(null); return; }
    axios.get(`${API}/chats/${chatId}/messages/${messageId}/read-by`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setData(r.data)).catch(() => setData({ seen: [], pending: [] }));
  }, [isOpen, messageId, chatId, token]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="readby-sheet">
          <motion.div className="w-full sm:max-w-sm bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden" style={{ maxHeight: "65vh" }}
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="font-bold text-sm">Visto por {data ? `${data.seen_count}/${data.total}` : ""}</h3>
              <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" data-testid="readby-close"><X className="w-4 h-4" /></button>
            </div>
            {!data ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
              <div className="overflow-y-auto px-3 pb-4" style={{ maxHeight: "50vh" }}>
                <p className="px-2 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400 flex items-center gap-1"><CheckCheck className="w-3 h-3" /> Leído · {data.seen.length}</p>
                {data.seen.length === 0 && <p className="px-2 pb-2 text-xs text-muted-foreground">Nadie lo ha leído todavía</p>}
                {data.seen.map((u) => <Row key={u.id} u={u} seen />)}
                {data.pending.length > 0 && <>
                  <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Check className="w-3 h-3" /> Entregado · {data.pending.length}</p>
                  {data.pending.map((u) => <Row key={u.id} u={u} seen={false} />)}
                </>}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ReadBySheet;
