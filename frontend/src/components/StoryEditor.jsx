import React, { useState, useRef, useCallback, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { isVideoFile } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StoryPlacePicker from "@/components/StoryPlacePicker";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Type, Sticker, Palette, Download, Send, Loader2, 
  Camera, Image as ImageIcon, Undo2, Trash2, Plus, Check,
  AlignCenter, AlignLeft, AlignRight, Bold, Italic,
  Sparkles, BarChart3, Music2, Layers, Move, RotateCcw
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Predefined sticker packs
const STICKER_PACKS = {
  emojis: ["fire", "heart", "star", "crown", "rocket", "wave", "sparkles", "party", "cool", "love", "laugh", "think", "clap", "100", "zap", "sun"],
  decorative: ["arrow_up", "arrow_down", "circle", "square", "diamond", "triangle", "line_h", "line_v", "bracket_l", "bracket_r", "dots", "dash"],
};

const STICKER_SVG = {
  fire: "M12 22c-4.97 0-9-3.58-9-8 0-3.39 2.63-6.33 4.5-8.5.62-.72 1.73-.16 1.56.77C8.58 9.6 10 8 10 5c0-.67.82-1 1.28-.5C14.06 7.83 16 11 16 14c0 .53-.06 1.04-.17 1.53C17.1 14.38 18 12.28 18 10c0-.7.86-1.04 1.3-.5C20.92 11.58 21 14 21 14c0 4.42-4.03 8-9 8z",
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  crown: "M2 17l3-10 4 5 3-8 3 8 4-5 3 10z M2 17h20v3H2z",
  rocket: "M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z",
  sparkles: "M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z",
};

// Gradient background presets
const BG_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #0c0c0c 0%, #1a1a2e 100%)",
  "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
  "linear-gradient(135deg, #2af598 0%, #009efd 100%)",
];

const FONT_FAMILIES = [
  { name: "Sans", value: "system-ui, sans-serif" },
  { name: "Serif", value: "Georgia, serif" },
  { name: "Mono", value: "monospace" },
  { name: "Cursive", value: "'Segoe Script', cursive" },
  { name: "Impact", value: "Impact, sans-serif" },
];

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FF6A00", "#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4"];

// Draggable text overlay item
const DraggableText = ({ item, onUpdate, onDelete, isSelected, onSelect }) => {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    const rect = ref.current.parentElement.getBoundingClientRect();
    startPos.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y, pw: rect.width, ph: rect.height };
    ref.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = ((e.clientX - startPos.current.x) / startPos.current.pw) * 100;
    const dy = ((e.clientY - startPos.current.y) / startPos.current.ph) * 100;
    onUpdate({ ...item, x: Math.max(0, Math.min(90, startPos.current.itemX + dx)), y: Math.max(0, Math.min(90, startPos.current.itemY + dy)) });
  };

  const handlePointerUp = () => setDragging(false);

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute cursor-move select-none touch-none ${isSelected ? "ring-2 ring-white ring-offset-1 ring-offset-transparent" : ""}`}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `rotate(${item.rotation || 0}deg) scale(${item.scale || 1})`,
        fontFamily: item.fontFamily || "system-ui, sans-serif",
        fontSize: `${item.fontSize || 24}px`,
        color: item.color || "#FFFFFF",
        fontWeight: item.bold ? "bold" : "normal",
        fontStyle: item.italic ? "italic" : "normal",
        textAlign: item.align || "center",
        textShadow: "0 2px 8px rgba(0,0,0,0.5)",
        zIndex: 10,
        maxWidth: "80%",
      }}
      data-testid={`story-text-overlay-${item.id}`}
    >
      {item.text}
      {isSelected && (
        <button
          className="absolute -top-3 -right-3 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          data-testid="delete-text-overlay"
        >
          <X className="w-3 h-3 text-white" />
        </button>
      )}
    </div>
  );
};

// Draggable sticker item
const DraggableSticker = ({ item, onUpdate, onDelete, isSelected, onSelect }) => {
  const ref = useRef(null);
  const [dragging, setDragging] = useState(false);
  const startPos = useRef({ x: 0, y: 0, itemX: 0, itemY: 0 });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    onSelect();
    setDragging(true);
    const rect = ref.current.parentElement.getBoundingClientRect();
    startPos.current = { x: e.clientX, y: e.clientY, itemX: item.x, itemY: item.y, pw: rect.width, ph: rect.height };
    ref.current.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = ((e.clientX - startPos.current.x) / startPos.current.pw) * 100;
    const dy = ((e.clientY - startPos.current.y) / startPos.current.ph) * 100;
    onUpdate({ ...item, x: Math.max(0, Math.min(90, startPos.current.itemX + dx)), y: Math.max(0, Math.min(90, startPos.current.itemY + dy)) });
  };

  const handlePointerUp = () => setDragging(false);

  const path = STICKER_SVG[item.stickerId] || STICKER_SVG.sparkles;

  return (
    <div
      ref={ref}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute cursor-move select-none touch-none ${isSelected ? "ring-2 ring-white/60 rounded-lg" : ""}`}
      style={{
        left: `${item.x}%`,
        top: `${item.y}%`,
        transform: `scale(${item.scale || 1})`,
        zIndex: 10,
      }}
      data-testid={`story-sticker-${item.id}`}
    >
      <svg viewBox="0 0 24 24" className="w-10 h-10 drop-shadow-lg" fill="white" stroke="none">
        <path d={path} />
      </svg>
      {isSelected && (
        <button
          className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X className="w-2.5 h-2.5 text-white" />
        </button>
      )}
    </div>
  );
};

// Main Story Editor component
const StoryEditor = ({ isOpen, onClose, onCreated }) => {
  const { token } = useAuth();
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Media state
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [extraSlides, setExtraSlides] = useState([]); // [{url,type}] for multi-image stories
  const [bgGradient, setBgGradient] = useState(BG_GRADIENTS[0]);
  const [mode, setMode] = useState("select"); // select, media, text, sticker, poll, bg
  const [publishAnimation, setPublishAnimation] = useState(null); // 'uploading' | 'success' | null
  
  // Overlays
  const [textOverlays, setTextOverlays] = useState([]);
  const [stickerOverlays, setStickerOverlays] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Text editing
  const [editingText, setEditingText] = useState("");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textFont, setTextFont] = useState(FONT_FAMILIES[0].value);
  const [textSize, setTextSize] = useState(24);
  const [textBold, setTextBold] = useState(false);
  const [textItalic, setTextItalic] = useState(false);
  const [textAlign, setTextAlign] = useState("center");
  
  // Poll
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  
  // Publish
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [place, setPlace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const nextId = useRef(1);
  const getId = () => nextId.current++;

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Upload all files in parallel. The first becomes the main media; the
    // rest become queued slides published as sequential stories.
    const uploads = await Promise.allSettled(files.map(async (file) => {
      const fd = new FormData();
      fd.append("file", file);
      try {
        const isVid = isVideoFile(file);
        const r = await axios.post(`${API}${isVid ? "/upload/chat-file" : "/upload/image?aspect=9:16"}`, fd, {
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
          timeout: 0,
        });
        return { url: r.data.url, type: isVid ? "video" : "image" };
      } catch (_err) {
        // local-only fallback
        return { url: URL.createObjectURL(file), type: isVideoFile(file) ? "video" : "image" };
      }
    }));
    const ok = uploads.filter((u) => u.status === "fulfilled").map((u) => u.value);
    if (ok.length === 0) return;
    setMediaUrl(ok[0].url);
    setMediaType(ok[0].type);
    setExtraSlides(ok.slice(1));
    setMode("select");
  };

  const addTextOverlay = () => {
    if (!editingText.trim()) return;
    setTextOverlays((prev) => [
      ...prev,
      {
        id: getId(),
        text: editingText,
        x: 10 + Math.random() * 30,
        y: 30 + Math.random() * 20,
        color: textColor,
        fontFamily: textFont,
        fontSize: textSize,
        bold: textBold,
        italic: textItalic,
        align: textAlign,
        rotation: 0,
        scale: 1,
      },
    ]);
    setEditingText("");
    setMode("select");
  };

  const addSticker = (stickerId) => {
    setStickerOverlays((prev) => [
      ...prev,
      {
        id: getId(),
        stickerId,
        x: 20 + Math.random() * 40,
        y: 20 + Math.random() * 40,
        scale: 1,
      },
    ]);
  };

  const updateTextOverlay = (updated) => {
    setTextOverlays((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const updateStickerOverlay = (updated) => {
    setStickerOverlays((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handlePublish = async () => {
    if (!token) return;
    setLoading(true);
    setPublishAnimation("uploading");
    try {
      // Build story data with overlays metadata
      const overlaysMeta = {
        texts: textOverlays.map(({ id, ...rest }) => rest),
        stickers: stickerOverlays.map(({ id, ...rest }) => rest),
        bgGradient: !mediaUrl ? bgGradient : null,
      };

      const slides = [
        { url: mediaUrl || "", type: mediaUrl ? mediaType : "text" },
        ...extraSlides,
      ];

      let pollId = null;
      if (pollQuestion.trim() && pollOptions.filter((o) => o.trim()).length >= 2) {
        const pollRes = await axios.post(
          `${API}/social/polls`,
          { question: pollQuestion, options: pollOptions.filter((o) => o.trim()), duration_hours: 24 },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        pollId = pollRes.data?.id || null;
      }

      // Publish slides sequentially — overlays are kept on the FIRST slide only
      for (let i = 0; i < slides.length; i++) {
        const s = slides[i];
        await axios.post(
          `${API}/stories`,
          {
            media_url: s.url || "",
            media_type: s.url ? s.type : (pollId && i === 0 ? "poll" : "text"),
            caption: i === 0 ? (caption || pollQuestion || "") : "",
            visibility,
            duration: s.type === "video" ? 15 : 5,
            ...(i === 0 ? { poll_id: pollId, overlays: overlaysMeta, location: place } : {}),
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      setPublishAnimation("success");
      onCreated?.();
      // Hold success animation briefly, then close
      setTimeout(() => {
        handleReset();
        onClose();
      }, 1100);
    } catch (err) {
      setPublishAnimation(null);
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMediaUrl("");
    setMediaType("image");
    setExtraSlides([]);
    setTextOverlays([]);
    setPlace(null);
    setStickerOverlays([]);
    setEditingText("");
    setPollQuestion("");
    setPollOptions(["", ""]);
    setCaption("");
    setMode("select");
    setShowPublish(false);
    setBgGradient(BG_GRADIENTS[0]);
    setPublishAnimation(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" data-testid="story-editor">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/80 backdrop-blur-md z-20">
        <Button variant="ghost" size="icon" onClick={() => { handleReset(); onClose(); }} className="text-white" data-testid="story-editor-close">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1">
          {[
            { id: "text", icon: Type, label: "Texto" },
            { id: "sticker", icon: Sticker, label: "Sticker" },
            { id: "bg", icon: Palette, label: "Fondo" },
            { id: "poll", icon: BarChart3, label: "Encuesta" },
          ].map((tool) => (
            <button
              key={tool.id}
              onClick={() => setMode(mode === tool.id ? "select" : tool.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${mode === tool.id ? "bg-white text-black" : "bg-white/10 text-white hover:bg-white/20"}`}
              data-testid={`story-tool-${tool.id}`}
            >
              <tool.icon className="w-3.5 h-3.5 inline-block mr-1" />
              {tool.label}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          onClick={() => setShowPublish(true)}
          className="rounded-full bg-primary text-white text-xs px-4"
          data-testid="story-next-btn"
        >
          <Send className="w-3.5 h-3.5 mr-1" />
          Publicar
        </Button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden" ref={canvasRef} onClick={() => setSelectedItem(null)}>
        {/* Background */}
        <div className="absolute inset-0" style={{ background: mediaUrl ? "#000" : bgGradient }}>
          {mediaUrl && (
            mediaType === "video" ? (
              <video src={mediaUrl} className="w-full h-full object-contain" autoPlay loop muted playsInline />
            ) : (
              <img src={mediaUrl} alt="" className="w-full h-full object-contain" />
            )
          )}
        </div>

        {/* Text overlays */}
        {textOverlays.map((item) => (
          <DraggableText
            key={item.id}
            item={item}
            onUpdate={updateTextOverlay}
            onDelete={() => setTextOverlays((p) => p.filter((t) => t.id !== item.id))}
            isSelected={selectedItem === `text-${item.id}`}
            onSelect={() => setSelectedItem(`text-${item.id}`)}
          />
        ))}

        {/* Sticker overlays */}
        {stickerOverlays.map((item) => (
          <DraggableSticker
            key={item.id}
            item={item}
            onUpdate={updateStickerOverlay}
            onDelete={() => setStickerOverlays((p) => p.filter((s) => s.id !== item.id))}
            isSelected={selectedItem === `sticker-${item.id}`}
            onSelect={() => setSelectedItem(`sticker-${item.id}`)}
          />
        ))}

        {/* No media prompt */}
        {!mediaUrl && textOverlays.length === 0 && stickerOverlays.length === 0 && mode === "select" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-3 text-white/70 hover:text-white transition-colors"
              data-testid="story-add-media-btn"
            >
              <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center">
                <Camera className="w-8 h-8" />
              </div>
              <span className="text-sm">Toca para agregar foto o video</span>
              <span className="text-xs text-white/40">O usa las herramientas de arriba para crear</span>
            </button>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileSelect} data-testid="story-file-input" />

        {/* Multi-slide thumbnail strip — visible when there's more than 1 slide queued */}
        {(mediaUrl && extraSlides.length > 0) && (
          <div className="absolute left-2 right-2 bottom-3 z-20 flex items-center gap-1.5 overflow-x-auto scrollbar-hide" data-testid="story-slides-strip">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md rounded-full px-2 py-1.5">
              {/* Main slide */}
              <button className="relative w-9 h-12 rounded-md overflow-hidden ring-2 ring-white shrink-0">
                {mediaType === "video" ? (
                  <video src={mediaUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
                )}
              </button>
              {extraSlides.map((s, i) => (
                <button
                  key={`slide-${i}`}
                  className="relative w-9 h-12 rounded-md overflow-hidden ring-1 ring-white/30 shrink-0 group"
                  onClick={() => setExtraSlides((prev) => prev.filter((_, idx) => idx !== i))}
                  data-testid={`story-slide-${i}`}
                >
                  {s.type === "video" ? (
                    <video src={s.url} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={s.url} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Trash2 className="w-3 h-3 text-white" />
                  </div>
                </button>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-12 rounded-md border-2 border-dashed border-white/30 grid place-items-center text-white/60 hover:text-white shrink-0"
                data-testid="story-add-more-slides"
                aria-label="Agregar más imágenes"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panels */}
      <AnimatePresence>
        {/* Text tool panel */}
        {mode === "text" && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 space-y-3"
            data-testid="story-text-panel"
          >
            <div className="flex items-center gap-2">
              <Input
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                placeholder="Escribe tu texto..."
                className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/40"
                autoFocus
                data-testid="story-text-input"
              />
              <Button size="sm" onClick={addTextOverlay} disabled={!editingText.trim()} className="shrink-0" data-testid="story-add-text-btn">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Font family */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.name}
                  onClick={() => setTextFont(f.value)}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${textFont === f.value ? "bg-white text-black" : "bg-white/10 text-white"}`}
                  style={{ fontFamily: f.value }}
                >
                  {f.name}
                </button>
              ))}
            </div>
            
            {/* Text controls */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <button onClick={() => setTextBold(!textBold)} className={`w-7 h-7 rounded flex items-center justify-center ${textBold ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setTextItalic(!textItalic)} className={`w-7 h-7 rounded flex items-center justify-center ${textItalic ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex gap-1">
                {["left", "center", "right"].map((a) => {
                  const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                  return (
                    <button key={a} onClick={() => setTextAlign(a)} className={`w-7 h-7 rounded flex items-center justify-center ${textAlign === a ? "bg-white text-black" : "bg-white/10 text-white"}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
              <input
                type="range" min="12" max="64" value={textSize}
                onChange={(e) => setTextSize(Number(e.target.value))}
                className="flex-1 accent-primary h-1"
              />
              <span className="text-white/50 text-xs w-6">{textSize}</span>
            </div>
            
            {/* Color picker */}
            <div className="flex gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setTextColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${textColor === c ? "border-white scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Sticker panel */}
        {mode === "sticker" && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4"
            data-testid="story-sticker-panel"
          >
            <p className="text-white/60 text-xs font-medium mb-2 uppercase tracking-wider">Stickers</p>
            <div className="grid grid-cols-8 gap-2">
              {Object.keys(STICKER_SVG).map((id) => (
                <button
                  key={id}
                  onClick={() => addSticker(id)}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
                  data-testid={`sticker-${id}`}
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="white" stroke="none">
                    <path d={STICKER_SVG[id]} />
                  </svg>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Background gradient panel */}
        {mode === "bg" && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4"
            data-testid="story-bg-panel"
          >
            <p className="text-white/60 text-xs font-medium mb-2 uppercase tracking-wider">Fondo</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {BG_GRADIENTS.map((g, i) => (
                <button
                  key={`g-${i}`}
                  onClick={() => { setBgGradient(g); setMode("select"); }}
                  className={`w-10 h-10 rounded-xl shrink-0 transition-all ${bgGradient === g ? "ring-2 ring-white scale-110" : ""}`}
                  style={{ background: g }}
                  data-testid={`story-bg-${i}`}
                />
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0"
              >
                <ImageIcon className="w-5 h-5 text-white/60" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Poll panel */}
        {mode === "poll" && (
          <motion.div
            initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4 space-y-3 max-h-[40vh] overflow-y-auto"
            data-testid="story-poll-panel"
          >
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Encuesta</p>
            <Input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Tu pregunta..."
              className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="story-poll-question"
            />
            {pollOptions.map((opt, idx) => (
              <div key={`opt-${idx}`} className="flex gap-2">
                <Input
                  value={opt}
                  onChange={(e) => { const n = [...pollOptions]; n[idx] = e.target.value; setPollOptions(n); }}
                  placeholder={`Opcion ${idx + 1}`}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  data-testid={`story-poll-opt-${idx}`}
                />
                {pollOptions.length > 2 && (
                  <Button variant="ghost" size="icon" onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))} className="text-red-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            {pollOptions.length < 4 && (
              <Button variant="outline" size="sm" className="w-full border-white/20 text-white" onClick={() => setPollOptions([...pollOptions, ""])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Agregar opcion
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish overlay */}
      <AnimatePresence>
        {showPublish && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-end"
            onClick={() => setShowPublish(false)}
          >
            <motion.div
              initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}
              className="w-full bg-card rounded-t-3xl p-5 space-y-4"
              onClick={(e) => e.stopPropagation()}
              data-testid="story-publish-panel"
            >
              <div className="w-8 h-1 bg-muted-foreground/30 rounded-full mx-auto" />
              <h3 className="font-bold text-lg">Publicar historia</h3>
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Agrega un texto..."
                data-testid="story-publish-caption"
              />
              <div>
                <label className="text-sm font-medium mb-2 block">Visibilidad</label>
                <div className="flex gap-2">
                  {[
                    { id: "public", label: "Todos" },
                    { id: "followers", label: "Seguidores" },
                    { id: "private", label: "Solo yo" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setVisibility(opt.id)}
                      className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${visibility === opt.id ? "bg-primary text-white" : "bg-muted"}`}
                      data-testid={`story-vis-${opt.id}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <StoryPlacePicker token={token} value={place} onChange={setPlace} onClose={() => { setShowPublish(false); onClose?.(); }} />
              <Button className="w-full" onClick={handlePublish} disabled={loading} data-testid="story-publish-confirm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {extraSlides.length > 0 ? `Publicar ${extraSlides.length + 1} historias` : "Publicar ahora"}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Publish animation overlay — covers screen with progress + success */}
      <AnimatePresence>
        {publishAnimation && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl flex items-center justify-center"
            data-testid="story-publish-animation"
          >
            <motion.div
              key={publishAnimation}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="flex flex-col items-center gap-4"
            >
              {publishAnimation === "uploading" ? (
                <>
                  <div className="relative w-20 h-20">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-4 border-orange-500/30 border-t-orange-500"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Send className="w-7 h-7 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-white font-semibold text-sm">Publicando…</p>
                  {extraSlides.length > 0 && (
                    <p className="text-white/60 text-xs">{extraSlides.length + 1} slides en cola</p>
                  )}
                </>
              ) : (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ duration: 0.45 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/50"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-white font-bold text-lg"
                  >
                    ¡Historia publicada!
                  </motion.p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoryEditor;
