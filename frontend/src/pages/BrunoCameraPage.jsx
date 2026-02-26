import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
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
  ZoomIn,
  ZoomOut,
  Sun,
  Contrast,
  FlipHorizontal,
  Loader2,
  Image as ImageIcon,
  Music,
  Smile,
  Pencil
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// BRUNO Filters
const FILTERS = [
  { id: "none", name: "Original", style: {} },
  { id: "bruno", name: "BRUNO", style: { filter: "saturate(1.3) contrast(1.1) sepia(0.1)" } },
  { id: "sunset", name: "Atardecer", style: { filter: "sepia(0.4) saturate(1.5) brightness(1.1)" } },
  { id: "cool", name: "Fresco", style: { filter: "saturate(0.9) brightness(1.1) hue-rotate(20deg)" } },
  { id: "warm", name: "Cálido", style: { filter: "sepia(0.2) saturate(1.3) brightness(1.05)" } },
  { id: "vintage", name: "Vintage", style: { filter: "sepia(0.5) contrast(1.2) brightness(0.9)" } },
  { id: "bw", name: "B&N", style: { filter: "grayscale(1) contrast(1.2)" } },
  { id: "vivid", name: "Vívido", style: { filter: "saturate(1.8) contrast(1.1)" } },
  { id: "fade", name: "Desvanecido", style: { filter: "saturate(0.7) brightness(1.15) contrast(0.9)" } },
  { id: "drama", name: "Drama", style: { filter: "contrast(1.4) saturate(0.8) brightness(0.95)" } }
];

// BRUNO Stickers
const BRUNO_STICKERS = [
  { id: "bruno-happy", src: "/bruno-mascot.webp", name: "BRUNO Feliz" },
  { id: "heart", src: "❤️", emoji: true, name: "Corazón" },
  { id: "fire", src: "🔥", emoji: true, name: "Fuego" },
  { id: "star", src: "⭐", emoji: true, name: "Estrella" },
  { id: "sparkles", src: "✨", emoji: true, name: "Brillos" },
  { id: "thumbsup", src: "👍", emoji: true, name: "Like" },
  { id: "party", src: "🎉", emoji: true, name: "Fiesta" },
  { id: "cool", src: "😎", emoji: true, name: "Cool" },
  { id: "love", src: "😍", emoji: true, name: "Amor" },
  { id: "rocket", src: "🚀", emoji: true, name: "Cohete" }
];

// Text Styles
const TEXT_STYLES = [
  { id: "default", name: "Normal", style: { fontFamily: "system-ui", fontWeight: "normal" } },
  { id: "bold", name: "Negrita", style: { fontFamily: "system-ui", fontWeight: "bold" } },
  { id: "cursive", name: "Cursiva", style: { fontFamily: "cursive", fontWeight: "normal" } },
  { id: "mono", name: "Mono", style: { fontFamily: "monospace", fontWeight: "normal" } },
  { id: "serif", name: "Serif", style: { fontFamily: "serif", fontWeight: "bold" } }
];

const TEXT_COLORS = [
  "#FFFFFF", "#000000", "#FF6B35", "#FF4444", "#44FF44", 
  "#4444FF", "#FFFF44", "#FF44FF", "#44FFFF", "#FF8800"
];

const BrunoCameraPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // Camera state
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("user");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedChunks, setRecordedChunks] = useState([]);
  const mediaRecorderRef = useRef(null);
  
  // Capture state
  const [capturedMedia, setCapturedMedia] = useState(null); // { type: 'photo' | 'video', data: url }
  const [mode, setMode] = useState("photo"); // photo | video
  
  // Editor state
  const [selectedFilter, setSelectedFilter] = useState("none");
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [stickers, setStickers] = useState([]); // [{id, x, y, scale, emoji?, src?}]
  const [texts, setTexts] = useState([]); // [{id, text, x, y, style, color}]
  const [activePanel, setActivePanel] = useState(null); // filters | stickers | text | adjust
  
  // Text editing
  const [newText, setNewText] = useState("");
  const [textStyle, setTextStyle] = useState("default");
  const [textColor, setTextColor] = useState("#FFFFFF");
  
  // Publishing
  const [publishing, setPublishing] = useState(false);
  const [caption, setCaption] = useState("");

  // Initialize camera
  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: 1080, height: 1920 },
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
    
    // Apply flip if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
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
    setSelectedFilter("none");
    setBrightness(100);
    setContrast(100);
    setStickers([]);
    setTexts([]);
    setActivePanel(null);
  };

  const addSticker = (sticker) => {
    setStickers(prev => [...prev, {
      ...sticker,
      instanceId: Date.now(),
      x: 50,
      y: 50,
      scale: 1
    }]);
  };

  const addText = () => {
    if (!newText.trim()) return;
    
    setTexts(prev => [...prev, {
      id: Date.now(),
      text: newText,
      x: 50,
      y: 30,
      style: textStyle,
      color: textColor
    }]);
    setNewText("");
  };

  const getFilterStyle = () => {
    const filter = FILTERS.find(f => f.id === selectedFilter);
    let filterStr = filter?.style?.filter || "";
    
    // Add brightness and contrast
    if (brightness !== 100 || contrast !== 100) {
      filterStr += ` brightness(${brightness/100}) contrast(${contrast/100})`;
    }
    
    return { filter: filterStr.trim() || "none" };
  };

  const publishMedia = async () => {
    if (!capturedMedia || !token) return;
    
    setPublishing(true);
    
    try {
      // Convert data URL to blob
      const response = await fetch(capturedMedia.data);
      const blob = await response.blob();
      
      // Upload file
      const formData = new FormData();
      formData.append("file", blob, capturedMedia.type === "photo" ? "photo.jpg" : "video.webm");
      
      const uploadRes = await axios.post(`${API}/upload/${capturedMedia.type === "photo" ? "image" : "video"}`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      
      // Create post
      const postData = {
        content: caption || "",
        media_urls: [uploadRes.data.url],
        media_type: capturedMedia.type,
        visibility: "public"
      };
      
      await axios.post(`${API}/posts`, postData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      navigate("/feed");
    } catch (error) {
      console.error("Error publishing:", error);
      alert("Error al publicar. Intenta de nuevo.");
    } finally {
      setPublishing(false);
    }
  };

  // Editor View
  if (capturedMedia) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col">
        {/* Top Bar */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
          <Button variant="ghost" size="icon" className="text-white" onClick={retake}>
            <X className="w-6 h-6" />
          </Button>
          
          <div className="flex items-center gap-2">
            <img src="/bruno-mascot.webp" alt="BRUNO" className="w-8 h-8 rounded-full" />
            <span className="text-white font-bold">BRUNO Camera</span>
          </div>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white"
            onClick={publishMedia}
            disabled={publishing}
          >
            {publishing ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Check className="w-6 h-6" />
            )}
          </Button>
        </div>

        {/* Media Preview */}
        <div className="flex-1 relative overflow-hidden">
          {capturedMedia.type === "photo" ? (
            <img 
              src={capturedMedia.data}
              alt="Captured"
              className="w-full h-full object-contain"
              style={getFilterStyle()}
            />
          ) : (
            <video 
              src={capturedMedia.data}
              className="w-full h-full object-contain"
              style={getFilterStyle()}
              controls
              autoPlay
              loop
            />
          )}
          
          {/* Stickers overlay */}
          {stickers.map((sticker) => (
            <div
              key={sticker.instanceId}
              className="absolute cursor-move"
              style={{
                left: `${sticker.x}%`,
                top: `${sticker.y}%`,
                transform: `translate(-50%, -50%) scale(${sticker.scale})`,
                fontSize: sticker.emoji ? "3rem" : undefined
              }}
            >
              {sticker.emoji ? (
                sticker.src
              ) : (
                <img src={sticker.src} alt="" className="w-20 h-20 object-contain" />
              )}
            </div>
          ))}
          
          {/* Texts overlay */}
          {texts.map((textItem) => {
            const styleObj = TEXT_STYLES.find(s => s.id === textItem.style)?.style || {};
            return (
              <div
                key={textItem.id}
                className="absolute cursor-move px-3 py-1 rounded-lg"
                style={{
                  left: `${textItem.x}%`,
                  top: `${textItem.y}%`,
                  transform: "translate(-50%, -50%)",
                  color: textItem.color,
                  backgroundColor: "rgba(0,0,0,0.3)",
                  ...styleObj,
                  fontSize: "1.5rem",
                  textShadow: "2px 2px 4px rgba(0,0,0,0.5)"
                }}
              >
                {textItem.text}
              </div>
            );
          })}
        </div>

        {/* Caption Input */}
        <div className="p-3 bg-black/80">
          <Input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Añade un caption..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
          />
        </div>

        {/* Editor Tools */}
        <div className="bg-black p-2">
          {/* Tool buttons */}
          <div className="flex justify-around mb-2">
            <button 
              onClick={() => setActivePanel(activePanel === "filters" ? null : "filters")}
              className={`p-2 rounded-lg ${activePanel === "filters" ? "bg-primary" : "bg-white/10"}`}
            >
              <Sparkles className="w-5 h-5 text-white" />
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
            <button 
              onClick={() => setActivePanel(activePanel === "adjust" ? null : "adjust")}
              className={`p-2 rounded-lg ${activePanel === "adjust" ? "bg-primary" : "bg-white/10"}`}
            >
              <Sun className="w-5 h-5 text-white" />
            </button>
          </div>
          
          {/* Panels */}
          {activePanel === "filters" && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {FILTERS.map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setSelectedFilter(filter.id)}
                  className={`flex-shrink-0 p-2 rounded-lg text-center ${
                    selectedFilter === filter.id ? "bg-primary" : "bg-white/10"
                  }`}
                >
                  <div 
                    className="w-12 h-12 rounded-lg mb-1 bg-cover bg-center"
                    style={{ 
                      backgroundImage: `url(${capturedMedia.data})`,
                      ...filter.style
                    }}
                  />
                  <span className="text-xs text-white">{filter.name}</span>
                </button>
              ))}
            </div>
          )}
          
          {activePanel === "stickers" && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {BRUNO_STICKERS.map(sticker => (
                <button
                  key={sticker.id}
                  onClick={() => addSticker(sticker)}
                  className="flex-shrink-0 p-2 bg-white/10 rounded-lg"
                >
                  {sticker.emoji ? (
                    <span className="text-3xl">{sticker.src}</span>
                  ) : (
                    <img src={sticker.src} alt={sticker.name} className="w-12 h-12 object-contain" />
                  )}
                </button>
              ))}
            </div>
          )}
          
          {activePanel === "text" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={newText}
                  onChange={(e) => setNewText(e.target.value)}
                  placeholder="Escribe texto..."
                  className="flex-1 bg-white/10 border-white/20 text-white"
                />
                <Button onClick={addText} size="sm">Añadir</Button>
              </div>
              <div className="flex gap-2 overflow-x-auto">
                {TEXT_STYLES.map(style => (
                  <button
                    key={style.id}
                    onClick={() => setTextStyle(style.id)}
                    className={`px-3 py-1 rounded-lg text-white text-sm ${
                      textStyle === style.id ? "bg-primary" : "bg-white/10"
                    }`}
                    style={style.style}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-1">
                {TEXT_COLORS.map(color => (
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
          
          {activePanel === "adjust" && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-white" />
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={brightness}
                  onChange={(e) => setBrightness(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white text-sm w-8">{brightness}%</span>
              </div>
              <div className="flex items-center gap-3">
                <Contrast className="w-4 h-4 text-white" />
                <input
                  type="range"
                  min="50"
                  max="150"
                  value={contrast}
                  onChange={(e) => setContrast(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-white text-sm w-8">{contrast}%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Camera View
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent">
        <Button variant="ghost" size="icon" className="text-white" onClick={() => navigate(-1)}>
          <X className="w-6 h-6" />
        </Button>
        
        <div className="flex items-center gap-2">
          <img src="/bruno-mascot.webp" alt="BRUNO" className="w-8 h-8 rounded-full" />
          <span className="text-white font-bold">BRUNO Camera</span>
        </div>
        
        <Button variant="ghost" size="icon" className="text-white" onClick={flipCamera}>
          <FlipHorizontal className="w-6 h-6" />
        </Button>
      </div>

      {/* Camera Preview */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {/* Recording indicator */}
        {isRecording && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-red-500 rounded-full">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="text-white font-medium">Grabando...</span>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-6 bg-gradient-to-t from-black/80 to-transparent">
        {/* Mode selector */}
        <div className="flex justify-center gap-8 mb-6">
          <button
            onClick={() => setMode("photo")}
            className={`text-sm font-medium ${mode === "photo" ? "text-white" : "text-white/50"}`}
          >
            FOTO
          </button>
          <button
            onClick={() => setMode("video")}
            className={`text-sm font-medium ${mode === "video" ? "text-white" : "text-white/50"}`}
          >
            VIDEO
          </button>
        </div>
        
        {/* Capture button */}
        <div className="flex items-center justify-center gap-8">
          {/* Gallery button */}
          <button className="p-3 bg-white/20 rounded-full">
            <ImageIcon className="w-6 h-6 text-white" />
          </button>
          
          {/* Main capture button */}
          {mode === "photo" ? (
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <div className="w-16 h-16 rounded-full bg-white" />
            </button>
          ) : (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-colors ${
                isRecording ? "bg-red-500" : "bg-white/20 hover:bg-white/30"
              }`}
            >
              {isRecording ? (
                <div className="w-8 h-8 rounded-sm bg-white" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-500" />
              )}
            </button>
          )}
          
          {/* BRUNO mascot button */}
          <button className="p-3 bg-white/20 rounded-full">
            <img src="/bruno-mascot.webp" alt="BRUNO" className="w-6 h-6 rounded-full" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrunoCameraPage;
