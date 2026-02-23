import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { X, Search } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Default sticker packs
const DEFAULT_STICKER_PACKS = [
  {
    id: "bruno",
    name: "BRUNO",
    icon: "🧡",
    stickers: [
      { id: "bruno_hello", url: "/stickers/bruno_hello.png", emoji: "👋" },
      { id: "bruno_love", url: "/stickers/bruno_love.png", emoji: "❤️" },
      { id: "bruno_laugh", url: "/stickers/bruno_laugh.png", emoji: "😂" },
      { id: "bruno_think", url: "/stickers/bruno_think.png", emoji: "🤔" },
      { id: "bruno_cool", url: "/stickers/bruno_cool.png", emoji: "😎" },
      { id: "bruno_sad", url: "/stickers/bruno_sad.png", emoji: "😢" },
      { id: "bruno_angry", url: "/stickers/bruno_angry.png", emoji: "😤" },
      { id: "bruno_celebrate", url: "/stickers/bruno_celebrate.png", emoji: "🎉" },
    ]
  },
  {
    id: "emojis",
    name: "Emojis HD",
    icon: "😀",
    stickers: [
      { id: "emoji_thumbsup", emoji: "👍", isEmoji: true },
      { id: "emoji_heart", emoji: "❤️", isEmoji: true },
      { id: "emoji_fire", emoji: "🔥", isEmoji: true },
      { id: "emoji_laugh", emoji: "😂", isEmoji: true },
      { id: "emoji_cry", emoji: "😭", isEmoji: true },
      { id: "emoji_star", emoji: "⭐", isEmoji: true },
      { id: "emoji_rocket", emoji: "🚀", isEmoji: true },
      { id: "emoji_clap", emoji: "👏", isEmoji: true },
      { id: "emoji_100", emoji: "💯", isEmoji: true },
      { id: "emoji_think", emoji: "🤔", isEmoji: true },
      { id: "emoji_eyes", emoji: "👀", isEmoji: true },
      { id: "emoji_party", emoji: "🎉", isEmoji: true },
      { id: "emoji_cool", emoji: "😎", isEmoji: true },
      { id: "emoji_ok", emoji: "👌", isEmoji: true },
      { id: "emoji_wave", emoji: "👋", isEmoji: true },
      { id: "emoji_pray", emoji: "🙏", isEmoji: true },
    ]
  },
  {
    id: "reactions",
    name: "Reacciones",
    icon: "💫",
    stickers: [
      { id: "react_wow", emoji: "😮", label: "WOW", isEmoji: true },
      { id: "react_love", emoji: "😍", label: "Me encanta", isEmoji: true },
      { id: "react_haha", emoji: "🤣", label: "Jaja", isEmoji: true },
      { id: "react_sad", emoji: "😢", label: "Triste", isEmoji: true },
      { id: "react_angry", emoji: "😡", label: "Enojado", isEmoji: true },
      { id: "react_mindblown", emoji: "🤯", label: "Increíble", isEmoji: true },
    ]
  },
  {
    id: "business",
    name: "Negocios",
    icon: "💼",
    stickers: [
      { id: "biz_deal", emoji: "🤝", label: "Trato hecho", isEmoji: true },
      { id: "biz_money", emoji: "💰", label: "Dinero", isEmoji: true },
      { id: "biz_chart", emoji: "📈", label: "Crecimiento", isEmoji: true },
      { id: "biz_target", emoji: "🎯", label: "Meta", isEmoji: true },
      { id: "biz_time", emoji: "⏰", label: "Tiempo", isEmoji: true },
      { id: "biz_coffee", emoji: "☕", label: "Café", isEmoji: true },
      { id: "biz_laptop", emoji: "💻", label: "Trabajo", isEmoji: true },
      { id: "biz_phone", emoji: "📱", label: "Llamada", isEmoji: true },
    ]
  }
];

// Sticker Picker Component
export const StickerPicker = ({ isOpen, onClose, onSelect }) => {
  const [activePack, setActivePack] = useState("emojis");
  const [recentStickers, setRecentStickers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Load recent stickers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("bruno_recent_stickers");
    if (saved) {
      try {
        setRecentStickers(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

  // Save to recent when selecting
  const handleSelect = (sticker) => {
    // Add to recent (max 16)
    const newRecent = [sticker, ...recentStickers.filter(s => s.id !== sticker.id)].slice(0, 16);
    setRecentStickers(newRecent);
    localStorage.setItem("bruno_recent_stickers", JSON.stringify(newRecent));
    
    onSelect(sticker);
    onClose();
  };

  if (!isOpen) return null;

  const currentPack = DEFAULT_STICKER_PACKS.find(p => p.id === activePack);
  
  // Filter stickers by search
  const filteredStickers = searchQuery
    ? DEFAULT_STICKER_PACKS.flatMap(pack => 
        pack.stickers.filter(s => 
          s.emoji?.includes(searchQuery) || 
          s.label?.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : currentPack?.stickers || [];

  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-card border rounded-2xl shadow-xl overflow-hidden z-50 animate-in slide-in-from-bottom-2">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold text-sm">Stickers</h3>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-2 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Pack Tabs */}
      {!searchQuery && (
        <div className="flex gap-1 p-2 border-b overflow-x-auto">
          {recentStickers.length > 0 && (
            <button
              onClick={() => setActivePack("recent")}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
                activePack === "recent" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              🕐
            </button>
          )}
          {DEFAULT_STICKER_PACKS.map(pack => (
            <button
              key={pack.id}
              onClick={() => setActivePack(pack.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm transition-colors ${
                activePack === pack.id 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {pack.icon}
            </button>
          ))}
        </div>
      )}

      {/* Stickers Grid */}
      <div className="p-3 max-h-64 overflow-y-auto">
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {(activePack === "recent" ? recentStickers : filteredStickers).map((sticker) => (
            <button
              key={sticker.id}
              onClick={() => handleSelect(sticker)}
              className="aspect-square rounded-xl bg-muted/50 hover:bg-muted flex items-center justify-center text-3xl transition-all hover:scale-110 active:scale-95"
              title={sticker.label}
            >
              {sticker.isEmoji ? (
                sticker.emoji
              ) : sticker.url ? (
                <img 
                  src={sticker.url} 
                  alt={sticker.id}
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.textContent = sticker.emoji || '🖼️';
                  }}
                />
              ) : (
                sticker.emoji
              )}
            </button>
          ))}
        </div>
        
        {filteredStickers.length === 0 && searchQuery && (
          <p className="text-center text-muted-foreground text-sm py-4">
            No se encontraron stickers para "{searchQuery}"
          </p>
        )}
      </div>
    </div>
  );
};

// Sticker Message Display Component
export const StickerMessage = ({ sticker, isOwn }) => {
  if (!sticker) return null;

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`p-2 rounded-2xl ${isOwn ? 'bg-primary/10' : 'bg-muted/50'}`}>
        {sticker.isEmoji ? (
          <span className="text-6xl">{sticker.emoji}</span>
        ) : sticker.url ? (
          <img 
            src={sticker.url}
            alt={sticker.id || "sticker"}
            className="w-24 h-24 object-contain"
          />
        ) : (
          <span className="text-6xl">{sticker.emoji || "🖼️"}</span>
        )}
      </div>
    </div>
  );
};

export default StickerPicker;
