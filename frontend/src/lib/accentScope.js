// Acento con alcance local (p. ej. la página de una tarjeta) a partir de un color hex, sin tocar el acento global.
function hexToHsl(hex) {
  const m = String(hex || "").trim().replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(m)) return null;
  const r = parseInt(m.slice(0, 2), 16) / 255, g = parseInt(m.slice(2, 4), 16) / 255, b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round(h * 60), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)).join(" ");
}

const STOPS = { 50: 96, 100: 92, 200: 84, 300: 72, 400: 61, 600: 44, 700: 37, 800: 30, 900: 24, 950: 14 };

// Devuelve variables CSS (--primary, --ring, --accent, --ac-*) para aplicar en un contenedor.
export function accentStyleFromHex(hex, isDark = false) {
  const hsl = hexToHsl(hex);
  if (!hsl) return {};
  const { h, s } = hsl;
  const l = Math.min(62, Math.max(38, hsl.l));
  const fg = l > 58 || (h >= 40 && h <= 70 && s > 60) ? "30 40% 12%" : "0 0% 100%";
  const style = {
    "--ac-h": h, "--ac-s": `${s}%`, "--ac-l": `${l}%`,
    "--primary": `${h} ${s}% ${l}%`, "--primary-foreground": fg, "--ring": `${h} ${s}% ${l}%`,
    "--accent": isDark ? `${h} ${Math.round(s * 0.7)}% 30%` : `${h} ${Math.round(s * 0.9)}% 94%`,
    "--accent-foreground": isDark ? "0 0% 96%" : `${h} ${s}% 30%`,
    "--ac-500": hslToRgb(h, s, l),
  };
  for (const [stop, L] of Object.entries(STOPS)) style[`--ac-${stop}`] = hslToRgb(h, Number(stop) >= 400 ? s : Math.max(55, s - 10), L);
  return style;
}
