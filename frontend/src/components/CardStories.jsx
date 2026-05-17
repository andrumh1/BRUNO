import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Eye,
  Edit2,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  DollarSign,
  Link as LinkIcon,
  Loader2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Card Story Item (single catalog item)
const CardStoryItem = ({ story, onClick, isEditing, onEdit, onDelete }) => (
  <div className="flex-shrink-0 w-32 snap-start">
    <div 
      className="relative aspect-[3/4] rounded-xl overflow-hidden bg-muted cursor-pointer group"
      onClick={onClick}
    >
      {story.media_type === 'video' ? (
        <video 
          src={story.media_url} 
          className="w-full h-full object-cover"
          muted
        />
      ) : (
        <img 
          src={story.media_url} 
          alt={story.title || ''} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
        />
      )}
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      
      {/* Info */}
      <div className="absolute bottom-2 left-2 right-2">
        {story.price && (
          <p className="text-white font-bold text-sm">${story.price}</p>
        )}
        {story.title && (
          <p className="text-white/90 text-xs line-clamp-1">{story.title}</p>
        )}
      </div>
      
      {/* Views */}
      <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/50 rounded-full flex items-center gap-1">
        <Eye className="w-3 h-3 text-white" />
        <span className="text-white text-xs">{story.views || 0}</span>
      </div>

      {/* Edit/Delete buttons */}
      {isEditing && (
        <div className="absolute top-2 left-2 flex gap-1">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit?.(story); }}
            className="p-1.5 bg-white rounded-full shadow-lg"
          >
            <Edit2 className="w-3 h-3 text-gray-700" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete?.(story.id); }}
            className="p-1.5 bg-red-500 rounded-full shadow-lg"
          >
            <Trash2 className="w-3 h-3 text-white" />
          </button>
        </div>
      )}
    </div>
  </div>
);

// Card Stories Gallery (horizontal carousel)
export const CardStoriesGallery = ({ cardId, isOwner = false }) => {
  const { token } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const response = await axios.get(`${API}/stories/card/${cardId}`);
        setStories(response.data);
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    if (cardId) fetchStories();
  }, [cardId]);

  const handleDelete = async (storyId) => {
    if (!token || !confirm('¿Eliminar esta historia?')) return;
    
    try {
      await axios.delete(`${API}/stories/card/${storyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStories(prev => prev.filter(s => s.id !== storyId));
    } catch (error) {
      // error handled
    }
  };

  const handleStoryAdded = (newStory) => {
    setStories(prev => [...prev, newStory]);
    setShowAddModal(false);
  };

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {[1,2,3].map(i => (
          <div key={i} className="w-32 aspect-[3/4] rounded-xl bg-muted animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  if (stories.length === 0 && !isOwner) return null;

  return (
    <div className="relative">
      {/* Header */}
      {(stories.length > 0 || isOwner) && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">
            {stories.length > 0 ? 'Catálogo' : 'Agrega tu catálogo'}
          </h3>
          {isOwner && (
            <div className="flex gap-2">
              {stories.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  {isEditing ? 'Listo' : 'Editar'}
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Agregar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Gallery */}
      {stories.length > 0 && (
        <div className="relative group">
          {/* Scroll buttons */}
          {stories.length > 3 && (
            <>
              <button 
                onClick={() => scroll('left')}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={() => scroll('right')}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 bg-white/90 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {/* Stories scroll */}
          <div 
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          >
            {stories.map((story, index) => (
              <CardStoryItem
                key={story.id}
                story={story}
                onClick={() => { setViewerIndex(index); setViewerOpen(true); }}
                isEditing={isEditing}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state for owner */}
      {stories.length === 0 && isOwner && (
        <div 
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setShowAddModal(true)}
        >
          <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Agrega fotos de tus productos o servicios
          </p>
        </div>
      )}

      {/* Viewer */}
      {viewerOpen && (
        <CardStoryViewer
          stories={stories}
          initialIndex={viewerIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddCardStoryModal
          cardId={cardId}
          onClose={() => setShowAddModal(false)}
          onAdded={handleStoryAdded}
        />
      )}
    </div>
  );
};

// Full-screen Card Story Viewer
const CardStoryViewer = ({ stories, initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const story = stories[currentIndex];

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!story) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 z-20 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Counter */}
      <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-white/10 rounded-full text-white text-sm">
        {currentIndex + 1} / {stories.length}
      </div>

      {/* Navigation */}
      {currentIndex > 0 && (
        <button 
          onClick={goPrev}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {currentIndex < stories.length - 1 && (
        <button 
          onClick={goNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-2 bg-white/10 rounded-full text-white hover:bg-white/20"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Media */}
      <div className="max-w-4xl max-h-full p-4">
        {story.media_type === 'video' ? (
          <video 
            src={story.media_url}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
            controls
            autoPlay
          />
        ) : (
          <img 
            src={story.media_url}
            alt={story.title || ''}
            className="max-h-[80vh] max-w-full object-contain rounded-lg"
          />
        )}
      </div>

      {/* Info bar */}
      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
        <div className="max-w-4xl mx-auto">
          {story.price && (
            <p className="text-white text-2xl font-bold">${story.price}</p>
          )}
          {story.title && (
            <h3 className="text-white text-xl font-semibold mt-1">{story.title}</h3>
          )}
          {story.description && (
            <p className="text-white/80 mt-2">{story.description}</p>
          )}
          {story.link_url && (
            <a 
              href={story.link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-white text-black rounded-full font-medium hover:bg-white/90"
            >
              <LinkIcon className="w-4 h-4" />
              Ver más
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

// Add Card Story Modal
const AddCardStoryModal = ({ cardId, onClose, onAdded }) => {
  const { token } = useAuth();
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
  };

  const handleCreate = async () => {
    if (!mediaUrl || !token) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/stories/card`, {
        card_id: cardId,
        media_url: mediaUrl,
        media_type: mediaType,
        title: title || null,
        description: description || null,
        price: price ? parseFloat(price) : null,
        link_url: linkUrl || null
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onAdded?.({
        id: response.data.id,
        media_url: mediaUrl,
        media_type: mediaType,
        title,
        description,
        price: price ? parseFloat(price) : null,
        link_url: linkUrl,
        views: 0
      });
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-card z-10">
          <h2 className="font-bold">Agregar al catálogo</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Media */}
          <div 
            className="aspect-video bg-muted rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {mediaUrl ? (
              mediaType === 'video' ? (
                <video src={mediaUrl} className="w-full h-full object-cover" />
              ) : (
                <img src={mediaUrl} alt="" className="w-full h-full object-cover" />
              )
            ) : (
              <div className="text-center">
                <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Agregar imagen o video</p>
              </div>
            )}
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Title */}
          <input
            type="text"
            placeholder="Nombre del producto/servicio"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 bg-muted rounded-lg"
          />

          {/* Description */}
          <textarea
            placeholder="Descripción (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 bg-muted rounded-lg resize-none"
            rows={2}
          />

          {/* Price */}
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="number"
              placeholder="Precio (opcional)"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full p-3 pl-9 bg-muted rounded-lg"
            />
          </div>

          {/* Link */}
          <div className="relative">
            <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="url"
              placeholder="Enlace externo (opcional)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="w-full p-3 pl-9 bg-muted rounded-lg"
            />
          </div>
        </div>

        <div className="p-4 border-t sticky bottom-0 bg-card">
          <Button 
            className="w-full" 
            disabled={!mediaUrl || loading}
            onClick={handleCreate}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Agregar al catálogo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CardStoriesGallery;
