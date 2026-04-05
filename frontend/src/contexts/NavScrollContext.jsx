import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";

const NavScrollContext = createContext({
  minimized: false,
  setMinimized: () => {},
  minimizedItems: [],
  addMinimizedItem: () => {},
  removeMinimizedItem: () => {},
  // Backward compat aliases
  minimizedCards: [],
  addMinimizedCard: () => {},
  removeMinimizedCard: () => {},
  touchHandlers: {},
});

export const useNavScroll = () => useContext(NavScrollContext);

const triggerHaptic = (ms = 8) => {
  try { if ('vibrate' in navigator) navigator.vibrate(ms); } catch {}
};

// Item types: card, profile, post, reel, live
const STORAGE_KEY = 'bruno_min_items';

export const NavScrollProvider = ({ children }) => {
  const [minimized, setMinimizedRaw] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [minimizedItems, setMinimizedItems] = useState(() => {
    try {
      // Migrate from old key
      const oldCards = JSON.parse(sessionStorage.getItem('bruno_min_cards') || '[]');
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      if (stored.length > 0) return stored;
      if (oldCards.length > 0) {
        // Migrate old cards format
        const migrated = oldCards.map(c => ({ ...c, itemType: 'card' }));
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        sessionStorage.removeItem('bruno_min_cards');
        return migrated;
      }
      return [];
    }
    catch { return []; }
  });

  // Persist to session storage
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(minimizedItems));
  }, [minimizedItems]);

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
      if (deltaY < -35) setMinimized(false);
      else if (deltaY > 35) setMinimized(true);
      touchStartY.current = null;
    },
  };

  // Universal item management
  const addMinimizedItem = useCallback((item) => {
    setMinimizedItems(prev => {
      if (prev.find(i => i.id === item.id && i.itemType === item.itemType)) return prev;
      triggerHaptic(10);
      // Limit to 12 items max
      const next = [...prev, { ...item, minimizedAt: Date.now() }];
      return next.length > 12 ? next.slice(-12) : next;
    });
  }, []);

  const removeMinimizedItem = useCallback((id, itemType) => {
    setMinimizedItems(prev => prev.filter(i => !(i.id === id && (itemType ? i.itemType === itemType : true))));
  }, []);

  // Backward compat for cards
  const minimizedCards = minimizedItems.filter(i => i.itemType === 'card');
  const addMinimizedCard = useCallback((card) => {
    addMinimizedItem({ ...card, itemType: 'card' });
  }, [addMinimizedItem]);
  const removeMinimizedCard = useCallback((id) => {
    removeMinimizedItem(id, 'card');
  }, [removeMinimizedItem]);

  return (
    <NavScrollContext.Provider value={{
      minimized, setMinimized,
      minimizedItems, addMinimizedItem, removeMinimizedItem,
      minimizedCards, addMinimizedCard, removeMinimizedCard,
      touchHandlers,
    }}>
      {children}
    </NavScrollContext.Provider>
  );
};

export default NavScrollContext;
