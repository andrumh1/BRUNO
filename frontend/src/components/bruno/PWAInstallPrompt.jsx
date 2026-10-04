/**
 * PWAInstallPrompt — encourages users to install Bruno to their home screen.
 *
 *  • Chrome / Edge / Brave / Samsung (Android, Windows, ChromeOS): fires
 *    `beforeinstallprompt` → we capture it and show the "Instalar" button.
 *  • iOS Safari: doesn't fire that event → we show step-by-step
 *    instructions using the actual Share icon (▲ inside a box).
 *  • iOS Chrome / Firefox: those browsers cannot install — we point users
 *    to "open in Safari" instead.
 *
 *  Layout is compact (one-row on phones >= 360px, two-rows on tiny screens)
 *  and stays above the bottom-nav.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Plus, Smartphone } from "lucide-react";

const DISMISS_KEY = "bruno_pwa_dismiss";
const SNOOZE_DAYS = 7;
const MIN_VISIT_MS = 6 * 1000; // 6 seconds — give context first

const isIOS = () => /iPad|iPhone|iPod/i.test(navigator.userAgent) && !window.MSStream;
const isAndroid = () => /Android/i.test(navigator.userAgent);
const isSafari = () => /Safari/i.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

/* The official iOS Share icon (▲ inside a box) — used inline in the
   instructions so the user recognises it on the system toolbar. */
const IOSShareIcon = ({ className = "" }) => (
  <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
    <path d="M12 3v12M12 3l-3.5 3.5M12 3l3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const age = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
        if (age < SNOOZE_DAYS) return;
      }
    } catch (_e) { /* ignore */ }

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS & non-installable Android paths — show the manual instructions
    // after the user has actually been on the site for a few seconds.
    if (isIOS()) {
      const t = setTimeout(() => setShowInstructions("ios"), MIN_VISIT_MS);
      return () => { clearTimeout(t); window.removeEventListener("beforeinstallprompt", handler); };
    }
    // Android Chrome may delay beforeinstallprompt — also show a manual hint
    // after a longer delay if no native prompt arrives.
    let androidTimer;
    if (isAndroid()) {
      androidTimer = setTimeout(() => {
        if (!deferredPrompt) setShowInstructions("android");
      }, 15000);
    }
    return () => {
      clearTimeout(androidTimer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_e) { /* ignore */ }
    setDeferredPrompt(null);
    setShowInstructions(false);
    setExpanded(false);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") dismiss();
    } catch (_e) { /* ignore */ }
    setInstalling(false);
    setDeferredPrompt(null);
  };

  const visible = !!deferredPrompt || !!showInstructions;
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="pwa-install"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        /* Sits ABOVE the bottom nav (which is at bottom-0..bottom-4 + safe-area).
           Compact on phones — full sheet width minus 12px padding. */
        className="fixed z-[10001] left-2 right-2 sm:left-auto sm:right-4 sm:max-w-[360px] pointer-events-auto"
        style={{
          bottom: "calc(5.5rem + var(--safe-bottom))",
        }}
        data-testid="pwa-install-prompt"
      >
        <div
          className="rounded-2xl overflow-hidden border border-orange-200/80 shadow-2xl shadow-orange-500/25 backdrop-blur-md"
          style={{ background: "linear-gradient(135deg,rgba(255,247,237,0.97) 0%,rgba(255,228,200,0.97) 100%)" }}
        >
          {/* Compact (collapsed) row */}
          <div className="p-2.5 flex items-center gap-2.5">
            <img
              src="/bruno-mascot.png"
              alt="BRUNO"
              className="w-10 h-10 rounded-xl object-cover ring-2 ring-orange-300 shadow shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-stone-900 leading-tight">Instala BRUNO</p>
              <p className="text-[11px] text-stone-600 leading-tight truncate">
                {deferredPrompt
                  ? "Acceso directo al inicio · sin barra del navegador"
                  : showInstructions === "ios"
                    ? "Toca para ver cómo añadir al inicio"
                    : "Toca para ver cómo instalar"}
              </p>
            </div>

            {deferredPrompt ? (
              <button
                onClick={handleInstall}
                disabled={installing}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold shadow-md shadow-orange-500/30 disabled:opacity-50"
                data-testid="pwa-install-btn"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar
              </button>
            ) : (
              <button
                onClick={() => setExpanded((p) => !p)}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-[11px] font-bold shadow-md shadow-orange-500/30"
                data-testid="pwa-install-show-instructions"
              >
                {expanded ? "Ocultar" : "Cómo"}
              </button>
            )}

            <button
              onClick={dismiss}
              className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-white/70 hover:bg-white text-stone-500"
              aria-label="Descartar"
              data-testid="pwa-install-dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Expanded instructions panel */}
          <AnimatePresence>
            {expanded && !deferredPrompt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-orange-200/60 px-3 py-2.5 overflow-hidden"
              >
                {showInstructions === "ios" ? (
                  <ol className="space-y-2 text-[12px] text-stone-800 leading-snug">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">1</span>
                      <span>Toca el ícono <IOSShareIcon className="inline w-4 h-4 mx-0.5 text-blue-600" /> <b>Compartir</b> de Safari (abajo, en el centro)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">2</span>
                      <span>Desliza hacia abajo y elige <b>&quot;Añadir a pantalla de inicio&quot;</b> <Plus className="inline w-3.5 h-3.5 text-stone-500" /></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">3</span>
                      <span>Toca <b>Añadir</b> arriba a la derecha. ¡Listo!</span>
                    </li>
                    {!isSafari() && (
                      <li className="mt-1 px-2 py-1.5 rounded-md bg-amber-100/80 text-[11px] text-amber-900">
                        <Smartphone className="inline w-3 h-3 mr-1 -mt-0.5" />
                        Necesitas abrir esta página en <b>Safari</b> (no funciona desde Chrome en iOS).
                      </li>
                    )}
                  </ol>
                ) : (
                  <ol className="space-y-2 text-[12px] text-stone-800 leading-snug">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">1</span>
                      <span>Abre el menú de Chrome (⋮ arriba a la derecha)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">2</span>
                      <span>Elige <b>&quot;Instalar app&quot;</b> o <b>&quot;Añadir a pantalla de inicio&quot;</b></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 inline-flex w-5 h-5 rounded-full bg-orange-500 text-white text-[10px] font-bold items-center justify-center shrink-0">3</span>
                      <span>Confirma con <b>&quot;Instalar&quot;</b>. La app quedará en tu inicio.</span>
                    </li>
                  </ol>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
