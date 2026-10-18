/**
 * StoryPlacePicker — adjunta un lugar guardado (Mis lugares del Mapa) a una historia.
 * La historia con `location` aparece en la barra de tarjetas del Mapa (/stories/located).
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { MapPin, X, Loader2, Plus } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function StoryPlacePicker({ token, value, onChange, onClose }) {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!token) { setSaved([]); return; }
    axios.get(`${API}/places/saved`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setSaved(r.data?.items || [])).catch(() => setSaved([]));
  }, [token]);

  const list = (saved || []).filter((p) => !q.trim() || `${p.name} ${p.address || ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div data-testid="story-place-picker">
      <label className="text-sm font-medium mb-2 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-primary" />Lugar (se verá en el Mapa)</label>
      {value ? (
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2" data-testid="story-place-selected">
          <MapPin className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{value.name}</p>{value.address && <p className="text-[11px] text-muted-foreground truncate">{value.address}</p>}</div>
          <button onClick={() => onChange(null)} className="w-7 h-7 rounded-full bg-background grid place-items-center" aria-label="Quitar lugar" data-testid="story-place-remove"><X className="w-3.5 h-3.5" /></button>
        </div>
      ) : saved === null ? (
        <div className="py-3 grid place-items-center"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
      ) : saved.length === 0 ? (
        <div className="rounded-xl bg-muted px-3 py-3 text-xs text-muted-foreground" data-testid="story-place-empty">
          Aún no tienes lugares guardados. Guárdalos desde el Mapa → Buscar cerca.
          <button onClick={() => { onClose?.(); navigate("/map?nearby=1"); }} className="ml-1 text-primary font-semibold" data-testid="story-place-go-map">Ir al Mapa</button>
        </div>
      ) : (
        <div className="space-y-2">
          {saved.length > 4 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en mis lugares" className="w-full h-9 px-3 rounded-full bg-muted text-sm outline-none" data-testid="story-place-search" />}
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {list.map((p) => (
              <button key={p.id} onClick={() => onChange({ lat: p.lat, lng: p.lng, name: p.name, address: p.address || null, place_id: p.place_id })} className="shrink-0 max-w-[160px] rounded-xl bg-muted hover:bg-muted/70 px-3 py-2 text-left" data-testid={`story-place-${p.place_id}`}>
                <p className="text-xs font-semibold truncate flex items-center gap-1"><Plus className="w-3 h-3 text-primary" />{p.name}</p>
                {p.address && <p className="text-[10px] text-muted-foreground truncate">{p.address}</p>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
