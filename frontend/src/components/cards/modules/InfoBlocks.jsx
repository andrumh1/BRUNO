import React, { useEffect, useState } from "react";
import axios from "axios";
import { MapPin, QrCode, Briefcase, GraduationCap, Award, Languages, Sparkles } from "lucide-react";
import { Surface, SectionTitle } from "./Surface";
import { rgba } from "@/lib/cardDesign";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const GalleryBlock = ({ data, design }) => {
  const photos = data.gallery_photos || [];
  if (!photos.length) return null;
  return (
    <div data-testid="card-gallery-block">
      <SectionTitle design={design}>Galería</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => <div key={`${p}-${i}`} className="aspect-square overflow-hidden" style={{ borderRadius: Math.max(8, design.layout.radius - 10) }}><img src={p} alt={`Foto ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" /></div>)}
      </div>
    </div>
  );
};

const mapsUrl = (loc) => loc?.lat && loc?.lng ? `https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc?.address || loc?.city || "")}`;

export const LocationBlock = ({ data, design }) => {
  const ci = data.contact_info || {};
  const primary = data.location && (data.location.city || data.location.address) ? data.location : null;
  const address = [ci.address, ci.city, ci.country].filter(Boolean).join(", ");
  const extras = (data.locations || []).filter((l) => l.address);
  if (!primary && !address && !extras.length) return null;
  const t = design.colors.text;
  const row = (label, text, href, key) => (
    <a key={key} href={href} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover:opacity-80 transition-opacity" data-testid={`card-location-${key}`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: rgba(t, 0.12) }}><MapPin className="w-4.5 h-4.5 w-[18px] h-[18px]" /></div>
      <div className="min-w-0">{label && <span className="text-xs font-semibold block">{label}</span>}<span className="text-sm opacity-85 break-words">{text}</span></div>
    </a>
  );
  return (
    <Surface design={design} className="p-4" data-testid="card-location-block">
      <SectionTitle design={design}>Ubicación</SectionTitle>
      <div className="space-y-3">
        {primary && row(primary.place_name, primary.city || primary.address, mapsUrl(primary), "primary")}
        {!primary && address && row(null, address, mapsUrl({ address }), "address")}
        {extras.map((l, i) => row(l.label, l.address, mapsUrl(l), `extra-${i}`))}
      </div>
    </Surface>
  );
};

export const QRBlock = ({ cardId, design }) => {
  const [qr, setQr] = useState(null);
  useEffect(() => { if (!cardId) return; axios.get(`${API}/cards/${cardId}/qr`).then((r) => setQr(r.data.qr_code)).catch(() => {}); }, [cardId]);
  return (
    <Surface design={design} className="p-4 flex items-center gap-4" data-testid="card-qr-block">
      <div className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center">{qr ? <img src={qr} alt="QR" className="w-full h-full" /> : <QrCode className="w-10 h-10 text-neutral-400" />}</div>
      <div className="min-w-0"><p className="text-sm font-semibold">Escanea para guardar</p><p className="text-xs opacity-75 mt-0.5">Abre esta tarjeta al instante desde cualquier cámara.</p></div>
    </Surface>
  );
};

const List = ({ items, render }) => <div className="space-y-2.5">{items.map((it, i) => <div key={i}>{render(it)}</div>)}</div>;

// Renders the type-specific custom_fields (CV, job offers, services) in a compact, generic way.
export const TypeFieldsBlock = ({ data, design }) => {
  const cf = data.custom_fields || {};
  const t = design.colors.text;
  const sections = [];
  const has = (k) => Array.isArray(cf[k]) && cf[k].length > 0;
  const card = (title, Icon, body, key) => sections.push(
    <Surface key={key} design={design} className="p-4"><div className="flex items-center gap-2 mb-3"><Icon className="w-4 h-4 opacity-70" /><SectionTitle design={design}>{title}</SectionTitle></div>{body}</Surface>
  );
  if (has("experience")) card("Experiencia", Briefcase, <List items={cf.experience} render={(e) => <div><p className="text-sm font-semibold">{e.position}{e.company ? ` · ${e.company}` : ""}</p><p className="text-xs opacity-70">{e.startDate}{e.endDate || e.current ? ` – ${e.current ? "Actual" : e.endDate}` : ""}</p>{e.description && <p className="text-xs mt-1 opacity-85">{e.description}</p>}</div>} />, "exp");
  if (has("education")) card("Educación", GraduationCap, <List items={cf.education} render={(e) => <div><p className="text-sm font-semibold">{e.degree}</p><p className="text-xs opacity-70">{e.institution}{e.startDate ? ` · ${e.startDate}${e.endDate ? ` – ${e.endDate}` : ""}` : ""}</p></div>} />, "edu");
  if (has("skills")) card("Habilidades", Sparkles, <div className="flex flex-wrap gap-2">{cf.skills.filter((s) => s.name).map((s, i) => <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: rgba(t, 0.12) }}>{s.name}</span>)}</div>, "skills");
  if (has("languages")) card("Idiomas", Languages, <div className="flex flex-wrap gap-2">{cf.languages.filter((l) => l.name).map((l, i) => <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: rgba(t, 0.12) }}>{l.name}{l.level ? ` · ${l.level}` : ""}</span>)}</div>, "langs");
  if (has("certifications")) card("Certificaciones", Award, <List items={cf.certifications} render={(c) => <p className="text-sm">{c.name || c.title}{c.issuer ? <span className="opacity-70"> · {c.issuer}</span> : null}</p>} />, "certs");
  const jd = cf.job_details;
  if (jd && (jd.salary_min || jd.salary_max || jd.contract_type || jd.remote_option || (jd.requirements || []).length)) {
    const chips = [jd.contract_type, jd.remote_option, jd.experience_required && `Exp: ${jd.experience_required}`, jd.vacancies > 1 && `${jd.vacancies} vacantes`, jd.urgency === "urgent" && "Urgente"].filter(Boolean);
    card("Detalles", Briefcase, <div className="space-y-2">{(jd.salary_min || jd.salary_max) && <p className="text-sm font-semibold">{jd.salary_min}{jd.salary_max ? ` – ${jd.salary_max}` : ""} {jd.salary_currency}</p>}<div className="flex flex-wrap gap-2">{chips.map((c, i) => <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: rgba(t, 0.12) }}>{c}</span>)}</div>{(jd.requirements || []).length > 0 && <ul className="text-xs list-disc pl-4 space-y-0.5 opacity-85">{jd.requirements.map((r, i) => <li key={i}>{typeof r === "string" ? r : r.text || r.name}</li>)}</ul>}</div>, "job");
  }
  if (!sections.length) return null;
  return <div className="space-y-3" data-testid="card-type-fields">{sections}</div>;
};
