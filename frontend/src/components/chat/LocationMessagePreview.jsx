/**
 * LocationMessagePreview — chat bubble preview for location_share messages.
 *
 * Shows a Google-static-style map snippet, the share type label, expiry
 * countdown and (for live shares) a small "EN VIVO" badge with a pulse.
 * Clicking the bubble jumps to the map page with the share id preselected.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Radio } from "lucide-react";

export default function LocationMessagePreview({ attachment, isOwn }) {
  const navigate = useNavigate();
  const lat = attachment?.lat;
  const lng = attachment?.lng;
  const isLive = attachment?.share_type === "live";
  const expiresAt = attachment?.expires_at;
  const [remain, setRemain] = useState("");
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    if (!isLive || !expiresAt) return undefined;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) { setRemain("Finalizada"); return; }
      const m = Math.floor(ms / 60000);
      const h = Math.floor(m / 60);
      setRemain(h > 0 ? `${h}h ${m % 60}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [isLive, expiresAt]);

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || "";
  const mapSrc = lat && lng
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=300x150&scale=2&markers=color:red%7C${lat},${lng}${apiKey ? `&key=${apiKey}` : ""}`
    : null;

  const isPlace = attachment?.share_type === "place";
  const handleOpen = () => {
    if (isPlace) { navigate("/map?nearby=1"); return; }
    if (lat != null && lng != null) navigate(`/map?focus=${attachment.share_id}&lat=${lat}&lng=${lng}`);
    else navigate("/map");
  };

  return (
    <button
      onClick={handleOpen}
      className={`block w-full max-w-[280px] rounded-2xl overflow-hidden border ${isOwn ? "border-white/20" : "border-border"} hover:opacity-95 transition-opacity text-left`}
      data-testid="location-message-preview"
    >
      <div className="relative h-[120px] bg-muted">
        {mapSrc && !imgFailed ? (
          <img src={mapSrc} alt="Ubicación en el mapa" className="w-full h-full object-cover" onError={() => setImgFailed(true)} />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground">
            <MapPin className="w-7 h-7" />
          </div>
        )}
        {isLive && (
          <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-wider shadow">
            <Radio className="w-3 h-3 animate-pulse" /> En vivo
          </span>
        )}
      </div>
      {isPlace && (
        <div className="px-3 py-2 space-y-1" data-testid="place-message-info">
          <p className="text-sm font-semibold truncate">📍 {attachment.name}</p>
          {attachment.category_label && <p className="text-[11px] opacity-70 truncate">{attachment.category_label}</p>}
          {attachment.address && <p className="text-[11px] opacity-80 truncate">{attachment.address}</p>}
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 inline-flex items-center justify-center h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold" data-testid="place-message-directions">Cómo llegar</a>
        </div>
      )}
      <div className={`px-3 py-2 ${isOwn ? "bg-primary/15" : "bg-card"}`}>
        <p className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5" />
          {attachment?.label || (isLive ? "Ubicación en vivo" : "Ubicación compartida")}
        </p>
        {isLive && remain && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {remain === "Finalizada" ? remain : `Termina en ${remain}`}
          </p>
        )}
      </div>
    </button>
  );
}
