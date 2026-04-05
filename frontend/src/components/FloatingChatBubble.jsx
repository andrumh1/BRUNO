import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatAttachmentMenu } from "@/components/ChatAttachmentMenu";
import axios from "axios";
import {
  MessageCircle,
  X,
  Minimize2,
  Send,
  ArrowLeft,
  Search,
  Plus,
  Phone,
  Video,
  Image as ImageIcon,
  Paperclip,
  Check,
  CheckCheck,
  Loader2,
  Mic,
  MicOff,
  File,
  Play,
  Pause
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';
const WS_URL = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Audio Player Mini
const AudioPlayerMini = ({ url, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setProgress((audio.currentTime / audio.duration) * 100);
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnd);
    return () => { audio.removeEventListener('timeupdate', onTime); audio.removeEventListener('ended', onEnd); };
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

// Compact message attachment renderer
const MsgAttachment = ({ att, isOwn }) => {
  if (att.type === 'sticker') {
    return <span className="text-4xl block text-center py-1">{att.emoji || '🖼️'}</span>;
  }
  if (att.type?.startsWith('image') || att.type === 'image') {
    return <img src={att.url} alt="" className="max-w-[200px] rounded-lg" />;
  }
  if (att.type?.startsWith('video')) {
    return <video src={att.url} controls className="max-w-[200px] rounded-lg" />;
  }
  if (att.type?.startsWith('audio') || att.type === 'audio/webm') {
    return <AudioPlayerMini url={att.url} isOwn={isOwn} />;
  }
  return (
    <a href={att.url} target="_blank" rel="noopener noreferrer"
      className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[10px] ${isOwn ? 'bg-white/10' : 'bg-muted'}`}>
      <File className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{att.filename || 'Archivo'}</span>
    </a>
  );
};

// Chat Window with full attachment support
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
      const response = await axios.get(`${API}/chats/${chat.id}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [chat?.id, token]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!ws || !chat?.id) return;
    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "new_message" && data.message.chat_id === chat.id) {
          setMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
        }
      } catch (e) {}
    };
    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [ws, chat?.id]);

  useEffect(() => {
    if (!isMinimized) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isMinimized]);

  // File upload handler
  const handleFileSelect = async (file, type) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const endpoint = type === "document" ? "/upload/file" : "/upload/chat-file";
      const response = await axios.post(`${API}${endpoint}`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      setPendingMedia({
        url: response.data.url,
        type: file.type,
        filename: file.name,
        size: file.size
      });
    } catch (error) {
      console.error("Error uploading:", error);
    } finally {
      setUploading(false);
    }
  };

  // Audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await sendAudioBlob(blob);
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordTime(0);
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000);
    } catch (e) { console.error("Mic error:", e); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const sendAudioBlob = async (blob) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", blob, "audio.webm");
      const uploadRes = await axios.post(`${API}/upload/audio`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      const msgData = {
        content: "Nota de voz",
        message_type: "audio",
        attachments: [{ url: uploadRes.data.url, type: "audio/webm", filename: "audio.webm" }]
      };
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...msgData }));
      } else {
        await axios.post(`${API}/chats/${chat.id}/messages`, msgData, { headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (e) { console.error("Audio send error:", e); }
    finally { setUploading(false); }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingMedia) || sending) return;
    setSending(true);
    try {
      const messageData = {
        content: newMessage.trim() || (pendingMedia ? "" : ""),
        message_type: pendingMedia 
          ? (pendingMedia.type?.startsWith("image") ? "image" : pendingMedia.type?.startsWith("video") ? "video" : "file") 
          : "text",
        attachments: pendingMedia ? [pendingMedia] : []
      };
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
      } else {
        await axios.post(`${API}/chats/${chat.id}/messages`, messageData, { headers: { Authorization: `Bearer ${token}` } });
      }
      setNewMessage("");
      setPendingMedia(null);
    } catch (error) { console.error("Error sending:", error); }
    finally { setSending(false); }
  };

  const formatTime = (d) => new Date(d).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  if (isMinimized) {
    return (
      <div onClick={onMinimize}
        className="flex items-center gap-1.5 px-2 py-1.5 bg-card/95 backdrop-blur-xl rounded-full shadow-lg border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors">
        {participant.avatar_url ? (
          <img src={participant.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-xs font-bold">
            {(participant.display_name || "?")[0].toUpperCase()}
          </div>
        )}
        <span className="text-xs font-medium max-w-[80px] truncate">{participant.display_name || participant.username}</span>
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full">
          <X className="w-3 h-3 text-red-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 h-[420px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-2.5 py-2 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center gap-2">
        <Link to={`/profile/${participant.id}`} className="shrink-0" data-testid="floating-chat-avatar-link">
          {participant.avatar_url ? (
            <img src={participant.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-xs font-bold">
              {(participant.display_name || "?")[0].toUpperCase()}
            </div>
          )}
        </Link>
        <Link to={`/profile/${participant.id}`} className="flex-1 min-w-0" data-testid="floating-chat-name-link">
          <p className="text-xs font-semibold truncate hover:text-primary transition-colors">{participant.display_name || participant.username}</p>
          <p className="text-[10px] text-green-500">En linea</p>
        </Link>
        <button className="p-1 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full transition-colors"><Phone className="w-3.5 h-3.5 text-green-600" /></button>
        <button className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full transition-colors"><Video className="w-3.5 h-3.5 text-blue-600" /></button>
        <button onClick={onMinimize} className="p-1 hover:bg-muted rounded-full transition-colors"><Minimize2 className="w-3.5 h-3.5" /></button>
        <button onClick={onClose} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"><X className="w-3.5 h-3.5 text-red-500" /></button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gradient-to-b from-transparent to-muted/10">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">Envia un mensaje para empezar</div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl ${
                  isOwn ? "bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-md" : "bg-muted/80 rounded-bl-md"
                }`}>
                  {/* Attachments */}
                  {msg.attachments?.length > 0 && msg.message_type !== 'card' && (
                    <div className="mb-1">
                      {msg.attachments.map((att, i) => <MsgAttachment key={i} att={att} isOwn={isOwn} />)}
                    </div>
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
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending media preview */}
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

      {/* Recording indicator */}
      {isRecording && (
        <div className="px-2 py-1.5 border-t bg-red-50 dark:bg-red-900/20 flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-medium text-red-600 dark:text-red-400 flex-1">
            Grabando {Math.floor(recordTime/60)}:{(recordTime%60).toString().padStart(2,'0')}
          </span>
          <button onClick={stopRecording} className="px-2 py-0.5 bg-red-600 text-white text-[10px] rounded-full font-medium">
            Enviar
          </button>
        </div>
      )}

      {/* Input with attachments */}
      <form onSubmit={handleSend} className="p-2 border-t flex gap-1.5 items-center">
        <button type="button" onClick={() => setShowAttach(true)}
          className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted transition-colors shrink-0"
          disabled={uploading || isRecording}
          data-testid="floating-chat-attach-btn">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Escribe..." className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3" disabled={isRecording}
          data-testid="floating-chat-input" />
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

      {/* Attachment menu */}
      {showAttach && (
        <ChatAttachmentMenu
          isOpen={showAttach}
          onClose={() => setShowAttach(false)}
          onFileSelect={handleFileSelect}
          compact={true}
        />
      )}
    </div>
  );
};

// Chat List Popup
const ChatListPopup = ({ chats, onSelectChat, onNewChat, onClose }) => {
  const [search, setSearch] = useState("");
  const filteredChats = chats.filter(chat => {
    const p = chat.other_participants?.[0];
    return (p?.display_name || p?.username || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="w-72 h-80 bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden">
      <div className="px-3 py-2.5 border-b bg-gradient-to-r from-primary/5 to-transparent flex items-center justify-between">
        <h3 className="text-sm font-semibold">Mensajes</h3>
        <div className="flex gap-0.5">
          <button onClick={onNewChat} className="p-1.5 hover:bg-muted rounded-full transition-colors"><Plus className="w-3.5 h-3.5" /></button>
          <button onClick={onClose} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full transition-colors"><X className="w-3.5 h-3.5 text-red-500" /></button>
        </div>
      </div>
      <div className="px-2 py-1.5 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar..."
            className="h-7 pl-7 text-xs rounded-full bg-muted/50 border-0" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">No hay conversaciones</div>
        ) : (
          filteredChats.map((chat) => {
            const participant = chat.other_participants?.[0] || {};
            return (
              <div key={chat.id} onClick={() => onSelectChat(chat)}
                className="flex items-center gap-2 px-2.5 py-2 hover:bg-muted/50 cursor-pointer transition-colors"
                data-testid={`floating-chat-item-${chat.id}`}>
                <div className="relative flex-shrink-0">
                  {participant.avatar_url ? (
                    <img src={participant.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-background" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center text-white text-xs font-bold">
                      {(participant.display_name || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium truncate block">
                    {participant.display_name || participant.username}
                  </span>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">
                    {chat.last_message?.content || "Sin mensajes"}
                  </p>
                </div>
                {chat.unread_count > 0 && (
                  <span className="min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                    {chat.unread_count}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// New Chat Search Modal
const NewChatModal = ({ isOpen, onClose, onSelectUser, token }) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/users/search?q=${encodeURIComponent(search)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setResults(response.data);
      } catch (e) {}
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, token]);

  if (!isOpen) return null;

  return (
    <div className="w-80 h-80 bg-card rounded-xl shadow-2xl border flex flex-col overflow-hidden">
      <div className="p-3 border-b flex items-center gap-2">
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><ArrowLeft className="w-4 h-4" /></button>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar usuario..." className="flex-1 h-8 text-sm" autoFocus />
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : results.length > 0 ? (
          results.map((user) => (
            <div key={user.id} onClick={() => onSelectUser(user)} className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold">
                  {(user.display_name || user.name || "?")[0].toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-sm font-medium">{user.display_name || user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
          ))
        ) : search ? (
          <p className="text-center py-4 text-sm text-muted-foreground">No se encontraron usuarios</p>
        ) : (
          <p className="text-center py-4 text-sm text-muted-foreground">Escribe para buscar</p>
        )}
      </div>
    </div>
  );
};

// Main Floating Chat Bubble Component
const FloatingChatBubble = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState([]);
  const [openChats, setOpenChats] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [ws, setWs] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [hiddenByScroll, setHiddenByScroll] = useState(false);
  const wsRef = useRef(null);
  const lastScrollRef = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastScrollRef.current + 40 && y > 100) setHiddenByScroll(true);
      else if (y < lastScrollRef.current - 20) setHiddenByScroll(false);
      lastScrollRef.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchChats = async () => {
      try {
        const response = await axios.get(`${API}/chats`, { headers: { Authorization: `Bearer ${token}` } });
        setChats(response.data);
        setUnreadTotal(response.data.reduce((sum, c) => sum + (c.unread_count || 0), 0));
      } catch (e) {}
    };
    fetchChats();
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const connect = () => {
      try {
        const socket = new WebSocket(`${WS_URL}/ws/chat/${token}`);
        socket.onopen = () => { setWs(socket); wsRef.current = socket; };
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "new_message") {
              setChats(prev => {
                const updated = prev.map(c => {
                  if (c.id === data.message.chat_id) {
                    return { ...c, last_message: data.message, last_message_at: data.message.created_at,
                      unread_count: (c.unread_count || 0) + 1 };
                  }
                  return c;
                });
                return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
              });
            }
          } catch (e) {}
        };
        socket.onclose = () => { setWs(null); setTimeout(connect, 3000); };
        return socket;
      } catch (e) { return null; }
    };
    const socket = connect();
    return () => { if (socket?.readyState === WebSocket.OPEN) socket.close(); };
  }, [token]);

  useEffect(() => {
    setUnreadTotal(chats.reduce((sum, c) => sum + (c.unread_count || 0), 0));
  }, [chats]);

  const handleSelectChat = (chat) => {
    const existing = openChats.find(c => c.id === chat.id);
    if (existing) {
      setOpenChats(prev => prev.map(c => c.id === chat.id ? { ...c, minimized: false } : c));
    } else {
      setOpenChats(prev => [...prev, { ...chat, minimized: false }].slice(-3));
    }
    setIsOpen(false);
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c));
  };

  const handleNewChatUser = async (selectedUser) => {
    try {
      const response = await axios.post(`${API}/chats?participant_id=${selectedUser.id}`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const newChat = { ...response.data, other_participants: [{ id: selectedUser.id, username: selectedUser.username || selectedUser.name, display_name: selectedUser.display_name || selectedUser.name, avatar_url: selectedUser.avatar_url }] };
      setChats(prev => prev.find(c => c.id === newChat.id) ? prev : [newChat, ...prev]);
      handleSelectChat(newChat);
      setShowNewChat(false);
    } catch (e) { console.error("Error creating chat:", e); }
  };

  if (!user) return null;
  const pathname = window.location.pathname;
  if (pathname === '/camera') return null;
  const bubbleHidden = hiddenByScroll && !isOpen && openChats.length === 0;

  return (
    <>
      <div className={`fixed bottom-20 right-3 z-[9990] md:bottom-6 md:right-4 transition-all duration-300 ${
        bubbleHidden ? 'translate-y-20 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        <button onClick={() => setIsOpen(!isOpen)}
          className="w-11 h-11 bg-gradient-to-br from-primary to-orange-600 rounded-full shadow-lg shadow-primary/25 flex items-center justify-center hover:shadow-primary/40 transition-all duration-200 hover:scale-105 active:scale-95"
          data-testid="chat-bubble-btn">
          <MessageCircle className="w-5 h-5 text-white" strokeWidth={2} />
          {unreadTotal > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </button>
      </div>

      {isOpen && !showNewChat && (
        <div className="fixed bottom-32 right-3 z-[9990] animate-in slide-in-from-bottom-2 md:bottom-20 md:right-4">
          <ChatListPopup chats={chats} onSelectChat={handleSelectChat} onNewChat={() => setShowNewChat(true)} onClose={() => setIsOpen(false)} />
        </div>
      )}

      {showNewChat && (
        <div className="fixed bottom-32 right-3 z-[9990] animate-in slide-in-from-bottom-2 md:bottom-20 md:right-4">
          <NewChatModal isOpen={showNewChat} onClose={() => setShowNewChat(false)} onSelectUser={handleNewChatUser} token={token} />
        </div>
      )}

      <div className="fixed bottom-20 right-16 z-[9990] flex items-end gap-2 md:bottom-6 md:right-20">
        {openChats.map((chat, index) => (
          <div key={chat.id} className="animate-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
            <ChatWindow chat={chat} onClose={() => setOpenChats(prev => prev.filter(c => c.id !== chat.id))}
              onMinimize={() => setOpenChats(prev => prev.map(c => c.id === chat.id ? { ...c, minimized: !c.minimized } : c))}
              isMinimized={chat.minimized} currentUserId={user.id} ws={ws} token={token} />
          </div>
        ))}
      </div>
    </>
  );
};

export default FloatingChatBubble;
