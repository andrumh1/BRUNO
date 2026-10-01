import React from "react";
import { Link } from "react-router-dom";
import { CardBackground } from "./modules/CardBackground";
import { CardHeader } from "./modules/CardHeader";
import { ContactBlock, SocialBlock, CtaBlock } from "./modules/ActionBlocks";
import { GalleryBlock, LocationBlock, QRBlock, TypeFieldsBlock } from "./modules/InfoBlocks";
import { SectionTitle } from "./modules/Surface";
import { FONT_FAMILIES, spacingPx, depthShadow, rgba } from "@/lib/cardDesign";

// ONE CARD ENGINE: every card (public, preview, builder, thumbnails) renders through this component.
const CardRenderer = ({ data = {}, design, cardId, onChat, seal = true, className = "", style }) => {
  const pad = spacingPx(design);
  const t = design.colors.text;
  const center = design.layout.align === "center";
  const on = (k) => design.components[k] !== false;

  const modules = {
    bio: () => data.description && on("bio") && (
      <p key="bio" className={`text-sm sm:text-base leading-relaxed opacity-85 whitespace-pre-line ${center ? "text-center" : ""}`} data-testid="card-bio">{data.description}</p>
    ),
    contact: () => on("contact") && <ContactBlock key="contact" data={data} design={design} />,
    social: () => on("social") && (data.social_links || []).length > 0 && (
      <div key="social"><SectionTitle design={design}>Conecta conmigo</SectionTitle><SocialBlock data={data} design={design} /></div>
    ),
    gallery: () => on("gallery") && <GalleryBlock key="gallery" data={data} design={design} />,
    location: () => on("location") && <LocationBlock key="location" data={data} design={design} />,
    typeFields: () => on("typeFields") && <TypeFieldsBlock key="typeFields" data={data} design={design} />,
    qr: () => on("qr") && <QRBlock key="qr" cardId={cardId} design={design} />,
    cta: () => on("cta") && <CtaBlock key="cta" design={design} />,
  };
  const order = [...(design.componentOrder || []), ...Object.keys(modules).filter((k) => !(design.componentOrder || []).includes(k))];
  const body = order.map((k) => modules[k]?.()).filter(Boolean);

  return (
    <div
      data-card-renderer
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: design.layout.radius, color: t, fontFamily: FONT_FAMILIES[design.typography.family], boxShadow: depthShadow(design), border: `1px solid ${rgba(t, 0.08)}`, ...style }}
      data-testid="card-container"
      data-preset={design.preset}
    >
      <CardBackground design={design} data={data} />
      <div className="relative">
        <CardHeader data={data} design={design} onChat={onChat} pad={pad} />
        <div style={{ padding: pad, display: "flex", flexDirection: "column", gap: pad * 0.9 }}>
          {body}
        </div>
        {seal && (
          <div className="flex items-center justify-between pb-4 pt-1" style={{ paddingLeft: pad, paddingRight: pad }} data-testid="card-brand-seal">
            <span className="h-px flex-1 mr-3" style={{ background: `linear-gradient(90deg, transparent, ${rgba(t, 0.35)})` }} />
            <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide hover:scale-105 transition-transform" style={{ backgroundColor: rgba(t, 0.1), color: t }} title="Hecho con BRUNO"><span className="bruno-mark h-3.5" style={{ color: t }} aria-hidden />Hecho con BRUNO</Link>
            <span className="h-px flex-1 ml-3" style={{ background: `linear-gradient(90deg, ${rgba(t, 0.35)}, transparent)` }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default CardRenderer;
