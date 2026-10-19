import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Play, Loader2, Pencil, Trash2, Plus, ChevronUp, ChevronDown, X, ListVideo, Lock, Globe, Star, Image as ImageIcon, Check, Bell, BellRing, RotateCcw } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtClock } from "@/components/reels/LongVideoExtras";
import { BottomSheet } from "@/components/reels/ReelSheets";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Línea de reproducción del capítulo (hasta dónde lo vio) + marca "Visto"
const WatchBar = ({ progress, id }) => {
  if (!progress || (!progress.pct && !progress.completed)) return null;
  return (
    <span className="absolute inset-x-0 bottom-0 h-1 bg-white/25" data-testid={`series-watchbar-${id}`}>
      <span className={`block h-full ${progress.completed ? "bg-emerald-400" : "bg-primary"}`} style={{ width: `${progress.completed ? 100 : progress.pct}%` }} />
    </span>
  );
};

const VideoRow = ({ v, i, seriesId, editing, featured, onUp, onDown, onRemove, onFeature }) => (
  <div className={`flex items-center gap-3 rounded-2xl bg-card/60 border p-2 ${featured ? "border-primary/50" : "border-border/40"}`} data-testid={`series-video-${v.id}`}>
    <span className="w-6 text-center text-xs font-bold text-muted-foreground">{i + 1}</span>
    <Link to={`/video/${v.id}?series=${seriesId}`} className="relative w-24 h-14 rounded-xl overflow-hidden bg-black/70 shrink-0">
      {v.thumb && <img src={v.thumb} alt="" className={`w-full h-full object-cover ${v.progress?.completed ? "opacity-60" : ""}`} loading="lazy" />}
      <span className="absolute bottom-1.5 right-1 text-[10px] bg-black/70 text-white rounded px-1">{fmtClock(v.duration)}</span>
      {v.progress?.completed && <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5" data-testid={`series-watched-${v.id}`}><Check className="w-2.5 h-2.5" strokeWidth={3} />Visto</span>}
      <WatchBar progress={v.progress} id={v.id} />
    </Link>
    <Link to={`/video/${v.id}?series=${seriesId}`} className="min-w-0 flex-1">
      <p className="text-sm font-medium line-clamp-2">{v.title || "Video"}{featured && <Star className="w-3 h-3 inline ml-1 -mt-0.5 text-primary fill-primary" />}</p>
      <p className="text-[11px] text-muted-foreground">{v.progress?.completed ? "Visto" : v.progress?.pct ? `Visto ${v.progress.pct}% · retomar en ${fmtClock(v.progress.position)}` : `${v.views} vistas · ${v.likes} me gusta`}{v.visibility !== "public" ? " · no público" : ""}</p>
    </Link>
    {editing && (
      <div className="flex flex-col gap-0.5">
        <button onClick={onFeature} className={`w-7 h-7 rounded-full grid place-items-center ${featured ? "bg-primary/15 text-primary" : "hover:bg-foreground/[0.06]"}`} aria-label="Capítulo destacado" title="Capítulo destacado" data-testid={`series-feature-${v.id}`}><Star className={`w-4 h-4 ${featured ? "fill-current" : ""}`} /></button>
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
    <BottomSheet open onClose={onClose} title="Añadir videos como capítulos" testid="series-add-sheet" height="70vh">
      <div className="px-4 pb-8 space-y-1.5 overflow-y-auto">
        {list === null ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-8" /> : list.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No tienes más videos para añadir. Sube uno desde Crear.</p>
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
  const [s, setS] = useState(isNew ? { title: "", description: "", visibility: "public", videos: [], is_owner: true, count: 0, total_duration: 0, cover_url: null, featured_video_id: null } : null);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const coverInput = useRef(null);

  useEffect(() => { if (!isNew) axios.get(`${API}/series/${seriesId}`, { headers }).then((r) => setS(r.data)).catch((e) => setErr(e?.response?.data?.detail || "Serie no encontrada")); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, token]);

  const move = (i, d) => setS((p) => { const v = [...p.videos]; const j = i + d; if (j < 0 || j >= v.length) return p; [v[i], v[j]] = [v[j], v[i]]; return { ...p, videos: v }; });
  const uploadCover = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await axios.post(`${API}/upload/image?folder=bruno/series`, fd, { headers });
      setS((p) => ({ ...p, cover_url: up.data.url, cover_custom: true }));
      brunoToast.success("Portada lista. Guarda la serie para aplicarla.");
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo subir la portada"); }
    finally { setUploading(false); if (coverInput.current) coverInput.current.value = ""; }
  };
  const save = async () => {
    if (!s.title || s.title.trim().length < 2) { brunoToast.error("Escribe un título"); return; }
    setSaving(true);
    const body = { title: s.title, description: s.description, visibility: s.visibility, video_ids: s.videos.map((v) => v.id), featured_video_id: s.featured_video_id || null, cover_url: s.cover_custom || s.cover_cleared ? (s.cover_url || "") : undefined };
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
  const toggleFollow = async () => {
    if (!token) { brunoToast.error("Inicia sesión para seguir series"); navigate("/login"); return; }
    const prev = { is_following: s.is_following, followers_count: s.followers_count };
    setS((p) => ({ ...p, is_following: !p.is_following, followers_count: Math.max(0, (p.followers_count || 0) + (p.is_following ? -1 : 1)) }));
    try {
      const r = await axios.post(`${API}/series/${seriesId}/follow`, {}, { headers });
      setS((p) => ({ ...p, is_following: r.data.following, followers_count: r.data.followers_count }));
      brunoToast.success(r.data.following ? "Siguiendo la serie: te avisaremos con cada capítulo nuevo" : "Dejaste de seguir la serie");
    } catch (e) { setS((p) => ({ ...p, ...prev })); brunoToast.error(e?.response?.data?.detail || "No se pudo seguir la serie"); }
  };

  if (err) return <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="series-error"><div><ListVideo className="w-10 h-10 mx-auto text-muted-foreground" /><p className="mt-2 text-sm">{err}</p><button onClick={() => navigate(-1)} className="mt-4 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold">Volver</button></div></div>;
  if (!s) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const featured = s.videos.find((v) => v.id === s.featured_video_id) || s.videos[0];
  const resumeVideo = s.resume ? s.videos.find((v) => v.id === s.resume.video_id) : null;
  const watched = s.watched_count || 0;
  return (
    <div className="min-h-screen bg-background" data-testid="series-page" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 16px)" }}>
      <div className="relative h-56 bg-black/80">
        {s.cover_url && <img src={s.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-70" data-testid="series-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <button onClick={() => navigate(-1)} className="absolute left-3 w-10 h-10 rounded-full bg-black/40 text-white grid place-items-center" style={{ top: "calc(var(--safe-top, 0px) + 10px)" }} aria-label="Volver" data-testid="series-back"><ArrowLeft className="w-5 h-5" /></button>
        {s.is_owner && !editing && (
          <div className="absolute right-3 flex gap-2" style={{ top: "calc(var(--safe-top, 0px) + 10px)" }}>
            <button onClick={() => setEditing(true)} className="h-10 px-3 rounded-full bg-black/40 text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="series-edit"><Pencil className="w-3.5 h-3.5" />Editar</button>
            <button onClick={remove} className={`h-10 rounded-full text-white grid place-items-center transition-colors ${confirmDel ? "px-3 bg-destructive text-xs font-bold" : "w-10 bg-black/40"}`} aria-label="Eliminar serie" data-testid="series-delete">{confirmDel ? "¿Eliminar? Confirmar" : <Trash2 className="w-4 h-4" />}</button>
          </div>
        )}
        {editing && (
          <div className="absolute right-3 flex gap-2" style={{ top: "calc(var(--safe-top, 0px) + 10px)" }}>
            <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files?.[0])} data-testid="series-cover-input" />
            <button onClick={() => coverInput.current?.click()} disabled={uploading} className="h-10 px-3 rounded-full bg-black/40 text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="series-cover-upload">{uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}{s.cover_url ? "Cambiar portada" : "Subir portada"}</button>
            {s.cover_url && <button onClick={() => setS((p) => ({ ...p, cover_url: null, cover_cleared: true, cover_custom: false }))} className="w-10 h-10 rounded-full bg-black/40 text-white grid place-items-center" aria-label="Quitar portada" data-testid="series-cover-clear"><X className="w-4 h-4" /></button>}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ListVideo className="w-3.5 h-3.5" />Serie · {s.count} videos · {fmtClock(s.total_duration)}{s.visibility === "private" && <Lock className="w-3 h-3 ml-1" />}{!!s.followers_count && <span data-testid="series-followers">· {s.followers_count} seguidor{s.followers_count === 1 ? "" : "es"}</span>}</p>
          {editing ? <input value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="Título de la serie" maxLength={80} className="w-full bg-transparent text-2xl font-bold outline-none border-b border-border/60 placeholder:text-muted-foreground/60" data-testid="series-title-input" />
            : <h1 className="text-2xl font-bold" data-testid="series-title">{s.title}</h1>}
          {s.owner && <Link to={`/profile/${s.owner.id}`} className="text-sm text-muted-foreground" data-testid="series-owner">{s.owner.name}</Link>}
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-3 space-y-3">
        {editing ? (
          <>
            <textarea value={s.description || ""} onChange={(e) => setS({ ...s, description: e.target.value })} placeholder="Descripción (opcional)" rows={2} maxLength={500} className="w-full rounded-xl bg-foreground/[0.04] px-3 py-2 text-sm outline-none" data-testid="series-description-input" />
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <button onClick={() => setS({ ...s, visibility: s.visibility === "public" ? "private" : "public" })} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 px-3 h-9 text-xs font-semibold" data-testid="series-visibility-toggle">{s.visibility === "public" ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}{s.visibility === "public" ? "Pública" : "Privada (solo tú)"}</button>
              <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 h-9 text-xs font-semibold" data-testid="series-add-videos"><Plus className="w-3.5 h-3.5" />Añadir videos</button>
              <div className="flex-1" />
              {!isNew && <button onClick={() => { setEditing(false); axios.get(`${API}/series/${seriesId}`, { headers }).then((r) => setS(r.data)); }} className="h-9 px-3 text-xs font-semibold text-muted-foreground" data-testid="series-cancel">Cancelar</button>}
              <button onClick={save} disabled={saving} className="h-9 px-4 rounded-full bg-primary text-white text-xs font-semibold inline-flex items-center gap-1" data-testid="series-save">{saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Guardar</button>
            </div>
            {s.videos.length > 0 && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Star className="w-3 h-3 text-primary" />Toca la estrella para elegir el capítulo destacado (se muestra primero y es el que arranca al reproducir).</p>}
          </>
        ) : (
          <>
            {s.description && <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="series-description">{s.description}</p>}
            {!s.is_owner && s.visibility === "public" && (
              <button onClick={toggleFollow} className={`w-full h-10 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 border transition-colors ${s.is_following ? "bg-primary/10 border-primary/40 text-primary" : "border-border/60 bg-card/60"}`} aria-pressed={!!s.is_following} data-testid="series-follow-btn">
                {s.is_following ? <BellRing className="w-4 h-4" /> : <Bell className="w-4 h-4" />}{s.is_following ? "Siguiendo · te avisamos con cada capítulo" : "Seguir serie · avísame de capítulos nuevos"}
              </button>
            )}
            {s.count > 0 && (
              <div className="rounded-2xl border border-border/40 bg-card/60 p-3" data-testid="series-progress">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5"><span>Tu progreso</span><span data-testid="series-progress-label">{watched}/{s.count} capítulos vistos</span></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-[width]" style={{ width: `${s.count ? Math.round((watched / s.count) * 100) : 0}%` }} /></div>
              </div>
            )}
            {featured && (
              <button onClick={() => navigate(`/video/${featured.id}?series=${s.id}`)} className="w-full flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-2 text-left" data-testid="series-featured">
                <div className="relative w-28 h-16 rounded-xl overflow-hidden bg-black/70 shrink-0">{featured.thumb && <img src={featured.thumb} alt="" className="w-full h-full object-cover" />}<span className="absolute inset-0 grid place-items-center"><span className="w-8 h-8 rounded-full bg-white/90 grid place-items-center"><Play className="w-4 h-4 text-black fill-black ml-0.5" /></span></span><WatchBar progress={featured.progress} id={`featured-${featured.id}`} /></div>
                <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-primary font-bold flex items-center gap-1"><Star className="w-3 h-3 fill-current" />Capítulo destacado</p><p className="text-sm font-semibold line-clamp-2">{featured.title}</p><p className="text-[11px] text-muted-foreground">{fmtClock(featured.duration)}</p></div>
              </button>
            )}
            {resumeVideo ? (
              <button onClick={() => navigate(`/video/${resumeVideo.id}?series=${s.id}`)} className="w-full h-11 rounded-full bg-primary text-white font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" data-testid="series-resume"><RotateCcw className="w-4 h-4" />Retomar cap. {s.videos.indexOf(resumeVideo) + 1} en {fmtClock(s.resume.position)}</button>
            ) : featured && <button onClick={() => navigate(`/video/${featured.id}?series=${s.id}`)} className="w-full h-11 rounded-full bg-primary text-white font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" data-testid="series-play"><Play className="w-4 h-4 fill-current" />{watched >= s.count && s.count > 0 ? "Volver a ver la serie" : "Reproducir serie"}</button>}
          </>
        )}
        <div className="space-y-1.5" data-testid="series-videos">
          {s.videos.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">{editing ? "Añade tus videos como capítulos y ordénalos con las flechas." : "Esta serie aún no tiene capítulos."}</p>}
          {s.videos.map((v, i) => <VideoRow key={v.id} v={v} i={i} seriesId={s.id} editing={editing} featured={(s.featured_video_id || s.videos[0]?.id) === v.id} onFeature={() => setS({ ...s, featured_video_id: v.id })} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => setS({ ...s, videos: s.videos.filter((x) => x.id !== v.id), featured_video_id: s.featured_video_id === v.id ? null : s.featured_video_id })} />)}
        </div>
      </div>
      {adding && <AddVideosSheet token={token} exclude={s.videos.map((v) => v.id)} onAdd={(v) => { setS((p) => ({ ...p, videos: [...p.videos, v] })); setAdding(false); }} onClose={() => setAdding(false)} />}
    </div>
  );
}
