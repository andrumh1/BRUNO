/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { ShieldCheck, EyeOff } from "lucide-react";
import { enablePrivacyScreen, disablePrivacyScreen } from "@/native/privacyScreen";

/**
 * PrivacyShield — anti-capture layer for private lives.
 *  Native (Capacitor): FLAG_SECURE on Android / background-hide on iOS.
 *  Web deterrents: forensic moving watermark (viewer identity), video blacked out
 *  when tab/window loses focus, PrintScreen key → instant blackout, context menu,
 *  PiP, download and text selection disabled.
 * Note: browsers cannot fully block OS-level screenshots — the watermark makes
 * any leak traceable to the viewer who captured it.
 */
export default function PrivacyShield({ active, label, children }) {
  const [hidden, setHidden] = useState(false);
  const [flash, setFlash] = useState(false);
  const [nativeInfo, setNativeInfo] = useState(null);

  useEffect(() => {
    if (!active) return;
    enablePrivacyScreen().then(setNativeInfo);
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    const onKey = (e) => {
      if (e.key === "PrintScreen" || (e.metaKey && e.shiftKey && ["3", "4", "5", "s", "S"].includes(e.key)) || (e.ctrlKey && e.shiftKey && ["s", "S"].includes(e.key))) {
        e.preventDefault();
        setFlash(true); setTimeout(() => setFlash(false), 1800);
        try { navigator.clipboard?.writeText("Contenido protegido · BRUNO Live privado"); } catch (_) { /* ignore */ }
      }
    };
    const block = (e) => e.preventDefault();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    return () => {
      disablePrivacyScreen();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
    };
  }, [active]);

  if (!active) return children;
  const blackout = hidden || flash;
  return (
    <div className="relative h-full w-full no-capture" data-testid="privacy-shield">
      <div className={blackout ? "invisible" : ""}>{children}</div>

      {/* Forensic watermark — drifts so it can't be cropped out */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-[5]">
        <div className="live-watermark absolute top-6 left-4 text-white/35 text-[11px] font-mono tracking-wider select-none" data-testid="privacy-watermark">
          {label}
        </div>
        <div className="live-watermark absolute top-1/2 left-1/3 text-white/20 text-[10px] font-mono select-none" style={{ animationDelay: "-13s" }}>
          {label}
        </div>
      </div>

      {blackout && (
        <div className="absolute inset-0 z-[6] bg-black grid place-items-center text-white" data-testid="privacy-blackout">
          <div className="flex flex-col items-center gap-2 text-center px-8">
            <EyeOff className="w-8 h-8" />
            <p className="text-sm font-semibold">Contenido protegido</p>
            <p className="text-xs text-white/60">{flash ? "Captura de pantalla bloqueada" : "Vuelve a la app para seguir viendo"}</p>
          </div>
        </div>
      )}

      <div className="absolute z-[7] left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/45 text-[10px] text-white/90" style={{ top: "calc(var(--safe-top) + 56px)" }} data-testid="privacy-badge">
        <ShieldCheck className="w-3 h-3 text-emerald-400" /> {nativeInfo?.blocksScreenshots ? "Capturas bloqueadas" : "Live privado protegido"}
      </div>
    </div>
  );
}
