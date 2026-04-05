import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, X, Send, Loader2, Trash2, Paperclip, Image, FileText, ExternalLink, Search, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Parse action buttons from AI response
const parseActions = (text) => {
  const actions = [];
  const cleanText = text.replace(/\[ACTION:(route|search):([^|]+)\|([^\]]+)\]/g, (_, type, value, label) => {
    actions.push({ type, value, label });
    return '';
  });
  
  const cards = [];
  const finalText = cleanText.replace(/\[CARD:([^|]+)\|([^|]+)\|([^|]*)\|?([^\]]*)\]/g, (_, id, title, cardType, city) => {
    cards.push({ id, title, cardType, city: city || '' });
    return '';
  });
  
  return { text: finalText.trim(), actions, cards };
};

// Action Button Component
const ActionButton = ({ action, onClick }) => {
  const isSearch = action.type === 'search';
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all hover:scale-[1.02] active:scale-95"
      data-testid={`ai-action-${action.type}`}
    >
      {isSearch ? <Search className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
      <span>{action.label}</span>
    </button>
  );
};

// Card Preview Component
const CardPreview = ({ card, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2.5 w-full p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-left group"
    data-testid={`ai-card-${card.id}`}
  >
    <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
      {card.title?.charAt(0) || '?'}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold truncate">{card.title}</p>
      <p className="text-[9px] opacity-60 truncate">{card.cardType}{card.city ? ` · ${card.city}` : ''}</p>
    </div>
    <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
  </button>
);

// Message Bubble Component
const MessageBubble = ({ msg, navigate }) => {
  const { text, actions, cards } = parseActions(msg.content);
  const isUser = msg.role === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] space-y-1.5 ${isUser ? '' : ''}`}>
        {/* Text content */}
        <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
          isUser
            ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-md'
            : 'bg-muted/80 rounded-bl-md'
        }`}>
          <p className="whitespace-pre-wrap">{text}</p>
          
          {/* Attachment preview */}
          {msg.attachment && (
            <div className="mt-1.5 p-1.5 rounded-lg bg-black/10 flex items-center gap-2">
              {msg.attachment.type?.startsWith('image') ? (
                <img src={msg.attachment.url} alt="Adjunto" className="w-20 h-20 rounded-lg object-cover" />
              ) : (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate">{msg.attachment.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Card Previews */}
        {cards.length > 0 && (
          <div className="space-y-1">
            {cards.map((card, i) => (
              <CardPreview key={i} card={card} onClick={() => navigate(`/c/${card.id}`)} />
            ))}
          </div>
        )}
        
        {/* Action Buttons */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action, i) => (
              <ActionButton
                key={i}
                action={action}
                onClick={() => {
                  if (action.type === 'route') {
                    navigate(action.value);
                  } else if (action.type === 'search') {
                    navigate(`/feed?search=${encodeURIComponent(action.value)}`);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const FloatingBubbles = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastScrollRef = useRef(0);

  const isOnChatPage = location.pathname.startsWith("/chat");

  // Scroll hide
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollRef.current + 40 && y > 100) {
        setHiddenByScroll(true);
      } else if (y < lastScrollRef.current - 20) {
        setHiddenByScroll(false);
      }
      lastScrollRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  useEffect(() => {
    if (showAIChat && token && aiMessages.length === 0) loadAIHistory();
  }, [showAIChat, token]);

  const loadAIHistory = async () => {
    try {
      const response = await axios.get(`${API}/ai/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.length > 0) {
        const messages = [];
        for (const conv of response.data.reverse()) {
          messages.push({ role: "user", content: conv.user_message });
          messages.push({ role: "assistant", content: conv.ai_response });
          if (!sessionId && conv.session_id) setSessionId(conv.session_id);
        }
        setAiMessages(messages);
      } else {
        setAiMessages([{
          role: "assistant",
          content: "Soy BRUNO IA. ¿Que necesitas?\n\n→ Crear tarjeta\n→ Buscar profesional\n→ Ayuda con la app\n[ACTION:route:/cards/new|Crear Tarjeta]\n[ACTION:route:/feed|Explorar Feed]"
        }]);
      }
    } catch {
      setAiMessages([{ role: "assistant", content: "BRUNO IA listo. ¿En que te ayudo?" }]);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("Archivo muy grande. Maximo 10MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({
        file,
        url: ev.target.result,
        name: file.name,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const sendAIMessage = async (e) => {
    e.preventDefault();
    if ((!aiInput.trim() && !attachment) || aiLoading) return;

    const userMessage = aiInput.trim() || (attachment ? `[Archivo: ${attachment.name}]` : '');
    const userAttachment = attachment;
    setAiInput("");
    setAttachment(null);
    
    setAiMessages(prev => [...prev, { 
      role: "user", 
      content: userMessage,
      attachment: userAttachment ? { url: userAttachment.url, name: userAttachment.name, type: userAttachment.type } : null
    }]);
    
    setAiLoading(true);
    try {
      // Upload attachment if present
      let attachmentUrl = null;
      let attachmentType = null;
      if (userAttachment) {
        try {
          const formData = new FormData();
          formData.append('file', userAttachment.file);
          const uploadRes = await axios.post(`${API}/upload/chat-file`, formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
          });
          attachmentUrl = uploadRes.data.url;
          attachmentType = userAttachment.type;
        } catch {
          // If upload fails, continue without attachment
        }
      }
      
      const response = await axios.post(
        `${API}/ai/chat`,
        { message: userMessage, session_id: sessionId, attachment_url: attachmentUrl, attachment_type: attachmentType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessionId(response.data.session_id);
      
      // Enrich response with card data if available
      let aiResponse = response.data.response;
      if (response.data.cards_context?.length > 0) {
        const cardTags = response.data.cards_context
          .filter(c => !aiResponse.includes(`[CARD:${c.id}`))
          .map(c => `[CARD:${c.id}|${c.title}|${c.card_type}|${c.city || ''}]`)
          .join('\n');
        if (cardTags && !aiResponse.includes('[CARD:')) {
          aiResponse += '\n' + cardTags;
        }
      }
      
      setAiMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Error de conexion. Intenta de nuevo." }]);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAIHistory = async () => {
    try {
      await axios.delete(`${API}/ai/history`, { headers: { Authorization: `Bearer ${token}` } });
      setSessionId(null);
      setAiMessages([{ role: "assistant", content: "Conversacion reiniciada. ¿Que necesitas?\n[ACTION:route:/cards/new|Crear Tarjeta]" }]);
    } catch {}
  };

  if (!user || isOnChatPage) return null;

  const bubbleHidden = hiddenByScroll && !showAIChat;

  return (
    <>
      <div className={`fixed bottom-20 left-3 z-[9990] md:bottom-6 md:left-6 transition-all duration-300 ${
        bubbleHidden ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        {/* BRUNO AI Bubble */}
        <div 
          className="relative cursor-pointer group"
          onClick={() => setShowAIChat(!showAIChat)}
          data-testid="floating-ai-btn"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-primary/30 to-orange-500/30 rounded-full blur-xl group-hover:from-primary/50 group-hover:to-orange-500/50 transition-all duration-300 animate-pulse" />
          <div className="relative w-11 h-11 rounded-full overflow-hidden shadow-lg shadow-primary/25 hover:shadow-primary/40 transform hover:scale-105 active:scale-95 transition-all duration-200">
            <img src="/mascots/bruno-logo.png" alt="BRUNO IA" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -top-0.5 -right-0.5 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-[9px] font-bold text-white shadow-md">
            IA
          </div>
        </div>

        {/* AI Chat Window */}
        {showAIChat && (
          <div className="absolute bottom-14 left-0 w-80 sm:w-[340px] h-[440px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200" data-testid="ai-chat-window">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs">BRUNO IA</h4>
                  <p className="text-[10px] text-muted-foreground">Agente inteligente</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); clearAIHistory(); }} title="Limpiar">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setShowAIChat(false); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-gradient-to-b from-transparent to-muted/10">
              {aiMessages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} navigate={(path) => { navigate(path); setShowAIChat(false); }} />
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted/80 px-3 py-2 rounded-2xl rounded-bl-md flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[10px] text-muted-foreground">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview */}
            {attachment && (
              <div className="px-2 py-1.5 border-t bg-muted/30 flex items-center gap-2">
                {attachment.type?.startsWith('image') ? (
                  <img src={attachment.url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
                <span className="text-[10px] flex-1 truncate">{attachment.name}</span>
                <button onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Input with attachment support */}
            <form onSubmit={sendAIMessage} className="p-2 border-t">
              <div className="flex gap-1.5 items-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.txt,.csv"
                  onChange={handleFileSelect}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
                  data-testid="ai-attach-btn"
                >
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Escribe o adjunta..."
                  className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3"
                  disabled={aiLoading}
                  data-testid="ai-chat-input"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={(!aiInput.trim() && !attachment) || aiLoading}
                  className="h-7 w-7 p-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shrink-0"
                  data-testid="ai-send-btn"
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </>
  );
};

export default FloatingBubbles;
