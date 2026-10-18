/**
 * NearbyPlacesPanel — buscador de recomendaciones cercanas (restaurantes, negocios, servicios).
 * Muestra resultados en LISTA (nunca como marcadores del mapa). Pide ubicación solo al usarse;
 * si no hay permiso, permite escribir ciudad/dirección/zona.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { Search, MapPin, Navigation, LocateFixed, X, Loader2, RefreshCw, Phone, Globe, Clock, ChevronRight, AlertCircle } from "lucide-react";

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

function PlaceRow({ p, onPick }) {
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
      className="absolute z-[55] left-2 right-2 md:left-3 md:right-auto md:w-[380px] lg:w-[420px] bg-background/95 backdrop-blur-2xl rounded-[24px] border border-border/50 shadow-2xl flex flex-col overflow-hidden"
      style={{ top: "calc(var(--safe-top) + 64px)", bottom: "calc(var(--nav-reserve, 96px) + 290px)", minHeight: "260px" }}
      data-testid="nearby-panel"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <Search className="w-4 h-4 text-primary" />
        <h2 className="font-bold text-sm flex-1">Recomendaciones cerca de ti</h2>
        {origin && <button onClick={search} className="w-8 h-8 rounded-full bg-muted grid place-items-center" aria-label="Actualizar" data-testid="nearby-refresh"><RefreshCw className={`w-3.5 h-3.5 ${state.status === "loading" ? "animate-spin" : ""}`} /></button>}
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted grid place-items-center" aria-label="Cerrar" data-testid="nearby-close"><X className="w-4 h-4" /></button>
      </div>

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
          <ul className="space-y-2">{state.items.map((p) => <PlaceRow key={p.id} p={p} onPick={onPick} />)}</ul>
        )}
      </div>
      {state.attribution && <p className="px-4 pb-2 text-[9px] text-muted-foreground" data-testid="nearby-attribution">{state.attribution}</p>}
    </motion.aside>
  );
}
