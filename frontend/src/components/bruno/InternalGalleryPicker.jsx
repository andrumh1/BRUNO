/**
 * InternalGalleryPicker — animated in-app file picker.
 *
 *  Browsers cannot enumerate the device's full photo gallery for security
 *  reasons (no API exists outside of Android File Picker or the Photos app).
 *  However, we can:
 *
 *    1. Trigger a single native file picker that allows MULTI-select.
 *    2. After the user picks, show their selection inside an animated
 *       grid (with thumbnails generated from blobs) so they can review,
 *       deselect, reorder, or pick more.
 *    3. Once they confirm, fire `onConfirm(files: File[])`.
 *
 *  This gives a "native-feeling" internal gallery that ALSO works on iOS
 *  (where there is no `chooseDir` style API), avoiding the awkward native
 *  file-picker that breaks the camera flow.
 *
 *  Props:
 *    open           boolean
 *    onClose()
 *    onConfirm(files)
 *    accept         e.g. "image/*", "video/*", "image/*,video/*" (default)
 *    multiple       default true
 *    title          custom heading (default "Galería")
 */
/* eslint-disable */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Check, Loader2, ImageIcon, Video as VideoIcon } from "lucide-react";

export default function InternalGalleryPicker({
  open,
  onClose,
  onConfirm,
  accept = "image/*,video/*",
  multiple = true,
  title = "Galería",
}) {
  const fileInputRef = useRef(null);
  const [items, setItems] = useState([]); // [{ id, file, url, type }]

  // Auto-open native picker once when modal opens
  useEffect(() => {
    if (!open) {
      setItems([]);
      return;
    }
    const id = setTimeout(() => fileInputRef.current?.click(), 80);
    return () => clearTimeout(id);
  }, [open]);

  // Release object URLs on close to avoid memory leaks
  useEffect(() => () => items.forEach((it) => URL.revokeObjectURL(it.url)), [items]);

  const handleFiles = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (list.length === 0) return;
    const next = list.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      url: URL.createObjectURL(file),
      type: file.type.startsWith("video") ? "video" : "image",
    }));
    setItems((prev) => [...prev, ...next]);
  };

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((i) => i.id !== id);
    });
  };

  const confirm = () => {
    if (items.length === 0) return;
    onConfirm?.(items.map((it) => it.file));
    onClose?.();
  };

  const summary = useMemo(() => {
    const imgs = items.filter((i) => i.type === "image").length;
    const vids = items.filter((i) => i.type === "video").length;
    if (imgs && vids) return `${imgs} foto${imgs === 1 ? "" : "s"} · ${vids} video${vids === 1 ? "" : "s"}`;
    if (imgs) return `${imgs} foto${imgs === 1 ? "" : "s"}`;
    if (vids) return `${vids} video${vids === 1 ? "" : "s"}`;
    return "Sin selección";
  }, [items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose} data-testid="gallery-picker-backdrop">
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 32 }}
        className="bg-stone-950 text-white w-full max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col overflow-hidden border border-white/10"
        onClick={(e) => e.stopPropagation()}
        data-testid="gallery-picker"
      >
        {/* Grabber */}
        <div className="flex justify-center pt-2.5">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="grid place-items-center w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 shadow-md shadow-orange-500/40">
              <ImageIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">{title}</h3>
              <p className="text-[10px] text-white/55">{summary}</p>
            </div>
          </div>
          <button onClick={onClose} className="grid place-items-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20" data-testid="gallery-picker-close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {items.length === 0 ? (
            <div className="text-center py-10">
              <Loader2 className="w-6 h-6 mx-auto text-orange-400 animate-spin mb-2" />
              <p className="text-xs text-white/55">Esperando tu selección…</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-orange-500 hover:bg-orange-600 text-xs font-semibold"
                data-testid="gallery-picker-open-native"
              >
                <Plus className="w-3.5 h-3.5" /> Elegir archivos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              <AnimatePresence>
                {items.map((it, i) => (
                  <motion.div
                    key={it.id}
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 24, delay: i * 0.02 }}
                    className="relative aspect-square rounded-lg overflow-hidden bg-stone-800 group"
                    data-testid={`gallery-picker-item-${it.id}`}
                  >
                    {it.type === "video" ? (
                      <>
                        <video src={it.url} muted className="w-full h-full object-cover" preload="metadata" />
                        <div className="absolute inset-0 grid place-items-center bg-black/40">
                          <VideoIcon className="w-5 h-5 text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <img src={it.url} alt="" className="w-full h-full object-cover" />
                    )}
                    {/* Order badge */}
                    <span className="absolute top-1 left-1 text-[10px] font-bold bg-orange-500 text-white rounded-full w-5 h-5 grid place-items-center shadow">
                      {i + 1}
                    </span>
                    {/* Remove */}
                    <button
                      onClick={() => removeItem(it.id)}
                      className="absolute top-1 right-1 grid place-items-center w-5 h-5 rounded-full bg-black/60 hover:bg-red-500 transition-colors"
                      aria-label="Eliminar"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {/* Add more tile */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-white/20 hover:border-white/40 grid place-items-center text-white/40 hover:text-white/70 transition-colors"
                data-testid="gallery-picker-add-more"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[11px] text-white/60">Toca y manten para reordenar próximamente</p>
          <button
            onClick={confirm}
            disabled={items.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold shadow-md transition-all ${
              items.length === 0
                ? "bg-white/10 text-white/30"
                : "bg-orange-500 hover:bg-orange-600 text-white shadow-orange-500/40"
            }`}
            data-testid="gallery-picker-confirm"
          >
            <Check className="w-3.5 h-3.5" /> Usar selección
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleFiles}
          data-testid="gallery-picker-input"
        />
      </motion.div>
    </div>
  );
}
