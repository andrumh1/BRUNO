/**
 * BrunoPublishMenu — bottom-sheet selector for the "+" / publish flow.
 *
 *  Step 1: Pick TYPE     (Story · Reel · Post · Estado)
 *  Step 2: Pick SOURCE   (Cámara en vivo · Galería del dispositivo · Carpeta privada)
 *
 *  When user picks, the menu fires onPick({ type, source, file? }).
 *  The parent decides how to handle each combination
 *  (e.g. open BrunoQuickCamera, open file picker, or open the private gallery).
 */
import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Camera, Image as ImageIcon, FolderLock, Sparkles,
  MessageSquare, Clapperboard, Lock, ChevronLeft,
} from "lucide-react";

const TYPES = [
  { id: "story",  label: "Historia",    hint: "Visible 24h",              Icon: Sparkles },
  { id: "reel",   label: "Reel",        hint: "Video corto",              Icon: Clapperboard },
  { id: "post",   label: "Publicación", hint: "Aparece en el muro",       Icon: MessageSquare },
  { id: "status", label: "Estado",      hint: "Estado rápido",            Icon: Lock },
];

const SOURCES = [
  { id: "camera",  label: "Cámara Bruno",     hint: "Foto o video en vivo", Icon: Camera },
  { id: "gallery", label: "Galería",          hint: "Elegir del dispositivo", Icon: ImageIcon },
  { id: "private", label: "Carpeta privada",  hint: "Solo tú la ves",       Icon: FolderLock },
];

export default function BrunoPublishMenu({ open, onClose, onPick }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState(null);
  const fileInputRef = useRef(null);

  const pickedFileRef = useRef(null);

  // Reset state whenever the sheet is reopened
  React.useEffect(() => {
    if (open) {
      setStep(1);
      setType(null);
    }
  }, [open]);

  const handleTypeSelect = (t) => {
    setType(t);
    // Fast-path: post and status don't need a media source picker
    if (t.id === "post" || t.id === "status") {
      onPick?.({ type: t.id });
      onClose?.();
      return;
    }
    setStep(2);
  };

  const handleSourceSelect = (s) => {
    if (!type) return;
    if (s.id === "gallery") {
      // Trigger native file picker; result fires onPick with the file attached.
      const accept = type.id === "reel" ? "video/*"
        : type.id === "story" ? "image/*,video/*"
        : "image/*,video/*";
      if (fileInputRef.current) {
        fileInputRef.current.accept = accept;
        fileInputRef.current.click();
      }
      return;
    }
    onPick?.({ type: type.id, source: s.id });
    onClose?.();
  };

  const handleFileChosen = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    pickedFileRef.current = file;
    onPick?.({ type: type.id, source: "gallery", file });
    e.target.value = "";
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10500] bg-black/25 backdrop-blur-[6px]"
          onClick={onClose}
          data-testid="publish-menu-backdrop"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="absolute inset-x-3 bottom-3 rounded-[28px] overflow-hidden border border-white/20 dark:border-white/10"
            style={{
              // iOS-26 style translucent glass, respects dark mode.
              background: "color-mix(in oklab, var(--card, #fff) 60%, transparent)",
              backdropFilter: "blur(28px) saturate(180%)",
              WebkitBackdropFilter: "blur(28px) saturate(180%)",
              boxShadow: "0 12px 40px -8px rgba(0,0,0,0.25), inset 0 1px 0 0 rgba(255,255,255,0.4)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
              maxWidth: "480px",
              marginInline: "auto",
              left: 12, right: 12,
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="publish-menu-sheet"
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="h-1 w-9 rounded-full bg-foreground/20" />
            </div>

            {/* Header — tighter, iOS-like */}
            <div className="flex items-center justify-between px-4 pb-1">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="grid place-items-center w-8 h-8 rounded-full bg-foreground/[0.06] text-foreground/70 active:scale-90 transition-transform"
                  data-testid="publish-menu-back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-8 h-8" />
              )}

              <div className="text-center">
                <h2 className="text-[15px] font-semibold text-foreground tracking-tight">
                  {step === 1 ? "Publicar" : type?.label}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid place-items-center w-8 h-8 rounded-full bg-foreground/[0.06] text-foreground/70 active:scale-90 transition-transform"
                data-testid="publish-menu-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body — condensed */}
            <div className="px-3 pt-2 pb-3">
              {step === 1 && (
                <div className="grid grid-cols-2 gap-2" data-testid="publish-menu-types">
                  {TYPES.map((t) => (
                    <motion.button
                      key={t.id}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => handleTypeSelect(t)}
                      data-testid={`publish-menu-type-${t.id}`}
                      className="flex items-center gap-2.5 rounded-2xl p-2.5 bg-foreground/[0.04] hover:bg-foreground/[0.07] transition-colors text-left"
                    >
                      <div className="grid place-items-center w-8 h-8 rounded-xl bg-foreground/[0.06]">
                        <t.Icon className="w-4 h-4 text-foreground/80" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-foreground truncate">{t.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{t.hint}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-1.5" data-testid="publish-menu-sources">
                  {SOURCES.map((s) => (
                    <motion.button
                      key={s.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSourceSelect(s)}
                      data-testid={`publish-menu-source-${s.id}`}
                      className="w-full flex items-center gap-3 rounded-2xl p-2.5 bg-foreground/[0.04] hover:bg-foreground/[0.07] transition-colors"
                    >
                      <div className="grid place-items-center w-9 h-9 rounded-xl bg-foreground/[0.06]">
                        <s.Icon className="w-4 h-4 text-foreground/80" strokeWidth={1.8} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-[13px] font-medium text-foreground">{s.label}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{s.hint}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChosen}
              data-testid="publish-menu-file-input"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
