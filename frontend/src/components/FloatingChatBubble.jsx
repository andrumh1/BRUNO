/* eslint-disable */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useNavScroll } from "@/contexts/NavScrollContext";
import { ChatAttachmentMenu } from "@/components/ChatAttachmentMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import {
  MessageCircle, X, Minimize2, Send, ArrowLeft, Search, Plus,
  Phone, Video, Paperclip, Check, CheckCheck, Loader2, Mic, MicOff,
  File, Play, Pause, MapPin
} from "lucide-react";
import useDragToMinimize from "@/hooks/useDragToMinimize";
import LocationShareSheet from "@/components/bruno/LocationShareSheet";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const WS_URL = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

/* ─── Audio Mini Player ─── */
const AudioPlayerMini = ({ url, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);
  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    const onTime = () => setProgress((a.currentTime / a.duration) * 100);
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    a.addEventListener('timeupdate', onTime); a.addEventListener('ended', onEnd);
    return () => { a.removeEventListener('timeupdate', onTime); a.removeEventListener('ended', onEnd); };
  }, []);
  return (
    <div className="flex items-center gap-1.5 min-w-[140px]">
      <audio ref={audioRef} src={url} preload="metadata" />
      <button onClick={() => { audioRef.current?.[isPlaying ? 'pause' : 'play'](); setIsPlaying(!isPlaying); }}
        className={`w-7 h-7 rounded-full flex items-center justify-center ${isOwn ? 'bg-white/20' : 'bg-primary/10'}`}>
        {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <div className="flex-1">
        <div className={`h-0.5 rounded-full ${isOwn ? 'bg-white/30' : 'bg-muted'}`}>
          <div className={`h-full rounded-full transition-all ${isOwn ? 'bg-white' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
        </div>
      </div>
    </div>
  );
};

/* ─── Message Attachment ─── */
const MsgAttachment = ({ att, isOwn }) => {
  if (att.type === 'sticker') return <span className="text-4xl block text-center py-1">{att.emoji || ''}</span>;
  if (att.type?.startsWith('image') || att.type === 'image') return <img src={att.url} alt="" className="max-w-[200px] rounded-lg" />;
  if (att.type?.startsWith('video')) return <video src={att.url} controls className="max-w-[200px] rounded-lg" />;
  if (att.type?.startsWith('audio') || att.type === 'audio/webm') return <AudioPlayerMini url={att.url} isOwn={isOwn} />;
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[10px] ${isOwn ? 'bg-white/10' : 'bg-muted'}`}>
      <File className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{att.filename || 'Archivo'}</span>
    </a>
  );
};

/* ─── Chat Window ─── */
const ChatWindow = ({ chat, onClose, onMinimize, isMinimized, currentUserId, ws, token }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const participant = chat?.other_participants?.[0] || {};

  const fetchMessages = useCallback(async () => {
    if (!chat?.id) return;
    try {
      const r = await axios.get(`${API}/chats/${chat.id}/messages?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
      setMessages(r.data);
    } catch (e) { /* ignore */ }
    finally { setLoading(false); }
  }, [chat?.id, token]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!ws || !chat?.id) return;
    const handler = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message" && data.message.chat_id === chat.id)
          setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
      } catch (_e) { /* ignore */ }
    };
    ws.addEventListener("message", handler);
    return () => ws.removeEventListener("message", handler);
  }, [ws, chat?.id]);

  useEffect(() => { if (!isMinimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isMinimized]);

  const handleFileSelect = async (file, type) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const ep = type === "document" ? "/upload/file" : "/upload/chat-file";
      const r = await axios.post(`${API}${ep}`, fd, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' } });
      setPendingMedia({ url: r.data.url, type: file.type, filename: file.name, size: file.size });
    } catch (e) { /* ignore */ }
    finally { setUploading(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        setUploading(true);
        try {
          const fd = new FormData(); fd.append("file", blob, "audio.webm");
          const up = await axios.post(`${API}/upload/audio`, fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
          const msgD = { content: "Nota de voz", message_type: "audio", attachments: [{ url: up.data.url, type: "audio/webm", filename: "audio.webm" }] };
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...msgD }));
          else await axios.post(`${API}/chats/${chat.id}/messages`, msgD, { headers: { Authorization: `Bearer ${token}` } });
        } catch (e) { /* ignore */ }
        finally { setUploading(false); }
      };
      mediaRecorderRef.current.start();
      setIsRecording(true); setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (e) { /* ignore */ }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop(); setIsRecording(false); clearInterval(timerRef.current);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingMedia) || sending) return;
    setSending(true);
    try {
      const msgD = {
        content: newMessage.trim() || "",
        message_type: pendingMedia ? (pendingMedia.type?.startsWith("image") ? "image" : pendingMedia.type?.startsWith("video") ? "video" : "file") : "text",
        attachments: pendingMedia ? [pendingMedia] : []
      };
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...msgD }));
      else await axios.post(`${API}/chats/${chat.id}/messages`, msgD, { headers: { Authorization: `Bearer ${token}` } });
      setNewMessage(""); setPendingMedia(null);
    } catch (e) { /* ignore */ }
    finally { setSending(false); }
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const { bind: dragBind, dragY, dragging } = useDragToMinimize({
    onMinimize,
    threshold: 60,
    disabled: isMinimized,
  });

  const [showLocationSheet, setShowLocationSheet] = useState(false);

  if (isMinimized) {
    return (
      <button
        onClick={onMinimize}
        className="relative group transition-transform active:scale-90"
        data-testid="floating-chat-minimized"
        title={participant.display_name || participant.username || "Chat"}
      >
        {/* Glow */}
        <span className="absolute inset-[-3px] rounded-full bg-gradient-to-br from-primary/40 to-orange-500/40 blur-md opacity-70 group-hover:opacity-100 transition-opacity" />
        {/* Circular avatar — no text */}
        <span className="relative block w-11 h-11 rounded-full ring-2 ring-background shadow-lg overflow-hidden bg-gradient-to-br from-primary to-orange-500">
          {participant.avatar_url ? (
            <img src={participant.avatar_url} alt={participant.display_name || ""} className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
              {(participant.display_name || "?")[0].toUpperCase()}
            </span>
          )}
        </span>
        {/* Tiny close - only on hover */}
        <span
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        >
          <X className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      </button>
    );
  }

  return (
    <div
      className="w-80 h-[420px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden"
      style={{
        transform: `translateY(${dragY}px)`,
        transition: dragging ? "none" : "transform 200ms cubic-bezier(.2,.8,.2,1)",
        opacity: dragY > 0 ? Math.max(0.55, 1 - dragY / 220) : 1,
      }}
    >
      <div {...dragBind} className="px-2.5 py-2 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2 cursor-grab active:cursor-grabbing select-none touch-none">
        {/* Grabber dot */}
        <span className="absolute top-1 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-foreground/20" />
        <Link to={`/profile/${participant.id}`} className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {participant.avatar_url ? (
            <img src={participant.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-xs font-bold">
              {(participant.display_name || "?")[0].toUpperCase()}
            </div>
          )}
        </Link>
        <Link to={`/profile/${participant.id}`} className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold truncate hover:text-primary transition-colors">{participant.display_name || participant.username}</p>
          <p className="text-[10px] text-green-500">En linea</p>
        </Link>
        <button
          onClick={(e) => { e.stopPropagation(); setShowLocationSheet(true); }}
          className="p-1 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-full"
          title="Compartir ubicación"
          data-testid="floating-chat-share-location"
        >
          <MapPin className="w-3.5 h-3.5 text-purple-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("bruno:start-call", { detail: { user_id: participant.id, type: "audio" } })); }}
          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full"
          data-testid="floating-chat-call-audio"
        >
          <Phone className="w-3.5 h-3.5 text-green-600" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); window.dispatchEvent(new CustomEvent("bruno:start-call", { detail: { user_id: participant.id, type: "video" } })); }}
          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full"
          data-testid="floating-chat-call-video"
        >
          <Video className="w-3.5 h-3.5 text-blue-600" />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onMinimize(); }} className="p-1 hover:bg-muted rounded-full" data-testid="floating-chat-minimize"><Minimize2 className="w-3.5 h-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"><X className="w-3.5 h-3.5 text-red-500" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gradient-to-b from-transparent to-muted/10">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">Envia un mensaje para empezar</div>
        ) : messages.map((msg) => {
          const isOwn = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl ${isOwn ? "bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-md" : "bg-muted/80 rounded-bl-md"}`}>
                {msg.attachments?.length > 0 && msg.message_type !== 'card' && (
                  <div className="mb-1">{msg.attachments.map((att, i) => <MsgAttachment key={`att-${i}`} att={att} isOwn={isOwn} />)}</div>
                )}
                {msg.content && msg.message_type !== 'audio' && msg.message_type !== 'sticker' && (
                  <p className="text-xs leading-relaxed">{msg.content}</p>
                )}
                <div className={`flex items-center gap-0.5 mt-0.5 ${isOwn ? "justify-end" : ""}`}>
                  <span className={`text-[9px] ${isOwn ? "text-white/60" : "text-muted-foreground"}`}>{formatTime(msg.created_at)}</span>
                  {isOwn && (msg.is_read ? <CheckCheck className="w-2.5 h-2.5 text-blue-200" /> : <Check className="w-2.5 h-2.5 text-white/40" />)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      {pendingMedia && (
        <div className="px-2 py-1.5 border-t bg-muted/20 flex items-center gap-2">
          {pendingMedia.type?.startsWith("image") ? (
            <img src={pendingMedia.url} alt="" className="w-10 h-10 rounded-lg object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><File className="w-4 h-4" /></div>
          )}
          <span className="text-[10px] flex-1 truncate">{pendingMedia.filename}</span>
          <button onClick={() => setPendingMedia(null)} className="p-0.5 hover:bg-muted rounded-full"><X className="w-3 h-3" /></button>
        </div>
      )}
      {isRecording && (
        <div className="px-2 py-1.5 border-t bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex-1">Grabando {Math.floor(recordTime / 60)}:{(recordTime % 60).toString().padStart(2, '0')}</span>
          <button onClick={stopRecording} className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-medium">Enviar</button>
        </div>
      )}
      <form onSubmit={handleSend} className="p-2 border-t flex gap-1.5 items-center">
        <button type="button" onClick={() => setShowAttach(true)} disabled={uploading || isRecording}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0" data-testid="floating-chat-attach-btn">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Escribe..."
          className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3" disabled={isRecording} data-testid="floating-chat-input" />
        {newMessage.trim() || pendingMedia ? (
          <Button type="submit" size="sm" className="h-7 w-7 p-0 rounded-full" disabled={sending}>
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        ) : (
          <button type="button" onClick={isRecording ? stopRecording : startRecording}
            className={`h-7 w-7 flex items-center justify-center rounded-full transition-colors ${isRecording ? 'bg-red-500 text-white' : 'hover:bg-muted'}`}>
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
        )}
      </form>
      {showAttach && <ChatAttachmentMenu isOpen={showAttach} onClose={() => setShowAttach(false)} onFileSelect={handleFileSelect} compact={true} />}
      <LocationShareSheet
        open={showLocationSheet}
        onClose={() => setShowLocationSheet(false)}
        toUserId={participant.id}
        chatId={chat?.id}
        peerName={participant.display_name || participant.username}
      />
    </div>
  );
};

/* ─── Chat List Popup ─── */
const ChatListPopup = ({ chats, onSelectChat, onNewChat, onClose }) => {
  const [search, setSearch] = useState("");
  const filtered = chats.filter(c => {
    const p = c.other_participants?.[0];
    return (p?.display_name || p?.username || "").toLowerCase().includes(search.toLowerCase());
  });
  return (
    <div className="w-72 h-80 bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mensajes</h3>
        <div className="flex gap-0.5">
          <button onClick={onNewChat} className="p-1.5 hover:bg-muted rounded-full"><Plus className="w-3.5 h-3.5" /></button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full"><X className="w-3.5 h-3.5 text-red-500" /></button>
        </div>
      </div>
      <div className="px-2 py-1.5 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..." className="h-7 pl-7 text-xs rounded-full bg-muted/50 border-0" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">No hay conversaciones</div>
        ) : filtered.map((chat) => {
          const p = chat.other_participants?.[0] || {};
          return (
            <div key={chat.id} onClick={() => onSelectChat(chat)}
              className="flex items-center gap-2 px-2.5 py-2 hover:bg-muted/50 cursor-pointer transition-colors" data-testid={`floating-chat-item-${chat.id}`}>
              <div className="relative shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-background" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                    {(p.display_name || "?")[0].toUpperCase()}
                  </div>
                )}
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium truncate block">{p.display_name || p.username}</span>
                <p className="text-[10px] text-muted-foreground truncate leading-tight">{chat.last_message?.content || "Sin mensajes"}</p>
              </div>
              {chat.unread_count > 0 && (
                <span className="min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">{chat.unread_count}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── New Chat Modal ─── */
const NewChatModal = ({ isOpen, onClose, onSelectUser, token }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try { const r = await axios.get(`${API}/users/search?q=${encodeURIComponent(search)}`, { headers: { Authorization: `Bearer ${token}` } }); setResults(r.data); } catch (_e) { /* ignore */ }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, token]);
  if (!isOpen) return null;
  return (
    <div className="w-80 h-80 bg-card rounded-xl shadow-2xl border flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><ArrowLeft className="w-4 h-4" /></button>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..." className="flex-1 h-8 text-sm" autoFocus />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        : results.length > 0 ? results.map((u) => (
          <div key={u.id} onClick={() => onSelectUser(u)} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer">
            {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" /> : (
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">{(u.display_name || u.name || "?")[0].toUpperCase()}</div>
            )}
            <div><p className="text-sm font-medium">{u.display_name || u.name}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
          </div>
        )) : search ? <p className="text-center py-4 text-sm text-muted-foreground">No encontrados</p>
        : <p className="text-center py-4 text-sm text-muted-foreground">Escribe para buscar</p>}
      </div>
    </div>
  );
};

/* ─── Main Component ─── */
const FloatingChatBubble = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const { minimized, setMinimized, touchHandlers, idle, bumpIdle } = useNavScroll();
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [ws, setWs] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Memoize sorted chats to avoid re-sorting on every render
  const sortedChats = useMemo(
    () => [...openChats].sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)),
    [openChats]
  );

  const hiddenPaths = ['/camera', '/login', '/register', '/landing', '/website', '/bruno'];
  const shouldHide = hiddenPaths.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    if (!token) return;
    const fetchChats = async () => {
      try {
        const r = await axios.get(`${API}/chats`, { headers: { Authorization: `Bearer ${token}` } });
        setChats(r.data);
        setUnreadTotal(r.data.reduce((s, c) => s + (c.unread_count || 0), 0));
      } catch (_e) { /* ignore */ }
    };
    fetchChats();
    const iv = setInterval(fetchChats, 30000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const connect = () => {
      try {
        const socket = new WebSocket(`${WS_URL}/api/ws/chat/${token}`);
        socket.onopen = () => setWs(socket);
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
              setChats(prev => {
                const updated = prev.map(c => c.id === data.message.chat_id
                  ? { ...c, last_message: data.message, last_message_at: data.message.created_at, unread_count: (c.unread_count || 0) + 1 } : c
                );
                return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
              });
            }
          } catch (_e) { /* ignore */ }
        };
        socket.onclose = () => { setWs(null); setTimeout(connect, 3000); };
        return socket;
      } catch { return null; }
    };
    const socket = connect();
    return () => { if (socket?.readyState === WebSocket.OPEN) socket.close(); };
  }, [token]);

  useEffect(() => { setUnreadTotal(chats.reduce((s, c) => s + (c.unread_count || 0), 0)); }, [chats]);

  const handleSelectChat = (chat) => {
    const existing = openChats.find(c => c.id === chat.id);
    if (existing) setOpenChats(prev => prev.map(c => c.id === chat.id ? { ...c, minimized: false } : c));
    else setOpenChats(prev => [...prev, { ...chat, minimized: false }].slice(-3));
    setIsOpen(false);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
  };

  const handleNewChatUser = async (selectedUser) => {
    try {
      const r = await axios.post(`${API}/chats?participant_id=${selectedUser.id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const newChat = { ...r.data, other_participants: [{ id: selectedUser.id, username: selectedUser.username || selectedUser.name, display_name: selectedUser.display_name || selectedUser.name, avatar_url: selectedUser.avatar_url }] };
      setChats(prev => prev.find(c => c.id === newChat.id) ? prev : [newChat, ...prev]);
      handleSelectChat(newChat);
      setShowNewChat(false);
    } catch (e) { /* ignore */ }
  };

  // Auto-minimize all open chat windows when the nav minimizes.
  useEffect(() => {
    if (minimized) {
      // Close the chat-list popup AND collapse every open chat to mini.
      setIsOpen(false);
      setShowNewChat(false);
      setOpenChats(prev => prev.map(c => ({ ...c, minimized: true })));
    }
  }, [minimized]);

  // Listen for the global minimize-all broadcast (from nav or AI chat).
  useEffect(() => {
    const onAll = () => {
      setIsOpen(false);
      setShowNewChat(false);
      setOpenChats(prev => prev.map(c => ({ ...c, minimized: true })));
    };
    window.addEventListener("bruno:minimize-all", onAll);
    return () => window.removeEventListener("bruno:minimize-all", onAll);
  }, []);

  if (!user || shouldHide) return null;

  return (
    <>
      {/* === Floating chat bubble — MINIMIZED state: symmetric to AI, on the
          RIGHT side of the nav pill with the same 12px gap. */}
      {minimized && (
        <div
          className={`fixed z-[10000] transition-opacity duration-300 ease-out ${
            idle ? 'opacity-40' : 'opacity-100'
          }`}
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
            left: 'calc(50% + 76px)',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); bumpIdle(); setMinimized(false); setIsOpen(true); }}
            onTouchStart={(e) => { touchHandlers.onTouchStart(e); bumpIdle(); }}
            onTouchEnd={touchHandlers.onTouchEnd}
            className="relative group transition-transform duration-200 active:scale-90"
            style={{ WebkitTapHighlightColor: 'transparent' }}
            data-testid="chat-bubble-btn-minimized"
            aria-label="Abrir mensajes"
          >
            <div className={`w-7 h-7 rounded-full shadow-lg flex items-center justify-center bg-gradient-to-br from-primary to-orange-600 transition-all hover:scale-110 active:scale-90 ${
              isOpen ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
            }`}>
              <MessageCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
            </div>
            {/* Type badge — matches the AI bubble pattern */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-background shadow-sm bg-gradient-to-br from-primary to-orange-600"
              data-testid="item-badge-chat"
            />
            {unreadTotal > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] bg-red-500 rounded-full text-white text-[8px] font-bold shadow flex items-center justify-center px-0.5">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </div>
            )}
          </button>
        </div>
      )}

      {/* === Floating chat bubble — EXPANDED state: full circle === */}
      {!minimized && (
        <div className="fixed z-[10000] right-3 transition-all duration-300 ease-out"
          style={{ bottom: 'calc(var(--nav-reserve, 88px) + 10px)' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative group transition-all duration-300"
            data-testid="chat-bubble-btn"
          >
            <div className={`absolute inset-[-3px] bg-gradient-to-r from-primary/30 to-orange-500/30 rounded-full blur-md transition-all duration-300 ${
              isOpen ? 'opacity-90' : 'opacity-0 group-hover:opacity-60'
            }`} />
            <div className={`relative w-10 h-10 rounded-full shadow-md flex items-center justify-center bg-gradient-to-br from-primary to-orange-600 transition-all duration-300 shadow-primary/25 hover:shadow-primary/40 hover:scale-110 active:scale-90 ${
              isOpen ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''
            }`}>
              <MessageCircle className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            {unreadTotal > 0 && (
              <div className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] bg-red-500 rounded-full text-white text-[8px] font-bold shadow flex items-center justify-center px-0.5">
                {unreadTotal > 9 ? "9+" : unreadTotal}
              </div>
            )}
          </button>
        </div>
      )}

      {/* Chat List Popup — only when not minimized to keep the strip clean */}
      {isOpen && !showNewChat && !minimized && (
        <div className="fixed bottom-24 right-2 z-[10001] animate-in slide-in-from-bottom-2">
          <ChatListPopup chats={chats} onSelectChat={handleSelectChat} onNewChat={() => setShowNewChat(true)} onClose={() => setIsOpen(false)} />
        </div>
      )}

      {/* New Chat Search */}
      {showNewChat && !minimized && (
        <div className="fixed bottom-24 right-2 z-[10001] animate-in slide-in-from-bottom-2">
          <NewChatModal isOpen={showNewChat} onClose={() => setShowNewChat(false)} onSelectUser={handleNewChatUser} token={token} />
        </div>
      )}

      {/* Open Chat Windows — only when nav is expanded. When the nav minimizes,
          all open chat windows are forced into `minimized` state by the
          useEffect above, becoming circular bubbles managed by ChatWindow. */}
      <div className="fixed bottom-24 right-14 z-[10000] flex items-end gap-2">
        {openChats.map((chat, index) => (
          <div key={chat.id} className="animate-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
            <ChatWindow chat={chat}
              onClose={() => { setOpenChats(prev => prev.filter(c => c.id !== chat.id)); }}
              onMinimize={() => { 
                setOpenChats(prev => prev.map(c => c.id === chat.id ? { ...c, minimized: !c.minimized } : c));
                if (!chat.minimized) {
                  try { window.dispatchEvent(new CustomEvent("bruno:child-minimized")); } catch (_e) { /* ignore */ }
                }
              }}
              isMinimized={chat.minimized} currentUserId={user.id} ws={ws} token={token} />
          </div>
        ))}
      </div>
    </>
  );
};

export default FloatingChatBubble;
