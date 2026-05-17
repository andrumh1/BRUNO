import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Users,
  Lock,
  Globe2,
  Check,
  Loader2,
  Type,
} from "lucide-react";
import axios from "axios";
import BrunoQuickCamera from "@/components/bruno/BrunoQuickCamera";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useAuth } from "@/contexts/AuthContext";

/**
 * QuickStoryButton — single-tap capture & publish story.
 *
 * Flow:
 *   1. User taps the button → opens BrunoQuickCamera.
 *   2. User captures photo/video with filter.
 *   3. Caption + visibility overlay appears.
 *   4. One tap on "Publicar" → upload + create story.
 *
 * Props:
 *   variant: "floating" | "inline" | "icon"  (visual treatment)
 *   onPublished(story)
 *   testId
 */
const API = process.env.REACT_APP_BACKEND_URL + "/api";

const VISIBILITY_OPTIONS = [
  { id: "public", label: "Público", Icon: Globe2 },
  { id: "followers", label: "Seguidores", Icon: Users },
  { id: "private", label: "Solo yo", Icon: Lock },
];

function CaptionOverlay({ file, filterId, onPublished, onCancel }) {
  const { token } = useAuth();
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [publishing, setPublishing] = useState(false);
  const previewUrl = React.useMemo(() => URL.createObjectURL(file), [file]);
  const isVideo = file.type.startsWith("video");

  React.useEffect(() => () => URL.revokeObjectURL(previewUrl), [previewUrl]);

  const publish = async () => {
    setPublishing(true);
    try {
      // 1. Upload media
      const form = new FormData();
      form.append("file", file);
      const uploadEndpoint = isVideo ? "/upload/chat-file" : "/upload/image";
      const uploadRes = await axios.post(`${API}${uploadEndpoint}`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const mediaUrl = uploadRes.data.url || uploadRes.data.secure_url;
      if (!mediaUrl) throw new Error("No URL returned");

      // 2. Create story
      const storyRes = await axios.post(
        `${API}/stories/`,
        {
          media_url: mediaUrl,
          media_type: isVideo ? "video" : "image",
          caption: caption.trim() || null,
          duration: isVideo ? 15 : 5,
          visibility,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      brunoToast.publish("Story publicada", {
        description: "Disponible durante 24h en tu perfil.",
      });
      onPublished?.(storyRes.data);
    } catch (e) {
      brunoToast.error("No se pudo publicar", {
        description: e?.response?.data?.detail || "Intenta de nuevo.",
      });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[130] bg-black"
      data-testid="quick-story-caption"
    >
      {/* Media preview */}
      <div className="absolute inset-0 grid place-items-center">
        {isVideo ? (
          <video
            src={previewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="max-h-full max-w-full"
          />
        ) : (
          <img
            src={previewUrl}
            alt="story preview"
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>

      {/* Bruno header */}
      <div className="absolute top-0 inset-x-0 z-10 px-4 py-3 bg-gradient-to-b from-black/60 to-transparent flex items-center justify-between">
        <button
          onClick={onCancel}
          disabled={publishing}
          className="text-white/90 text-sm font-semibold rounded-full px-3 py-1.5 hover:bg-white/10"
        >
          Cancelar
        </button>
        <div className="flex items-center gap-2">
          <img src="/bruno-icon.png" alt="Bruno" className="h-7 w-7 rounded-lg object-contain" />
          <span className="text-white text-sm font-bold">Story rápida</span>
        </div>
        <span className="text-[10px] font-bold text-orange-300 bg-orange-500/20 rounded-full px-2 py-1 uppercase tracking-wider">
          {filterId !== "none" ? filterId : "Original"}
        </span>
      </div>

      {/* Footer: caption + visibility + publish */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-5 pt-10 bg-gradient-to-t from-black via-black/70 to-transparent">
        <div className="px-4 space-y-3">
          {/* Caption */}
          <div className="flex items-start gap-2 bg-white/10 backdrop-blur rounded-2xl border border-white/15 px-3 py-2">
            <Type className="h-4 w-4 text-white/60 mt-0.5 shrink-0" />
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Agrega un caption..."
              rows={1}
              maxLength={200}
              data-testid="quick-story-caption-input"
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 resize-none outline-none leading-snug max-h-24"
            />
          </div>

          {/* Visibility chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-none">
            {VISIBILITY_OPTIONS.map(({ id, label, Icon }) => {
              const active = visibility === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setVisibility(id)}
                  data-testid={`quick-story-visibility-${id}`}
                  className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                    active
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/10 border-white/20 text-white/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          {/* Publish */}
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={publish}
            disabled={publishing}
            data-testid="quick-story-publish"
            className="w-full grid place-items-center h-12 rounded-full bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-500/40 disabled:opacity-60"
          >
            {publishing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Publicando...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4" /> Publicar Story · 24h
              </span>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export default function QuickStoryButton({
  variant = "floating",
  onPublished,
  testId = "quick-story-btn",
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // { file, filterId }

  const handleCapture = (file, meta) => {
    setOpen(false);
    setPending({ file, filterId: meta?.filterId || "none" });
  };

  const reset = () => {
    setPending(null);
  };

  const handlePublished = (story) => {
    reset();
    onPublished?.(story);
  };

  const buttonClass = {
    floating:
      "fixed bottom-24 right-4 z-40 grid place-items-center h-14 w-14 rounded-full bg-orange-500 text-white shadow-2xl shadow-orange-500/40 hover:bg-orange-600",
    inline:
      "inline-flex items-center gap-2 rounded-full px-4 py-2.5 bg-orange-500 text-white text-sm font-semibold shadow-md shadow-orange-500/30 hover:bg-orange-600",
    icon: "grid place-items-center h-11 w-11 rounded-full bg-orange-500 text-white shadow-md shadow-orange-500/30 hover:bg-orange-600",
  }[variant];

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => setOpen(true)}
        data-testid={testId}
        className={buttonClass}
        aria-label="Crear story rápida"
      >
        <Sparkles className={variant === "inline" ? "h-4 w-4" : "h-6 w-6"} />
        {variant === "inline" && <span>Story rápida</span>}
      </motion.button>

      <BrunoQuickCamera
        open={open}
        onClose={() => setOpen(false)}
        onCapture={handleCapture}
        mode="both"
      />

      <AnimatePresence>
        {pending && (
          <CaptionOverlay
            file={pending.file}
            filterId={pending.filterId}
            onCancel={reset}
            onPublished={handlePublished}
          />
        )}
      </AnimatePresence>
    </>
  );
}
