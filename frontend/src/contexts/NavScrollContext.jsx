import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";

const NavScrollContext = createContext({
  minimized: false,
  setMinimized: () => {},
});

export const useNavScroll = () => useContext(NavScrollContext);

export const NavScrollProvider = ({ children }) => {
  const [minimized, setMinimized] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();

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

  // Reset on route change
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
