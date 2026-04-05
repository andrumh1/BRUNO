import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const NavScrollContext = createContext({
  minimized: false,
  setMinimized: () => {},
});

export const useNavScroll = () => useContext(NavScrollContext);

const triggerHaptic = (ms = 8) => {
  try { if ('vibrate' in navigator) navigator.vibrate(ms); } catch {}
};

export const NavScrollProvider = ({ children }) => {
  const [minimized, setMinimized] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const prevMinimized = useRef(false);

  // Haptic feedback on minimize/expand
  useEffect(() => {
    if (prevMinimized.current !== minimized) {
      triggerHaptic(minimized ? 6 : 12);
      prevMinimized.current = minimized;
    }
  }, [minimized]);

  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    if (currentY > lastScrollY + 30 && currentY > 100) {
      setMinimized(true);
    } else if (currentY < lastScrollY - 20) {
      setMinimized(false);
    }
    setLastScrollY(currentY);
  }, [lastScrollY]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    setMinimized(false);
  }, [location.pathname]);

  return (
    <NavScrollContext.Provider value={{ minimized, setMinimized }}>
      {children}
    </NavScrollContext.Provider>
  );
};

export default NavScrollContext;
