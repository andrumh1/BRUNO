import React from "react";
import { Phone, Mail, Globe, MessageCircle, MessageSquare, ExternalLink } from "lucide-react";
import { socialMediaConfig } from "@/components/SocialLinkButton";
import { Surface, SectionTitle } from "./Surface";
import { buttonStyle, buttonSizeClass, rgba } from "@/lib/cardDesign";

const clean = (s) => (s || "").replace(/[^\d+]/g, "");

export const contactActions = (ciIn) => { const ci = ciIn || {}; return [
  ci.whatsapp && { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/${clean(ci.whatsapp)}`, Icon: MessageCircle },
  ci.phone && { id: "phone", label: "Llamar", href: `tel:${clean(ci.phone)}`, Icon: Phone },
  ci.phone && { id: "sms", label: "SMS", href: `sms:${clean(ci.phone)}`, Icon: MessageSquare },
  ci.email && { id: "email", label: "Email", href: `mailto:${ci.email}`, Icon: Mail },
  ci.website && { id: "website", label: "Sitio web", href: /^https?:/i.test(ci.website) ? ci.website : `https://${ci.website}`, Icon: Globe },
].filter(Boolean); };

export const ActionButton = ({ design, href, label, Icon, primary, full, testId, onClick }) => (
  <a href={href} onClick={onClick} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={`inline-flex items-center justify-center font-semibold hover:scale-[1.03] active:scale-[0.98] ${buttonSizeClass(design)} ${full ? "w-full" : ""}`} style={buttonStyle(design, { primary })} data-testid={testId}>
    {Icon && <Icon className="w-4 h-4" />}<span className="truncate">{label}</span>
  </a>
);

export const ContactBlock = ({ data, design }) => {
  const actions = contactActions(data.contact_info);
  if (!actions.length) return null;
  const center = design.layout.align === "center";
  return (
    <div data-testid="card-contact-block">
      <div className={`flex flex-wrap gap-2.5 ${center ? "justify-center" : ""}`}>
        {actions.map((a, i) => <ActionButton key={a.id} design={design} href={a.href} label={a.label} Icon={a.Icon} primary={i === 0} testId={`card-action-${a.id}`} />)}
      </div>
    </div>
  );
};

export const CtaBlock = ({ design }) => {
  if (!design.cta?.label) return null;
  return <ActionButton design={design} href={design.cta.url || "#"} label={design.cta.label} Icon={ExternalLink} primary full testId="card-cta" />;
};

// Social links in 7 visual styles: icons | iconsNames | buttons | bubbles | bar | outline | brand
export const SocialBlock = ({ data, design }) => {
  const links = data.social_links || [];
  if (!links.length) return null;
  const style = design.socialStyle;
  const t = design.colors.text;
  const center = design.layout.align === "center";
  const item = (l) => socialMediaConfig[l.type] || socialMediaConfig.custom;
  const circleStyle = (l) => {
    const { color } = item(l);
    if (style === "bubbles") return { ...buttonStyle(design), borderRadius: 999, color: design.glass.enabled ? t : color };
    if (style === "outline") return { backgroundColor: "transparent", border: `1px solid ${rgba(t, 0.55)}`, color: t };
    if (style === "brand") return { backgroundColor: color, color: "#FFFFFF", boxShadow: `0 8px 20px -10px ${color}` };
    return { backgroundColor: rgba(t, 0.12), color: t };
  };
  const circle = (l, i, size) => { const { icon: Icon } = item(l); return (
    <a key={`${l.type}-${i}`} href={l.url} target="_blank" rel="noreferrer" title={l.label || item(l).label} className={`${size} rounded-full flex items-center justify-center hover:scale-110 transition-transform`} style={circleStyle(l)} data-testid={`card-social-${l.type}-${i}`}><Icon className="w-[45%] h-[45%]" /></a>
  ); };
  if (style === "buttons") return <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5" data-testid="card-social-block">{links.map((l, i) => { const { icon: Icon } = item(l); return <ActionButton key={i} design={design} href={l.url} label={l.label || item(l).label} Icon={Icon} full testId={`card-social-${l.type}-${i}`} />; })}</div>;
  if (style === "iconsNames") return <div className={`flex flex-wrap gap-2 ${center ? "justify-center" : ""}`} data-testid="card-social-block">{links.map((l, i) => { const { icon: Icon } = item(l); return <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-3 h-9 text-xs font-semibold hover:scale-[1.03] transition-transform" style={{ ...buttonStyle(design), borderRadius: design.buttons.radius }} data-testid={`card-social-${l.type}-${i}`}><Icon className="w-4 h-4" />{l.label || item(l).label}</a>; })}</div>;
  if (style === "bar") return <Surface design={design} className="px-3 py-2.5" data-testid="card-social-block"><div className="flex items-center justify-around gap-2">{links.map((l, i) => circle(l, i, "w-10 h-10"))}</div></Surface>;
  return <div className={`flex flex-wrap gap-3 ${center ? "justify-center" : ""}`} data-testid="card-social-block">{links.map((l, i) => circle(l, i, style === "bubbles" ? "w-14 h-14" : "w-11 h-11"))}</div>;
};

export { SectionTitle };
