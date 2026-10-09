/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useBrunoCheckout } from "@/hooks/useBrunoCheckout";
import { QuoteCard } from "@/components/money/QuoteCard";
const PAID_USD = { rose: 99, heart: 299, star: 499, diamond: 1999, rocket: 4999, crown: 9999 };
import { Heart, Send, Gift, Eye, X, Loader2 } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const GIFTS = [
  { id: "rose", emoji: "🌹", label: "Rosa", value: 1 },
  { id: "heart", emoji: "💖", label: "Corazón", value: 5 },
  { id: "star", emoji: "⭐", label: "Estrella", value: 10 },
  { id: "diamond", emoji: "💎", label: "Diamante", value: 50 },
  { id: "rocket", emoji: "🚀", label: "Cohete", value: 100 },
  { id: "crown", emoji: "👑", label: "Corona", value: 500 },
];
const giftEmoji = (t) => GIFTS.find((g) => g.id === t)?.emoji || "🎁";

/** Realtime chat column + floating hearts + input row (viewer or host). */
export function LiveEvents({ events, hearts }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [events.length]);
  return (
    <>
      <div className="pointer-events-none absolute right-6 bottom-32 w-16 h-72 z-20">
        {hearts.map((h) => (
          <Heart key={h.id} className="live-heart absolute bottom-0 left-4 w-7 h-7 text-red-500 fill-red-500" style={{ "--dx": `${h.dx}px` }} />
        ))}
      </div>
      <div ref={ref} className="absolute left-3 right-20 z-20 max-h-56 overflow-y-auto scrollbar-none space-y-1.5 pointer-events-none" style={{ bottom: "calc(var(--safe-bottom) + 76px)", maskImage: "linear-gradient(to bottom, transparent, black 18%)" }} data-testid="live-events">
        {events.map((e) => (
          <div key={e.id} className="inline-flex max-w-full items-start gap-2 rounded-2xl bg-black/35 backdrop-blur-sm px-3 py-1.5 text-white text-[12px]">
            {e.kind === "join" && <span className="text-white/70">{e.user_name || "Alguien"} se unió 👋</span>}
            {e.kind === "gift" && <span><b className="text-amber-300">{e.user_name}</b> envió {giftEmoji(e.gift_type)} ×{e.amount}</span>}
            {e.kind === "comment" && <span className="break-words"><b className="text-white/80 mr-1">{e.user_name}</b>{e.text}</span>}
          </div>
        ))}
      </div>
    </>
  );
}

export function LiveInputRow({ liveId, token, allowGifts, allowComments = true, onHeart, isHost }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try { await axios.post(`${API}/lives/${liveId}/comment`, { text: text.trim() }, { headers }); setText(""); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo enviar"); }
    setSending(false);
  };
  const [payMode, setPayMode] = useState("points");
  const [pendingGift, setPendingGift] = useState(null);
  const checkout = useBrunoCheckout();
  const pickPaid = async (g) => { setPendingGift(g.id); await checkout.getQuote({ kind: "gift", ref_id: liveId, option: g.id }); };
  const sendGift = async (g) => {
    try { await axios.post(`${API}/lives/${liveId}/gift`, { gift_type: g.id, amount: 1 }, { headers }); setGiftsOpen(false); brunoToast.success(`Enviaste ${g.emoji} ${g.label}`); }
    catch (e) { brunoToast.error(e?.response?.data?.detail === "Insufficient points" ? "No tienes puntos suficientes" : "No se pudo enviar el regalo"); }
  };

  return (
    <div className="absolute inset-x-0 z-30 px-3" style={{ bottom: "calc(var(--safe-bottom) + 14px)" }}>
      {giftsOpen && (<>
        <div className="bruno-glass rounded-[22px] border px-2 py-1.5 mb-1 flex items-center gap-1" data-testid="live-gifts-note">
          <button onClick={() => setPayMode("points")} className={`flex-1 h-7 rounded-full text-[10px] font-semibold ${payMode === "points" ? "bg-primary text-white" : "text-muted-foreground"}`} data-testid="live-gift-mode-points">Puntos BRUNO</button>
          <button onClick={() => setPayMode("card")} className={`flex-1 h-7 rounded-full text-[10px] font-semibold ${payMode === "card" ? "bg-primary text-white" : "text-muted-foreground"}`} data-testid="live-gift-mode-card">Con tarjeta (USD) · 15 % BRUNO</button>
        </div>
        {payMode === "card" && checkout.quote && <div className="mb-2"><QuoteCard quote={checkout.quote} busy={checkout.busy} error={checkout.error} cta="Enviar regalo" onPay={() => checkout.pay({ kind: "gift", ref_id: liveId, option: pendingGift })} onCancel={() => setPendingGift(null)} /></div>}
        <div className="bruno-glass rounded-[22px] border p-3 mb-2 grid grid-cols-6 gap-1" data-testid="live-gifts-panel">
          {GIFTS.map((g) => (
            <button key={g.id} onClick={() => (payMode === "card" ? pickPaid(g) : sendGift(g))} className="flex flex-col items-center gap-0.5 rounded-xl py-1.5 hover:bg-foreground/[0.06] active:scale-95" data-testid={`live-gift-${g.id}`}>
              <span className="text-xl">{g.emoji}</span><span className="text-[9px] text-muted-foreground">{payMode === "card" ? `$${(PAID_USD[g.id] / 100).toFixed(2)}` : `${g.value} pts`}</span>
            </button>
          ))}
        </div>
      </>)}
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center bruno-glass rounded-full border h-11 px-4">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={allowComments === false && !isHost ? "Comentarios desactivados por el anfitrión" : "Di algo…"} disabled={allowComments === false && !isHost} className="flex-1 bg-transparent outline-none text-sm disabled:opacity-60" data-testid="live-comment-input" />
          <button onClick={send} disabled={sending || !text.trim()} className="text-primary disabled:opacity-40" data-testid="live-comment-send">{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</button>
        </div>
        {!isHost && allowGifts && (
          <button onClick={() => setGiftsOpen((v) => !v)} className="w-11 h-11 rounded-full bruno-glass border grid place-items-center" data-testid="live-gift-btn" aria-label="Regalos">{giftsOpen ? <X className="w-5 h-5" /> : <Gift className="w-5 h-5 text-amber-500" />}</button>
        )}
        <button onClick={onHeart} className="w-11 h-11 rounded-full bg-red-500 text-white grid place-items-center active:scale-90 transition-transform" data-testid="live-heart-btn" aria-label="Corazón"><Heart className="w-5 h-5 fill-white" /></button>
      </div>
    </div>
  );
}

export function LiveTopBar({ live, viewerCount, hostOnline, onClose, right }) {
  return (
    <div className="absolute inset-x-0 z-30 flex items-center gap-2 px-3" style={{ top: "calc(var(--safe-top) + 10px)" }}>
      <div className="flex items-center gap-2 bruno-glass rounded-full border pl-1 pr-3 h-10 min-w-0">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-foreground/10 shrink-0">{live?.host_avatar && <img src={live.host_avatar} alt="" className="w-full h-full object-cover" />}</div>
        <div className="min-w-0 leading-tight">
          <p className="text-[12px] font-semibold truncate">{live?.host_name || "Anfitrión"}</p>
          <p className="text-[10px] text-muted-foreground truncate">{live?.title}</p>
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 h-7 px-2 rounded-full text-white text-[10px] font-bold ${hostOnline ? "bg-red-500" : "bg-zinc-600"}`} data-testid="live-status-badge">
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> {hostOnline ? "EN VIVO" : "PAUSA"}
      </span>
      <span className="inline-flex items-center gap-1 h-7 px-2 rounded-full bg-black/45 text-white text-[10px]" data-testid="live-viewer-count"><Eye className="w-3 h-3" /> {viewerCount}</span>
      <div className="ml-auto flex items-center gap-2">{right}
        <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/45 text-white grid place-items-center" data-testid="live-close-btn" aria-label="Salir"><X className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
