import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

/**
 * BRUNO ExpandableCard
 * Dynamic card that expands/collapses with fluid animations.
 *
 * Props:
 *   summary  – React node always visible (title, avatar, short info)
 *   details  – React node shown only when expanded
 *   defaultOpen – open on first render
 *   accent   – brand-color stripe (default Bruno orange)
 *   onToggle – (isOpen:boolean) => void
 *   icon     – optional icon next to title
 *   testId   – data-testid prefix
 */
export const ExpandableCard = ({
  summary,
  details,
  defaultOpen = false,
  accent = "#FF6A00",
  onToggle,
  icon = null,
  className = "",
  testId = "expandable-card",
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (onToggle) onToggle(next);
  };

  return (
    <motion.div
      layout
      transition={{ layout: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
      whileHover={{ y: -2 }}
      className={`relative overflow-hidden rounded-2xl bg-card border border-border/60 shadow-sm hover:shadow-xl transition-shadow ${className}`}
      data-testid={testId}
    >
      {/* Brand accent stripe */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent }}
      />

      <motion.button
        layout
        type="button"
        onClick={toggle}
        className="w-full text-left p-4 pl-5 flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/50 rounded-2xl"
        data-testid={`${testId}-toggle`}
        aria-expanded={open}
      >
        {icon && (
          <motion.span layout className="shrink-0 text-orange-500">
            {icon}
          </motion.span>
        )}
        <motion.div layout className="flex-1 min-w-0">
          {summary}
        </motion.div>
        <motion.span
          layout
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-5 w-5" />
        </motion.span>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
              opacity: { duration: 0.25, delay: open ? 0.1 : 0 },
            }}
            className="overflow-hidden"
            data-testid={`${testId}-details`}
          >
            <div className="px-5 pb-5 pt-1 border-t border-border/40">
              {details}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ExpandableCard;
