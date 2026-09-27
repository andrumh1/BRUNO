import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, Sparkles, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const SNOOZE_MS = 24 * 3600 * 1000;
const SHOW_ON = ["/reels", "/my-profile", "/feed", "/map"];

/** Gentle reminder for new users who finished the tour but have no card yet (max once a day). */
export default function CardReminderBanner() {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user || !token) return undefined;
    const tourDone = localStorage.getItem(`bruno_tour_completed_${user.id}`);
    const snoozed = Number(localStorage.getItem(`bruno_card_reminder_${user.id}`) || 0);
    const ageDays = user.created_at ? (Date.now() - new Date(user.created_at)) / 86400000 : 99;
    if (!tourDone || Date.now() - snoozed < SNOOZE_MS || ageDays > 14) return undefined;
    if (!SHOW_ON.some((p) => location.pathname.startsWith(p))) return undefined;
    if (document.querySelector("[data-testid='tour-overlay']")) return undefined;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } });
        if (alive && Array.isArray(r.data) && r.data.length === 0) setShow(true);
      } catch { /* ignore */ }
    }, 2500);
    return () => { alive = false; clearTimeout(t); };
  }, [user, token, location.pathname]);

  const dismiss = () => { localStorage.setItem(`bruno_card_reminder_${user.id}`, String(Date.now())); setShow(false); };
  const go = () => { dismiss(); navigate("/cards/new"); };

  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: -80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -80, opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="fixed inset-x-3 z-[10400] no-glass" style={{ top: "calc(env(safe-area-inset-top, 0px) + 10px)" }} data-testid="card-reminder-banner">
          <div className="max-w-md mx-auto rounded-2xl shadow-2xl border border-primary/20 p-3 flex items-center gap-3" style={{ background: "hsl(var(--card))" }}>
            <motion.div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-orange-400 text-white flex items-center justify-center shrink-0" animate={{ rotate: [0, -6, 6, 0] }} transition={{ repeat: Infinity, repeatDelay: 2.5, duration: 0.8 }}>
              <CreditCard className="w-5 h-5" />
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">¿Creamos tu primera tarjeta?</p>
              <p className="text-[11px] text-muted-foreground">Toma menos de 2 minutos y ya podrás compartirla con un toque.</p>
            </div>
            <button onClick={go} className="h-9 px-3 rounded-full bg-primary text-white text-xs font-semibold flex items-center gap-1 active:scale-95 transition-transform shrink-0" data-testid="card-reminder-cta"><Sparkles className="w-3.5 h-3.5" /> Crear</button>
            <button onClick={dismiss} className="p-1.5 rounded-full text-muted-foreground hover:bg-muted shrink-0" aria-label="Más tarde" data-testid="card-reminder-dismiss"><X className="w-4 h-4" /></button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
