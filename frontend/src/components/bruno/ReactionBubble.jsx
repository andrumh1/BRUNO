/**
 * ReactionBubble — long-press (>1s) draggable emoji reaction picker.
 *
 *  Usage:
 *    const ref = useReactionTrigger({ onReact: (emoji) => ... })
 *    <button {...ref.handlers}>Like</button>
 *    <ReactionBubble {...ref.bubbleProps} />
 *
 *  UX:
 *    - Press & hold a button for 1s → bubble appears anchored to the trigger
 *    - 6 emojis: ❤️😂😮😢😡👍
 *    - User drags finger/cursor across emojis → focused emoji scales up
 *    - Release on an emoji → fire onReact(emoji)
 *    - Release outside → dismiss
 *    - Tap (short press) on trigger still fires the default like behaviour
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const BRUNO_REACTIONS = [
  { key: "like",  emoji: "👍", label: "Me gusta" },
  { key: "love",  emoji: "❤️", label: "Encanta" },
  { key: "laugh", emoji: "😂", label: "Jaja" },
  { key: "wow",   emoji: "😮", label: "Wow" },
  { key: "sad",   emoji: "😢", label: "Triste" },
  { key: "angry", emoji: "😡", label: "Enfada" },
];

const PRESS_DELAY = 1000; // 1s as per spec

/**
 * Hook factory — wires long-press handlers into any clickable element.
 *  onTap   → fired on short press (<1s, no drag)
 *  onReact → fired when an emoji is picked from the bubble
 */
export function useReactionTrigger({ onTap, onReact, disabled = false } = {}) {
  const timerRef = useRef(null);
  const triggerRef = useRef(null);
  const [bubble, setBubble] = useState(null); // { x, y, width }
  const [hover, setHover] = useState(null);   // hovered emoji key
  const startedAt = useRef(0);

  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // True when the last interaction triggered the long-press bubble.
  // Used by callers' onClick to suppress the tap action.
  const longPressFired = useRef(false);

  const showBubbleFor = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Center horizontally above trigger, clamped to viewport
    const bubbleWidth = Math.min(330, window.innerWidth - 16);
    let x = rect.left + rect.width / 2 - bubbleWidth / 2;
    x = Math.max(8, Math.min(window.innerWidth - bubbleWidth - 8, x));
    const y = rect.top - 64; // bubble sits 64px above trigger
    setBubble({ x, y, width: bubbleWidth });
    longPressFired.current = true;
    // Haptic on supported devices
    if (navigator.vibrate) navigator.vibrate(20);
  }, []);

  const close = useCallback((pickedEmoji = null) => {
    cancelTimer();
    setBubble(null);
    setHover(null);
    if (pickedEmoji && onReact) onReact(pickedEmoji);
  }, [onReact]);

  const handleStart = useCallback((e) => {
    if (disabled) return;
    startedAt.current = Date.now();
    longPressFired.current = false;
    cancelTimer();
    timerRef.current = setTimeout(showBubbleFor, PRESS_DELAY);
  }, [disabled, showBubbleFor]);

  const handleMove = useCallback((e) => {
    if (!bubble) return;
    e.preventDefault?.();
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    // Find which emoji we're hovering
    const emojiButtons = document.querySelectorAll("[data-reaction-emoji]");
    let bestKey = null;
    for (const el of emojiButtons) {
      const r = el.getBoundingClientRect();
      if (
        point.clientX >= r.left && point.clientX <= r.right &&
        point.clientY >= r.top - 20 && point.clientY <= r.bottom + 20
      ) {
        bestKey = el.dataset.reactionEmoji;
        break;
      }
    }
    setHover(bestKey);
  }, [bubble]);

  const handleEnd = useCallback((e) => {
    if (bubble) {
      // Pick whatever's hovered, else dismiss
      if (hover) {
        const r = BRUNO_REACTIONS.find(r => r.key === hover);
        close(r);
      } else {
        close();
      }
    } else {
      // Cancel the pending long-press timer — onClick will handle the tap.
      cancelTimer();
    }
  }, [bubble, hover, close]);

  // Outside-click dismiss when bubble is open via mouse (touchend handled above)
  useEffect(() => {
    if (!bubble) return;
    const onUp = (e) => handleEnd(e);
    const onMv = (e) => handleMove(e);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchend", onUp);
    window.addEventListener("mousemove", onMv);
    window.addEventListener("touchmove", onMv, { passive: false });
    return () => {
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchend", onUp);
      window.removeEventListener("mousemove", onMv);
      window.removeEventListener("touchmove", onMv);
    };
  }, [bubble, handleEnd, handleMove]);

  // Cleanup on unmount
  useEffect(() => () => cancelTimer(), []);

  return {
    triggerRef,
    handlers: {
      onMouseDown: handleStart,
      onTouchStart: handleStart,
      // Cancel timer if user releases without triggering long-press.
      // Native onClick on the button handles the actual tap.
      onMouseUp: handleEnd,
      onTouchEnd: handleEnd,
      onMouseLeave: () => { if (!bubble) cancelTimer(); },
    },
    bubble,
    hover,
    close,
    // True if the most recent interaction triggered the long-press bubble
    // (callers should suppress their tap action in this case).
    longPressFired,
  };
}

export default function ReactionBubble({ bubble, hover, onPick, testId = "reaction-bubble" }) {
  if (!bubble) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="bubble"
        initial={{ opacity: 0, scale: 0.6, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.6, y: 10 }}
        transition={{ type: "spring", stiffness: 360, damping: 24 }}
        style={{ position: "fixed", left: bubble.x, top: bubble.y, width: bubble.width, zIndex: 100 }}
        data-testid={testId}
      >
        <div
          className="flex items-center justify-around gap-1 rounded-full px-2 py-1.5 shadow-2xl backdrop-blur-xl"
          style={{
            background: "rgba(255, 247, 238, 0.97)",
            border: "1px solid rgba(255,127,0,0.25)",
            boxShadow: "0 18px 40px -10px rgba(255,106,0,0.45), 0 8px 16px rgba(0,0,0,0.12)",
          }}
        >
          {BRUNO_REACTIONS.map((r, i) => (
            <motion.button
              key={r.key}
              data-reaction-emoji={r.key}
              data-testid={`reaction-bubble-${r.key}`}
              onClick={(e) => { e.preventDefault(); onPick?.(r); }}
              initial={{ opacity: 0, y: 8 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: hover === r.key ? 1.5 : 1,
              }}
              transition={{ delay: i * 0.03, type: "spring", stiffness: 500, damping: 18 }}
              className="grid place-items-center w-10 h-10 rounded-full select-none"
              style={{
                background: hover === r.key
                  ? "linear-gradient(135deg,#FFE2C6,#FFCB9A)"
                  : "transparent",
              }}
              aria-label={r.label}
            >
              <span style={{ fontSize: hover === r.key ? 28 : 22, lineHeight: 1 }}>
                {r.emoji}
              </span>
            </motion.button>
          ))}
        </div>
        {hover && (
          <div className="text-center mt-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded-full bg-black/75 text-white text-[11px] font-semibold">
              {BRUNO_REACTIONS.find(r => r.key === hover)?.label}
            </span>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
