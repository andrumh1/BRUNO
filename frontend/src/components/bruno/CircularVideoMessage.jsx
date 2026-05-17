import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Volume2, VolumeX, Play, Pause } from "lucide-react";

/**
 * CircularVideoMessage — Telegram-style "video note" bubble.
 *
 *  • Circular 200x200 (or `size`) clip with the video inside
 *  • Auto-plays muted in loop when scrolled into view (IntersectionObserver)
 *  • Tap → toggles unmute / play state
 *  • Shows a thin progress ring around the circle
 *  • Bruno-branded orange ring + glass border
 *
 * Props:
 *   src       — video URL
 *   isOwn     — bool, just affects positioning shadow
 *   poster    — optional poster image
 *   size      — px, default 180
 *   duration  — optional seconds for the ring (we read videoEl.duration when known)
 */
export default function CircularVideoMessage({
  src,
  isOwn = false,
  poster,
  size = 180,
  testId = "circular-video",
}) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..100
  const [inView, setInView] = useState(false);

  // Visibility observer for auto-play
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.4 }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  // Play / pause on visibility
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (inView) {
      v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [inView]);

  // Progress ring
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      if (!v.duration) return;
      setProgress(((v.currentTime % v.duration) / v.duration) * 100);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, []);

  const handleTap = () => {
    const v = videoRef.current;
    if (!v) return;
    // First tap: unmute. Subsequent taps: toggle play/pause.
    if (muted) {
      v.muted = false;
      setMuted(false);
      v.play().catch(() => {});
      setPlaying(true);
      return;
    }
    if (v.paused) {
      v.play().catch(() => {});
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  // SVG ring geometry
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;

  return (
    <motion.div
      ref={containerRef}
      data-testid={testId}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className="relative shrink-0"
      style={{ width: size, height: size }}
    >
      {/* Progress ring */}
      <svg
        className="absolute inset-0 -rotate-90 pointer-events-none"
        width={size}
        height={size}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="#FF5A00"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.2s linear" }}
        />
      </svg>

      {/* Circular clipped video */}
      <button
        onClick={handleTap}
        className={`absolute overflow-hidden rounded-full ring-2 ring-white/20 shadow-xl ${
          isOwn ? "shadow-orange-500/20" : "shadow-black/30"
        }`}
        style={{
          width: size - stroke * 3,
          height: size - stroke * 3,
          top: stroke * 1.5,
          left: stroke * 1.5,
        }}
        data-testid={`${testId}-toggle`}
        aria-label={muted ? "Activar sonido" : playing ? "Pausar" : "Reproducir"}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />

        {/* Overlay icons */}
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/30 via-transparent to-transparent">
          <motion.span
            key={muted ? "muted" : playing ? "playing" : "paused"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-2 right-2 bg-black/55 backdrop-blur rounded-full p-1.5 text-white"
          >
            {muted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : playing ? (
              <Volume2 className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
          </motion.span>
        </div>
      </button>
    </motion.div>
  );
}
