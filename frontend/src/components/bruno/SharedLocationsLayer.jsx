/**
 * SharedLocationsLayer — overlays AdvancedMarkers for every active location
 * share visible to the current user.
 *
 * - Live shares update via WebSocket ('location_share_update')
 * - Pin icon depends on `last_speed`:
 *     < 1 m/s   ⇒ standing dot
 *     1–3 m/s   ⇒ walking 🚶
 *     > 3 m/s   ⇒ vehicle 🚗
 */
/* eslint-disable */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { AdvancedMarker } from "@vis.gl/react-google-maps";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const WS_URL = process.env.REACT_APP_BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");

function iconForSpeed(speed) {
  if (typeof speed !== "number" || isNaN(speed) || speed < 1) return { glyph: "•", label: "Detenido" };
  if (speed < 3) return { glyph: "🚶", label: "Caminando" };
  return { glyph: "🚗", label: "Vehículo" };
}

export default function SharedLocationsLayer({ onSelect }) {
  const { token, user } = useAuth();
  const [shares, setShares] = useState([]);
  const wsRef = useRef(null);

  // Initial fetch
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await axios.get(`${API}/location/shares/active`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setShares(r.data?.shares || []);
      } catch (_e) { /* ignore */ }
    })();
    const iv = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/location/shares/active`, { headers: { Authorization: `Bearer ${token}` } });
        if (!cancelled) setShares(r.data?.shares || []);
      } catch (_e) { /* ignore */ }
    }, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [token]);

  // WebSocket live updates
  useEffect(() => {
    if (!token) return;
    let alive = true;
    const connect = () => {
      const sock = new WebSocket(`${WS_URL}/api/ws/chat/${token}`);
      wsRef.current = sock;
      sock.onmessage = (ev) => {
        if (!alive) return;
        try {
          const data = JSON.parse(ev.data);
          if (data.type === "location_share_started") {
            setShares((p) => [...p.filter((s) => s.id !== data.share?.id), data.share].filter(Boolean));
          } else if (data.type === "location_share_update") {
            setShares((p) => p.map((s) => s.id === data.share_id ? { ...s, last_lat: data.last_lat, last_lng: data.last_lng, last_speed: data.last_speed, last_heading: data.last_heading, last_update: data.last_update } : s));
          } else if (data.type === "location_share_stopped") {
            setShares((p) => p.filter((s) => s.id !== data.share_id));
          }
        } catch (_e) { /* ignore */ }
      };
      sock.onclose = () => { if (alive) setTimeout(connect, 3000); };
      return sock;
    };
    const s = connect();
    return () => { alive = false; try { s?.close?.(); } catch (_e) { /* ignore */ } };
  }, [token]);

  return (
    <>
      {shares.map((s) => {
        if (typeof s.last_lat !== "number" || typeof s.last_lng !== "number") return null;
        const icon = iconForSpeed(s.last_speed);
        const isMe = s.from_user_id === user?.id;
        return (
          <AdvancedMarker
            key={s.id}
            position={{ lat: s.last_lat, lng: s.last_lng }}
            onClick={() => onSelect?.(s)}
            title={`${s.from_user_name || "Usuario"} — ${icon.label}`}
          >
            <div className="relative flex flex-col items-center group cursor-pointer" data-testid={`map-share-${s.id}`}>
              {s.type === "live" && (
                <span className="absolute inset-[-6px] rounded-full bg-emerald-400/40 animate-ping" />
              )}
              <div
                className="w-12 h-12 rounded-full border-[3px] shadow-xl grid place-items-center overflow-hidden bg-white"
                style={{ borderColor: isMe ? "#6366f1" : s.type === "live" ? "#10b981" : "#f59e0b" }}
              >
                {s.from_avatar_url ? (
                  <img src={s.from_avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl">{icon.glyph}</span>
                )}
              </div>
              {/* Speed badge */}
              <span className="absolute -top-1 -right-1 text-base leading-none bg-white rounded-full w-6 h-6 grid place-items-center shadow ring-2 ring-white">
                {icon.glyph}
              </span>
              <div
                className="w-0 h-0 -mt-0.5"
                style={{
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: `8px solid ${isMe ? "#6366f1" : s.type === "live" ? "#10b981" : "#f59e0b"}`,
                  filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
                }}
              />
            </div>
          </AdvancedMarker>
        );
      })}
    </>
  );
}
