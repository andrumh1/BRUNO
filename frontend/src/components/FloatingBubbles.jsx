import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MessageCircle, Sparkles, X, Send, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FloatingBubbles = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  // Hide bubbles on chat page
  const isOnChatPage = location.pathname.startsWith("/chat");

  // Fetch unread messages count
  useEffect(() => {
    if (!token) return;

    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${API}/chats`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const total = response.data.reduce((sum, chat) => sum + (chat.unread_count || 0), 0);
        setUnreadCount(total);
      } catch (error) {
        console.error("Error fetching unread count:", error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  // Scroll to bottom of AI messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Load AI chat history when opening
  useEffect(() => {
    if (showAIChat && token && aiMessages.length === 0) {
      loadAIHistory();
    }
  }, [showAIChat, token]);

  const loadAIHistory = async () => {
    try {
      const response = await axios.get(`${API}/ai/history?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.length > 0) {
        // Convert history to messages format
        const messages = [];
        const history = response.data.reverse(); // Oldest first
        
        for (const conv of history) {
          messages.push({ role: "user", content: conv.user_message });
          messages.push({ role: "assistant", content: conv.ai_response });
          if (!sessionId && conv.session_id) {
            setSessionId(conv.session_id);
          }
        }
        setAiMessages(messages);
      } else {
        // Add welcome message
        setAiMessages([{
          role: "assistant",
          content: "¡Hola! Soy BRUNO IA, tu asistente personal. Puedo ayudarte a:\n\n• Diseñar tarjetas digitales personalizadas\n• Explicarte las funcionalidades de la app\n• Darte recomendaciones para tu perfil profesional\n\n¿En qué puedo ayudarte hoy?"
        }]);
      }
    } catch (error) {
      console.error("Error loading AI history:", error);
      setAiMessages([{
        role: "assistant",
        content: "¡Hola! Soy BRUNO IA. ¿En qué puedo ayudarte hoy?"
      }]);
    }
  };

  const sendAIMessage = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;

    const userMessage = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setAiLoading(true);

    try {
      const response = await axios.post(
        `${API}/ai/chat`,
        { message: userMessage, session_id: sessionId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSessionId(response.data.session_id);
      setAiMessages(prev => [...prev, { role: "assistant", content: response.data.response }]);
    } catch (error) {
      console.error("Error sending AI message:", error);
      setAiMessages(prev => [...prev, { 
        role: "assistant", 
        content: "Lo siento, hubo un error al procesar tu mensaje. Por favor intenta de nuevo." 
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  const clearAIHistory = async () => {
    try {
      await axios.delete(`${API}/ai/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSessionId(null);
      setAiMessages([{
        role: "assistant",
        content: "¡Conversación reiniciada! ¿En qué puedo ayudarte?"
      }]);
    } catch (error) {
      console.error("Error clearing AI history:", error);
    }
  };

  // Don't render if user is not logged in or on chat page
  if (!user || isOnChatPage) return null;

  return (
    <>
      {/* Chat Bubble - Bottom Right */}
      <Link
        to="/chat"
        className="fixed bottom-6 right-6 z-50 group"
        data-testid="floating-chat-btn"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl group-hover:bg-primary/50 transition-all duration-300" />
          <div className="relative w-14 h-14 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 cursor-pointer">
            <MessageCircle className="w-6 h-6 text-primary-foreground" />
          </div>
          {unreadCount > 0 && (
            <div className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </div>
          )}
          <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-card rounded-lg shadow-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
            Mensajes
          </div>
        </div>
      </Link>

      {/* BRUNO AI Bubble - Bottom Left */}
      <div className="fixed bottom-6 left-6 z-50">
        <div 
          className="relative cursor-pointer group"
          onClick={() => setShowAIChat(!showAIChat)}
          data-testid="floating-ai-btn"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/30 to-fuchsia-500/30 rounded-full blur-xl group-hover:from-violet-500/50 group-hover:to-fuchsia-500/50 transition-all duration-300 animate-pulse" />
          <div className="relative w-14 h-14 bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full text-[10px] font-bold text-white shadow-md">
            IA
          </div>
          {!showAIChat && (
            <div className="absolute bottom-full left-0 mb-2 px-3 py-1.5 bg-card rounded-lg shadow-lg text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              BRUNO IA
            </div>
          )}
        </div>

        {/* AI Chat Window */}
        {showAIChat && (
          <div className="absolute bottom-20 left-0 w-80 sm:w-96 h-[500px] bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">BRUNO IA</h4>
                  <p className="text-xs text-muted-foreground">Tu asistente personal</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAIHistory();
                  }}
                  title="Limpiar conversación"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIChat(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {aiMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendAIMessage} className="p-3 border-t bg-card">
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1"
                  disabled={aiLoading}
                  data-testid="ai-chat-input"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!aiInput.trim() || aiLoading}
                  className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  data-testid="ai-send-btn"
                >
                  <Send className="w-4 h-4" />
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
