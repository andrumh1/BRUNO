import { useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/* Registra un escaneo de QR/enlace compartido cuando la URL trae ?ref=… (una vez por sesión y ref). */
export function useShareHit(target) {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref) return;
      const key = `bruno_hit_${ref}`;
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      axios.post(`${API}/share-stats/hit`, { ref, referrer: document.referrer || "", target }).catch(() => {});
    } catch { /* ignore */ }
  }, [target]);
}

export const newShareRef = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const withRef = (url, ref) => `${url}${url.includes("?") ? "&" : "?"}ref=${ref}`;

export const NETWORK_LABELS = { instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", telegram: "Telegram", x: "X", linkedin: "LinkedIn", tiktok: "TikTok", snapchat: "Snapchat", bruno: "BRUNO", qr: "Cámara / QR", web: "Web" };
