import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import axios from "axios";
import {
  Radio,
  X,
  ChevronLeft,
  Mic,
  MicOff,
  Video,
  VideoOff,
  RotateCcw,
  Settings,
  Eye,
  MessageCircle,
  Gift,
  Loader2,
  Sparkles,
  Lock,
  Music,
  Gamepad2,
  ChefHat,
  Dumbbell,
  Palette,
  GraduationCap,
  Briefcase,
  Cpu,
  Check
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Category icons mapping
const CATEGORY_ICONS = {
  general: Radio,
  music: Music,
  gaming: Gamepad2,
  talk: MessageCircle,
  cooking: ChefHat,
  fitness: Dumbbell,
  art: Palette,
  education: GraduationCap,
  business: Briefcase,
  technology: Cpu
};

const StartLivePage = () => {
  const navigate = useNavigate();
  const { user, token, isLoading: authLoading } = useAuth();
  
  const [step, setStep] = useState(1); // 1: Setup, 2: Preview, 3: Live
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [liveData, setLiveData] = useState(null);
  
  // Camera states
  const [stream, setStream] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [facingMode, setFacingMode] = useState("user");
  
  const videoRef = useRef(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      navigate("/login");
      return;
    }
    
    // Fetch categories
    axios.get(`${API}/lives/categories`)
      .then(res => setCategories(res.data))
      .catch(console.error);
  }, [token, authLoading, navigate]);

  // Initialize camera
  useEffect(() => {
    if (step >= 2 && !stream) {
      startCamera();
    }
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [step]);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("No se pudo acceder a la cámara. Verifica los permisos.");
    }
  };

  const toggleMic = () => {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMicOn(!isMicOn);
    }
  };

  const toggleCam = () => {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsCamOn(!isCamOn);
    }
  };

  const switchCamera = async () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: true
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error switching camera:", err);
    }
  };

  const handleStartLive = async () => {
    if (!title.trim()) {
      alert("Ingresa un título para tu live");
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.post(
        `${API}/lives`,
        {
          title: title.trim(),
          description: description.trim(),
          category,
          is_private: isPrivate,
          allow_comments: allowComments,
          allow_gifts: allowGifts
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setLiveData(response.data);
      setStep(3);
    } catch (err) {
      alert(err.response?.data?.detail || "Error al iniciar el live");
    } finally {
      setLoading(false);
    }
  };

  const handleEndLive = async () => {
    if (!liveData) return;
    
    setLoading(true);
    try {
      await axios.post(
        `${API}/lives/${liveData.id}/end`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Stop camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      navigate("/lives");
    } catch (err) {
      alert(err.response?.data?.detail || "Error al terminar el live");
    } finally {
      setLoading(false);
    }
  };

  // Auth loading
  if (authLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  // Step 1: Setup
  if (step === 1) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-red-500 rounded-lg flex items-center justify-center">
                <Radio className="w-5 h-5 text-white" />
              </div>
              <h1 className="font-bold">Configurar Live</h1>
            </div>
          </div>
        </div>

        <div className="max-w-lg mx-auto p-4 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-2">Título del Live *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="¿De qué trata tu live?"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground mt-1">{title.length}/100</p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Descripción</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Cuéntale a la gente de qué hablarás..."
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">{description.length}/500</p>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">Categoría</label>
            <div className="grid grid-cols-2 gap-2">
              {categories.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id] || Radio;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                      category === cat.id 
                        ? "border-primary bg-primary/10 text-primary" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-medium">{cat.name}</span>
                    {category === cat.id && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium mb-2">Opciones</label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-muted/50">
              <Checkbox 
                checked={allowComments}
                onCheckedChange={(checked) => setAllowComments(!!checked)}
              />
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1">Permitir comentarios</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-muted/50">
              <Checkbox 
                checked={allowGifts}
                onCheckedChange={(checked) => setAllowGifts(!!checked)}
              />
              <Gift className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1">Permitir regalos</span>
            </label>
            
            <label className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-muted/50">
              <Checkbox 
                checked={isPrivate}
                onCheckedChange={(checked) => setIsPrivate(!!checked)}
              />
              <Lock className="w-5 h-5 text-muted-foreground" />
              <span className="flex-1">Live privado (solo seguidores)</span>
            </label>
          </div>

          {/* Next Button */}
          <Button 
            className="w-full bg-gradient-to-r from-pink-500 to-red-500 hover:opacity-90"
            size="lg"
            onClick={() => setStep(2)}
            disabled={!title.trim()}
          >
            <Video className="w-4 h-4 mr-2" />
            Preparar cámara
          </Button>
        </div>
      </div>
    );
  }

  // Step 2: Preview & Step 3: Live
  return (
    <div className="h-screen bg-black relative overflow-hidden">
      {/* Video Preview */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${facingMode === "user" ? "scale-x-[-1]" : ""}`}
      />

      {/* Overlay when camera is off */}
      {!isCamOn && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <VideoOff className="w-16 h-16 text-white/50 mx-auto mb-4" />
            <p className="text-white/50">Cámara apagada</p>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => step === 2 ? setStep(1) : null}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
          
          <div className="text-center">
            {step === 3 ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-1 bg-red-500 rounded-full">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white text-sm font-bold">EN VIVO</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-black/50 rounded-full">
                  <Eye className="w-4 h-4 text-white" />
                  <span className="text-white text-sm">{liveData?.viewer_count || 0}</span>
                </div>
              </div>
            ) : (
              <span className="text-white font-medium">Vista previa</span>
            )}
          </div>
          
          <Button 
            variant="ghost" 
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={switchCamera}
          >
            <RotateCcw className="w-5 h-5" />
          </Button>
        </div>
        
        {step === 3 && (
          <div className="mt-2 text-center">
            <p className="text-white font-semibold">{liveData?.title}</p>
            <p className="text-white/60 text-sm">{categories.find(c => c.id === category)?.name}</p>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Button 
            variant="ghost" 
            size="lg"
            className={`rounded-full w-14 h-14 ${isMicOn ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}
            onClick={toggleMic}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </Button>
          
          {step === 2 ? (
            <Button 
              size="lg"
              className="rounded-full w-20 h-20 bg-gradient-to-r from-pink-500 to-red-500 hover:opacity-90"
              onClick={handleStartLive}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <Radio className="w-8 h-8" />
              )}
            </Button>
          ) : (
            <Button 
              size="lg"
              className="rounded-full w-20 h-20 bg-red-500 hover:bg-red-600"
              onClick={handleEndLive}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <X className="w-8 h-8" />
              )}
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="lg"
            className={`rounded-full w-14 h-14 ${isCamOn ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}
            onClick={toggleCam}
          >
            {isCamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
          </Button>
        </div>
        
        <p className="text-center text-white/60 text-sm">
          {step === 2 ? "Presiona para iniciar el live" : "Presiona para terminar"}
        </p>
      </div>
    </div>
  );
};

export default StartLivePage;
