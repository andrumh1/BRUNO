import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { Sparkles, X, Send, Loader2, Trash2, Paperclip, FileText, Search, ArrowRight, ChevronRight, Minimize2, Mic, Square, Volume2, VolumeX, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useDragToMinimize from "@/hooks/useDragToMinimize";
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
  let publish = null;
  const finalText = cleanText.replace(/\[CARD:([^|]+)\|([^|]+)\|([^|]*)\|?([^\]]*)\]/g, (_, id, title, cardType, city) => {
    cards.push({ id, title, cardType, city: city || '' });
    return '';
  }).replace(/\[PUBLISH:([^\]]+)\]/g, (_, caption) => { publish = caption.trim(); return ''; });
  return { text: finalText.trim(), actions, cards, publish };
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

const MessageBubble = ({ msg, navigate, onPublish, onSpeak }) => {
  const { text, actions, cards, publish } = parseActions(msg.content);
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
              <CardPreview key={`card-${i}`} card={card} onClick={() => navigate(`/c/${card.id}`)} />
            ))}
          </div>
        )}
        {!isUser && publish && msg.imageUrl && !msg.streaming && (
          <button onClick={() => onPublish?.(msg.imageUrl, publish)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary text-white hover:bg-primary/90 active:scale-95 transition-all"
            data-testid="ai-publish-photo-btn">
            <ImagePlus className="w-3 h-3" /> Publicar esta foto con el caption
          </button>
        )}
        {!isUser && text && !msg.streaming && onSpeak && (
          <button onClick={() => onSpeak(text)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1" data-testid="ai-speak-msg-btn">
            <Volume2 className="w-3 h-3" /> Escuchar
          </button>
        )}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {actions.map((action, i) => (
              <ActionButton key={`action-${i}`} action={action}
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

// Card type badge colors
const CARD_TYPE_COLORS = {
  personal: '#3B82F6',
  business: '#10B981',
  freelance: '#F97316',
  curriculum: '#8B5CF6',
  oferta_trabajo: '#EAB308',
  busqueda_personal: '#EC4899',
  solicitud_servicio: '#06B6D4',
};

// Item type badge colors & icons
const ITEM_TYPE_CONFIG = {
  card: { color: null, icon: 'C' },        // Uses CARD_TYPE_COLORS
  profile: { color: '#8B5CF6', icon: 'P' },
  post: { color: '#3B82F6', icon: 'T' },
  reel: { color: '#EF4444', icon: 'R' },
  live: { color: '#EF4444', icon: 'L' },
};

/**
 * AIChatWindow — extracted to support drag-to-minimize + a Minimize2 button
 * without bloating the parent FloatingBubbles render path.
 */
const AIChatWindow = ({
  onClose, onMinimize, onClear,
  aiMessages, aiLoading, aiInput, setAiInput,
  sendAIMessage, messagesEndRef,
  attachment, setAttachment,
  fileInputRef, handleFileSelect, navigate,
  aiModels = [], aiModel, setAiModel,
  voiceOn, setVoiceOn, speak, recording, toggleRecording, publishPhoto, transcribing,
}) => {
  const { bind: dragBind, dragY, dragging } = useDragToMinimize({ onMinimize, threshold: 55 });
  const [modelMenu, setModelMenu] = useState(false);
  const currentModel = aiModels.find((m) => m.id === aiModel);
  return (
    <div
      className="fixed bottom-24 left-2 z-[10001] w-[calc(100vw-16px)] sm:w-[340px] h-[440px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200"
      data-testid="ai-chat-window"
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragging ? "none" : "transform 200ms cubic-bezier(.2,.8,.2,1)",
        opacity: dragY > 0 ? Math.max(0.55, 1 - dragY / 220) : 1,
      }}
    >
      {/* Header — drag handle */}
      <div {...dragBind} className="relative flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10 cursor-grab active:cursor-grabbing select-none touch-none">
        <span className="absolute top-1 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-foreground/15" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="relative">
            <h4 className="font-semibold text-xs">BRUNO IA</h4>
            <button
              onClick={(e) => { e.stopPropagation(); setModelMenu((v) => !v); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
              data-testid="ai-model-toggle"
            >
              {currentModel?.name || "ChatGPT"} <span className="text-[8px]">▾</span>
            </button>
            {modelMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 w-60 rounded-2xl border bruno-glass p-1.5 shadow-xl" data-testid="ai-model-menu" onClick={(e) => e.stopPropagation()}>
                {aiModels.map((m) => (
                  <button key={m.id} onClick={() => { setAiModel(m.id); setModelMenu(false); }}
                    className={`w-full text-left rounded-xl px-2.5 py-2 hover:bg-foreground/[0.06] ${m.id === aiModel ? "bg-primary/10" : ""}`}
                    data-testid={`ai-model-${m.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold">{m.name}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">{m.tag}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">{m.description}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className={`h-7 w-7 ${voiceOn ? "text-primary" : ""}`} onClick={(e) => { e.stopPropagation(); setVoiceOn((v) => !v); }} title={voiceOn ? "Voz activada" : "Activar voz"} data-testid="ai-voice-toggle">
            {voiceOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onClear(); }} title="Limpiar">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onMinimize(); }} title="Minimizar" data-testid="ai-chat-minimize">
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onClose(); }} data-testid="ai-chat-close">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 bg-gradient-to-b from-transparent to-muted/10">
        {aiMessages.map((msg, i) => (
          <MessageBubble key={`msg-${i}`} msg={msg} navigate={(path) => { navigate(path); onClose(); }} onPublish={publishPhoto} onSpeak={speak} />
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
      {attachment?.type?.startsWith("image") && (
        <div className="px-2 pt-1.5 flex gap-1.5 flex-wrap">
          <button type="button" onClick={() => setAiInput("Convierte esta foto en una publicación con caption y hashtags")} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20" data-testid="ai-quick-publish">✨ Convertir en publicación</button>
          <button type="button" onClick={() => setAiInput("Describe esta imagen en detalle")} className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-muted border" data-testid="ai-quick-describe">Describir imagen</button>
        </div>
      )}
      {attachment && (
        <div className="px-2 py-1.5 border-t bg-muted/30 flex items-center gap-2">
          {attachment.type?.startsWith("image") ? (
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
          <button type="button" onClick={toggleRecording} disabled={aiLoading || transcribing}
            className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors shrink-0 ${recording ? "bg-red-500 text-white animate-pulse" : "hover:bg-muted text-muted-foreground"}`}
            title={recording ? "Detener" : "Hablar"} data-testid="ai-mic-btn">
            {transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : recording ? <Square className="w-3 h-3 fill-current" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <Input value={aiInput} onChange={(e) => setAiInput(e.target.value)} placeholder={recording ? "Escuchando…" : "Escribe, habla o adjunta…"}
            className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3" disabled={aiLoading} data-testid="ai-chat-input" />
          <Button type="submit" size="sm"
            disabled={(!aiInput.trim() && !attachment) || aiLoading}
            className="h-7 w-7 p-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 shrink-0" data-testid="ai-send-btn">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </form>
    </div>
  );
};


const FloatingBubbles = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { minimized, setMinimized, minimizedItems, removeMinimizedItem, touchHandlers, idle, bumpIdle } = useNavScroll();
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiModels, setAiModels] = useState([]);
  const [aiModel, setAiModel] = useState(() => localStorage.getItem("bruno-ai-model") || "gpt-5.4");
  useEffect(() => {
    axios.get(`${API}/ai/models`).then((r) => setAiModels(r.data?.models || [])).catch(() => {});
  }, []);
  useEffect(() => { localStorage.setItem("bruno-ai-model", aiModel); }, [aiModel]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [attachment, setAttachment] = useState(null);
  const [tooltipCard, setTooltipCard] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimer = useRef(null);

  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno', '/chat/'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Auto-minimize the AI chat window WHEN the whole navigation pill minimizes.
  // We CLOSE the chat (showAIChat=false) so only the tiny pill remains —
  // otherwise the larger `ai-chat-minimized` bubble would coexist with the
  // small pill, breaking the "one cohesive unit" UX the user asked for.
  useEffect(() => {
    if (minimized) { setShowAIChat(false); setAiMinimized(false); }
  }, [minimized]);

  // Also react to the global minimize-all broadcast.
  useEffect(() => {
    const onAll = () => { setShowAIChat(false); setAiMinimized(false); };
    window.addEventListener("bruno:minimize-all", onAll);
    return () => window.removeEventListener("bruno:minimize-all", onAll);
  }, []);

  // When the user manually minimizes the AI chat (from inside the window),
  // ping the global so the nav pill (and the floating chat) follow suit.
  useEffect(() => {
    if (aiMinimized && showAIChat) {
      try { window.dispatchEvent(new CustomEvent("bruno:child-minimized")); } catch (_e) { /* ignore */ }
    }
  }, [aiMinimized, showAIChat]);

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

  /* ── Voice (whisper-1 STT + tts-1 TTS) ── */
  const [voiceOn, setVoiceOn] = useState(() => localStorage.getItem("bruno-ai-voice") === "1");
  useEffect(() => { localStorage.setItem("bruno-ai-voice", voiceOn ? "1" : "0"); }, [voiceOn]);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const pendingSendRef = useRef(false);

  const speak = async (text) => {
    try {
      const res = await fetch(`${API}/ai/speak`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text, voice: "nova" }) });
      if (!res.ok) return;
      const blob = await res.blob();
      audioRef.current?.pause();
      const a = new Audio(URL.createObjectURL(blob));
      audioRef.current = a;
      a.play().catch(() => {});
    } catch { /* silent */ }
  };

  const toggleRecording = async () => {
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 1000) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, `voz.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`);
          const r = await axios.post(`${API}/ai/transcribe`, fd, { headers: { Authorization: `Bearer ${token}` } });
          const text = (r.data?.text || "").trim();
          if (text) { setAiInput(text); pendingSendRef.current = true; }
        } catch { /* silent */ }
        setTranscribing(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch { /* mic denied */ }
  };
  // Auto-send right after a successful transcription
  useEffect(() => {
    if (pendingSendRef.current && aiInput.trim() && !aiLoading) { pendingSendRef.current = false; sendAIMessage({ preventDefault() {} }); }
  }, [aiInput]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Vision → publish ── */
  const publishPhoto = async (imageUrl, caption) => {
    const { brunoToast } = await import("@/components/bruno/BrunoToast");
    try {
      const r = await axios.post(`${API}/posts`, { content: caption, media: [{ type: "image", url: imageUrl }], post_type: "image", visibility: "public" }, { headers: { Authorization: `Bearer ${token}` } });
      brunoToast.publish("Publicación creada", { description: "Tu foto ya está en el feed y en tu perfil." });
      setShowAIChat(false);
      navigate(`/post/${r.data.id}`);
    } catch { brunoToast.error("No se pudo publicar la foto"); }
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
      // Streaming (SSE) — tokens appear word by word
      const res = await fetch(`${API}/ai/chat/stream`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, session_id: sessionId, attachment_url: attachmentUrl, attachment_type: attachmentType, model: aiModel }),
      });
      if (!res.ok || !res.body) throw new Error("stream failed");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "", aiResponse = "", cards = [];
      setAiMessages(prev => [...prev, { role: "assistant", content: "", streaming: true }]);
      const patchLast = (content, extra = {}) => setAiMessages(prev => {
        const next = [...prev];
        const i = next.length - 1;
        if (i >= 0 && next[i].role === "assistant") next[i] = { ...next[i], content, ...extra };
        return next;
      });
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;
          let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
          if (ev.type === "meta") { setSessionId(ev.session_id); cards = ev.cards_context || []; }
          else if (ev.type === "delta") { aiResponse += ev.content; patchLast(aiResponse); }
          else if (ev.type === "error") throw new Error(ev.detail || "stream error");
        }
      }
      if (cards.length > 0) {
        const cardTags = cards
          .filter(c => !aiResponse.includes(`[CARD:${c.id}`))
          .map(c => `[CARD:${c.id}|${c.title}|${c.card_type}|${c.city || ''}]`).join('\n');
        if (cardTags && !aiResponse.includes('[CARD:')) aiResponse += '\n' + cardTags;
      }
      patchLast(aiResponse, { streaming: false, model: aiModel, imageUrl: (attachmentType || "").startsWith("image") ? attachmentUrl : null });
      if (voiceOn && aiResponse) speak(aiResponse);
    } catch {
      setAiMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) return [...prev.slice(0, -1), { role: "assistant", content: "Error de conexion. Intenta de nuevo." }];
        return [...prev, { role: "assistant", content: "Error de conexion. Intenta de nuevo." }];
      });
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
          {/* Minimized items tray — universal: cards, profiles, posts, reels, lives */}
          {minimizedItems.length > 0 && (
            <div
              className={`fixed z-[10000] overflow-x-auto scrollbar-hide flex justify-end transition-opacity duration-300 ${
                idle ? 'opacity-40' : 'opacity-100'
              }`}
              style={{
                bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
                right: 'calc(50% + 108px)',
                maxWidth: 'calc(50% - 108px)',
              }}
              data-testid="minimized-items-tray"
            >
              <div className="flex items-center gap-1.5 w-max">
                {minimizedItems.map((item) => {
                  const isCard = item.itemType === 'card';
                  const badgeColor = isCard
                    ? (CARD_TYPE_COLORS[item.card_type] || '#6B7280')
                    : (ITEM_TYPE_CONFIG[item.itemType]?.color || '#6B7280');
                  const typeLabels = {
                    card: {personal:'Personal',business:'Negocio',freelance:'Freelance',curriculum:'CV',empresarial:'Empresa',oferta_trabajo:'Oferta',busqueda_personal:'Busqueda',solicitud_servicio:'Servicio'}[item.card_type] || 'Tarjeta',
                    profile: 'Perfil',
                    post: 'Post',
                    reel: 'Reel',
                    live: 'En Vivo',
                  };
                  const typeLabel = typeLabels[item.itemType] || item.itemType;
                  const itemKey = `${item.itemType}-${item.id}`;
                  const routes = { card: `/c/${item.id}`, profile: `/profile/${item.id}`, post: `/feed`, reel: `/reels?id=${item.id}`, live: `/lives/${item.id}` };
                  const targetRoute = routes[item.itemType] || '/feed';

                  return (
                    <button
                      key={itemKey}
                      onClick={() => { setTooltipCard(null); setMinimized(false); navigate(targetRoute); removeMinimizedItem(item.id, item.itemType); }}
                      onTouchStart={() => { longPressTimer.current = setTimeout(() => setTooltipCard(itemKey), 400); }}
                      onTouchEnd={() => { clearTimeout(longPressTimer.current); }}
                      onMouseDown={() => { longPressTimer.current = setTimeout(() => setTooltipCard(itemKey), 400); }}
                      onMouseUp={() => { clearTimeout(longPressTimer.current); }}
                      onMouseLeave={() => { clearTimeout(longPressTimer.current); setTooltipCard(null); }}
                      className="relative group/card shrink-0"
                      data-testid={`minimized-${item.itemType}-${item.id}`}
                    >
                      {/* Long-press tooltip */}
                      {tooltipCard === itemKey && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-foreground text-background text-[9px] font-medium whitespace-nowrap shadow-lg z-10 animate-in fade-in zoom-in-95 duration-150" data-testid="item-tooltip">
                          <span>{item.title || item.name || 'Sin titulo'}</span>
                          <span className="ml-1 opacity-60">· {typeLabel}</span>
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground" />
                        </div>
                      )}
                      <div className="w-7 h-7 rounded-full bg-background/90 backdrop-blur-2xl border border-border/50 shadow-lg overflow-hidden transition-all hover:scale-110 active:scale-90 flex items-center justify-center">
                        {item.thumbnail ? (
                          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[9px] font-bold text-primary">
                            {(item.title || item.name || ITEM_TYPE_CONFIG[item.itemType]?.icon || "?")[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      {/* Type badge */}
                      <div
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-background shadow-sm ${item.itemType === 'live' ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: badgeColor }}
                        data-testid={`item-badge-${item.itemType}`}
                      />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full items-center justify-center text-white hidden group-hover/card:flex transition-all cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); removeMinimizedItem(item.id, item.itemType); }}>
                        <X className="w-2 h-2" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI pill — circular bubble aligned to LEFT of the nav pill.
              Gap of 12px between AI bubble edge and pill edge for breathing room. */}
          <div className={`kb-hide fixed z-[10000] transition-opacity duration-300 ease-out ${
            idle ? 'opacity-40' : 'opacity-100'
          }`}
            style={{
              bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
              right: 'calc(50% + 76px)',
            }}>
            <button
              onClick={(e) => { e.stopPropagation(); bumpIdle(); setMinimized(false); setShowAIChat(true); setAiMinimized(false); }}
              onTouchStart={(e) => { touchHandlers.onTouchStart(e); bumpIdle(); }}
              onTouchEnd={touchHandlers.onTouchEnd}
              className="relative group transition-transform duration-200 active:scale-90"
              style={{ WebkitTapHighlightColor: 'transparent' }}
              data-testid="floating-ai-btn"
              aria-label="Abrir BRUNO IA"
            >
              <div className={`w-7 h-7 rounded-full bg-background/90 backdrop-blur-2xl border shadow-lg overflow-hidden grid place-items-center transition-all hover:scale-110 active:scale-90 ${
                showAIChat ? 'border-violet-400 ring-2 ring-violet-400/40' : 'border-border/50'
              }`}>
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
              </div>
              {/* Type badge identical to other minimized items */}
              <div
                className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-background shadow-sm bg-gradient-to-br from-violet-500 to-fuchsia-500"
                data-testid="item-badge-ai"
              />
            </button>
          </div>
        </>
      )}

      {/* === EXPANDED STATE: Colored circle above nav bar === */}
      {!minimized && (
        <div className="kb-hide fixed z-[10000] left-3 transition-all duration-300 ease-out"
          style={{ bottom: 'calc(var(--nav-reserve, 88px) + 10px)' }}>
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
      {showAIChat && aiMinimized && (
        <button
          onClick={() => setAiMinimized(false)}
          className="fixed bottom-24 left-3 z-[10001] group transition-transform active:scale-90"
          data-testid="ai-chat-minimized"
          title="Abrir BRUNO IA"
        >
          <span className="absolute inset-[-3px] rounded-full bg-gradient-to-br from-violet-500/45 to-fuchsia-500/45 blur-md opacity-80 group-hover:opacity-100" />
          <span className="relative w-12 h-12 rounded-full ring-2 ring-background shadow-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 grid place-items-center">
            <Sparkles className="w-5 h-5 text-white" />
          </span>
          <span
            onClick={(e) => { e.stopPropagation(); setShowAIChat(false); setAiMinimized(false); }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          ><X className="w-2.5 h-2.5" strokeWidth={3} /></span>
        </button>
      )}
      {showAIChat && !aiMinimized && (
        <AIChatWindow
          onClose={() => { setShowAIChat(false); setAiMinimized(false); }}
          onMinimize={() => setAiMinimized(true)}
          onClear={clearAIHistory}
          aiMessages={aiMessages}
          aiLoading={aiLoading}
          aiInput={aiInput}
          setAiInput={setAiInput}
          sendAIMessage={sendAIMessage}
          aiModels={aiModels} aiModel={aiModel} setAiModel={setAiModel}
          voiceOn={voiceOn} setVoiceOn={setVoiceOn} speak={speak} recording={recording} toggleRecording={toggleRecording} publishPhoto={publishPhoto} transcribing={transcribing}
          messagesEndRef={messagesEndRef}
          attachment={attachment}
          setAttachment={setAttachment}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          navigate={navigate}
        />
      )}
    </>
  );
};

export default FloatingBubbles;
