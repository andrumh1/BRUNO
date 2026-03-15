import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { X, Send, Loader2, Sparkles, HelpCircle, Lightbulb, MessageCircle } from "lucide-react";

/**
 * BRUNO Mascot Component
 * The friendly dog mascot that appears throughout the app
 */

// BRUNO's moods/expressions based on context
const BRUNO_MOODS = {
  default: { animation: "bounce", message: "¡Hola! Soy BRUNO 🐕" },
  thinking: { animation: "pulse", message: "Hmm, déjame pensar..." },
  happy: { animation: "bounce", message: "¡Genial! 🎉" },
  helpful: { animation: "wave", message: "¿En qué te puedo ayudar?" },
  greeting: { animation: "wave", message: "¡Bienvenido a BRUNO!" },
  success: { animation: "celebrate", message: "¡Listo! Todo salió perfecto" },
  loading: { animation: "spin", message: "Cargando..." }
};

// Animation styles
const ANIMATIONS = {
  bounce: "animate-bounce",
  pulse: "animate-pulse",
  wave: "animate-wave",
  celebrate: "animate-celebrate",
  spin: "animate-spin",
  none: ""
};

// Simple BRUNO Avatar
export const BrunoAvatar = ({ 
  size = "md", 
  mood = "default",
  showBubble = false,
  bubbleText = "",
  className = ""
}) => {
  const sizes = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
    xl: "w-24 h-24"
  };
  
  const moodConfig = BRUNO_MOODS[mood] || BRUNO_MOODS.default;
  
  return (
    <div className={`relative ${className}`}>
      <div className={`${sizes[size]} ${ANIMATIONS[moodConfig.animation] || ""}`}>
        <img 
          src="/bruno-mascot.webp"
          alt="BRUNO"
          className="w-full h-full object-contain drop-shadow-lg"
        />
      </div>
      
      {showBubble && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-gray-800 px-3 py-1 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
          {bubbleText || moodConfig.message}
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white dark:bg-gray-800 rotate-45" />
        </div>
      )}
    </div>
  );
};

// BRUNO Loading Screen
export const BrunoLoading = ({ message = "Cargando..." }) => (
  <div className="flex flex-col items-center justify-center gap-4 py-12">
    <BrunoAvatar size="xl" mood="loading" />
    <p className="text-muted-foreground animate-pulse">{message}</p>
  </div>
);

// BRUNO Empty State
export const BrunoEmptyState = ({ 
  title = "No hay nada aquí",
  message = "Parece que está vacío por ahora",
  action = null,
  actionText = ""
}) => (
  <div className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center">
    <BrunoAvatar size="xl" mood="helpful" showBubble bubbleText={title} />
    <p className="text-muted-foreground max-w-sm">{message}</p>
    {action && (
      <Button onClick={action}>{actionText}</Button>
    )}
  </div>
);

// BRUNO Welcome/Greeting
export const BrunoGreeting = ({ userName = "" }) => {
  const [showBubble, setShowBubble] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => setShowBubble(true), 500);
    return () => clearTimeout(timer);
  }, []);
  
  const greeting = userName 
    ? `¡Hola ${userName}! 👋` 
    : "¡Bienvenido a BRUNO! 🎉";
  
  return (
    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/10 to-orange-500/10 rounded-2xl">
      <BrunoAvatar size="lg" mood="greeting" showBubble={showBubble} bubbleText={greeting} />
      <div>
        <h2 className="font-bold text-lg">Tu asistente BRUNO</h2>
        <p className="text-sm text-muted-foreground">
          Estoy aquí para ayudarte con lo que necesites
        </p>
      </div>
    </div>
  );
};

// BRUNO Tip/Hint Component
export const BrunoTip = ({ tip, onDismiss }) => (
  <div className="flex items-start gap-3 p-4 bg-primary/10 rounded-xl border border-primary/20">
    <BrunoAvatar size="sm" mood="helpful" />
    <div className="flex-1">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">Tip de BRUNO</span>
      </div>
      <p className="text-sm text-muted-foreground">{tip}</p>
    </div>
    {onDismiss && (
      <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
        <X className="w-4 h-4" />
      </button>
    )}
  </div>
);

// Quick Actions with BRUNO
export const BrunoQuickActions = ({ onAction }) => {
  const actions = [
    { id: "create-card", icon: "💳", label: "Crear tarjeta" },
    { id: "find-contacts", icon: "🔍", label: "Buscar contactos" },
    { id: "scan-nfc", icon: "📱", label: "Escanear NFC" },
    { id: "help", icon: "❓", label: "Ayuda" }
  ];
  
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BrunoAvatar size="sm" />
        <span className="text-sm font-medium">¿Qué quieres hacer?</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actions.map(action => (
          <button
            key={action.id}
            onClick={() => onAction(action.id)}
            className="flex items-center gap-2 p-3 bg-muted rounded-xl hover:bg-muted/80 transition-colors"
          >
            <span className="text-xl">{action.icon}</span>
            <span className="text-sm">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// Floating BRUNO Assistant Button (Enhanced)
export const BrunoFloatingButton = ({ onClick, unreadCount = 0 }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showTip, setShowTip] = useState(false);
  
  useEffect(() => {
    // Show tip after 10 seconds of inactivity
    const timer = setTimeout(() => setShowTip(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div className="fixed bottom-20 left-4 z-50">
      {/* Tip bubble */}
      {showTip && !isHovered && (
        <div className="absolute -top-12 left-0 whitespace-nowrap bg-white dark:bg-gray-800 px-3 py-2 rounded-xl shadow-lg text-sm animate-in fade-in slide-in-from-bottom-2">
          <span>¿Necesitas ayuda? 💬</span>
          <button 
            onClick={() => setShowTip(false)}
            className="ml-2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3 h-3 inline" />
          </button>
        </div>
      )}
      
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="relative group"
      >
        <div className={`w-14 h-14 rounded-full bg-gradient-to-br from-primary to-orange-500 p-0.5 shadow-lg hover:shadow-xl transition-all ${isHovered ? 'scale-110' : ''}`}>
          <img 
            src="/mascots/bruno-logo.png"
            alt="BRUNO IA"
            className={`w-full h-full rounded-full object-cover ${isHovered ? 'animate-bounce' : ''}`}
          />
        </div>
        
        {/* Sparkle effect */}
        <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-yellow-400 animate-pulse" />
        
        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -left-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

// Full BRUNO IA Chat Interface
const BrunoMascot = ({ 
  isOpen = false, 
  onClose, 
  initialMessage = "",
  context = {} 
}) => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 1,
      from: "bruno",
      text: "¡Hola! 👋 Soy BRUNO, tu asistente personal. ¿En qué puedo ayudarte hoy?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState(initialMessage);
  const [isTyping, setIsTyping] = useState(false);

  const quickReplies = [
    "Crear una tarjeta",
    "¿Cómo funciona?",
    "Ver mi perfil",
    "Buscar profesionales"
  ];

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = {
      id: Date.now(),
      from: "user",
      text: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    
    // Simulate AI response (in real app, call API)
    setTimeout(() => {
      const responses = [
        "¡Excelente pregunta! Déjame ayudarte con eso...",
        "Entiendo lo que necesitas. Te explico...",
        "¡Claro! Puedo ayudarte con eso. Mira...",
        "Perfecto, te guío paso a paso..."
      ];
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        from: "bruno",
        text: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date()
      }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleQuickReply = (reply) => {
    setInput(reply);
    handleSend();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-24 left-4 w-80 max-h-[500px] bg-card rounded-2xl shadow-2xl border z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-4">
      {/* Header */}
      <div className="p-3 bg-gradient-to-r from-primary to-orange-500 flex items-center gap-3">
        <img src="/mascots/bruno-logo.png" alt="BRUNO" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
        <div className="flex-1">
          <h3 className="font-bold text-white">BRUNO IA</h3>
          <p className="text-xs text-white/80">Tu asistente personal</p>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
          <X className="w-5 h-5 text-white" />
        </button>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-64">
        {messages.map(msg => (
          <div 
            key={msg.id}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.from === "bruno" && (
              <img src="/bruno-mascot.webp" alt="" className="w-6 h-6 rounded-full mr-2 flex-shrink-0" />
            )}
            <div className={`max-w-[80%] px-3 py-2 rounded-2xl ${
              msg.from === "user" 
                ? "bg-primary text-white rounded-br-sm"
                : "bg-muted rounded-bl-sm"
            }`}>
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex items-center gap-2">
            <img src="/bruno-mascot.webp" alt="" className="w-6 h-6 rounded-full animate-bounce" />
            <div className="bg-muted px-3 py-2 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: "0ms"}} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: "150ms"}} />
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{animationDelay: "300ms"}} />
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick Replies */}
      <div className="px-3 pb-2 flex gap-2 overflow-x-auto">
        {quickReplies.map((reply, idx) => (
          <button
            key={idx}
            onClick={() => handleQuickReply(reply)}
            className="px-3 py-1 bg-primary/10 text-primary text-xs rounded-full whitespace-nowrap hover:bg-primary/20"
          >
            {reply}
          </button>
        ))}
      </div>
      
      {/* Input */}
      <div className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Escribe tu mensaje..."
          className="flex-1 px-3 py-2 bg-muted rounded-full text-sm outline-none"
        />
        <Button size="icon" className="rounded-full" onClick={handleSend} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default BrunoMascot;
