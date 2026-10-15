/* Series del creador como "destacadas" (círculos estilo historias) bajo la cabecera del perfil. */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ListVideo } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function SeriesHighlights({ userId, token }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    if (!userId) return;
    axios.get(`${API}/users/${userId}/series`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => setList(Array.isArray(r.data) ? r.data : [])).catch(() => setList([]));
  }, [userId, token]);
  if (!list.length) return null;
  return (
    <div className="px-4 pb-3" data-testid="series-highlights">
      <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
        {list.map((s) => (
          <Link key={s.id} to={`/series/${s.id}`} className="flex flex-col items-center gap-1.5 shrink-0 w-[68px] active:scale-95 transition-transform" data-testid={`series-highlight-${s.id}`}>
            <span className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-primary via-orange-400 to-amber-300">
              <span className="w-full h-full rounded-full overflow-hidden bg-muted grid place-items-center border-2 border-background">
                {s.cover_url ? <img src={s.cover_url} alt="" className="w-full h-full object-cover" loading="lazy" /> : <ListVideo className="w-6 h-6 text-muted-foreground" />}
              </span>
            </span>
            <span className="text-[11px] leading-tight text-center line-clamp-2 w-full">{s.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
