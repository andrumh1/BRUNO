import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Check, Loader2, Search, Send, Users, X } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** ShareCardToChatSheet — pick one or more chats/groups and send a card as a 'card' message */
const ShareCardToChatSheet = ({ card, isOpen, onClose, token }) => {
  const [chats, setChats] = useState(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState([]);
  const [sending, setSending] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!isOpen) { setPicked([]); setQ(""); return; }
    axios.get(`${API}/chats`, { headers }).then((r) => setChats(r.data || [])).catch(() => setChats([]));
  }, [isOpen]); // eslint-disable-line

  const title = (c) => (c.is_group ? c.name || "Grupo" : c.other_participants?.[0]?.display_name || c.other_participants?.[0]?.username || "Chat");
  const list = (chats || []).filter((c) => title(c).toLowerCase().includes(q.toLowerCase()));

  const send = async () => {
    if (!picked.length || !card) return;
    setSending(true);
    const body = {
      content: `📇 Tarjeta compartida: ${card.title || "Tarjeta"}`,
      message_type: "card",
      attachments: [{ type: "card", card_id: card.id, card_title: card.title, card_subtitle: card.subtitle, card_type: card.card_type, primary_color: card.background_color, secondary_color: card.background_color }],
    };
    try {
      await Promise.all(picked.map((id) => axios.post(`${API}/chats/${id}/messages`, body, { headers })));
      brunoToast.success(`Tarjeta enviada a ${picked.length} chat${picked.length > 1 ? "s" : ""}`);
      onClose();
    } catch { brunoToast.error("No se pudo enviar"); } finally { setSending(false); }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="share-card-sheet">
          <motion.div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "80vh" }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <div><h3 className="font-bold">Reenviar tarjeta</h3><p className="text-xs text-muted-foreground truncate">{card?.title}</p></div>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted" data-testid="share-card-close"><X className="w-5 h-5" /></button>
            </div>
            <div className="relative mx-5 mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar chat o grupo..." className="pl-10 rounded-full" data-testid="share-card-search" />
            </div>
            <div className="flex-1 overflow-y-auto px-3 space-y-1">
              {chats === null ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> :
                list.length === 0 ? <p className="text-center text-sm text-muted-foreground py-8">Sin chats</p> :
                list.map((c) => {
                  const on = picked.includes(c.id);
                  const p = c.other_participants?.[0];
                  return (
                    <button key={c.id} onClick={() => setPicked((prev) => (on ? prev.filter((x) => x !== c.id) : [...prev, c.id]))} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${on ? "bg-primary/10" : "hover:bg-muted"}`} data-testid={`share-card-chat-${c.id}`}>
                      {c.is_group ? (c.avatar_url ? <img src={c.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-orange-400 text-white flex items-center justify-center"><Users className="w-4 h-4" /></span>)
                        : p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : <span className="w-10 h-10 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center">{title(c)[0]}</span>}
                      <span className="flex-1 min-w-0 text-sm font-medium truncate">{title(c)}{c.is_group && <span className="ml-1.5 text-[10px] text-muted-foreground font-normal">grupo</span>}</span>
                      <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? "bg-primary border-primary text-white" : "border-muted-foreground/40"}`}>{on && <Check className="w-3.5 h-3.5" />}</span>
                    </button>
                  );
                })}
            </div>
            <div className="p-4 border-t">
              <button onClick={send} disabled={!picked.length || sending} className="w-full h-11 rounded-full bg-primary text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50" data-testid="share-card-send-btn">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Enviar{picked.length ? ` (${picked.length})` : ""}</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ShareCardToChatSheet;
