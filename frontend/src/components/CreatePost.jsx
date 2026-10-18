import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ensureTextStyleFonts } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import { isVideoFile, videoTooLarge, videoTooLargeMsg, setVideoLimit } from "@/lib/media";
import { uploadVideoDirect, getUploadLimits } from "@/lib/videoUpload";
import { takePendingMedia } from "@/lib/pendingMedia";
import TextStylePicker from "@/components/TextStylePicker";
import { TEXT_BGS, TEXT_FONTS } from "@/lib/textStyles";
import { 
  Image as ImageIcon, 
  Video, 
  Send, 
  X,
  Loader2,
  CreditCard,
  AtSign,
  Palette,
  CalendarClock
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CreatePost = ({ onPostCreated, userCards = [] }) => {
  ensureTextStyleFonts();
  const { user, token } = useAuth();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState([]);
  const [aspect, setAspect] = useState("4:5"); // estándar BRUNO: 1:1 1080×1080 · 4:5 1080×1350 · 9:16 1080×1920
  const [uploading, setUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(null);
  const [posting, setPosting] = useState(false);
  const [showCardPicker, setShowCardPicker] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [textStyle, setTextStyle] = useState({ bg: TEXT_BGS[0].id, font: TEXT_FONTS[0].id, align: "center", emoji: null });
  const [showStyle, setShowStyle] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const minSchedule = new Date(Date.now() + 15 * 60000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // @Mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionStart, setMentionStart] = useState(-1);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).get("import")) return;
    const p = takePendingMedia(); if (p?.file) handleFileSelect({ target: { files: [p.file] } });
    // eslint-disable-next-line
  }, []);
  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    setUploading(true);
    for (const file of files) {
      const isVideo = isVideoFile(file);
      if (isVideo) {
        const lim = await getUploadLimits(token).catch(() => null);
        if (lim?.video_max_bytes) setVideoLimit(lim.video_max_bytes);
      }
      if (videoTooLarge(file)) {
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.error("Video demasiado grande", { description: videoTooLargeMsg() });
        continue;
      }
      try {
        let data;
        if (isVideo) {
          data = await uploadVideoDirect(file, { token, onProgress: (p) => setVideoProgress(p) });
          setVideoProgress(null);
        } else {
          const formData = new FormData();
          formData.append("file", file);
          const response = await axios.post(`${API}/upload/image?aspect=${encodeURIComponent(aspect)}`, formData, {
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" },
            timeout: 0,
          });
          data = response.data;
        }
        const mediaType = isVideo ? "video" : "image";
        setMedia(prev => [...prev, {
          type: mediaType,
          url: data.url,
          width: data.width || null,
          height: data.height || null,
          mp4_url: data.mp4_url || null,
          f_auto_url: data.f_auto_url || null,
          poster_url: data.poster_url || null,
          hls_url: data.hls_url || null,
          duration: data.duration || null,
          original_url: data.original_url || data.url,
        }]);
      } catch (error) {
        setVideoProgress(null);
        const { brunoToast } = await import("@/components/bruno/BrunoToast");
        brunoToast.error("No se pudo subir el archivo", { description: error?.userMessage || error?.response?.data?.detail || file.name });
      }
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeMedia = (index) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  // Detect @mention typing
  const handleContentChange = useCallback((e) => {
    const value = e.target.value;
    setContent(value);

    const cursorPos = e.target.selectionStart;
    const textBefore = value.slice(0, cursorPos);
    const atMatch = textBefore.match(/@(\w*)$/);

    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[0].length);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery("");
    }
  }, []);

  // Fetch mention suggestions
  useEffect(() => {
    if (!showMentions || !mentionQuery || !token) {
      setMentionResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/users/mention-search?q=${encodeURIComponent(mentionQuery)}&limit=6`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMentionResults(res.data);
      } catch (e) {
        setMentionResults([]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mentionQuery, showMentions, token]);

  const insertMention = (username) => {
    const before = content.slice(0, mentionStart);
    const after = content.slice(mentionStart + mentionQuery.length + 1); // +1 for @
    const newContent = `${before}@${username} ${after}`;
    setContent(newContent);
    setShowMentions(false);
    setMentionResults([]);
    // Focus back
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = mentionStart + username.length + 2;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 50);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && media.length === 0 && !selectedCard) return;
    setPosting(true);
    try {
      const postData = {
        content: content.trim(),
        media: media,
        post_type: selectedCard ? "card_share" : media.length > 0 ? (media[0].type === "video" ? "video" : "image") : "text",
        card_id: selectedCard?.id || null,
        visibility: "public",
        hashtags: content.match(/#\w+/g)?.map(h => h.slice(1)) || [],
        text_style: media.length === 0 ? textStyle : null,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      };
      const response = await axios.post(`${API}/posts`, postData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContent("");
      setMedia([]);
      setSelectedCard(null);
      const { brunoToast } = await import("@/components/bruno/BrunoToast");
      if (response.data?.visibility === "scheduled") {
        brunoToast.publish("Publicación programada", { description: `Se publicará el ${new Date(response.data.scheduled_at).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}. Solo tú la ves hasta entonces.` });
        if (onPostCreated) onPostCreated({ ...response.data, _scheduled: true });
        return;
      }
      if (onPostCreated) onPostCreated(response.data);
      brunoToast.publish("Publicación creada", { description: "Ya aparece en tu perfil y en el feed." });
    } catch (error) {
      const { brunoToast } = await import("@/components/bruno/BrunoToast");
      brunoToast.error("No se pudo publicar", { description: error?.response?.data?.detail || "Inténtalo de nuevo." });
    } finally {
      setPosting(false);
    }
  };

  if (!user) return null;

  return (
    <Card className="glass-card">
      <CardContent className="p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex gap-3">
            <div className="shrink-0">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.username} className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                  {(user.username || "U")[0].toUpperCase()}
                </div>
              )}
            </div>
            
            <div className="flex-1 space-y-3">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={handleContentChange}
                  placeholder="¿Qué está pasando? Usa # para hashtags y @ para mencionar"
                  className="w-full min-h-[80px] bg-transparent border-none outline-none resize-none text-base placeholder:text-muted-foreground"
                  rows={2}
                  data-testid="create-post-textarea"
                />

                {/* @Mention Autocomplete Dropdown */}
                {showMentions && mentionResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-xl shadow-xl z-50 overflow-hidden max-h-60" data-testid="mention-autocomplete">
                    {mentionResults.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => insertMention(u.username)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
                        data-testid={`mention-option-${u.username}`}
                      >
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                            {(u.username || "U")[0].toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{u.display_name || u.username}</p>
                          <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                        </div>
                        <AtSign className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Schedule */}
              {showSchedule && (
                <div className="rounded-2xl bg-muted/40 p-3 space-y-2" data-testid="create-post-schedule">
                  <div className="flex items-center gap-2 text-sm font-medium"><CalendarClock className="w-4 h-4 text-primary" /> Programar publicación</div>
                  <input type="datetime-local" value={scheduledAt} min={minSchedule} onChange={(e) => setScheduledAt(e.target.value)} className="w-full h-10 rounded-xl bg-background border border-border/60 px-3 text-sm" data-testid="create-post-schedule-input" />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{scheduledAt ? `Se publicará el ${new Date(scheduledAt).toLocaleString("es", { dateStyle: "medium", timeStyle: "short" })}` : "Elige fecha y hora (mínimo 15 min)"}</span>
                    {scheduledAt && <button type="button" onClick={() => setScheduledAt("")} className="text-primary font-medium" data-testid="create-post-schedule-clear">Quitar</button>}
                  </div>
                </div>
              )}

              {/* Text style (only for text-only posts) */}
              {media.length === 0 && showStyle && <TextStylePicker value={textStyle} onChange={setTextStyle} text={content} />}

              {/* Media Preview */}
              <div className="flex items-center gap-1.5 mb-2" data-testid="image-aspect-picker">
                <span className="text-[11px] text-muted-foreground mr-1">Formato de fotos</span>
                {[["1:1", "1:1"], ["4:5", "4:5"], ["9:16", "9:16"], ["free", "Libre"]].map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setAspect(id)} aria-pressed={aspect === id} data-testid={`aspect-${id.replace(":", "-")}`}
                    className={`h-7 px-2.5 rounded-full text-[11px] font-semibold transition ${aspect === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{label}</button>
                ))}
              </div>
              {media.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {media.map((item, index) => (
                    <div key={`item-${index}`} className={`relative ${item.type === "video" ? "aspect-video" : aspect === "1:1" ? "aspect-square" : aspect === "9:16" ? "aspect-[9/16] max-h-64" : "aspect-[4/5]"} rounded-lg overflow-hidden bg-muted`}>
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
                  <button type="button" onClick={() => setSelectedCard(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              
              {videoProgress && (
                <div className="rounded-xl bg-muted/60 p-2 text-xs" data-testid="create-post-video-progress" data-phase={videoProgress.phase}>
                  <div className="flex justify-between mb-1"><span>{videoProgress.phase === "process" ? "Procesando video…" : videoProgress.phase === "retry" ? "Reintentando sin perder lo subido…" : "Subiendo video por partes…"}</span><span>{videoProgress.pct}%</span></div>
                  <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${videoProgress.pct}%` }} /></div>
                </div>
              )}
              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-1">
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
                  
                  <Button type="button" variant="ghost" size="sm" onClick={() => { if (fileInputRef.current) fileInputRef.current.accept = "image/*,video/*"; fileInputRef.current?.click(); }} disabled={uploading} className="text-primary" data-testid="create-post-image-btn">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
                  </Button>
                  
                  <Button type="button" variant="ghost" size="sm" onClick={() => { if (fileInputRef.current) fileInputRef.current.accept = "video/*"; fileInputRef.current?.click(); }} disabled={uploading} className="text-primary" data-testid="create-post-video-btn">
                    <Video className="w-5 h-5" />
                  </Button>

                  {media.length === 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowStyle((v) => !v)} className={showStyle ? "text-primary bg-primary/10" : "text-primary"} data-testid="create-post-style-btn" aria-label="Estilo de texto">
                      <Palette className="w-5 h-5" />
                    </Button>
                  )}

                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowSchedule((v) => !v)} className={scheduledAt || showSchedule ? "text-primary bg-primary/10" : "text-primary"} data-testid="create-post-schedule-btn" aria-label="Programar">
                    <CalendarClock className="w-5 h-5" />
                  </Button>
                  
                  {userCards.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowCardPicker(!showCardPicker)} className="text-primary">
                      <CreditCard className="w-5 h-5" />
                    </Button>
                  )}
                </div>
                
                <Button type="submit" disabled={posting || (!content.trim() && media.length === 0 && !selectedCard)} className="rounded-full px-5" data-testid="create-post-submit">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4 mr-2" />Publicar</>}
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
                      onClick={() => { setSelectedCard(card); setShowCardPicker(false); }}
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
