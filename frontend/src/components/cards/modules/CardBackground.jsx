import React from "react";
import { rgba } from "@/lib/cardDesign";

// Full card background: color | gradient | image | fullimage | animated. Honours prefers-reduced-motion.
export const CardBackground = ({ design, data }) => {
  const bg = design.background;
  const image = bg.imageUrl || data.banner_url || data.avatar_url;
  const gradient = `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2})`;
  const isImage = (bg.type === "image" || bg.type === "fullimage") && image;
  const animated = bg.type === "animated" || design.animations.enabled;
  return (
    <>
      <div aria-hidden className="absolute inset-0" style={{
        backgroundColor: bg.color,
        backgroundImage: bg.type === "gradient" || bg.type === "animated" ? (animated ? `linear-gradient(${bg.angle}deg, ${bg.color}, ${bg.color2}, ${rgba(bg.color, 0.85)}, ${bg.color2})` : gradient) : (bg.type === "fullimage" && !image ? `radial-gradient(ellipse at 50% 20%, ${bg.color2} 0%, ${bg.color} 70%)` : undefined),
        backgroundSize: animated && !isImage ? "300% 300%" : undefined,
        animation: animated && !isImage ? "brunoGradientShift 10s ease infinite" : undefined,
      }} />
      {isImage && (
        <>
          <div aria-hidden className="absolute inset-0 bg-cover" style={{ backgroundImage: `url(${image})`, backgroundPosition: `${design.hero?.focusX ?? 50}% ${design.hero?.focusY ?? 50}%`, filter: `blur(${bg.blur}px) brightness(${bg.brightness}%)`, transform: bg.blur || (design.hero?.zoom || 100) > 100 ? `scale(${Math.max(1.06 * (bg.blur ? 1 : 0.95), (design.hero?.zoom || 100) / 100)})` : undefined, transformOrigin: `${design.hero?.focusX ?? 50}% ${design.hero?.focusY ?? 50}%` }} />
          <div aria-hidden className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${rgba("#000000", bg.overlay / 100 * 0.55)}, ${rgba("#000000", bg.overlay / 100)})` }} />
        </>
      )}
      {animated && (
        <>
          <div aria-hidden className="absolute -top-20 -right-16 w-72 h-72 rounded-full opacity-30" style={{ background: `radial-gradient(circle, ${rgba("#FFFFFF", 0.6)}, transparent 70%)`, animation: "brunoFloat 9s ease-in-out infinite" }} />
          <div aria-hidden className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full opacity-25" style={{ background: `radial-gradient(circle, ${rgba(bg.color2, 0.9)}, transparent 70%)`, animation: "brunoFloat 12s ease-in-out infinite reverse" }} />
        </>
      )}
      <style>{`@keyframes brunoGradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}@keyframes brunoFloat{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(-14px,18px,0)}}@media (prefers-reduced-motion: reduce){[data-card-renderer] *{animation:none!important}}`}</style>
    </>
  );
};
