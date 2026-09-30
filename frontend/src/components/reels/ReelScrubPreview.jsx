import React, { useEffect, useRef, useState } from "react";

const fmtTime = (s) => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), r = Math.floor(s % 60); return `${m}:${String(r).padStart(2, "0")}`; };

/**
 * ReelScrubPreview — miniatura del fotograma al arrastrar la barra de progreso.
 * Usa un <video> oculto (crossOrigin) que busca `time` y pinta en canvas; si el
 * navegador bloquea el frame (CORS) cae a la portada del reel.
 */
export default function ReelScrubPreview({ sources = [], poster, time, pct, visible, bottom }) {
  const vidRef = useRef(null);
  const canvasRef = useRef(null);
  const [fallback, setFallback] = useState(!sources.length);
  const pending = useRef(null);

  useEffect(() => {
    const v = vidRef.current;
    if (!v || !visible || fallback) return;
    pending.current = time;
    if (v.readyState >= 1 && Math.abs(v.currentTime - time) > 0.15) { try { v.currentTime = time; } catch { /* ignore */ } }
  }, [time, visible, fallback]);

  const draw = () => {
    const v = vidRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return;
    try {
      const ctx = c.getContext("2d");
      const scale = Math.max(c.width / v.videoWidth, c.height / v.videoHeight);
      const w = v.videoWidth * scale, h = v.videoHeight * scale;
      ctx.drawImage(v, (c.width - w) / 2, (c.height - h) / 2, w, h);
      ctx.getImageData(0, 0, 1, 1); // lanza si el canvas quedó "tainted"
    } catch { setFallback(true); }
  };

  if (!visible) return null;
  const left = `clamp(52px, ${pct * 100}%, calc(100% - 52px))`;
  return (
    <div className="absolute z-40 -translate-x-1/2 flex flex-col items-center pointer-events-none" style={{ left, bottom }} data-testid="reel-scrub-preview">
      <div className="relative w-[88px] h-[156px] rounded-xl overflow-hidden border border-white/40 shadow-2xl bg-[#474747] backdrop-blur-xl">
        {poster && <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {!fallback && <canvas ref={canvasRef} width={176} height={312} className="relative w-full h-full" data-testid="reel-scrub-canvas" />}
      </div>
      <span className="mt-1.5 px-2 h-5 rounded-full backdrop-blur-xl bg-white/[0.08] border border-white/35 text-white text-[11px] font-bold tabular-nums reel-chrome" data-testid="reel-scrub-time">{fmtTime(time)}</span>
      {!fallback && (
        <video ref={vidRef} className="hidden" muted playsInline preload="auto" crossOrigin="anonymous" onSeeked={draw} onLoadedData={draw}
          onLoadedMetadata={(e) => { if (pending.current != null) { try { e.currentTarget.currentTime = pending.current; } catch { /* ignore */ } } }}
          onError={() => setFallback(true)}>
          {sources.map((s) => <source key={s} src={s} />)}
        </video>
      )}
    </div>
  );
}
