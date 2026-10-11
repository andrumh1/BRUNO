import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Pencil, Trash2, Plus, ChevronUp, ChevronDown, X, ListVideo, Lock, Globe } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtClock } from "@/components/reels/LongVideoExtras";
import { BottomSheet } from "@/components/reels/ReelSheets";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const VideoRow = ({ v, i, seriesId, editing, onUp, onDown, onRemove }) => (
  <div className="flex items-center gap-3 rounded-2xl bg-card/60 border border-border/40 p-2" data-testid={`series-video-${v.id}`}>
    <span className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
    <Link to={`/video/${v.id}?series=${seriesId}`} className="relative w-24 h-14 rounded-xl overflow-hidden bg-black/70 shrink-0">{v.thumb && <img src={v.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}<span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white rounded px-1">{fmtClock(v.duration)}</span></Link>
    <Link to={`/video/${v.id}?series=${seriesId}`} className="min-w-0 flex-1"><p className="text-sm font-medium line-clamp-2">{v.title || "Video"}</p><p className="text-[11px] text-muted-foreground">{v.views} vistas · {v.likes} me gusta{v.visibility !== "public" ? " · no público" : ""}</p></Link>
    {editing && (
      <div className="flex flex-col gap-0.5">
        <button onClick={onUp} className="w-7 h-7 rounded-full hover:bg-foreground/[0.06] grid place-items-center" aria-label="Subir" data-testid={`series-up-${v.id}`}><ChevronUp className="w-4 h-4" /></button>
        <button onClick={onDown} className="w-7 h-7 rounded-full hover:bg-foreground/[0.06] grid place-items-center" aria-label="Bajar" data-testid={`series-down-${v.id}`}><ChevronDown className="w-4 h-4" /></button>
        <button onClick={onRemove} className="w-7 h-7 rounded-full hover:bg-destructive/10 text-destructive grid place-items-center" aria-label="Quitar" data-testid={`series-remove-${v.id}`}><X className="w-4 h-4" /></button>
      </div>
    )}
  </div>
);

/** Selector de videos largos propios para añadir a la serie. */
const AddVideosSheet = ({ token, exclude, onAdd, onClose }) => {
  const [list, setList] = useState(null);
  useEffect(() => { axios.get(`${API}/series/candidates`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setList(r.data.filter((v) => !exclude.includes(v.id)))).catch(() => setList([])); }, [token, exclude]);
  return (
    <BottomSheet open onClose={onClose} title="Añadir videos largos" testid="series-add-sheet" height="70vh">
      <div className="px-4 pb-8 space-y-1.5 overflow-y-auto">
        {list === null ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-8" /> : list.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No tienes más videos de 3+ minutos. Sube uno desde Crear.</p>
          : list.map((v) => <button key={v.id} onClick={() => onAdd(v)} className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-foreground/[0.04] text-left" data-testid={`series-candidate-${v.id}`}><div className="w-20 h-12 rounded-lg overflow-hidden bg-black/70 shrink-0">{v.thumb && <img src={v.thumb} alt="" className="w-full h-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="text-sm line-clamp-2">{v.title}</p><p className="text-[11px] text-muted-foreground">{fmtClock(v.duration)}</p></div><Plus className="w-4 h-4 text-primary" /></button>)}
      </div>
    </BottomSheet>
  );
};

export default function SeriesPage() {
  const { seriesId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const isNew = seriesId === "new";
  const [s, setS] = useState(isNew ? { title: "", description: "", visibility: "public", videos: [], is_owner: true, count: 0, total_duration: 0 } : null);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => { if (!isNew) axios.get(`${API}/series/${seriesId}`, { headers }).then((r) => setS(r.data)).catch((e) => setErr(e?.response?.data?.detail || "Serie no encontrada")); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, token]);

  const move = (i, d) => setS((p) => { const v = [...p.videos]; const j = i + d; if (j < 0 || j >= v.length) return p; [v[i], v[j]] = [v[j], v[i]]; return { ...p, videos: v }; });
  const save = async () => {
    if (!s.title || s.title.trim().length < 2) { brunoToast.error("Escribe un título"); return; }
    setSaving(true);
    const body = { title: s.title, description: s.description, visibility: s.visibility, video_ids: s.videos.map((v) => v.id) };
    try {
      const r = isNew ? await axios.post(`${API}/series`, body, { headers }) : await axios.put(`${API}/series/${seriesId}`, body, { headers });
      setS(r.data); setEditing(false); brunoToast.success("Serie guardada");
      if (isNew) navigate(`/series/${r.data.id}`, { replace: true });
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 4000); return; }
    try { await axios.delete(`${API}/series/${seriesId}`, { headers }); brunoToast.success("Serie eliminada. Los videos no se borran."); navigate(-1); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo eliminar"); }
  };

  if (err) return <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="series-error"><div><ListVideo className="w-10 h-10 mx-auto text-muted-foreground" /><p className="mt-2 text-sm">{err}</p><button onClick={() => navigate(-1)} className="mt-4 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold">Volver</button></div></div>;
  if (!s) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const first = s.videos[0];
  return (
    <div className="min-h-screen bg-background" data-testid="series-page" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 16px)" }}>
      <div className="relative h-56 bg-black/80">
        {s.cover_url && <img src={s.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute left-3 w-10 h-10 rounded-full bg-black/40 text-white grid place-items-center" style={{ top: "calc(var(--safe-top, 0px) + 10px)" }} aria-label="Volver" data-testid="series-back"><ArrowLeft className="w-5 h-5" /></button>
        {s.is_owner && !editing && (
          <div className="absolute right-3 flex gap-2" style={{ top: "calc(var(--safe-top, 0px) + 10px)" }}>
            <button onClick={() => setEditing(true)} className="h-10 px-3 rounded-full bg-black/40 text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="series-edit"><Pencil className="w-3.5 h-3.5" />Editar</button>
            <button onClick={remove} className={`h-10 rounded-full text-white grid place-items-center transition-colors ${confirmDel ? "px-3 bg-destructive text-xs font-bold" : "w-10 bg-black/40"}`} aria-label="Eliminar serie" data-testid="series-delete">{confirmDel ? "¿Eliminar? Confirmar" : <Trash2 className="w-4 h-4" />}</button>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ListVideo className="w-3.5 h-3.5" />Serie · {s.count} videos · {fmtClock(s.total_duration)}{s.visibility === "private" && <Lock className="w-3 h-3 ml-1" />}</p>
          {editing ? <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Título de la serie" maxLength={80} className="w-full bg-transparent text-2xl font-bold outline-none border-b border-border/60 placeholder:text-muted-foreground/60" data-testid="series-title-input" />
            : <h1 className="text-2xl font-bold" data-testid="series-title">{s.title}</h1>}
          {s.owner && <Link to={`/profile/${s.owner.id}`} className="text-sm text-muted-foreground" data-testid="series-owner">{s.owner.name}</Link>}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-3 space-y-3">
        {editing ? (
          <>
            <textarea value={s.description || ""} onChange={(e) => setS({ ...s, description: e.target.value })} placeholder="Descripción (opcional)" rows={2} maxLength={500} className="w-full rounded-xl bg-foreground/[0.04] px-3 py-2 text-sm outline-none" data-testid="series-description-input" />
            <div className="flex items-center gap-2 text-sm">
              <button onClick={() => setS({ ...s, visibility: s.visibility === "public" ? "private" : "public" })} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 h-9 text-xs font-semibold" data-testid="series-visibility-toggle">{s.visibility === "public" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}{s.visibility === "public" ? "Pública" : "Privada (solo tú)"}</button>
              <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 h-9 text-xs font-semibold" data-testid="series-add-videos"><Plus className="w-3.5 h-3.5" />Añadir videos</button>
              <div className="flex-1" />
              {!isNew && <button onClick={() => { setEditing(false); axios.get(`${API}/series/${seriesId}`, { headers }).then((r) => setS(r.data)); }} className="h-9 px-3 text-xs font-semibold text-muted-foreground" data-testid="series-cancel">Cancelar</button>}
              <button onClick={save} disabled={saving} className="h-9 px-4 rounded-full bg-primary text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="series-save">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Guardar</button>
            </div>
          </>
        ) : (
          <>
            {s.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="series-description">{s.description}</p>}
            {first && <button onClick={() => navigate(`/video/${first.id}?series=${s.id}`)} className="w-full h-11 rounded-full bg-primary text-white font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" data-testid="series-play"><Play className="w-4 h-4 fill-current" />Reproducir serie</button>}
          </>
        )}
        <div className="space-y-1.5" data-testid="series-videos">
          {s.videos.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{editing ? "Añade tus videos largos (3+ min) a esta serie." : "Esta serie aún no tiene videos."}</p>}
          {s.videos.map((v, i) => <VideoRow key={v.id} v={v} i={i} seriesId={s.id} editing={editing} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => setS({ ...s, videos: s.videos.filter((x) => x.id !== v.id) })} />)}
        </div>
      </div>
      {adding && <AddVideosSheet token={token} exclude={s.videos.map((v) => v.id)} onAdd={(v) => { setS((p) => ({ ...p, videos: [...p.videos, v] })); setAdding(false); }} onClose={() => setAdding(false)} />}
    </div>
  );
}
