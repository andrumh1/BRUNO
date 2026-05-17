import React from "react";
import { toast as sonnerToast } from "sonner";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Info,
  Loader2,
  UserPlus,
  Trash2,
  Send,
  Heart,
  X,
} from "lucide-react";

/**
 * BRUNO Toast System — fully branded, animated, dynamic-expand.
 *
 * Usage:
 *   import { brunoToast } from "@/components/bruno/BrunoToast";
 *   brunoToast.success("Card published");
 *   brunoToast.loading("Uploading...");
 *   brunoToast.follow("Now following Bruno");
 *   brunoToast.publish("Your card is live");
 *   brunoToast.discard("Draft discarded");
 *   brunoToast.dismiss(id);
 *
 * Each toast renders with the Bruno logo and the brand orange accent.
 */

const VARIANTS = {
  success: {
    icon: CheckCircle2,
    color: "#10B981",
    ring: "ring-emerald-400/30",
    label: "Hecho",
  },
  error: {
    icon: AlertTriangle,
    color: "#EF4444",
    ring: "ring-red-400/30",
    label: "Error",
  },
  info: {
    icon: Info,
    color: "#3B82F6",
    ring: "ring-blue-400/30",
    label: "Info",
  },
  loading: {
    icon: Loader2,
    color: "#FF5A00",
    ring: "ring-orange-400/30",
    label: "Cargando",
  },
  follow: {
    icon: UserPlus,
    color: "#FF5A00",
    ring: "ring-orange-400/30",
    label: "Siguiendo",
  },
  publish: {
    icon: Send,
    color: "#FF5A00",
    ring: "ring-orange-400/30",
    label: "Publicado",
  },
  discard: {
    icon: Trash2,
    color: "#6B7280",
    ring: "ring-gray-400/30",
    label: "Descartado",
  },
  like: {
    icon: Heart,
    color: "#EC4899",
    ring: "ring-pink-400/30",
    label: "Me gusta",
  },
};

const BrunoToastCard = ({ variant, title, description, action, onClose, t }) => {
  const v = VARIANTS[variant] || VARIANTS.info;
  const Icon = v.icon;
  const isLoading = variant === "loading";

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      layout
      role="status"
      aria-live="polite"
      data-testid={`bruno-toast-${variant}`}
      className={`pointer-events-auto relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-2xl ring-1 ${v.ring} border border-black/5 dark:border-white/10`}
    >
      {/* Orange brand stripe */}
      <span
        aria-hidden
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: "#FF5A00" }}
      />

      <div className="flex items-start gap-3 pl-4 pr-3 py-3">
        {/* Bruno logo */}
        <motion.img
          src="/bruno-icon.png"
          alt="Bruno"
          initial={{ rotate: -8, scale: 0.7 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="h-9 w-9 rounded-lg object-contain shrink-0 bg-orange-50 dark:bg-orange-500/10 p-1"
        />

        {/* Variant icon badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.05, type: "spring", stiffness: 350, damping: 20 }}
          className="shrink-0 grid place-items-center h-9 w-9 rounded-full"
          style={{ backgroundColor: `${v.color}15`, color: v.color }}
        >
          <Icon
            className={`h-5 w-5 ${isLoading ? "animate-spin" : ""}`}
            strokeWidth={2.4}
          />
        </motion.div>

        {/* Body — expands to fit content */}
        <motion.div layout className="flex-1 min-w-0 pt-0.5">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 leading-tight">
            {title}
          </p>
          {description && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              transition={{ duration: 0.25, delay: 0.1 }}
              className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed"
            >
              {description}
            </motion.p>
          )}
          {action && (
            <motion.button
              onClick={() => {
                action.onClick?.();
                sonnerToast.dismiss(t);
              }}
              whileTap={{ scale: 0.96 }}
              className="mt-2 text-xs font-semibold rounded-full px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              data-testid={`bruno-toast-action-${variant}`}
            >
              {action.label}
            </motion.button>
          )}
        </motion.div>

        {/* Close */}
        {!isLoading && (
          <button
            onClick={() => {
              onClose?.();
              sonnerToast.dismiss(t);
            }}
            className="shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-full p-1 transition-colors"
            aria-label="Cerrar"
            data-testid={`bruno-toast-close-${variant}`}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Animated progress bar (auto-dismiss) */}
      {!isLoading && (
        <motion.span
          aria-hidden
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{ duration: 4, ease: "linear" }}
          style={{ originX: 0, backgroundColor: v.color }}
          className="absolute bottom-0 left-0 right-0 h-[2px] opacity-60"
        />
      )}
    </motion.div>
  );
};

const renderToast = (variant) => (title, options = {}) => {
  const { description, duration, action, id, onClose } = options;
  return sonnerToast.custom(
    (t) => (
      <BrunoToastCard
        t={t}
        variant={variant}
        title={title}
        description={description}
        action={action}
        onClose={onClose}
      />
    ),
    {
      duration: variant === "loading" ? Infinity : duration ?? 4000,
      id,
    }
  );
};

export const brunoToast = {
  success: renderToast("success"),
  error: renderToast("error"),
  info: renderToast("info"),
  loading: renderToast("loading"),
  follow: renderToast("follow"),
  publish: renderToast("publish"),
  discard: renderToast("discard"),
  like: renderToast("like"),
  dismiss: (id) => sonnerToast.dismiss(id),
  /**
   * Promise toast: shows loading, then auto switches to success/error.
   * brunoToast.promise(uploadFn(), { loading: "Subiendo...", success: "Listo", error: "Falló" })
   */
  promise: async (promise, { loading, success, error }) => {
    const id = brunoToast.loading(loading || "Procesando...");
    try {
      const result = await promise;
      brunoToast.dismiss(id);
      brunoToast.success(typeof success === "function" ? success(result) : success || "Listo");
      return result;
    } catch (err) {
      brunoToast.dismiss(id);
      brunoToast.error(typeof error === "function" ? error(err) : error || "Algo salió mal");
      throw err;
    }
  },
};

export default brunoToast;
