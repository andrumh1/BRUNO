import React, { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Convert a Cloudinary audio URL to MP3 on-the-fly for broader browser support.
 * Pattern: .../upload/v123/path.webm  →  .../upload/f_mp3/v123/path.mp3
 */
export const toPlayableAudioUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  if (!url.includes("res.cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/upload/f_mp3")) return url;
  return url
    .replace("/upload/", "/upload/f_mp3/")
    .replace(/\.(webm|opus|m4a|ogg|wav)(\?|$)/i, ".mp3$2");
};

/**
 * AudioPlayer — multi-source <audio> with mp3 → original codec → f_mp3 fallback.
 * Used inside chat bubbles for voice notes.
 */
const AudioPlayer = ({ url, mp3Url, isOwn }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  const sources = useMemo(() => {
    const list = [];
    if (mp3Url) list.push({ src: mp3Url, type: "audio/mpeg" });
    if (url && url !== mp3Url) {
      const isWebm = /\.webm(\?|$)/i.test(url);
      const isOgg = /\.ogg(\?|$)/i.test(url);
      list.push({
        src: url,
        type: isWebm ? "audio/webm" : isOgg ? "audio/ogg" : "audio/mp4",
      });
    }
    if (url) {
      const transformed = toPlayableAudioUrl(url);
      if (transformed !== url && transformed !== mp3Url) {
        list.push({ src: transformed, type: "audio/mpeg" });
      }
    }
    return list;
  }, [url, mp3Url]);

  // Force-reload when sources change (Chrome requires explicit load() after src swap)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    try { a.load(); } catch (_e) { /* ignore */ }
    setError(false);
  }, [sources]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (!a.duration || !isFinite(a.duration)) return;
      setProgress((a.currentTime / a.duration) * 100);
    };
    const onLoad = () => { if (isFinite(a.duration)) setDuration(a.duration); };
    const onEnd = () => { setIsPlaying(false); setProgress(0); };
    const onErr = () => { setError(true); setIsPlaying(false); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onLoad);
    a.addEventListener("ended", onEnd);
    a.addEventListener("error", onErr);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onLoad);
      a.removeEventListener("ended", onEnd);
      a.removeEventListener("error", onErr);
    };
  }, []);

  const togglePlay = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) {
      a.pause();
      setIsPlaying(false);
      return;
    }
    try {
      if (a.ended || progress >= 99) a.currentTime = 0;
      await a.play();
      setIsPlaying(true);
      setError(false);
    } catch (_e) {
      setError(true);
    }
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-2 min-w-[200px] ${isOwn ? "flex-row-reverse" : ""}`}
      data-testid="audio-player"
    >
      <audio ref={audioRef} preload="metadata">
        {sources.map((s) => (
          <source key={s.src} src={s.src} type={s.type} />
        ))}
      </audio>
      <Button
        variant="ghost"
        size="icon"
        className={`h-10 w-10 rounded-full ${isOwn ? "bg-white/20" : "bg-primary/10"}`}
        onClick={togglePlay}
        data-testid="audio-player-play"
      >
        {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </Button>
      <div className="flex-1 min-w-[100px]">
        <div className={`h-1 rounded-full ${isOwn ? "bg-white/30" : "bg-muted"}`}>
          <div
            className={`h-full rounded-full transition-all ${isOwn ? "bg-white" : "bg-primary"}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className={`text-xs ${isOwn ? "text-white/70" : "text-muted-foreground"}`}>
          {error ? "No se pudo reproducir" : fmt(duration)}
        </span>
      </div>
    </div>
  );
};

export default AudioPlayer;
