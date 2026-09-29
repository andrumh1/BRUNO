import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { Check, Contact, ExternalLink, Globe, Loader2, Mail, Nfc, Phone, Wallet } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export const downloadVCard = (card) => {
  const ci = card.contact_info || {};
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${card.title || ""}`, card.subtitle ? `TITLE:${card.subtitle}` : null,
    ci.phone ? `TEL;TYPE=CELL:${ci.phone}` : null, ci.email ? `EMAIL:${ci.email}` : null,
    (card.social_links || []).find((s) => /web|site|www/i.test(s.type || s.label || ""))?.url ? `URL:${(card.social_links || []).find((s) => /web|site|www/i.test(s.type || s.label || "")).url}` : null,
    ci.address || ci.city ? `ADR;TYPE=WORK:;;${ci.address || ""};${ci.city || ""};;;${ci.country || ""}` : null,
    `NOTE:Tarjeta BRUNO ${window.location.origin}/c/${card.id}`, "END:VCARD"].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${(card.title || "contacto").replace(/[^\w\s-]/g, "")}.vcf`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/** Receiver side: /t/:token — save the card into my BRUNO (or to phone contacts) */
export default function TransferReceivePage() {
  const { token: transferToken } = useParams();
  const navigate = useNavigate();
  const { user, token, isLoading } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await axios.get(`${API}/transfer/${transferToken}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined);
        setData(r.data); setSaved(!!r.data.already_saved);
      } catch (e) { setError(e?.response?.data?.detail || "Transferencia no encontrada"); }
    })();
  }, [transferToken, token]);

  const save = async () => {
    if (!user) { navigate(`/login?next=${encodeURIComponent(`/t/${transferToken}`)}`); return; }
    setSaving(true);
    try {
      await axios.post(`${API}/transfer/${transferToken}/accept?via=${/android/i.test(navigator.userAgent) ? "nfc-android" : /iphone|ipad/i.test(navigator.userAgent) ? "nfc-iphone" : "link"}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSaved(true);
      if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
      brunoToast.success("Tarjeta guardada en tu BRUNO", { description: "La encuentras en Perfil → Recibidas" });
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar"); } finally { setSaving(false); }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" data-testid="transfer-receive-error">
        <div><Nfc className="w-12 h-12 mx-auto text-muted-foreground mb-3" /><h2 className="font-bold text-lg mb-1">Transferencia no disponible</h2><p className="text-sm text-muted-foreground mb-5">{error}</p><Link to="/"><Button className="rounded-full">Ir a BRUNO</Button></Link></div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const { card, sender, expired } = data;
  const color = card.background_color || "#FF6A00";
  const ci = card.contact_info || {};

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="transfer-receive-page">
      <div className="h-56 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}>
        {[0, 1, 2].map((i) => <motion.span key={i} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30" style={{ width: 140 + i * 110, height: 140 + i * 110 }} animate={{ scale: [0.9, 1.1], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: 2.6, delay: i * 0.4 }} />)}
        <div className="absolute inset-x-0 top-6 text-center text-white">
          <p className="text-xs font-semibold uppercase tracking-widest opacity-90 flex items-center justify-center gap-1.5"><Nfc className="w-4 h-4" /> Tarjeta recibida</p>
          <p className="text-sm mt-1 opacity-90">{sender?.name} te comparte su tarjeta</p>
        </div>
      </div>

      <motion.div className="max-w-md mx-auto -mt-24 px-4" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 220, damping: 22 }}>
        <div className="rounded-3xl bg-card border shadow-2xl overflow-hidden" data-testid="transfer-card-preview">
          <div className="p-5 flex items-center gap-4">
            {card.avatar_url ? <img src={card.avatar_url} alt={card.title} className="w-16 h-16 rounded-2xl object-cover ring-4" style={{ "--tw-ring-color": `${color}33` }} /> :
              <div className="w-16 h-16 rounded-2xl text-white text-2xl font-black flex items-center justify-center" style={{ background: color }}>{(card.title || "?")[0]}</div>}
            <div className="min-w-0"><h1 className="font-bold text-lg leading-tight truncate">{card.title}</h1>{card.subtitle && <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>}<span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full text-white" style={{ background: color }}>{card.card_type}</span></div>
          </div>
          {(ci.phone || ci.email || ci.city) && (
            <div className="px-5 pb-4 space-y-1.5 text-sm text-muted-foreground">
              {ci.phone && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {ci.phone}</p>}
              {ci.email && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {ci.email}</p>}
              {ci.city && <p className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /> {ci.city}{ci.country ? `, ${ci.country}` : ""}</p>}
            </div>
          )}
          <div className="p-4 border-t space-y-2">
            {expired && !saved ? (
              <p className="text-center text-sm text-red-500 font-medium" data-testid="transfer-expired">Esta transferencia expiró. Pide que la vuelvan a compartir.</p>
            ) : saved ? (
              <div className="flex items-center justify-center gap-2 h-11 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-sm" data-testid="transfer-saved-badge"><Check className="w-4 h-4" /> Guardada en tu BRUNO</div>
            ) : (
              <Button className="w-full h-11 rounded-full" onClick={save} disabled={saving || isLoading} data-testid="transfer-save-btn">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Wallet className="w-4 h-4 mr-2" /> {user ? "Guardar en mi BRUNO" : "Entrar y guardar en mi BRUNO"}</>}
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => downloadVCard(card)} data-testid="transfer-vcard-btn"><Contact className="w-4 h-4 mr-2" /> Añadir a contactos</Button>
              <Button variant="outline" className="flex-1 rounded-full" onClick={() => navigate(`/c/${card.id}`)} data-testid="transfer-open-card-btn"><ExternalLink className="w-4 h-4 mr-2" /> Ver tarjeta</Button>
            </div>
          </div>
        </div>
        {saved && <Button variant="ghost" className="w-full mt-3 rounded-full text-primary" onClick={() => navigate("/wallet")} data-testid="transfer-go-wallet">Ver mis tarjetas recibidas</Button>}
        {!user && <p className="text-center text-[11px] text-muted-foreground mt-4">Funciona igual en Android e iPhone. “Añadir a contactos” no necesita cuenta.</p>}
      </motion.div>
    </div>
  );
}
