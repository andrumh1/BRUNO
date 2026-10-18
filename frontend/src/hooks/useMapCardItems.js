import { useCallback, useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const hasLoc = (it) => typeof it?.lat === "number" && typeof it?.lng === "number" && !Number.isNaN(it.lat) && !Number.isNaN(it.lng);

// Única fuente de verdad del Mapa: pines PIUP + tarjetas con dirección guardada.
// La barra de tarjetas y los marcadores del mapa consumen esta misma lista.
export function useMapCardItems() {
  const [piupPins, setPiupPins] = useState([]);
  const [locatedCards, setLocatedCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [pinsRes, cardsRes] = await Promise.allSettled([
      axios.get(`${API}/map-pins`, { params: { min_lat: -90, max_lat: 90, min_lng: -180, max_lng: 180, limit: 200 } }),
      axios.get(`${API}/map-pins/cards-located`, { params: { limit: 200 } }),
    ]);
    if (pinsRes.status === "fulfilled") setPiupPins((pinsRes.value.data?.pins || []).filter(hasLoc).map((p) => ({ ...p, kind: "piup", name: p.title })));
    if (cardsRes.status === "fulfilled") setLocatedCards((cardsRes.value.data?.cards || []).filter(hasLoc).map((c) => ({ ...c, kind: "card", card_id: c.id })));
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, [refresh]);

  const seen = new Set(piupPins.map((p) => p.card_id));
  const items = [...piupPins, ...locatedCards.filter((c) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; })];
  return { items, piupPins, locatedCards, loading, refresh };
}
