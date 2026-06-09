/**
 * PWAInstallPrompt — encourages users to install Bruno to their home screen.
 *
 *  Listens for the browser's `beforeinstallprompt` event (Chrome, Edge, Samsung,
 *  Brave). When fired, we capture it and show a branded prompt. For iOS Safari
 *  (which doesn't fire that event) we show alternate "Add to Home Screen"
 *  instructions on the FIRST visit only.
 *
 *  Dismissal is persisted to localStorage so we don't nag users.
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Share, Plus } from "lucide-react";

const DISMISS_KEY = "bruno_pwa_dismiss";
const SNOOZE_DAYS = 7;

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  // @ts-ignore — iOS-specific
  window.navigator.standalone === true;

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIOS, setShowIOS] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return; // already installed
    try {
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const age = (Date.now() - parseInt(dismissed, 10)) / (1000 * 60 * 60 * 24);
        if (age < SNOOZE_DAYS) return;
      }
    } catch (_e) { /* ignore */ }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari path
    if (isIOS()) {
      // Slight delay so the prompt doesn't appear instantly on first paint
      const t = setTimeout(() => setShowIOS(true), 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_e) { /* ignore */ }
    setDeferredPrompt(null);
    setShowIOS(false);
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

  const visible = !!deferredPrompt || showIOS;
  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="pwa-install"
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: "spring", stiffness: 360, damping: 28 }}
        className="fixed z-[10001] left-3 right-3 bottom-3 sm:left-auto sm:right-4 sm:bottom-4 sm:max-w-sm pointer-events-auto"
        data-testid="pwa-install-prompt"
      >
        <div
          className="rounded-2xl overflow-hidden border border-orange-200 shadow-2xl shadow-orange-500/30"
          style={{ background: "linear-gradient(135deg,#FFF7ED 0%,#FFE4C8 100%)" }}
        >
          <div className="p-3.5 flex items-start gap-3">
            <div className="shrink-0">
              <img
                src="/bruno-mascot.png"
                alt="BRUNO"
                className="w-12 h-12 rounded-xl object-cover ring-2 ring-orange-300 shadow"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-stone-900">Instala BRUNO</p>
              {deferredPrompt ? (
                <p className="text-[12px] text-stone-600 leading-snug">
                  Acceso directo desde tu pantalla de inicio, sin barra del navegador.
                </p>
              ) : (
                <p className="text-[12px] text-stone-600 leading-snug">
                  Toca <Share className="inline w-3.5 h-3.5 mx-0.5 -mt-0.5 text-blue-500" />
                  y luego <span className="font-semibold">"Añadir a pantalla de inicio"</span>.
                </p>
              )}
              {deferredPrompt && (
                <button
                  onClick={handleInstall}
                  disabled={installing}
                  className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold shadow-md shadow-orange-500/30 disabled:opacity-50"
                  data-testid="pwa-install-btn"
                >
                  <Download className="w-3.5 h-3.5" />
                  Instalar
                </button>
              )}
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 grid place-items-center w-7 h-7 rounded-full bg-white/70 hover:bg-white text-stone-500"
              aria-label="Descartar"
              data-testid="pwa-install-dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
