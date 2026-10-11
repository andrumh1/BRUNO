import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ListVideo, Loader2, Plus, Lock } from "lucide-react";
import { fmtClock } from "@/components/reels/LongVideoExtras";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** Series (listas de videos largos) de un creador; `own` muestra el botón de crear. */
export function SeriesList({ userId, token, own = false }) {
  const [list, setList] = useState(null);
  useEffect(() => {
    if (!userId) return;
    axios.get(`${API}/users/${userId}/series`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => setList(r.data)).catch(() => setList([]));
  }, [userId, token]);
  if (list === null) return <div className="py-10 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-3" data-testid="series-list">
      {own && <Link to="/series/new" className="flex items-center justify-center gap-2 h-11 rounded-2xl border border-dashed border-border/70 text-sm font-semibold hover:bg-foreground/[0.03]" data-testid="series-create"><Plus className="w-4 h-4" />Nueva serie</Link>}
      {list.length === 0 && <div className="text-center py-10"><ListVideo className="w-10 h-10 mx-auto text-muted-foreground mb-2" /><p className="text-sm text-muted-foreground">{own ? "Agrupa tus videos largos en series para que se reproduzcan seguidos." : "Este creador aún no tiene series."}</p></div>}
      {list.map((s) => (
        <Link key={s.id} to={`/series/${s.id}`} className="flex items-center gap-3 rounded-2xl bg-card/60 border border-border/40 p-2 hover:bg-card/90 transition-colors" data-testid={`series-item-${s.id}`}>
          <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-black/70 shrink-0">{s.cover_url && <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" />}<span className="absolute inset-y-0 right-0 w-10 bg-black/60 text-white grid place-items-center text-[11px] font-bold"><span className="text-center leading-tight"><ListVideo className="w-3.5 h-3.5 mx-auto" />{s.count}</span></span></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate flex items-center gap-1">{s.title}{s.visibility === "private" && <Lock className="w-3 h-3 text-muted-foreground" />}</p><p className="text-xs text-muted-foreground truncate">{s.count} videos · {fmtClock(s.total_duration)}</p>{s.description && <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>}</div>
        </Link>
      ))}
    </div>
  );
}
