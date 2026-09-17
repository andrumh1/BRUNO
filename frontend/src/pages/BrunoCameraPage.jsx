/* eslint-disable */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isVideoFile } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InternalGalleryPicker from "@/components/bruno/InternalGalleryPicker";
import axios from "axios";
import * as faceapi from "face-api.js";
import {
  Camera,
  Video,
  X,
  Check,
  RotateCcw,
  Sparkles,
  Type,
  Sticker,
  Palette,
  Share2,
  FlipHorizontal,
  Loader2,
  Image as ImageIcon,
  Smile,
  Wand2,
  Cat,
  Dog,
  Rabbit,
  Crown,
  Heart,
  Star,
  Zap,
  Sun,
  Moon,
  CloudRain,
  ChevronDown,
  Timer,
  Bolt,
  Send,
  ArrowLeft,
  Music2,
  AlertCircle,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// ==================== FILTER DATA ====================

const COLOR_FILTERS = [
  { id: "none", name: "Original", filter: "", color: "#888" },
  { id: "beauty", name: "Beauty", filter: "brightness(1.05) contrast(0.95) saturate(1.1)", color: "#FFB6C1" },
  { id: "glow", name: "Glow", filter: "brightness(1.15) contrast(0.9) saturate(1.2)", color: "#FFE4B5" },
  { id: "soft", name: "Soft", filter: "brightness(1.1) contrast(0.85) saturate(0.9)", color: "#E8D5B7" },
  { id: "vivid", name: "Vivido", filter: "saturate(1.6) contrast(1.15) brightness(1.05)", color: "#FF6B6B" },
  { id: "warm", name: "Calido", filter: "sepia(0.25) saturate(1.4) brightness(1.05)", color: "#FFA07A" },
  { id: "cool", name: "Fresco", filter: "hue-rotate(15deg) saturate(1.1) brightness(1.05)", color: "#87CEEB" },
  { id: "sunset", name: "Sunset", filter: "sepia(0.4) saturate(1.6) contrast(1.1) brightness(1.1)", color: "#FF7F50" },
  { id: "vintage", name: "Vintage", filter: "sepia(0.5) contrast(1.1) brightness(0.95)", color: "#D2B48C" },
  { id: "drama", name: "Drama", filter: "contrast(1.4) saturate(0.7) brightness(0.9)", color: "#696969" },
  { id: "bw", name: "B&N", filter: "grayscale(1) contrast(1.3)", color: "#555" },
  { id: "cinema", name: "Cinema", filter: "contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.15)", color: "#8B7355" },
  { id: "neon", name: "Neon", filter: "saturate(2) contrast(1.2) brightness(1.1) hue-rotate(-10deg)", color: "#39FF14" },
  { id: "dreamy", name: "Dreamy", filter: "brightness(1.2) contrast(0.8) saturate(1.3)", color: "#DDA0DD" },
  { id: "pop", name: "Pop", filter: "saturate(2.5) contrast(1.4) brightness(1.1)", color: "#FF1493" },
  { id: "midnight", name: "Night", filter: "brightness(0.85) contrast(1.2) saturate(0.8) hue-rotate(200deg)", color: "#191970" },
];

const BEAUTY_LEVELS = [
  { id: 0, name: "Off", blur: 0, brightness: 1 },
  { id: 1, name: "Suave", blur: 0.5, brightness: 1.02 },
  { id: 2, name: "Medio", blur: 1, brightness: 1.05 },
  { id: 3, name: "Alto", blur: 1.5, brightness: 1.08 },
  { id: 4, name: "Max", blur: 2, brightness: 1.12 },
];

const AR_FILTERS = [
  { id: "none", name: "Sin filtro", icon: X, type: "none" },
  { id: "cat", name: "Gatito", icon: Cat, type: "animal", ears: "cat", nose: "cat" },
  { id: "dog", name: "Perrito", icon: Dog, type: "animal", ears: "dog", nose: "dog" },
  { id: "rabbit", name: "Conejo", icon: Rabbit, type: "animal", ears: "rabbit", nose: "rabbit" },
  { id: "crown", name: "Corona", icon: Crown, type: "accessory", position: "top" },
  { id: "hearts", name: "Corazones", icon: Heart, type: "particles", particle: "heart" },
  { id: "stars", name: "Estrellas", icon: Star, type: "particles", particle: "star" },
  { id: "sparkles", name: "Brillos", icon: Sparkles, type: "particles", particle: "sparkle" },
  { id: "rainbow", name: "Arcoiris", icon: Zap, type: "effect", effect: "rainbow" },
  { id: "sunbeam", name: "Sol", icon: Sun, type: "effect", effect: "sunbeam" },
  { id: "moonlight", name: "Luna", icon: Moon, type: "effect", effect: "moonlight" },
  { id: "rain", name: "Lluvia", icon: CloudRain, type: "particles", particle: "rain" },
];

const STICKERS = [
  "❤️", "🔥", "⭐", "✨", "💯", "😎", "😍", "🎉",
  "💋", "🌈", "🦋", "🌸", "👑", "💎", "🚀", "🎵",
];

const TEXT_STYLES = [
  { id: "default", name: "Normal", font: "Inter, sans-serif", weight: "500" },
  { id: "bold", name: "Bold", font: "Inter, sans-serif", weight: "800" },
  { id: "neon", name: "Neon", font: "Inter, sans-serif", weight: "700", glow: true },
  { id: "cursive", name: "Elegante", font: "Georgia, serif", weight: "400", italic: true },
  { id: "retro", name: "Retro", font: "Impact, sans-serif", weight: "400" },
  { id: "mono", name: "Tech", font: "monospace", weight: "600" },
];

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FF5A00", "#FF3366", "#00D4FF", "#39FF14", "#FFD700", "#FF00FF", "#00FFFF", "#FF6B6B"];

const MODES = [
  { id: "photo", label: "Foto" },
  { id: "video15", label: "15s" },
  { id: "video60", label: "60s" },
];

// ==================== MAIN COMPONENT ====================

const BrunoCameraPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  // "Usar este sonido": audio borrowed from another reel, mixed into the recording
  const [sound, setSound] = useState(null); // {source_post_id, name, url, author}
  const soundAudioRef = useRef(null);
  const soundCtxRef = useRef(null);
  useEffect(() => {
    const sid = searchParams.get("sound");
    if (!sid) return;
    axios.get(`${API}/posts/sound/${sid}`).then((r) => { if (r.data?.sound?.url) setSound(r.data.sound); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const stopSound = () => {
    try { soundAudioRef.current?.pause(); } catch (_) { /* ignore */ }
    soundAudioRef.current = null;
    try { soundCtxRef.current?.close(); } catch (_) { /* ignore */ }
    soundCtxRef.current = null;
  };

  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const animationFrameRef = useRef(null);
  const recordingTimerRef = useRef(null);

  // Camera state
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [mode, setMode] = useState("photo");
  const [flashOn, setFlashOn] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [recordTime, setRecordTime] = useState(0);

  // Capture & Edit
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [activePanel, setActivePanel] = useState(null); // 'filters', 'ar', 'beauty', 'stickers', 'text'

  // Filters
  const [colorFilter, setColorFilter] = useState("none");
  const [beautyLevel, setBeautyLevel] = useState(0);
  const [arFilter, setArFilter] = useState("none");

  // AR Detection
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetections, setFaceDetections] = useState([]);

  // Stickers & Text
  const [stickers, setStickers] = useState([]);
  const [texts, setTexts] = useState([]);
  const [newText, setNewText] = useState("");
  const [textStyle, setTextStyle] = useState("default");
  const [textColor, setTextColor] = useState("#FFFFFF");

  // Publishing
  const [publishing, setPublishing] = useState(false);
  const [caption, setCaption] = useState("");
  const [showCaption, setShowCaption] = useState(false);

  // Actionable camera/recording errors (permission denied, unsupported codec, ...)
  const [cameraError, setCameraError] = useState(null);

  // Permission state for the in-app gallery
  const [galleryPermission, setGalleryPermission] = useState(() => {
    try { return localStorage.getItem("bruno-gallery-granted") === "1"; } catch { return false; }
  });

  // Interactive elements panel (swipe-up): stickers/emojis/questions/polls
  const [interactivePanel, setInteractivePanel] = useState(null); // null | 'stickers' | 'emojis' | 'questions' | 'polls'
  const [questionText, setQuestionText] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Helper: open gallery with first-time permission framing
  const openGallery = () => {
    if (!galleryPermission) {
      try { localStorage.setItem("bruno-gallery-granted", "1"); } catch (_e) { /* ignore */ }
      setGalleryPermission(true);
    }
    setGalleryOpen(true);
  };

  // Swipe-up handler over the whole viewfinder → opens gallery (when not capturing)
  const swipeRef = useRef({ startY: 0, startX: 0, target: null, time: 0 });
  const handleTouchStart = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    swipeRef.current = { startY: t.clientY, startX: t.clientX, target: e.target, time: Date.now() };
  };
  const handleTouchEnd = (e) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dy = swipeRef.current.startY - t.clientY;
    const dx = Math.abs(swipeRef.current.startX - t.clientX);
    const dur = Date.now() - swipeRef.current.time;
    // Threshold: vertical swipe-up at least 70px, mostly vertical, under 600ms
    if (dy > 70 && dx < 60 && dur < 600 && !capturedMedia && !isRecording) {
      const targetEl = swipeRef.current.target;
      const fromEmoji = targetEl?.closest?.("[data-swipe-zone='emoji']");
      const fromGallery = targetEl?.closest?.("[data-swipe-zone='gallery']");
      if (fromEmoji) {
        setInteractivePanel("stickers");
      } else if (fromGallery) {
        openGallery();
      } else {
        // Default: swipe up anywhere on the viewfinder opens the in-app gallery
        openGallery();
      }
    }
  };

  // Load Face-API models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceExpressionNet.loadFromUri("/models"),
        ]);
        setModelsLoaded(true);
      } catch (error) {
        // error handled
      }
    };
    loadModels();
  }, []);

  // Initialize camera — restart when facing OR mode changes so recording
  // modes correctly acquire the audio track (photo mode intentionally
  // skips audio to avoid unnecessary permission prompts).
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [facingMode, mode === "photo"]);

  // Face detection loop
  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || capturedMedia) return;
    const detectFaces = async () => {
      if (videoRef.current?.readyState === 4) {
        try {
          const detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceExpressions();
          setFaceDetections(detections);
        } catch (_e) { /* face detection failure — keep last detections */ }
      }
      animationFrameRef.current = requestAnimationFrame(detectFaces);
    };
    detectFaces();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [modelsLoaded, capturedMedia]);

  // Render AR overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (arFilter === "none" || faceDetections.length === 0) return;
    const currentAR = AR_FILTERS.find((f) => f.id === arFilter);
    if (!currentAR) return;
    faceDetections.forEach((det) => {
      const lm = det.landmarks;
      const pos = lm.positions;
      const nose = lm.getNose();
      const jaw = lm.getJawOutline();
      const faceWidth = jaw[16].x - jaw[0].x;
      const mirrorX = (x) => (facingMode === "user" ? canvas.width - x : x);
      const data = { pos, nose, jaw, faceWidth, mirrorX, canvas };
      if (currentAR.type === "animal") drawAnimalFilter(ctx, currentAR, data);
      else if (currentAR.type === "accessory") drawAccessory(ctx, currentAR, data);
      else if (currentAR.type === "particles") drawParticles(ctx, currentAR, canvas);
      else if (currentAR.type === "effect") drawEffect(ctx, currentAR, canvas);
    });
  }, [faceDetections, arFilter, facingMode]);

  // Recording timer
  useEffect(() => {
    if (!isRecording) {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      return;
    }
    const maxSec = mode === "video15" ? 15 : 60;
    const startTime = Date.now();
    recordingTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      setRecordTime(Math.min(elapsed, maxSec));
      setRecordProgress(Math.min(elapsed / maxSec, 1));
      if (elapsed >= maxSec) stopRecording();
    }, 50);
    return () => clearInterval(recordingTimerRef.current);
  }, [isRecording, mode]);

  // ---------- AR Drawing Functions ----------

  const drawAnimalFilter = (ctx, filter, data) => {
    const { pos, nose, jaw, faceWidth, mirrorX, canvas } = data;
    ctx.save();
    const leftEarX = mirrorX(jaw[0].x - faceWidth * 0.1);
    const rightEarX = mirrorX(jaw[16].x + faceWidth * 0.1);
    const earY = pos[19].y - faceWidth * 0.5;
    const earSize = faceWidth * 0.35;
    const noseX = mirrorX(nose[3].x);
    const noseY = nose[6].y;
    const noseSize = faceWidth * 0.15;
    if (filter.ears === "cat") drawCatEars(ctx, leftEarX, rightEarX, earY, earSize);
    else if (filter.ears === "dog") drawDogEars(ctx, leftEarX, rightEarX, earY, earSize);
    else if (filter.ears === "rabbit") drawRabbitEars(ctx, leftEarX, rightEarX, earY, earSize);
    if (filter.nose) drawAnimalNose(ctx, noseX, noseY, noseSize, filter.nose);
    ctx.restore();
  };

  const drawCatEars = (ctx, lx, rx, y, s) => {
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath(); ctx.moveTo(lx, y + s); ctx.lineTo(lx - s / 2, y); ctx.lineTo(lx + s / 2, y + s); ctx.fill();
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath(); ctx.moveTo(lx, y + s * 0.7); ctx.lineTo(lx - s / 4, y + s * 0.3); ctx.lineTo(lx + s / 4, y + s * 0.7); ctx.fill();
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath(); ctx.moveTo(rx, y + s); ctx.lineTo(rx - s / 2, y + s); ctx.lineTo(rx + s / 2, y); ctx.fill();
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath(); ctx.moveTo(rx, y + s * 0.7); ctx.lineTo(rx - s / 4, y + s * 0.7); ctx.lineTo(rx + s / 4, y + s * 0.3); ctx.fill();
  };

  const drawDogEars = (ctx, lx, rx, y, s) => {
    ctx.fillStyle = "#8B4513";
    ctx.beginPath(); ctx.ellipse(lx - s * 0.3, y + s * 0.5, s * 0.4, s * 0.8, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(rx + s * 0.3, y + s * 0.5, s * 0.4, s * 0.8, 0.3, 0, Math.PI * 2); ctx.fill();
  };

  const drawRabbitEars = (ctx, lx, rx, y, s) => {
    ctx.fillStyle = "#FFFFFF"; ctx.strokeStyle = "#FFB6C1"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(lx, y - s * 0.5, s * 0.2, s * 1.2, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath(); ctx.ellipse(lx, y - s * 0.3, s * 0.1, s * 0.8, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath(); ctx.ellipse(rx, y - s * 0.5, s * 0.2, s * 1.2, 0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath(); ctx.ellipse(rx, y - s * 0.3, s * 0.1, s * 0.8, 0.2, 0, Math.PI * 2); ctx.fill();
  };

  const drawAnimalNose = (ctx, x, y, s, type) => {
    if (type === "cat" || type === "rabbit") {
      ctx.fillStyle = "#FF69B4";
      ctx.beginPath(); ctx.moveTo(x, y - s / 2); ctx.lineTo(x - s / 2, y + s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.fill();
      ctx.strokeStyle = "#333"; ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath(); ctx.moveTo(x - s, y + i * s * 0.3); ctx.lineTo(x - s * 2, y + i * s * 0.5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + s, y + i * s * 0.3); ctx.lineTo(x + s * 2, y + i * s * 0.5); ctx.stroke();
      }
    } else if (type === "dog") {
      ctx.fillStyle = "#333";
      ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.2, s * 0.2, s * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    }
  };

  const drawAccessory = (ctx, filter, data) => {
    const { pos, faceWidth, mirrorX } = data;
    if (filter.position === "top") {
      const cx = mirrorX((data.jaw[0].x + data.jaw[16].x) / 2);
      const cy = pos[19].y - faceWidth * 0.4;
      const cs = faceWidth * 0.8;
      ctx.fillStyle = "#FFD700"; ctx.strokeStyle = "#FFA500"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx - cs / 2, cy + cs * 0.3);
      ctx.lineTo(cx - cs * 0.3, cy);
      ctx.lineTo(cx - cs * 0.15, cy + cs * 0.2);
      ctx.lineTo(cx, cy - cs * 0.1);
      ctx.lineTo(cx + cs * 0.15, cy + cs * 0.2);
      ctx.lineTo(cx + cs * 0.3, cy);
      ctx.lineTo(cx + cs / 2, cy + cs * 0.3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#FF0000";
      ctx.beginPath(); ctx.arc(cx, cy + cs * 0.1, cs * 0.05, 0, Math.PI * 2); ctx.fill();
    }
  };

  const drawParticles = (ctx, filter, canvas) => {
    const t = Date.now() / 1000;
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(t + i * 0.5) * 0.5 + 0.5) * canvas.width;
      const y = ((t * 0.3 + i * 0.1) % 1) * canvas.height;
      const sz = 10 + Math.sin(t + i) * 5;
      ctx.globalAlpha = 0.5 + Math.sin(t * 2 + i) * 0.3;
      ctx.font = `${sz}px Arial`;
      ctx.textAlign = "center";
      if (filter.particle === "heart") ctx.fillText("❤️", x, y);
      else if (filter.particle === "star") ctx.fillText("⭐", x, y);
      else if (filter.particle === "sparkle") ctx.fillText("✨", x, y);
      else if (filter.particle === "rain") { ctx.fillStyle = "#ADD8E6"; ctx.fillRect(x, y, 2, 10); }
    }
    ctx.globalAlpha = 1;
  };

  const drawEffect = (ctx, filter, canvas) => {
    const t = Date.now() / 1000;
    if (filter.effect === "rainbow") {
      const g = ctx.createLinearGradient(0, 0, canvas.width, 0);
      g.addColorStop(0, "rgba(255,0,0,0.15)"); g.addColorStop(0.5, "rgba(0,255,0,0.15)"); g.addColorStop(1, "rgba(238,130,238,0.15)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (filter.effect === "sunbeam") {
      ctx.fillStyle = "rgba(255,200,100,0.12)";
      ctx.beginPath(); ctx.moveTo(canvas.width, 0);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI + t * 0.1; const r = canvas.width * 1.5; ctx.lineTo(canvas.width + Math.cos(a) * r, Math.sin(a) * r); }
      ctx.fill();
    } else if (filter.effect === "moonlight") {
      const g = ctx.createRadialGradient(canvas.width * 0.8, canvas.height * 0.2, 0, canvas.width * 0.8, canvas.height * 0.2, canvas.width * 0.5);
      g.addColorStop(0, "rgba(200,200,255,0.25)"); g.addColorStop(1, "rgba(100,100,150,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  // ---------- Camera Actions ----------

  const startCamera = async () => {
    try {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      // Use device-native aspect ratio so the preview is NOT digitally zoomed.
      // Forcing 1080x1920 makes the browser crop the wider sensor → false zoom.
      // Letting the device pick its sensor resolution keeps the field of view natural.
      const constraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          aspectRatio: { ideal: 16 / 9 },
        },
        audio: mode !== "photo",
      };
      let s;
      try {
        s = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (_inner) {
        // Fallback: completely permissive — lets the browser pick the best track
        s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: mode !== "photo",
        });
      }
      // Try to apply zoom=1 explicitly (some Android Chrome builds default to zoom>1)
      try {
        const track = s.getVideoTracks()[0];
        const caps = track?.getCapabilities?.();
        if (caps && caps.zoom && typeof caps.zoom.min === "number") {
          await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
        }
      } catch (_zoomErr) { /* ignore — not all devices expose zoom */ }
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraError(null);
    } catch (err) {
      // Show a user-friendly error explaining what to do.
      console.error("Camera init failed:", err);
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCameraError("Permiso denegado. Activa el acceso a la cámara desde los ajustes del navegador.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCameraError("No se encontró una cámara compatible en este dispositivo.");
      } else if (name === "NotReadableError") {
        setCameraError("La cámara está siendo usada por otra app. Ciérrala e intenta de nuevo.");
      } else {
        setCameraError("No pudimos iniciar la cámara. Recarga la página.");
      }
    }
  };

  const flipCamera = () => setFacingMode((p) => (p === "user" ? "environment" : "user"));

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d");
    if (facingMode === "user") { ctx.translate(c.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(v, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (overlayCanvasRef.current) ctx.drawImage(overlayCanvasRef.current, 0, 0);
    setCapturedMedia({ type: "photo", data: c.toDataURL("image/jpeg", 0.92) });
  };

  const startRecording = async () => {
    if (!stream) return;
    setRecordedChunks([]);
    setRecordTime(0);
    setRecordProgress(0);
    const chunks = [];
    // Pick the first mime type the browser can actually record.
    // Safari iOS < 17 can't record webm — it needs mp4. Chrome/Android prefer webm.
    const CANDIDATES = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4;codecs=h264,aac",
      "video/mp4",
    ];
    const supported = CANDIDATES.find((t) =>
      typeof MediaRecorder !== "undefined" &&
      typeof MediaRecorder.isTypeSupported === "function" &&
      MediaRecorder.isTypeSupported(t)
    );
    if (!supported) {
      setCameraError("Este navegador no soporta grabación de video. Prueba Chrome, Safari o la app nativa.");
      return;
    }
    // Mix borrowed sound + mic into one audio track (the recording carries the sound)
    let recStream = stream;
    if (sound?.url) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = ctx.createMediaStreamDestination();
        if (stream.getAudioTracks().length) ctx.createMediaStreamSource(stream).connect(dest);
        const el = new Audio();
        el.crossOrigin = "anonymous";
        el.src = sound.url;
        el.loop = true;
        const node = ctx.createMediaElementSource(el);
        node.connect(dest);
        node.connect(ctx.destination);
        await ctx.resume();
        await el.play().catch(() => {});
        soundAudioRef.current = el;
        soundCtxRef.current = ctx;
        recStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      } catch (_) { recStream = stream; }
    }
    let mr;
    try {
      mr = new MediaRecorder(recStream, { mimeType: supported });
    } catch (err) {
      console.error("MediaRecorder init failed:", err);
      setCameraError("No pudimos iniciar la grabación. Intenta cambiar el modo o reiniciar la app.");
      return;
    }
    const ext = supported.startsWith("video/mp4") ? "mp4" : "webm";
    mediaRecorderRef.current = mr;
    mediaRecorderRef.current._ext = ext; // remembered for the upload step
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: supported.split(";")[0] });
      setCapturedMedia({ type: "video", data: URL.createObjectURL(blob), ext });
    };
    mr.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    stopSound();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordProgress(0);
      setRecordTime(0);
    }
  };

  const retake = () => {
    setCapturedMedia(null);
    setStickers([]);
    setTexts([]);
    setCaption("");
    setShowCaption(false);
    setActivePanel(null);
  };

  const addSticker = (emoji) => {
    setStickers((p) => [...p, { id: Date.now(), emoji, x: 50, y: 40, scale: 1 }]);
  };

  const removeSticker = (id) => setStickers((p) => p.filter((s) => s.id !== id));

  const addText = () => {
    if (!newText.trim()) return;
    setTexts((p) => [...p, { id: Date.now(), text: newText, x: 50, y: 30, style: textStyle, color: textColor }]);
    setNewText("");
  };

  const removeText = (id) => setTexts((p) => p.filter((t) => t.id !== id));

  const handlePublish = async () => {
    if (!capturedMedia || !token) return;
    setPublishing(true);
    try {
      // Step 1: Upload media to Cloudinary
      const formData = new FormData();
      const resp = await fetch(capturedMedia.data);
      const blob = await resp.blob();
      const ext = capturedMedia.type === "photo"
        ? "jpg"
        : (capturedMedia.ext || (blob.type.includes("mp4") ? "mp4" : "webm"));
      formData.append("file", blob, `bruno_${Date.now()}.${ext}`);
      const uploadRes = await axios.post(`${API}/upload/image`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const mediaUrl = uploadRes.data.url;
      const up = uploadRes.data || {};

      // Step 2: If there's an embedded poll sticker, create the poll first so the story can link it.
      const pollSticker = stickers.find((s) => s.kind === "poll");
      let pollId = null;
      if (pollSticker) {
        try {
          const pollRes = await axios.post(`${API}/social/polls`, {
            question: pollSticker.question,
            options: pollSticker.options,
            duration_hours: 24,
          }, { headers: { Authorization: `Bearer ${token}` } });
          pollId = pollRes.data?.id || null;
        } catch (_e) { /* non-fatal */ }
      }

      const overlaysMeta = {
        texts: texts.map(({ id, ...rest }) => rest),
        stickers: stickers.map(({ id, ...rest }) => rest),
      };

      // Step 3: Create post (for feed) OR a Story when there's interactive content
      const isInteractive = !!pollSticker || stickers.some((s) => s.kind === "question");
      if (isInteractive) {
        await axios.post(`${API}/stories`, {
          media_url: mediaUrl,
          media_type: capturedMedia.type === "photo" ? "image" : "video",
          caption,
          visibility: "public",
          duration: capturedMedia.type === "photo" ? 5 : 15,
          poll_id: pollId,
          overlays: overlaysMeta,
        }, { headers: { Authorization: `Bearer ${token}` } });
        navigate("/feed");
      } else {
        const created = await axios.post(`${API}/posts`, {
          content: caption,
          media: [{ type: capturedMedia.type === "photo" ? "image" : "video", url: mediaUrl, mp4_url: up.mp4_url, poster_url: up.poster_url, f_auto_url: up.f_auto_url }],
          post_type: capturedMedia.type === "photo" ? "image" : "video",
          visibility: "public",
          audio: sound && capturedMedia.type !== "photo" ? { source_post_id: sound.source_post_id, name: sound.name, url: sound.url } : null,
        }, { headers: { Authorization: `Bearer ${token}` } });
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.publish(capturedMedia.type === "photo" ? "Publicación creada" : "Reel publicado", { description: "Ya aparece en tu perfil, el feed y Reels." });
        navigate(capturedMedia.type === "photo" ? `/post/${created.data?.id || ""}` : `/reels?id=${created.data?.id || ""}`);
      }
    } catch (err) {
      const { brunoToast } = await import("@/components/bruno/BrunoToast");
      brunoToast.error("No se pudo publicar", { description: err?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo." });
    } finally {
      setPublishing(false);
    }
  };

  const handleCapture = () => {
    if (mode === "photo") capturePhoto();
    else isRecording ? stopRecording() : startRecording();
  };

  const getFilterStyle = () => {
    const cf = COLOR_FILTERS.find((f) => f.id === colorFilter);
    const bl = BEAUTY_LEVELS[beautyLevel];
    let s = cf?.filter || "";
    if (bl?.blur > 0) s += ` blur(${bl.blur}px) brightness(${bl.brightness})`;
    return { filter: s.trim() || undefined };
  };

  const togglePanel = (panel) => setActivePanel((p) => (p === panel ? null : panel));

  if (!user) { navigate("/login"); return null; }

  // ==================== RENDER ====================

  return (
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50, paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }} data-testid="camera-page" data-no-safe-top>
      {/* Camera / recording error overlay — dismissible, non-blocking */}
      {cameraError && (
        <div
          className="absolute left-3 right-3 z-[60] rounded-xl bg-red-500/95 text-white px-4 py-3 shadow-2xl flex items-start gap-3 backdrop-blur-md"
          style={{ top: "calc(env(safe-area-inset-top, 12px) + 12px)" }}
          data-testid="camera-error-banner"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm leading-snug">{cameraError}</div>
          <button
            onClick={() => setCameraError(null)}
            className="text-white/80 hover:text-white shrink-0"
            data-testid="camera-error-dismiss"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ====== CAMERA VIEWFINDER ====== */}
      <div
        className="relative flex-1 overflow-hidden rounded-b-3xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {!capturedMedia ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none", ...getFilterStyle() }}
              data-testid="camera-video-feed"
            />
            <canvas ref={overlayCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }} />
          </>
        ) : (
          <div className="absolute inset-0">
            {capturedMedia.type === "photo" ? (
              <img src={capturedMedia.data} alt="Captured" className="w-full h-full object-cover" style={getFilterStyle()} />
            ) : (
              <video src={capturedMedia.data} controls loop autoPlay className="w-full h-full object-cover" style={getFilterStyle()} />
            )}
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />

        {/* ---- TOP BAR ---- */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-3 pb-8 bg-gradient-to-b from-black/60 via-black/20 to-transparent" style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top, 12px))" }}>
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-sm" data-testid="camera-close-btn">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          {/* Sound chip ("Usar este sonido") */}
          {sound ? (
            <div className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-orange-500/90 backdrop-blur-sm max-w-[60vw]" data-testid="camera-sound-chip">
              <Music2 className="w-3.5 h-3.5 text-white shrink-0" />
              <span className="text-white text-xs font-medium truncate">{sound.name}</span>
              <button onClick={() => { stopSound(); setSound(null); }} className="w-5 h-5 rounded-full bg-white/25 grid place-items-center text-white text-[10px]" data-testid="camera-sound-remove" aria-label="Quitar sonido">✕</button>
            </div>
          ) : (
            <button onClick={() => navigate("/reels")} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm" data-testid="camera-music-btn">
              <Music2 className="w-3.5 h-3.5 text-white" />
              <span className="text-white text-xs font-medium">Agregar sonido</span>
            </button>
          )}

          <div className="w-9" />
        </div>

        {/* ---- RIGHT SIDEBAR (TikTok-style) ---- */}
        {!capturedMedia && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4" data-testid="camera-sidebar">
            <SideBtn icon={FlipHorizontal} label="Voltear" onClick={flipCamera} testId="camera-flip-btn" />
            <SideBtn icon={Wand2} label="Belleza" onClick={() => togglePanel("beauty")} active={activePanel === "beauty" || beautyLevel > 0} testId="camera-beauty-btn" />
            <SideBtn icon={Smile} label="Efectos" onClick={() => togglePanel("ar")} active={activePanel === "ar" || arFilter !== "none"} testId="camera-ar-btn" />
            <SideBtn icon={Sticker} label="Stickers" onClick={() => setInteractivePanel("stickers")} active={!!interactivePanel} testId="camera-interactive-btn" swipeZone="emoji" />
            <SideBtn icon={Timer} label="Timer" testId="camera-timer-btn" />
            {!modelsLoaded && <Loader2 className="w-5 h-5 text-white/60 animate-spin" />}
          </div>
        )}

        {/* ---- RIGHT SIDEBAR for EDIT mode ---- */}
        {capturedMedia && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4" data-testid="camera-edit-sidebar">
            <SideBtn icon={Palette} label="Filtros" onClick={() => togglePanel("filters")} active={activePanel === "filters"} testId="camera-filters-btn" />
            <SideBtn icon={Sticker} label="Stickers" onClick={() => togglePanel("stickers")} active={activePanel === "stickers"} testId="camera-stickers-btn" />
            <SideBtn icon={Type} label="Texto" onClick={() => togglePanel("text")} active={activePanel === "text"} testId="camera-text-btn" />
          </div>
        )}

        {/* ---- STICKERS / QUESTIONS / POLLS OVERLAY ---- */}
        {stickers.map((s) => {
          if (s.kind === "question") {
            return (
              <div
                key={s.id}
                className="absolute cursor-pointer select-none px-4 py-3 rounded-2xl bg-white/95 text-stone-900 shadow-lg shadow-black/30 max-w-[80%]"
                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
                onClick={() => removeSticker(s.id)}
                data-testid={`overlay-question-${s.id}`}
              >
                <p className="text-[10px] uppercase tracking-wider font-bold text-orange-500 mb-1">Pregunta</p>
                <p className="text-sm font-semibold">{s.text}</p>
                <div className="mt-2 h-7 rounded-full bg-stone-100 flex items-center px-3 text-[11px] text-stone-400">
                  Tu respuesta…
                </div>
              </div>
            );
          }
          if (s.kind === "poll") {
            return (
              <div
                key={s.id}
                className="absolute cursor-pointer select-none px-3 py-2 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 text-white shadow-lg shadow-black/40 max-w-[80%]"
                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})` }}
                onClick={() => removeSticker(s.id)}
                data-testid={`overlay-poll-${s.id}`}
              >
                <p className="text-sm font-bold mb-2 text-center">{s.question}</p>
                <div className="flex flex-col gap-1.5">
                  {(s.options || []).map((opt, i) => (
                    <div key={`pop-${i}`} className="px-3 py-1.5 rounded-lg bg-white/20 text-xs font-medium text-center backdrop-blur-sm">
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div
              key={s.id}
              className="absolute cursor-pointer select-none"
              style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})`, fontSize: "2.5rem" }}
              onClick={() => removeSticker(s.id)}
            >
              {s.emoji}
            </div>
          );
        })}

        {/* ---- TEXT OVERLAY ---- */}
        {texts.map((t) => {
          const st = TEXT_STYLES.find((s) => s.id === t.style) || TEXT_STYLES[0];
          return (
            <div
              key={t.id}
              className="absolute cursor-pointer select-none px-3 py-1 rounded-lg"
              style={{
                left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)",
                fontFamily: st.font, fontWeight: st.weight, fontStyle: st.italic ? "italic" : "normal",
                color: t.color, fontSize: "1.4rem",
                textShadow: st.glow ? `0 0 10px ${t.color}, 0 0 20px ${t.color}` : "1px 2px 4px rgba(0,0,0,0.8)",
                background: "rgba(0,0,0,0.25)", backdropFilter: "blur(4px)",
              }}
              onClick={() => removeText(t.id)}
            >
              {t.text}
            </div>
          );
        })}

        {/* ---- RECORDING PROGRESS RING ---- */}
        {isRecording && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600/80 backdrop-blur-sm text-white px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-xs font-semibold tabular-nums">{recordTime.toFixed(1)}s</span>
          </div>
        )}

        {/* ---- BOTTOM PANEL OVERLAYS ---- */}
        {activePanel && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 backdrop-blur-xl border-t border-white/10 rounded-t-2xl animate-in slide-in-from-bottom-4 duration-200">
            <div className="p-3 max-h-52 overflow-y-auto">
              {/* Filters */}
              {activePanel === "filters" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-xs font-semibold tracking-wide uppercase">Filtros</span>
                    <button onClick={() => setActivePanel(null)} className="text-white/50"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {COLOR_FILTERS.map((f) => (
                      <button key={f.id} onClick={() => setColorFilter(f.id)} className="flex flex-col items-center gap-1 flex-shrink-0" data-testid={`filter-${f.id}`}>
                        <div className={`w-14 h-14 rounded-full border-2 transition-all overflow-hidden ${colorFilter === f.id ? "border-white scale-110 shadow-lg shadow-white/20" : "border-white/20"}`}>
                          <div className="w-full h-full rounded-full" style={{ background: `linear-gradient(135deg, ${f.color}, ${f.color}88)`, filter: f.filter }} />
                        </div>
                        <span className={`text-[10px] ${colorFilter === f.id ? "text-white font-semibold" : "text-white/50"}`}>{f.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Beauty */}
              {activePanel === "beauty" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-xs font-semibold tracking-wide uppercase">Belleza</span>
                    <button onClick={() => setActivePanel(null)} className="text-white/50"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-2">
                    {BEAUTY_LEVELS.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => setBeautyLevel(l.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${beautyLevel === l.id ? "bg-white text-black shadow-lg" : "bg-white/10 text-white/60"}`}
                        data-testid={`beauty-${l.id}`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AR Filters */}
              {activePanel === "ar" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-xs font-semibold tracking-wide uppercase">Efectos AR</span>
                    <button onClick={() => setActivePanel(null)} className="text-white/50"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {AR_FILTERS.map((f) => {
                      const Icon = f.icon;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setArFilter(f.id)}
                          className={`aspect-square rounded-2xl flex flex-col items-center justify-center gap-0.5 transition-all ${arFilter === f.id ? "bg-white text-black shadow-lg scale-105" : "bg-white/10 text-white/60"}`}
                          data-testid={`ar-${f.id}`}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-[7px] font-medium">{f.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stickers */}
              {activePanel === "stickers" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white text-xs font-semibold tracking-wide uppercase">Stickers</span>
                    <button onClick={() => setActivePanel(null)} className="text-white/50"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="grid grid-cols-8 gap-2">
                    {STICKERS.map((emoji, i) => (
                      <button key={`emoji-${i}`} onClick={() => addSticker(emoji)} className="text-2xl hover:scale-125 active:scale-90 transition-transform" data-testid={`sticker-${i}`}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Text */}
              {activePanel === "text" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-xs font-semibold tracking-wide uppercase">Texto</span>
                    <button onClick={() => setActivePanel(null)} className="text-white/50"><X className="w-4 h-4" /></button>
                  </div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      value={newText}
                      onChange={(e) => setNewText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addText()}
                      placeholder="Escribe aqui..."
                      className="flex-1 bg-white/10 border-white/20 text-white text-sm h-9"
                      data-testid="camera-text-input"
                    />
                    <Button onClick={addText} size="sm" className="h-9 px-3" data-testid="camera-text-add">
                      <Check className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
                    {TEXT_STYLES.map((s) => (
                      <button key={s.id} onClick={() => setTextStyle(s.id)} className={`px-2.5 py-1 rounded-full text-[10px] whitespace-nowrap transition-all ${textStyle === s.id ? "bg-white text-black font-bold" : "bg-white/10 text-white/60"}`}>
                        {s.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    {TEXT_COLORS.map((c) => (
                      <button key={c} onClick={() => setTextColor(c)} className={`w-6 h-6 rounded-full border-2 transition-all ${textColor === c ? "border-white scale-110" : "border-transparent"}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ====== BOTTOM CONTROLS ====== */}
      <div className="bg-black shrink-0">
        {!capturedMedia ? (
          <>
            {/* Filter strip (live mode) - horizontal scroll */}
            {!activePanel && (
              <div className="px-2 pt-2">
                <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hide">
                  {COLOR_FILTERS.slice(0, 10).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setColorFilter(f.id)}
                      className="flex flex-col items-center gap-0.5 flex-shrink-0"
                    >
                      <div className={`w-9 h-9 rounded-full border-2 transition-all ${colorFilter === f.id ? "border-white scale-110" : "border-white/15"}`}>
                        <div className="w-full h-full rounded-full" style={{ background: `linear-gradient(135deg, ${f.color}, ${f.color}88)`, filter: f.filter }} />
                      </div>
                      <span className={`text-[8px] ${colorFilter === f.id ? "text-white" : "text-white/40"}`}>{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mode selector + Capture button */}
            <div className="flex items-center justify-between px-4 py-3">
              {/* Gallery */}
              <button
                onClick={openGallery}
                data-swipe-zone="gallery"
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-90 flex items-center justify-center transition-all relative"
                data-testid="camera-gallery-btn"
                aria-label="Abrir galería (desliza hacia arriba)"
                title="Toca o desliza hacia arriba"
              >
                <ImageIcon className="w-5 h-5 text-white/70" />
                {!galleryPermission && (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-orange-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Center: Mode tabs + Capture */}
              <div className="flex flex-col items-center gap-2">
                {/* Mode Tabs */}
                <div className="flex items-center gap-1 bg-white/5 rounded-full p-0.5">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setMode(m.id); if (isRecording) stopRecording(); }}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold transition-all ${mode === m.id ? "bg-white text-black" : "text-white/50"}`}
                      data-testid={`mode-${m.id}`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {/* Capture Button */}
                <button
                  onClick={handleCapture}
                  className="relative w-[68px] h-[68px] flex items-center justify-center"
                  data-testid="camera-capture-btn"
                >
                  {/* Outer ring */}
                  <div className="absolute inset-0 rounded-full border-[3px] border-white/80" />
                  {/* Progress ring for recording */}
                  {isRecording && (
                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                      <circle cx="34" cy="34" r="31" fill="none" stroke="#FF3B30" strokeWidth="4" strokeDasharray={`${recordProgress * 195} 195`} strokeLinecap="round" />
                    </svg>
                  )}
                  {/* Inner button */}
                  <div className={`rounded-full transition-all duration-200 ${isRecording ? "w-7 h-7 rounded-lg bg-red-500" : mode === "photo" ? "w-[56px] h-[56px] bg-white" : "w-[56px] h-[56px] bg-red-500"}`} />
                </button>
              </div>

              {/* Flip */}
              <button onClick={flipCamera} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" data-testid="camera-flip-bottom-btn">
                <FlipHorizontal className="w-5 h-5 text-white/70" />
              </button>
            </div>
          </>
        ) : (
          /* POST-CAPTURE CONTROLS */
          <div className="px-4 py-3">
            {showCaption ? (
              <div className="flex items-center gap-2 mb-2">
                <Input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Escribe un pie de foto..."
                  className="flex-1 bg-white/10 border-white/20 text-white text-sm h-9"
                  autoFocus
                  data-testid="camera-caption-input"
                />
                <button onClick={() => setShowCaption(false)} className="text-white/50">
                  <Check className="w-5 h-5" />
                </button>
              </div>
            ) : null}

            <div className="flex items-center justify-between">
              {/* Retake */}
              <button onClick={retake} className="flex items-center gap-1.5 text-white/70" data-testid="camera-retake-btn">
                <RotateCcw className="w-5 h-5" />
                <span className="text-xs font-medium">Repetir</span>
              </button>

              {/* Caption toggle */}
              <button
                onClick={() => setShowCaption(!showCaption)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 text-white/70"
                data-testid="camera-caption-toggle"
              >
                <Type className="w-4 h-4" />
                <span className="text-xs">{caption || "Pie de foto..."}</span>
              </button>

              {/* Publish */}
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-primary to-orange-500 text-white font-semibold text-sm shadow-lg shadow-primary/30 disabled:opacity-50"
                data-testid="camera-publish-btn"
              >
                {publishing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Publicar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Internal animated gallery picker */}
        <InternalGalleryPicker
          open={galleryOpen}
          onClose={() => setGalleryOpen(false)}
          accept={mode !== "photo" ? "video/*" : "image/*,video/*"}
          multiple={false}
          onConfirm={(files) => {
            const file = files[0];
            if (!file) return;
            const url = URL.createObjectURL(file);
            const isVideo = isVideoFile(file);
            setCapturedMedia({ type: isVideo ? "video" : "photo", data: url, blob: file });
            if (isVideo && mode !== "video15" && mode !== "video60") setMode("video15");
          }}
        />

        {/* ====== INTERACTIVE PANEL (Stickers / Emojis / Questions / Polls) ====== */}
        {interactivePanel && (
          <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md flex items-end" onClick={() => setInteractivePanel(null)}>
            <div
              className="w-full bg-stone-950 rounded-t-3xl border-t border-white/10 max-h-[70vh] overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
              data-testid="camera-interactive-panel"
            >
              {/* Grabber */}
              <div className="flex justify-center pt-2.5">
                <div className="h-1.5 w-12 rounded-full bg-white/20" />
              </div>
              {/* Tabs */}
              <div className="flex items-center gap-1 px-3 py-2.5 border-b border-white/10">
                {[
                  { id: "stickers", label: "Stickers" },
                  { id: "emojis", label: "Emojis" },
                  { id: "questions", label: "Pregunta" },
                  { id: "polls", label: "Encuesta" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setInteractivePanel(tab.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${interactivePanel === tab.id ? "bg-white text-black" : "bg-white/10 text-white/60"}`}
                    data-testid={`interactive-tab-${tab.id}`}
                  >
                    {tab.label}
                  </button>
                ))}
                <button onClick={() => setInteractivePanel(null)} className="ml-auto text-white/60 hover:text-white" data-testid="interactive-panel-close">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-y-auto p-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
                {interactivePanel === "stickers" && (
                  <div className="grid grid-cols-8 gap-2" data-testid="interactive-stickers">
                    {STICKERS.map((emoji, i) => (
                      <button
                        key={`isticker-${i}`}
                        onClick={() => { addSticker(emoji); setInteractivePanel(null); }}
                        className="text-3xl hover:scale-125 active:scale-90 transition-transform"
                        data-testid={`interactive-sticker-${i}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {interactivePanel === "emojis" && (
                  <div className="grid grid-cols-8 gap-2" data-testid="interactive-emojis">
                    {["😀","😂","😍","😎","🤩","😭","😡","🤔","🥳","🤯","😴","🤮","👍","👎","🙏","👏","💪","🎉","🔥","💯","❤️","💔","💖","✨","⭐","🌟","🌈","🎵","🎶","🍕","🍔","🍻"].map((emoji, i) => (
                      <button
                        key={`iemoji-${i}`}
                        onClick={() => { addSticker(emoji); setInteractivePanel(null); }}
                        className="text-3xl hover:scale-125 active:scale-90 transition-transform"
                        data-testid={`interactive-emoji-${i}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                {interactivePanel === "questions" && (
                  <div className="space-y-3" data-testid="interactive-questions">
                    <p className="text-white text-sm font-semibold">Hazle una pregunta a tu audiencia</p>
                    <Input
                      value={questionText}
                      onChange={(e) => setQuestionText(e.target.value)}
                      placeholder="Ej. ¿Cuál es tu canción favorita?"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      data-testid="interactive-question-input"
                    />
                    <Button
                      disabled={!questionText.trim()}
                      onClick={() => {
                        setStickers((p) => [...p, {
                          id: Date.now(),
                          emoji: null,
                          kind: "question",
                          text: questionText.trim(),
                          x: 50, y: 40, scale: 1,
                        }]);
                        setQuestionText("");
                        setInteractivePanel(null);
                      }}
                      className="w-full"
                      data-testid="interactive-question-add"
                    >
                      Agregar pregunta
                    </Button>
                  </div>
                )}

                {interactivePanel === "polls" && (
                  <div className="space-y-3" data-testid="interactive-polls">
                    <p className="text-white text-sm font-semibold">Crea una encuesta</p>
                    <Input
                      value={pollQuestion}
                      onChange={(e) => setPollQuestion(e.target.value)}
                      placeholder="Tu pregunta…"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                      data-testid="interactive-poll-question"
                    />
                    {pollOptions.map((opt, idx) => (
                      <div key={`pop-${idx}`} className="flex items-center gap-2">
                        <Input
                          value={opt}
                          onChange={(e) => {
                            const next = [...pollOptions];
                            next[idx] = e.target.value;
                            setPollOptions(next);
                          }}
                          placeholder={`Opción ${idx + 1}`}
                          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 flex-1"
                          data-testid={`interactive-poll-option-${idx}`}
                        />
                        {pollOptions.length > 2 && (
                          <button
                            onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                            className="text-white/50 hover:text-red-400"
                            data-testid={`interactive-poll-remove-${idx}`}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {pollOptions.length < 4 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPollOptions([...pollOptions, ""])}
                        className="w-full border-white/20 text-white"
                        data-testid="interactive-poll-add-option"
                      >
                        + Agregar opción
                      </Button>
                    )}
                    <Button
                      disabled={!pollQuestion.trim() || pollOptions.filter((o) => o.trim()).length < 2}
                      onClick={() => {
                        const validOpts = pollOptions.filter((o) => o.trim());
                        setStickers((p) => [...p, {
                          id: Date.now(),
                          emoji: null,
                          kind: "poll",
                          question: pollQuestion.trim(),
                          options: validOpts,
                          x: 50, y: 50, scale: 1,
                        }]);
                        setPollQuestion("");
                        setPollOptions(["", ""]);
                        setInteractivePanel(null);
                      }}
                      className="w-full"
                      data-testid="interactive-poll-add"
                    >
                      Agregar encuesta
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== HELPER COMPONENTS ====================

const SideBtn = ({ icon: Icon, label, onClick, active, testId, swipeZone }) => (
  <button
    onClick={onClick}
    data-swipe-zone={swipeZone}
    className="flex flex-col items-center gap-0.5 group"
    data-testid={testId}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${active ? "bg-white text-black shadow-lg shadow-white/20" : "bg-black/30 text-white"} group-active:scale-90`}>
      <Icon className="w-5 h-5" />
    </div>
    <span className={`text-[9px] font-medium ${active ? "text-white" : "text-white/60"}`}>{label}</span>
  </button>
);

export default BrunoCameraPage;
