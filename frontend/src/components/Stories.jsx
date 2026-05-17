import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  X, 
  ChevronLeft, 
  ChevronRight,
  Heart,
  Send,
  Eye,
  Pause,
  Play,
  Volume2,
  VolumeX,
  User,
  Camera,
  Loader2,
  BarChart3,
  CheckCircle2,
  Trash2
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Story Circle Component (for feed header)
export const StoryCircle = ({ user, hasUnseen, onClick, isOwn }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 flex-shrink-0"
    data-testid={isOwn ? "story-create-btn" : `story-circle-${user.user_id || 'user'}`}
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
        // error handled
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
        {user && (
          <StoryCircle
            user={{ avatar_url: user.avatar_url }}
            hasUnseen={false}
            isOwn={true}
            onClick={onCreateStory}
          />
        )}
        {storiesData.map((userStories) => (
          <StoryCircle
            key={userStories.user_id}
            user={userStories}
            hasUnseen={userStories.has_unseen}
            onClick={() => setViewingStories(userStories)}
          />
        ))}
      </div>

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

// ==================== POLL DISPLAY IN STORY ====================
const StoryPoll = ({ pollId, token }) => {
  const [poll, setPoll] = useState(null);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pollId) return;
    const fetchPoll = async () => {
      try {
        const res = await axios.get(`${API}/social/polls/${pollId}`);
        setPoll(res.data);
        // Check if user already voted
        if (res.data.voters && token) {
          // We can't easily check here without user id, so we rely on backend error
        }
      } catch (e) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    fetchPoll();
  }, [pollId, token]);

  const handleVote = async (optionIndex) => {
    if (!token || voted) return;
    try {
      const res = await axios.post(`${API}/social/polls/${pollId}/vote`, 
        { option_index: optionIndex },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPoll(res.data);
      setVoted(true);
    } catch (e) {
      if (e.response?.status === 400) setVoted(true); // Already voted
    }
  };

  if (loading || !poll) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-white/60" />
      </div>
    );
  }

  const totalVotes = poll.total_votes || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-2"
      data-testid="story-poll"
    >
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-white" />
        <p className="text-white font-semibold text-sm">{poll.question}</p>
      </div>
      
      {poll.options.map((option, idx) => {
        const pct = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0;
        const showResults = voted || totalVotes > 0;
        
        return (
          <motion.button
            key={idx}
            onClick={(e) => { e.stopPropagation(); handleVote(idx); }}
            disabled={voted}
            className="w-full relative overflow-hidden rounded-xl border border-white/30 backdrop-blur-md transition-all"
            whileTap={!voted ? { scale: 0.97 } : {}}
            data-testid={`poll-option-${idx}`}
          >
            {/* Progress bar background */}
            {showResults && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 bg-white/20"
              />
            )}
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {voted && (
                  <CheckCircle2 className="w-4 h-4 text-white/80" />
                )}
                <span className="text-white text-sm font-medium">{option.text}</span>
              </div>
              {showResults && (
                <span className="text-white/80 text-sm font-bold">{pct}%</span>
              )}
            </div>
          </motion.button>
        );
      })}
      
      <p className="text-white/50 text-xs text-center mt-2">
        {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
      </p>
    </motion.div>
  );
};

// ==================== FULL-SCREEN STORY VIEWER ====================
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

  // Pause timer when story has a poll
  const hasPoll = currentStory?.poll_id;

  // Progress timer
  useEffect(() => {
    if (isPaused || !currentStory || hasPoll) return;

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
  }, [currentIndex, isPaused, duration, hasPoll]);

  // For poll stories, auto-advance after 15s
  useEffect(() => {
    if (!hasPoll || isPaused) return;
    const timeout = setTimeout(() => goNext(), 15000);
    return () => clearTimeout(timeout);
  }, [currentIndex, hasPoll, isPaused]);

  const goNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(0);
    } else {
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
    
    if (x < third) goPrev();
    else if (x > third * 2) goNext();
    else setIsPaused(!isPaused);
  };

  if (!currentStory) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center" data-testid="story-viewer">
      <div className="relative w-full max-w-md h-full" onClick={handleTap}>
        {/* Progress bars */}
        <div className="absolute top-2 left-2 right-2 z-20 flex gap-1">
          {stories.map((_, idx) => (
            <div key={idx} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div 
                className="h-full bg-white rounded-full transition-all"
                style={{ 
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? (hasPoll ? '100%' : `${progress}%`) : '0%'
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
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2" data-testid="story-close-btn">
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
          ) : currentStory.media_type === 'poll' ? (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center" />
          ) : currentStory.media_url ? (
            <img 
              src={currentStory.media_url}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600" />
          )}
        </div>

        {/* Poll overlay */}
        {currentStory.poll_id && (
          <div className="absolute inset-x-0 bottom-24 z-20 px-6" onClick={e => e.stopPropagation()}>
            <StoryPoll pollId={currentStory.poll_id} token={token} />
          </div>
        )}

        {/* Caption */}
        {currentStory.caption && !currentStory.poll_id && (
          <div className="absolute bottom-20 left-4 right-4 z-20">
            <p className="text-white text-center bg-black/30 backdrop-blur-sm rounded-lg px-4 py-2">
              {currentStory.caption}
            </p>
          </div>
        )}

        {/* Footer actions */}
        {!currentStory.poll_id && (
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
        )}

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

// ==================== CREATE STORY MODAL (with Poll support) ====================
export const CreateStoryModal = ({ isOpen, onClose, onCreated }) => {
  const { token } = useAuth();
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image');
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Poll mode
  const [mode, setMode] = useState('media'); // 'media' or 'poll'
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Upload to server
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const response = await axios.post(`${API}/upload/image`, formData, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" }
      });
      setMediaUrl(response.data.url);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    } catch (err) {
      // Fallback to local URL
      const url = URL.createObjectURL(file);
      setMediaUrl(url);
      setMediaType(file.type.startsWith('video') ? 'video' : 'image');
    }
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions([...pollOptions, '']);
  };

  const removePollOption = (idx) => {
    if (pollOptions.length > 2) setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  const updatePollOption = (idx, value) => {
    const newOpts = [...pollOptions];
    newOpts[idx] = value;
    setPollOptions(newOpts);
  };

  const handleCreate = async () => {
    if (!token) return;
    
    if (mode === 'poll') {
      // Validate poll
      const validOptions = pollOptions.filter(o => o.trim());
      if (!pollQuestion.trim() || validOptions.length < 2) return;

      setLoading(true);
      try {
        // Create poll first
        const pollRes = await axios.post(`${API}/social/polls`, {
          question: pollQuestion.trim(),
          options: validOptions,
          duration_hours: 24
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Create story with poll_id
        await axios.post(`${API}/stories`, {
          media_url: "",
          media_type: "poll",
          caption: pollQuestion.trim(),
          visibility,
          duration: 15,
          poll_id: pollRes.data.id
        }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        onCreated?.();
        resetAndClose();
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    } else {
      if (!mediaUrl) return;
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
        resetAndClose();
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    }
  };

  const resetAndClose = () => {
    setMediaUrl('');
    setMediaType('image');
    setCaption('');
    setMode('media');
    setPollQuestion('');
    setPollOptions(['', '']);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" data-testid="create-story-modal">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-bold">Nueva historia</h2>
          <Button variant="ghost" size="icon" onClick={resetAndClose} data-testid="create-story-close">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Mode selector */}
        <div className="flex border-b">
          <button
            onClick={() => setMode('media')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'media' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            data-testid="story-mode-media"
          >
            <Camera className="w-4 h-4 inline-block mr-1.5" />
            Foto/Video
          </button>
          <button
            onClick={() => setMode('poll')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'poll' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
            data-testid="story-mode-poll"
          >
            <BarChart3 className="w-4 h-4 inline-block mr-1.5" />
            Encuesta
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {mode === 'media' ? (
              <motion.div key="media" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-4">
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
                
                <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileSelect} />
                <input
                  type="text"
                  placeholder="Agregar texto..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-3 bg-muted rounded-lg"
                  data-testid="story-caption-input"
                />
              </motion.div>
            ) : (
              <motion.div key="poll" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                {/* Poll preview */}
                <div className="aspect-[9/16] max-h-80 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-xl overflow-hidden flex items-center justify-center p-6">
                  <div className="w-full space-y-3">
                    <div className="flex items-center gap-2 justify-center mb-2">
                      <BarChart3 className="w-5 h-5 text-white" />
                      <span className="text-white font-bold">Encuesta</span>
                    </div>
                    <p className="text-white text-center font-semibold text-sm">
                      {pollQuestion || "Tu pregunta aqui..."}
                    </p>
                    {pollOptions.filter(o => o).map((opt, i) => (
                      <div key={i} className="bg-white/20 backdrop-blur rounded-xl px-4 py-2.5 text-white text-sm text-center">
                        {opt || `Opción ${i + 1}`}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Poll form */}
                <Input
                  placeholder="Escribe tu pregunta..."
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  className="font-medium"
                  data-testid="poll-question-input"
                />
                
                <div className="space-y-2">
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        placeholder={`Opción ${idx + 1}`}
                        value={opt}
                        onChange={(e) => updatePollOption(idx, e.target.value)}
                        data-testid={`poll-option-input-${idx}`}
                      />
                      {pollOptions.length > 2 && (
                        <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => removePollOption(idx)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 4 && (
                    <Button variant="outline" size="sm" className="w-full" onClick={addPollOption} data-testid="poll-add-option">
                      <Plus className="w-4 h-4 mr-1" /> Agregar opción
                    </Button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  data-testid={`story-visibility-${opt.id}`}
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
            disabled={
              loading || 
              (mode === 'media' && !mediaUrl) || 
              (mode === 'poll' && (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2))
            }
            onClick={handleCreate}
            data-testid="story-publish-btn"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {mode === 'poll' ? 'Publicar encuesta' : 'Publicar historia'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

export default StoriesRow;
