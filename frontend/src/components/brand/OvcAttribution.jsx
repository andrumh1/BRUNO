/* Identidad OVC (Octopus Vision Company), empresa detrás de BRUNO.
 * Logos oficiales en /public/brand/ovc/: ovc-wordmark-red.png (principal, fondos claros), ovc-wordmark-white.png (modo oscuro),
 * ovc-icon-red.png / ovc-icon-white.png (isotipo calavera-pulpo), ovc-wordmark-blue.png (variante alterna, no usada por defecto). */
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import LanguageContext from "@/contexts/LanguageContext";

const TEXT = {
  es: { by: "una aplicación de", company: "OCTOPUS VISION COMPANY", rights: "Todos los derechos reservados.", legal: "Legal" },
  en: { by: "an application by", company: "OCTOPUS VISION COMPANY", rights: "All rights reserved.", legal: "Legal" },
  pt: { by: "um aplicativo de", company: "OCTOPUS VISION COMPANY", rights: "Todos os direitos reservados.", legal: "Legal" },
  fr: { by: "une application de", company: "OCTOPUS VISION COMPANY", rights: "Tous droits réservés.", legal: "Mentions légales" },
  it: { by: "un'applicazione di", company: "OCTOPUS VISION COMPANY", rights: "Tutti i diritti riservati.", legal: "Note legali" },
};

const useOvcText = () => {
  const ctx = useContext(LanguageContext);
  return TEXT[ctx?.language] || TEXT.es;
};

/** Isotipo OVC (rojo en claro, blanco en oscuro). */
export const OvcMark = ({ size = 28, className = "" }) => (
  <span aria-hidden className={`inline-block shrink-0 ${className}`} style={{ width: size, height: size }}>
    <img src="/brand/ovc/ovc-icon-red.png" alt="" className="h-full w-full object-contain dark:hidden" draggable={false} />
    <img src="/brand/ovc/ovc-icon-white.png" alt="" className="hidden h-full w-full object-contain dark:block" draggable={false} />
  </span>
);

/** Logotipo "OVC." (rojo en claro, blanco en oscuro). */
export const OvcWordmark = ({ height = 22, className = "" }) => (
  <span className={`inline-block shrink-0 ${className}`} style={{ height }} data-testid="ovc-wordmark">
    <img src="/brand/ovc/ovc-wordmark-red.png" alt="OVC" className="h-full w-auto object-contain dark:hidden" draggable={false} />
    <img src="/brand/ovc/ovc-wordmark-white.png" alt="OVC" className="hidden h-full w-auto object-contain dark:block" draggable={false} />
  </span>
);

/**
 * Atribución "BRUNO, una aplicación de OCTOPUS VISION COMPANY (OVC)".
 * variant: "footer" (login/registro, centrado) | "inline" (cabeceras compactas) | "legal" (pie de páginas legales).
 */
export const OvcAttribution = ({ variant = "footer", className = "" }) => {
  const t = useOvcText();
  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[11px] text-muted-foreground ${className}`} data-testid="ovc-attribution-inline">
        <span className="uppercase tracking-wide">{t.by}</span>
        <OvcWordmark height={14} />
      </span>
    );
  }
  if (variant === "legal") {
    return (
      <div className={`flex flex-col items-center gap-3 text-center text-xs text-muted-foreground ${className}`} data-testid="ovc-attribution-legal">
        <OvcWordmark height={30} />
        <p>BRUNO™ · {t.by} {t.company} (OVC). © {new Date().getFullYear()} {t.rights}</p>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center gap-2 text-center ${className}`} data-testid="ovc-attribution">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">BRUNO · {t.by}</p>
      <OvcWordmark height={34} />
      <p className="text-[10px] font-semibold tracking-[0.16em] text-foreground/70">{t.company}</p>
      <Link to="/legal" className="text-[11px] text-muted-foreground hover:text-primary underline-offset-4 hover:underline" data-testid="ovc-legal-link">
        {t.legal}
      </Link>
    </div>
  );
};

export default OvcAttribution;
