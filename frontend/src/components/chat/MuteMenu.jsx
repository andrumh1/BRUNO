import React, { useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const OPTIONS = [
  { id: "1h", label: "1 hora" },
  { id: "8h", label: "8 horas" },
  { id: "1w", label: "1 semana" },
  { id: "forever", label: "Siempre" },
];

export const formatMutedUntil = (iso) => {
  if (!iso) return "Silenciado";
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Silenciado hasta las ${time}`;
  return `Silenciado hasta el ${d.toLocaleDateString("es-ES", { weekday: "short", day: "2-digit", month: "short" })} ${time}`;
};

/** MuteMenu — bell button + popover with 1h / 8h / 1w / forever, auto-unmutes when expired */
const MuteMenu = ({ chatId, token, muted, mutedUntil, onChange }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const apply = async (duration) => {
    setBusy(duration);
    try {
      const r = await axios.post(`${API}/chats/${chatId}/mute`, { duration }, { headers: { Authorization: `Bearer ${token}` } });
      onChange?.(r.data);
      if (r.data.muted) {
        brunoToast.success(duration === "forever" ? "Chat silenciado" : formatMutedUntil(r.data.muted_until), { description: "Sin avisos ni llamadas de este chat. Se reactiva solo." });
      } else brunoToast.success("Chat con sonido");
      setOpen(false);
    } catch (_) { brunoToast.error("No se pudo cambiar"); } finally { setBusy(null); }
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" className={`rounded-full h-9 w-9 ${muted ? "text-amber-500 bg-amber-500/10" : "hover:bg-muted"}`} onClick={() => setOpen((o) => !o)} aria-label={muted ? "Opciones de silencio" : "Silenciar chat"} data-testid="chat-mute-btn">
        {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
      </Button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[10590]" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.16 }}
              className="no-glass absolute right-0 top-11 z-[10600] w-60 rounded-2xl border shadow-2xl p-1.5" style={{ background: "hsl(var(--card))" }} data-testid="mute-menu">
              <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{muted ? formatMutedUntil(mutedUntil) : "Silenciar por"}</p>
              {OPTIONS.map((o) => (
                <button key={o.id} onClick={() => apply(o.id)} disabled={!!busy} className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm hover:bg-muted text-left" data-testid={`mute-option-${o.id}`}>
                  {o.label}
                  {busy === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (muted && ((o.id === "forever" && !mutedUntil) ) ? <Check className="w-4 h-4 text-primary" /> : null)}
                </button>
              ))}
              {muted && (
                <button onClick={() => apply("unmute")} disabled={!!busy} className="w-full mt-1 border-t px-3 py-2.5 rounded-b-xl text-sm text-primary font-medium hover:bg-muted text-left flex items-center gap-2" data-testid="mute-option-unmute">
                  <Bell className="w-4 h-4" /> Activar sonido
                </button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MuteMenu;
