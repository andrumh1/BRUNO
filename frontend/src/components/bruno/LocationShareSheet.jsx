/**
 * LocationShareSheet — modal sheet to start sharing your location with a peer.
 *
 *  Two modes:
 *    • fixed  → captures one geolocation snapshot, sends as chat message
 *    • live   → starts a high-frequency tracker (configurable interval + duration)
 *               and emits POST /api/location/share + periodic updates.
 *
 *  Props:
 *    open, onClose, toUserId?, chatId?, peerName?
 */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Clock, Activity, X, Loader2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Global registry of active "live" shares the user owns — so multiple sheets
// or page navigations don't clone tracking timers.
const _activeTrackers = new Map(); // share_id -> { intervalId, watchId }

export function startLiveTracker(shareId, intervalSeconds, token) {
  if (_activeTrackers.has(shareId)) return;
  // High-accuracy continuous watch
  let lastUpdate = 0;
  let lastPos = null;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => { lastPos = pos; },
    () => { /* permission denied — kill tracker */ stopLiveTracker(shareId); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
  const intervalId = setInterval(async () => {
    const now = Date.now();
    if (!lastPos || now - lastUpdate < (intervalSeconds * 1000) - 500) return;
    lastUpdate = now;
    try {
      await axios.post(`${API}/location/share/${shareId}/update`, {
        lat: lastPos.coords.latitude,
        lng: lastPos.coords.longitude,
        accuracy: lastPos.coords.accuracy,
        speed: lastPos.coords.speed,
        heading: lastPos.coords.heading,
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (_e) { /* on 400/expired, stop */ stopLiveTracker(shareId); }
  }, Math.max(intervalSeconds * 1000, 3000));
  _activeTrackers.set(shareId, { intervalId, watchId });
}

export function stopLiveTracker(shareId) {
  const t = _activeTrackers.get(shareId);
  if (!t) return;
  try { clearInterval(t.intervalId); } catch (_e) { /* ignore */ }
  try { navigator.geolocation.clearWatch(t.watchId); } catch (_e) { /* ignore */ }
  _activeTrackers.delete(shareId);
}

export default function LocationShareSheet({ open, onClose, toUserId, chatId, peerName }) {
  const { token } = useAuth();
  const [mode, setMode] = useState("live"); // 'fixed' | 'live'
  const [duration, setDuration] = useState(15); // minutes
  const [interval, setIntervalSeconds] = useState(10); // seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) { setError(""); setLoading(false); }
  }, [open]);

  const handleStart = () => {
    setLoading(true);
    setError("");
    if (!navigator.geolocation) {
      setError("Tu navegador no soporta geolocalización.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await axios.post(`${API}/location/share`, {
            to_user_id: toUserId || null,
            chat_id: chatId || null,
            type: mode,
            duration_minutes: mode === "live" ? duration : 1,
            interval_seconds: mode === "live" ? interval : 30,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            speed: pos.coords.speed,
            heading: pos.coords.heading,
            label: mode === "live" ? "Ubicación en vivo" : "Mi ubicación",
          }, { headers: { Authorization: `Bearer ${token}` } });
          if (mode === "live" && r.data?.id) startLiveTracker(r.data.id, interval, token);
          onClose?.(r.data);
        } catch (e) {
          setError(e.response?.data?.detail || "Error iniciando compartir ubicación");
        } finally { setLoading(false); }
      },
      (err) => {
        setError(err.code === 1 ? "Necesitamos permiso de ubicación" : "No pudimos obtener tu ubicación");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[140] bg-black/65 backdrop-blur-md flex items-end justify-center"
          onClick={onClose}
          data-testid="location-share-sheet"
        >
          <motion.div
            ref={sheetRef}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-stone-950 border-t border-white/10 rounded-t-3xl overflow-hidden text-white"
          >
            <div className="flex justify-center pt-2.5"><div className="h-1.5 w-12 rounded-full bg-white/20" /></div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-base">Compartir ubicación{peerName ? ` con ${peerName}` : ""}</h3>
              </div>
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 grid place-items-center" data-testid="location-share-close"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode("fixed")}
                  className={`p-3 rounded-xl border text-left ${mode === "fixed" ? "border-orange-500 bg-orange-500/15" : "border-white/10 bg-white/5"}`}
                  data-testid="location-mode-fixed"
                >
                  <MapPin className="w-5 h-5 mb-1.5 text-orange-400" />
                  <p className="text-sm font-semibold">Punto fijo</p>
                  <p className="text-[11px] text-white/55 mt-0.5">Una sola foto de tu ubicación actual</p>
                </button>
                <button
                  onClick={() => setMode("live")}
                  className={`p-3 rounded-xl border text-left ${mode === "live" ? "border-orange-500 bg-orange-500/15" : "border-white/10 bg-white/5"}`}
                  data-testid="location-mode-live"
                >
                  <Radio className="w-5 h-5 mb-1.5 text-emerald-400" />
                  <p className="text-sm font-semibold">En vivo</p>
                  <p className="text-[11px] text-white/55 mt-0.5">Actualización continua mientras te mueves</p>
                </button>
              </div>

              {mode === "live" && (
                <>
                  {/* Duration */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-white/60" /><span className="text-xs font-semibold text-white/75">Duración</span></div>
                      <span className="text-xs text-white/55">{duration >= 60 ? `${Math.round(duration / 60 * 10) / 10}h` : `${duration} min`}</span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {[5, 15, 60, 240, 720].map((m) => (
                        <button
                          key={m}
                          onClick={() => setDuration(m)}
                          className={`py-1.5 rounded-lg text-[11px] font-semibold ${duration === m ? "bg-orange-500 text-white" : "bg-white/5 text-white/70"}`}
                          data-testid={`location-duration-${m}`}
                        >{m >= 60 ? `${m / 60}h` : `${m}m`}</button>
                      ))}
                    </div>
                  </div>
                  {/* Interval */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5 text-white/60" /><span className="text-xs font-semibold text-white/75">Frecuencia</span></div>
                      <span className="text-xs text-white/55">cada {interval}s</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {[5, 10, 30, 60].map((s) => (
                        <button
                          key={s}
                          onClick={() => setIntervalSeconds(s)}
                          className={`py-1.5 rounded-lg text-[11px] font-semibold ${interval === s ? "bg-orange-500 text-white" : "bg-white/5 text-white/70"}`}
                          data-testid={`location-interval-${s}`}
                        >{s}s</button>
                      ))}
                    </div>
                    <p className="text-[10px] text-white/40 mt-1.5">Frecuencias más cortas gastan más batería.</p>
                  </div>
                </>
              )}

              {error && <p className="text-xs text-red-400 text-center">{error}</p>}

              <Button
                className="w-full"
                onClick={handleStart}
                disabled={loading}
                data-testid="location-share-start"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <MapPin className="w-4 h-4 mr-2" />}
                {mode === "live" ? "Comenzar en vivo" : "Enviar mi ubicación"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
