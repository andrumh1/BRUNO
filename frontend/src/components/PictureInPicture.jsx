import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause, Maximize2, Volume2, VolumeX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useNavScroll } from "@/contexts/NavScrollContext";

const PictureInPicture = () => {
  const { minimizedItems, removeMinimizedItem } = useNavScroll();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  // Find the first reel/live item that has a video URL
  const videoItem = minimizedItems.find(
    (i) => (i.itemType === "reel" || i.itemType === "live") && i.videoUrl
  );

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [position, setPosition] = useState({ x: 16, y: -160 }); // bottom-right
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    if (videoRef.current && videoItem) {
      if (isPlaying) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }
  }, [isPlaying, videoItem]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted]);

  if (!videoItem) return null;

  const handlePointerDown = (e) => {
    if (e.target.closest("button")) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, px: position.x, py: position.y };
    containerRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 180, dragStart.current.px + dx)),
      y: Math.max(-window.innerHeight + 120, Math.min(0, dragStart.current.py + dy)),
    });
  };

  const handlePointerUp = () => setDragging(false);

  const handleExpand = () => {
    removeMinimizedItem(videoItem.id, videoItem.itemType);
    if (videoItem.itemType === "reel") navigate(`/reels?id=${videoItem.id}`);
    else navigate(`/lives/${videoItem.id}`);
  };

  const handleClose = () => {
    removeMinimizedItem(videoItem.id, videoItem.itemType);
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      className="fixed z-[9990] cursor-grab active:cursor-grabbing select-none touch-none"
      style={{
        right: `${position.x}px`,
        bottom: `${-position.y + 80}px`,
        width: "160px",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-testid="pip-player"
    >
      <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-black">
        {/* Video */}
        <div className="relative aspect-[9/14]">
          <video
            ref={videoRef}
            src={videoItem.videoUrl}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted={isMuted}
            playsInline
          />

          {/* Overlay controls */}
          <div className="absolute inset-0 flex flex-col justify-between p-1.5 opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-b from-black/40 via-transparent to-black/40">
            {/* Top: Close */}
            <div className="flex justify-between">
              <button
                onClick={handleClose}
                className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                data-testid="pip-close"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              <button
                onClick={handleExpand}
                className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                data-testid="pip-expand"
              >
                <Maximize2 className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Bottom: Play/Mute */}
            <div className="flex justify-between">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                data-testid="pip-play"
              >
                {isPlaying ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 text-white" />}
              </button>
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="w-5 h-5 rounded-full bg-black/50 flex items-center justify-center"
                data-testid="pip-mute"
              >
                {isMuted ? <VolumeX className="w-3 h-3 text-white" /> : <Volume2 className="w-3 h-3 text-white" />}
              </button>
            </div>
          </div>

          {/* Live badge */}
          {videoItem.itemType === "live" && (
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-500 text-white text-[8px] font-bold animate-pulse">
              EN VIVO
            </div>
          )}
        </div>

        {/* Title bar */}
        <div className="px-2 py-1 bg-card/90 backdrop-blur-sm">
          <p className="text-[9px] font-medium truncate text-foreground">{videoItem.title || "Video"}</p>
        </div>
      </div>
    </motion.div>
  );
};

export default PictureInPicture;
