import { useEffect } from "react";

/**
 * useVisualViewportHeight — keeps CSS vars in sync with the on-screen keyboard, without
 * re-rendering React on every visualViewport event (that caused flicker on mobile).
 *
 *   --app-vh      visible height (px)             --app-kb  keyboard height (px)
 *   --app-vv-top  visualViewport.offsetTop (px)   html[data-keyboard="open|closed"]
 *
 * Emits `bruno:viewport` {open, kb, vh} when the keyboard state changes.
 */
const KB_MIN = 120;
const isEditable = (el) => !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
const coarse = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

export function useVisualViewportHeight() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const root = document.documentElement;
    let raf = 0;
    let lastOpen = null;

    const apply = () => {
      raf = 0;
      const vv = window.visualViewport;
      const next = Math.round(vv?.height || window.innerHeight);
      const diff = Math.max(Math.round(window.innerHeight - next), 0);
      const focused = coarse() && isEditable(document.activeElement);
      const open = diff > KB_MIN || focused;
      root.style.setProperty("--app-vh", `${next}px`);
      root.style.setProperty("--app-kb", `${diff}px`);
      root.style.setProperty("--app-vv-top", `${Math.max(0, Math.round(vv?.offsetTop || 0))}px`);
      if (open !== lastOpen) {
        lastOpen = open;
        root.dataset.keyboard = open ? "open" : "closed";
        window.dispatchEvent(new CustomEvent("bruno:viewport", { detail: { open, kb: diff, vh: next } }));
      }
    };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(apply); };

    apply();
    const vv = window.visualViewport;
    vv?.addEventListener("resize", schedule);
    vv?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    // Focus-based detection (Chrome Android with interactive-widget=resizes-content shrinks innerHeight too)
    const onFocus = () => setTimeout(schedule, 50);
    const onBlur = () => setTimeout(schedule, 120);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", onBlur);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", schedule);
      vv?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", onBlur);
      root.dataset.keyboard = "closed";
    };
  }, []);
}

/** Mount once at app root so every page (search inputs, composer, chat) shares the same state. */
export function KeyboardViewportManager() {
  useVisualViewportHeight();
  return null;
}
