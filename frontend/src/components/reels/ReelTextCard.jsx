import React from "react";
import { Link } from "react-router-dom";
import { CreditCard, Quote } from "lucide-react";
import { TEXT_BGS, bgById, fontById, bgGradient } from "@/lib/textStyles";

const hashOf = (s = "") => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// Full-screen "text reel" for posts without media (TikTok text-post style).
export default function ReelTextCard({ reel }) {
  const bg = bgById(reel.text_style?.bg) || TEXT_BGS[hashOf(reel.id) % TEXT_BGS.length];
  const font = fontById(reel.text_style?.font);
  const text = reel.content || reel.description || "";
  const size = text.length > 240 ? "text-lg" : text.length > 120 ? "text-2xl" : "text-3xl";
  const align = reel.text_style?.align === "left" ? "left" : "center";
  const emoji = reel.text_style?.emoji || null;
  return (
    <div className="absolute inset-0 grid place-items-center px-8 pb-24" style={{ background: bgGradient(bg) }} data-testid={`reel-text-${reel.id}`}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
      <div className={`relative max-w-md w-full flex flex-col ${align === "center" ? "items-center text-center" : "items-start text-left"}`} data-align={align}>
        {emoji ? <span className="text-7xl leading-none mb-4 drop-shadow-xl select-none" data-testid="reel-text-emoji">{emoji}</span> : <Quote className="w-8 h-8 text-white/40 mb-3" />}
        <p className={`${size} text-white leading-snug whitespace-pre-wrap break-words drop-shadow-lg`}
          style={{ fontFamily: font.family, fontWeight: font.weight, letterSpacing: font.tracking, display: "-webkit-box", WebkitLineClamp: 12, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{text || "…"}</p>
        {reel.card_id && (
          <Link to={`/c/${reel.card_id}`} onClick={(e) => e.stopPropagation()} className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-4 h-10 text-white text-sm font-semibold active:scale-95 transition-transform" data-testid="reel-text-card-link">
            <CreditCard className="w-4 h-4" /> Ver tarjeta compartida
          </Link>
        )}
      </div>
    </div>
  );
}
