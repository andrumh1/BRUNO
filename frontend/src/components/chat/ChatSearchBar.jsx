import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Loader2, Search, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const fmt = (iso) => {
  const d = new Date(iso);
  const today = d.toDateString() === new Date().toDateString();
  return today ? d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
};

/** ChatSearchBar — search words inside the conversation and jump to the message */
const ChatSearchBar = ({ chatId, token, isOpen, onClose, onJump }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => { if (isOpen) { setTimeout(() => inputRef.current?.focus(), 80); } else { setQ(""); setResults([]); setTotal(0); } }, [isOpen]);

  useEffect(() => {
    if (!isOpen || q.trim().length < 2) { setResults([]); setTotal(0); return undefined; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await axios.get(`${API}/chats/${chatId}/messages/search`, { params: { q: q.trim(), limit: 30 }, headers: { Authorization: `Bearer ${token}` } });
        setResults(r.data.results || []); setTotal(r.data.total || 0); setIdx(0); setShowList(true);
      } catch { setResults([]); } finally { setLoading(false); }
    }, 280);
    return () => clearTimeout(t);
  }, [q, chatId, token, isOpen]);

  const go = (i) => { if (!results[i]) return; setIdx(i); setShowList(false); onJump(results[i]); };
  const highlight = (text) => {
    const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark className="bg-primary/25 text-inherit rounded px-0.5">{text.slice(i, i + q.trim().length)}</mark>{text.slice(i + q.trim().length)}</>;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden border-b bg-background/95 backdrop-blur-xl" data-testid="chat-search-bar">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setShowList(true)} placeholder="Buscar en la conversación…"
                className="w-full h-10 pl-9 pr-9 rounded-full bg-muted/60 text-sm outline-none focus:ring-2 focus:ring-primary/40" data-testid="chat-msg-search-input"
                onKeyDown={(e) => { if (e.key === "Enter") go(idx); if (e.key === "Escape") onClose(); }} />
              {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
            {results.length > 0 && (
              <div className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0" data-testid="chat-search-counter">
                <span className="tabular-nums">{idx + 1}/{total}</span>
                <button className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40" disabled={idx >= results.length - 1} onClick={() => go(idx + 1)} aria-label="Anterior (más antiguo)" data-testid="chat-search-prev"><ChevronUp className="w-4 h-4" /></button>
                <button className="p-1.5 rounded-full hover:bg-muted disabled:opacity-40" disabled={idx <= 0} onClick={() => go(idx - 1)} aria-label="Siguiente (más reciente)" data-testid="chat-search-next"><ChevronDown className="w-4 h-4" /></button>
              </div>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-muted shrink-0" aria-label="Cerrar búsqueda" data-testid="chat-search-close"><X className="w-4 h-4" /></button>
          </div>
          {showList && q.trim().length >= 2 && !loading && (
            <div className="max-h-56 overflow-y-auto px-2 pb-2" data-testid="chat-search-results">
              {results.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-3">Sin resultados para “{q}”</p>
              ) : results.map((r, i) => (
                <button key={r.id} onClick={() => go(i)} className={`w-full text-left px-3 py-2 rounded-xl hover:bg-muted flex items-start gap-2 ${i === idx ? "bg-primary/5" : ""}`} data-testid={`chat-search-result-${r.id}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-primary truncate">{r.sender?.name}</p>
                    <p className="text-xs truncate">{highlight(r.snippet || "")}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">{fmt(r.created_at)}</span>
                </button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ChatSearchBar;
