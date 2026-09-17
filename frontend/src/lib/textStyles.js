export const TEXT_BGS = [
  { id: "ember", label: "Ámbar", a: "#FF5A00", b: "#7A1E00" },
  { id: "midnight", label: "Medianoche", a: "#1E3A8A", b: "#0B1120" },
  { id: "forest", label: "Bosque", a: "#065F46", b: "#022C22" },
  { id: "plum", label: "Ciruela", a: "#4C1D95", b: "#1E0B3B" },
  { id: "rose", label: "Rosa", a: "#9D174D", b: "#3B0716" },
  { id: "teal", label: "Turquesa", a: "#0F766E", b: "#042F2E" },
  { id: "sand", label: "Arena", a: "#B45309", b: "#3B1A00" },
  { id: "ink", label: "Tinta", a: "#27272A", b: "#09090B" },
];

export const TEXT_FONTS = [
  { id: "sans", label: "Moderna", family: "'Inter', system-ui, sans-serif", weight: 800 },
  { id: "serif", label: "Editorial", family: "'Playfair Display', Georgia, serif", weight: 700 },
  { id: "display", label: "Impacto", family: "'Bebas Neue', Impact, sans-serif", weight: 400, tracking: "0.04em" },
  { id: "hand", label: "Manuscrita", family: "'Caveat', cursive", weight: 700 },
  { id: "mono", label: "Máquina", family: "'Space Mono', monospace", weight: 700 },
];

export const bgById = (id) => TEXT_BGS.find((b) => b.id === id) || null;
export const fontById = (id) => TEXT_FONTS.find((f) => f.id === id) || TEXT_FONTS[0];
export const bgGradient = ({ a, b }) => `radial-gradient(120% 90% at 20% 10%, ${a} 0%, ${b} 70%)`;
