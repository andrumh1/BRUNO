import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reply } from "lucide-react";

/**
 * MessageReactionsBubble — wraps a chat message bubble with:
 *   • Long-press (touch) / right-click (desktop) → opens reactions popover
 *   • Tap on emoji → onReact(emoji), then closes
 *   • Tap on Reply button → onReply()
 *   • Click outside to dismiss
 *
 * Props:
 *   children      — the message bubble JSX
 *   isOwn         — flag for popover anchoring
 *   onReact(emoji)
 *   onReply()
 *   reactions     — optional array of { emoji, count } to render below the bubble
 *   testId
 */
const QUICK = ["❤️", "😂", "😮", "😢", "🔥", "👏"];

export default function MessageReactionsBubble({
  children,
  isOwn = false,
  onReact,
  onReply,
  reactions = [],
  testId = "msg-reactions",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const pressTimerRef = useRef(null);

  // Outside click
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);

  const startPress = () => {
    pressTimerRef.current = setTimeout(() => setOpen(true), 450);
  };
  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleEmoji = (emoji) => {
    onReact?.(emoji);
    setOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="relative"
      data-testid={testId}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={(e) => {
        e.preventDefault();
        setOpen(true);
      }}
    >
      {children}

      {/* Existing reactions display */}
      {reactions.length > 0 && (
        <div
          className={`mt-1 flex gap-1 flex-wrap ${
            isOwn ? "justify-end" : "justify-start"
          }`}
        >
          {reactions.map((r, i) => (
            <span
              key={`${r.emoji}-${i}`}
              className="inline-flex items-center gap-0.5 bg-white dark:bg-zinc-800 rounded-full px-2 py-0.5 text-xs shadow-sm border border-zinc-200/60 dark:border-zinc-700"
            >
              <span>{r.emoji}</span>
              {r.count > 1 && (
                <span className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {r.count}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Popover */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className={`absolute z-30 top-[-46px] ${
              isOwn ? "right-0" : "left-0"
            } flex items-center gap-1 bg-white dark:bg-zinc-900 rounded-full px-1.5 py-1 shadow-xl border border-zinc-200 dark:border-zinc-800`}
            data-testid={`${testId}-popover`}
          >
            {QUICK.map((emoji) => (
              <motion.button
                key={emoji}
                whileTap={{ scale: 0.7 }}
                whileHover={{ scale: 1.25, y: -2 }}
                onClick={() => handleEmoji(emoji)}
                data-testid={`${testId}-emoji-${emoji}`}
                className="grid place-items-center h-9 w-9 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xl"
              >
                {emoji}
              </motion.button>
            ))}
            <span className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mx-0.5" />
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onReply?.();
                setOpen(false);
              }}
              data-testid={`${testId}-reply-btn`}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-full hover:bg-orange-50 dark:hover:bg-orange-500/10 text-orange-600 dark:text-orange-300 text-xs font-semibold"
            >
              <Reply className="h-3.5 w-3.5" />
              Responder
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
