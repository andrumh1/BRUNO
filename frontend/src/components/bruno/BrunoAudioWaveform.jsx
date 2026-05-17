import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Play, Pause } from "lucide-react";

/**
 * BrunoAudioWaveform — WhatsApp-style voice message with animated bars.
 *
 *   • Generates a deterministic waveform pattern from the URL
 *   • Bars on the played-portion are highlighted (orange Bruno)
 *   • Bars pulse vertically while playing
 *   • Tap on a bar to seek
 *
 * Props:
 *   url      — audio src
 *   isOwn    — adjusts color palette for own bubble
 *   testId
 */
export default function BrunoAudioWaveform({ url, isOwn = false, testId = "audio-wave" }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Stable pseudo-random heights from the url
  const bars = useMemo(() => {
    const seed = (url || "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const out = [];
    let s = seed;
    for (let i = 0; i < 32; i++) {
      s = (s * 9301 + 49297) % 233280;
      const v = (s / 233280) * 0.8 + 0.2; // 0.2..1
      out.push(v);
    }
    return out;
  }, [url]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const t = () => setCurrent(a.currentTime || 0);
    const l = () => setDuration(a.duration || 0);
    const e = () => {
      setPlaying(false);
      setCurrent(0);
    };
    a.addEventListener("timeupdate", t);
    a.addEventListener("loadedmetadata", l);
    a.addEventListener("ended", e);
    return () => {
      a.removeEventListener("timeupdate", t);
      a.removeEventListener("loadedmetadata", l);
      a.removeEventListener("ended", e);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const seekToBar = (i) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    a.currentTime = (i / bars.length) * duration;
    setCurrent(a.currentTime);
  };

  const progressPct = duration ? (current / duration) * 100 : 0;
  const progressBarIdx = Math.floor((progressPct / 100) * bars.length);
  const remaining = Math.max(duration - current, 0);

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const activeColor = isOwn ? "#FFFFFF" : "#FF5A00";
  const inactiveColor = isOwn ? "rgba(255,255,255,0.35)" : "rgba(161,161,170,0.5)";

  return (
    <div
      className={`flex items-center gap-2.5 min-w-[220px] max-w-[280px] ${
        isOwn ? "flex-row-reverse" : ""
      }`}
      data-testid={testId}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={toggle}
        data-testid={`${testId}-toggle`}
        className={`shrink-0 grid place-items-center h-10 w-10 rounded-full ${
          isOwn
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-orange-500 text-white hover:bg-orange-600"
        }`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </motion.button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          className="flex items-end gap-[2px] h-7 cursor-pointer"
          role="slider"
          aria-label="Waveform"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const i = Math.floor((x / rect.width) * bars.length);
            seekToBar(i);
          }}
        >
          {bars.map((h, i) => {
            const isActive = i <= progressBarIdx;
            return (
              <motion.span
                key={i}
                animate={{
                  scaleY: playing && i === progressBarIdx ? [1, 1.6, 1] : 1,
                }}
                transition={{
                  duration: 0.5,
                  repeat: playing && i === progressBarIdx ? Infinity : 0,
                  ease: "easeInOut",
                }}
                style={{
                  height: `${h * 100}%`,
                  backgroundColor: isActive ? activeColor : inactiveColor,
                  minHeight: 3,
                }}
                className="flex-1 rounded-full"
              />
            );
          })}
        </div>
        <span
          className={`text-[10px] tabular-nums ${
            isOwn ? "text-white/70" : "text-muted-foreground"
          }`}
        >
          {fmt(playing || current > 0 ? remaining : duration)}
        </span>
      </div>
    </div>
  );
}
