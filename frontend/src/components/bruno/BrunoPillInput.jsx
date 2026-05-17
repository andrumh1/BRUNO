import React, { useRef, useEffect, useState, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Plus, Camera, Mic, Smile, Loader2, X, Reply } from "lucide-react";

/**
 * BrunoPillInput — chat input rediseñado con el estilo "pill" de la nav Bruno.
 *
 * Características:
 *   • Forma de píldora con glass-blur naranja sutil al focus
 *   • Textarea auto-expandible (1 → 6 líneas)
 *   • Botones internos animados que aparecen/desaparecen según contexto
 *   • Banner de respuesta dinámico que crece arriba del input
 *   • Indicador de "escribiendo..." y estado de envío
 *
 * Props:
 *   value, onChange
 *   onSend(text)            — al enviar
 *   onAttach()              — abre menú de adjuntos
 *   onCamera()              — abre cámara
 *   onStickers()            — abre stickers
 *   onMicStart() onMicStop()— grabación de audio
 *   isRecording             — bool
 *   sending                 — bool
 *   uploading               — bool
 *   replyTo                 — { name, body } | null
 *   onCancelReply()
 *   placeholder
 */
export const BrunoPillInput = forwardRef(function BrunoPillInput(
  {
    value,
    onChange,
    onSend,
    onAttach,
    onCamera,
    onStickers,
    onMicStart,
    onMicStop,
    isRecording = false,
    sending = false,
    uploading = false,
    replyTo = null,
    onCancelReply,
    placeholder = "Escribe un mensaje...",
    onTyping,
    disabled = false,
  },
  ref
) {
  const textareaRef = useRef(null);
  const [focused, setFocused] = useState(false);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 6 * 22; // ~6 lines @ 22px
    ta.style.height = Math.min(ta.scrollHeight, max) + "px";
  }, [value]);

  const handleSubmit = (e) => {
    e?.preventDefault?.();
    if (!value?.trim() || sending) return;
    onSend?.(value);
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const hasText = Boolean(value?.trim());

  return (
    <div ref={ref} className="px-2 pb-2 pt-1.5">
      {/* Reply banner — appears above the pill */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ opacity: 0, y: 8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="mx-1 mb-1.5 rounded-2xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 px-3 py-2 flex items-start gap-2">
              <Reply className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-orange-600 dark:text-orange-300 uppercase tracking-wider">
                  Respondiendo a {replyTo.name || "mensaje"}
                </p>
                <p className="text-xs text-zinc-700 dark:text-zinc-200 truncate">
                  {replyTo.body || replyTo.preview || "..."}
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                className="shrink-0 rounded-full p-1 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-500/20"
                aria-label="Cancelar respuesta"
                data-testid="pill-cancel-reply"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-1.5"
        data-testid="bruno-pill-input"
      >
        {/* Plus button — outside the pill */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.88, rotate: 90 }}
          onClick={onAttach}
          disabled={uploading || isRecording}
          aria-label="Adjuntar"
          data-testid="pill-attach-btn"
          className="shrink-0 grid place-items-center h-11 w-11 rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-50 transition-colors"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Plus className="h-5 w-5" />
          )}
        </motion.button>

        {/* The Pill */}
        <motion.div
          layout
          animate={{
            boxShadow: focused
              ? "0 0 0 2px rgba(255,90,0,0.35), 0 6px 24px -8px rgba(255,90,0,0.25)"
              : "0 1px 3px rgba(0,0,0,0.06)",
          }}
          transition={{ duration: 0.25 }}
          className="flex-1 min-w-0 flex items-end gap-1 bg-white dark:bg-zinc-900 rounded-[28px] border border-zinc-200/80 dark:border-zinc-800 backdrop-blur-xl px-2 py-1"
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              onChange?.(e.target.value);
              onTyping?.();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            disabled={disabled || isRecording}
            placeholder={placeholder}
            rows={1}
            data-testid="pill-textarea"
            className="flex-1 min-w-0 bg-transparent resize-none outline-none border-0 px-2 py-2 text-sm text-zinc-900 dark:text-zinc-50 placeholder:text-zinc-400 leading-[22px]"
            style={{ maxHeight: 6 * 22 }}
          />

          {/* Sticker / emoji */}
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={onStickers}
            aria-label="Stickers"
            data-testid="pill-stickers-btn"
            className="shrink-0 grid place-items-center h-9 w-9 rounded-full text-zinc-500 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors"
          >
            <Smile className="h-5 w-5" />
          </motion.button>
        </motion.div>

        {/* Camera button — outside the pill, next to mic. Hidden when typing. */}
        <AnimatePresence initial={false}>
          {!hasText && (
            <motion.button
              key="cam-outside"
              type="button"
              initial={{ scale: 0, width: 0, marginLeft: 0 }}
              animate={{ scale: 1, width: 44, marginLeft: 0 }}
              exit={{ scale: 0, width: 0 }}
              transition={{ duration: 0.22 }}
              whileTap={{ scale: 0.9 }}
              onClick={onCamera}
              disabled={isRecording}
              aria-label="Cámara"
              data-testid="pill-camera-btn"
              className="shrink-0 grid place-items-center h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-orange-50 dark:hover:bg-orange-500/15 hover:text-orange-500 transition-colors overflow-hidden"
            >
              <Camera className="h-5 w-5 shrink-0" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Send / Mic button — outside the pill, swaps */}
        <div className="shrink-0 relative h-11 w-11">
          <AnimatePresence initial={false} mode="wait">
            {hasText ? (
              <motion.button
                key="send"
                type="submit"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                disabled={sending}
                aria-label="Enviar"
                data-testid="pill-send-btn"
                className="absolute inset-0 grid place-items-center rounded-full bg-orange-500 text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-50 transition-colors"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                type="button"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                onClick={isRecording ? onMicStop : onMicStart}
                aria-label={isRecording ? "Detener" : "Audio"}
                data-testid="pill-mic-btn"
                className={`absolute inset-0 grid place-items-center rounded-full transition-colors ${
                  isRecording
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/40 animate-pulse"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                <Mic className="h-5 w-5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
});

export default BrunoPillInput;
