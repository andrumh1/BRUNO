/* Identidad OVC (Octopus Vision Company), empresa detrás de BRUNO.
 * Logotipo provisional tipográfico en mayúsculas; cuando llegue el logo oficial, reemplaza el bloque <OvcMark/> por
 * <img src="/brand/ovc/logo.svg" .../> sin tocar los textos ni los lugares donde se usa. */
import React from "react";
import { Link } from "react-router-dom";
import LanguageContext from "@/contexts/LanguageContext";
import { useContext } from "react";

const TEXT = {
  es: { by: "una aplicación de", company: "OCTOPUS VISION COMPANY", rights: "Todos los derechos reservados.", legal: "Legal" },
  en: { by: "an application by", company: "OCTOPUS VISION COMPANY", rights: "All rights reserved.", legal: "Legal" },
  pt: { by: "um aplicativo de", company: "OCTOPUS VISION COMPANY", rights: "Todos os direitos reservados.", legal: "Legal" },
  fr: { by: "une application de", company: "OCTOPUS VISION COMPANY", rights: "Tous droits réservés.", legal: "Mentions légales" },
};

const useOvcText = () => {
  const ctx = useContext(LanguageContext);
  return TEXT[ctx?.language] || TEXT.es;
};

/** Monograma OVC: cuadrado gris carbón con letras en mayúsculas. */
export const OvcMark = ({ size = 28, className = "" }) => (
  <span
    aria-hidden
    className={`inline-grid shrink-0 place-items-center rounded-md bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 font-black tracking-tighter ${className}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.42), lineHeight: 1 }}
  >
    OVC
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
        <OvcMark size={16} />
        <span className="uppercase tracking-wide">{t.by} <strong className="font-bold text-foreground/80">OVC</strong></span>
      </span>
    );
  }
  if (variant === "legal") {
    return (
      <div className={`flex flex-col items-center gap-2 text-center text-xs text-muted-foreground ${className}`} data-testid="ovc-attribution-legal">
        <div className="flex items-center gap-2">
          <OvcMark size={22} />
          <span className="font-semibold tracking-wide text-foreground/80">{t.company} (OVC)</span>
        </div>
        <p>BRUNO™ · {t.by} {t.company} (OVC). © {new Date().getFullYear()} {t.rights}</p>
      </div>
    );
  }
  return (
    <div className={`flex flex-col items-center gap-1.5 text-center ${className}`} data-testid="ovc-attribution">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">BRUNO · {t.by}</p>
      <div className="flex items-center gap-2">
        <OvcMark size={24} />
        <span className="text-xs font-bold tracking-[0.14em] text-foreground/85">{t.company}</span>
      </div>
      <Link to="/legal" className="text-[11px] text-muted-foreground hover:text-primary underline-offset-4 hover:underline" data-testid="ovc-legal-link">
        {t.legal}
      </Link>
    </div>
  );
};

export default OvcAttribution;
