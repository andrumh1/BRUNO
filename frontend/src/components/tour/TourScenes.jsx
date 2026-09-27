import React from "react";
import { motion } from "framer-motion";
import { Camera, Check, CreditCard, Globe, Instagram, Link2, Mail, Nfc, Palette, Phone, QrCode, User, Wifi } from "lucide-react";

const spring = { type: "spring", stiffness: 260, damping: 22 };
const loop = (delay = 0, duration = 3.2) => ({ repeat: Infinity, repeatDelay: 0.8, duration, delay, ease: "easeInOut" });

/* ── Scene 0: brand intro ─────────────────────────────────────── */
export const WelcomeScene = () => (
  <div className="relative h-40 flex items-center justify-center overflow-hidden">
    {[0, 1, 2].map((i) => (
      <motion.span key={i} className="absolute rounded-full border-2 border-primary/30" style={{ width: 90 + i * 60, height: 90 + i * 60 }}
        animate={{ scale: [0.9, 1.1, 0.9], opacity: [0.2, 0.6, 0.2] }} transition={{ repeat: Infinity, duration: 3, delay: i * 0.4 }} />
    ))}
    <motion.div className="relative w-28 h-[76px] rounded-2xl shadow-2xl bg-gradient-to-br from-primary to-orange-400 text-white p-3 flex flex-col justify-between"
      initial={{ rotateY: -30, y: 20, opacity: 0 }} animate={{ rotateY: 0, y: 0, opacity: 1 }} transition={spring}>
      <div className="flex justify-between items-start"><span className="text-[9px] font-black tracking-widest">BRUNO</span><Nfc className="w-3.5 h-3.5 opacity-80" /></div>
      <div><div className="h-1.5 w-14 rounded bg-white/80 mb-1" /><div className="h-1 w-9 rounded bg-white/50" /></div>
    </motion.div>
    <motion.img src="/mascots/bruno-dog.webp" alt="" className="absolute -bottom-1 right-6 w-16 h-16 object-contain drop-shadow-xl" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.3 }} />
  </div>
);

/* ── Scene 1: complete your profile ───────────────────────────── */
export const ProfileScene = () => (
  <div className="relative h-40 flex items-center justify-center gap-5">
    <div className="relative">
      <motion.div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center ring-4 ring-primary/20 overflow-hidden" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
        <User className="w-9 h-9 text-muted-foreground" />
      </motion.div>
      <motion.span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg" animate={{ scale: [1, 1.15, 1] }} transition={loop(0.4, 1.6)}>
        <Camera className="w-4 h-4" />
      </motion.span>
    </div>
    <div className="space-y-2 w-36">
      {[{ w: "80%", d: 0.2 }, { w: "60%", d: 0.5 }, { w: "70%", d: 0.8 }].map((l, i) => (
        <div key={i} className="h-7 rounded-lg bg-muted/70 px-2 flex items-center overflow-hidden">
          <motion.div className="h-2 rounded bg-primary/70" initial={{ width: 0 }} animate={{ width: l.w }} transition={{ delay: l.d, duration: 0.7, ease: "easeOut" }} />
        </div>
      ))}
      <motion.div className="h-7 rounded-lg bg-primary text-white text-[11px] font-semibold flex items-center justify-center gap-1" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}>
        <Check className="w-3.5 h-3.5" /> Guardar perfil
      </motion.div>
    </div>
  </div>
);

/* ── Scene 2: build the card ──────────────────────────────────── */
export const CardBuildScene = () => (
  <div className="relative h-40 flex items-center justify-center">
    <motion.div className="relative w-56 h-32 rounded-2xl bg-card border shadow-xl overflow-hidden" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={spring}>
      <motion.div className="h-11 bg-gradient-to-r from-primary to-orange-400" initial={{ x: "-100%" }} animate={{ x: 0 }} transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }} />
      <motion.div className="absolute left-4 top-6 w-11 h-11 rounded-full bg-background ring-2 ring-card flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 0.7 }}>
        <User className="w-5 h-5 text-primary" />
      </motion.div>
      <div className="absolute left-17 top-13 pl-16 pt-1 space-y-1.5">
        <motion.div className="h-2.5 rounded bg-foreground/80" initial={{ width: 0 }} animate={{ width: 90 }} transition={{ delay: 1.0, duration: 0.5 }} />
        <motion.div className="h-2 rounded bg-muted-foreground/60" initial={{ width: 0 }} animate={{ width: 60 }} transition={{ delay: 1.3, duration: 0.5 }} />
      </div>
      <div className="absolute left-4 bottom-3 flex gap-2">
        {[Phone, Mail, Globe].map((I, i) => (
          <motion.span key={i} className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring, delay: 1.6 + i * 0.15 }}><I className="w-3.5 h-3.5" /></motion.span>
        ))}
      </div>
      <motion.span className="absolute right-3 bottom-3 text-[9px] font-black tracking-widest text-primary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>BRUNO</motion.span>
    </motion.div>
    <motion.div className="absolute -right-1 top-2 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg" animate={{ y: [0, -6, 0] }} transition={loop(0, 2)}><CreditCard className="w-4 h-4" /></motion.div>
  </div>
);

/* ── Scene 3: customize ───────────────────────────────────────── */
const SWATCHES = ["#FF6B35", "#0EA5E9", "#8B5CF6", "#10B981", "#111827"];
export const CustomizeScene = () => (
  <div className="relative h-40 flex flex-col items-center justify-center gap-4">
    <motion.div className="w-52 h-20 rounded-2xl shadow-xl p-3 text-white flex flex-col justify-between" animate={{ background: SWATCHES.map((c) => `linear-gradient(135deg, ${c}, ${c}99)`) }} transition={{ repeat: Infinity, duration: 7.5, ease: "easeInOut" }}>
      <div className="flex justify-between"><div className="h-2 w-16 rounded bg-white/80" /><Palette className="w-3.5 h-3.5 opacity-80" /></div>
      <div className="flex gap-1.5">{[Instagram, Link2, Mail].map((I, i) => <span key={i} className="w-5 h-5 rounded-full bg-white/25 flex items-center justify-center"><I className="w-3 h-3" /></span>)}</div>
    </motion.div>
    <div className="flex gap-2.5">
      {SWATCHES.map((c, i) => (
        <motion.span key={c} className="w-7 h-7 rounded-full ring-2 ring-offset-2 ring-offset-card" style={{ background: c }} animate={{ scale: [1, 1, 1.25, 1, 1], boxShadow: ["0 0 0 0 rgba(0,0,0,0)", "0 0 0 0 rgba(0,0,0,0)", `0 0 0 3px ${c}66`, "0 0 0 0 rgba(0,0,0,0)", "0 0 0 0 rgba(0,0,0,0)"] }}
          transition={{ repeat: Infinity, duration: 7.5, times: [0, i / 5, i / 5 + 0.08, i / 5 + 0.16, 1], ease: "easeInOut" }} />
      ))}
    </div>
  </div>
);

/* ── Scene 4: share by tap (NFC) / QR — Android ↔ iPhone ───────── */
const PhoneShape = ({ label, children, className = "" }) => (
  <div className={`relative w-16 h-28 rounded-[18px] border-[3px] border-foreground/80 bg-background flex flex-col items-center justify-center ${className}`}>
    <span className="absolute top-1.5 w-6 h-1 rounded-full bg-foreground/60" />
    {children}
    <span className="absolute -bottom-6 text-[10px] font-semibold text-muted-foreground">{label}</span>
  </div>
);
export const ShareScene = () => (
  <div className="relative h-44 flex items-center justify-center gap-2 pb-4">
    <motion.div animate={{ x: [0, 14, 14, 0] }} transition={loop(0, 3)}>
      <PhoneShape label="Android">
        <motion.div className="w-9 h-6 rounded-md bg-gradient-to-br from-primary to-orange-400" animate={{ opacity: [1, 1, 0.2, 1] }} transition={loop(0, 3)} />
      </PhoneShape>
    </motion.div>
    <motion.div className="relative flex flex-col items-center gap-1" animate={{ scale: [1, 1.2, 1] }} transition={loop(0.9, 1.4)}>
      <Wifi className="w-6 h-6 text-primary rotate-90" />
      <span className="text-[9px] font-bold text-primary">NFC</span>
    </motion.div>
    <motion.div animate={{ x: [0, -14, -14, 0] }} transition={loop(0, 3)}>
      <PhoneShape label="iPhone">
        <motion.div className="w-9 h-6 rounded-md bg-gradient-to-br from-primary to-orange-400" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 0, 1, 1], scale: [0.4, 0.4, 1, 1] }} transition={loop(0, 3)} />
      </PhoneShape>
    </motion.div>
    <motion.div className="absolute right-3 top-0 w-10 h-10 rounded-xl bg-card border shadow-lg flex items-center justify-center" animate={{ y: [0, -4, 0] }} transition={loop(0.5, 2.4)}><QrCode className="w-5 h-5 text-foreground" /></motion.div>
  </div>
);

/* ── Scene 5: done ────────────────────────────────────────────── */
export const DoneScene = () => (
  <div className="relative h-36 flex items-center justify-center">
    <motion.div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-600 text-white flex items-center justify-center shadow-2xl" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring}>
      <Check className="w-10 h-10" strokeWidth={3} />
    </motion.div>
    {[...Array(8)].map((_, i) => (
      <motion.span key={i} className="absolute w-2 h-2 rounded-full" style={{ background: SWATCHES[i % SWATCHES.length] }}
        initial={{ x: 0, y: 0, opacity: 0 }} animate={{ x: Math.cos((i / 8) * Math.PI * 2) * 70, y: Math.sin((i / 8) * Math.PI * 2) * 60, opacity: [0, 1, 0] }} transition={{ delay: 0.3, duration: 1.2, repeat: Infinity, repeatDelay: 1.5 }} />
    ))}
  </div>
);

export const SCENES = { welcome: WelcomeScene, profile: ProfileScene, card: CardBuildScene, customize: CustomizeScene, share: ShareScene, done: DoneScene };
