import React from "react";
import { Palette } from "lucide-react";
import { TEXT_BGS, TEXT_FONTS, bgById, fontById, bgGradient } from "@/lib/textStyles";

// Background + font picker with live preview for text-only posts.
export default function TextStylePicker({ value, onChange, text }) {
  const bg = bgById(value?.bg) || TEXT_BGS[0];
  const font = fontById(value?.font);
  return (
    <div className="space-y-3" data-testid="text-style-picker">
      <div className="rounded-2xl overflow-hidden aspect-[4/3] grid place-items-center px-6 relative" style={{ background: bgGradient(bg) }} data-testid="text-style-preview">
        <p className="text-white text-xl text-center leading-snug whitespace-pre-wrap break-words line-clamp-6" style={{ fontFamily: font.family, fontWeight: font.weight, letterSpacing: font.tracking }}>
          {text?.trim() || "Así se verá tu publicación en Reels"}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1"><Palette className="w-3 h-3" /> Fondo</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {TEXT_BGS.map((b) => (
            <button key={b.id} type="button" onClick={() => onChange({ ...value, bg: b.id })} aria-label={b.label} title={b.label}
              className={`w-9 h-9 rounded-full shrink-0 ring-offset-2 ring-offset-background transition-transform active:scale-90 ${bg.id === b.id ? "ring-2 ring-primary scale-105" : "ring-1 ring-border/60"}`}
              style={{ background: `linear-gradient(135deg, ${b.a}, ${b.b})` }} data-testid={`text-bg-${b.id}`} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Tipografía</p>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {TEXT_FONTS.map((f) => (
            <button key={f.id} type="button" onClick={() => onChange({ ...value, font: f.id })}
              className={`h-9 px-3 rounded-full shrink-0 text-sm border transition-colors ${font.id === f.id ? "bg-foreground text-background border-foreground" : "border-border/60 hover:bg-muted"}`}
              style={{ fontFamily: f.family, fontWeight: f.weight, letterSpacing: f.tracking }} data-testid={`text-font-${f.id}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
