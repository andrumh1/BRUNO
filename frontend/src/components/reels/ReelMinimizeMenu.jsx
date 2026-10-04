import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PictureInPicture2, AppWindow, PanelBottom, X } from "lucide-react";

const glass = "backdrop-blur-xl bg-white/[0.06] border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_24px_-8px_rgba(0,0,0,.45)] text-white";

/**
 * ReelMinimizeMenu — elige cómo minimizar el reel:
 *  float  → ventana flotante dentro de la app (arrastrable, sigue reproduciendo)
 *  native → Picture-in-Picture del sistema (sigue sobre otras apps)
 *  bar    → pastilla en la barra de navegación (pausa el video)
 */
export default function ReelMinimizeMenu({ open, onClose, onPick, nativeSupported }) {
  const opts = [
    { id: "float", Icon: AppWindow, title: "Ventana flotante", desc: "Sigue viendo y desplázate por la app", testid: "reel-min-float" },
    { id: "native", Icon: PictureInPicture2, title: "Sobre otras apps", desc: nativeSupported ? "Picture-in-Picture del sistema" : "No disponible en este navegador", disabled: !nativeSupported, testid: "reel-min-native" },
    { id: "bar", Icon: PanelBottom, title: "A la barra", desc: "Guarda el reel como pastilla para volver luego", testid: "reel-min-bar" },
  ];
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-[#474747]/40 backdrop-blur-[3px]" onClick={onClose} data-testid="reel-minimize-menu" onTouchEnd={(e) => e.stopPropagation()}>
          <motion.div initial={{ y: 40, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={`w-full max-w-sm mx-3 mb-[calc(var(--safe-bottom)+16px)] sm:mb-0 rounded-[28px] p-3 ${glass} reel-chrome`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <span className="text-sm font-bold">Minimizar reel</span>
              <button onClick={onClose} className="w-8 h-8 rounded-full grid place-items-center bg-white/10 active:scale-90" aria-label="Cerrar" data-testid="reel-min-close"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {opts.map(({ id, Icon, title, desc, disabled, testid }) => (
                <button key={id} disabled={disabled} onClick={() => onPick(id)} data-testid={testid}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left bg-white/[0.06] border border-white/20 hover:bg-white/15 active:scale-[0.98] transition disabled:opacity-40">
                  <span className="w-10 h-10 rounded-full grid place-items-center bg-white/10 shrink-0"><Icon className="w-5 h-5" /></span>
                  <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="block text-[11px] text-white/75 truncate">{desc}</span></span>
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
