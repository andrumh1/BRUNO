import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Camera, ImagePlus, Loader2, MapPin, Settings2, Share2, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { CardConnections } from "@/components/bruno/CardConnections";
import { JoinBrunoNudge } from "@/components/bruno/JoinBrunoNudge";
import { api, errText, fmtBytes, fmtDate } from "@/pages/events/eventsApi";

const Cover = ({ event }) => (
  <div className="relative h-56 sm:h-72 rounded-b-3xl overflow-hidden bg-foreground" data-testid="event-cover">
    {event.cover_url ? <img src={event.cover_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg,#F26A1B,#1c1c1a)" }} />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
    <div className="absolute bottom-4 left-4 right-4 text-white">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-orange-300">Tarjeta de evento · BRUNO</p>
      <h1 className="text-2xl sm:text-3xl font-black leading-tight" data-testid="event-title">{event.title}</h1>
      <div className="flex flex-wrap gap-3 mt-1 text-xs text-white/85">
        {event.date && <span className="inline-flex items-center gap-1" data-testid="event-date"><CalendarDays className="w-3.5 h-3.5" />{fmtDate(event.date)}</span>}
        {event.location && <span className="inline-flex items-center gap-1" data-testid="event-location"><MapPin className="w-3.5 h-3.5" />{event.location}</span>}
      </div>
    </div>
  </div>
);

/** Álbum colaborativo: ver sin cuenta; subir requiere sesión (mientras haya capacidad). Nunca se borran fotos al llegar al límite. */
export const EventAlbum = ({ event, photos, setPhotos, viewer, benefits }) => {
  const { token, user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [nudge, setNudge] = useState(false);
  const input = useRef(null);
  const st = event.storage || {};
  const canUpload = !st.full && (event.allow_guest_uploads || viewer.is_owner);
  const pick = () => { if (!user) { setNudge(true); return; } input.current?.click(); };
  const onFile = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    for (const f of files) {
      if (f.size > st.max_file_bytes) { brunoToast.error(`«${f.name}» supera ${fmtBytes(st.max_file_bytes)}`); continue; }
      setProgress(0);
      try { const ph = await api.upload(token, event.id, f, "", setProgress); setPhotos((p) => [ph, ...p]); brunoToast.success("Foto añadida al álbum"); }
      catch (err) { brunoToast.error(errText(err, "No se pudo subir la foto")); if (err?.response?.data?.detail?.code === "album_full") break; }
      finally { setProgress(null); }
    }
  };
  const remove = async (ph) => { try { await api.deletePhoto(token, event.id, ph.id); setPhotos((p) => p.filter((x) => x.id !== ph.id)); } catch (err) { brunoToast.error(errText(err, "No se pudo borrar")); } };
  return (
    <section className="mt-6" data-testid="event-album">
      <div className="flex items-center justify-between gap-2 mb-2">
        <h2 className="text-base md:text-lg font-bold flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> Álbum del evento</h2>
        <span className="text-[11px] text-muted-foreground" data-testid="album-count">{st.photo_count || 0}/{st.total_photos} fotos</span>
      </div>
      {st.full && <p className="text-xs rounded-xl bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 mb-2" data-testid="album-full-notice">El álbum alcanzó su capacidad. Las fotos existentes se conservan; el organizador puede ampliarlo.</p>}
      {canUpload && (
        <>
          <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={onFile} data-testid="album-file-input" />
          <Button onClick={pick} disabled={progress !== null} className="rounded-full mb-3" data-testid="album-upload-btn">
            {progress !== null ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Subiendo {progress}%</> : <><ImagePlus className="w-4 h-4 mr-1.5" /> {user ? "Subir mis fotos" : "Subir fotos (gratis con tu cuenta)"}</>}
          </Button>
        </>
      )}
      {nudge && !user && <div className="mb-3"><JoinBrunoNudge reason="Inicia sesión o crea tu cuenta gratis para subir fotos" benefits={benefits} /></div>}
      {photos.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center" data-testid="album-empty">Aún no hay fotos. ¡Sé el primero en compartir un momento!</p> : (
        <div className="grid grid-cols-3 gap-1.5" data-testid="album-grid">
          {photos.map((ph) => (
            <figure key={ph.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted group" data-testid={`album-photo-${ph.id}`}>
              <a href={ph.url} target="_blank" rel="noreferrer"><img src={ph.thumb_url || ph.url} alt={ph.caption || ""} loading="lazy" className="w-full h-full object-cover" /></a>
              <figcaption className="absolute bottom-0 inset-x-0 text-[10px] text-white bg-black/50 px-1.5 py-0.5 truncate">{ph.uploader_name}</figcaption>
              {(viewer.is_owner || ph.uploader_id === user?.id) && <button type="button" onClick={() => remove(ph)} className="absolute top-1 right-1 p-1 rounded-full bg-black/60 text-white" aria-label="Borrar" data-testid={`album-delete-${ph.id}`}><Trash2 className="w-3 h-3" /></button>}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
};

export default function EventPublicPage() {
  const { id } = useParams();
  const { token, isLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => { if (isLoading) return; api.publicEvent(id, token).then((d) => { setData(d); setPhotos(d.photos || []); }).catch((e) => setError(errText(e, "Evento no disponible"))); }, [id, token, isLoading]);
  const share = async () => { const url = window.location.href; try { if (navigator.share) await navigator.share({ title: data.event.title, url }); else { await navigator.clipboard.writeText(url); brunoToast.success("Enlace copiado"); } } catch { /* cancel */ } };
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center" data-testid="event-error"><p className="text-sm text-muted-foreground">{error}</p><Button asChild variant="outline" className="rounded-full"><Link to="/">Ir a BRUNO</Link></Button></div>;
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const { event, viewer } = data;
  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 24px)" }} data-testid="event-public-page">
      <div className="relative">
        <Cover event={event} />
        <div className="absolute top-3 left-3 right-3 flex justify-between" style={{ paddingTop: "var(--safe-top, 0px)" }}>
          <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center" aria-label="Volver" data-testid="event-back-btn"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex gap-2">
            {viewer.is_owner && <button type="button" onClick={() => navigate(`/events/${event.id}/manage`)} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center" aria-label="Gestionar" data-testid="event-manage-btn"><Settings2 className="w-5 h-5" /></button>}
            <button type="button" onClick={share} className="w-10 h-10 rounded-full bg-black/40 text-white flex items-center justify-center" aria-label="Compartir" data-testid="event-share-btn"><Share2 className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4">
        {event.status !== "active" && <p className="mt-3 text-xs rounded-xl bg-muted px-3 py-2" data-testid="event-draft-notice">Vista previa: este evento aún no está publicado. Solo tú lo ves.</p>}
        {event.description && <p className="mt-4 text-sm leading-relaxed whitespace-pre-line" data-testid="event-description">{event.description}</p>}
        <p className="mt-3 text-xs text-muted-foreground inline-flex items-center gap-1" data-testid="event-going"><Users className="w-3.5 h-3.5" /> {data.going} confirmaron asistencia</p>
        <CardConnections items={data.connections} title="Conexiones del evento" current={event.title} />
        <EventAlbum event={event} photos={photos} setPhotos={setPhotos} viewer={viewer} benefits={data.join_benefits} />
        {!viewer.logged_in && <div className="mt-6"><JoinBrunoNudge benefits={data.join_benefits} /></div>}
      </div>
    </div>
  );
}
