import React from "react";
import { MessageCircle } from "lucide-react";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { Surface } from "./Surface";
import { HeroHeader, PortraitHeader, EditorialHeader } from "./ShowcaseHeaders";
import { FONT_FAMILIES, cardTypeLabel, rgba, contrastText } from "@/lib/cardDesign";

const BANNER_H = { sm: "h-20 sm:h-24", md: "h-32 sm:h-40 lg:h-48", lg: "h-48 sm:h-60 lg:h-72" };
const SHAPE = { circle: "rounded-full", rounded: "rounded-2xl", bubble: "rounded-[38%]" };

const Avatar = ({ data, design, size }) => {
  const px = size || design.avatar.size;
  const common = { width: px, height: px, borderColor: design.glass.enabled ? rgba("#FFFFFF", 0.55) : design.background.color, boxShadow: design.effects.depth === "flat" ? "none" : "0 10px 28px -10px rgba(0,0,0,0.45)" };
  const cls = `${SHAPE[design.avatar.shape] || SHAPE.rounded} border-[3px] shrink-0 overflow-hidden`;
  return data.avatar_url ? (
    <img src={data.avatar_url} alt={data.title || "Avatar"} className={`${cls} object-cover`} style={common} data-testid="card-avatar" />
  ) : (
    <div className={`${cls} flex items-center justify-center bg-[#f9f1ea]`} style={common} data-testid="card-avatar-fallback"><BrunoLogo variant="icon" tone="orange" className="w-[58%]" /></div>
  );
};

const NameBlock = ({ data, design, center }) => {
  const t = design.typography;
  const sizes = { 1: "text-xl sm:text-2xl", 2: "text-2xl sm:text-3xl lg:text-4xl", 3: "text-3xl sm:text-4xl lg:text-5xl" };
  const company = data.contact_info?.company;
  return (
    <div className={`min-w-0 ${center ? "text-center" : ""}`}>
      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide mb-1.5" style={{ backgroundColor: rgba(design.colors.accent, 0.18), color: design.glass.enabled ? design.colors.text : design.colors.accent }} data-testid="card-type-chip">{cardTypeLabel(data.card_type)}</span>
      <h1 className={`${sizes[t.titleSize] || sizes[2]} leading-tight break-words`} style={{ fontFamily: FONT_FAMILIES[t.family], fontWeight: t.weight, letterSpacing: `${t.letterSpacing}px` }} data-testid="card-title">{data.title || "Tu nombre"}</h1>
      {(data.subtitle || company) && (
        <p className="text-sm sm:text-base font-medium mt-1 opacity-85">{data.subtitle}{data.subtitle && company ? " · " : ""}{company}</p>
      )}
    </div>
  );
};

const ChatBtn = ({ onChat, design }) => onChat ? (
  <button onClick={onChat} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 hover:scale-105 transition-transform shadow-md" style={{ backgroundColor: design.colors.accent, color: contrastText(design.colors.accent) }} title="Mensaje" data-testid="card-chat-btn"><MessageCircle className="w-5 h-5" /></button>
) : null;

// Banner + avatar + name in every supported arrangement (position drives the layout).
export const CardHeader = ({ data, design, onChat, pad, narrow = true }) => {
  const header = design.layout.header || "classic";
  if (header === "hero") return <HeroHeader data={data} design={design} onChat={onChat} pad={pad} narrow={narrow} />;
  if (header === "portrait") return <PortraitHeader data={data} design={design} onChat={onChat} pad={pad} narrow={narrow} />;
  if (header === "editorial") return <EditorialHeader data={data} design={design} onChat={onChat} pad={pad} narrow={narrow} />;
  const bannerOn = design.components.banner && design.banner.enabled && design.background.type !== "fullimage";
  const avatarOn = design.components.avatar && design.avatar.enabled;
  const pos = design.avatar.position;
  const center = design.layout.align === "center" || pos === "center";
  const bannerBg = design.banner.style === "image" && data.banner_url ? undefined : design.banner.style === "color" ? design.colors.accent : `linear-gradient(135deg, ${design.colors.accent}, ${rgba(design.colors.accent, 0.55)})`;

  const banner = bannerOn && (
    <div className={`relative w-full overflow-hidden ${pos === "inBanner" ? "" : BANNER_H[design.banner.height] || BANNER_H.md}`} style={{ background: bannerBg }} data-testid="card-banner">
      {design.banner.style === "image" && data.banner_url && <img src={data.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/35" />
      {pos === "inBanner" && (
        <div className={`relative ${{ sm: "pt-24", md: "pt-36 sm:pt-44", lg: "pt-44 sm:pt-56 lg:pt-64" }[design.banner.height] || "pt-36"} pb-4`} style={{ paddingLeft: pad, paddingRight: pad }}>
          <Surface design={{ ...design, glass: { ...design.glass, enabled: true } }} strong className="p-4 sm:p-5">
            <div className="flex items-start gap-3 sm:gap-4">
              {avatarOn && <Avatar data={data} design={design} size={Math.min(design.avatar.size, 80)} />}
              <div className="flex-1 min-w-0"><NameBlock data={data} design={design} /></div>
              <ChatBtn onChat={onChat} design={design} />
            </div>
          </Surface>
        </div>
      )}
    </div>
  );

  if (pos === "inBanner" && bannerOn) return banner;

  const overlap = bannerOn && (pos === "overlap" || pos === "floating" || pos === "center");
  const rowLayout = pos === "left" || pos === "right";
  return (
    <>
      {banner}
      <div style={{ paddingLeft: pad, paddingRight: pad, marginTop: overlap ? -(design.avatar.size / 2) : pad }} className="relative">
        {rowLayout ? (
          <div className={`flex items-center gap-4 ${pos === "right" ? "flex-row-reverse text-right" : ""}`}>
            {avatarOn && <Avatar data={data} design={design} />}
            <div className="flex-1 min-w-0"><NameBlock data={data} design={design} /></div>
            <ChatBtn onChat={onChat} design={design} />
          </div>
        ) : (
          <div className={`flex flex-col ${center ? "items-center" : pos === "floating" ? "items-end" : "items-start"}`}>
            <div className={`flex w-full items-end ${center ? "justify-center" : "justify-between"}`}>
              {avatarOn && <div style={pos === "floating" ? { transform: "translateY(-8px)" } : undefined}>{<Avatar data={data} design={design} />}</div>}
              {!center && <ChatBtn onChat={onChat} design={design} />}
            </div>
            <div className={`mt-3 w-full ${center ? "flex flex-col items-center" : pos === "floating" ? "text-left self-start" : ""}`}>
              <NameBlock data={data} design={design} center={center} />
              {center && onChat && <div className="mt-3"><ChatBtn onChat={onChat} design={design} /></div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
};
