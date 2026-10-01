import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CurriculumFields } from "@/components/CurriculumFields";
import ProfileSpecificFields from "@/components/ProfileSpecificFields";
import { Section, TextField, Choice } from "./controls";

const EMPTY = {
  experience: { company: "", position: "", startDate: "", endDate: "", current: false, description: "" },
  education: { institution: "", degree: "", startDate: "", endDate: "", description: "" },
  skills: { name: "", level: 80 }, languages: { name: "", level: "intermediate" },
  certifications: { name: "", issuer: "", date: "", url: "" }, documents: { name: "", url: "", type: "pdf" },
  references: { name: "", position: "", company: "", relationship: "", phone: "", email: "" },
};
const JOB_TYPES = ["oferta_trabajo", "busqueda_personal", "solicitud_servicio"];

const ListEditor = ({ label, items = [], onChange, testId }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-foreground/80">{label}</label>
    {items.map((it, i) => (
      <div key={i} className="flex gap-2">
        <Input value={typeof it === "string" ? it : it.text || ""} onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }} className="h-8 text-xs rounded-xl" data-testid={`${testId}-${i}`} />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
      </div>
    ))}
    <Button type="button" variant="outline" size="sm" className="rounded-full h-7 text-xs" onClick={() => onChange([...items, ""])} data-testid={`${testId}-add`}><Plus className="w-3 h-3 mr-1" />Agregar</Button>
  </div>
);

const JobFields = ({ jd, setJD }) => (
  <Section title="Detalles de la oferta / solicitud" testId="section-job">
    <div className="grid grid-cols-3 gap-3">
      <TextField label="Salario mín." value={jd.salary_min} onChange={(v) => setJD({ salary_min: v })} placeholder="1200" testId="job-salary-min" />
      <TextField label="Salario máx." value={jd.salary_max} onChange={(v) => setJD({ salary_max: v })} placeholder="1800" testId="job-salary-max" />
      <TextField label="Moneda" value={jd.salary_currency} onChange={(v) => setJD({ salary_currency: v })} placeholder="USD" testId="job-currency" />
    </div>
    <Choice label="Contrato" value={jd.contract_type} onChange={(v) => setJD({ contract_type: v })} testId="job-contract" options={[{ value: "full-time", label: "Tiempo completo" }, { value: "part-time", label: "Medio tiempo" }, { value: "freelance", label: "Freelance" }, { value: "temporary", label: "Temporal" }]} />
    <Choice label="Modalidad" value={jd.remote_option} onChange={(v) => setJD({ remote_option: v })} testId="job-remote" options={[{ value: "remote", label: "Remoto" }, { value: "hybrid", label: "Híbrido" }, { value: "on-site", label: "Presencial" }]} />
    <div className="grid grid-cols-3 gap-3">
      <TextField label="Experiencia" value={jd.experience_required} onChange={(v) => setJD({ experience_required: v })} placeholder="2 años" testId="job-exp" />
      <TextField label="Vacantes" type="number" value={jd.vacancies} onChange={(v) => setJD({ vacancies: Number(v) || 1 })} testId="job-vacancies" />
      <TextField label="Fecha límite" type="date" value={jd.application_deadline} onChange={(v) => setJD({ application_deadline: v })} testId="job-deadline" />
    </div>
    <Choice label="Urgencia" value={jd.urgency} onChange={(v) => setJD({ urgency: v })} testId="job-urgency" options={[{ value: "low", label: "Baja" }, { value: "normal", label: "Normal" }, { value: "urgent", label: "Urgente" }]} />
    <ListEditor label="Requisitos" items={jd.requirements} onChange={(v) => setJD({ requirements: v })} testId="job-req" />
    <ListEditor label="Beneficios" items={jd.benefits} onChange={(v) => setJD({ benefits: v })} testId="job-benefit" />
  </Section>
);

// Type-specific content (card type ≠ design). Reuses the existing field editors.
const TypeFieldsPanel = ({ card, update }) => {
  const setCF = (patch) => update((p) => ({ ...p, custom_fields: { ...p.custom_fields, ...(typeof patch === "function" ? patch(p.custom_fields) : patch) } }));
  if (card.card_type === "curriculum") {
    return (
      <div className="space-y-3 [&_.glass-card]:rounded-2xl" data-testid="panel-type-fields">
        <CurriculumFields
          formData={card}
          setFormData={(next) => update(typeof next === "function" ? next : () => next)}
          addCurriculumItem={(f) => setCF((cf) => ({ [f]: [...(cf[f] || []), EMPTY[f] || {}] }))}
          updateCurriculumItem={(f, i, k, v) => setCF((cf) => { const l = [...(cf[f] || [])]; l[i] = { ...l[i], [k]: v }; return { [f]: l }; })}
          removeCurriculumItem={(f, i) => setCF((cf) => ({ [f]: (cf[f] || []).filter((_, j) => j !== i) }))}
        />
      </div>
    );
  }
  if (JOB_TYPES.includes(card.card_type)) {
    const jd = card.custom_fields?.job_details || {};
    return <div data-testid="panel-type-fields"><JobFields jd={jd} setJD={(patch) => setCF((cf) => ({ job_details: { ...(cf.job_details || {}), ...patch } }))} /></div>;
  }
  return (
    <div className="space-y-3 [&_.glass-card]:rounded-2xl" data-testid="panel-type-fields">
      <ProfileSpecificFields cardType={card.card_type} customFields={card.custom_fields || {}} onChange={(fields) => update({ custom_fields: fields })} />
    </div>
  );
};

export default TypeFieldsPanel;
