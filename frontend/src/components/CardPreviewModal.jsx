import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, Share2, MapPin, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const CardPreviewModal = ({ card, isOpen, onClose }) => {
  const navigate = useNavigate();
  if (!isOpen || !card) return null;

  const bg = card.background_color || "#FF5A00";
  const fg = card.text_color || "#FFFFFF";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={onClose}
          data-testid="card-preview-overlay"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-[280px] rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-testid="card-preview-modal"
          >
            {/* Banner */}
            <div
              className="h-24 relative"
              style={{ background: card.banner_url ? undefined : `linear-gradient(135deg, ${bg}, ${bg}dd)` }}
            >
              {card.banner_url && (
                <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
              )}
              <button
                onClick={onClose}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-medium text-white bg-black/40 capitalize">
                {card.card_type}
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-card relative">
              {/* Avatar */}
              {card.avatar_url && (
                <div className="absolute -top-7 left-4">
                  <img src={card.avatar_url} alt="" className="w-14 h-14 rounded-full border-3 border-card object-cover shadow-md" />
                </div>
              )}

              <div className={card.avatar_url ? "mt-8" : ""}>
                <h3 className="font-bold text-base truncate">{card.title}</h3>
                {card.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{card.subtitle}</p>}
                {card.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{card.description}</p>}

                {card.location && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2">
                    <MapPin className="w-3 h-3" />
                    <span>{card.location.city || card.location.address}</span>
                  </div>
                )}

                <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                  <Eye className="w-3 h-3" />
                  <span>{card.views || 0} vistas</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  className="flex-1 text-xs h-8"
                  onClick={() => { onClose(); navigate(`/c/${card.id}`); }}
                  data-testid="preview-open-btn"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Abrir
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => {
                  navigator.share?.({ url: `${window.location.origin}/c/${card.id}`, title: card.title });
                }}>
                  <Share2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CardPreviewModal;
