import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  X, 
  Search, 
  CreditCard,
  Share2,
  Check,
  Building2,
  User,
  Briefcase,
  Loader2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Card type icons
const CARD_TYPE_ICONS = {
  personal: User,
  professional: Briefcase,
  business: Building2,
  services: CreditCard
};

// Card Picker Modal
export const CardPicker = ({ isOpen, onClose, onSelect }) => {
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen || !token) return;
    
    const fetchCards = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API}/cards`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCards(response.data);
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    fetchCards();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const filteredCards = searchQuery 
    ? cards.filter(c => 
        c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.subtitle?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : cards;

  const handleSelect = () => {
    if (selectedCard) {
      onSelect(selectedCard);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col animate-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Compartir tarjeta</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar tarjeta..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Cards List */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredCards.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">
                {searchQuery ? "No se encontraron tarjetas" : "No tienes tarjetas aún"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCards.map((card) => {
                const Icon = CARD_TYPE_ICONS[card.type] || CreditCard;
                const isSelected = selectedCard?.id === card.id;
                
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                      isSelected 
                        ? "bg-primary/10 border-2 border-primary" 
                        : "bg-muted/50 hover:bg-muted border-2 border-transparent"
                    }`}
                  >
                    {/* Card Preview */}
                    <div 
                      className="w-16 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: card.primary_color || "#f97316" }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    
                    {/* Card Info */}
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium truncate">{card.title || "Sin título"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {card.subtitle || card.type}
                      </p>
                    </div>
                    
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <Button
            className="w-full"
            disabled={!selectedCard}
            onClick={handleSelect}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartir tarjeta
          </Button>
        </div>
      </div>
    </div>
  );
};

// Card Message Preview (shown in chat)
export const CardMessagePreview = ({ card, isOwn, onClick }) => {
  if (!card) return null;

  // Support both card_type (from attachment) and type (from direct card object)
  const cardType = card.card_type || card.type;
  const cardTitle = card.card_title || card.title;
  const cardSubtitle = card.card_subtitle || card.subtitle;
  
  const Icon = CARD_TYPE_ICONS[cardType] || CreditCard;

  return (
    <div 
      className={`max-w-[280px] rounded-2xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity ${
        isOwn ? "bg-primary text-white" : "bg-card border shadow-sm"
      }`}
      onClick={onClick}
      data-testid="card-message-preview"
    >
      {/* Card Header with gradient */}
      <div 
        className="h-16 flex items-center justify-center relative"
        style={{ 
          background: `linear-gradient(135deg, ${card.primary_color || "#f97316"}, ${card.secondary_color || "#ea580c"})`
        }}
      >
        <Icon className="w-8 h-8 text-white/80" />
        <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 rounded-full">
          <span className="text-[10px] text-white font-medium uppercase">
            {cardType}
          </span>
        </div>
      </div>
      
      {/* Card Content */}
      <div className="p-3">
        <h4 className={`font-semibold text-sm truncate ${isOwn ? "text-white" : ""}`}>
          {cardTitle || "Tarjeta de presentación"}
        </h4>
        {cardSubtitle && (
          <p className={`text-xs truncate mt-0.5 ${isOwn ? "text-white/70" : "text-muted-foreground"}`}>
            {cardSubtitle}
          </p>
        )}
        
        {/* View button */}
        <div className={`mt-2 text-xs font-medium flex items-center gap-1 ${isOwn ? "text-white/80" : "text-primary"}`}>
          <CreditCard className="w-3 h-3" />
          Ver tarjeta completa
        </div>
      </div>
    </div>
  );
};

export default CardPicker;
