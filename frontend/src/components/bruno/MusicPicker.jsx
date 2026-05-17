import React, { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Music2,
  Play,
  Pause,
  Search,
  X,
  Volume2,
  VolumeX,
  Scissors,
  Check,
} from "lucide-react";
import { MUSIC_LIBRARY, CATEGORIES } from "./musicLibrary";

/**
 * MusicPicker — modal-like overlay inside BrunoQuickCamera to:
 *   • Search and preview a curated library of royalty-free tracks
 *   • Adjust volume (0..1)
 *   • Trim start/end (within track duration)
 *   • Apply → returns { track, volume, start, end } via onApply
 *
 * Props:
 *   open
 *   onClose
 *   onApply({track, volume, start, end} | null)  // null = remove
 *   current  current selection (or null)
 */
export default function MusicPicker({ open, onClose, onApply, current = null }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState(current?.track || null);
  const [volume, setVolume] = useState(current?.volume ?? 0.7);
  const [start, setStart] = useState(current?.start ?? 0);
  const [end, setEnd] = useState(current?.end ?? null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  const filtered = useMemo(() => {
    return MUSIC_LIBRARY.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      if (
        query &&
        !t.title.toLowerCase().includes(query.toLowerCase()) &&
        !t.artist.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [query, category]);

  useEffect(() => {
    if (selected) {
      setEnd((e) => (e == null ? selected.duration : Math.min(e, selected.duration)));
    }
  }, [selected]);

  // Pause when overlay closes
  useEffect(() => {
    if (!open && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [open]);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.currentTime = start || 0;
      a.volume = volume;
      a.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  // Stop at trim end
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      if (end != null && a.currentTime >= end) {
        a.pause();
        setPlaying(false);
        a.currentTime = start || 0;
      }
    };
    a.addEventListener("timeupdate", onTime);
    return () => a.removeEventListener("timeupdate", onTime);
  }, [end, start]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const handleApply = () => {
    if (!selected) return;
    onApply?.({
      track: selected,
      volume,
      start: start || 0,
      end: end ?? selected.duration,
    });
    onClose?.();
  };

  const handleRemove = () => {
    onApply?.(null);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 z-30 bg-black/95 backdrop-blur-xl"
          data-testid="music-picker"
        >
          <div className="absolute inset-0 flex flex-col text-white">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <button
                onClick={onClose}
                className="grid place-items-center h-9 w-9 rounded-full bg-white/10"
                data-testid="music-picker-close"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2">
                <Music2 className="h-5 w-5 text-orange-400" />
                <span className="text-sm font-bold">Música</span>
              </div>
              <div className="w-9" />
            </div>

            {/* Search */}
            <div className="px-4 pt-3">
              <div className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-2">
                <Search className="h-4 w-4 text-white/50" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Busca canciones, artistas..."
                  data-testid="music-search"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/40"
                />
              </div>
            </div>

            {/* Category chips */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-none">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  data-testid={`music-cat-${c.id}`}
                  className={`shrink-0 text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                    category === c.id
                      ? "bg-orange-500 border-orange-500 text-white"
                      : "bg-white/10 border-white/20 text-white/80"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Track list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-none">
              <div className="space-y-2">
                {filtered.map((track) => {
                  const isSel = selected?.id === track.id;
                  return (
                    <motion.button
                      key={track.id}
                      layout
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelected(track);
                        setStart(0);
                        setEnd(track.duration);
                        // Auto-preview
                        if (audioRef.current) {
                          audioRef.current.src = track.url;
                          audioRef.current.currentTime = 0;
                          audioRef.current.volume = volume;
                          audioRef.current
                            .play()
                            .then(() => setPlaying(true))
                            .catch(() => setPlaying(false));
                        }
                      }}
                      data-testid={`music-track-${track.id}`}
                      className={`w-full flex items-center gap-3 rounded-2xl p-2.5 border transition-all ${
                        isSel
                          ? "bg-orange-500/15 border-orange-500/60"
                          : "bg-white/5 border-white/10 hover:bg-white/10"
                      }`}
                    >
                      <div
                        className="h-11 w-11 rounded-xl grid place-items-center text-xl shrink-0"
                        style={{ backgroundColor: `${track.color}30` }}
                      >
                        {track.cover}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold truncate">{track.title}</p>
                        <p className="text-[11px] text-white/60 truncate">
                          {track.artist} · {track.duration}s
                        </p>
                      </div>
                      {isSel ? (
                        <span className="text-orange-400 text-xs font-bold">✓</span>
                      ) : (
                        <Play className="h-4 w-4 text-white/40" />
                      )}
                    </motion.button>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-center text-white/40 text-sm py-8">
                    Sin resultados
                  </p>
                )}
              </div>
            </div>

            {/* Editor — volume + trim + apply */}
            {selected && (
              <motion.div
                layout
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="px-4 pt-3 pb-5 border-t border-white/10 bg-black/60 backdrop-blur"
              >
                {/* Now playing */}
                <div className="flex items-center gap-3 mb-3">
                  <button
                    onClick={togglePlay}
                    className="grid place-items-center h-10 w-10 rounded-full bg-orange-500"
                    data-testid="music-play"
                  >
                    {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{selected.title}</p>
                    <p className="text-[10px] text-white/60">{selected.artist}</p>
                  </div>
                </div>

                {/* Volume */}
                <div className="mb-3">
                  <label className="flex items-center justify-between text-[11px] font-semibold mb-1 text-white/70">
                    <span className="inline-flex items-center gap-1">
                      {volume === 0 ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                      Volumen
                    </span>
                    <span>{Math.round(volume * 100)}%</span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    data-testid="music-volume"
                    className="w-full accent-orange-500"
                  />
                </div>

                {/* Trim */}
                <div className="mb-3">
                  <label className="flex items-center justify-between text-[11px] font-semibold mb-1 text-white/70">
                    <span className="inline-flex items-center gap-1">
                      <Scissors className="h-3 w-3" /> Recorte
                    </span>
                    <span>
                      {Math.round(start)}s – {Math.round(end ?? selected.duration)}s
                    </span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] text-white/50 mb-0.5">Inicio</p>
                      <input
                        type="range"
                        min={0}
                        max={(end ?? selected.duration) - 1}
                        value={start}
                        onChange={(e) => setStart(Number(e.target.value))}
                        data-testid="music-trim-start"
                        className="w-full accent-orange-500"
                      />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/50 mb-0.5">Fin</p>
                      <input
                        type="range"
                        min={start + 1}
                        max={selected.duration}
                        value={end ?? selected.duration}
                        onChange={(e) => setEnd(Number(e.target.value))}
                        data-testid="music-trim-end"
                        className="w-full accent-orange-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {current && (
                    <button
                      onClick={handleRemove}
                      className="text-xs font-semibold rounded-full px-3 py-2 bg-white/10 text-white"
                      data-testid="music-remove"
                    >
                      Quitar
                    </button>
                  )}
                  <button
                    onClick={handleApply}
                    data-testid="music-apply"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-full py-2.5 bg-orange-500 text-white font-bold text-sm shadow-lg shadow-orange-500/30"
                  >
                    <Check className="h-4 w-4" />
                    Aplicar música
                  </button>
                </div>
              </motion.div>
            )}

            <audio ref={audioRef} loop={false} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
