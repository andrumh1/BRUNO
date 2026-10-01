// BRUNO Card Design System v2 — single source of truth for defaults, presets and style helpers.
export const DESIGN_VERSION = 2;

export const DEFAULT_DESIGN = {
  version: DESIGN_VERSION,
  preset: "custom",
  layout: { align: "left", spacing: "medium", radius: 24 },
  background: { type: "color", color: "#F9F1EA", color2: "#FF6A00", angle: 135, imageUrl: null, overlay: 45, blur: 0, brightness: 100 },
  colors: { text: "#474747", accent: "#FF6A00" },
  typography: { family: "modern", titleSize: 2, weight: 700, letterSpacing: 0 },
  banner: { enabled: true, height: "md", style: "image" },
  avatar: { enabled: true, shape: "rounded", position: "overlap", size: 96 },
  buttons: { style: "solid", radius: 16, size: "md" },
  socialStyle: "icons",
  glass: { enabled: false, opacity: 50, blur: 40 },
  effects: { depth: "soft", glow: false, reflection: true },
  animations: { enabled: false },
  components: { banner: true, avatar: true, bio: true, contact: true, social: true, gallery: true, location: true, typeFields: true, qr: false, cta: false },
  componentOrder: ["bio", "contact", "social", "gallery", "location", "typeFields", "qr", "cta"],
  cta: { label: "", url: "" },
};

export const PRESETS = [
  { id: "custom", name: "Personalizado", desc: "Empieza desde cero", patch: {} },
  { id: "classic", name: "Clásico", desc: "Avatar centrado y limpio", patch: { layout: { align: "center" }, banner: { enabled: false }, avatar: { shape: "circle", position: "center", size: 112 }, buttons: { style: "solid", radius: 999 } } },
  { id: "minimal", name: "Minimalista", desc: "Aire, poco ruido", patch: { layout: { align: "left", spacing: "airy", radius: 16 }, banner: { enabled: false }, avatar: { shape: "circle", position: "left", size: 72 }, typography: { family: "minimal", titleSize: 1, weight: 600 }, buttons: { style: "minimal", radius: 12, size: "sm" }, socialStyle: "icons", effects: { depth: "flat", reflection: false } } },
  { id: "modern", name: "Moderno", desc: "Banner + avatar flotante", patch: { banner: { enabled: true, height: "md" }, avatar: { shape: "rounded", position: "overlap", size: 96 }, typography: { family: "modern" }, buttons: { style: "solid", radius: 16 }, effects: { depth: "soft" } } },
  { id: "glass", name: "Cristal", desc: "Bubble Glass BRUNO", patch: { background: { type: "gradient", color: "#FF6A00", color2: "#474747", angle: 135 }, colors: { text: "#FFFFFF" }, avatar: { shape: "circle", position: "overlap", size: 96 }, buttons: { style: "bubble", radius: 999 }, socialStyle: "bubbles", glass: { enabled: true, opacity: 75, blur: 70 }, effects: { depth: "floating", reflection: true, glow: true } } },
  { id: "formal", name: "Formal", desc: "Sobrio y empresarial", patch: { layout: { align: "left", spacing: "medium", radius: 12 }, background: { type: "color", color: "#FFFFFF" }, colors: { text: "#2B2B2B", accent: "#B8860B" }, typography: { family: "elegant", titleSize: 2, weight: 600, letterSpacing: 0.5 }, banner: { enabled: true, height: "sm", style: "color" }, avatar: { shape: "rounded", position: "left", size: 88 }, buttons: { style: "outline", radius: 8 }, socialStyle: "iconsNames", effects: { depth: "flat", reflection: false } } },
  { id: "photo", name: "Foto", desc: "Imagen a pantalla completa", patch: { background: { type: "fullimage", overlay: 55 }, colors: { text: "#FFFFFF" }, banner: { enabled: false }, avatar: { shape: "circle", position: "center", size: 104 }, layout: { align: "center" }, buttons: { style: "glass", radius: 999 }, glass: { enabled: true, opacity: 70, blur: 50 }, effects: { depth: "deep" } } },
  { id: "animated", name: "Animado", desc: "Gradiente vivo y suave", patch: { background: { type: "animated", color: "#FF6A00", color2: "#7C3AED", angle: 135 }, colors: { text: "#FFFFFF" }, banner: { enabled: false }, avatar: { shape: "bubble", position: "center", size: 104 }, layout: { align: "center" }, buttons: { style: "glass", radius: 999 }, glass: { enabled: true, opacity: 65, blur: 40 }, animations: { enabled: true }, effects: { depth: "floating", glow: true } } },
];

export const FONT_FAMILIES = {
  modern: "'Manrope', 'Inter', sans-serif",
  minimal: "'DM Sans', 'Inter', sans-serif",
  elegant: "'Playfair Display', Georgia, serif",
  corporate: "'IBM Plex Sans', 'Inter', sans-serif",
  creative: "'Outfit', 'Inter', sans-serif",
};
export const FONT_LABELS = { modern: "Moderna", minimal: "Minimal", elegant: "Elegante", corporate: "Corporativa", creative: "Creativa" };

export const SAMPLE_DATA = {
  title: "Andrea Ruiz", subtitle: "Diseñadora de marca", description: "Creo identidades que se recuerdan. Hablemos de tu próximo proyecto.",
  avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&q=60",
  banner_url: "https://images.unsplash.com/photo-1557683316-973673baf926?w=900&q=60",
  contact_info: { phone: "+34 600 000 000", email: "hola@andrea.co", whatsapp: "+34600000000", website: "andrea.co" },
  social_links: [{ type: "instagram", url: "#", label: "Instagram" }, { type: "linkedin", url: "#", label: "LinkedIn" }, { type: "tiktok", url: "#", label: "TikTok" }],
  gallery_photos: [], card_type: "personal",
};

export const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export const deepMerge = (base, patch) => {
  const out = { ...base };
  Object.entries(patch || {}).forEach(([k, v]) => { out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v; });
  return out;
};

export const applyPreset = (design, presetId) => {
  const p = PRESETS.find((x) => x.id === presetId) || PRESETS[0];
  return deepMerge(deepMerge(DEFAULT_DESIGN, p.patch), { preset: p.id, components: design.components, componentOrder: design.componentOrder, cta: design.cta });
};

const LEGACY = [["premium_glass", "glass"], ["modern_glass", "glass"], ["glass", "glass"], ["fullimg", "photo"], ["animated", "animated"], ["premium_formal", "formal"], ["elegant", "formal"], ["formal", "formal"], ["full_banner_bubble", "modern"], ["edge_actions", "modern"], ["minimal", "minimal"], ["friend", "minimal"], ["clean", "minimal"], ["modern", "modern"], ["pro", "modern"], ["showcase", "modern"], ["tour", "modern"], ["bold", "modern"], ["promo", "modern"], ["gallery", "modern"], ["portfolio", "modern"], ["blocks", "modern"], ["classic", "classic"], ["default", "classic"]];

export const designFromLegacy = (card = {}) => {
  const template = (card.template_id || "default").toLowerCase();
  const preset = (LEGACY.find(([k]) => template.includes(k)) || [null, "modern"])[1];
  let d = applyPreset(DEFAULT_DESIGN, preset);
  if (card.background_color && preset !== "photo") {
    d.background.color = card.background_color;
    if (!["#FFFFFF", "#F9F1EA"].includes(card.background_color.toUpperCase())) d.colors.accent = card.background_color;
  }
  if (card.text_color && !["photo", "animated", "glass"].includes(preset)) d.colors.text = card.text_color;
  if (template === "full_banner_bubble") d = deepMerge(d, { banner: { enabled: true, height: "lg" }, avatar: { position: "inBanner" }, glass: { enabled: true, opacity: 40, blur: 50 } });
  if (template === "edge_actions") d.components.qr = true;
  if (!card.banner_url) { d.banner.enabled = d.banner.enabled && ["modern", "formal"].includes(preset); if (d.banner.enabled) d.banner.style = "gradient"; }
  return d;
};

export const resolveDesign = (card) => deepMerge(DEFAULT_DESIGN, card?.card_design?.version ? card.card_design : designFromLegacy(card));

// ─── colour helpers ───────────────────────────────────────────────────
export const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return `rgba(0,0,0,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
export const luminance = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
export const contrastText = (hex) => (luminance(hex) > 0.6 ? "#474747" : "#FFFFFF");

const SHADOWS = { flat: "none", soft: "0 8px 24px -12px rgba(0,0,0,0.25)", deep: "0 18px 40px -14px rgba(0,0,0,0.45)", floating: "0 24px 60px -18px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.08)" };
export const depthShadow = (design) => SHADOWS[design.effects?.depth] || SHADOWS.soft;
export const spacingPx = (design) => ({ compact: 12, medium: 20, airy: 32 }[design.layout?.spacing] || 20);

// Bubble Glass surface: gradient + border highlight + inner light + depth. Not a flat rgba blur.
export const surfaceStyle = (design, { strong = false } = {}) => {
  const t = design.colors.text;
  const light = luminance(t) > 0.6; // light text → dark background → white glass
  const base = light ? "255,255,255" : "0,0,0";
  if (!design.glass.enabled) {
    return { backgroundColor: rgba(t, strong ? 0.12 : 0.07), border: `1px solid ${rgba(t, 0.1)}`, boxShadow: design.effects.depth === "flat" ? "none" : "0 4px 14px -8px rgba(0,0,0,0.18)" };
  }
  const a = 1 - design.glass.opacity / 100; // 0 = crystal, 1 = solid
  const blur = Math.round((design.glass.blur / 100) * 36);
  const top = (light ? 0.45 : 0.22) * a + (light ? 0.1 : 0.04);
  const mid = (light ? 0.14 : 0.06) * a + 0.02;
  return {
    background: `linear-gradient(145deg, rgba(${base},${top}) 0%, rgba(${base},${mid}) 45%, rgba(${base},${mid * 0.5}) 100%)`,
    backdropFilter: `blur(${blur}px) saturate(1.35)`, WebkitBackdropFilter: `blur(${blur}px) saturate(1.35)`,
    border: `1px solid rgba(${base},${0.12 + 0.3 * a})`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,${light ? 0.35 + 0.35 * a : 0.08}), inset 0 -1px 0 rgba(0,0,0,0.06), ${depthShadow(design)}${design.effects.glow ? `, 0 0 32px -6px ${rgba(design.colors.accent, 0.45)}` : ""}`,
  };
};

export const buttonStyle = (design, { primary = false } = {}) => {
  const { buttons, colors } = design; const t = colors.text; const acc = colors.accent;
  const radius = `${buttons.radius}px`;
  const common = { borderRadius: radius, color: t, transition: "transform .18s ease, box-shadow .18s ease, background-color .18s ease" };
  switch (buttons.style) {
    case "solid": return { ...common, backgroundColor: primary ? acc : rgba(t, 0.14), color: primary ? contrastText(acc) : t, boxShadow: design.effects.depth === "flat" ? "none" : "0 6px 16px -8px rgba(0,0,0,0.3)" };
    case "outline": return { ...common, backgroundColor: "transparent", border: `1.5px solid ${primary ? acc : rgba(t, 0.45)}`, color: primary ? acc : t };
    case "minimal": return { ...common, backgroundColor: "transparent", color: primary ? acc : t };
    case "glass": return { ...common, ...surfaceStyle({ ...design, glass: { ...design.glass, enabled: true } }, { strong: true }) };
    case "bubble": default: return { ...common, ...surfaceStyle({ ...design, glass: { ...design.glass, enabled: true } }, { strong: true }), borderRadius: "999px", boxShadow: `${surfaceStyle({ ...design, glass: { ...design.glass, enabled: true } }).boxShadow}` };
  }
};

export const buttonSizeClass = (design) => ({ sm: "h-9 px-3 text-xs gap-1.5", md: "h-11 px-4 text-sm gap-2", lg: "h-13 px-5 text-base gap-2.5" }[design.buttons.size] || "h-11 px-4 text-sm gap-2");

export const cardTypeLabel = (type) => ({ personal: "Personal", empresarial: "Empresarial", negocio: "Negocio", servicios: "Servicios", lugares: "Lugar", guardian: "Guardian", curriculum: "CV", mascotas: "Mascota", oferta_trabajo: "Oferta de trabajo", busqueda_personal: "Búsqueda de personal", solicitud_servicio: "Solicitud de servicio" }[type] || type || "");

export const CARD_TYPES = [
  { value: "personal", label: "Personal" }, { value: "empresarial", label: "Empresarial" }, { value: "negocio", label: "Negocio" }, { value: "servicios", label: "Servicios" },
  { value: "lugares", label: "Lugares" }, { value: "guardian", label: "Guardian" }, { value: "curriculum", label: "Currículum" }, { value: "mascotas", label: "Mascotas" },
  { value: "oferta_trabajo", label: "Oferta de trabajo" }, { value: "busqueda_personal", label: "Búsqueda de personal" }, { value: "solicitud_servicio", label: "Solicitud de servicio" },
];

export const EMPTY_CUSTOM_FIELDS = {
  experience: [], education: [], skills: [], languages: [], certifications: [], documents: [], references: [],
  job_details: { salary_min: "", salary_max: "", salary_currency: "USD", contract_type: "", remote_option: "", experience_required: "", vacancies: 1, urgency: "normal", benefits: [], requirements: [], application_deadline: "" },
};
