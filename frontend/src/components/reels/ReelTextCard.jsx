import React from "react";
import { Link } from "react-router-dom";
import { CreditCard, Quote } from "lucide-react";

const PALETTES = [
  ["#FF5A00", "#7A1E00"], ["#1E3A8A", "#0B1120"], ["#065F46", "#022C22"], ["#7C2D12", "#1C0A00"],
  ["#4C1D95", "#1E0B3B"], ["#9D174D", "#3B0716"], ["#0F766E", "#042F2E"], ["#B45309", "#3B1A00"],
];

const hashOf = (s = "") => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Full-screen "text reel" for posts without media (TikTok text-post style).
export default function ReelTextCard({ reel }) {
  const [a, b] = PALETTES[hashOf(reel.id) % PALETTES.length];
  const text = reel.content || reel.description || "";
  const size = text.length > 240 ? "text-lg" : text.length > 120 ? "text-2xl" : "text-3xl";
  return (
    <div className="absolute inset-0 grid place-items-center px-8 pb-24" style={{ background: `radial-gradient(120% 90% at 20% 10%, ${a} 0%, ${b} 70%)` }} data-testid={`reel-text-${reel.id}`}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div className="relative max-w-md w-full">
        <Quote className="w-8 h-8 text-white/40 mb-3" />
        <p className={`${size} font-bold text-white leading-snug whitespace-pre-wrap break-words drop-shadow-lg`} style={{ display: "-webkit-box", WebkitLineClamp: 12, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text || "…"}</p>
        {reel.card_id && (
          <Link to={`/c/${reel.card_id}`} onClick={(e) => e.stopPropagation()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-4 h-10 text-white text-sm font-semibold active:scale-95 transition-transform" data-testid="reel-text-card-link">
            <CreditCard className="w-4 h-4" /> Ver tarjeta compartida
          </Link>
        )}
      </div>
    </div>
  );
}
