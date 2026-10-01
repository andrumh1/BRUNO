import React from "react";
import { Section, TextField, Choice, ToggleRow, Field } from "./controls";
import { CARD_TYPES } from "@/lib/cardDesign";
import BubbleSelect from "@/components/BubbleSelect";

const ContentPanel = ({ card, update }) => {
  const ci = card.contact_info || {};
  const setCI = (k, v) => update((p) => ({ ...p, contact_info: { ...(p.contact_info || {}), [k]: v } }));
  return (
    <div className="space-y-3" data-testid="panel-content">
      <Section title="Tipo de tarjeta" testId="section-card-type">
        <Field hint="Define la función, no el diseño">
          <BubbleSelect value={card.card_type} onChange={(v) => update({ card_type: v })} options={CARD_TYPES} placeholder="Tipo de tarjeta" />
        </Field>
      </Section>
      <Section title="Información" testId="section-info">
        <TextField label="Nombre o título *" value={card.title} onChange={(v) => update({ title: v })} placeholder="Juan Pérez" testId="input-title" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Cargo" value={card.subtitle} onChange={(v) => update({ subtitle: v })} placeholder="Diseñador UX" testId="input-subtitle" />
          <TextField label="Empresa" value={ci.company} onChange={(v) => setCI("company", v)} placeholder="BRUNO" testId="input-company" />
        </div>
        <TextField label="Descripción" value={card.description} onChange={(v) => update({ description: v })} placeholder="Cuenta en pocas líneas qué haces" textarea testId="input-description" />
      </Section>
      <Section title="Contacto directo" testId="section-contact">
        <p className="text-xs text-muted-foreground -mt-1">Cada dato genera un botón de acción automático en la tarjeta.</p>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="WhatsApp" value={ci.whatsapp} onChange={(v) => setCI("whatsapp", v)} placeholder="+34 600 000 000" testId="input-whatsapp" />
          <TextField label="Teléfono" value={ci.phone} onChange={(v) => setCI("phone", v)} placeholder="+34 600 000 000" testId="input-phone" />
          <TextField label="Email" value={ci.email} onChange={(v) => setCI("email", v)} placeholder="hola@correo.com" type="email" testId="input-email" />
          <TextField label="Sitio web" value={ci.website} onChange={(v) => setCI("website", v)} placeholder="tuweb.com" testId="input-website" />
        </div>
        <TextField label="Dirección" value={ci.address} onChange={(v) => setCI("address", v)} placeholder="Calle, ciudad" testId="input-address" />
      </Section>
      <Section title="Visibilidad" defaultOpen={false} testId="section-visibility">
        <ToggleRow label="Tarjeta pública" desc="Cualquiera con el enlace, QR o NFC puede verla" checked={card.is_public} onChange={(v) => update({ is_public: v })} testId="toggle-public" />
        <ToggleRow label="Mostrar en el feed" desc="Aparece en Explorar tarjetas" checked={card.show_in_feed} onChange={(v) => update({ show_in_feed: v })} testId="toggle-feed" />
      </Section>
    </div>
  );
};

export const CtaFields = ({ design, updateDesign }) => (
  <div className="grid grid-cols-2 gap-3">
    <TextField label="Texto del botón" value={design.cta.label} onChange={(v) => updateDesign({ cta: { label: v } })} placeholder="Reservar cita" testId="input-cta-label" />
    <TextField label="Enlace" value={design.cta.url} onChange={(v) => updateDesign({ cta: { url: v } })} placeholder="https://" testId="input-cta-url" />
  </div>
);

export { Choice };
export default ContentPanel;
