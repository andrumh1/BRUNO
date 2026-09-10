/**
 * OsmFallbackMap — free OpenStreetMap/Leaflet layer used automatically when
 * Google Maps cannot load (billing disabled, invalid key, offline quota...).
 * Same PIUP pins + BRUNO identity, zero API keys required.
 */
import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import axios from "axios";
import { ExternalLink } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const pinIcon = (pin) =>
  L.divIcon({
    className: "bruno-osm-pin",
    iconSize: [44, 52],
    iconAnchor: [22, 52],
    popupAnchor: [0, -48],
    html: `<div style="display:flex;flex-direction:column;align-items:center">
      <div style="width:44px;height:44px;border-radius:9999px;border:3px solid #fff;background:${pin.category_color || "#FF5A00"};display:grid;place-items:center;font-size:18px;box-shadow:0 6px 16px rgba(0,0,0,.25)">${pin.category_icon || "📍"}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${pin.category_color || "#FF5A00"};margin-top:-2px"></div>
    </div>`,
  });

function MapBridge({ mapRef, onBounds, pendingRef }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = {
      panTo: (c) => map.panTo([c.lat, c.lng]),
      getCenter: () => { const c = map.getCenter(); return { lat: () => c.lat, lng: () => c.lng }; },
    };
    if (pendingRef?.current) { map.panTo([pendingRef.current.lat, pendingRef.current.lng]); pendingRef.current = null; }
    const fire = () => {
      const b = map.getBounds();
      onBounds({ min_lat: b.getSouth(), max_lat: b.getNorth(), min_lng: b.getWest(), max_lng: b.getEast() });
    };
    map.on("moveend", fire);
    fire();
    return () => map.off("moveend", fire);
  }, [map, mapRef, onBounds, pendingRef]);
  return null;
}

export default function OsmFallbackMap({ center, mapRef, pendingRef, showPins, navigate }) {
  const [pins, setPins] = useState([]);
  const lastRef = useRef(0);

  const fetchPins = async (bounds) => {
    const now = Date.now();
    if (now - lastRef.current < 500) return;
    lastRef.current = now;
    try {
      const res = await axios.get(`${API}/map-pins`, { params: { ...bounds, limit: 200 } });
      setPins(res.data?.pins || []);
    } catch (_) { /* ignore */ }
  };

  return (
    <div className="absolute inset-0 no-glass" data-testid="map-osm-fallback">
      <MapContainer center={[center.lat, center.lng]} zoom={14} zoomControl={false} style={{ width: "100%", height: "100%" }} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains="abc" maxZoom={19} className="bruno-osm-tiles" />
        <MapBridge mapRef={mapRef} onBounds={fetchPins} pendingRef={pendingRef} />
        {showPins && pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p)}>
            <Popup>
              <div className="w-[220px]" data-testid={`map-piup-detail-${p.id}`}>
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-full grid place-items-center text-sm shrink-0" style={{ backgroundColor: p.category_color }}>{p.category_icon}</span>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.category_label}</p>
                  </div>
                </div>
                {p.subtitle && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{p.subtitle}</p>}
                <button
                  onClick={() => navigate(`/c/${p.card_id}`)}
                  className="mt-3 w-full inline-flex items-center justify-center gap-1 h-8 text-xs rounded-md bg-primary text-white"
                  data-testid={`map-piup-view-card-${p.id}`}
                >
                  <ExternalLink className="w-3 h-3" /> Ver tarjeta
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      <div className="absolute bottom-1 left-1 text-[9px] text-foreground/60 bg-background/70 px-1.5 rounded pointer-events-none">© OpenStreetMap contributors</div>
    </div>
  );
}
