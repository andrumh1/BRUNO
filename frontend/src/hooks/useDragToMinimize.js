import { useEffect, useRef, useState } from "react";

/**
 * useDragToMinimize — touch + mouse "swipe down to minimize" gesture.
 *
 * Attach `bind()` to the container element you want to drag. Once the user
 * pulls the container down past `threshold` pixels (default 70), `onMinimize`
 * fires and the spring resets. Works on phones (touch) and desktop (mouse).
 *
 * Usage:
 *   const { bind, dragY, dragging } = useDragToMinimize({ onMinimize: () => setOpen(false) });
 *   return <div {...bind} style={{ transform: `translateY(${dragY}px)` }}>...</div>;
 */
export default function useDragToMinimize({
  onMinimize,
  threshold = 70,
  maxDrag = 200,
  disabled = false,
} = {}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startTime = useRef(0);
  const active = useRef(false);

  const onStart = (clientY) => {
    if (disabled) return;
    startY.current = clientY;
    startTime.current = Date.now();
    active.current = true;
    setDragging(true);
  };
  const onMove = (clientY) => {
    if (!active.current) return;
    const dy = clientY - startY.current;
    // Only allow dragging DOWNWARDS (positive dy).
    if (dy < 0) {
      setDragY(0);
      return;
    }
    setDragY(Math.min(dy, maxDrag));
  };
  const onEnd = (clientY) => {
    if (!active.current) return;
    active.current = false;
    const dy = clientY - startY.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = dy / Math.max(elapsed, 1); // px/ms
    setDragging(false);
    // Trigger minimize if past the threshold OR fast flick down (>0.6 px/ms with ≥30px drag).
    // Also catch slow-but-significant drags (>120px) that Playwright generates as a single
    // mouse release at the end with elapsed ~0 (velocity calc unreliable).
    if (dy >= threshold || (velocity > 0.6 && dy > 30) || dy > 120) {
      onMinimize?.();
    }
    setDragY(0);
  };

  // Keep listeners stable
  useEffect(() => {
    const onMouseMove = (e) => onMove(e.clientY);
    const onMouseUp = (e) => onEnd(e.clientY);
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const bind = {
    onTouchStart: (e) => onStart(e.touches[0].clientY),
    onTouchMove: (e) => onMove(e.touches[0].clientY),
    onTouchEnd: (e) => onEnd((e.changedTouches[0] || {}).clientY ?? startY.current),
    onMouseDown: (e) => onStart(e.clientY),
  };

  return { bind, dragY, dragging };
}
