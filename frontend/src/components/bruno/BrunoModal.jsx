import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Send, Trash2, Info, CheckCircle2 } from "lucide-react";

/**
 * BRUNO Modal — branded, dynamic-height, animated confirm/feedback modal.
 *
 * Props:
 *   open
 *   onClose
 *   variant     — "info" | "confirm" | "publish" | "discard" | "success" | "danger"
 *   title
 *   description
 *   primaryAction   { label, onClick, loading }
 *   secondaryAction { label, onClick }
 *   children   — additional dynamic content (modal expands to fit)
 *   testId
 */

const ICON_MAP = {
  info: { Icon: Info, color: "#3B82F6" },
  confirm: { Icon: AlertTriangle, color: "#F59E0B" },
  publish: { Icon: Send, color: "#FF5A00" },
  discard: { Icon: Trash2, color: "#6B7280" },
  success: { Icon: CheckCircle2, color: "#10B981" },
  danger: { Icon: AlertTriangle, color: "#EF4444" },
};

export const BrunoModal = ({
  open,
  onClose,
  variant = "info",
  title,
  description,
  primaryAction,
  secondaryAction,
  children,
  testId = "bruno-modal",
}) => {
  const { Icon, color } = ICON_MAP[variant] || ICON_MAP.info;

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          data-testid={`${testId}-overlay`}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Card — layout animation makes it expand to fit children */}
          <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl border border-black/5 dark:border-white/10"
            data-testid={testId}
            role="dialog"
            aria-modal="true"
          >
            {/* Brand orange header strip with logo */}
            <motion.div
              layout
              className="relative flex items-center gap-3 px-6 pt-5 pb-4"
            >
              <span
                aria-hidden
                className="absolute left-0 top-0 right-0 h-1"
                style={{ backgroundColor: "#FF5A00" }}
              />
              <motion.img
                src="/bruno-icon.png"
                alt="Bruno"
                initial={{ rotate: -10, scale: 0.6 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.05 }}
                className="h-10 w-10 rounded-xl object-contain bg-orange-50 dark:bg-orange-500/10 p-1 shrink-0"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.12, type: "spring", stiffness: 350, damping: 18 }}
                className="grid place-items-center h-10 w-10 rounded-full shrink-0"
                style={{ backgroundColor: `${color}15`, color }}
              >
                <Icon className="h-5 w-5" strokeWidth={2.4} />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.p
                  layout="position"
                  className="text-base font-bold text-zinc-900 dark:text-zinc-50 leading-tight"
                >
                  {title}
                </motion.p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full p-1.5 transition-colors"
                data-testid={`${testId}-close`}
              >
                <X className="h-5 w-5" />
              </button>
            </motion.div>

            {/* Body — dynamic, expands to fit */}
            <motion.div layout className="px-6 pb-5">
              {description && (
                <motion.p
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed"
                >
                  {description}
                </motion.p>
              )}
              {children && (
                <motion.div
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className={description ? "mt-3" : ""}
                >
                  {children}
                </motion.div>
              )}
            </motion.div>

            {/* Footer actions */}
            {(primaryAction || secondaryAction) && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22 }}
                className="px-6 py-4 bg-zinc-50 dark:bg-zinc-950/40 border-t border-black/5 dark:border-white/5 flex items-center justify-end gap-2 flex-wrap"
              >
                {secondaryAction && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={secondaryAction.onClick}
                    className="text-sm font-semibold rounded-full px-5 py-2.5 bg-transparent text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
                    data-testid={`${testId}-secondary`}
                  >
                    {secondaryAction.label}
                  </motion.button>
                )}
                {primaryAction && (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.loading}
                    className="text-sm font-semibold rounded-full px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                    style={
                      variant === "danger"
                        ? { backgroundColor: "#EF4444", boxShadow: "0 4px 14px rgba(239,68,68,0.35)" }
                        : undefined
                    }
                    data-testid={`${testId}-primary`}
                  >
                    {primaryAction.loading && (
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                        className="inline-block h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full"
                      />
                    )}
                    {primaryAction.label}
                  </motion.button>
                )}
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BrunoModal;
