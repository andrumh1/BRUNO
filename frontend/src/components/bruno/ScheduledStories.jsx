import React, { useEffect, useState } from "react";
import axios from "axios";
import { CalendarClock, Trash2, Send, Music2, Pencil, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const toLocalInput = (iso) => { const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

/** ScheduledStories — gestor de historias programadas (editar hora · publicar ya · cancelar). */
export default function ScheduledStories() {
  const { token } = useAuth();
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(null);
  const h = { headers: { Authorization: `Bearer ${token}` } };
  const load = () => token && axios.get(`${API}/stories/scheduled/mine`, h).then((r) => setItems(r.data || [])).catch(() => {});
  useEffect(() => { load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (id, fn, ok) => { setBusy(id); try { await fn(); brunoToast.success(ok); await load(); } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo completar"); } finally { setBusy(null); setEditing(null); } };
  if (!items.length) return null;

  return (
    <section className="mx-4 mb-4 rounded-2xl border border-border/60 bg-card/60 p-3" data-testid="scheduled-stories">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center"><CalendarClock className="w-4 h-4" /></span>
        <h3 className="text-sm font-bold">Historias programadas <span className="text-muted-foreground font-normal">· {items.length}</span></h3>
      </div>
      <ul className="space-y-2">
        {items.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl bg-background/70 border border-border/50 p-2" data-testid={`scheduled-story-${s.id}`}>
            <div className="w-12 h-16 rounded-lg overflow-hidden bg-muted shrink-0">{s.media_url && <img src={s.media_url} alt="" className="w-full h-full object-cover" />}</div>
            <div className="flex-1 min-w-0">
              {editing === s.id ? (
                <div className="flex items-center gap-1.5">
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="h-8 flex-1 rounded-lg border border-border bg-background px-2 text-xs" data-testid="scheduled-story-when" />
                  <button onClick={() => act(s.id, () => axios.patch(`${API}/stories/scheduled/${s.id}`, { scheduled_at: new Date(when).toISOString() }, h), "Hora actualizada")} className="w-8 h-8 rounded-full bg-primary text-primary-foreground grid place-items-center" data-testid="scheduled-story-save"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-full bg-muted grid place-items-center"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <p className="text-xs font-semibold" data-testid="scheduled-story-date">{new Date(s.scheduled_at).toLocaleString([], { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.caption || "Sin texto"}{s.music?.title ? <span className="inline-flex items-center gap-0.5 ml-1.5 text-primary"><Music2 className="w-3 h-3" />{s.music.title}</span> : null}</p>
                </>
              )}
            </div>
            {editing !== s.id && (
              <div className="flex items-center gap-1 shrink-0">
                <button title="Cambiar hora" onClick={() => { setEditing(s.id); setWhen(toLocalInput(s.scheduled_at)); }} className="w-8 h-8 rounded-full bg-muted grid place-items-center active:scale-90" data-testid="scheduled-story-edit"><Pencil className="w-3.5 h-3.5" /></button>
                <button title="Publicar ahora" disabled={busy === s.id} onClick={() => act(s.id, () => axios.post(`${API}/stories/scheduled/${s.id}/publish-now`, {}, h), "Historia publicada")} className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center active:scale-90" data-testid="scheduled-story-publish"><Send className="w-3.5 h-3.5" /></button>
                <button title="Cancelar" disabled={busy === s.id} onClick={() => act(s.id, () => axios.delete(`${API}/stories/scheduled/${s.id}`, h), "Historia cancelada")} className="w-8 h-8 rounded-full bg-destructive/10 text-destructive grid place-items-center active:scale-90" data-testid="scheduled-story-cancel"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
