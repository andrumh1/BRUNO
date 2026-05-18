import { useEffect, useState } from "react";

/**
 * useVisualViewportHeight
 *
 * Tracks the actual visible area height as the on-screen keyboard opens/closes.
 *
 *  • Modern mobile browsers expose `window.visualViewport`. When the keyboard
 *    appears, `visualViewport.height` shrinks; we sync it into a CSS variable
 *    (`--app-vh`) and an inline state value so the chat layout can avoid the
 *    typical 100vh-keyboard-overlap problem.
 *  • Falls back to `window.innerHeight` for browsers without visualViewport.
 *
 * Returns `{ vh, keyboardHeight }` where:
 *    vh             — visible area height (px)
 *    keyboardHeight — diff between document/window height and visible height (px)
 */
export function useVisualViewportHeight() {
  const [vh, setVh] = useState(() =>
    typeof window === "undefined"
      ? 0
      : window.visualViewport?.height || window.innerHeight
  );
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const apply = () => {
      const vv = window.visualViewport;
      const next = vv?.height || window.innerHeight;
      const full = window.innerHeight;
      const diff = Math.max(full - next, 0);
      setVh(next);
      setKb(diff);
      document.documentElement.style.setProperty("--app-vh", `${next}px`);
      document.documentElement.style.setProperty("--app-kb", `${diff}px`);
    };

    apply();
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", apply);
      vv.addEventListener("scroll", apply);
    }
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    return () => {
      if (vv) {
        vv.removeEventListener("resize", apply);
        vv.removeEventListener("scroll", apply);
      }
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
    };
  }, []);

  return { vh, keyboardHeight: kb };
}
