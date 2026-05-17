import React, { useRef } from "react";
import {
  Camera,
  Image as ImageIcon,
  FileText,
  CreditCard,
  Smile,
  X,
  Video
} from "lucide-react";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";

const ATTACHMENT_OPTIONS = [
  { id: "camera", icon: Camera, label: "Camara", color: "bg-red-500", bruno: "photo" },
  { id: "gallery", icon: ImageIcon, label: "Galeria", color: "bg-blue-500", accept: "image/*,video/*" },
  { id: "video", icon: Video, label: "Video", color: "bg-pink-500", bruno: "video" },
  { id: "document", icon: FileText, label: "Documento", color: "bg-purple-500", accept: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv" },
  { id: "card", icon: CreditCard, label: "Tarjeta", color: "bg-green-500" },
  { id: "sticker", icon: Smile, label: "Sticker", color: "bg-orange-500" },
];

export const ChatAttachmentMenu = ({ isOpen, onClose, onFileSelect, onCardPick, onStickerPick, compact = false }) => {
  const fileRefs = useRef({});
  const { open: openBrunoCamera } = useBrunoCamera();

  if (!isOpen) return null;

  const handleOptionClick = (option) => {
    if (option.id === "card") {
      onCardPick?.();
      onClose();
      return;
    }
    if (option.id === "sticker") {
      onStickerPick?.();
      onClose();
      return;
    }
    // Camera and Video options → open Bruno Pro Camera instead of file input
    if (option.bruno) {
      onClose();
      openBrunoCamera({
        mode: option.bruno === "video" ? "video" : (option.bruno === "photo" ? "photo" : "both"),
        onCapture: async (file, meta) => {
          const type = file.type?.startsWith("video") ? "video" : "image";
          onFileSelect?.(file, type, meta);
        },
      });
      return;
    }
    // Other options (gallery/document) → file input
    const input = fileRefs.current[option.id];
    if (input) input.click();
  };

  const handleFileChange = (e, option) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const type = option.id === "document" ? "document" : 
                 file.type?.startsWith("video") ? "video" : "image";
    onFileSelect?.(file, type);
    onClose();
    e.target.value = "";
  };

  const options = compact 
    ? ATTACHMENT_OPTIONS.filter(o => ["camera", "gallery", "document"].includes(o.id))
    : ATTACHMENT_OPTIONS;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/30 backdrop-blur-[2px]" 
        onClick={onClose}
        data-testid="attach-menu-backdrop"
      />
      
      {/* Menu */}
      <div 
        className="fixed bottom-0 left-0 right-0 z-[9999] bg-card rounded-t-3xl shadow-2xl border-t border-border/50 p-4 pb-8 animate-in slide-in-from-bottom duration-200 safe-area-inset-bottom"
        data-testid="attach-menu-drawer"
      >
        {/* Handle */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>
        
        {/* Header */}
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-foreground">Compartir</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            data-testid="attach-menu-close"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        
        {/* Options Grid */}
        <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'} gap-3`}>
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option)}
              className="flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-muted/60 active:scale-95 transition-all touch-manipulation"
              data-testid={`attach-option-${option.id}`}
            >
              <div className={`w-14 h-14 ${option.color} rounded-2xl flex items-center justify-center shadow-lg shadow-black/10`}>
                <option.icon className="w-6 h-6 text-white" />
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">{option.label}</span>
            </button>
          ))}
        </div>

        {/* Hidden file inputs (only for non-bruno options like gallery/document) */}
        {options.filter(o => o.accept && !o.bruno).map((option) => (
          <input
            key={option.id}
            ref={el => fileRefs.current[option.id] = el}
            type="file"
            accept={option.accept}
            className="hidden"
            onChange={(e) => handleFileChange(e, option)}
          />
        ))}
      </div>
    </>
  );
};

export default ChatAttachmentMenu;
