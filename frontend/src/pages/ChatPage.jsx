/* eslint-disable */
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
import VideoNoteRecorder from "@/components/bruno/VideoNoteRecorder";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import AudioPlayer from "@/components/chat/AudioPlayer";
import FileAttachment from "@/components/chat/FileAttachment";
import ChatList, { ChatAvatar, chatTitle } from "@/components/chat/ChatList";
import NewChatModal from "@/components/chat/NewChatModal";
import NewGroupModal from "@/components/chat/NewGroupModal";
import GroupInfoSheet from "@/components/chat/GroupInfoSheet";
import MuteMenu, { formatMutedUntil } from "@/components/chat/MuteMenu";
import MentionPicker, { mentionHandle } from "@/components/chat/MentionPicker";
import LocationMessagePreview from "@/components/chat/LocationMessagePreview";
import axios from "axios";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  MicOff,
  MoreVertical,
  Bell,
  BellOff,
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
  Camera,
  Clock,
  Wallet
} from "lucide-react";
import OfflineBanner from "@/components/chat/OfflineBanner";
import { useChatOutbox } from "@/hooks/useChatOutbox";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');


// Chat View Component with bubble design
const ChatView = ({ chat, onBack, currentUserId, ws, onNewMessage, autoCall = null, onChatUpdated, onLeftGroup }) => {
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
  const [showVideoNoteRecorder, setShowVideoNoteRecorder] = useState(false);
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
  const isGroup = !!chat?.is_group;
  const groupName = chatTitle(chat);
  const [muteState, setMuteState] = useState({ muted: !!chat?.is_muted, until: chat?.muted_until || null });
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const mentionsRef = useRef([]); // [{id, handle}]
  useEffect(() => {
    if (!isGroup || !chat?.id) { setGroupMembers([]); return; }
    axios.get(`${API}/chats/${chat.id}/info`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setGroupMembers(r.data?.members || [])).catch(() => {});
  }, [isGroup, chat?.id, chat?.members_count, token]);
  const mentionMatch = isGroup ? /(?:^|\s)@([^\s@]*)$/.exec(newMessage || "") : null;
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;
  const pickMention = (m) => {
    const handle = mentionHandle(m);
    setNewMessage((prev) => prev.replace(/(^|\s)@[^\s@]*$/, `$1@${handle} `));
    if (!mentionsRef.current.some((x) => x.id === m.id)) mentionsRef.current.push({ id: m.id, handle });
  };
  const collectMentions = (text) => mentionsRef.current.filter((x) => (text || "").includes(`@${x.handle}`)).map((x) => x.id);

  // Offline outbox: messages typed without internet are queued and sent when back online
  const outbox = useChatOutbox({
    chatId: chat.id, token,
    onSent: (tempId, real) => setMessages((prev) => (prev.some((m) => m.id === real.id) ? prev : [...prev, real])),
    onFailed: () => { import("@/components/bruno/BrunoToast").then(({ brunoToast }) => brunoToast.error("Un mensaje pendiente no se pudo enviar")); },
  });
  const wsConnected = !!ws && ws.readyState === WebSocket.OPEN;
  const wsEverRef = useRef(false);
  const [wsLost, setWsLost] = useState(false);
  useEffect(() => {
    if (wsConnected) { wsEverRef.current = true; setWsLost(false); return undefined; }
    if (!wsEverRef.current) return undefined;
    const t = setTimeout(() => setWsLost(true), 2500); // grace period before showing "Reconectando"
    return () => clearTimeout(t);
  }, [wsConnected]);

  // @mention → profile of the right member (group members or the 1:1 participant)
  const mentionTarget = (handle, message) => {
    const pool = isGroup ? groupMembers : [participant];
    const ids = message?.mentions || [];
    const byMention = pool.find((m) => m && ids.includes(m.id) && mentionHandle(m).toLowerCase() === handle.toLowerCase());
    const byHandle = pool.find((m) => m && mentionHandle(m).toLowerCase() === handle.toLowerCase());
    return (byMention || byHandle)?.id || null;
  };

  // Tap on a quote → jump to (and flash) the original message
  const jumpToMessage = (id) => {
    const el = document.getElementById(`bubble-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("bubble-flash");
    setTimeout(() => el.classList.remove("bubble-flash"), 1600);
  };

  const [savedCards, setSavedCards] = useState({});
  const [myCardIds, setMyCardIds] = useState(null);
  useEffect(() => {
    axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setMyCardIds(new Set((r.data || []).map((c) => c.id)))).catch(() => setMyCardIds(new Set()));
  }, [token]);
  const saveSharedCard = async (cardId) => {
    const { brunoToast } = await import("@/components/bruno/BrunoToast");
    try {
      const r = await axios.post(`${API}/cards/${cardId}/save?via=chat`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setSavedCards((p) => ({ ...p, [cardId]: true }));
      brunoToast.success(r.data.already ? "Ya estaba en tus tarjetas recibidas" : "Tarjeta guardada en tu BRUNO", { description: "La encuentras en Perfil → Recibidas" });
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar"); }
  };
  useEffect(() => { setMuteState({ muted: !!chat?.is_muted, until: chat?.muted_until || null }); }, [chat?.id, chat?.is_muted, chat?.muted_until]);
  // Auto-unmute in the UI when the temporary mute expires
  useEffect(() => {
    if (!muteState.muted || !muteState.until) return undefined;
    const ms = new Date(muteState.until) - Date.now();
    if (ms <= 0) { setMuteState({ muted: false, until: null }); return undefined; }
    const t = setTimeout(() => setMuteState({ muted: false, until: null }), Math.min(ms, 2147000000));
    return () => clearTimeout(t);
  }, [muteState]);
  const muted = muteState.muted;
  const handleMuteChange = (data) => {
    setMuteState({ muted: !!data.muted, until: data.muted_until || null });
    onChatUpdated?.(chat.id, { is_muted: !!data.muted, muted_until: data.muted_until || null });
  };

  // Auto-dial when arriving from "Devolver llamada" (/chat/:id?call=audio|video)
  const autoDialed = useRef(false);
  useEffect(() => {
    const kind = autoCall;
    if (!kind || autoDialed.current || !chat?.id) return;
    const t = setTimeout(() => { autoDialed.current = true; startVideoCall(kind === "video" ? "video" : "audio"); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat?.id, autoCall]);
  
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

  const messagesBoxRef = useRef(null);
  const scrollToBottom = useCallback((smooth = true) => {
    const box = messagesBoxRef.current;
    if (!box) return;
    if (smooth && box.scrollTo) box.scrollTo({ top: box.scrollHeight, behavior: "smooth" });
    else box.scrollTop = box.scrollHeight;
  }, []);
  useEffect(() => { scrollToBottom(true); }, [messages, scrollToBottom]);
  // Keyboard opened/closed → keep the conversation pinned to the last message
  useEffect(() => {
    const onViewport = () => { scrollToBottom(false); setTimeout(() => scrollToBottom(false), 220); };
    window.addEventListener("bruno:viewport", onViewport);
    return () => window.removeEventListener("bruno:viewport", onViewport);
  }, [scrollToBottom]);

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

      if (response.data.dnd) {
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.info("No disponible ahora", { description: "Tiene activado No molestar. La llamada quedó registrada como perdida." });
        return;
      }
      
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
      const ans = await axios.post(`${API}/calls/${videoCallState.callId}/answer`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideoCallState(prev => ({ ...prev, isIncoming: false, roomUrl: ans.data?.room_url || prev.roomUrl }));
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
      const mime = (audioBlob.__mime || audioBlob.type || "audio/webm").toLowerCase();
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      formData.append("file", audioBlob, `audio.${ext}`);
      
      const uploadResponse = await axios.post(`${API}/upload/audio`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });

      const audioUrl = uploadResponse.data.url;
      const audioMp3 = uploadResponse.data.mp3_url || null;
      
      const messageData = {
        content: "🎤 Nota de voz",
        message_type: "audio",
        attachments: [{ url: audioUrl, mp3_url: audioMp3, type: mime, filename: `audio.${ext}` }]
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
        mentions: collectMentions(newMessage),
        ...(replyTo ? { reply_to: { id: replyTo.id, sender_name: replyTo.name, preview: replyTo.preview, content: replyTo.body } } : {})
      };
      mentionsRef.current = [];
      
      if (!navigator.onLine) {
        outbox.queue({ ...messageData, sender_id: currentUserId });
        setNewMessage(""); setPendingMedia(null); setReplyTo(null);
      } else if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "send_message", chat_id: chat.id, ...messageData }));
        setNewMessage("");
        setPendingMedia(null);
        setReplyTo(null);
      } else {
        try {
          const response = await axios.post(
            `${API}/chats/${chat.id}/messages`,
            messageData,
            { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 }
          );
          setMessages([...messages, response.data]);
        } catch (err) {
          if (err?.response) throw err;
          outbox.queue({ ...messageData, sender_id: currentUserId }); // network error → keep for later
        }
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
      name: message.sender_id === currentUserId ? "Tú" : (message.sender?.display_name || message.sender?.username || message.sender_name || participant?.display_name || participant?.username || "Mensaje"),
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

  const messageGroups = groupMessagesByDate([...messages, ...outbox.pending]);

  return (
    <div className="h-full w-full min-w-0 flex flex-col bg-background">
      {/* Modern Header */}
      <div className="px-3 py-2.5 border-b bg-background/80 backdrop-blur-xl flex items-center gap-2 sticky top-0 z-10 w-full max-w-full overflow-hidden">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden rounded-full h-9 w-9" aria-label="Volver" data-testid="chat-back-btn">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        {/* Clickable avatar → profile (or group info) */}
        {isGroup ? (
          <button type="button" onClick={() => setShowGroupInfo(true)} className="shrink-0" data-testid="chat-group-avatar-btn">
            <ChatAvatar chat={chat} size={40} />
          </button>
        ) : (
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
        )}
        
        {isGroup ? (
          <button type="button" onClick={() => setShowGroupInfo(true)} className="flex-1 min-w-0 overflow-hidden text-left" data-testid="chat-group-info-btn">
            <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors" data-testid="chat-header-title">{groupName}</h3>
            <p className="text-[10px] text-muted-foreground truncate">
              {isTyping ? <TypingDots label={typingUser || "escribiendo"} /> : muted ? formatMutedUntil(muteState.until) : `${chat?.members_count || (chat?.other_participants?.length || 0) + 1} participantes · toca para ver info`}
            </p>
          </button>
        ) : (
        <Link to={`/profile/${participant.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate hover:text-primary transition-colors" data-testid="chat-header-title">{participant.display_name || participant.username}</h3>
          <p className="text-[10px] text-muted-foreground">
            {isTyping ? (
              <TypingDots label="escribiendo" />
            ) : muted ? formatMutedUntil(muteState.until) : "En linea"}
          </p>
        </Link>
        )}
        
        <div className="flex gap-0.5 shrink-0">
          <MuteMenu chatId={chat.id} token={token} muted={muted} mutedUntil={muteState.until} onChange={handleMuteChange} />
          <Button 
            variant="ghost" size="icon" 
            className="rounded-full h-9 w-9 hover:bg-green-500/10 hover:text-green-500"
            onClick={() => startVideoCall("audio")}
            disabled={callLoading}
            aria-label={isGroup ? "Llamada grupal" : "Llamar"}
            data-testid="start-audio-call-btn"
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button 
            variant="ghost" size="icon" 
            className="rounded-full h-9 w-9 hover:bg-blue-500/10 hover:text-blue-500"
            onClick={() => startVideoCall("video")}
            disabled={callLoading}
            aria-label={isGroup ? "Videollamada grupal" : "Videollamada"}
            data-testid="start-video-call-btn"
          >
            {callLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Group info */}
      {isGroup && (
        <GroupInfoSheet chat={chat} isOpen={showGroupInfo} onClose={() => setShowGroupInfo(false)} token={token} currentUserId={currentUserId}
          onUpdated={(patch) => onChatUpdated?.(chat.id, patch)} onLeft={(id) => onLeftGroup?.(id)} onCall={(kind) => startVideoCall(kind)} />
      )}

      {/* Video Call Modal */}
      <VideoCallModal
        isOpen={videoCallState.isOpen}
        onClose={handleEndCall}
        roomUrl={videoCallState.roomUrl}
        remoteUserName={isGroup ? `${groupName} (grupo)` : (participant.display_name || participant.username)}
        isIncoming={videoCallState.isIncoming}
        onAccept={handleAcceptCall}
        onDecline={handleDeclineCall}
        callType={videoCallState.callType}
      />

      {/* Messages */}
      <OfflineBanner online={outbox.online} wsConnected={!wsLost} pendingCount={outbox.pending.length} onRetry={outbox.flush} />
      <div ref={messagesBoxRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" }} data-testid="chat-messages-box">
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
                if (message.message_type === "system") {
                  return (
                    <div key={message.id} className="flex justify-center my-2" data-testid={`chat-system-${message.id}`}>
                      <span className="px-3 py-1.5 rounded-full bg-muted/60 backdrop-blur-sm text-[11px] text-muted-foreground text-center">{message.content}</span>
                    </div>
                  );
                }
                // ── Call log (system message) ──
                if (message.message_type === "call") {
                  const a = message.attachments?.[0] || {};
                  const missed = a.status === "missed" || a.status === "dnd" || a.status === "declined";
                  const CallIcon = a.call_type === "video" ? Video : Phone;
                  return (
                    <div key={message.id} className="flex justify-center my-2" data-testid={`chat-call-${message.id}`}>
                      <button onClick={() => startVideoCall(a.call_type === "video" ? "video" : "audio")} className={`inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur-sm active:scale-95 transition-transform ${missed ? "bg-red-500/10 text-red-600 dark:text-red-400" : "bg-muted/70 text-foreground/80"}`} data-testid="chat-call-redial">
                        <CallIcon className={`w-3.5 h-3.5 ${missed ? "" : "text-emerald-500"}`} />
                        <span>{message.content}</span>
                        <span className="text-[10px] text-muted-foreground">· Volver a llamar</span>
                      </button>
                    </div>
                  );
                }
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
                      id={`bubble-${message.id}`}
                      className={`max-w-[78%] px-3.5 py-2 transition-shadow ${message.status === "pending" ? "opacity-70" : ""} ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm shadow-sm shadow-primary/10"
                          : "bg-muted/60 rounded-2xl rounded-bl-sm"
                      }`}
                    >
                      {isGroup && !isOwn && message.sender?.username && (
                        <p className="text-[10px] font-bold text-primary mb-0.5" data-testid="group-msg-sender">{message.sender.username}</p>
                      )}
                      {/* Reply preview */}
                      {message.reply_to && (
                        <div role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); jumpToMessage(message.reply_to.id); }}
                          className={`mb-1.5 px-2 py-1 rounded-md border-l-2 cursor-pointer active:scale-[0.98] transition-transform ${isOwn ? "border-white/50 bg-white/10" : "border-orange-500 bg-orange-50/60 dark:bg-orange-500/10"}`} data-testid={`reply-quote-${message.id}`}>
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
                      {message.message_type !== 'sticker' && message.message_type !== 'card' && message.message_type !== 'reel' && message.message_type !== 'location_share' && message.attachments?.length > 0 && (
                        <div className="mb-2">
                          {message.attachments.map((att, idx) => (
                            <FileAttachment key={`att-${idx}`} file={att} isOwn={isOwn} />
                          ))}
                        </div>
                      )}

                      {/* Card messages */}
                      {message.message_type === 'card' && message.attachments?.[0] && (
                        <div>
                          <CardMessagePreview 
                            card={message.attachments[0]}
                            isOwn={isOwn}
                            onClick={() => navigate(`/c/${message.attachments[0].card_id}`)}
                          />
                          {!isOwn && myCardIds && !myCardIds.has(message.attachments[0].card_id) && (
                            <button type="button" onClick={() => saveSharedCard(message.attachments[0].card_id)} disabled={!!savedCards[message.attachments[0].card_id]}
                              className={`mt-1.5 w-full h-9 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${savedCards[message.attachments[0].card_id] ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-primary text-white active:scale-[0.98]"}`}
                              data-testid={`save-card-btn-${message.id}`}>
                              {savedCards[message.attachments[0].card_id] ? <><Check className="w-3.5 h-3.5" /> Guardada en tu BRUNO</> : <><Wallet className="w-3.5 h-3.5" /> Guardar en mi BRUNO</>}
                            </button>
                          )}
                        </div>
                      )}

                      {/* Location share messages */}
                      {message.message_type === 'location_share' && message.attachments?.[0] && (
                        <LocationMessagePreview attachment={message.attachments[0]} isOwn={isOwn} />
                      )}

                      {/* Shared reel */}
                      {message.message_type === 'reel' && message.attachments?.[0] && (
                        <button onClick={() => navigate(`/reels?id=${message.attachments[0].post_id}`)} className="block w-[200px] max-w-full my-1 rounded-2xl overflow-hidden bg-black/85 text-left active:scale-[0.98] transition-transform" data-testid={`chat-reel-${message.attachments[0].post_id}`}>
                          <div className="relative aspect-[4/5] bg-zinc-900">
                            {message.attachments[0].poster_url ? <img src={message.attachments[0].poster_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-white/50 text-3xl">🎬</div>}
                            <span className="absolute top-2 left-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] text-white font-semibold">Reel</span>
                          </div>
                          <div className="p-2.5">
                            <p className="text-white text-xs font-semibold truncate">@{message.attachments[0].author_name}</p>
                            {message.attachments[0].caption && <p className="text-white/70 text-[11px] line-clamp-2">{message.attachments[0].caption}</p>}
                          </div>
                        </button>
                      )}
                      
                      {/* Text content with @mention parsing */}
                      {message.content && message.message_type !== 'audio' && message.message_type !== 'sticker' && message.message_type !== 'card' && message.message_type !== 'location_share' && message.message_type !== 'reel' && (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {message.content.split(/(@[\p{L}\p{N}_]+)/gu).map((part, pi) => {
                            if (part.startsWith("@")) {
                              const uname = part.slice(1);
                              const targetId = mentionTarget(uname, message);
                              if (!targetId) return <span key={`m-${pi}-${uname}`} className="font-semibold">{part}</span>;
                              return (
                                <Link key={`m-${pi}-${uname}`} to={`/profile/${targetId}`} className={`font-semibold underline decoration-1 underline-offset-2 ${isOwn ? "text-primary-foreground" : "text-primary"}`} data-testid={`mention-link-${targetId}`}>
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
                          message.status === "pending" ? (
                            <Clock className="w-3 h-3 text-primary-foreground/70" data-testid="msg-pending-icon" />
                          ) : message.is_read ? (
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
        {isGroup && <MentionPicker members={groupMembers} query={mentionQuery} onPick={pickMention} currentUserId={currentUserId} />}
        <BrunoPillInput
          value={newMessage}
          onChange={setNewMessage}
          onTyping={handleTyping}
          onSend={(text) => handleSend({ preventDefault: () => {} })}
          onAttach={() => setShowAttachMenu(!showAttachMenu)}
          onCamera={() => setShowCamera(true)}
          onVideoNote={() => setShowVideoNoteRecorder(true)}
          onStickers={() => setShowStickerPicker((v) => !v)}
          onMicStart={startRecording}
          onMicStop={stopRecording}
          isRecording={isRecording}
          sending={sending}
          uploading={uploading}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          placeholder="Mensaje..."
        />
      </div>

      {/* Video Note Recorder (Telegram-style circular video message) */}
      <VideoNoteRecorder
        open={showVideoNoteRecorder}
        onClose={() => setShowVideoNoteRecorder(false)}
        onCapture={async (file) => {
          // Upload + send as video_note message
          try {
            setUploading(true);
            const form = new FormData();
            form.append("file", file);
            const up = await axios.post(`${API}/upload/chat-file`, form, {
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
            });
            const url = up.data?.url || up.data?.secure_url;
            if (!url) throw new Error("no url");
            await axios.post(`${API}/chats/${chat.id}/messages`, {
              content: "",
              message_type: "video_note",
              attachments: [{ url, type: "video", filename: file.name }],
              reply_to: replyTo?.id || null,
            }, { headers: { Authorization: `Bearer ${token}` } });
            setReplyTo(null);
            fetchMessages();
          } catch (_e) {
            const { brunoToast } = await import("@/components/bruno/BrunoToast");
            brunoToast.error("No se pudo enviar el video note");
          } finally {
            setUploading(false);
          }
        }}
      />
    </div>
  );
};

// New Chat Modal
// Main ChatPage Component
const ChatPage = () => {
  // Captured once: the parent later rewrites the URL (replace) and would drop ?call=
  const autoCallRef = useRef(new URLSearchParams(window.location.search).get("call"));
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams();

  // Lock the document while the chat is open: the chat is a fixed, keyboard-aware panel
  // (height = visual viewport) so iOS/Android never scroll the page when the keyboard opens.
  useEffect(() => {
    const prev = { html: document.documentElement.style.overflow, body: document.body.style.overflow, pos: document.body.style.position };
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("chat-open");
    return () => {
      document.documentElement.style.overflow = prev.html;
      document.body.style.overflow = prev.body;
      document.body.style.position = prev.pos;
      document.documentElement.classList.remove("chat-open");
    };
  }, []);
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [ws, setWs] = useState(null);
  const wsReconnectRef = useRef(null);
  const fetchChatsRef = useRef(null);

  useEffect(() => {
    if (!token) return;

    const connectWebSocket = () => {
      try {
        const socket = new WebSocket(`${WS_URL}/api/ws/chat/${token}`);
        
        socket.onopen = () => {
          setWs(socket);
        };
        
        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "group_created") {
              fetchChatsRef.current?.();
            }
            if (data.type === "new_message") {
              setChats(prev => {
                if (!prev.some(c => c.id === data.message.chat_id)) { fetchChatsRef.current?.(); return prev; }
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
  useEffect(() => { fetchChatsRef.current = fetchChats; }, [fetchChats]);

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchChats();
  }, [user, navigate, fetchChats]);

  const handleChatUpdated = (id, patch) => {
    setChats(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
    setSelectedChat(prev => (prev?.id === id ? { ...prev, ...patch } : prev));
  };
  const handleLeftGroup = (id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    setSelectedChat(null);
    navigate("/chat", { replace: true });
  };
  const handleGroupCreated = (group) => {
    setChats(prev => [group, ...prev.filter(c => c.id !== group.id)]);
    syncedChatIdRef.current = group.id;
    setSelectedChat(group);
    navigate(`/chat/${group.id}`, { replace: true });
  };

  // Sync selectedChat from URL param (e.g. when route is /chat/:id). React Router applies the
  // navigation in a transition, so right after handleBack the old chatId is still visible for one
  // render → guard with a ref so we only react to REAL URL changes (fixes "back button does nothing").
  const syncedChatIdRef = useRef(null);
  useEffect(() => {
    if (!chatId) { syncedChatIdRef.current = null; return; }
    if (chats.length === 0 || syncedChatIdRef.current === chatId) return;
    const target = chats.find(c => c.id === chatId);
    if (target) {
      syncedChatIdRef.current = chatId;
      setSelectedChat(target);
    }
  }, [chatId, chats]);

  const handleSelectChat = (chat) => {
    syncedChatIdRef.current = chat.id;
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
      
      syncedChatIdRef.current = newChat.id;
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
      className="flex bg-background overflow-hidden fixed left-0 right-0 w-full"
      data-testid="chat-page"
      style={{ top: "var(--app-vv-top, 0px)", height: "var(--app-vh, 100dvh)" }}
    >
      {/* Chat List - Hidden on mobile when chat is selected */}
      <div className={`${isMobile && selectedChat ? "hidden" : "flex"} w-full md:w-96 border-r`}>
        <ChatList
          chats={chats}
          onSelectChat={handleSelectChat}
          selectedChatId={selectedChat?.id}
          onNewChat={() => setShowNewChat(true)}
          onNewGroup={() => setShowNewGroup(true)}
          token={token}
        />
      </div>

      {/* Chat View */}
      <div className={`${isMobile && !selectedChat ? "hidden" : "flex"} flex-1 min-w-0 flex-col`}>
        {selectedChat ? (
          <ChatView 
            chat={selectedChat} 
            onBack={handleBack}
            currentUserId={user.id}
            ws={ws}
            autoCall={autoCallRef.current}
            onChatUpdated={handleChatUpdated}
            onLeftGroup={handleLeftGroup}
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
      <NewGroupModal isOpen={showNewGroup} onClose={() => setShowNewGroup(false)} token={token} onCreated={handleGroupCreated} />
    </div>
  );
};

export default ChatPage;
