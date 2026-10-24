import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

/* Ruta única del servicio: la plantilla aprobada se sirve tal cual desde public/servicios/tarjeta-bruno/ (web, móvil y Capacitor). */
export const SERVICE_PATH = "/servicios/tarjeta-bruno/index.html";

export function serviceLang() {
  try { const v = localStorage.getItem("bruno-service-language"); if (v === "en" || v === "es") return v; } catch { /* ignore */ }
  return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es";
}

export function openService(from) {
  const back = from || (window.location.pathname + window.location.search);
  window.location.assign(`${SERVICE_PATH}?from=${encodeURIComponent(back)}`);
}

/** Burbuja promocional (estilo del paquete OVC). variant="icon" → Perfil › Tarjetas; variant="banner" → /website. */
export function ServicePromoBubble({ variant = "icon", from, className = "" }) {
  const en = serviceLang() === "en";
  const label = variant === "icon" ? (en ? "We create your card" : "Creamos tu tarjeta") : (en ? "Your world, in one card. We create it for you." : "Tu mundo, en una tarjeta. La creamos por ti.");
  const aria = variant === "icon" ? (en ? "We create your card" : "Creamos tu tarjeta") : (en ? "BRUNO card creation service" : "Servicio de creación de tarjetas BRUNO");
  return (
    <a
      href={SERVICE_PATH}
      onClick={(e) => { e.preventDefault(); openService(from); }}
      aria-label={aria}
      title={aria}
      className={`bruno-service-promo ${variant === "icon" ? "bruno-service-promo--icon" : ""} ${className}`}
      data-testid={`service-promo-${variant}`}
    >
      <span aria-hidden="true">✨</span>
      <span className={variant === "icon" ? "bruno-service-promo__text" : ""}>{label}</span>
    </a>
  );
}

/** /servicios/tarjeta-bruno (sin index.html) → la plantilla estática, conservando ?from. */
export default function ServiceRedirect() {
  const { search } = useLocation();
  useEffect(() => { window.location.replace(`${SERVICE_PATH}${search || ""}`); }, [search]);
  return null;
}
