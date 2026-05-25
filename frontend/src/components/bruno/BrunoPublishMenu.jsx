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
  X, Camera, Image as ImageIcon, FolderLock, Sparkles, Video,
  MessageSquare, Clapperboard, Lock, ChevronLeft,
} from "lucide-react";

const TYPES = [
  { id: "story",  label: "Historia",  hint: "Visible 24h",                 Icon: Sparkles,      tint: "from-orange-500 to-pink-500" },
  { id: "reel",   label: "Reel",      hint: "Video corto · Para Ti",       Icon: Clapperboard,  tint: "from-fuchsia-500 to-purple-500" },
  { id: "post",   label: "Publicación", hint: "Aparece en el muro",        Icon: MessageSquare, tint: "from-blue-500 to-cyan-500" },
  { id: "status", label: "Estado",    hint: "Texto o estado rápido",       Icon: Lock,          tint: "from-emerald-500 to-teal-500" },
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
          className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm"
          onClick={onClose}
          data-testid="publish-menu-backdrop"
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="absolute inset-x-0 bottom-0 rounded-t-3xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg,#FFFCF6 0%,#FFF1DF 100%)",
              boxShadow: "0 -20px 50px -10px rgba(255,107,53,0.35)",
              paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="publish-menu-sheet"
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2.5 pb-1.5">
              <div className="h-1.5 w-12 rounded-full bg-orange-300/70" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-2">
              {step === 2 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="grid place-items-center w-9 h-9 rounded-full bg-white/70 border border-orange-200 text-orange-700"
                  data-testid="publish-menu-back"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              ) : (
                <div className="w-9 h-9" />
              )}

              <div className="text-center">
                <h2 className="text-base font-bold text-stone-900 tracking-tight">
                  {step === 1 ? "¿Qué quieres publicar?" : "Elige el origen"}
                </h2>
                <p className="text-[11px] text-stone-500">
                  {step === 1 ? "Selecciona el formato" : `Crearás un ${type?.label.toLowerCase()}`}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="grid place-items-center w-9 h-9 rounded-full bg-white/70 border border-orange-200 text-orange-700"
                data-testid="publish-menu-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 pt-3 pb-6">
              {step === 1 && (
                <div className="grid grid-cols-2 gap-3" data-testid="publish-menu-types">
                  {TYPES.map((t) => (
                    <motion.button
                      key={t.id}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTypeSelect(t)}
                      data-testid={`publish-menu-type-${t.id}`}
                      className="relative rounded-2xl p-3 text-left overflow-hidden bg-white/80 border border-orange-100 shadow-sm"
                    >
                      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${t.tint} opacity-90`} />
                      <div className="relative grid place-items-center w-10 h-10 rounded-xl bg-white shadow-sm">
                        <t.Icon className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="relative mt-3">
                        <div className="text-sm font-bold text-stone-900">{t.label}</div>
                        <div className="text-[11px] text-stone-500">{t.hint}</div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-2.5" data-testid="publish-menu-sources">
                  {SOURCES.map((s) => (
                    <motion.button
                      key={s.id}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSourceSelect(s)}
                      data-testid={`publish-menu-source-${s.id}`}
                      className="w-full flex items-center gap-3 rounded-2xl p-3 bg-white/85 border border-orange-100 shadow-sm hover:bg-white"
                    >
                      <div className="grid place-items-center w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 text-white shadow shadow-orange-500/30">
                        <s.Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-bold text-stone-900">{s.label}</div>
                        <div className="text-[11px] text-stone-500">{s.hint}</div>
                      </div>
                      <Video className="w-3.5 h-3.5 text-orange-300" />
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
