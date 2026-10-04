import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

// Paths where the bottom nav is hidden; show a floating back button unless the page already has one.
const NO_NAV = [/^\/lives\/[^/]+$/, /^\/camera/, /^\/website/, /^\/bruno$/, /^\/chat\/[^/]+$/];
const OWN_BACK = '[data-testid$="back-btn"], [data-testid$="close-btn"], [data-testid$="-back"], [data-testid^="back-"], [aria-label="Volver"], [aria-label="Atrás"], [aria-label="Salir"], [aria-label="Cerrar"]';

export default function FloatingBackButton() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!NO_NAV.some((re) => re.test(pathname))) { setShow(false); return undefined; }
    let tries = 0;
    let t;
    const check = () => {
      const has = [...document.querySelectorAll(OWN_BACK)].some((el) => {
        if (el.dataset.testid === "global-back-btn") return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top < window.innerHeight * 0.35 && getComputedStyle(el).visibility !== "hidden";
      });
      setShow(!has);
      if (has || tries++ > 6) return;
      t = setTimeout(check, 400);
    };
    t = setTimeout(check, 350);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!show) return null;
  return (
    <button
      onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/reels"))}
      className="fixed left-3 z-[9000] w-10 h-10 rounded-full bg-black/45 text-white backdrop-blur-md grid place-items-center active:scale-90 transition-transform shadow-lg"
      style={{ top: "calc(var(--safe-top) + 10px)" }}
      aria-label="Volver"
      data-testid="global-back-btn"
    >
      <ArrowLeft className="w-5 h-5" />
    </button>
  );
}
