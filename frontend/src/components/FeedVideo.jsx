/**
 * FeedVideo — autoplay-on-visible video player for the main feed.
 *
 *  • Auto-plays muted when ≥60% visible (Instagram/Twitter style)
 *  • Pauses + rewinds when scrolled out of view
 *  • Tap toggles mute/play
 *  • Multi-source: MP4 derivative → f_auto → original (cross-platform)
 *  • Honors `prefers-reduced-motion` (no autoplay)
 */
import React, { useEffect, useRef, useState } from "react";
import { Play, Volume2, VolumeX } from "lucide-react";

export default function FeedVideo({ media }) {
  const videoRef = useRef(null);
  const wrapperRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);

  // Auto-play / pause based on visibility
  useEffect(() => {
    const v = videoRef.current;
    const w = wrapperRef.current;
    if (!v || !w) return undefined;
    const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) return undefined;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.intersectionRatio >= 0.6) {
          v.muted = muted;
          const p = v.play();
          if (p && typeof p.then === "function") {
            p.then(() => setPlaying(true)).catch(() => {
              // Browser blocked autoplay → retry muted
              if (!v.muted) { v.muted = true; v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
              else setPlaying(false);
            });
          }
        } else {
          try { v.pause(); v.currentTime = 0; } catch (_e) { /* ignore */ }
          setPlaying(false);
        }
      });
    }, { threshold: [0.25, 0.6, 0.9] });
    observer.observe(w);
    return () => observer.disconnect();
  }, [muted]);

  const handleTap = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setPlaying(true)).catch(() => {});
    else { v.pause(); setPlaying(false); }
  };

  return (
    <div ref={wrapperRef} className="relative w-full h-full" onClick={handleTap}>
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
        poster={media.poster_url || undefined}
      >
        {media.mp4_url && <source src={media.mp4_url} type="video/mp4" />}
        {media.f_auto_url && <source src={media.f_auto_url} type="video/mp4" />}
        <source src={media.url} type={`video/${(media.url || "").split(".").pop()?.split("?")[0] || "mp4"}`} />
      </video>

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play className="w-7 h-7 text-white fill-white ml-1" />
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
        className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm grid place-items-center"
        data-testid="feed-video-mute"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
      >
        {muted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
      </button>
    </div>
  );
}
