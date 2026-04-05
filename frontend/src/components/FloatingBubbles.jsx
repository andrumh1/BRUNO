import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { Sparkles, X, Send, Loader2, Trash2, Paperclip, FileText, Search, ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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

const ActionButton = ({ action, onClick }) => {
  const isSearch = action.type === 'search';
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all hover:scale-[1.02] active:scale-95"
      data-testid={`ai-action-${action.type}`}>
      {isSearch ? <Search className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
      <span>{action.label}</span>
    </button>
  );
};

const CardPreview = ({ card, onClick }) => (
  <button onClick={onClick}
    className="flex items-center gap-2.5 w-full p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 transition-all text-left group"
    data-testid={`ai-card-${card.id}`}>
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

const MessageBubble = ({ msg, navigate }) => {
  const { text, actions, cards } = parseActions(msg.content);
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[88%] space-y-1.5">
        <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${
          isUser ? 'bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-md' : 'bg-muted/80 rounded-bl-md'
        }`}>
          <p className="whitespace-pre-wrap">{text}</p>
          {msg.attachment && (
            <div className="mt-1.5 p-1.5 rounded-lg bg-black/10 flex items-center gap-2">
              {msg.attachment.type?.startsWith('image') ? (
                <img src={msg.attachment.url} alt="" className="w-20 h-20 rounded-lg object-cover" />
              ) : (
                <div className="flex items-center gap-1.5 text-[10px]">
                  <FileText className="w-3.5 h-3.5" />
                  <span className="truncate">{msg.attachment.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
        {cards.length > 0 && (
          <div className="space-y-1">
            {cards.map((card, i) => (
              <CardPreview key={i} card={card} onClick={() => navigate(`/c/${card.id}`)} />
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action, i) => (
              <ActionButton key={i} action={action}
                onClick={() => {
                  if (action.type === 'route') navigate(action.value);
                  else if (action.type === 'search') navigate(`/feed?search=${encodeURIComponent(action.value)}`);
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
  const { minimized, setMinimized, minimizedCards, removeMinimizedCard, touchHandlers } = useNavScroll();
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));

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
    if (file.size > 10 * 1024 * 1024) { alert("Max 10MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setAttachment({ file, url: ev.target.result, name: file.name, type: file.type });
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
    setAiMessages(prev => [...prev, { role: "user", content: userMessage, attachment: userAttachment ? { url: userAttachment.url, name: userAttachment.name, type: userAttachment.type } : null }]);
    setAiLoading(true);
    try {
      let attachmentUrl = null, attachmentType = null;
      if (userAttachment) {
        try {
          const formData = new FormData();
          formData.append('file', userAttachment.file);
          const uploadRes = await axios.post(`${API}/upload/chat-file`, formData, {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
          });
          attachmentUrl = uploadRes.data.url;
          attachmentType = userAttachment.type;
        } catch {}
      }
      const response = await axios.post(`${API}/ai/chat`,
        { message: userMessage, session_id: sessionId, attachment_url: attachmentUrl, attachment_type: attachmentType },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSessionId(response.data.session_id);
      let aiResponse = response.data.response;
      if (response.data.cards_context?.length > 0) {
        const cardTags = response.data.cards_context
          .filter(c => !aiResponse.includes(`[CARD:${c.id}`))
          .map(c => `[CARD:${c.id}|${c.title}|${c.card_type}|${c.city || ''}]`).join('\n');
        if (cardTags && !aiResponse.includes('[CARD:')) aiResponse += '\n' + cardTags;
      }
      setAiMessages(prev => [...prev, { role: "assistant", content: aiResponse }]);
    } catch {
      setAiMessages(prev => [...prev, { role: "assistant", content: "Error de conexion. Intenta de nuevo." }]);
    } finally { setAiLoading(false); }
  };

  const clearAIHistory = async () => {
    try {
      await axios.delete(`${API}/ai/history`, { headers: { Authorization: `Bearer ${token}` } });
      setSessionId(null);
      setAiMessages([{ role: "assistant", content: "Conversacion reiniciada. ¿Que necesitas?\n[ACTION:route:/cards/new|Crear Tarjeta]" }]);
    } catch {}
  };

  if (!user || shouldHide) return null;

  return (
    <>
      {/* === MINIMIZED STATE: Card tray + AI pill === */}
      {minimized && (
        <>
          {/* Minimized card pills — scrollable, to the LEFT of AI pill */}
          {minimizedCards.length > 0 && (
            <div
              className="fixed z-[10000] bottom-[19px] overflow-x-auto scrollbar-hide transition-all duration-300"
              style={{
                left: '8px',
                right: 'calc(50% + 104px)',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
              }}
              data-testid="minimized-cards-tray"
            >
              <div className="flex items-center gap-1.5 w-max">
                {minimizedCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => { setMinimized(false); navigate(`/c/${card.id}`); removeMinimizedCard(card.id); }}
                    className="relative group/card shrink-0"
                    data-testid={`minimized-card-${card.id}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-2xl border border-border/50 shadow-lg overflow-hidden transition-all hover:scale-110 active:scale-90 flex items-center justify-center">
                      {card.thumbnail ? (
                        <img src={card.thumbnail} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[9px] font-bold text-primary">
                          {(card.title || "?")[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full items-center justify-center text-white hidden group-hover/card:flex transition-all cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); removeMinimizedCard(card.id); }}>
                      <X className="w-2 h-2" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* AI pill */}
          <div className="fixed z-[10000] bottom-[18px] transition-all duration-300 ease-out"
            style={{ right: 'calc(50% + 60px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <button
              onClick={() => setShowAIChat(!showAIChat)}
              {...touchHandlers}
              className="relative group transition-all duration-300"
              data-testid="floating-ai-btn"
            >
              <div className={`flex items-center gap-1 px-3 py-2 rounded-full bg-background/90 backdrop-blur-2xl border border-border/50 shadow-xl shadow-black/10 hover:shadow-black/20 transition-all duration-300 active:scale-95 ${
                showAIChat ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-background' : ''
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              </div>
            </button>
          </div>
        </>
      )}

      {/* === EXPANDED STATE: Colored circle above nav bar === */}
      {!minimized && (
        <div className="fixed z-[10000] bottom-[74px] left-3 transition-all duration-300 ease-out"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
          <button
            onClick={() => setShowAIChat(!showAIChat)}
            className="relative group transition-all duration-300"
            data-testid="floating-ai-btn"
          >
            <div className={`absolute inset-[-3px] bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 rounded-full blur-md transition-all duration-300 ${
              showAIChat ? 'opacity-90' : 'opacity-0 group-hover:opacity-60'
            }`} />
            <div className={`relative w-10 h-10 rounded-full overflow-hidden shadow-md transition-all duration-300 shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-110 active:scale-90 ${
              showAIChat ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-background' : ''
            }`}>
              <div className="w-full h-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="absolute -top-0.5 -right-0.5 px-1 py-0 text-[7px] bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-white font-bold shadow">
              IA
            </div>
          </button>
        </div>
      )}

      {/* AI Chat Window - portal */}
      {showAIChat && (
        <div className="fixed bottom-24 left-2 z-[10001] w-[calc(100vw-16px)] sm:w-[340px] h-[440px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
          data-testid="ai-chat-window"
        >
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

          {/* Input */}
          <form onSubmit={sendAIMessage} className="p-2 border-t">
            <div className="flex gap-1.5 items-center">
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*,.pdf,.doc,.docx,.txt,.csv" onChange={handleFileSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0" data-testid="ai-attach-btn">
                <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder="Escribe o adjunta..."
                className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3" disabled={aiLoading} data-testid="ai-chat-input" />
              <Button type="submit" size="sm"
                disabled={(!aiInput.trim() && !attachment) || aiLoading}
                className="h-7 w-7 p-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shrink-0" data-testid="ai-send-btn">
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};

export default FloatingBubbles;
