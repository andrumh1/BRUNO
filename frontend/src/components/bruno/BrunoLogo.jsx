import React from "react";

/**
 * BrunoLogo — marca corporativa recoloreable.
 *  variant: "icon" (oso) | "wordmark" (BRUNO horizontal) | "stacked" (oso + BRUNO)
 *  tone:    "orange" | "gray" | "white" | "cream" | "current" (usa currentColor via máscara CSS)
 */
const FILES = {
  icon: { orange: "/brand/icon-orange.png", gray: "/brand/icon-gray.png", white: "/brand/icon-white.png", cream: "/brand/icon-cream.png" },
  wordmark: { orange: "/brand/logo-h-orange.png", gray: "/brand/logo-h-gray.png", white: "/brand/logo-h-white.png", cream: "/brand/logo-h-white.png" },
  stacked: { orange: "/brand/logo-v-orange.png", gray: "/brand/logo-v-gray.png", white: "/brand/logo-v-white.png", cream: "/brand/logo-v-white.png" },
};

export default function BrunoLogo({ variant = "icon", tone = "orange", className = "", alt = "BRUNO", ...rest }) {
  if (tone === "current") {
    const cls = variant === "icon" ? "bruno-mark" : "bruno-wordmark";
    return <span role="img" aria-label={alt} className={`${cls} ${className}`} {...rest} />;
  }
  const src = FILES[variant]?.[tone] || FILES.icon.orange;
  return <img src={src} alt={alt} draggable={false} className={`select-none object-contain ${className}`} {...rest} />;
}

/** Icono del oso para cabeceras: pequeño, naranja, con micro-animación al hover. */
export const BrunoHeaderMark = ({ className = "" }) => (
  <BrunoLogo
    variant="icon"
    tone="orange"
    className={`h-6 w-auto shrink-0 transition-transform duration-300 hover:-rotate-6 hover:scale-110 ${className}`}
    data-testid="brand-header-mark"
  />
);
