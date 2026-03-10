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
  Download,
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
  CloudRain
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// ==================== FILTROS MEJORADOS ====================

// Filtros de Color (TikTok/Instagram style)
const COLOR_FILTERS = [
  { id: "none", name: "Original", filter: "" },
  { id: "beauty", name: "Beauty", filter: "brightness(1.05) contrast(0.95) saturate(1.1)" },
  { id: "glow", name: "Glow", filter: "brightness(1.15) contrast(0.9) saturate(1.2) blur(0.3px)" },
  { id: "soft", name: "Soft", filter: "brightness(1.1) contrast(0.85) saturate(0.9)" },
  { id: "vivid", name: "Vívido", filter: "saturate(1.6) contrast(1.15) brightness(1.05)" },
  { id: "warm", name: "Cálido", filter: "sepia(0.25) saturate(1.4) brightness(1.05)" },
  { id: "cool", name: "Fresco", filter: "hue-rotate(15deg) saturate(1.1) brightness(1.05)" },
  { id: "sunset", name: "Sunset", filter: "sepia(0.4) saturate(1.6) contrast(1.1) brightness(1.1)" },
  { id: "vintage", name: "Vintage", filter: "sepia(0.5) contrast(1.1) brightness(0.95)" },
  { id: "drama", name: "Drama", filter: "contrast(1.4) saturate(0.7) brightness(0.9)" },
  { id: "bw", name: "B&N", filter: "grayscale(1) contrast(1.3)" },
  { id: "cinema", name: "Cinema", filter: "contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.15)" },
  { id: "neon", name: "Neón", filter: "saturate(2) contrast(1.2) brightness(1.1) hue-rotate(-10deg)" },
  { id: "dreamy", name: "Soñador", filter: "brightness(1.2) contrast(0.8) saturate(1.3) blur(0.5px)" },
  { id: "pop", name: "Pop Art", filter: "saturate(2.5) contrast(1.4) brightness(1.1)" },
  { id: "midnight", name: "Midnight", filter: "brightness(0.85) contrast(1.2) saturate(0.8) hue-rotate(200deg)" }
];

// Filtros de Belleza
const BEAUTY_LEVELS = [
  { id: 0, name: "Natural", blur: 0, brightness: 1, smooth: 0 },
  { id: 1, name: "Suave", blur: 0.5, brightness: 1.02, smooth: 1 },
  { id: 2, name: "Medio", blur: 1, brightness: 1.05, smooth: 2 },
  { id: 3, name: "Alto", blur: 1.5, brightness: 1.08, smooth: 3 },
  { id: 4, name: "Máximo", blur: 2, brightness: 1.12, smooth: 4 }
];

// Filtros de AR (Animalitos y Efectos)
const AR_FILTERS = [
  { id: "none", name: "Sin filtro", icon: X, type: "none" },
  { id: "cat", name: "Gatito", icon: Cat, type: "animal", ears: "cat", nose: "cat" },
  { id: "dog", name: "Perrito", icon: Dog, type: "animal", ears: "dog", nose: "dog" },
  { id: "rabbit", name: "Conejito", icon: Rabbit, type: "animal", ears: "rabbit", nose: "rabbit" },
  { id: "crown", name: "Corona", icon: Crown, type: "accessory", position: "top" },
  { id: "hearts", name: "Corazones", icon: Heart, type: "particles", particle: "heart" },
  { id: "stars", name: "Estrellas", icon: Star, type: "particles", particle: "star" },
  { id: "sparkles", name: "Brillos", icon: Sparkles, type: "particles", particle: "sparkle" },
  { id: "rainbow", name: "Arcoíris", icon: Zap, type: "effect", effect: "rainbow" },
  { id: "sunbeam", name: "Rayos Sol", icon: Sun, type: "effect", effect: "sunbeam" },
  { id: "moonlight", name: "Luna", icon: Moon, type: "effect", effect: "moonlight" },
  { id: "rain", name: "Lluvia", icon: CloudRain, type: "particles", particle: "rain" }
];

// Stickers
const STICKERS = [
  { id: "heart", emoji: "❤️", name: "Corazón" },
  { id: "fire", emoji: "🔥", name: "Fuego" },
  { id: "star", emoji: "⭐", name: "Estrella" },
  { id: "sparkles", emoji: "✨", name: "Brillos" },
  { id: "100", emoji: "💯", name: "100" },
  { id: "cool", emoji: "😎", name: "Cool" },
  { id: "love", emoji: "😍", name: "Amor" },
  { id: "party", emoji: "🎉", name: "Fiesta" },
  { id: "kiss", emoji: "💋", name: "Beso" },
  { id: "rainbow", emoji: "🌈", name: "Arcoíris" },
  { id: "butterfly", emoji: "🦋", name: "Mariposa" },
  { id: "flower", emoji: "🌸", name: "Flor" },
  { id: "crown", emoji: "👑", name: "Corona" },
  { id: "diamond", emoji: "💎", name: "Diamante" },
  { id: "rocket", emoji: "🚀", name: "Cohete" },
  { id: "music", emoji: "🎵", name: "Música" }
];

// Text Styles
const TEXT_STYLES = [
  { id: "default", name: "Normal", font: "Inter, sans-serif", weight: "500" },
  { id: "bold", name: "Bold", font: "Inter, sans-serif", weight: "800" },
  { id: "neon", name: "Neón", font: "Inter, sans-serif", weight: "700", glow: true },
  { id: "cursive", name: "Elegante", font: "Georgia, serif", weight: "400", italic: true },
  { id: "retro", name: "Retro", font: "Impact, sans-serif", weight: "400" },
  { id: "mono", name: "Tech", font: "monospace", weight: "600" }
];

const TEXT_COLORS = ["#FFFFFF", "#000000", "#FF5A00", "#FF3366", "#00D4FF", "#39FF14", "#FFD700", "#FF00FF", "#00FFFF", "#FF6B6B"];

const BrunoCameraPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // Camera state
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const [mode, setMode] = useState("photo");
  
  // Capture & Edit state
  const [capturedMedia, setCapturedMedia] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  
  // Filters
  const [colorFilter, setColorFilter] = useState("none");
  const [beautyLevel, setBeautyLevel] = useState(0);
  const [arFilter, setArFilter] = useState("none");
  
  // AR Detection
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceDetections, setFaceDetections] = useState([]);
  const [particles, setParticles] = useState([]);
  
  // Stickers & Text
  const [stickers, setStickers] = useState([]);
  const [texts, setTexts] = useState([]);
  const [newText, setNewText] = useState("");
  const [textStyle, setTextStyle] = useState("default");
  const [textColor, setTextColor] = useState("#FFFFFF");
  
  // Publishing
  const [publishing, setPublishing] = useState(false);
  const [caption, setCaption] = useState("");

  // Load Face-API models
  useEffect(() => {
    const loadModels = async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceExpressionNet.loadFromUri('/models')
        ]);
        setModelsLoaded(true);
        console.log("Face models loaded");
      } catch (error) {
        console.error("Error loading face models:", error);
      }
    };
    loadModels();
  }, []);

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [facingMode]);

  // Face detection loop
  useEffect(() => {
    if (!modelsLoaded || !videoRef.current || capturedMedia) return;
    
    const detectFaces = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        try {
          const detections = await faceapi
            .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 }))
            .withFaceLandmarks()
            .withFaceExpressions();
          
          setFaceDetections(detections);
        } catch (e) {
          // Ignore detection errors
        }
      }
      animationFrameRef.current = requestAnimationFrame(detectFaces);
    };
    
    detectFaces();
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [modelsLoaded, capturedMedia]);

  // Render AR overlay
  useEffect(() => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    
    const canvas = overlayCanvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (arFilter === "none" || faceDetections.length === 0) return;
    
    const currentARFilter = AR_FILTERS.find(f => f.id === arFilter);
    if (!currentARFilter) return;
    
    faceDetections.forEach(detection => {
      const landmarks = detection.landmarks;
      const positions = landmarks.positions;
      
      // Get key facial points
      const nose = landmarks.getNose();
      const leftEye = landmarks.getLeftEye();
      const rightEye = landmarks.getRightEye();
      const jaw = landmarks.getJawOutline();
      const mouth = landmarks.getMouth();
      
      // Calculate face dimensions
      const faceWidth = jaw[16].x - jaw[0].x;
      const faceHeight = jaw[8].y - positions[27].y;
      const faceCenterX = (jaw[0].x + jaw[16].x) / 2;
      const faceCenterY = positions[27].y;
      
      // Mirror for front camera
      const mirrorX = (x) => facingMode === "user" ? canvas.width - x : x;
      
      // Draw AR effects based on filter type
      if (currentARFilter.type === "animal") {
        drawAnimalFilter(ctx, currentARFilter, {
          positions, nose, leftEye, rightEye, jaw, mouth,
          faceWidth, faceHeight, faceCenterX, faceCenterY, mirrorX, canvas
        });
      } else if (currentARFilter.type === "accessory") {
        drawAccessoryFilter(ctx, currentARFilter, {
          positions, faceWidth, faceCenterX, faceCenterY, mirrorX, canvas
        });
      } else if (currentARFilter.type === "particles") {
        drawParticleEffect(ctx, currentARFilter, canvas);
      } else if (currentARFilter.type === "effect") {
        drawSpecialEffect(ctx, currentARFilter, canvas);
      }
    });
  }, [faceDetections, arFilter, facingMode]);

  // Draw animal filters (ears, nose)
  const drawAnimalFilter = (ctx, filter, data) => {
    const { positions, nose, leftEye, rightEye, jaw, faceWidth, faceCenterX, mirrorX, canvas } = data;
    
    ctx.save();
    
    // Ear positions
    const leftEarX = mirrorX(jaw[0].x - faceWidth * 0.1);
    const rightEarX = mirrorX(jaw[16].x + faceWidth * 0.1);
    const earY = positions[19].y - faceWidth * 0.5;
    const earSize = faceWidth * 0.35;
    
    // Nose position
    const noseX = mirrorX(nose[3].x);
    const noseY = nose[6].y;
    const noseSize = faceWidth * 0.15;
    
    // Draw ears based on animal type
    if (filter.ears === "cat") {
      // Cat ears (triangles)
      drawCatEars(ctx, leftEarX, rightEarX, earY, earSize);
    } else if (filter.ears === "dog") {
      // Dog ears (floppy)
      drawDogEars(ctx, leftEarX, rightEarX, earY, earSize);
    } else if (filter.ears === "rabbit") {
      // Rabbit ears (long)
      drawRabbitEars(ctx, leftEarX, rightEarX, earY, earSize);
    }
    
    // Draw animal nose
    if (filter.nose) {
      drawAnimalNose(ctx, noseX, noseY, noseSize, filter.nose);
    }
    
    ctx.restore();
  };

  const drawCatEars = (ctx, leftX, rightX, y, size) => {
    // Left ear
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.moveTo(leftX, y + size);
    ctx.lineTo(leftX - size/2, y);
    ctx.lineTo(leftX + size/2, y + size);
    ctx.fill();
    
    // Inner left ear
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.moveTo(leftX, y + size * 0.7);
    ctx.lineTo(leftX - size/4, y + size * 0.3);
    ctx.lineTo(leftX + size/4, y + size * 0.7);
    ctx.fill();
    
    // Right ear
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.moveTo(rightX, y + size);
    ctx.lineTo(rightX - size/2, y + size);
    ctx.lineTo(rightX + size/2, y);
    ctx.fill();
    
    // Inner right ear
    ctx.fillStyle = "#FF69B4";
    ctx.beginPath();
    ctx.moveTo(rightX, y + size * 0.7);
    ctx.lineTo(rightX - size/4, y + size * 0.7);
    ctx.lineTo(rightX + size/4, y + size * 0.3);
    ctx.fill();
  };

  const drawDogEars = (ctx, leftX, rightX, y, size) => {
    // Floppy dog ears
    ctx.fillStyle = "#8B4513";
    
    // Left ear
    ctx.beginPath();
    ctx.ellipse(leftX - size * 0.3, y + size * 0.5, size * 0.4, size * 0.8, -0.3, 0, Math.PI * 2);
    ctx.fill();
    
    // Right ear
    ctx.beginPath();
    ctx.ellipse(rightX + size * 0.3, y + size * 0.5, size * 0.4, size * 0.8, 0.3, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawRabbitEars = (ctx, leftX, rightX, y, size) => {
    // Long rabbit ears
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#FFB6C1";
    ctx.lineWidth = 3;
    
    // Left ear
    ctx.beginPath();
    ctx.ellipse(leftX, y - size * 0.5, size * 0.2, size * 1.2, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner left ear
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.ellipse(leftX, y - size * 0.3, size * 0.1, size * 0.8, -0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Right ear
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.ellipse(rightX, y - size * 0.5, size * 0.2, size * 1.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Inner right ear
    ctx.fillStyle = "#FFB6C1";
    ctx.beginPath();
    ctx.ellipse(rightX, y - size * 0.3, size * 0.1, size * 0.8, 0.2, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawAnimalNose = (ctx, x, y, size, type) => {
    if (type === "cat" || type === "rabbit") {
      // Triangle nose with whiskers
      ctx.fillStyle = "#FF69B4";
      ctx.beginPath();
      ctx.moveTo(x, y - size/2);
      ctx.lineTo(x - size/2, y + size/2);
      ctx.lineTo(x + size/2, y + size/2);
      ctx.fill();
      
      // Whiskers
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(x - size, y + i * size * 0.3);
        ctx.lineTo(x - size * 2, y + i * size * 0.5);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(x + size, y + i * size * 0.3);
        ctx.lineTo(x + size * 2, y + i * size * 0.5);
        ctx.stroke();
      }
    } else if (type === "dog") {
      // Round dog nose
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.ellipse(x, y, size, size * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      
      // Nose shine
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.beginPath();
      ctx.ellipse(x - size * 0.3, y - size * 0.2, size * 0.2, size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawAccessoryFilter = (ctx, filter, data) => {
    const { positions, faceWidth, faceCenterX, faceCenterY, mirrorX, canvas } = data;
    
    if (filter.position === "top") {
      const crownX = mirrorX(faceCenterX);
      const crownY = positions[19].y - faceWidth * 0.4;
      const crownSize = faceWidth * 0.8;
      
      // Draw crown
      ctx.fillStyle = "#FFD700";
      ctx.strokeStyle = "#FFA500";
      ctx.lineWidth = 3;
      
      ctx.beginPath();
      ctx.moveTo(crownX - crownSize/2, crownY + crownSize * 0.3);
      ctx.lineTo(crownX - crownSize * 0.3, crownY);
      ctx.lineTo(crownX - crownSize * 0.15, crownY + crownSize * 0.2);
      ctx.lineTo(crownX, crownY - crownSize * 0.1);
      ctx.lineTo(crownX + crownSize * 0.15, crownY + crownSize * 0.2);
      ctx.lineTo(crownX + crownSize * 0.3, crownY);
      ctx.lineTo(crownX + crownSize/2, crownY + crownSize * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Crown jewels
      ctx.fillStyle = "#FF0000";
      ctx.beginPath();
      ctx.arc(crownX, crownY + crownSize * 0.1, crownSize * 0.05, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = "#0000FF";
      ctx.beginPath();
      ctx.arc(crownX - crownSize * 0.2, crownY + crownSize * 0.15, crownSize * 0.04, 0, Math.PI * 2);
      ctx.arc(crownX + crownSize * 0.2, crownY + crownSize * 0.15, crownSize * 0.04, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawParticleEffect = (ctx, filter, canvas) => {
    const time = Date.now() / 1000;
    const particleCount = 20;
    
    for (let i = 0; i < particleCount; i++) {
      const x = (Math.sin(time + i * 0.5) * 0.5 + 0.5) * canvas.width;
      const y = ((time * 0.3 + i * 0.1) % 1) * canvas.height;
      const size = 10 + Math.sin(time + i) * 5;
      const alpha = 0.5 + Math.sin(time * 2 + i) * 0.3;
      
      ctx.globalAlpha = alpha;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = "center";
      
      if (filter.particle === "heart") {
        ctx.fillText("❤️", x, y);
      } else if (filter.particle === "star") {
        ctx.fillText("⭐", x, y);
      } else if (filter.particle === "sparkle") {
        ctx.fillText("✨", x, y);
      } else if (filter.particle === "rain") {
        ctx.fillStyle = "#ADD8E6";
        ctx.fillRect(x, y, 2, 10);
      }
    }
    ctx.globalAlpha = 1;
  };

  const drawSpecialEffect = (ctx, filter, canvas) => {
    const time = Date.now() / 1000;
    
    if (filter.effect === "rainbow") {
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, "rgba(255,0,0,0.2)");
      gradient.addColorStop(0.17, "rgba(255,165,0,0.2)");
      gradient.addColorStop(0.33, "rgba(255,255,0,0.2)");
      gradient.addColorStop(0.5, "rgba(0,255,0,0.2)");
      gradient.addColorStop(0.67, "rgba(0,0,255,0.2)");
      gradient.addColorStop(0.83, "rgba(75,0,130,0.2)");
      gradient.addColorStop(1, "rgba(238,130,238,0.2)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else if (filter.effect === "sunbeam") {
      ctx.fillStyle = "rgba(255,200,100,0.15)";
      ctx.beginPath();
      ctx.moveTo(canvas.width, 0);
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI + time * 0.1;
        const r = canvas.width * 1.5;
        ctx.lineTo(
          canvas.width + Math.cos(angle) * r,
          Math.sin(angle) * r
        );
      }
      ctx.fill();
    } else if (filter.effect === "moonlight") {
      const gradient = ctx.createRadialGradient(
        canvas.width * 0.8, canvas.height * 0.2, 0,
        canvas.width * 0.8, canvas.height * 0.2, canvas.width * 0.5
      );
      gradient.addColorStop(0, "rgba(200,200,255,0.3)");
      gradient.addColorStop(1, "rgba(100,100,150,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: mode === "video"
      });
      
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  const flipCamera = () => {
    setFacingMode(prev => prev === "user" ? "environment" : "user");
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    
    // Apply mirror for front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    // Draw video frame
    ctx.drawImage(video, 0, 0);
    
    // Reset transform for overlays
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Draw AR overlay
    if (overlayCanvasRef.current) {
      ctx.drawImage(overlayCanvasRef.current, 0, 0);
    }
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    setCapturedMedia({ type: "photo", data: dataUrl });
  };

  const startRecording = () => {
    if (!stream) return;
    
    setRecordedChunks([]);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordedChunks(prev => [...prev, event.data]);
      }
    };
    
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setCapturedMedia({ type: "video", data: url });
    };
    
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const retake = () => {
    setCapturedMedia(null);
    setColorFilter("none");
    setBeautyLevel(0);
    setArFilter("none");
    setStickers([]);
    setTexts([]);
    setCaption("");
  };

  const addSticker = (sticker) => {
    setStickers([...stickers, {
      ...sticker,
      id: Date.now(),
      x: 50,
      y: 50,
      scale: 1
    }]);
  };

  const removeSticker = (id) => {
    setStickers(stickers.filter(s => s.id !== id));
  };

  const addText = () => {
    if (!newText.trim()) return;
    setTexts([...texts, {
      id: Date.now(),
      text: newText,
      x: 50,
      y: 30,
      style: textStyle,
      color: textColor
    }]);
    setNewText("");
  };

  const removeText = (id) => {
    setTexts(texts.filter(t => t.id !== id));
  };

  const handlePublish = async () => {
    if (!capturedMedia || !token) return;
    
    setPublishing(true);
    try {
      const formData = new FormData();
      
      // Convert data URL to blob
      const response = await fetch(capturedMedia.data);
      const blob = await response.blob();
      formData.append("file", blob, `bruno_${Date.now()}.${capturedMedia.type === "photo" ? "jpg" : "webm"}`);
      formData.append("caption", caption);
      formData.append("media_type", capturedMedia.type);
      
      await axios.post(`${API}/posts/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      
      navigate("/feed");
    } catch (error) {
      console.error("Error publishing:", error);
    } finally {
      setPublishing(false);
    }
  };

  // Get combined filter style
  const getFilterStyle = () => {
    const colorFilterObj = COLOR_FILTERS.find(f => f.id === colorFilter);
    const beautyObj = BEAUTY_LEVELS[beautyLevel];
    
    let filterStr = colorFilterObj?.filter || "";
    
    if (beautyObj && beautyObj.blur > 0) {
      filterStr += ` blur(${beautyObj.blur}px) brightness(${beautyObj.brightness})`;
    }
    
    return { filter: filterStr.trim() };
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Camera View */}
      <div className="relative flex-1 overflow-hidden">
        {/* Video Feed */}
        {!capturedMedia ? (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                transform: facingMode === "user" ? "scaleX(-1)" : "none",
                ...getFilterStyle()
              }}
            />
            {/* AR Overlay Canvas */}
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
            />
          </>
        ) : (
          /* Captured Media Preview */
          <div className="absolute inset-0">
            {capturedMedia.type === "photo" ? (
              <img
                src={capturedMedia.data}
                alt="Captured"
                className="w-full h-full object-cover"
                style={getFilterStyle()}
              />
            ) : (
              <video
                src={capturedMedia.data}
                controls
                loop
                autoPlay
                className="w-full h-full object-cover"
                style={getFilterStyle()}
              />
            )}
          </div>
        )}
        
        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white">
            <X className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center gap-2">
            {!modelsLoaded && (
              <div className="flex items-center gap-1 text-xs text-white/70 bg-black/30 px-2 py-1 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Cargando filtros...</span>
              </div>
            )}
            {!capturedMedia && (
              <Button variant="ghost" size="icon" onClick={flipCamera} className="text-white">
                <FlipHorizontal className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Stickers Overlay */}
        {stickers.map((sticker) => (
          <div
            key={sticker.id}
            className="absolute cursor-move text-4xl select-none"
            style={{
              left: `${sticker.x}%`,
              top: `${sticker.y}%`,
              transform: `translate(-50%, -50%) scale(${sticker.scale})`,
              fontSize: `${2 * sticker.scale}rem`
            }}
            onClick={() => removeSticker(sticker.id)}
          >
            {sticker.emoji}
          </div>
        ))}

        {/* Texts Overlay */}
        {texts.map((text) => {
          const styleObj = TEXT_STYLES.find(s => s.id === text.style) || TEXT_STYLES[0];
          return (
            <div
              key={text.id}
              className="absolute cursor-move select-none px-3 py-1 rounded"
              style={{
                left: `${text.x}%`,
                top: `${text.y}%`,
                transform: "translate(-50%, -50%)",
                fontFamily: styleObj.font,
                fontWeight: styleObj.weight,
                fontStyle: styleObj.italic ? "italic" : "normal",
                color: text.color,
                fontSize: "1.5rem",
                textShadow: styleObj.glow 
                  ? `0 0 10px ${text.color}, 0 0 20px ${text.color}, 0 0 30px ${text.color}`
                  : "2px 2px 4px rgba(0,0,0,0.8)",
                backgroundColor: "rgba(0,0,0,0.3)"
              }}
              onClick={() => removeText(text.id)}
            >
              {text.text}
            </div>
          );
        })}

        {/* Recording Indicator */}
        {isRecording && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="text-sm font-medium">REC</span>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="bg-black/90 backdrop-blur-xl">
        {/* Active Panel */}
        {activePanel && (
          <div className="p-3 border-t border-white/10">
            {/* Color Filters Panel */}
            {activePanel === "filters" && (
              <div className="space-y-3">
                <h4 className="text-white text-xs font-medium">Filtros de Color</h4>
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {COLOR_FILTERS.map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setColorFilter(filter.id)}
                      className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        colorFilter === filter.id ? "border-primary scale-105" : "border-transparent"
                      }`}
                    >
                      <div
                        className="w-full h-full bg-gradient-to-br from-orange-400 to-pink-500"
                        style={{ filter: filter.filter }}
                      />
                      <span className="absolute bottom-0 inset-x-0 text-[8px] text-white bg-black/50 py-0.5">
                        {filter.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Beauty Panel */}
            {activePanel === "beauty" && (
              <div className="space-y-3">
                <h4 className="text-white text-xs font-medium">Filtro de Belleza</h4>
                <div className="flex gap-3">
                  {BEAUTY_LEVELS.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setBeautyLevel(level.id)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                        beautyLevel === level.id
                          ? "bg-primary text-white"
                          : "bg-white/10 text-white/70 hover:bg-white/20"
                      }`}
                    >
                      {level.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AR Filters Panel */}
            {activePanel === "ar" && (
              <div className="space-y-3">
                <h4 className="text-white text-xs font-medium">Filtros AR</h4>
                <div className="grid grid-cols-6 gap-2">
                  {AR_FILTERS.map((filter) => {
                    const Icon = filter.icon;
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setArFilter(filter.id)}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                          arFilter === filter.id
                            ? "bg-primary text-white"
                            : "bg-white/10 text-white/70 hover:bg-white/20"
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-[8px]">{filter.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stickers Panel */}
            {activePanel === "stickers" && (
              <div className="space-y-3">
                <h4 className="text-white text-xs font-medium">Stickers</h4>
                <div className="grid grid-cols-8 gap-2">
                  {STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      onClick={() => addSticker(sticker)}
                      className="aspect-square text-2xl hover:scale-125 transition-transform"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Text Panel */}
            {activePanel === "text" && (
              <div className="space-y-3">
                <h4 className="text-white text-xs font-medium">Añadir Texto</h4>
                <div className="flex gap-2">
                  <Input
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="Escribe tu texto..."
                    className="flex-1 bg-white/10 border-white/20 text-white"
                  />
                  <Button onClick={addText} size="sm">
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {TEXT_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setTextStyle(style.id)}
                      className={`px-3 py-1 rounded-full text-xs whitespace-nowrap ${
                        textStyle === style.id
                          ? "bg-primary text-white"
                          : "bg-white/10 text-white/70"
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setTextColor(color)}
                      className={`w-6 h-6 rounded-full border-2 ${
                        textColor === color ? "border-white" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tool Bar */}
        <div className="flex justify-around items-center p-2 border-t border-white/10">
          <button
            onClick={() => setActivePanel(activePanel === "filters" ? null : "filters")}
            className={`p-2 rounded-lg ${activePanel === "filters" ? "bg-primary" : "bg-white/10"}`}
          >
            <Palette className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "beauty" ? null : "beauty")}
            className={`p-2 rounded-lg ${activePanel === "beauty" ? "bg-primary" : "bg-white/10"}`}
          >
            <Wand2 className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "ar" ? null : "ar")}
            className={`p-2 rounded-lg ${activePanel === "ar" ? "bg-primary" : "bg-white/10"}`}
          >
            <Smile className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "stickers" ? null : "stickers")}
            className={`p-2 rounded-lg ${activePanel === "stickers" ? "bg-primary" : "bg-white/10"}`}
          >
            <Sticker className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={() => setActivePanel(activePanel === "text" ? null : "text")}
            className={`p-2 rounded-lg ${activePanel === "text" ? "bg-primary" : "bg-white/10"}`}
          >
            <Type className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Mode & Capture */}
        <div className="p-4 flex items-center justify-between">
          {!capturedMedia ? (
            <>
              {/* Mode Toggle */}
              <div className="flex bg-white/10 rounded-full p-1">
                <button
                  onClick={() => setMode("photo")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mode === "photo" ? "bg-white text-black" : "text-white"
                  }`}
                >
                  Foto
                </button>
                <button
                  onClick={() => setMode("video")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    mode === "video" ? "bg-white text-black" : "text-white"
                  }`}
                >
                  Video
                </button>
              </div>

              {/* Capture Button */}
              <button
                onClick={mode === "photo" ? capturePhoto : (isRecording ? stopRecording : startRecording)}
                className={`w-16 h-16 rounded-full border-4 border-white flex items-center justify-center transition-all ${
                  isRecording ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
                }`}
              >
                {mode === "photo" ? (
                  <Camera className="w-6 h-6 text-white" />
                ) : isRecording ? (
                  <div className="w-6 h-6 bg-white rounded" />
                ) : (
                  <Video className="w-6 h-6 text-white" />
                )}
              </button>

              {/* Gallery */}
              <button className="p-3 bg-white/10 rounded-xl">
                <ImageIcon className="w-5 h-5 text-white" />
              </button>
            </>
          ) : (
            <>
              {/* Retake */}
              <Button variant="ghost" onClick={retake} className="text-white">
                <RotateCcw className="w-5 h-5 mr-2" />
                Repetir
              </Button>

              {/* Caption Input */}
              <Input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Añade un pie de foto..."
                className="flex-1 mx-4 bg-white/10 border-white/20 text-white placeholder:text-white/50"
              />

              {/* Publish */}
              <Button onClick={handlePublish} disabled={publishing}>
                {publishing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Share2 className="w-5 h-5 mr-2" />
                    Publicar
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BrunoCameraPage;
