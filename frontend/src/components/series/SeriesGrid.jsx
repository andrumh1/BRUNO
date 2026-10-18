/**
 * SeriesGrid — pestaña "Series" de Reels: series públicas (solo publicadas y con capítulos públicos)
 * + "Mis series" del creador (incluye borradores privados, solo visibles para él). Reutiliza /series/* y SeriesPage.
 */
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ListVideo, Plus, Loader2, Lock, Play } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (s) => (!s ? "" : s >= 3600 ? `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min` : `${Math.max(1, Math.round(s / 60))} min`);

function SeriesCard({ s, onOpen }) {
  return (
    <button onClick={() => onOpen(s)} className="text-left rounded-2xl overflow-hidden bruno-glass border border-border/40 group" data-testid={`series-card-${s.id}`}>
      <div className="relative aspect-[16/10] bg-black/70">
        {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full grid place-items-center"><ListVideo className="w-8 h-8 text-white/60" /></div>}
        <span className="absolute left-2 bottom-2 text-[10px] font-semibold bg-black/70 text-white rounded-full px-2 py-0.5">{s.count} cap.{s.total_duration ? ` · ${fmt(s.total_duration)}` : ""}</span>
        {s.visibility !== "public" && <span className="absolute right-2 top-2 inline-flex items-center gap-1 text-[10px] font-semibold bg-black/70 text-white rounded-full px-2 py-0.5" data-testid={`series-draft-${s.id}`}><Lock className="w-3 h-3" />Borrador</span>}
        <span className="absolute inset-0 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity"><span className="w-11 h-11 rounded-full bg-white/90 grid place-items-center"><Play className="w-5 h-5 text-black ml-0.5" /></span></span>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-semibold line-clamp-1">{s.title}</p>
        <p className="text-[11px] text-muted-foreground line-clamp-1">{s.owner?.name || "Creador"}{s.description ? ` · ${s.description}` : ""}</p>
      </div>
    </button>
  );
}

export default function SeriesGrid({ token }) {
  const navigate = useNavigate();
  const [pub, setPub] = useState(null);
  const [mine, setMine] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    axios.get(`${API}/series/public`, { headers }).then((r) => setPub(r.data || [])).catch(() => { setPub([]); setError(true); });
    if (token) axios.get(`${API}/series/mine`, { headers }).then((r) => setMine(r.data || [])).catch(() => {});
  }, [token]);

  const open = (s) => navigate(`/series/${s.id}`);

  return (
    <div className="h-full overflow-y-auto px-4 pb-32" style={{ paddingTop: "calc(var(--safe-top) + 64px)" }} data-testid="series-grid">
      {token && (
        <section className="mb-5" data-testid="series-mine">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold">Mis series</h2>
            <button onClick={() => navigate("/series/new")} className="h-9 px-3 rounded-full bg-primary text-primary-foreground text-xs font-semibold inline-flex items-center gap-1.5 shadow-md shadow-primary/25" data-testid="series-create-btn"><Plus className="w-4 h-4" />Crear serie</button>
          </div>
          {mine.length === 0 ? (
            <p className="text-xs text-muted-foreground bruno-glass rounded-2xl border border-border/40 p-3">Organiza tus videos en capítulos ordenados y publícalos como serie. Los borradores solo los ves tú.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{mine.map((s) => <SeriesCard key={s.id} s={s} onOpen={open} />)}</div>
          )}
        </section>
      )}
      <section data-testid="series-public">
        <h2 className="text-base font-bold mb-2">Series publicadas</h2>
        {pub === null ? <div className="grid place-items-center py-16" data-testid="series-loading"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : error ? <p className="text-sm text-muted-foreground text-center py-10" data-testid="series-error">No pudimos cargar las series. Inténtalo de nuevo.</p>
          : pub.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10" data-testid="series-empty">Aún no hay series publicadas. {token ? "¡Crea la primera!" : "Inicia sesión para crear la tuya."}</p>
          : <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">{pub.map((s) => <SeriesCard key={s.id} s={s} onOpen={open} />)}</div>}
      </section>
    </div>
  );
}
