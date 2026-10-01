import React from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ChevronDown } from "lucide-react";

export const Field = ({ label, hint, children, testId }) => (
  <div className="space-y-1.5" data-testid={testId}>
    {label && <div className="flex items-baseline justify-between"><label className="text-xs font-semibold text-foreground/80">{label}</label>{hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}</div>}
    {children}
  </div>
);

export const TextField = ({ label, value, onChange, placeholder, textarea, testId, ...rest }) => (
  <Field label={label}>
    {textarea ? (
      <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} className="flex w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid={testId} {...rest} />
    ) : (
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="rounded-xl bg-background/60" data-testid={testId} {...rest} />
    )}
  </Field>
);

// Segmented pill choice — the primary visual selector of the builder.
export const Choice = ({ label, value, options, onChange, testId }) => (
  <Field label={label}>
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={`px-3 h-8 rounded-full text-xs font-medium border transition-all ${value === o.value ? "bg-primary text-primary-foreground border-primary shadow-sm" : "bg-background/60 border-border hover:border-primary/50"}`} data-testid={`${testId}-${o.value}`}>{o.label}</button>
      ))}
    </div>
  </Field>
);

export const ColorField = ({ label, value, onChange, testId }) => (
  <Field label={label}>
    <div className="flex items-center gap-2">
      <label className="relative w-10 h-10 rounded-xl border border-border overflow-hidden cursor-pointer shrink-0" style={{ backgroundColor: value }}>
        <input type="color" value={value || "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" data-testid={testId} />
      </label>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl font-mono text-xs uppercase bg-background/60" />
    </div>
  </Field>
);

export const SliderField = ({ label, value, onChange, min = 0, max = 100, step = 1, marks, testId }) => (
  <Field label={label} hint={`${value}`}>
    <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} data-testid={testId} />
    {marks && <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">{marks.map((m) => <span key={m}>{m}</span>)}</div>}
  </Field>
);

export const ToggleRow = ({ label, desc, checked, onChange, testId }) => (
  <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
    <div className="min-w-0"><div className="text-sm font-medium">{label}</div>{desc && <div className="text-xs text-muted-foreground">{desc}</div>}</div>
    <Switch checked={!!checked} onCheckedChange={onChange} data-testid={testId} />
  </label>
);

export const Section = ({ title, children, defaultOpen = true, advanced, testId }) => {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm" data-testid={testId}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-sm font-semibold flex items-center gap-2">{title}{advanced && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Avanzado</span>}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
};
