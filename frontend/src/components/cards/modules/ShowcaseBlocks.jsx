import React from "react";
import { ArrowUpRight, MapPin, CalendarCheck, Building2, Briefcase, Handshake, Newspaper, Play } from "lucide-react";
import { Surface, SectionTitle } from "./Surface";
import { ActionButton } from "./ActionBlocks";
import { rgba, contrastText } from "@/lib/cardDesign";
import { useCardT } from "@/lib/cardLabels";

const ensureHttp = (u) => (/^(https?:|mailto:|tel:|sms:)/i.test(u) ? u : `https://${u}`);
const hrefFor = (v) => { const s = (v || "").trim(); if (!s) return null; if (s.includes("@") && !/^https?:/i.test(s)) return `mailto:${s}`; if (/^\+?[\d\s()-]{7,}$/.test(s)) return `tel:${s.replace(/[^\d+]/g, "")}`; return ensureHttp(s); };

// Ordered list of featured links → stacked pills (link-in-bio style). Empty titles/urls are never rendered.
export const LinksBlock = ({ data, design }) => {
  const links = (data.links || []).filter((l) => l?.title?.trim() && l?.url?.trim());
  if (!links.length) return null;
  const stack = design.buttons.stack;
  return (
    <div className={stack ? "flex flex-col gap-3" : "flex flex-wrap gap-2.5"} data-testid="card-links-block">
      {links.map((l, i) => <ActionButton key={`${l.url}-${i}`} design={{ ...design, buttons: { ...design.buttons, size: stack ? "lg" : design.buttons.size } }} href={ensureHttp(l.url)} label={l.title} Icon={ArrowUpRight} primary={i === 0 && !stack} full={stack} testId={`card-link-${i}`} />)}
    </div>
  );
};

// Highlighted content block: cover image + title + link (video is shown as a linked cover, no new player).
export const FeaturedBlock = ({ data, design }) => {
  const s = data.showcase || {};
  const title = (s.featured_title || "").trim(); const url = (s.featured_url || "").trim(); const img = s.featured_image;
  if (!title && !img) return null;
  const acc = design.colors.accent;
  const Wrap = url ? "a" : "div";
  const props = url ? { href: ensureHttp(url), target: "_blank", rel: "noreferrer" } : {};
  return (
    <div data-testid="card-featured-block">
      <SectionTitle design={design}>Destacado</SectionTitle>
      <Wrap {...props} className="block group" data-testid="card-featured-link">
        <Surface design={design} strong className="overflow-hidden">
          {img && (
            <div className="relative w-full aspect-video overflow-hidden">
              <img src={img} alt={title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent 40%, ${rgba("#000000", 0.55)} 100%)` }} />
              {url && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full flex items-center justify-center shadow-xl" style={{ backgroundColor: rgba("#FFFFFF", 0.85), color: "#111" }}><Play className="w-6 h-6 ml-0.5" /></span>}
            </div>
          )}
          {(title || url) && (
            <div className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">{title && <p className="font-semibold leading-tight truncate">{title}</p>}{url && <p className="text-xs opacity-70 mt-0.5 truncate">{url.replace(/^https?:\/\//, "")}</p>}</div>
              {url && <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: acc, color: contrastText(acc) }}><ArrowUpRight className="w-4 h-4" /></span>}
            </div>
          )}
        </Surface>
      </Wrap>
    </div>
  );
};

// Professional facts for bookings: city, availability, agency.
export const ProBlock = ({ data, design }) => {
  const tr = useCardT();
  const s = data.showcase || {};
  const items = [s.city && ["city", MapPin, "Ciudad", s.city], s.availability && ["availability", CalendarCheck, "Disponibilidad", s.availability], s.agency && ["agency", Building2, "Agencia", s.agency]].filter(Boolean);
  if (!items.length) return null;
  const t = design.colors.text;
  return (
    <div data-testid="card-pro-block">
      <SectionTitle design={design}>Datos profesionales</SectionTitle>
      <div className="flex flex-wrap gap-2.5">
        {items.map(([k, Icon, label, value]) => (
          <Surface key={k} design={design} className="px-3.5 py-3 flex items-center gap-3 flex-1 min-w-[150px]" data-testid={`card-pro-${k}`}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: rgba(t, 0.1) }}><Icon className="w-4 h-4" /></span>
            <div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] opacity-60">{tr(label)}</p><p className="text-sm font-semibold truncate">{value}</p></div>
          </Surface>
        ))}
      </div>
    </div>
  );
};

// Contacts grouped by purpose (bookings / collaborations / press) — only the ones the user configured.
export const PurposeContactsBlock = ({ data, design }) => {
  const tr = useCardT();
  const s = data.showcase || {};
  const rows = [s.booking && ["booking", Briefcase, "Contrataciones", s.booking], s.collab && ["collab", Handshake, "Colaboraciones", s.collab], s.press && ["press", Newspaper, "Prensa", s.press]].filter(Boolean);
  if (!rows.length) return null;
  const t = design.colors.text;
  return (
    <div data-testid="card-purpose-block">
      <SectionTitle design={design}>Contacto por finalidad</SectionTitle>
      <Surface design={design} className="divide-y" style={{ borderColor: rgba(t, 0.1) }}>
        {rows.map(([k, Icon, label, value]) => (
          <a key={k} href={hrefFor(value)} target={/^https?:/i.test(hrefFor(value)) ? "_blank" : undefined} rel="noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity" style={{ borderColor: rgba(t, 0.1) }} data-testid={`card-purpose-${k}`}>
            <Icon className="w-4 h-4 opacity-70 shrink-0" />
            <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-[0.2em] opacity-60">{tr(label)}</p><p className="text-sm font-medium truncate">{value}</p></div>
            <ArrowUpRight className="w-4 h-4 opacity-60 shrink-0" />
          </a>
        ))}
      </Surface>
    </div>
  );
};
