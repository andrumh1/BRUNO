import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CardBackground } from "./modules/CardBackground";
import { CardHeader } from "./modules/CardHeader";
import { ContactBlock, SocialBlock, CtaBlock } from "./modules/ActionBlocks";
import { GalleryBlock, LocationBlock, QRBlock, TypeFieldsBlock } from "./modules/InfoBlocks";
import { LinksBlock, FeaturedBlock, ProBlock, PurposeContactsBlock } from "./modules/ShowcaseBlocks";
import { SectionTitle } from "./modules/Surface";
import { bodyFont, spacingPx, depthShadow, rgba } from "@/lib/cardDesign";
import { CardLangContext, detectCardLang, translateCardLabel } from "@/lib/cardLabels";

// ONE CARD ENGINE: every card (public, preview, builder, thumbnails) renders through this component.
const CardRenderer = ({ data = {}, design, cardId, onChat, seal = true, className = "", style, lang }) => {
  const ref = useRef(null);
  const cardLang = lang || (data?.is_example && data.example_lang) || detectCardLang();
  const [narrow, setNarrow] = useState(true);
  useEffect(() => { const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(([e]) => setNarrow(e.contentRect.width < 600)); ro.observe(el); return () => ro.disconnect(); }, []);
  const pad = spacingPx(design);
  const t = design.colors.text;
  const center = design.layout.align === "center";
  const on = (k) => design.components[k] !== false;
  const socialInHero = design.layout.header === "hero" && design.hero?.social;

  const modules = {
    bio: () => data.description && on("bio") && (
      <p key="bio" className={`text-sm sm:text-base leading-relaxed opacity-85 whitespace-pre-line ${center ? "text-center" : ""}`} data-testid="card-bio">{data.description}</p>
    ),
    contact: () => on("contact") && <ContactBlock key="contact" data={data} design={design} />,
    social: () => on("social") && !socialInHero && (data.social_links || []).length > 0 && (
      <div key="social">{(design.layout.header || "classic") === "classic" && <SectionTitle design={design}>Conecta conmigo</SectionTitle>}<SocialBlock data={data} design={design} /></div>
    ),
    links: () => on("links") && <LinksBlock key="links" data={data} design={design} />,
    featured: () => on("featured") && <FeaturedBlock key="featured" data={data} design={design} />,
    pro: () => on("pro") && <ProBlock key="pro" data={data} design={design} />,
    purposeContacts: () => on("purposeContacts") && <PurposeContactsBlock key="purposeContacts" data={data} design={design} />,
    gallery: () => on("gallery") && <GalleryBlock key="gallery" data={data} design={design} />,
    location: () => on("location") && <LocationBlock key="location" data={data} design={design} />,
    typeFields: () => on("typeFields") && <TypeFieldsBlock key="typeFields" data={data} design={design} />,
    qr: () => on("qr") && <QRBlock key="qr" cardId={cardId} design={design} data={data} />,
    cta: () => on("cta") && <CtaBlock key="cta" design={design} />,
  };
  const order = [...(design.componentOrder || []), ...Object.keys(modules).filter((k) => !(design.componentOrder || []).includes(k))];
  const body = order.map((k) => modules[k]?.()).filter(Boolean);

  return (
    <CardLangContext.Provider value={cardLang}>
    <div
      ref={ref}
      data-card-renderer
      data-narrow={narrow ? "1" : "0"}
      className={`relative overflow-hidden ${className}`}
      style={{ borderRadius: design.layout.radius, color: t, fontFamily: bodyFont(design), boxShadow: depthShadow(design), border: `1px solid ${rgba(t, 0.08)}`, ...style }}
      data-testid="card-container"
      data-preset={design.preset}
      data-example={data?.is_example ? "1" : undefined}
      onClickCapture={(e) => {
        // Tarjeta de ejemplo: las acciones de contacto/compra se simulan, nunca se abren terceros
        if (!data?.is_example) return;
        const a = e.target.closest("a");
        if (!a) return;
        const h = a.getAttribute("href") || "";
        if (/^(tel:|mailto:|sms:)/.test(h) || /wa\.me|example\.com|maps\./.test(h)) {
          e.preventDefault(); e.stopPropagation();
          window.dispatchEvent(new CustomEvent("bruno:example-action", { detail: { label: a.textContent?.trim(), href: h } }));
        }
      }}
    >
      <CardBackground design={design} data={data} />
      {data?.is_example && <span className="absolute top-3 left-3 z-20 rounded-full bg-black/55 text-white text-[10px] font-semibold px-2 py-0.5 backdrop-blur" data-testid="card-example-badge">{translateCardLabel("Ejemplo ficticio", cardLang)}</span>}
      <div className="relative">
        <CardHeader data={data} design={design} onChat={onChat} pad={pad} narrow={narrow} />
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
    </CardLangContext.Provider>
  );
};

export default CardRenderer;
