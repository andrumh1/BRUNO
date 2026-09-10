/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { X, Send, Loader2, Link2, MessageSquare, Share2, Clock, Play, User } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { normalizeReel } from "./useReelsFeed";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export function BottomSheet({ open, onClose, title, children, testid, height = "62vh" }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10400] bg-black/30 backdrop-blur-[4px]" onClick={onClose} data-testid={`${testid}-backdrop`}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="bruno-glass absolute inset-x-0 bottom-0 rounded-t-[28px] border flex flex-col overflow-hidden"
            style={{ height, paddingBottom: "env(safe-area-inset-bottom, 0px)", maxWidth: 560, marginInline: "auto" }}
            onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
            data-testid={testid}
          >
            <div className="flex justify-center pt-2"><div className="h-1 w-9 rounded-full bg-foreground/20" /></div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="w-8" />
              <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-foreground/[0.06] grid place-items-center" data-testid={`${testid}-close`}><X className="w-4 h-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ReelCommentsSheet({ reel, token, onClose, onPosted }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!reel) return;
    setLoading(true);
    axios.get(`${API}/posts/${reel.id}/comments`, { headers }).then((r) => setComments(r.data || [])).catch(() => setComments([])).finally(() => setLoading(false));
  }, [reel?.id]);

  const send = async () => {
    if (!text.trim() || !token) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/posts/${reel.id}/comments`, { content: text.trim() }, { headers });
      setComments((p) => [{ ...r.data, user: r.data.user || { username: "Tú" } }, ...p]);
      setText(""); onPosted?.(reel.id);
    } catch (_) { brunoToast.error("No se pudo comentar"); }
    setSending(false);
  };

  return (
    <BottomSheet open={!!reel} onClose={onClose} title={`${comments.length} comentarios`} testid="reel-comments-sheet">
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
        {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          : comments.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">Sé el primero en comentar</p>
          : comments.map((c) => (
            <div key={c.id} className="flex gap-2.5" data-testid={`reel-comment-${c.id}`}>
              <div className="w-8 h-8 rounded-full bg-foreground/10 overflow-hidden shrink-0 grid place-items-center">
                {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-foreground/60" />}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground/80">{c.user?.display_name || c.user?.username || "Usuario"}</p>
                <p className="text-sm leading-snug break-words">{c.content}</p>
              </div>
            </div>
          ))}
      </div>
      <div className="px-3 py-2 border-t border-foreground/10 flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={token ? "Añade un comentario…" : "Inicia sesión para comentar"} disabled={!token}
          className="flex-1 h-10 rounded-full px-4 text-sm bg-foreground/[0.06] outline-none focus:ring-2 ring-primary/40" data-testid="reel-comment-input" />
        <button onClick={send} disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-primary text-white grid place-items-center disabled:opacity-40" data-testid="reel-comment-send">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </BottomSheet>
  );
}

export function ReelShareSheet({ reel, onClose }) {
  if (!reel) return null;
  const url = `${process.env.REACT_APP_BACKEND_URL}/api/share/p/${reel.id}`;
  const appUrl = `${window.location.origin}/reels?id=${reel.id}`;
  const copy = async () => { try { await navigator.clipboard.writeText(appUrl); brunoToast.success("Link copiado"); } catch (_) { brunoToast.error("No se pudo copiar"); } onClose(); };
  const native = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Reel en BRUNO", text: reel.content || "", url }); } catch (_) { /* cancelled */ } }
    else copy();
    onClose();
  };
  const opts = [
    { id: "native", label: "Compartir…", Icon: Share2, run: native },
    { id: "copy", label: "Copiar link", Icon: Link2, run: copy },
    { id: "wa", label: "WhatsApp", Icon: MessageSquare, run: () => { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank"); onClose(); } },
  ];
  return (
    <BottomSheet open onClose={onClose} title="Enviar a" testid="reel-share-sheet" height="auto">
      <div className="grid grid-cols-3 gap-3 px-5 pb-6 pt-2">
        {opts.map((o) => (
          <button key={o.id} onClick={o.run} className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-foreground/[0.05] active:scale-95 transition-transform" data-testid={`reel-share-${o.id}`}>
            <div className="w-11 h-11 rounded-full bg-foreground/[0.08] grid place-items-center"><o.Icon className="w-5 h-5" /></div>
            <span className="text-[11px] font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export function ReelHistorySheet({ open, token, onClose, onPick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    axios.get(`${API}/posts/history/videos`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setItems((r.data || []).map(normalizeReel))).catch(() => setItems([])).finally(() => setLoading(false));
  }, [open, token]);
  return (
    <BottomSheet open={open} onClose={onClose} title="Historial de reels" testid="reel-history-sheet" height="72vh">
      {!token ? <p className="text-center text-sm text-muted-foreground py-10">Inicia sesión para ver tu historial</p>
        : loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground"><Clock className="w-8 h-8 mb-2" /><p className="text-sm">Aún no has visto reels</p></div>
        : (
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4 overflow-y-auto">
            {items.map((r) => (
              <button key={r.id} onClick={() => onPick(r)} className="relative aspect-[9/14] rounded-xl overflow-hidden bg-black no-glass" data-testid={`reel-history-item-${r.id}`}>
                {(r.poster_url || r.thumbnail_url || r.image_url) ? <img src={r.poster_url || r.thumbnail_url || r.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Play className="w-6 h-6 text-white/70" /></div>}
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent text-left">
                  <p className="text-white text-[10px] font-semibold truncate">@{r.author?.username || r.author?.name}</p>
                  <p className="text-white/70 text-[9px]">{r.watch_count > 1 ? `Visto ${r.watch_count}×` : "Visto"}</p>
                </div>
              </button>
            ))}
          </div>
        )}
    </BottomSheet>
  );
}
