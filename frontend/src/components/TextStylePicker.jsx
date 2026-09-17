import React from "react";
import { Palette, AlignCenter, AlignLeft } from "lucide-react";
import { TEXT_BGS, TEXT_FONTS, TEXT_EMOJIS, bgById, fontById, bgGradient } from "@/lib/textStyles";

// Background + font + alignment + emoji sticker picker with live preview for text-only posts.
export default function TextStylePicker({ value, onChange, text }) {
  const bg = bgById(value?.bg) || TEXT_BGS[0];
  const font = fontById(value?.font);
  const align = value?.align === "left" ? "left" : "center";
  const emoji = value?.emoji || null;
  return (
    <div className="space-y-3" data-testid="text-style-picker">
      <div className={`rounded-2xl overflow-hidden aspect-[4/3] flex flex-col justify-center px-6 relative ${align === "center" ? "items-center text-center" : "items-start text-left"}`} style={{ background: bgGradient(bg) }} data-testid="text-style-preview" data-align={align}>
        {emoji && <span className="text-5xl leading-none mb-2 drop-shadow-lg" data-testid="text-style-preview-emoji">{emoji}</span>}
        <p className="text-white text-xl leading-snug whitespace-pre-wrap break-words line-clamp-5" style={{ fontFamily: font.family, fontWeight: font.weight, letterSpacing: font.tracking }}>
          {text?.trim() || "Así se verá tu publicación en Reels"}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex-1">Alineación</p>
        <div className="inline-flex rounded-full bg-muted p-0.5">
          <button type="button" onClick={() => onChange({ ...value, align: "center" })} className={`w-9 h-8 rounded-full grid place-items-center ${align === "center" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`} aria-label="Centrado" data-testid="text-align-center"><AlignCenter className="w-4 h-4" /></button>
          <button type="button" onClick={() => onChange({ ...value, align: "left" })} className={`w-9 h-8 rounded-full grid place-items-center ${align === "left" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`} aria-label="Izquierda" data-testid="text-align-left"><AlignLeft className="w-4 h-4" /></button>
        </div>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Pegatina</p>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          <button type="button" onClick={() => onChange({ ...value, emoji: null })} className={`h-9 px-3 rounded-full shrink-0 text-xs border ${!emoji ? "bg-foreground text-background border-foreground" : "border-border/60"}`} data-testid="text-emoji-none">Sin</button>
          {TEXT_EMOJIS.map((e) => (
            <button key={e} type="button" onClick={() => onChange({ ...value, emoji: e })} className={`w-9 h-9 rounded-full shrink-0 text-lg grid place-items-center border transition-transform active:scale-90 ${emoji === e ? "bg-primary/15 border-primary scale-105" : "border-border/60"}`} data-testid={`text-emoji-${e.codePointAt(0).toString(16)}`}>{e}</button>
          ))}
        </div>
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
