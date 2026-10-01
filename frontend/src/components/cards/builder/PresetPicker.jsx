import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import CardRenderer from "@/components/cards/CardRenderer";
import { DEFAULT_DESIGN, PRESETS, SAMPLE_DATA, applyPreset } from "@/lib/cardDesign";

// Renders a real card at 390px and scales it to fit its container (true WYSIWYG thumbnails).
export const ScaledPreview = ({ data, design, width = 390, className = "" }) => {
  const ref = useRef(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / width));
    ro.observe(el); return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className={`relative overflow-hidden ${className}`}>
      <div style={{ width, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none" }}>
        <CardRenderer data={data} design={design} seal={false} />
      </div>
    </div>
  );
};

const PresetPicker = ({ value, onPick, data, compact = false }) => {
  const sample = { ...SAMPLE_DATA, ...(data?.title ? { title: data.title, subtitle: data.subtitle, avatar_url: data.avatar_url || SAMPLE_DATA.avatar_url, banner_url: data.banner_url || SAMPLE_DATA.banner_url } : {}) };
  return (
    <div data-testid="preset-picker">
      {!compact && (
        <div className="mb-4">
          <h2 className="text-base md:text-lg font-bold">Comienza con un estilo</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Elige un estilo inicial o comienza desde cero. Podrás personalizarlo completamente después.</p>
        </div>
      )}
      <div className={`grid gap-3 ${compact ? "grid-cols-4" : "grid-cols-2 sm:grid-cols-4"}`}>
        {PRESETS.map((p) => {
          const active = value === p.id;
          return (
            <button key={p.id} type="button" onClick={() => onPick(p.id)} className={`group text-left rounded-2xl border-2 p-1.5 transition-all hover:-translate-y-0.5 ${active ? "border-primary shadow-lg shadow-primary/20" : "border-border/60 hover:border-primary/40"}`} data-testid={`preset-${p.id}`} aria-pressed={active}>
              <div className="relative">
                {active && <div className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow"><Check className="w-3 h-3" /></div>}
                <ScaledPreview data={sample} design={applyPreset(DEFAULT_DESIGN, p.id)} className={`${compact ? "h-20" : "h-36"} rounded-xl bg-muted`} />
              </div>
              <div className="px-1 pt-1.5 pb-0.5">
                <div className="text-xs font-semibold leading-tight">{p.name}</div>
                {!compact && <div className="text-[10px] text-muted-foreground leading-tight">{p.desc}</div>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PresetPicker;
