import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const NavScrollContext = createContext({
  minimized: false,
  setMinimized: () => {},
  minimizedCards: [],
  addMinimizedCard: () => {},
  removeMinimizedCard: () => {},
  touchHandlers: {},
});

export const useNavScroll = () => useContext(NavScrollContext);

const triggerHaptic = (ms = 8) => {
  try { if ('vibrate' in navigator) navigator.vibrate(ms); } catch {}
};

export const NavScrollProvider = ({ children }) => {
  const [minimized, setMinimizedRaw] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [minimizedCards, setMinimizedCards] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('bruno_min_cards') || '[]'); }
    catch { return []; }
  });

  // Persist minimized cards to session storage
  useEffect(() => {
    sessionStorage.setItem('bruno_min_cards', JSON.stringify(minimizedCards));
  }, [minimizedCards]);
  const location = useLocation();
  const prevMinimized = useRef(false);
  const touchStartY = useRef(null);

  const setMinimized = useCallback((val) => {
    setMinimizedRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (prev !== next) triggerHaptic(next ? 6 : 12);
      return next;
    });
  }, []);

  // Haptic ref sync
  useEffect(() => { prevMinimized.current = minimized; }, [minimized]);

  // Scroll handler
  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    if (currentY > lastScrollY + 30 && currentY > 100) setMinimized(true);
    else if (currentY < lastScrollY - 20) setMinimized(false);
    setLastScrollY(currentY);
  }, [lastScrollY, setMinimized]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Reset on route change
  useEffect(() => { setMinimized(false); }, [location.pathname, setMinimized]);

  // Touch gesture: swipe up = expand, swipe down = minimize
  const touchHandlers = {
    onTouchStart: (e) => { touchStartY.current = e.touches[0].clientY; },
    onTouchEnd: (e) => {
      if (touchStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY < -35) setMinimized(false);   // swipe UP → expand
      else if (deltaY > 35) setMinimized(true); // swipe DOWN → minimize
      touchStartY.current = null;
    },
  };

  // Minimized cards management
  const addMinimizedCard = useCallback((card) => {
    setMinimizedCards(prev => {
      if (prev.find(c => c.id === card.id)) return prev;
      triggerHaptic(10);
      return [...prev, { ...card, minimizedAt: Date.now() }];
    });
  }, []);

  const removeMinimizedCard = useCallback((id) => {
    setMinimizedCards(prev => prev.filter(c => c.id !== id));
  }, []);

  return (
    <NavScrollContext.Provider value={{
      minimized, setMinimized,
      minimizedCards, addMinimizedCard, removeMinimizedCard,
      touchHandlers,
    }}>
      {children}
    </NavScrollContext.Provider>
  );
};

export default NavScrollContext;
