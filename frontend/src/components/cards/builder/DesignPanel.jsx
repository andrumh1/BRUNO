import React from "react";
import { RotateCcw } from "lucide-react";
import { Section, Choice, ColorField, SliderField, ToggleRow } from "./controls";
import PresetPicker from "./PresetPicker";
import { FONT_FAMILIES, FONT_LABELS } from "@/lib/cardDesign";

const BRAND = [["Crema", "#F9F1EA", "#474747"], ["Naranja", "#FF6A00", "#FFFFFF"], ["Gris", "#474747", "#F9F1EA"], ["Blanco", "#FFFFFF", "#474747"], ["Noche", "#111111", "#F9F1EA"], ["Marfil", "#F4EFE6", "#141414"], ["Champán", "#0E0E0E", "#E8D3A8"]];

// Quick + advanced design controls. Every control writes straight into cardDesign (live preview).
const DesignPanel = ({ card, design, setPreset, updateDesign, resetDesign }) => {
  const d = design;
  return (
    <div className="space-y-3" data-testid="panel-design">
      <Section title="Estilo inicial" testId="section-preset">
        <PresetPicker value={d.preset} onPick={setPreset} data={card} compact />
        <button type="button" onClick={resetDesign} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" data-testid="reset-design-btn"><RotateCcw className="w-3.5 h-3.5" />Restablecer diseño (conserva tu información)</button>
      </Section>

      <Section title="Colores" testId="section-colors">
        <div className="flex flex-wrap gap-2" data-testid="brand-color-presets">
          {BRAND.map(([label, bg, fg]) => (
            <button key={label} type="button" onClick={() => updateDesign({ background: { color: bg }, colors: { text: fg } })} className={`inline-flex items-center gap-2 rounded-full border px-3 h-8 text-xs font-medium hover:scale-105 transition-transform ${d.background.color.toUpperCase() === bg ? "border-primary ring-2 ring-primary/30" : "border-border"}`} data-testid={`brand-${bg.slice(1).toLowerCase()}`}>
              <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: bg }} />{label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <ColorField label="Fondo" value={d.background.color} onChange={(v) => updateDesign({ background: { color: v } })} testId="color-bg" />
          <ColorField label="Texto" value={d.colors.text} onChange={(v) => updateDesign({ colors: { text: v } })} testId="color-text" />
          <ColorField label="Acento" value={d.colors.accent} onChange={(v) => updateDesign({ colors: { accent: v } })} testId="color-accent" />
        </div>
      </Section>

      <Section title="Fondo" testId="section-background">
        <Choice label="Tipo" value={d.background.type} onChange={(v) => updateDesign({ background: { type: v } })} testId="bg-type" options={[{ value: "color", label: "Color" }, { value: "gradient", label: "Gradiente" }, { value: "image", label: "Imagen" }, { value: "fullimage", label: "Imagen completa" }, { value: "animated", label: "Animado" }]} />
        {["gradient", "animated"].includes(d.background.type) && (
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Segundo color" value={d.background.color2} onChange={(v) => updateDesign({ background: { color2: v } })} testId="color-bg2" />
            <SliderField label="Ángulo" value={d.background.angle} min={0} max={360} onChange={(v) => updateDesign({ background: { angle: v } })} testId="bg-angle" />
          </div>
        )}
        {["image", "fullimage"].includes(d.background.type) && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Usa el banner como imagen de fondo. Súbelo en Multimedia.</p>
            <SliderField label="Oscurecer (overlay)" value={d.background.overlay} onChange={(v) => updateDesign({ background: { overlay: v } })} testId="bg-overlay" />
            <SliderField label="Desenfoque" value={d.background.blur} max={30} onChange={(v) => updateDesign({ background: { blur: v } })} testId="bg-blur" />
            <SliderField label="Brillo" value={d.background.brightness} min={40} max={140} onChange={(v) => updateDesign({ background: { brightness: v } })} testId="bg-brightness" />
          </div>
        )}
      </Section>

      <Section title="Cabecera, avatar y banner" testId="section-avatar">
        <Choice label="Composición de la cabecera" value={d.layout.header || "classic"} onChange={(v) => updateDesign({ layout: { header: v } })} testId="header-mode" options={[{ value: "classic", label: "Clásica" }, { value: "hero", label: "Foto protagonista" }, { value: "portrait", label: "Retrato centrado" }, { value: "editorial", label: "Editorial" }]} />
        {d.layout.header === "hero" && (
          <div className="space-y-4" data-testid="hero-controls">
            <Choice label="Altura de la portada" value={d.hero.height} onChange={(v) => updateDesign({ hero: { height: v } })} testId="hero-height" options={[{ value: "md", label: "Media" }, { value: "lg", label: "Alta" }, { value: "xl", label: "Pantalla" }]} />
            <SliderField label="Degradado inferior" value={d.hero.fade} onChange={(v) => updateDesign({ hero: { fade: v } })} testId="hero-fade" />
            <ToggleRow label="Redes sobre la foto" desc="Fila de iconos debajo del nombre, dentro de la portada" checked={d.hero.social} onChange={(v) => updateDesign({ hero: { social: v } })} testId="toggle-hero-social" />
          </div>
        )}
        {(d.layout.header || "classic") !== "hero" && <>
        <Choice label="Forma del avatar" value={d.avatar.shape} onChange={(v) => updateDesign({ avatar: { shape: v } })} testId="avatar-shape" options={[{ value: "circle", label: "Circular" }, { value: "rounded", label: "Redondeado" }, { value: "bubble", label: "Burbuja" }]} />
        {(d.layout.header || "classic") === "classic" && <Choice label="Posición" value={d.avatar.position} onChange={(v) => updateDesign({ avatar: { position: v } })} testId="avatar-position" options={[{ value: "center", label: "Centro" }, { value: "left", label: "Izquierda" }, { value: "right", label: "Derecha" }, { value: "overlap", label: "Sobre banner" }, { value: "floating", label: "Flotante" }, { value: "inBanner", label: "Dentro del banner" }]} />}
        <SliderField label="Tamaño" value={d.avatar.size} min={56} max={160} step={4} onChange={(v) => updateDesign({ avatar: { size: v } })} testId="avatar-size" />
        </>}
        {(d.layout.header || "classic") === "classic" && <>
        <ToggleRow label="Banner" desc="Franja superior con imagen, color o gradiente" checked={d.banner.enabled} onChange={(v) => updateDesign({ banner: { enabled: v } })} testId="toggle-banner" />
        {d.banner.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Choice label="Estilo" value={d.banner.style} onChange={(v) => updateDesign({ banner: { style: v } })} testId="banner-style" options={[{ value: "image", label: "Imagen" }, { value: "color", label: "Color" }, { value: "gradient", label: "Gradiente" }]} />
            <Choice label="Altura" value={d.banner.height} onChange={(v) => updateDesign({ banner: { height: v } })} testId="banner-height" options={[{ value: "sm", label: "Baja" }, { value: "md", label: "Media" }, { value: "lg", label: "Alta" }]} />
          </div>
        )}
        </>}
      </Section>

      <Section title="Tipografía" testId="section-typography">
        <div className="grid grid-cols-6 gap-1.5" data-testid="font-family">
          {Object.keys(FONT_FAMILIES).map((f) => (
            <button key={f} type="button" onClick={() => updateDesign({ typography: { family: f } })} className={`rounded-xl border px-1 py-2 text-center transition-all ${d.typography.family === f ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`} data-testid={`font-${f}`}>
              <div className="text-lg leading-none" style={{ fontFamily: FONT_FAMILIES[f] }}>Aa</div><div className="text-[9px] text-muted-foreground mt-1">{FONT_LABELS[f]}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Choice label="Tamaño del título" value={d.typography.titleSize} onChange={(v) => updateDesign({ typography: { titleSize: v } })} testId="title-size" options={[{ value: 1, label: "S" }, { value: 2, label: "M" }, { value: 3, label: "L" }, { value: 4, label: "XL" }]} />
          <Choice label="Peso" value={d.typography.weight} onChange={(v) => updateDesign({ typography: { weight: v } })} testId="title-weight" options={[{ value: 500, label: "Normal" }, { value: 700, label: "Bold" }, { value: 800, label: "Black" }]} />
        </div>
        <SliderField label="Espaciado de letras" value={d.typography.letterSpacing} min={-1} max={4} step={0.5} onChange={(v) => updateDesign({ typography: { letterSpacing: v } })} testId="letter-spacing" />
      </Section>

      <Section title="Botones y redes" testId="section-buttons">
        <Choice label="Estilo de botones" value={d.buttons.style} onChange={(v) => updateDesign({ buttons: { style: v } })} testId="button-style" options={[{ value: "bubble", label: "Burbuja" }, { value: "glass", label: "Cristal" }, { value: "solid", label: "Sólido" }, { value: "outline", label: "Contorno" }, { value: "minimal", label: "Mínimo" }]} />
        <div className="grid grid-cols-2 gap-3">
          <SliderField label="Redondeo" value={d.buttons.radius} max={999} step={1} onChange={(v) => updateDesign({ buttons: { radius: v } })} testId="button-radius" />
          <Choice label="Tamaño" value={d.buttons.size} onChange={(v) => updateDesign({ buttons: { size: v } })} testId="button-size" options={[{ value: "sm", label: "S" }, { value: "md", label: "M" }, { value: "lg", label: "L" }]} />
        </div>
        <ToggleRow label="Botones apilados" desc="Enlaces destacados a todo el ancho, uno debajo de otro" checked={d.buttons.stack} onChange={(v) => updateDesign({ buttons: { stack: v } })} testId="toggle-button-stack" />
        <Choice label="Redes sociales" value={d.socialStyle} onChange={(v) => updateDesign({ socialStyle: v })} testId="social-style" options={[{ value: "icons", label: "Iconos" }, { value: "iconsNames", label: "Iconos + nombre" }, { value: "buttons", label: "Botones" }, { value: "bubbles", label: "Burbujas" }, { value: "bar", label: "Barra" }, { value: "outline", label: "Contorno" }, { value: "brand", label: "Colores de marca" }]} />
      </Section>

      <Section title="Distribución" defaultOpen={false} advanced testId="section-layout">
        <Choice label="Alineación" value={d.layout.align} onChange={(v) => updateDesign({ layout: { align: v } })} testId="layout-align" options={[{ value: "left", label: "Izquierda" }, { value: "center", label: "Centro" }]} />
        <Choice label="Espaciado" value={d.layout.spacing} onChange={(v) => updateDesign({ layout: { spacing: v } })} testId="layout-spacing" options={[{ value: "compact", label: "Compacto" }, { value: "medium", label: "Medio" }, { value: "airy", label: "Aireado" }]} />
        <SliderField label="Bordes de la tarjeta" value={d.layout.radius} max={48} onChange={(v) => updateDesign({ layout: { radius: v } })} testId="layout-radius" />
      </Section>
    </div>
  );
};

export default DesignPanel;
