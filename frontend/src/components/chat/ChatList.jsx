import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";
import CallsHistory from "@/components/chat/CallsHistory";
import { useStoryActivity } from "@/contexts/StoryActivityContext";
import { ArrowLeft, Send, Plus, Search, Mic, Image as ImageIcon, Users, BellOff, MessageCircle, Phone, UserPlus } from "lucide-react";

export const chatTitle = (chat) => {
  if (chat?.is_group) return chat.name || "Grupo";
  const p = chat?.other_participants?.[0] || {};
  return p.display_name || p.username || "Chat";
};

export const ChatAvatar = ({ chat, size = 48 }) => {
  if (chat?.is_group) {
    return chat.avatar_url ? (
      <img src={chat.avatar_url} alt={chat.name} className="rounded-full object-cover" style={{ width: size, height: size }} data-testid="group-avatar" />
    ) : (
      <div className="rounded-full bg-gradient-to-br from-primary to-orange-400 flex items-center justify-center text-white" style={{ width: size, height: size }} data-testid="group-avatar">
        <Users style={{ width: size * 0.45, height: size * 0.45 }} />
      </div>
    );
  }
  const p = chat?.other_participants?.[0] || {};
  return <BrunoAvatar userId={p.id} src={p.avatar_url} name={p.display_name || p.username || "?"} size={size} thickness={2} />;
};

/**
 * ChatList — conversations + calls history tabs.
 * Props: chats, onSelectChat, selectedChatId, onNewChat, onNewGroup, token
 */
const ChatList = ({ chats, onSelectChat, selectedChatId, onNewChat, onNewGroup, token }) => {
  const { registerUserIds } = useStoryActivity();
  const [searchFilter, setSearchFilter] = useState("");
  const [tab, setTab] = useState(() => (new URLSearchParams(window.location.search).get("tab") === "calls" ? "calls" : "chats"));
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const ids = chats.flatMap((c) => (c.other_participants || []).map((p) => p.id)).filter(Boolean);
    if (ids.length) registerUserIds(ids);
  }, [chats, registerUserIds]);

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const diff = Date.now() - date;
    if (diff < 86400000) return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    if (diff < 604800000) return date.toLocaleDateString("es-ES", { weekday: "short" });
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const filteredChats = searchFilter
    ? chats.filter((c) => chatTitle(c).toLowerCase().includes(searchFilter.toLowerCase()))
    : chats;

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link to="/feed">
              <Button variant="ghost" size="icon" className="rounded-full h-9 w-9"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            <h2 className="text-xl font-bold tracking-tight">Mensajes</h2>
          </div>
          <div className="relative">
            <Button variant="default" size="icon" onClick={() => setShowCreate((s) => !s)} className="rounded-full h-10 w-10 shadow-lg shadow-primary/20" data-testid="new-chat-btn">
              <Plus className={`w-5 h-5 transition-transform ${showCreate ? "rotate-45" : ""}`} />
            </Button>
            <AnimatePresence>
              {showCreate && (
                <>
                  <div className="fixed inset-0 z-[10590]" onClick={() => setShowCreate(false)} />
                  <motion.div initial={{ opacity: 0, y: -6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.96 }} transition={{ duration: 0.16 }}
                    className="no-glass absolute right-0 top-12 z-[10600] w-56 rounded-2xl border shadow-2xl p-1.5" style={{ background: "hsl(var(--card))" }} data-testid="create-menu">
                    <button onClick={() => { setShowCreate(false); onNewChat(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted text-left" data-testid="create-direct-chat-btn">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><MessageCircle className="w-4 h-4" /></span> Nuevo chat
                    </button>
                    <button onClick={() => { setShowCreate(false); onNewGroup(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-muted text-left" data-testid="create-group-btn">
                      <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><UserPlus className="w-4 h-4" /></span> Nuevo grupo
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex gap-1 p-1 rounded-2xl bg-muted/60 mb-3" data-testid="chat-tabs">
          {[{ id: "chats", label: "Chats", Icon: MessageCircle }, { id: "calls", label: "Llamadas", Icon: Phone }].map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`relative flex-1 h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors ${tab === t.id ? "text-foreground" : "text-muted-foreground"}`} data-testid={`chat-tab-${t.id}`}>
              {tab === t.id && <motion.span layoutId="chat-tab-pill" className="absolute inset-0 rounded-xl bg-card shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className="relative flex items-center gap-1.5"><t.Icon className="w-4 h-4" /> {t.label}</span>
            </button>
          ))}
        </div>

        {tab === "chats" && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar conversacion..." className="pl-10 rounded-xl bg-muted/50 border-0 h-10" value={searchFilter} onChange={(e) => setSearchFilter(e.target.value)} data-testid="chat-search-input" />
          </div>
        )}
      </div>

      {tab === "calls" ? (
        <CallsHistory token={token} />
      ) : (
        <div className="flex-1 overflow-y-auto px-2">
          {filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4"><Send className="w-10 h-10 text-primary" /></div>
              <p className="text-muted-foreground text-sm">{searchFilter ? "Sin resultados" : "No tienes conversaciones aun"}</p>
              {!searchFilter && (
                <div className="flex gap-2 mt-4">
                  <Button onClick={onNewChat} className="rounded-full" size="sm">Iniciar chat</Button>
                  <Button onClick={onNewGroup} variant="outline" className="rounded-full" size="sm" data-testid="empty-new-group-btn"><Users className="w-4 h-4 mr-1.5" /> Crear grupo</Button>
                </div>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const isActive = selectedChatId === chat.id;
              const lm = chat.last_message;
              const preview = lm?.message_type === "system" ? lm.content : chat.is_group && lm?.sender?.username ? `${lm.sender.username}: ${lm.content}` : lm?.content;
              return (
                <div key={chat.id} onClick={() => onSelectChat(chat)} className={`flex items-center gap-3 p-3 my-0.5 cursor-pointer rounded-xl transition-all ${isActive ? "bg-primary/10 shadow-sm" : "hover:bg-muted/60"}`} data-testid={`chat-item-${chat.id}`}>
                  <div className="relative flex-shrink-0" data-testid="chat-list-avatar">
                    <ChatAvatar chat={chat} size={48} />
                    {!chat.is_group && <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full ring-2 ring-background z-10" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="font-semibold text-sm truncate flex items-center gap-1.5">
                        {chatTitle(chat)}
                        {chat.is_muted && <BellOff className="w-3 h-3 text-muted-foreground shrink-0" data-testid="chat-muted-icon" />}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{formatTime(chat.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      {lm?.message_type === "audio" && <Mic className="w-3 h-3 shrink-0" />}
                      {lm?.message_type === "image" && <ImageIcon className="w-3 h-3 shrink-0" />}
                      {chat.is_group && !lm && <span>{chat.members_count} participantes</span>}
                      {preview || (!chat.is_group && "Sin mensajes")}
                    </p>
                  </div>
                  {chat.unread_count > 0 && (
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${chat.is_muted ? "bg-muted-foreground/50" : "bg-primary shadow-primary/30"}`}>
                      <span className="text-[10px] text-white font-bold">{chat.unread_count > 9 ? "9+" : chat.unread_count}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ChatList;
