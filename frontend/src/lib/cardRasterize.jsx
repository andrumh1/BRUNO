import React from "react";
import { createRoot } from "react-dom/client";
import { toCanvas } from "html-to-image";
import CardRenderer from "@/components/cards/CardRenderer";

const settled = (host) => Promise.all([...host.querySelectorAll("img")].map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));

// Rasteriza la tarjeta REAL (CardRenderer) fuera de pantalla → canvas. WYSIWYG para imágenes de redes.
export async function rasterizeCard(card, design, { width = 900, pixelRatio = 1 } = {}) {
  const host = document.createElement("div");
  Object.assign(host.style, { position: "fixed", left: "-20000px", top: "0", width: `${width}px`, pointerEvents: "none", zIndex: "-1" });
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise((r) => { root.render(<CardRenderer data={card} design={design} seal={false} />); requestAnimationFrame(() => requestAnimationFrame(r)); });
    await Promise.all([document.fonts?.ready, settled(host)]);
    const node = host.firstElementChild;
    return await toCanvas(node, { pixelRatio, cacheBust: true, width, height: node.offsetHeight, style: { animation: "none" } });
  } finally {
    root.unmount(); host.remove();
  }
}
