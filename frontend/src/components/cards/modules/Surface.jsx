import React from "react";
import { surfaceStyle } from "@/lib/cardDesign";
import { useCardT } from "@/lib/cardLabels";

// Bubble Glass surface: gradient glass + border highlight + top reflection + depth.
export const Surface = ({ design, strong = false, className = "", style, children, ...rest }) => {
  const radius = Math.max(8, design.layout.radius - 6);
  const glassOn = design.glass.enabled;
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ borderRadius: radius, ...surfaceStyle(design, { strong }), ...style }} {...rest}>
      {glassOn && design.effects.reflection && (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/2" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0))", opacity: 0.9, maskImage: "linear-gradient(90deg, rgba(0,0,0,0.9), rgba(0,0,0,0.2))" }} />
      )}
      <div className="relative">{children}</div>
    </div>
  );
};

export const SectionTitle = ({ children, design }) => {
  const t = useCardT();
  return <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] mb-3" style={{ color: design.colors.text, opacity: 0.6 }}>{t(children)}</h3>;
};
