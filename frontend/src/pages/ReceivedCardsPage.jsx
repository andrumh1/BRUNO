import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { downloadVCard } from "@/pages/TransferReceivePage";
import { ArrowLeft, Contact, Loader2, Nfc, Send, Trash2, Wallet } from "lucide-react";
import ShareCardToChatSheet from "@/components/chat/ShareCardToChatSheet";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** /wallet — cards other people transferred to me (NFC / QR / link) */
export default function ReceivedCardsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [cards, setCards] = useState(null);
  const [shareCard, setShareCard] = useState(null);

  useEffect(() => {
    axios.get(`${API}/transfer/received/mine`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setCards(r.data)).catch(() => setCards([]));
  }, [token]);

  const remove = async (id) => {
    try { await axios.delete(`${API}/transfer/received/${id}`, { headers: { Authorization: `Bearer ${token}` } }); setCards((p) => p.filter((c) => c.id !== id)); brunoToast.success("Tarjeta quitada"); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-background pb-28" data-testid="received-cards-page">
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 h-14 bg-background/80 backdrop-blur border-b">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)} data-testid="wallet-back-btn"><ArrowLeft className="w-5 h-5" /></Button>
        <h1 className="font-bold flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Tarjetas recibidas</h1>
      </div>
      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {cards === null ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> :
          cards.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3"><Nfc className="w-7 h-7 text-primary" /></div>
              <p className="font-semibold">Aún no has recibido tarjetas</p>
              <p className="text-sm text-muted-foreground mt-1">Cuando alguien acerque su teléfono al tuyo o escanees su QR, la tarjeta aparecerá aquí.</p>
            </div>
          ) : cards.map((c, i) => {
            const color = c.background_color || "#FF6B35";
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border bg-card overflow-hidden flex" data-testid={`received-card-${c.id}`}>
                <div className="w-2" style={{ background: color }} />
                <button className="flex-1 flex items-center gap-3 p-3 text-left" onClick={() => navigate(`/c/${c.id}`)}>
                  {c.avatar_url ? <img src={c.avatar_url} alt={c.title} className="w-12 h-12 rounded-xl object-cover" /> : <div className="w-12 h-12 rounded-xl text-white font-black flex items-center justify-center" style={{ background: color }}>{(c.title || "?")[0]}</div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.subtitle || c.card_type}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">De {c.sender?.name} · {new Date(c.received_at).toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}{c.via?.startsWith("nfc") ? " · NFC" : ""}</p>
                  </div>
                </button>
                <div className="flex flex-col justify-center pr-2 gap-0.5">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-primary" onClick={() => setShareCard(c)} aria-label="Reenviar a un chat" data-testid={`received-share-${c.id}`}><Send className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => downloadVCard(c)} aria-label="Añadir a contactos" data-testid={`received-vcard-${c.id}`}><Contact className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500" onClick={() => remove(c.id)} aria-label="Quitar" data-testid={`received-remove-${c.id}`}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </motion.div>
            );
          })}
      </div>
      <ShareCardToChatSheet card={shareCard} isOpen={!!shareCard} onClose={() => setShareCard(null)} token={token} />
    </div>
  );
}
