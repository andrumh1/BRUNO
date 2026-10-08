import React from "react";
import { MessageCircle } from "lucide-react";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { SocialBlock } from "./ActionBlocks";
import { FONT_FAMILIES, rgba, contrastText, coverFocus, coverImage } from "@/lib/cardDesign";

// Sizes are driven by the card's own width (narrow < 600px), not the viewport, so previews and thumbnails match phones.
const HERO_H = { md: [300, 380], lg: [380, 460], xl: [460, 560] };
const TITLE = { 1: ["text-xl", "text-2xl"], 2: ["text-2xl", "text-4xl"], 3: ["text-3xl", "text-5xl"], 4: ["text-5xl", "text-7xl"] };

// Elegant fallback when the user has not uploaded a photo yet (never someone else's picture).
export const FallbackCover = ({ design, className = "" }) => {
  const { background: bg, colors } = design;
  return (
    <div aria-hidden className={`absolute inset-0 ${className}`} style={{ background: `linear-gradient(160deg, ${bg.color2 || rgba(colors.accent, 0.5)} 0%, ${bg.color} 100%)` }} data-testid="card-cover-fallback">
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at 30% 25%, ${rgba(colors.accent, 0.35)}, transparent 55%)` }} />
      <div className="absolute inset-0 flex items-center justify-center opacity-20"><BrunoLogo variant="icon" tone={contrastText(bg.color) === "#FFFFFF" ? "white" : "orange"} className="w-1/4" /></div>
    </div>
  );
};

export const CoverPhoto = ({ data, design, className = "" }) => {
  const img = coverImage(data, design);
  return img ? <img src={img} alt="" className={`absolute inset-0 w-full h-full object-cover ${className}`} style={coverFocus(design)} data-testid="card-cover-photo" /> : <FallbackCover design={design} />;
};

const Title = ({ data, design, narrow, className = "" }) => {
  const t = design.typography;
  return <h1 className={`${(TITLE[t.titleSize] || TITLE[2])[narrow ? 0 : 1]} leading-[0.95] break-words ${className}`} style={{ fontFamily: FONT_FAMILIES[t.family], fontWeight: t.weight, letterSpacing: `${t.letterSpacing}px` }} data-testid="card-title">{data.title || "Tu nombre"}</h1>;
};

const Chat = ({ onChat, design, className = "" }) => onChat ? (
  <button onClick={onChat} className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 hover:scale-105 transition-transform shadow-lg ${className}`} style={{ backgroundColor: design.colors.accent, color: contrastText(design.colors.accent) }} title="Mensaje" data-testid="card-chat-btn"><MessageCircle className="w-5 h-5" /></button>
) : null;

// GLAMOUR / SPOTLIGHT — edge-to-edge cover, fade into the card colour, name + alias over the photo.
export const HeroHeader = ({ data, design, onChat, pad, narrow }) => {
  const h = design.hero; const bg = design.background.color;
  const start = Math.max(0, 100 - (h.fade ?? 70));
  return (
    <div className="relative w-full overflow-hidden" style={{ height: (HERO_H[h.height] || HERO_H.lg)[narrow ? 0 : 1] }} data-testid="card-hero">
      <CoverPhoto data={data} design={design} />
      <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) ${start * 0.5}%, ${rgba(bg, 0.35)} ${start}%, ${rgba(bg, 0.85)} ${Math.min(100, start + 30)}%, ${bg} 100%)` }} />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3" style={{ paddingLeft: pad, paddingRight: pad, paddingBottom: pad * 0.4 }}>
        <div className="min-w-0 flex-1">
          <Title data={data} design={design} narrow={narrow} />
          {data.subtitle && <p className={`${narrow ? "text-base" : "text-lg"} font-medium mt-1.5 opacity-85`} data-testid="card-alias">{data.subtitle}</p>}
          {h.social && design.components.social !== false && (data.social_links || []).length > 0 && <div className="mt-3"><SocialBlock data={data} design={design} /></div>}
        </div>
        <Chat onChat={onChat} design={design} className="mb-1" />
      </div>
    </div>
  );
};

// NOIR — centred portrait with a thin ring, name and specialty line; atmosphere comes from CardBackground.
export const PortraitHeader = ({ data, design, onChat, pad, narrow }) => {
  const t = design.colors.text; const size = design.avatar.size || 128;
  const specialty = data.showcase?.specialty || data.subtitle;
  const ring = { width: size, height: size, border: `1.5px solid ${rgba(t, 0.75)}`, boxShadow: `0 0 0 6px ${rgba(t, 0.06)}, 0 24px 48px -20px rgba(0,0,0,0.6)` };
  return (
    <div className="relative flex flex-col items-center text-center" style={{ padding: pad, paddingTop: pad * 1.6 }} data-testid="card-portrait">
      {design.components.avatar !== false && (data.avatar_url ? (
        <img src={data.avatar_url} alt={data.title || "Retrato"} className="rounded-full object-cover shrink-0" style={{ ...ring, objectPosition: `${design.hero.focusX}% ${design.hero.focusY}%` }} data-testid="card-avatar" />
      ) : (
        <div className="rounded-full flex items-center justify-center shrink-0" style={{ ...ring, backgroundColor: rgba(t, 0.08) }} data-testid="card-avatar-fallback"><BrunoLogo variant="icon" tone={contrastText(design.background.color) === "#FFFFFF" ? "white" : "orange"} className="w-[46%] opacity-80" /></div>
      ))}
      <div className="mt-6 w-full"><Title data={data} design={design} narrow={narrow} /></div>
      {specialty && <p className="mt-3 text-[11px] uppercase tracking-[0.32em] opacity-75" data-testid="card-specialty">{specialty}</p>}
      {data.subtitle && specialty !== data.subtitle && <p className="mt-1.5 text-sm opacity-80" data-testid="card-alias">{data.subtitle}</p>}
      {onChat && <div className="mt-5"><Chat onChat={onChat} design={design} /></div>}
    </div>
  );
};

// EDITORIAL — asymmetric magazine layout: tall vertical photo + oversized display name; stacks on mobile.
export const EditorialHeader = ({ data, design, onChat, pad, narrow }) => {
  const t = design.colors.text;
  const specialty = data.showcase?.specialty;
  const img = coverImage(data, design);
  return (
    <div className={`relative grid items-end ${narrow ? "gap-5" : "grid-cols-[minmax(0,44%)_1fr] gap-7"}`} style={{ padding: pad, paddingBottom: 0 }} data-testid="card-editorial">
      <div className="relative w-full aspect-[3/4] overflow-hidden" style={{ borderRadius: Math.max(2, design.layout.radius - 4), boxShadow: "0 30px 60px -30px rgba(0,0,0,0.55)" }}>
        {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" style={coverFocus(design)} data-testid="card-cover-photo" /> : <FallbackCover design={design} />}
        <span className="absolute left-3 top-3 text-[9px] font-bold uppercase tracking-[0.3em] px-2 py-1" style={{ backgroundColor: rgba(design.background.color, 0.85), color: t }}>Portfolio</span>
      </div>
      <div className={`min-w-0 ${narrow ? "" : "pb-2"}`}>
        {specialty && <p className="text-[11px] uppercase tracking-[0.3em] opacity-70 mb-3" data-testid="card-specialty">{specialty}</p>}
        <Title data={data} design={design} narrow={narrow} className="uppercase" />
        <div className="mt-3 h-px w-16" style={{ backgroundColor: rgba(t, 0.6) }} />
        {data.subtitle && <p className={`mt-3 ${narrow ? "text-sm" : "text-base"} font-medium opacity-85`} data-testid="card-alias">{data.subtitle}</p>}
        {onChat && <div className="mt-4"><Chat onChat={onChat} design={design} /></div>}
      </div>
    </div>
  );
};
