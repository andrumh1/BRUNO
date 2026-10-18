// Carga tipografías de Google solo cuando hace falta (tarjetas / estilos de texto), no en el arranque.
const LOADED = new Set();
const FAMILIES = {
  cards: "family=Playfair+Display:wght@400;600;700&family=Bebas+Neue&family=Manrope:wght@400;600;700;800&family=DM+Sans:wght@400;500;600;700&family=Outfit:wght@400;600;700&family=IBM+Plex+Sans:wght@400;500;600;700",
  text: "family=Playfair+Display:wght@400;600;700&family=Bebas+Neue&family=Caveat:wght@700&family=Space+Mono:wght@700",
};

export function ensureFonts(group) {
  if (typeof document === "undefined" || LOADED.has(group) || !FAMILIES[group]) return;
  LOADED.add(group);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${FAMILIES[group]}&display=swap`;
  link.setAttribute("data-bruno-fonts", group);
  document.head.appendChild(link);
}

export const ensureCardFonts = () => ensureFonts("cards");
export const ensureTextStyleFonts = () => ensureFonts("text");
