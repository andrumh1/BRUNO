import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * BrunoLoader — pantalla de carga corporativa con el personaje BRUNO.
 *  · Alterna 3 poses (saludo, laptop, caminando) en cada carga.
 *  · Fondo alterno: tema (crema/gris) ↔ naranja corporativo.
 *  · Barra 0→~92% mientras carga; al desmontarse salta a 100% y se desvanece.
 *  Props: message, fullScreen (default true), className
 */
const POSES = [
  { id: "wave", src: "/brand/mascot-wave.webp", tone: "theme", hint: "¡Hola! Preparando todo…" },
  { id: "laptop", src: "/brand/mascot-laptop.webp", tone: "orange", hint: "Cargando tus datos…" },
  { id: "walk", src: "/brand/mascot-walk.webp", tone: "theme", hint: "Ya casi llegamos…" },
];

const PHRASES = [
  "Sacudiendo la cola de emoción…", "Olfateando las novedades…", "Afinando las gafas del futuro…", "Cargando con cuatro patas…",
  "Buscando el hueso de los datos…", "Peinando el pelaje digital…", "¡Guau! Esto va a estar bueno…", "Trayendo tus reels en la boca…",
  "Calentando las zapatillas…", "Un momento, estoy tecleando con las patas…", "Conectando con la manada…", "Preparando el mejor plan…",
  "Persiguiendo los últimos bytes…", "Moviendo las orejas para escuchar mejor…", "¡Ya casi! Solo un ladrido más…",
];
const SECTION_PHRASES = [
  [/^\/chat/, ["Afinando el oído para tus mensajes…", "Buscando a la manada en el chat…", "Ordenando las conversaciones con la pata…", "¡Guau! Alguien te escribió…"]],
  [/^\/(marketplace|store|cart|premium|product)/, ["Olfateando las mejores ofertas…", "Sacando brillo a los PIUP…", "Revisando el escaparate…", "Contando monedas con las patas…"]],
  [/^\/map/, ["Marcando territorio en el mapa…", "Siguiendo el rastro de tus contactos…", "Desplegando el mapa con el hocico…", "¿Quién anda cerca? Ya lo huelo…"]],
  [/^\/(reels|feed|lives|sound)/, ["Trayendo tus reels en la boca…", "Rebobinando con la cola…", "Buscando el video más guau…", "Encendiendo la cámara de las gafas…"]],
  [/^\/(my-profile|profile|dashboard|edit-profile)/, ["Peinando tu perfil…", "Sacando la mejor foto…", "Contando tus seguidores con las patas…", "Puliendo tu tarjeta de presentación…"]],
  [/^\/(c\/|cards|nfc|transfer|qr)/, ["Acercando la tarjeta al hocico…", "Programando el chip con las patas…", "Preparando tu tarjeta BRUNO…", "Cargando tu tarjeta para presumirla…"]],
  [/^\/(notifications)/, ["Escuchando las alertas con las orejas…", "Revisando quién te ladró…", "Ordenando las novedades…"]],
  [/^\/(settings)/, ["Ajustando las gafas…", "Girando los tornillos de la configuración…", "Personalizando tu BRUNO…"]],
];
const phrasesFor = (path) => { for (const [re, list] of SECTION_PHRASES) if (re.test(path)) return list; return PHRASES; };
const PKEY = "bruno_loader_phrase";
export const greetingByHour = (h = new Date().getHours()) => (h >= 5 && h < 12 ? "¡Buenos días!" : h >= 12 && h < 19 ? "¡Buenas tardes!" : "¡Buenas noches!");
function nextPhrase() {
  const list = phrasesFor(typeof window !== "undefined" ? window.location.pathname : "/");
  let last = ""; try { last = sessionStorage.getItem(PKEY) || ""; } catch { /* ignore */ }
  let i = Math.floor(Math.random() * list.length);
  if (list[i] === last) i = (i + 1) % list.length;
  try { sessionStorage.setItem(PKEY, list[i]); } catch { /* ignore */ }
  return list[i];
}

const KEY = "bruno_loader_pose";
export const POSE_PREF_KEY = "bruno_loader_pose_pref";
export const POSE_OPTIONS = [{ id: "auto", label: "Alternar" }, ...POSES.map((p) => ({ id: p.id, label: p.id === "wave" ? "Saludo" : p.id === "laptop" ? "Laptop" : "Caminando", src: p.src }))];
function nextPose() {
  try { const pref = localStorage.getItem(POSE_PREF_KEY); const fixed = POSES.find((p) => p.id === pref); if (fixed) return fixed; } catch { /* ignore */ }
  let i = 0;
  try { i = Number(sessionStorage.getItem(KEY) || 0) % POSES.length; sessionStorage.setItem(KEY, String(i + 1)); } catch { /* ignore */ }
  return POSES[i];
}

/* Al desmontar clonamos el nodo para mostrar el 100% y un fade-out sin bloquear el render de la página. */
function finish(node) {
  if (!node || typeof document === "undefined") return;
  const ghost = node.cloneNode(true);
  ghost.setAttribute("data-testid", "bruno-loader-finish");
  ghost.style.position = "fixed"; ghost.style.inset = "0"; ghost.style.zIndex = "99999"; ghost.style.pointerEvents = "none";
  ghost.style.transition = "opacity .32s ease .18s"; ghost.style.opacity = "1";
  document.body.appendChild(ghost);
  requestAnimationFrame(() => {
    const bar = ghost.querySelector("[data-bar]"); const pct = ghost.querySelector("[data-pct]");
    if (bar) { bar.style.transition = "width .22s ease-out"; bar.style.width = "100%"; }
    if (pct) pct.textContent = "100%";
    requestAnimationFrame(() => { ghost.style.opacity = "0"; });
  });
  setTimeout(() => ghost.remove(), 620);
}

export default function BrunoLoader({ message, fullScreen = true, className = "" }) {
  const [pose] = useState(nextPose);
  const [phrase] = useState(nextPhrase);
  const [pct, setPct] = useState(0);
  const rootRef = useRef(null);

  useEffect(() => {
    const start = performance.now(); let raf;
    const tick = (t) => { const s = (t - start) / 1000; setPct(Math.min(92, 92 * (1 - Math.exp(-s / 1.1)))); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const node = rootRef.current;
    return () => { cancelAnimationFrame(raf); if (fullScreen) finish(node); };
  }, [fullScreen]);

  const orange = pose.tone === "orange";
  const shell = orange ? "bg-[#ff6a00] text-white" : "bg-background text-foreground";
  const track = orange ? "bg-white/25" : "bg-foreground/10";
  const fill = orange ? "bg-white" : "bg-primary";
  const sub = orange ? "text-white/80" : "text-muted-foreground";
  const glow = orange ? "bg-white/20" : "bg-primary/15";

  const content = (
    <div
      ref={rootRef}
      className={`${fullScreen ? "fixed inset-0 z-[10000]" : "relative w-full h-full min-h-[320px]"} ${shell} flex flex-col items-center justify-center overflow-hidden select-none ${className}`}
      data-testid="bruno-loader" data-pose={pose.id} data-tone={pose.tone} role="status" aria-live="polite" aria-label={message || "Cargando"}
    >
      <span className={`absolute w-[70vmin] h-[70vmin] max-w-[420px] max-h-[420px] rounded-full ${glow} blur-3xl`} />
      <div className="relative flex flex-col items-center px-8 w-full max-w-xs">
        <img src={pose.src} alt="" draggable={false} className="h-44 sm:h-52 w-auto object-contain bubble-float drop-shadow-[0_18px_28px_rgba(71,71,71,0.28)]" data-testid="bruno-loader-mascot" />
        <div className={`relative mt-3 max-w-[260px] rounded-2xl px-4 py-2 text-center text-[13px] font-semibold leading-snug ${orange ? "bg-white/15 text-white" : "bg-card text-foreground border border-border/60"} shadow-sm`} data-testid="bruno-loader-phrase">
          <span className={`absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 ${orange ? "bg-white/15" : "bg-card border-l border-t border-border/60"}`} />
          <span className="block text-[11px] uppercase tracking-[0.14em] opacity-80 mb-0.5" data-testid="bruno-loader-greeting">{greetingByHour()}</span>
          {phrase}
        </div>
        <img src={orange ? "/brand/logo-h-white.png" : "/brand/logo-h-orange.png"} alt="BRUNO" draggable={false} className="h-5 mt-4 opacity-90" />
        <div className="w-full mt-6" data-testid="bruno-loader-progress">
          <div className={`h-2 w-full rounded-full ${track} overflow-hidden`}>
            <div data-bar className={`h-full rounded-full ${fill} transition-[width] duration-150 ease-out`} style={{ width: `${pct}%` }} />
          </div>
          <div className={`flex items-center justify-between mt-2 text-[11px] font-semibold tracking-wide ${sub}`}>
            <span data-testid="bruno-loader-message">{message || pose.hint}</span>
            <span data-pct data-testid="bruno-loader-pct">{Math.round(pct)}%</span>
          </div>
        </div>
      </div>
    </div>
  );

  return fullScreen && typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
