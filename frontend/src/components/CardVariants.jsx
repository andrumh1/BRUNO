import React from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageCircle, Eye, Star, Verified } from "lucide-react";
import { Button } from "@/components/ui/button";

// Mini Card - Para mapas y selecciones rápidas
export const MiniCard = ({ card, onClick, showDistance, distance }) => {
  return (
    <div 
      className="flex items-center gap-3 p-2 bg-card rounded-xl border border-border hover:shadow-lg transition-all cursor-pointer"
      onClick={onClick}
    >
      {/* Avatar */}
      {card.avatar_url ? (
        <div className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0" style={{ borderColor: card.background_color }}>
          <img 
            src={card.avatar_url} 
            alt={card.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div 
          className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: card.background_color, color: card.text_color }}
        >
          {card.title?.charAt(0) || "?"}
        </div>
      )}
      
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{card.title}</p>
        <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>
      </div>
      
      {/* Distance badge */}
      {showDistance && distance && (
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-xs font-medium text-primary">
          <MapPin className="w-3 h-3" />
          {distance}
        </div>
      )}
    </div>
  );
};

// Medium Card - Para listados y grids
export const MediumCard = ({ card, onChat, onView }) => {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden hover:shadow-xl transition-all group">
      {/* Banner */}
      <div className="h-24 relative overflow-hidden">
        {card.banner_url ? (
          <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.background_color}, ${card.background_color}cc)` }} />
        )}
        {/* Type badge */}
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-[10px] font-medium text-white capitalize">
          {card.card_type}
        </div>
        
        {/* Verified badge */}
        {card.is_verified && (
          <div className="absolute top-2 left-2">
            <Verified className="w-5 h-5 text-blue-400" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="p-4 -mt-8 relative">
        {/* Avatar */}
        <div className="flex items-end gap-3 mb-3">
          {card.avatar_url ? (
            <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-background shadow-lg flex-shrink-0">
              <img 
                src={card.avatar_url} 
                alt={card.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-xl font-bold border-4 border-background shadow-lg flex-shrink-0"
              style={{ backgroundColor: card.background_color, color: card.text_color }}
            >
              {card.title?.charAt(0) || "?"}
            </div>
          )}
          
          {/* Rating */}
          {card.rating && (
            <div className="flex items-center gap-1 text-sm">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{card.rating}</span>
            </div>
          )}
        </div>
        
        {/* Info */}
        <h3 className="font-bold text-base mb-1 truncate">{card.title}</h3>
        {card.subtitle && (
          <p className="text-sm text-muted-foreground mb-2 truncate">{card.subtitle}</p>
        )}
        
        {/* Location */}
        {card.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{card.location.place_name}</span>
          </div>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {card.views || 0}
          </span>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1"
            onClick={() => onView?.(card)}
          >
            Ver
          </Button>
          <Button 
            size="sm"
            className="flex-1"
            style={{ backgroundColor: card.background_color }}
            onClick={() => onChat?.(card)}
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            Chat
          </Button>
        </div>
      </div>
    </div>
  );
};

// Large Card - Presentación completa
export const LargeCard = ({ card, onChat, onShare, onSave }) => {
  return (
    <div className="bg-card rounded-3xl border border-border overflow-hidden shadow-xl">
      {/* Banner */}
      <div className="h-48 md:h-64 relative overflow-hidden">
        {card.banner_url ? (
          <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.background_color}, ${card.background_color}99)` }} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Type & Verified badges */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-medium text-white capitalize">
            {card.card_type}
          </div>
          {card.is_verified && (
            <div className="p-1.5 bg-blue-500 rounded-full">
              <Verified className="w-4 h-4 text-white" />
            </div>
          )}
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 -mt-20 relative">
        {/* Avatar */}
        <div className="flex items-end gap-4 mb-4">
          {card.avatar_url ? (
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-background shadow-xl flex-shrink-0">
              <img 
                src={card.avatar_url} 
                alt={card.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold border-4 border-background shadow-xl flex-shrink-0"
              style={{ backgroundColor: card.background_color, color: card.text_color }}
            >
              {card.title?.charAt(0) || "?"}
            </div>
          )}
          
          {/* Quick actions */}
          <div className="flex-1 flex justify-end gap-2">
            <Button 
              size="lg"
              className="shadow-lg"
              style={{ backgroundColor: card.background_color }}
              onClick={() => onChat?.(card)}
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Enviar Mensaje
            </Button>
          </div>
        </div>
        
        {/* Info */}
        <h1 className="text-2xl font-bold mb-1">{card.title}</h1>
        {card.subtitle && (
          <p className="text-lg text-muted-foreground mb-2">{card.subtitle}</p>
        )}
        
        {card.description && (
          <p className="text-sm text-muted-foreground mb-4 line-clamp-3">{card.description}</p>
        )}
        
        {/* Location */}
        {card.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-xl">
            <MapPin className="w-4 h-4 text-primary" />
            <div>
              <p className="font-medium">{card.location.place_name}</p>
              <p className="text-xs">{card.location.address}</p>
            </div>
          </div>
        )}
        
        {/* Stats */}
        <div className="flex items-center gap-6 py-4 border-t border-border">
          <div className="text-center">
            <p className="text-2xl font-bold">{card.views || 0}</p>
            <p className="text-xs text-muted-foreground">Vistas</p>
          </div>
          {card.rating && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                <span className="text-2xl font-bold">{card.rating}</span>
              </div>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          )}
          {card.followers_count !== undefined && (
            <div className="text-center">
              <p className="text-2xl font-bold">{card.followers_count}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
          )}
        </div>
        
        {/* Social Links */}
        {card.social_links?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-border">
            {card.social_links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-muted rounded-full hover:bg-muted/80 transition-colors"
              >
                <span className="text-sm">{link.platform}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Map Marker Card - Para usar en el mapa estilo Snapchat
export const MapMarkerCard = ({ card, isSelected, onClick }) => {
  return (
    <div 
      className={`relative cursor-pointer transition-all duration-300 ${
        isSelected ? "scale-125 z-50" : "scale-100 hover:scale-110"
      }`}
      onClick={onClick}
    >
      {/* Avatar bubble */}
      <div 
        className="w-12 h-12 rounded-full border-3 shadow-lg overflow-hidden"
        style={{ borderColor: card.background_color }}
      >
        {card.avatar_url ? (
          <img src={card.avatar_url} alt={card.title} className="w-full h-full object-cover" />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: card.background_color, color: card.text_color }}
          >
            {card.title?.charAt(0) || "?"}
          </div>
        )}
      </div>
      
      {/* Pointer */}
      <div 
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent"
        style={{ borderTopColor: card.background_color }}
      />
      
      {/* Name tooltip on hover/select */}
      {isSelected && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-card rounded-full shadow-lg whitespace-nowrap">
          <p className="text-xs font-medium">{card.title}</p>
        </div>
      )}
    </div>
  );
};

export default { MiniCard, MediumCard, LargeCard, MapMarkerCard };
