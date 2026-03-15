import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Sparkles, X, Send, Loader2, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FloatingBubbles = () => {
  const { user, token } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [generatingCard, setGeneratingCard] = useState(false);
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
        // Add welcome message - concise and actionable
        setAiMessages([{
          role: "assistant",
          content: "Soy BRUNO IA. ¿Qué necesitas?\n\n→ Crear tarjeta\n→ Buscar profesional\n→ Ayuda con la app"
        }]);
      }
    } catch (error) {
      console.error("Error loading AI history:", error);
      setAiMessages([{
        role: "assistant",
        content: "BRUNO IA listo. ¿En qué te ayudo?"
      }]);
    }
  };

  const sendAIMessage = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading || generatingCard) return;

    const userMessage = aiInput.trim();
    setAiInput("");
    setAiMessages(prev => [...prev, { role: "user", content: userMessage }]);
    
    // Check if user wants to create a card
    if (isCardCreationRequest(userMessage)) {
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: "Generando tu tarjeta con IA..."
      }]);
      await generateCardWithAI(userMessage);
      return;
    }
    
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
        content: "Error de conexión. Intenta de nuevo." 
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
        content: "Conversación reiniciada. ¿Qué necesitas?"
      }]);
    } catch (error) {
      console.error("Error clearing AI history:", error);
    }
  };

  // Generate card with AI
  const generateCardWithAI = async (description) => {
    setGeneratingCard(true);
    try {
      const response = await axios.post(
        `${API}/ai/generate-card`,
        { description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Store generated data in sessionStorage and navigate to create card
      sessionStorage.setItem("ai_generated_card", JSON.stringify(response.data));
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: `✅ ${response.data.message}\n\nTe llevo a crear tu tarjeta...`
      }]);
      
      setTimeout(() => {
        setShowAIChat(false);
        navigate("/cards/new?from_ai=true");
      }, 1500);
      
    } catch (error) {
      console.error("Error generating card:", error);
      setAiMessages(prev => [...prev, {
        role: "assistant",
        content: "No pude generar la tarjeta. Ve a + → Nueva Tarjeta para crearla manualmente."
      }]);
    } finally {
      setGeneratingCard(false);
    }
  };

  // Check if message is asking to create a card
  const isCardCreationRequest = (message) => {
    const keywords = ["crear tarjeta", "crea mi tarjeta", "quiero una tarjeta", "hazme una tarjeta", 
                      "necesito tarjeta", "crear mi", "soy ", "tengo un", "ofrezco", "busco trabajo"];
    return keywords.some(k => message.toLowerCase().includes(k));
  };

  // Don't render if user is not logged in or on chat page
  if (!user || isOnChatPage) return null;

  return (
    <>
      {/* BRUNO AI Bubble - Bottom Left (chat is handled by FloatingChatBubble.jsx) */}
      <div className="fixed bottom-[72px] left-3 z-50 md:bottom-6 md:left-6">
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
          {!showAIChat && (
            <div className="absolute bottom-full left-0 mb-2 px-2.5 py-1 bg-card rounded-lg shadow-lg text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              BRUNO IA
            </div>
          )}
        </div>

        {/* AI Chat Window - Compact design */}
        {showAIChat && (
          <div className="absolute bottom-14 left-0 w-72 sm:w-80 h-[400px] bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
            {/* Compact Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-violet-600/10 to-fuchsia-600/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-fuchsia-600 rounded-full flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-xs">BRUNO IA</h4>
                  <p className="text-[10px] text-muted-foreground">Tu asistente</p>
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAIHistory();
                  }}
                  title="Limpiar conversación"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAIChat(false);
                  }}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Messages - Compact */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-gradient-to-b from-transparent to-muted/10">
              {aiMessages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-2.5 py-1.5 rounded-2xl text-xs ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-primary to-primary/90 text-white rounded-br-md"
                        : "bg-muted/80 rounded-bl-md"
                    }`}
                  >
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted/80 px-3 py-1.5 rounded-2xl rounded-bl-md">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Compact Input */}
            <form onSubmit={sendAIMessage} className="p-2 border-t">
              <div className="flex gap-1.5">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Escribe..."
                  className="flex-1 h-7 text-xs rounded-full bg-muted/50 border-0 px-3"
                  disabled={aiLoading}
                  data-testid="ai-chat-input"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!aiInput.trim() || aiLoading}
                  className="h-7 w-7 p-0 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
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
