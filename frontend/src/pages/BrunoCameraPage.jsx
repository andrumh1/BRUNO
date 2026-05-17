import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Music2
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

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [facingMode]);

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
        } catch (e) {}
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
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: mode !== "photo",
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      // error handled
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

  const startRecording = () => {
    if (!stream) return;
    setRecordedChunks([]);
    setRecordTime(0);
    setRecordProgress(0);
    const chunks = [];
    const mr = new MediaRecorder(stream, { mimeType: "video/webm" });
    mr.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mr.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      setCapturedMedia({ type: "video", data: URL.createObjectURL(blob) });
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
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
      formData.append("file", blob, `bruno_${Date.now()}.${capturedMedia.type === "photo" ? "jpg" : "webm"}`);
      const uploadRes = await axios.post(`${API}/upload/image`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
      });
      const mediaUrl = uploadRes.data.url;

      // Step 2: Create post with uploaded media URL
      await axios.post(`${API}/posts`, {
        content: caption,
        media: [{ type: capturedMedia.type === "photo" ? "image" : "video", url: mediaUrl }],
        post_type: capturedMedia.type === "photo" ? "image" : "video",
        visibility: "public",
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate("/feed");
    } catch (err) {
      // error handled
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
    <div className="fixed inset-0 bg-black flex flex-col" style={{ zIndex: 50, paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }} data-testid="camera-page">
      {/* ====== CAMERA VIEWFINDER ====== */}
      <div className="relative flex-1 overflow-hidden rounded-b-3xl">
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

          {/* Music placeholder */}
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm" data-testid="camera-music-btn">
            <Music2 className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-medium">Agregar sonido</span>
          </button>

          <div className="w-9" />
        </div>

        {/* ---- RIGHT SIDEBAR (TikTok-style) ---- */}
        {!capturedMedia && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col items-center gap-4" data-testid="camera-sidebar">
            <SideBtn icon={FlipHorizontal} label="Voltear" onClick={flipCamera} testId="camera-flip-btn" />
            <SideBtn icon={Wand2} label="Belleza" onClick={() => togglePanel("beauty")} active={activePanel === "beauty" || beautyLevel > 0} testId="camera-beauty-btn" />
            <SideBtn icon={Smile} label="Efectos" onClick={() => togglePanel("ar")} active={activePanel === "ar" || arFilter !== "none"} testId="camera-ar-btn" />
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

        {/* ---- STICKERS OVERLAY ---- */}
        {stickers.map((s) => (
          <div
            key={s.id}
            className="absolute cursor-pointer select-none"
            style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) scale(${s.scale})`, fontSize: "2.5rem" }}
            onClick={() => removeSticker(s.id)}
          >
            {s.emoji}
          </div>
        ))}

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
              <button className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center" data-testid="camera-gallery-btn">
                <ImageIcon className="w-5 h-5 text-white/70" />
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
      </div>
    </div>
  );
};

// ==================== HELPER COMPONENTS ====================

const SideBtn = ({ icon: Icon, label, onClick, active, testId }) => (
  <button
    onClick={onClick}
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
