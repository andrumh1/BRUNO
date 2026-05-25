import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import VideoCallModal from "@/components/VideoCallModal";
import { StickerPicker, StickerMessage } from "@/components/StickerPicker";
import { CardPicker, CardMessagePreview } from "@/components/CardPicker";
import { ChatAttachmentMenu } from "@/components/ChatAttachmentMenu";
import BrunoPillInput from "@/components/bruno/BrunoPillInput";
import BrunoQuickCamera from "@/components/bruno/BrunoQuickCamera";
import MessageReactionsBubble from "@/components/bruno/MessageReactionsBubble";
import CircularVideoMessage from "@/components/bruno/CircularVideoMessage";
import BrunoAudioWaveform from "@/components/bruno/BrunoAudioWaveform";
import TypingDots from "@/components/bruno/TypingDots";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";
import { useStoryActivity } from "@/contexts/StoryActivityContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useVisualViewportHeight } from "@/hooks/useVisualViewportHeight";
import axios from "axios";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  MicOff,
  MoreVertical,
  Phone,
  Video,
  Search,
  Plus,
  Check,
  CheckCheck,
  Loader2,
  X,
  Paperclip,
  File,
  Play,
  Pause,
  Download,
  Smile,
  CreditCard,
  Camera
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Audio Recording Hook
const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      // error handled
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
      setAudioBlob(null);
    }
  };

  const clearAudio = () => {
    setAudioBlob(null);
    setRecordingTime(0);
  };

  return { isRecording, audioBlob, recordingTime, startRecording, stopRecording, cancelRecording, clearAudio };
};

// Audio Player Component
const AudioPlayer = ({ url, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`flex items-center gap-2 min-w-[200px] ${isOwn ? 'flex-row-reverse' : ''}`}>
      <audio ref={audioRef} src={url} preload="metadata" />
      <Button
        variant="ghost"
        size="icon"
        className={`h-10 w-10 rounded-full ${isOwn ? 'bg-white/20' : 'bg-primary/10'}`}
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </Button>
      <div className="flex-1 min-w-[100px]">
        <div className={`h-1 rounded-full ${isOwn ? 'bg-white/30' : 'bg-muted'}`}>
          <div 
            className={`h-full rounded-full transition-all ${isOwn ? 'bg-white' : 'bg-primary'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs ${isOwn ? 'text-white/70' : 'text-muted-foreground'}`}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};

// File Attachment Component
const FileAttachment = ({ file, isOwn }) => {
  const getFileIcon = (type) => {
    if (type?.startsWith('image')) return ImageIcon;
    if (type?.startsWith('video')) return Video;
    if (type?.startsWith('audio')) return Mic;
    return File;
  };

  const Icon = getFileIcon(file.type);
  const isMedia = file.type?.startsWith('image') || file.type?.startsWith('video');

  if (isMedia) {
    return (
      <div className="max-w-[280px] rounded-xl overflow-hidden">
        {file.type?.startsWith('image') ? (
          <img src={file.url} alt={file.filename} className="w-full" />
        ) : (
          <video src={file.url} controls className="w-full" />
        )}
      </div>
    );
  }

  if (file.type?.startsWith('audio')) {
    return <BrunoAudioWaveform url={file.url} isOwn={isOwn} />;
  }

  return (
    <a 
      href={file.url} 
      target="_blank" 
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl ${
        isOwn ? 'bg-white/10 hover:bg-white/20' : 'bg-muted hover:bg-muted/80'
      } transition-colors`}
    >
      <div className={`p-2 rounded-lg ${isOwn ? 'bg-white/20' : 'bg-primary/10'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.filename}</p>
        <p className={`text-xs ${isOwn ? 'text-white/60' : 'text-muted-foreground'}`}>
          {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Archivo'}
        </p>
      </div>
      <Download className="w-4 h-4 opacity-60" />
    </a>
  );
};

// Chat List Component with modern design
const ChatList = ({ chats, onSelectChat, selectedChatId, onNewChat }) => {
  const navigate = useNavigate();
  const { registerUserIds } = useStoryActivity();
  const [searchFilter, setSearchFilter] = useState("");

  // Register every chat participant so their avatars know whether to glow
  useEffect(() => {
    const ids = chats.flatMap((c) => (c.other_participants || []).map((p) => p.id)).filter(Boolean);
    if (ids.length) registerUserIds(ids);
  }, [chats, registerUserIds]);
  
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    } else if (diff < 604800000) {
      return date.toLocaleDateString("es-ES", { weekday: "short" });
    }
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const filteredChats = searchFilter 
    ? chats.filter(c => {
        const p = c.other_participants?.[0];
        const name = (p?.display_name || p?.username || "").toLowerCase();
        return name.includes(searchFilter.toLowerCase());
      })
    : chats;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Link to="/feed">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h2 className="text-xl font-bold tracking-tight">Mensajes</h2>
          </div>
          <Button 
            variant="default" 
            size="icon" 
            onClick={onNewChat} 
            className="rounded-full h-10 w-10 shadow-lg shadow-primary/20"
            data-testid="new-chat-btn"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar conversacion..." 
            className="pl-10 rounded-xl bg-muted/50 border-0 h-10" 
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            data-testid="chat-search-input"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto px-2">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Send className="w-10 h-10 text-primary" />
            </div>
            <p className="text-muted-foreground text-sm">
              {searchFilter ? "Sin resultados" : "No tienes conversaciones aun"}
            </p>
            {!searchFilter && (
              <Button onClick={onNewChat} className="mt-4 rounded-full" size="sm">
                Iniciar chat
              </Button>
            )}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const participant = chat.other_participants?.[0] || {};
            const isActive = selectedChatId === chat.id;
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center gap-3 p-3 my-0.5 cursor-pointer rounded-xl transition-all ${
                  isActive 
                    ? "bg-primary/10 shadow-sm" 
                    : "hover:bg-muted/60"
                }`}
                data-testid={`chat-item-${chat.id}`}
              >
                {/* Avatar with online indicator + story ring.
                    No Link — tapping anywhere on the row should open the chat.
                    Profile navigation lives inside the chat header (ChatView). */}
                <div
                  className="relative flex-shrink-0"
                  data-testid="chat-list-avatar"
                >
                  <BrunoAvatar
                    userId={participant.id}
                    src={participant.avatar_url}
                    name={participant.display_name || participant.username || "?"}
                    size={48}
                    thickness={2}
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-background z-10" />
                </div>

                {/* Chat Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span
                      className="font-semibold text-sm truncate"
                    >
                      {participant.display_name || participant.username}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {formatTime(chat.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {chat.last_message?.message_type === 'audio' && <Mic className="w-3 h-3 shrink-0" />}
                    {chat.last_message?.message_type === 'image' && <ImageIcon className="w-3 h-3 shrink-0" />}
                    {chat.last_message?.content || "Sin mensajes"}
                  </p>
                </div>

                {/* Unread Badge */}
                {chat.unread_count > 0 && (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center flex-shrink-0 shadow-sm shadow-primary/30">
                    <span className="text-[10px] text-white font-bold">
                      {chat.unread_count > 9 ? "9+" : chat.unread_count}
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Chat View Component with bubble design
const ChatView = ({ chat, onBack, currentUserId, ws, onNewMessage }) => {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingMedia, setPendingMedia] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  // Video call state
  const [videoCallState, setVideoCallState] = useState({
    isOpen: false,
    roomUrl: null,
    isIncoming: false,
    callId: null,
    callType: "video" // "video" or "audio"
  });
  const [callLoading, setCallLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const navigate = useNavigate();
  const participant = chat?.other_participants?.[0] || {};
  
  const { isRecording, audioBlob, recordingTime, startRecording, stopRecording, cancelRecording, clearAudio } = useAudioRecorder();

  const fetchMessages = useCallback(async () => {
    if (!chat?.id) return;
    try {
      const response = await axios.get(`${API}/chats/${chat.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  }, [chat?.id, token]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    if (!ws || !chat?.id) return;

    const handleWsMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "new_message" && data.message.chat_id === chat.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        
        if (data.type === "typing" && data.chat_id === chat.id) {
          setTypingUser(data.username);
          setIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
        
        if (data.type === "messages_read" && data.chat_id === chat.id) {
          setMessages(prev => prev.map(m => 
            m.sender_id === currentUserId ? { ...m, is_read: true } : m
          ));
        }

        // Handle incoming video calls
        if (data.type === "incoming_call" && data.chat_id === chat.id) {
          setVideoCallState({
            isOpen: true,
            roomUrl: data.room_url,
            isIncoming: true,
            callId: data.call_id,
            callerName: data.caller_name,
            callType: data.call_type || "video"
          });
        }

        // Handle call answered
        if (data.type === "call_answered" && videoCallState.callId === data.call_id) {
          setVideoCallState(prev => ({ ...prev, isIncoming: false }));
        }

        // Handle call declined or ended
        if ((data.type === "call_declined" || data.type === "call_ended") && 
            videoCallState.callId === data.call_id) {
          setVideoCallState({ isOpen: false, roomUrl: null, isIncoming: false, callId: null, callType: "video" });
        }
      } catch (e) {
        // error handled
      }
    };

    ws.addEventListener("message", handleWsMessage);
    
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "mark_read", chat_id: chat.id }));
    }

    return () => {
      ws.removeEventListener("message", handleWsMessage);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [ws, chat?.id, currentUserId, videoCallState.callId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Video call functions
  const startVideoCall = async (callType = "video") => {
    if (!chat?.id) return;
    setCallLoading(true);
    try {
      const response = await axios.post(`${API}/calls/start`, {
        chat_id: chat.id,
        call_type: callType
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setVideoCallState({
        isOpen: true,
        roomUrl: response.data.room_url,
        isIncoming: false,
        callId: response.data.call_id,
        callType: callType
      });
    } catch (error) {
      // error handled
    } finally {
      setCallLoading(false);
    }
  };

  const handleAcceptCall = async () => {
    if (!videoCallState.callId) return;
    try {
      await axios.post(`${API}/calls/${videoCallState.callId}/answer`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideoCallState(prev => ({ ...prev, isIncoming: false }));
    } catch (error) {
      // error handled
    }
  };

  const handleDeclineCall = async () => {
    if (!videoCallState.callId) return;
    try {
      await axios.post(`${API}/calls/${videoCallState.callId}/decline`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideoCallState({ isOpen: false, roomUrl: null, isIncoming: false, callId: null, callType: "video" });
    } catch (error) {
      // error handled
    }
  };

  const handleEndCall = async () => {
    if (videoCallState.callId) {
      try {
        await axios.post(`${API}/calls/${videoCallState.callId}/end`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (error) {
        // error handled
      }
    }
    setVideoCallState({ isOpen: false, roomUrl: null, isIncoming: false, callId: null, callType: "video" });
  };

  // Handle audio recording finish
  useEffect(() => {
    if (audioBlob && !isRecording) {
      handleSendAudio();
    }
  }, [audioBlob, isRecording]);

  const handleSendAudio = async () => {
    if (!audioBlob) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      
      const uploadResponse = await axios.post(`${API}/upload/audio`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      const audioUrl = uploadResponse.data.url;
      
      const messageData = {
        content: "🎤 Nota de voz",
        message_type: "audio",
        attachments: [{ url: audioUrl, type: "audio/webm", filename: "audio.webm" }]
      };

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
      } else {
        const response = await axios.post(
          `${API}/chats/${chat.id}/messages`,
          messageData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages([...messages, response.data]);
      }
      
      clearAudio();
    } catch (error) {
      // error handled
    } finally {
      setUploading(false);
    }
  };

  // Send sticker
  const handleSendSticker = async (sticker) => {
    if (!sticker || !chat?.id) return;
    
    setSending(true);
    try {
      const messageData = {
        content: sticker.isEmoji ? sticker.emoji : `[sticker:${sticker.id}]`,
        message_type: "sticker",
        attachments: [{
          type: "sticker",
          sticker_id: sticker.id,
          emoji: sticker.emoji,
          url: sticker.url || null,
          is_emoji: sticker.isEmoji || false
        }]
      };
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
      } else {
        await axios.post(`${API}/chats/${chat.id}/messages`, messageData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      // error handled
    } finally {
      setSending(false);
      setShowStickerPicker(false);
    }
  };

  // Send card
  const handleSendCard = async (card) => {
    if (!card || !chat?.id) return;
    
    setSending(true);
    try {
      const messageData = {
        content: `📇 Tarjeta compartida: ${card.title || "Mi tarjeta"}`,
        message_type: "card",
        attachments: [{
          type: "card",
          card_id: card.id,
          card_title: card.title,
          card_subtitle: card.subtitle,
          card_type: card.type,
          primary_color: card.primary_color,
          secondary_color: card.secondary_color
        }]
      };
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
      } else {
        await axios.post(`${API}/chats/${chat.id}/messages`, messageData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
    } catch (error) {
      // error handled
    } finally {
      setSending(false);
      setShowCardPicker(false);
      setShowAttachMenu(false);
    }
  };

  const handleFileSelect = async (e, type = "image") => {
    // Support both event-based (from hidden input) and direct file (from ChatAttachmentMenu)
    let file, fileType;
    if (e?.target?.files) {
      file = e.target.files[0];
      fileType = type;
    } else {
      // Direct file object from ChatAttachmentMenu
      file = e;
      fileType = type;
    }
    if (!file) return;
    
    setUploading(true);
    setShowAttachMenu(false);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const endpoint = fileType === "document" ? "/upload/file" : "/upload/chat-file";
      const response = await axios.post(`${API}${endpoint}`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      
      setPendingMedia({
        url: response.data.url,
        type: file.type,
        filename: file.name,
        size: file.size
      });
    } catch (error) {
      // error handled
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingMedia) || sending) return;

    setSending(true);
    try {
      const messageData = {
        content: newMessage.trim(),
        message_type: pendingMedia ? (pendingMedia.type.startsWith("image") ? "image" : pendingMedia.type.startsWith("video") ? "video" : "file") : "text",
        attachments: pendingMedia ? [pendingMedia] : [],
        ...(replyTo ? { reply_to: { id: replyTo.id, sender_name: replyTo.name, preview: replyTo.preview, content: replyTo.body } } : {})
      };
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
        setNewMessage("");
        setPendingMedia(null);
        setReplyTo(null);
      } else {
        const response = await axios.post(
          `${API}/chats/${chat.id}/messages`,
          messageData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages([...messages, response.data]);
        setNewMessage("");
        setPendingMedia(null);
        setReplyTo(null);
      }
    } catch (error) {
      // error handled
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "typing", chat_id: chat.id }));
    }
  };

  const aggregateReactions = (reactions) => {
    const map = new Map();
    for (const r of reactions || []) {
      const e = r.emoji || r.reaction;
      if (!e) continue;
      map.set(e, (map.get(e) || 0) + 1);
    }
    return Array.from(map.entries()).map(([emoji, count]) => ({ emoji, count }));
  };

  const handleReactMessage = async (message, emoji) => {
    // Optimistic UI
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id
          ? { ...m, reactions: [...(m.reactions || []), { user_id: currentUserId, emoji }] }
          : m
      )
    );
    try {
      await axios.post(
        `${API}/chats/${chat.id}/messages/${message.id}/react?emoji=${encodeURIComponent(emoji)}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      // Silently fail — non-blocking. Endpoint may not exist yet.
    }
  };

  const handleSetReply = (message) => {
    setReplyTo({
      id: message.id,
      name: message.sender_name || (message.sender_id === currentUserId ? "Tú" : participant?.display_name || "Mensaje"),
      preview:
        (message.content && message.content.slice(0, 80)) ||
        (message.message_type === "image"
          ? "Imagen"
          : message.message_type === "video"
          ? "Video"
          : message.message_type === "audio"
          ? "Audio"
          : "Mensaje"),
      body: message.content,
    });
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString("es-ES", { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group messages by date
  const groupMessagesByDate = (msgs) => {
    const groups = {};
    msgs.forEach(msg => {
      const date = new Date(msg.created_at).toLocaleDateString("es-ES", {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(msg);
    });
    return groups;
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Modern Header */}
      <div className="px-3 py-2.5 border-b bg-background/80 backdrop-blur-xl flex items-center gap-3 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden rounded-full h-9 w-9">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        {/* Clickable avatar → profile */}
        <Link to={`/profile/${participant.id}`} className="shrink-0" data-testid="chat-profile-link">
          {participant.avatar_url ? (
            <img 
              src={participant.avatar_url} 
              alt={participant.display_name}
              className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/20 hover:ring-primary/50 transition-all"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center text-white font-bold text-sm hover:shadow-lg transition-all">
              {(participant.display_name || participant.username || "?")[0].toUpperCase()}
            </div>
          )}
        </Link>
        
        <Link to={`/profile/${participant.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors">{participant.display_name || participant.username}</h3>
          <p className="text-[10px] text-muted-foreground">
            {isTyping ? (
              <TypingDots label="escribiendo" />
            ) : "En linea"}
          </p>
        </Link>
        
        <div className="flex gap-0.5">
          <Button 
            variant="ghost" size="icon" 
            className="rounded-full h-9 w-9 hover:bg-green-500/10 hover:text-green-500"
            onClick={() => startVideoCall("audio")}
            disabled={callLoading}
            data-testid="start-audio-call-btn"
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" size="icon" 
            className="rounded-full h-9 w-9 hover:bg-blue-500/10 hover:text-blue-500"
            onClick={() => startVideoCall("video")}
            disabled={callLoading}
            data-testid="start-video-call-btn"
          >
            {callLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={videoCallState.isOpen}
        onClose={handleEndCall}
        roomUrl={videoCallState.roomUrl}
        remoteUserName={participant.display_name || participant.username}
        isIncoming={videoCallState.isIncoming}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        callType={videoCallState.callType}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          Object.entries(messageGroups).map(([date, msgs]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex justify-center mb-4">
                <span className="px-3 py-1 bg-muted/60 backdrop-blur-sm rounded-full text-[10px] text-muted-foreground font-medium capitalize">
                  {date}
                </span>
              </div>
              
              {/* Messages */}
              {msgs.map((message) => {
                const isOwn = message.sender_id === currentUserId;
                const reactionsList = aggregateReactions(message.reactions || []);
                // ── Video note (circular bubble) — special rendering ──
                if (message.message_type === "video_note" && message.attachments?.[0]?.url) {
                  return (
                    <div
                      key={message.id}
                      className={`flex mb-1.5 ${isOwn ? "justify-end" : "justify-start"}`}
                    >
                      <MessageReactionsBubble
                        isOwn={isOwn}
                        reactions={reactionsList}
                        onReact={(emoji) => handleReactMessage(message, emoji)}
                        onReply={() => handleSetReply(message)}
                        testId={`msg-${message.id}`}
                      >
                        <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
                          <CircularVideoMessage
                            src={message.attachments[0].url}
                            isOwn={isOwn}
                            size={180}
                            testId={`video-note-${message.id}`}
                          />
                          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
                            <span className="text-[9px] text-muted-foreground">
                              {formatTime(message.created_at)}
                            </span>
                            {isOwn && (message.is_read ? (
                              <CheckCheck className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <Check className="w-3 h-3 text-muted-foreground/60" />
                            ))}
                          </div>
                        </div>
                      </MessageReactionsBubble>
                    </div>
                  );
                }
                return (
                  <div
                    key={message.id}
                    className={`flex mb-1.5 ${isOwn ? "justify-end" : "justify-start"}`}
                  >
                    <MessageReactionsBubble
                      isOwn={isOwn}
                      reactions={reactionsList}
                      onReact={(emoji) => handleReactMessage(message, emoji)}
                      onReply={() => handleSetReply(message)}
                      testId={`msg-${message.id}`}
                    >
                    <div
                      className={`max-w-[78%] px-3.5 py-2 ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm shadow-primary/10"
                          : "bg-muted/60 rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {/* Reply preview */}
                      {message.reply_to && (
                        <div className={`mb-1.5 px-2 py-1 rounded-md border-l-2 ${isOwn ? "border-white/50 bg-white/10" : "border-orange-500 bg-orange-50/60 dark:bg-orange-500/10"}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                            {message.reply_to.sender_name || "Mensaje"}
                          </p>
                          <p className="text-xs truncate opacity-80">
                            {message.reply_to.preview || message.reply_to.content || ""}
                          </p>
                        </div>
                      )}
                      {/* Sticker messages */}
                      {message.message_type === 'sticker' && message.attachments?.[0] && (
                        <div className="flex justify-center py-2">
                          {message.attachments[0].is_emoji || message.attachments[0].isEmoji ? (
                            <span className="text-6xl">{message.attachments[0].emoji}</span>
                          ) : message.attachments[0].url ? (
                            <img 
                              src={message.attachments[0].url}
                              alt="sticker"
                              className="w-24 h-24 object-contain"
                            />
                          ) : (
                            <span className="text-6xl">{message.attachments[0].emoji || "🖼️"}</span>
                          )}
                        </div>
                      )}

                      {/* Regular Attachments (non-sticker, non-card) */}
                      {message.message_type !== 'sticker' && message.message_type !== 'card' && message.attachments?.length > 0 && (
                        <div className="mb-2">
                          {message.attachments.map((att, idx) => (
                            <FileAttachment key={`att-${idx}`} file={att} isOwn={isOwn} />
                          ))}
                        </div>
                      )}

                      {/* Card messages */}
                      {message.message_type === 'card' && message.attachments?.[0] && (
                        <CardMessagePreview 
                          card={message.attachments[0]}
                          isOwn={isOwn}
                          onClick={() => navigate(`/c/${message.attachments[0].card_id}`)}
                        />
                      )}
                      
                      {/* Text content with @mention parsing */}
                      {message.content && message.message_type !== 'audio' && message.message_type !== 'sticker' && message.message_type !== 'card' && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content.split(/(@\w+)/g).map((part, pi) => {
                            if (part.startsWith("@")) {
                              const uname = part.slice(1);
                              return (
                                <Link key={`m-${pi}-${uname}`} to={`/profile/${uname}`} className={`font-semibold underline decoration-1 underline-offset-2 ${isOwn ? "text-primary-foreground" : "text-primary"}`}>
                                  {part}
                                </Link>
                              );
                            }
                            return <span key={`t-${pi}`}>{part}</span>;
                          })}
                        </p>
                      )}
                      
                      {/* Time and read status */}
                      <div className={`flex items-center gap-1 mt-0.5 ${isOwn ? "justify-end" : "justify-start"}`}>
                        <span className={`text-[9px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                          {formatTime(message.created_at)}
                        </span>
                        {isOwn && (
                          message.is_read ? (
                            <CheckCheck className="w-3.5 h-3.5 text-primary-foreground/60" />
                          ) : (
                            <Check className="w-3 h-3 text-primary-foreground/40" />
                          )
                        )}
                      </div>
                    </div>
                    </MessageReactionsBubble>
                  </div>
                );
              })}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Pending Media Preview */}
      {pendingMedia && (
        <div className="px-4 py-3 border-t bg-card flex items-center gap-3">
          {pendingMedia.type?.startsWith("image") ? (
            <img src={pendingMedia.url} alt="" className="w-16 h-16 rounded-xl object-cover" />
          ) : pendingMedia.type?.startsWith("video") ? (
            <video src={pendingMedia.url} className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
              <File className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{pendingMedia.filename}</p>
            <p className="text-xs text-muted-foreground">Listo para enviar</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setPendingMedia(null)} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="px-4 py-3 border-t bg-red-50 dark:bg-red-900/20 flex items-center gap-3">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            Grabando... {formatRecordingTime(recordingTime)}
          </span>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={cancelRecording} className="text-red-600">
            Cancelar
          </Button>
          <Button size="sm" onClick={stopRecording} className="bg-red-600 hover:bg-red-700">
            <Send className="w-4 h-4 mr-1" /> Enviar
          </Button>
        </div>
      )}

      {/* Attachment Menu - Messenger-style drawer */}
      <ChatAttachmentMenu
        isOpen={showAttachMenu}
        onClose={() => setShowAttachMenu(false)}
        onFileSelect={(file, type) => handleFileSelect(file, type)}
        onCardPick={() => { setShowCardPicker(true); setShowAttachMenu(false); }}
        onStickerPick={() => { setShowStickerPicker(true); setShowAttachMenu(false); }}
      />

      {/* Card Picker Modal */}
      <CardPicker
        isOpen={showCardPicker}
        onClose={() => setShowCardPicker(false)}
        onSelect={handleSendCard}
      />

      {/* Bruno Pro Camera */}
      <BrunoQuickCamera
        open={showCamera}
        onClose={() => setShowCamera(false)}
        onCapture={async (file, meta) => {
          // Video → send as a Telegram-style video note (circular bubble)
          if (meta?.type === "video" || file.type.startsWith("video")) {
            try {
              setUploading(true);
              const form = new FormData();
              form.append("file", file);
              const up = await axios.post(`${API}/upload/chat-file`, form, {
                headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
              });
              const messageData = {
                content: "",
                message_type: "video_note",
                attachments: [{
                  url: up.data.url || up.data.secure_url,
                  type: file.type,
                  filename: file.name,
                  size: file.size,
                  music: meta?.music || null,
                }],
              };
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
              } else {
                const res = await axios.post(
                  `${API}/chats/${chat.id}/messages`,
                  messageData,
                  { headers: { Authorization: `Bearer ${token}` } }
                );
                setMessages((prev) => [...prev, res.data]);
              }
              brunoToast.success("Video enviado");
            } catch (_) {
              brunoToast.error("No se pudo enviar el video");
            } finally {
              setUploading(false);
            }
            return;
          }
          // Photo → keep current flow: stage as pendingMedia
          await handleFileSelect(file, "image");
          brunoToast.success("Foto lista para enviar");
        }}
      />

      {/* Sticker Picker (floating popover) */}
      <StickerPicker
        isOpen={showStickerPicker}
        onClose={() => setShowStickerPicker(false)}
        onSelect={(s) => { handleSendSticker(s); setShowStickerPicker(false); }}
      />

      {/* Bruno Pill Input */}
      <div className="border-t bg-background/80 backdrop-blur-xl">
        <BrunoPillInput
          value={newMessage}
          onChange={setNewMessage}
          onTyping={handleTyping}
          onSend={(text) => handleSend({ preventDefault: () => {} })}
          onAttach={() => setShowAttachMenu(!showAttachMenu)}
          onCamera={() => setShowCamera(true)}
          onStickers={() => setShowStickerPicker((v) => !v)}
          onMicStart={startRecording}
          onMicStop={stopRecording}
          isRecording={isRecording}
          sending={sending}
          uploading={uploading}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder="Escribe un mensaje..."
        />
      </div>
    </div>
  );
};

// New Chat Modal
const NewChatModal = ({ isOpen, onClose, onSelectUser, token }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await axios.get(`${API}/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResults(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const debounce = setTimeout(() => searchUsers(searchQuery), 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">Nueva Conversación</h3>
            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
              <X className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o email..."
              className="pl-10 rounded-full"
              autoFocus
            />
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              results.map((user) => (
                <div
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted cursor-pointer transition-colors"
                >
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.display_name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold">
                      {(user.display_name || user.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{user.display_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              ))
            ) : searchQuery ? (
              <p className="text-center text-muted-foreground py-4">No se encontraron usuarios</p>
            ) : (
              <p className="text-center text-muted-foreground py-4">Escribe para buscar usuarios</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Main ChatPage Component
const ChatPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();

  // Track visual viewport (keyboard avoidance on mobile)
  useVisualViewportHeight();
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [ws, setWs] = useState(null);
  const wsReconnectRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const connectWebSocket = () => {
      try {
        const socket = new WebSocket(`${WS_URL}/ws/chat/${token}`);
        
        socket.onopen = () => {
          setWs(socket);
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "new_message") {
              setChats(prev => {
                const updated = prev.map(c => {
                  if (c.id === data.message.chat_id) {
                    return {
                      ...c,
                      last_message: data.message,
                      last_message_at: data.message.created_at,
                      unread_count: selectedChat?.id === c.id ? c.unread_count : (c.unread_count || 0) + 1
                    };
                  }
                  return c;
                });
                return updated.sort((a, b) => 
                  new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0)
                );
              });
            }
          } catch (e) {
            // error handled
          }
        };
        
        socket.onclose = () => {
          setWs(null);
          wsReconnectRef.current = setTimeout(connectWebSocket, 3000);
        };
        
        socket.onerror = (error) => {
          // error handled
        };
        
        return socket;
      } catch (error) {
        // error handled
        return null;
      }
    };

    const socket = connectWebSocket();

    return () => {
      if (wsReconnectRef.current) {
        clearTimeout(wsReconnectRef.current);
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [token, selectedChat?.id]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const fetchChats = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchChats();
  }, [user, navigate, fetchChats]);

  // Sync selectedChat from URL param (e.g. when route is /chat/:id).
  // This runs both on initial mount once chats are loaded AND when the
  // URL changes — without re-fetching chats (which previously caused a
  // race where the first tap appeared to do nothing).
  useEffect(() => {
    if (!chatId || chats.length === 0) return;
    const target = chats.find(c => c.id === chatId);
    if (target && selectedChat?.id !== target.id) {
      setSelectedChat(target);
    }
  }, [chatId, chats, selectedChat?.id]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    setChats(prev => prev.map(c => 
      c.id === chat.id ? { ...c, unread_count: 0 } : c
    ));
    navigate(`/chat/${chat.id}`, { replace: true });
  };

  const handleBack = () => {
    setSelectedChat(null);
    navigate("/chat", { replace: true });
  };

  const handleNewChat = async (selectedUser) => {
    try {
      const response = await axios.post(
        `${API}/chats?participant_id=${selectedUser.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const newChat = {
        ...response.data,
        other_participants: [{
          id: selectedUser.id,
          username: selectedUser.username || selectedUser.name,
          display_name: selectedUser.display_name,
          avatar_url: selectedUser.avatar_url
        }]
      };
      
      setChats(prev => {
        const existing = prev.find(c => c.id === newChat.id);
        if (existing) return prev;
        return [newChat, ...prev];
      });
      
      setSelectedChat(newChat);
      setShowNewChat(false);
      navigate(`/chat/${newChat.id}`, { replace: true });
    } catch (error) {
      // error handled
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <p className="mb-4">Inicia sesión para chatear</p>
          <Link to="/login">
            <Button>Iniciar Sesión</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="flex bg-background overflow-hidden"
      data-testid="chat-page"
      style={{ height: "var(--app-vh, 100dvh)" }}
    >
      {/* Chat List - Hidden on mobile when chat is selected */}
      <div className={`${isMobile && selectedChat ? "hidden" : "flex"} w-full md:w-96 border-r`}>
        <ChatList
          chats={chats}
          onSelectChat={handleSelectChat}
          selectedChatId={selectedChat?.id}
          onNewChat={() => setShowNewChat(true)}
        />
      </div>

      {/* Chat View */}
      <div className={`${isMobile && !selectedChat ? "hidden" : "flex"} flex-1 flex-col`}>
        {selectedChat ? (
          <ChatView 
            chat={selectedChat} 
            onBack={handleBack}
            currentUserId={user.id}
            ws={ws}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-muted/10">
            <div className="text-center max-w-sm">
              <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl flex items-center justify-center mx-auto mb-5 rotate-6">
                <Send className="w-10 h-10 text-primary -rotate-6" />
              </div>
              <h3 className="font-bold text-xl mb-2 tracking-tight">Tus Mensajes</h3>
              <p className="text-muted-foreground text-sm mb-5">Selecciona una conversacion o inicia una nueva</p>
              <Button onClick={() => setShowNewChat(true)} className="rounded-full shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" /> Nueva Conversacion
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <NewChatModal
        isOpen={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleNewChat}
        token={token}
      />
    </div>
  );
};

export default ChatPage;
