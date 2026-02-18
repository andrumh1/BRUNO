import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { 
  Image as ImageIcon, 
  Video, 
  Send, 
  X,
  Loader2,
  CreditCard
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreatePost = ({ onPostCreated, userCards = [] }) => {
  const { user, token } = useAuth();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    
    for (const file of files) {
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
        setMedia(prev => [...prev, {
          type: mediaType,
          url: response.data.url
        }]);
      } catch (error) {
        console.error("Error uploading file:", error);
        alert("Error al subir archivo");
      }
    }
    
    setUploading(false);
    e.target.value = "";
  };

  const removeMedia = (index) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!content.trim() && media.length === 0 && !selectedCard) {
      return;
    }
    
    setPosting(true);
    
    try {
      const postData = {
        content: content.trim(),
        media: media,
        post_type: selectedCard ? "card_share" : media.length > 0 ? (media[0].type === "video" ? "video" : "image") : "text",
        card_id: selectedCard?.id || null,
        visibility: "public",
        hashtags: content.match(/#\w+/g)?.map(h => h.slice(1)) || []
      };
      
      const response = await axios.post(`${API}/posts`, postData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Clear form
      setContent("");
      setMedia([]);
      setSelectedCard(null);
      
      if (onPostCreated) {
        onPostCreated(response.data);
      }
    } catch (error) {
      console.error("Error creating post:", error);
      alert("Error al crear publicación");
    } finally {
      setPosting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            {/* Avatar */}
            <div className="shrink-0">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {(user.username || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
            
            {/* Input Area */}
            <div className="flex-1 space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="¿Qué está pasando?"
                className="w-full min-h-[80px] bg-transparent border-none outline-none resize-none text-base placeholder:text-muted-foreground"
                rows={2}
              />
              
              {/* Media Preview */}
              {media.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {media.map((item, index) => (
                    <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                      {item.type === "image" ? (
                        <img src={item.url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(index)}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Selected Card Preview */}
              {selectedCard && (
                <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span className="text-sm flex-1">{selectedCard.title}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCard(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="text-primary"
                  >
                    {uploading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-5 h-5" />
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      fileInputRef.current.accept = "video/*";
                      fileInputRef.current?.click();
                    }}
                    disabled={uploading}
                    className="text-primary"
                  >
                    <Video className="w-5 h-5" />
                  </Button>
                  
                  {userCards.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowCardPicker(!showCardPicker)}
                      className="text-primary"
                    >
                      <CreditCard className="w-5 h-5" />
                    </Button>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  disabled={posting || (!content.trim() && media.length === 0 && !selectedCard)}
                  className="rounded-full px-5"
                >
                  {posting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Publicar
                    </>
                  )}
                </Button>
              </div>
              
              {/* Card Picker */}
              {showCardPicker && userCards.length > 0 && (
                <div className="border rounded-lg p-2 space-y-1">
                  <p className="text-xs text-muted-foreground mb-2">Compartir una tarjeta:</p>
                  {userCards.map((card) => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setSelectedCard(card);
                        setShowCardPicker(false);
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-muted text-left"
                    >
                      {card.avatar_url ? (
                        <img src={card.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs">
                          {card.title[0]}
                        </div>
                      )}
                      <span className="text-sm font-medium">{card.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default CreatePost;
