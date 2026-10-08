import React from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Section, Choice, SliderField, ToggleRow } from "./controls";
import { CtaFields } from "./ContentPanel";

const LABELS = { bio: "Biografía", contact: "Botones de contacto", social: "Redes sociales", links: "Enlaces destacados", featured: "Bloque destacado", pro: "Datos profesionales", purposeContacts: "Contacto por finalidad", gallery: "Galería", location: "Ubicación", typeFields: "Campos del tipo (CV, oferta…)", qr: "Código QR", cta: "Botón de acción (CTA)" };

const Row = ({ id, design, updateDesign, onMove, index, total }) => {
  const controls = useDragControls();
  const on = design.components[id] !== false;
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={controls} className={`flex items-center gap-2 rounded-xl border px-2 py-2 bg-background/70 ${on ? "" : "opacity-60"}`} data-testid={`component-row-${id}`}>
      <button type="button" onPointerDown={(e) => controls.start(e)} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground p-1" aria-label="Arrastrar"><GripVertical className="w-4 h-4" /></button>
      <span className="flex-1 text-sm font-medium">{LABELS[id] || id}</span>
      <div className="flex items-center">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, -1)} className="p-1 text-muted-foreground disabled:opacity-30" data-testid={`component-up-${id}`}><ChevronUp className="w-4 h-4" /></button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(index, 1)} className="p-1 text-muted-foreground disabled:opacity-30" data-testid={`component-down-${id}`}><ChevronDown className="w-4 h-4" /></button>
      </div>
      <Switch checked={on} onCheckedChange={(v) => updateDesign({ components: { [id]: v } })} data-testid={`component-toggle-${id}`} />
    </Reorder.Item>
  );
};

const ComponentsPanel = ({ design, updateDesign }) => {
  const order = design.componentOrder;
  const move = (i, dir) => { const j = i + dir; if (j < 0 || j >= order.length) return; const o = [...order]; [o[i], o[j]] = [o[j], o[i]]; updateDesign({ componentOrder: o }); };
  return (
    <div className="space-y-3" data-testid="panel-components">
      <Section title="Encabezado" testId="section-header-components">
        <ToggleRow label="Banner" checked={design.components.banner !== false && design.banner.enabled} onChange={(v) => updateDesign({ components: { banner: v }, banner: { enabled: v } })} testId="component-toggle-banner" />
        <ToggleRow label="Avatar" checked={design.components.avatar !== false} onChange={(v) => updateDesign({ components: { avatar: v } })} testId="component-toggle-avatar" />
      </Section>
      <Section title="Cuerpo de la tarjeta" testId="section-body-components">
        <p className="text-[11px] text-muted-foreground -mt-1">Activa, desactiva y arrastra para cambiar el orden.</p>
        <Reorder.Group axis="y" values={order} onReorder={(o) => updateDesign({ componentOrder: o })} className="space-y-1.5">
          {order.map((id, i) => <Row key={id} id={id} index={i} total={order.length} design={design} updateDesign={updateDesign} onMove={move} />)}
        </Reorder.Group>
      </Section>
      {design.components.cta && <Section title="Botón de acción" testId="section-cta"><CtaFields design={design} updateDesign={updateDesign} /></Section>}
    </div>
  );
};

// Glass / depth / motion controls — the BRUNO Bubble Glass system.
export const EffectsPanel = ({ design, updateDesign }) => {
  const d = design;
  return (
    <div className="space-y-3" data-testid="panel-effects">
      <Section title="Bubble Glass" testId="section-glass">
        <ToggleRow label="Efecto cristal" desc="Transparencia, reflejos y profundidad en superficies y botones" checked={d.glass.enabled} onChange={(v) => updateDesign({ glass: { enabled: v } })} testId="toggle-glass" />
        {d.glass.enabled && (
          <>
            <SliderField label="Transparencia" value={d.glass.opacity} onChange={(v) => updateDesign({ glass: { opacity: v } })} marks={["Sólido", "Ligero", "Glass", "Ultra", "Cristal"]} testId="glass-opacity" />
            <SliderField label="Desenfoque (blur)" value={d.glass.blur} onChange={(v) => updateDesign({ glass: { blur: v } })} testId="glass-blur" />
            <ToggleRow label="Reflejo" desc="Brillo superior tipo vidrio" checked={d.effects.reflection} onChange={(v) => updateDesign({ effects: { reflection: v } })} testId="toggle-reflection" />
          </>
        )}
      </Section>
      <Section title="Profundidad y luz" testId="section-depth">
        <Choice label="Profundidad" value={d.effects.depth} onChange={(v) => updateDesign({ effects: { depth: v } })} testId="depth" options={[{ value: "flat", label: "Flat" }, { value: "soft", label: "Soft" }, { value: "deep", label: "Deep" }, { value: "floating", label: "Floating" }]} />
        <ToggleRow label="Glow" desc="Halo suave con el color de acento" checked={d.effects.glow} onChange={(v) => updateDesign({ effects: { glow: v } })} testId="toggle-glow" />
      </Section>
      <Section title="Animación" testId="section-animation">
        <ToggleRow label="Fondo animado" desc="Gradiente vivo y burbujas flotantes. Se desactiva si el usuario prefiere menos movimiento." checked={d.animations.enabled} onChange={(v) => updateDesign({ animations: { enabled: v } })} testId="toggle-animation" />
      </Section>
    </div>
  );
};

export default ComponentsPanel;
