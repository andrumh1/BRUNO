import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { 
  ArrowLeft, 
  Send, 
  Image as ImageIcon, 
  Mic, 
  MoreVertical,
  Phone,
  Video,
  Search,
  Plus,
  Check,
  CheckCheck,
  Loader2,
  X
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Chat List Component
const ChatList = ({ chats, onSelectChat, selectedChatId, onNewChat }) => {
  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / 3600000);
    
    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    if (hours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-xl font-bold">Mensajes</h2>
        <Button variant="ghost" size="icon" onClick={onNewChat}>
          <Plus className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar conversación..." className="pl-9 h-9" />
        </div>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground mb-4">No tienes conversaciones aún</p>
            <Button onClick={onNewChat} size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nueva conversación
            </Button>
          </div>
        ) : (
          chats.map((chat) => {
            const participant = chat.other_participants?.[0] || {};
            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center gap-3 p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                  selectedChatId === chat.id ? "bg-primary/10" : ""
                }`}
                data-testid={`chat-item-${chat.id}`}
              >
                {/* Avatar */}
                {participant.avatar_url ? (
                  <img 
                    src={participant.avatar_url} 
                    alt={participant.display_name}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                    {(participant.display_name || participant.username || "?")[0].toUpperCase()}
                  </div>
                )}
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold truncate">
                      {participant.display_name || participant.username}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(chat.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground truncate">
                      {chat.last_message?.content || "Sin mensajes"}
                    </p>
                    {chat.unread_count > 0 && (
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Chat View Component
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
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const participant = chat?.other_participants?.[0] || {};

  const fetchMessages = useCallback(async () => {
    if (!chat?.id) return;
    try {
      const response = await axios.get(`${API}/chats/${chat.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }, [chat?.id, token]);

  // Initial fetch
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Listen for WebSocket messages
  useEffect(() => {
    if (!ws || !chat?.id) return;

    const handleWsMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "new_message" && data.message.chat_id === chat.id) {
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
        
        if (data.type === "typing" && data.chat_id === chat.id) {
          setTypingUser(data.username);
          setIsTyping(true);
          // Clear typing indicator after 3 seconds
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
        
        if (data.type === "messages_read" && data.chat_id === chat.id) {
          setMessages(prev => prev.map(m => 
            m.sender_id === currentUserId ? { ...m, is_read: true } : m
          ));
        }
      } catch (e) {
        console.error("Error parsing WS message:", e);
      }
    };

    ws.addEventListener("message", handleWsMessage);
    
    // Mark messages as read when viewing chat
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "mark_read", chat_id: chat.id }));
    }

    return () => {
      ws.removeEventListener("message", handleWsMessage);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [ws, chat?.id, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const response = await axios.post(`${API}/upload/image`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data"
        }
      });
      
      const mediaType = file.type.startsWith("video/") ? "video" : "image";
      setPendingMedia({
        type: mediaType,
        url: response.data.url,
        filename: file.name
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error al subir archivo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !pendingMedia) || sending) return;

    setSending(true);
    try {
      const messageData = {
        content: newMessage.trim(),
        message_type: pendingMedia ? pendingMedia.type : "text",
        attachments: pendingMedia ? [pendingMedia] : []
      };
      
      // Try WebSocket first, fallback to HTTP
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: "send_message",
          chat_id: chat.id,
          ...messageData
        }));
        setNewMessage("");
        setPendingMedia(null);
      } else {
        // Fallback to HTTP
        const response = await axios.post(
          `${API}/chats/${chat.id}/messages`,
          messageData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setMessages([...messages, response.data]);
        setNewMessage("");
        setPendingMedia(null);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  };

  // Send typing indicator
  const handleTyping = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "typing", chat_id: chat.id }));
    }
  };

  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: "2-digit", 
      minute: "2-digit" 
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Hoy";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Ayer";
    }
    return date.toLocaleDateString([], { 
      weekday: "long", 
      day: "numeric", 
      month: "long" 
    });
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, message) => {
    const date = new Date(message.created_at).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(message);
    return groups;
  }, {});

  if (!chat) return null;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-3 border-b flex items-center gap-3 bg-card">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {participant.avatar_url ? (
          <img 
            src={participant.avatar_url} 
            alt={participant.display_name}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
            {(participant.display_name || participant.username || "?")[0].toUpperCase()}
          </div>
        )}
        
        <div className="flex-1">
          <h3 className="font-semibold">{participant.display_name || participant.username}</h3>
          <p className="text-xs text-muted-foreground">
            {isTyping ? `${typingUser || participant.display_name} está escribiendo...` : "En línea"}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Envía un mensaje para iniciar la conversación
            </p>
          </div>
        ) : (
          Object.entries(groupedMessages).map(([date, dateMessages]) => (
            <div key={date}>
              {/* Date separator */}
              <div className="flex items-center justify-center my-4">
                <span className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground">
                  {formatDate(dateMessages[0].created_at)}
                </span>
              </div>
              
              {/* Messages for this date */}
              {dateMessages.map((message, index) => {
                const isOwn = message.sender_id === currentUserId;
                const showAvatar = !isOwn && (
                  index === 0 || 
                  dateMessages[index - 1]?.sender_id !== message.sender_id
                );
                
                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}
                  >
                    {!isOwn && showAvatar && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold mr-2 mt-auto">
                        {(message.sender?.username || "?")[0].toUpperCase()}
                      </div>
                    )}
                    {!isOwn && !showAvatar && <div className="w-8 mr-2" />}
                    
                    <div
                      className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                        isOwn
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border rounded-bl-sm"
                      }`}
                    >
                      {/* Attachments */}
                      {message.attachments?.length > 0 && (
                        <div className="mb-2">
                          {message.attachments.map((att, i) => (
                            att.type === "image" ? (
                              <img 
                                key={i} 
                                src={att.url} 
                                alt="" 
                                className="rounded-lg max-w-full"
                              />
                            ) : att.type === "video" ? (
                              <video 
                                key={i} 
                                src={att.url} 
                                controls 
                                className="rounded-lg max-w-full"
                              />
                            ) : att.type === "audio" || att.type === "voice_note" ? (
                              <audio key={i} src={att.url} controls className="w-full" />
                            ) : null
                          ))}
                        </div>
                      )}
                      
                      {/* Text content */}
                      {message.content && (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      )}
                      
                      {/* Time and read status */}
                      <div className={`flex items-center justify-end gap-1 mt-1 ${
                        isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                      }`}>
                        <span className="text-[10px]">{formatTime(message.created_at)}</span>
                        {isOwn && (
                          message.is_read ? (
                            <CheckCheck className="w-3 h-3" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )
                        )}
                      </div>
                    </div>
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
        <div className="px-3 py-2 border-t bg-muted/50 flex items-center gap-2">
          {pendingMedia.type === "image" ? (
            <img src={pendingMedia.url} alt="" className="w-16 h-16 rounded object-cover" />
          ) : (
            <video src={pendingMedia.url} className="w-16 h-16 rounded object-cover" />
          )}
          <span className="text-sm flex-1 truncate">{pendingMedia.filename}</span>
          <Button 
            type="button" 
            variant="ghost" 
            size="icon" 
            onClick={() => setPendingMedia(null)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}
      
      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t bg-card flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button 
          type="button" 
          variant="ghost" 
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ImageIcon className="w-5 h-5" />
          )}
        </Button>
        
        <Input
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Escribe un mensaje..."
          className="flex-1"
          data-testid="chat-input"
        />
        
        <Button type="button" variant="ghost" size="icon">
          <Mic className="w-5 h-5" />
        </Button>
        
        <Button 
          type="submit" 
          size="icon" 
          disabled={(!newMessage.trim() && !pendingMedia) || sending}
          data-testid="send-message-btn"
        >
          {sending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </form>
    </div>
  );
};

// New Chat Modal
const NewChatModal = ({ isOpen, onClose, onSelectUser, token }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !searchQuery.trim()) {
      setUsers([]);
      return;
    }

    const searchUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/users/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(response.data);
      } catch (error) {
        console.error("Error searching users:", error);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, isOpen, token]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md glass-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">Nueva conversación</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancelar
            </Button>
          </div>
          
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar usuario por nombre o email..."
            className="mb-4"
            autoFocus
            data-testid="search-user-input"
          />
          
          <div className="max-h-64 overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              </div>
            ) : users.length === 0 && searchQuery ? (
              <p className="text-center text-muted-foreground py-4">
                No se encontraron usuarios
              </p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className="flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  {user.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt={user.display_name}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                      {(user.display_name || user.username || "?")[0].toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{user.display_name || user.username}</p>
                    <p className="text-sm text-muted-foreground">@{user.username}</p>
                  </div>
                </div>
              ))
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
  
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

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
      
      // If chatId in URL, select that chat
      if (chatId) {
        const chat = response.data.find(c => c.id === chatId);
        if (chat) setSelectedChat(chat);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
    } finally {
      setLoading(false);
    }
  }, [token, chatId]);

  useEffect(() => {
    fetchChats();
    // Poll for new chats every 10 seconds
    const interval = setInterval(fetchChats, 10000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  const handleSelectChat = (chat) => {
    setSelectedChat(chat);
    navigate(`/chat/${chat.id}`);
  };

  const handleBack = () => {
    setSelectedChat(null);
    navigate("/chat");
  };

  const handleNewChat = async (selectedUser) => {
    try {
      const response = await axios.post(
        `${API}/chats?participant_id=${selectedUser.id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Refresh chats and select the new/existing one
      await fetchChats();
      
      const newChat = {
        ...response.data,
        other_participants: [{
          id: selectedUser.id,
          username: selectedUser.username,
          display_name: selectedUser.display_name,
          avatar_url: selectedUser.avatar_url
        }]
      };
      
      setSelectedChat(newChat);
      setShowNewChat(false);
      navigate(`/chat/${response.data.id}`);
    } catch (error) {
      console.error("Error creating chat:", error);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center glass-card">
          <h2 className="text-xl font-bold mb-4">Inicia sesión para chatear</h2>
          <Link to="/login">
            <Button>Iniciar Sesión</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Mobile/Desktop Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Link to="/feed">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <Link to="/">
          <img src="/bruno-logo.png" alt="BRUNO" className="h-8" />
        </Link>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat List (hidden on mobile when chat is selected) */}
        <div className={`${
          isMobile && selectedChat ? "hidden" : "flex"
        } flex-col w-full md:w-80 lg:w-96 border-r bg-card`}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ChatList
              chats={chats}
              selectedChatId={selectedChat?.id}
              onSelectChat={handleSelectChat}
              onNewChat={() => setShowNewChat(true)}
            />
          )}
        </div>

        {/* Chat View (full screen on mobile, side panel on desktop) */}
        <div className={`${
          isMobile && !selectedChat ? "hidden" : "flex"
        } flex-1 flex-col bg-background`}>
          {selectedChat ? (
            <ChatView 
              chat={selectedChat} 
              onBack={handleBack}
              currentUserId={user.id}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <Send className="w-10 h-10" />
                </div>
                <p className="text-lg font-medium">Selecciona una conversación</p>
                <p className="text-sm">o inicia una nueva</p>
              </div>
            </div>
          )}
        </div>
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
