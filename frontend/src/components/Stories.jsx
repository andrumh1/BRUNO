import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Heart,
  Send,
  MoreVertical,
  Eye,
  Pause,
  Play,
  Volume2,
  VolumeX,
  User,
  Camera,
  Image as ImageIcon,
  Loader2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Story Circle Component (for feed header)
export const StoryCircle = ({ user, hasUnseen, onClick, isOwn }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 flex-shrink-0"
  >
    <div className={`w-16 h-16 rounded-full p-0.5 ${
      hasUnseen 
        ? 'bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500' 
        : isOwn 
          ? 'bg-muted' 
          : 'bg-gray-300'
    }`}>
      <div className="w-full h-full rounded-full bg-background p-0.5">
        <div className="w-full h-full rounded-full overflow-hidden bg-muted relative">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          {isOwn && (
            <div className="absolute bottom-0 right-0 w-5 h-5 bg-primary rounded-full flex items-center justify-center border-2 border-background">
              <Plus className="w-3 h-3 text-white" />
            </div>
          )}
        </div>
      </div>
    </div>
    <span className="text-xs truncate w-16 text-center">
      {isOwn ? "Tu historia" : user.user_name?.split(' ')[0] || "Usuario"}
    </span>
  </button>
);

// Stories Row Component (horizontal scroll)
export const StoriesRow = ({ onCreateStory }) => {
  const { user, token } = useAuth();
  const [storiesData, setStoriesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingStories, setViewingStories] = useState(null);

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const response = await axios.get(`${API}/stories/feed`, { headers });
        setStoriesData(response.data);
      } catch (error) {
        console.error("Error fetching stories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStories();
  }, [token]);

  if (loading) {
    return (
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="w-16 h-16 rounded-full bg-muted animate-pulse flex-shrink-0" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide">
        {/* Create story button (own) */}
        {user && (
          <StoryCircle
            user={{ avatar_url: user.avatar_url }}
            hasUnseen={false}
            isOwn={true}
            onClick={onCreateStory}
          />
        )}
        
        {/* Other users' stories */}
        {storiesData.map((userStories) => (
          <StoryCircle
            key={userStories.user_id}
            user={userStories}
            hasUnseen={userStories.has_unseen}
            onClick={() => setViewingStories(userStories)}
          />
        ))}
      </div>

      {/* Story Viewer */}
      {viewingStories && (
        <StoryViewer
          userStories={viewingStories}
          allUsers={storiesData}
          onClose={() => setViewingStories(null)}
          onNavigate={(newUser) => setViewingStories(newUser)}
        />
      )}
    </>
  );
};

// Full-screen Story Viewer
export const StoryViewer = ({ userStories, allUsers, onClose, onNavigate }) => {
  const { token, user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef(null);
  const timerRef = useRef(null);

  const stories = userStories.stories || [];
  const currentStory = stories[currentIndex];
  const duration = (currentStory?.duration || 5) * 1000;

  // Mark as viewed
  useEffect(() => {
    if (!currentStory || !token) return;
    
    axios.post(`${API}/stories/${currentStory.id}/view`, {}, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(() => {});
  }, [currentStory, token]);

  // Progress timer
  useEffect(() => {
    if (isPaused || !currentStory) return;

    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        goNext();
      } else {
        timerRef.current = requestAnimationFrame(animate);
      }
    };
    
    timerRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [currentIndex, isPaused, duration]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
      // Go to next user
      const currentUserIndex = allUsers.findIndex(u => u.user_id === userStories.user_id);
      if (currentUserIndex < allUsers.length - 1) {
        onNavigate(allUsers[currentUserIndex + 1]);
      } else {
        onClose();
      }
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setProgress(0);
    } else {
      // Go to previous user
      const currentUserIndex = allUsers.findIndex(u => u.user_id === userStories.user_id);
      if (currentUserIndex > 0) {
        onNavigate(allUsers[currentUserIndex - 1]);
      }
    }
  };

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;
    
    if (x < third) {
      goPrev();
    } else if (x > third * 2) {
      goNext();
    } else {
      setIsPaused(!isPaused);
    }
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Story container */}
      <div className="relative w-full max-w-md h-full" onClick={handleTap}>
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-0 right-0 z-20 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-muted">
              {userStories.avatar_url ? (
                <img src={userStories.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{userStories.user_name}</p>
              <p className="text-white/60 text-xs">
                {new Date(currentStory.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused); }} className="p-2">
              {isPaused ? <Play className="w-5 h-5 text-white" /> : <Pause className="w-5 h-5 text-white" />}
            </button>
            {currentStory.media_type === 'video' && (
              <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} className="p-2">
                {isMuted ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="h-full flex items-center justify-center">
          {currentStory.media_type === 'video' ? (
            <video
              ref={videoRef}
              src={currentStory.media_url}
              className="max-h-full max-w-full object-contain"
              autoPlay
              loop
              muted={isMuted}
              playsInline
            />
          ) : (
            <img 
              src={currentStory.media_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          )}
        </div>

        {/* Caption */}
        {currentStory.caption && (
          <div className="absolute bottom-20 left-4 right-4 z-20">
            <p className="text-white text-center bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Footer actions */}
        <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3">
          <input
            type="text"
            placeholder="Enviar mensaje..."
            className="flex-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 text-white placeholder:text-white/50 text-sm"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="p-2 text-white hover:text-red-400 transition-colors">
            <Heart className="w-6 h-6" />
          </button>
          <button className="p-2 text-white">
            <Send className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation arrows (desktop) */}
        <button 
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full text-white hidden md:block hover:bg-black/50"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/30 rounded-full text-white hidden md:block hover:bg-black/50"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

// Create Story Modal
export const CreateStoryModal = ({ isOpen, onClose, onCreated }) => {
  const { token } = useAuth();
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For demo, just create a local URL
    // In production, upload to server/cloudinary
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setMediaType(file.type.startsWith('video') ? 'video' : 'image');
  };

  const handleCreate = async () => {
    if (!mediaUrl || !token) return;
    
    setLoading(true);
    try {
      await axios.post(`${API}/stories`, {
        media_url: mediaUrl,
        media_type: mediaType,
        caption,
        visibility,
        duration: mediaType === 'video' ? 15 : 5
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onCreated?.();
      onClose();
    } catch (error) {
      console.error("Error creating story:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold">Nueva historia</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Media Preview */}
          <div 
            className="aspect-[9/16] max-h-80 bg-muted rounded-xl overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {mediaUrl ? (
              mediaType === 'video' ? (
                <video src={mediaUrl} className="max-h-full max-w-full object-contain" controls />
              ) : (
                <img src={mediaUrl} alt="" className="max-h-full max-w-full object-contain" />
              )
            ) : (
              <div className="text-center">
                <Camera className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">Toca para agregar foto o video</p>
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

          {/* Caption */}
          <input
            type="text"
            placeholder="Agregar texto..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="w-full p-3 bg-muted rounded-lg"
          />

          {/* Visibility */}
          <div>
            <label className="text-sm font-medium mb-2 block">¿Quién puede ver?</label>
            <div className="flex gap-2">
              {[
                { id: "public", label: "Todos" },
                { id: "followers", label: "Seguidores" },
                { id: "private", label: "Solo yo" }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setVisibility(opt.id)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm transition-colors ${
                    visibility === opt.id ? 'bg-primary text-white' : 'bg-muted'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t">
          <Button 
            className="w-full" 
            disabled={!mediaUrl || loading}
            onClick={handleCreate}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Publicar historia
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StoriesRow;
