import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, VolumeX, RotateCcw, RotateCw } from "lucide-react";

/* Burbuja de vidrio ultra transparente: sin color, solo borde/luz y el icono blanco. */
const glass = "backdrop-blur-xl bg-white/[0.06] border border-white/35 shadow-[inset_0_1px_0_rgba(255,255,255,.45),0_8px_24px_-8px_rgba(0,0,0,.45)] text-white active:scale-90 transition-transform";
const Bubble = ({ size = "w-14 h-14", onClick, testid, label, children }) => (
  <button
    type="button" aria-label={label} data-testid={testid}
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onClick?.(); }}
    className={`${size} rounded-full grid place-items-center pointer-events-auto ${glass}`}
  >{children}</button>
);

/**
 * ReelPlaybackControls — controles centrales (−10 s · Play/Pausa · +10 s) + sonido centrado debajo.
 * seekHint: { side: "left"|"right" } muestra el indicador de salto de 10 s.
 */
export default function ReelPlaybackControls({ visible, isPlaying, muted, onToggle, onSeek, onToggleMute, seekHint }) {
  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="controls" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.18 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 pointer-events-none reel-chrome" data-testid="reel-playback-controls"
          >
            <div className="flex items-center gap-6">
              <Bubble onClick={() => onSeek(-10)} testid="reel-seek-back" label="Retroceder 10 segundos">
                <span className="relative grid place-items-center"><RotateCcw className="w-7 h-7" strokeWidth={1.8} /><span className="absolute text-[9px] font-bold mt-[1px]">10</span></span>
              </Bubble>
              <Bubble size="w-[76px] h-[76px]" onClick={onToggle} testid="reel-play-toggle" label={isPlaying ? "Pausar" : "Reproducir"}>
                {isPlaying ? <Pause className="w-9 h-9 fill-white" strokeWidth={1.5} /> : <Play className="w-9 h-9 fill-white ml-1" strokeWidth={1.5} />}
              </Bubble>
              <Bubble onClick={() => onSeek(10)} testid="reel-seek-fwd" label="Adelantar 10 segundos">
                <span className="relative grid place-items-center"><RotateCw className="w-7 h-7" strokeWidth={1.8} /><span className="absolute text-[9px] font-bold mt-[1px]">10</span></span>
              </Bubble>
            </div>
            <Bubble size="w-11 h-11" onClick={onToggleMute} testid="reel-mute-toggle" label={muted ? "Activar sonido" : "Silenciar"}>
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Bubble>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {seekHint && (
          <motion.div
            key={seekHint.id} initial={{ opacity: 0, scale: 0.7, x: seekHint.side === "left" ? -12 : 12 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 1.1 }} transition={{ duration: 0.2 }}
            className={`absolute top-1/2 -translate-y-1/2 z-30 ${seekHint.side === "left" ? "left-8" : "right-8"} flex flex-col items-center gap-1 pointer-events-none reel-chrome`} data-testid={`reel-seek-hint-${seekHint.side}`}
          >
            <span className={`w-16 h-16 rounded-full grid place-items-center ${glass}`}>{seekHint.side === "left" ? <RotateCcw className="w-8 h-8" strokeWidth={1.8} /> : <RotateCw className="w-8 h-8" strokeWidth={1.8} />}</span>
            <span className="text-white text-xs font-bold">{seekHint.side === "left" ? "−10 s" : "+10 s"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
