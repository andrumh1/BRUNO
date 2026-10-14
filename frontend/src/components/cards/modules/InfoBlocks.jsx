import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { MapPin, QrCode, Briefcase, GraduationCap, Award, Languages, Sparkles, X, ChevronLeft, ChevronRight } from "lucide-react";
import { Surface, SectionTitle } from "./Surface";
import { useCardT } from "@/lib/cardLabels";
import { rgba } from "@/lib/cardDesign";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Full-screen viewer: images keep their aspect ratio (object-contain), swipe-free prev/next.
const Lightbox = ({ photos, index, onClose, onStep }) => {
  useEffect(() => { const k = (e) => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onStep(1); if (e.key === "ArrowLeft") onStep(-1); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose, onStep]);
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center" onClick={onClose} role="dialog" aria-modal="true" data-testid="gallery-lightbox">
      <img src={photos[index]} alt={`Foto ${index + 1}`} className="max-w-[94vw] max-h-[86vh] object-contain select-none" onClick={(e) => e.stopPropagation()} data-testid="gallery-lightbox-img" />
      <button type="button" onClick={onClose} className="absolute right-3 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" style={{ top: "calc(var(--safe-top) + 12px)" }} aria-label="Cerrar" data-testid="gallery-lightbox-close"><X className="w-5 h-5" /></button>
      {photos.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); onStep(-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" aria-label="Anterior" data-testid="gallery-lightbox-prev"><ChevronLeft className="w-5 h-5" /></button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onStep(1); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20" aria-label="Siguiente" data-testid="gallery-lightbox-next"><ChevronRight className="w-5 h-5" /></button>
          <span className="absolute left-1/2 -translate-x-1/2 text-white/70 text-xs" style={{ bottom: "calc(var(--safe-bottom) + 16px)" }}>{index + 1} / {photos.length}</span>
        </>
      )}
    </div>, document.body);
};

export const GalleryBlock = ({ data, design }) => {
  const photos = data.gallery_photos || [];
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  const step = (d) => setOpen((i) => (i + d + photos.length) % photos.length);
  return (
    <div data-testid="card-gallery-block">
      <SectionTitle design={design}>Galería</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => <button type="button" key={`${p}-${i}`} onClick={() => setOpen(i)} className="aspect-square overflow-hidden block w-full" style={{ borderRadius: Math.max(8, design.layout.radius - 10) }} aria-label={`Ampliar foto ${i + 1}`} data-testid={`card-gallery-photo-${i}`}><img src={p} alt={`Foto ${i + 1}`} loading="lazy" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" /></button>)}
      </div>
      {open !== null && <Lightbox photos={photos} index={open} onClose={() => setOpen(null)} onStep={step} />}
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

export const QRBlock = ({ cardId, design, data }) => {
  const t9 = useCardT();
  const [qr, setQr] = useState(null);
  const exq = data?.is_example ? `?template=${data.example_preset}&lang=${data.example_lang}` : "";
  useEffect(() => { if (!cardId) return; axios.get(`${API}/cards/${cardId}/qr${exq}`).then((r) => setQr(r.data.qr_code)).catch(() => {}); }, [cardId, exq]);
  return (
    <Surface design={design} className="p-4 flex items-center gap-4" data-testid="card-qr-block">
      <div className="w-24 h-24 rounded-xl bg-white p-1.5 shrink-0 flex items-center justify-center">{qr ? <img src={qr} alt="QR" className="w-full h-full" /> : <QrCode className="w-10 h-10 text-neutral-400" />}</div>
      <div className="min-w-0"><p className="text-sm font-semibold">{t9("Escanea para guardar")}</p><p className="text-xs opacity-75 mt-0.5">{t9("Abre esta tarjeta al instante desde cualquier cámara.")}</p></div>
    </Surface>
  );
};

const List = ({ items, render }) => <div className="space-y-2.5">{items.map((it, i) => <div key={i}>{render(it)}</div>)}</div>;

// Renders the type-specific custom_fields (CV, job offers, services) in a compact, generic way.
export const TypeFieldsBlock = ({ data, design }) => {
  const tr = useCardT();
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
    const chips = [jd.contract_type, jd.remote_option, jd.experience_required && `Exp: ${jd.experience_required}`, jd.vacancies > 1 && `${jd.vacancies} ${tr("vacantes")}`, jd.urgency === "urgent" && tr("Urgente")].filter(Boolean);
    card("Detalles", Briefcase, <div className="space-y-2">{(jd.salary_min || jd.salary_max) && <p className="text-sm font-semibold">{jd.salary_min}{jd.salary_max ? ` – ${jd.salary_max}` : ""} {jd.salary_currency}</p>}<div className="flex flex-wrap gap-2">{chips.map((c, i) => <span key={i} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: rgba(t, 0.12) }}>{c}</span>)}</div>{(jd.requirements || []).length > 0 && <ul className="text-xs list-disc pl-4 space-y-0.5 opacity-85">{jd.requirements.map((r, i) => <li key={i}>{typeof r === "string" ? r : r.text || r.name}</li>)}</ul>}</div>, "job");
  }
  // Campos específicos del tipo (negocio, servicios, lugares, empresa, mascota, guardián…) en formato genérico
  const LABELS = { services: "Servicios", products: "Productos", team: "Equipo", schedule: "Horario", openingHours: "Horario", attractions: "Qué encontrarás", interests: "Intereses", emergencyContacts: "Contactos de emergencia", ownerContacts: "Contacto del dueño", medications: "Medicación", allergies: "Alergias", medicalConditions: "Condiciones médicas", benefits: "Beneficios" };
  const INFO = { profession: "Profesión", company: "Empresa", availability: "Disponibilidad", position: "Cargo", department: "Departamento", officeLocation: "Oficina", directPhone: "Teléfono directo", businessType: "Tipo", foundedYear: "Desde", priceRange: "Precios", locationType: "Tipo de lugar", admissionFee: "Entrada", accessibility: "Accesibilidad", warnings: "Avisos", personName: "Nombre", age: "Edad", bloodType: "Grupo sanguíneo", petName: "Nombre", species: "Especie", breed: "Raza", color: "Color", size: "Tamaño", microchip: "Microchip", identifyingMarks: "Señas", lostInstructions: "Si se pierde", reward: "Recompensa", vaccinated: "Vacunado", sterilized: "Esterilizado", responsibilities: "Responsabilidades" };
  const val = (v) => (v === true ? tr("Sí") : v === false ? tr("No") : String(v));
  const info = Object.keys(INFO).filter((k) => cf[k] !== undefined && cf[k] !== "" && cf[k] !== null && !(Array.isArray(cf[k]) && !cf[k].length));
  if (info.length) card("Información", Sparkles, <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">{info.map((k) => <p key={k} className="text-sm"><span className="opacity-60 text-xs uppercase tracking-wide mr-1.5">{tr(INFO[k])}</span>{val(cf[k])}</p>)}</div>, "info");
  for (const k of Object.keys(LABELS)) {
    const v = cf[k];
    if (!v || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length)) continue;
    if (Array.isArray(v)) {
      const body = typeof v[0] === "string" ? <div className="flex flex-wrap gap-2">{v.map((x, i) => <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: rgba(t, 0.1) }}>{x}</span>)}</div>
        : <List items={v} render={(it) => <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">{it.name || it.title}</p>{(it.role || it.description || it.phone) && <p className="text-xs opacity-70">{it.role || it.description || it.phone}</p>}</div>{it.price && <span className="text-sm font-bold shrink-0">{it.price}</span>}</div>} />;
      card(LABELS[k], Briefcase, body, k);
    } else if (typeof v === "object") {
      card(LABELS[k], Briefcase, <div className="grid grid-cols-2 gap-x-4 gap-y-1">{Object.entries(v).map(([d, h]) => <p key={d} className="text-xs flex justify-between gap-2"><span className="capitalize opacity-70">{d}</span><span className="font-medium">{h}</span></p>)}</div>, k);
    } else {
      card(LABELS[k], Briefcase, <p className="text-sm">{val(v)}</p>, k);
    }
  }
  if (!sections.length) return null;
  return <div className="space-y-3" data-testid="card-type-fields">{sections}</div>;
};
