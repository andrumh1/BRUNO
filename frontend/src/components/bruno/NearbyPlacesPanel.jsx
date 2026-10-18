/**
 * NearbyPlacesPanel — buscador de recomendaciones cercanas (restaurantes, negocios, servicios).
 * Muestra resultados en LISTA (nunca como marcadores del mapa). Pide ubicación solo al usarse;
 * si no hay permiso, permite escribir ciudad/dirección/zona.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Navigation, LocateFixed, X, Loader2, RefreshCw, Phone, Globe, Clock, ChevronRight, AlertCircle, Bookmark, BookmarkCheck, CreditCard, Trash2, Send, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const fmtDist = (m) => (m == null ? null : m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`);

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function LocationPicker({ origin, onOrigin, locating, onUseGps, gpsDenied, mapCenter }) {
  const [manual, setManual] = useState("");
  const dq = useDebounced(manual, 450);
  const [sugs, setSugs] = useState([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (dq.trim().length < 3) { setSugs([]); return; }
    let alive = true; setBusy(true);
    axios.get(`${API}/places/geocode`, { params: { q: dq.trim(), limit: 5 } }).then((r) => alive && setSugs(r.data?.results || [])).catch(() => alive && setSugs([])).finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [dq]);
  return (
    <div className="space-y-2" data-testid="nearby-location-picker">
      <div className="flex items-center gap-2">
        <button onClick={onUseGps} disabled={locating} className={`flex-1 h-10 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${origin?.source === "gps" ? "bg-primary text-white" : "bg-muted text-foreground"}`} data-testid="nearby-use-gps">
          {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}{origin?.source === "gps" ? "Usando tu ubicación" : "Usar mi ubicación"}
        </button>
        {mapCenter && <button onClick={() => { const c = mapCenter(); if (c) onOrigin({ ...c, label: "Zona visible del mapa", source: "map" }); }} className={`h-10 px-3 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${origin?.source === "map" ? "bg-primary text-white" : "bg-muted text-foreground"}`} data-testid="nearby-use-map-center"><MapPin className="w-4 h-4" />Zona del mapa</button>}
      </div>
      {gpsDenied && <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1" data-testid="nearby-gps-denied"><AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />Sin permiso de ubicación. Escribe una ciudad, dirección o zona para buscar igual.</p>}
      <div className="relative">
        <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Ciudad, dirección o zona (ej. Chapinero, Bogotá)" className="w-full h-10 pl-9 pr-8 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" data-testid="nearby-manual-input" />
        {busy && <Loader2 className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>
      {sugs.length > 0 && (
        <ul className="rounded-xl border border-border/60 bg-background overflow-hidden" data-testid="nearby-geocode-suggestions">
          {sugs.map((s) => (
            <li key={s.id}><button onClick={() => { onOrigin({ lat: s.lat, lng: s.lng, label: s.display_name?.split(",").slice(0, 3).join(", ") || s.name, source: "manual" }); setSugs([]); setManual(""); }} className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2" data-testid={`nearby-geocode-${s.id}`}><MapPin className="w-3.5 h-3.5 text-primary shrink-0" /><span className="truncate">{s.display_name}</span></button></li>
          ))}
        </ul>
      )}
      {origin && origin.source !== "gps" && <p className="text-[11px] text-muted-foreground truncate" data-testid="nearby-origin-label">Buscando cerca de: <span className="font-semibold text-foreground">{origin.label}</span></p>}
    </div>
  );
}

// Selector compacto de chats para enviar un lugar (nombre, dirección y "Cómo llegar") como mensaje real.
function ShareChatPicker({ place, token, onClose }) {
  const [chats, setChats] = useState(null);
  const [sent, setSent] = useState({});
  useEffect(() => {
    axios.get(`${API}/chats`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setChats((Array.isArray(r.data) ? r.data : []).slice(0, 30))).catch(() => setChats([]));
  }, [token]);
  const send = async (chat) => {
    if (sent[chat.id]) return;
    setSent((x) => ({ ...x, [chat.id]: "sending" }));
    try {
      const dir = `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}`;
      await axios.post(`${API}/chats/${chat.id}/messages`, {
        content: `📍 ${place.name}${place.address ? ` · ${place.address}` : ""}\nCómo llegar: ${dir}`,
        message_type: "location_share",
        attachments: [{ type: "location", share_type: "place", label: "Lugar recomendado", name: place.name, address: place.address || null, category_label: place.category_label || null, lat: place.lat, lng: place.lng, place_id: place.place_id || place.id, directions_url: dir }],
      }, { headers: { Authorization: `Bearer ${token}` } });
      setSent((x) => ({ ...x, [chat.id]: "sent" })); brunoToast.success(`Lugar enviado a ${chat.name || chat.other_participants?.[0]?.name || "chat"}`);
    } catch (e) { setSent((x) => ({ ...x, [chat.id]: null })); brunoToast.error(e?.response?.data?.detail || "No se pudo enviar"); }
  };
  const nameOf = (c) => c.name || c.other_participants?.map((u) => u.name).join(", ") || "Chat";
  const avatarOf = (c) => c.avatar_url || c.other_participants?.[0]?.avatar_url;
  return (
    <div className="rounded-2xl border border-border/60 bg-card/90 p-3" data-testid="nearby-share-picker">
      <div className="flex items-center justify-between mb-2"><p className="text-xs font-semibold truncate">Enviar "{place.name}" a…</p><button onClick={onClose} className="w-6 h-6 rounded-full bg-muted grid place-items-center" aria-label="Cerrar" data-testid="nearby-share-close"><X className="w-3 h-3" /></button></div>
      {chats === null ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : chats.length === 0 ? <p className="text-[11px] text-muted-foreground">Aún no tienes chats.</p> : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
          {chats.map((c) => (
            <button key={c.id} onClick={() => send(c)} disabled={!!sent[c.id]} className="flex flex-col items-center gap-1 shrink-0 w-14" data-testid={`nearby-share-chat-${c.id}`}>
              <span className="relative w-11 h-11 rounded-full bg-muted overflow-hidden grid place-items-center">{avatarOf(c) ? <img src={avatarOf(c)} alt="" className="w-full h-full object-cover" /> : <span className="text-sm font-bold">{nameOf(c).charAt(0)}</span>}{sent[c.id] === "sent" && <span className="absolute inset-0 bg-primary/80 grid place-items-center text-white"><Check className="w-5 h-5" /></span>}{sent[c.id] === "sending" && <span className="absolute inset-0 bg-black/40 grid place-items-center text-white"><Loader2 className="w-4 h-4 animate-spin" /></span>}</span>
              <span className="text-[10px] truncate max-w-full">{nameOf(c)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceRow({ p, onPick, saved, onToggleSave, onCreateCard, onRemove, onShare }) {
  const dir = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  return (
    <li className="rounded-2xl border border-border/60 bg-card/80 p-3" data-testid={`nearby-place-${p.id}`}>
      <div className="flex items-start gap-3">
        <button onClick={() => onPick?.(p)} className="flex-1 min-w-0 text-left" data-testid={`nearby-place-pick-${p.id}`}>
          <p className="font-semibold text-sm truncate">{p.name}</p>
          <p className="text-[11px] text-muted-foreground truncate">{p.category_label}{p.cuisine ? ` · ${p.cuisine}` : ""}{p.rating ? ` · ★ ${p.rating}${p.rating_count ? ` (${p.rating_count})` : ""}` : ""}</p>
          {p.address && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{p.address}</p>}
          {p.opening_hours && <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate"><Clock className="w-3 h-3 shrink-0" />{p.opening_hours}</p>}
          {p.open_now != null && <p className={`text-[10px] mt-0.5 ${p.open_now ? "text-emerald-500" : "text-red-500"}`}>{p.open_now ? "Abierto ahora" : "Cerrado ahora"}</p>}
        </button>
        <div className="text-right shrink-0">
          {p.distance_m != null && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-primary tabular-nums" data-testid={`nearby-distance-${p.id}`}><Navigation className="w-3 h-3" />{fmtDist(p.distance_m)}</span>}
          <div className="flex items-center gap-1 mt-1.5 justify-end">
            {onToggleSave && <button onClick={() => onToggleSave(p)} className={`w-7 h-7 rounded-full grid place-items-center ${saved ? "bg-primary/15 text-primary" : "bg-muted"}`} aria-label={saved ? "Quitar de mis lugares" : "Guardar lugar"} data-testid={`nearby-save-${p.id}`}>{saved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}</button>}
            {onShare && <button onClick={() => onShare(p)} className="w-7 h-7 rounded-full bg-muted grid place-items-center" aria-label="Compartir en un chat" title="Enviar a un chat" data-testid={`nearby-share-${p.id}`}><Send className="w-3.5 h-3.5" /></button>}
            {onCreateCard && <button onClick={() => onCreateCard(p)} className="w-7 h-7 rounded-full bg-muted grid place-items-center" aria-label="Crear tarjeta BRUNO con este lugar" title="Crear tarjeta" data-testid={`nearby-card-${p.id}`}><CreditCard className="w-3.5 h-3.5" /></button>}
            {onRemove && <button onClick={() => onRemove(p)} className="w-7 h-7 rounded-full bg-muted grid place-items-center text-destructive" aria-label="Quitar" data-testid={`nearby-remove-${p.id}`}><Trash2 className="w-3.5 h-3.5" /></button>}
            {p.phone && <a href={`tel:${p.phone}`} className="w-7 h-7 rounded-full bg-muted grid place-items-center" aria-label="Llamar" data-testid={`nearby-call-${p.id}`}><Phone className="w-3.5 h-3.5" /></a>}
            {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full bg-muted grid place-items-center" aria-label="Sitio web"><Globe className="w-3.5 h-3.5" /></a>}
            <a href={dir} target="_blank" rel="noopener noreferrer" className="h-7 px-2.5 rounded-full bg-primary text-white text-[11px] font-semibold inline-flex items-center gap-1" data-testid={`nearby-directions-${p.id}`}>Ir <ChevronRight className="w-3 h-3" /></a>
          </div>
        </div>
      </div>
    </li>
  );
}

export default function NearbyPlacesPanel({ onClose, onPick, mapCenter }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState("search"); // search | saved
  const [sharing, setSharing] = useState(null);
  const [saved, setSaved] = useState([]);
  const savedByPlace = useMemo(() => Object.fromEntries(saved.map((s) => [s.place_id, s])), [saved]);
  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState("restaurant");
  const [query, setQuery] = useState("");
  const dq = useDebounced(query, 500);
  const [origin, setOrigin] = useState(null);
  const [locating, setLocating] = useState(false);
  const [gpsDenied, setGpsDenied] = useState(false);
  const [state, setState] = useState({ status: "idle", items: [], provider: null, attribution: null, error: null });
  const [radius, setRadius] = useState(1500);
  const reqRef = useRef(0);

  useEffect(() => { axios.get(`${API}/places/categories`).then((r) => setCategories(r.data?.categories || [])).catch(() => {}); }, []);
  useEffect(() => { if (!token) return; axios.get(`${API}/places/saved`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setSaved(r.data?.items || [])).catch(() => {}); }, [token]);

  const toggleSave = async (p) => {
    if (!token) { brunoToast.error("Inicia sesión para guardar lugares"); return; }
    const headers = { Authorization: `Bearer ${token}` };
    const existing = savedByPlace[p.place_id || p.id];
    try {
      if (existing) { await axios.delete(`${API}/places/saved/${existing.id}`, { headers }); setSaved((s) => s.filter((x) => x.id !== existing.id)); brunoToast.success("Quitado de mis lugares"); }
      else {
        const r = await axios.post(`${API}/places/saved`, { place_id: p.id, name: p.name, category: p.category, category_label: p.category_label, address: p.address, lat: p.lat, lng: p.lng, phone: p.phone, website: p.website, opening_hours: p.opening_hours, provider: state.provider }, { headers });
        setSaved((s) => [r.data, ...s.filter((x) => x.id !== r.data.id)]); brunoToast.success("Guardado en mis lugares");
      }
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar"); }
  };
  const createCard = (p) => {
    try { localStorage.setItem("bruno_pending_place", JSON.stringify({ name: p.name, category_label: p.category_label, address: p.address, lat: p.lat, lng: p.lng, phone: p.phone, website: p.website })); } catch { /* ignore */ }
    navigate("/cards/new?type=lugares");
  };

  const useGps = () => {
    if (!navigator.geolocation) { setGpsDenied(true); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setGpsDenied(false); setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Tu ubicación", source: "gps" }); },
      () => { setLocating(false); setGpsDenied(true); },
      { timeout: 10000, maximumAge: 120000, enableHighAccuracy: false },
    );
  };

  const search = useMemo(() => async () => {
    if (!origin) return;
    if (!dq.trim() && !category) return;
    const id = ++reqRef.current;
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const r = await axios.get(`${API}/places/nearby`, { params: { lat: origin.lat, lng: origin.lng, q: dq.trim() || undefined, category: dq.trim() ? undefined : category, radius_m: radius, limit: 25 } });
      if (id !== reqRef.current) return;
      setState({ status: "done", items: r.data?.items || [], provider: r.data?.provider, attribution: r.data?.attribution, error: null });
    } catch (e) {
      if (id !== reqRef.current) return;
      setState((s) => ({ ...s, status: "error", error: e?.response?.data?.detail || "No pudimos buscar lugares. Revisa tu conexión e inténtalo de nuevo." }));
    }
  }, [origin, dq, category, radius]);

  useEffect(() => { search(); }, [search]);

  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute z-[55] left-2 right-[72px] md:left-3 md:right-auto md:w-[380px] lg:w-[420px] bg-background/95 backdrop-blur-2xl rounded-[24px] border border-border/50 shadow-2xl flex flex-col overflow-hidden"
      style={{ top: "calc(var(--safe-top) + 64px)", bottom: "calc(var(--nav-reserve, 96px) + 270px)", minHeight: "240px" }}
      data-testid="nearby-panel"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Search className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-sm flex-1">{view === "saved" ? "Mis lugares" : "Recomendaciones cerca de ti"}</h2>
        {token && <button onClick={() => setView(view === "saved" ? "search" : "saved")} className={`h-8 px-2.5 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${view === "saved" ? "bg-primary text-white" : "bg-muted"}`} data-testid="nearby-saved-toggle"><BookmarkCheck className="w-3.5 h-3.5" />{saved.length}</button>}
        {origin && view === "search" && <button onClick={search} className="w-8 h-8 rounded-full bg-muted grid place-items-center" aria-label="Actualizar" data-testid="nearby-refresh"><RefreshCw className={`w-3.5 h-3.5 ${state.status === "loading" ? "animate-spin" : ""}`} /></button>}
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted grid place-items-center" aria-label="Cerrar" data-testid="nearby-close"><X className="w-4 h-4" /></button>
      </div>

      {view === "saved" ? (
        <div className="flex-1 overflow-y-auto px-4 pt-1 pb-3" data-testid="nearby-saved-list">
          {sharing && <div className="mb-2"><ShareChatPicker place={sharing} token={token} onClose={() => setSharing(null)} /></div>}
          {saved.length === 0 ? <p className="text-xs text-muted-foreground text-center py-8" data-testid="nearby-saved-empty">Aún no guardas lugares. Toca el marcador <Bookmark className="w-3 h-3 inline" /> en una recomendación para volver a ella desde aquí.</p>
            : <ul className="space-y-2">{saved.map((s) => <PlaceRow key={s.id} p={{ ...s, id: s.place_id, distance_m: null }} onPick={onPick} saved onToggleSave={() => toggleSave({ ...s, id: s.place_id })} onCreateCard={createCard} onShare={setSharing} />)}</ul>}
        </div>
      ) : (<>
      <div className="px-4 space-y-2">
        <LocationPicker origin={origin} onOrigin={setOrigin} locating={locating} onUseGps={useGps} gpsDenied={gpsDenied} mapCenter={mapCenter} />
        {origin && (<>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre (ej. pizza, Juan Valdez, barbería)" className="w-full h-10 pl-9 pr-8 rounded-full bg-muted text-sm outline-none focus:ring-2 focus:ring-primary/40" data-testid="nearby-search-input" />
            {query && <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-background grid place-items-center" aria-label="Limpiar"><X className="w-3 h-3" /></button>}
          </div>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1" data-testid="nearby-categories">
            {categories.map((c) => (
              <button key={c.id} onClick={() => { setCategory(c.id); setQuery(""); }} className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${category === c.id && !query ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`} data-testid={`nearby-cat-${c.id}`}><span>{c.icon}</span>{c.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">Radio:
            {[800, 1500, 3000, 6000].map((r) => <button key={r} onClick={() => setRadius(r)} className={`h-6 px-2 rounded-full ${radius === r ? "bg-foreground text-background" : "bg-muted"}`} data-testid={`nearby-radius-${r}`}>{fmtDist(r)}</button>)}
          </div>
        </>)}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-2 pb-3" data-testid="nearby-results">
        {!origin ? (
          <p className="text-xs text-muted-foreground text-center py-6" data-testid="nearby-need-location">Para recomendarte lugares necesitamos saber desde dónde buscar: usa tu ubicación o escribe una zona.</p>
        ) : state.status === "loading" && state.items.length === 0 ? (
          <div className="grid place-items-center py-10" data-testid="nearby-loading"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : state.status === "error" ? (
          <div className="text-center py-8 space-y-2" data-testid="nearby-error"><AlertCircle className="w-6 h-6 mx-auto text-red-500" /><p className="text-xs text-muted-foreground">{state.error}</p><button onClick={search} className="h-8 px-3 rounded-full bg-primary text-white text-xs font-semibold">Reintentar</button></div>
        ) : state.status === "done" && state.items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8" data-testid="nearby-empty">No encontramos resultados en {fmtDist(radius)}. Prueba otra categoría, otro nombre o amplía el radio.</p>
        ) : (
          <>
            {sharing && <div className="mb-2"><ShareChatPicker place={sharing} token={token} onClose={() => setSharing(null)} /></div>}
            <ul className="space-y-2">{state.items.map((p) => <PlaceRow key={p.id} p={p} onPick={onPick} saved={!!savedByPlace[p.id]} onToggleSave={toggleSave} onCreateCard={token ? createCard : null} onShare={token ? setSharing : null} />)}</ul>
          </>
        )}
      </div>
      {state.attribution && <p className="px-4 pb-2 text-[9px] text-muted-foreground" data-testid="nearby-attribution">{state.attribution}</p>}
      </>)}
    </motion.aside>
  );
}
