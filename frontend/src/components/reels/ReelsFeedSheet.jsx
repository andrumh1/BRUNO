/**
 * ReelsFeedSheet — sección "Feed" de Reels: publicaciones reales (propias + cuentas seguidas),
 * de la más reciente a la más antigua, con carga progresiva por cursor y sin duplicados.
 * Reutiliza <PostCard> (me gusta, reacciones, comentarios, guardar, perfil del autor).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, AlertCircle, UserPlus, Camera, RefreshCw, Users, Image as ImageIcon, Film, Type, Plus } from "lucide-react";
import PostCard from "@/components/PostCard";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";

const KINDS = [["all", "Todo", null], ["photo", "Fotos", ImageIcon], ["video", "Videos", Film], ["text", "Texto", Type]];

// Franja de historias (misma fuente que Reels: /stories/feed) para abrirlas sin salir del Feed.
function FeedStoriesStrip({ token, user, onClose }) {
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [viewing, setViewing] = useState(null);
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/stories/feed`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setGroups(Array.isArray(r.data) ? r.data : [])).catch(() => setGroups([]));
  }, [token]);
  return (
    <>
      <div className="flex gap-3 overflow-x-auto scrollbar-none pb-3 -mx-1 px-1" data-testid="feed-stories-strip">
        <button onClick={() => { onClose?.(); navigate("/camera"); }} className="flex flex-col items-center gap-1 shrink-0" data-testid="feed-story-create">
          <div className="relative w-14 h-14 rounded-full border-2 border-border overflow-hidden bg-muted grid place-items-center">
            {user?.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover opacity-80" /> : null}
            <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-primary border-2 border-background grid place-items-center"><Plus className="w-3 h-3 text-white" strokeWidth={3} /></span>
          </div>
          <span className="text-[10px] font-medium">Tu historia</span>
        </button>
        {groups.map((g) => (
          <button key={g.user_id} onClick={() => setViewing(g)} className="flex flex-col items-center gap-1 shrink-0" data-testid={`feed-story-${g.user_id}`}>
            <div className={`w-14 h-14 rounded-full p-[2px] ${g.has_unseen ? "bg-gradient-to-tr from-primary via-pink-500 to-yellow-400" : "bg-border"}`}>
              <div className="w-full h-full rounded-full border-2 border-background overflow-hidden bg-muted">
                {g.avatar_url ? <img src={g.avatar_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-sm font-bold">{(g.user_name || g.username || "?").charAt(0).toUpperCase()}</div>}
              </div>
            </div>
            <span className="text-[10px] font-medium max-w-[56px] truncate">{g.user_name || g.username || "usuario"}</span>
          </button>
        ))}
      </div>
      {viewing && <BrunoStoryViewer userStories={viewing} allUsers={groups} onClose={() => setViewing(null)} onNavigate={(g) => setViewing(g)} />}
    </>
  );
}

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function ReelsFeedSheet({ token, user, onClose }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState("all");
  const [onlyFollowing, setOnlyFollowing] = useState(false);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | more | idle | error | end
  const [meta, setMeta] = useState({ source: "following", following_count: 0 });
  const [error, setError] = useState("");
  const seen = useRef(new Set());
  const sentinel = useRef(null);
  const busy = useRef(false);

  const load = useCallback(async (before = null) => {
    if (busy.current) return;
    busy.current = true;
    setStatus(before ? "more" : "loading");
    try {
      const r = await axios.get(`${API}/feed/timeline`, { params: { limit: 15, before: before || undefined, kind: kind === "all" ? undefined : kind, fill_public: onlyFollowing ? 0 : 1 }, headers: { Authorization: `Bearer ${token}` } });
      const fresh = (r.data?.items || []).filter((p) => { if (seen.current.has(p.id)) return false; seen.current.add(p.id); return true; });
      setItems((prev) => (before ? [...prev, ...fresh] : fresh));
      setMeta({ source: r.data?.source, following_count: r.data?.following_count || 0 });
      setCursor(r.data?.next_cursor || null);
      setStatus(r.data?.next_cursor ? "idle" : "end");
    } catch (e) {
      setError(e?.response?.data?.detail || "No pudimos cargar el Feed. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    } finally { busy.current = false; }
  }, [token, kind, onlyFollowing]);

  const refresh = useCallback(() => { seen.current = new Set(); setCursor(null); load(null); }, [load]);

  useEffect(() => { if (token) refresh(); else setStatus("end"); }, [token, refresh]);

  useEffect(() => {
    if (!sentinel.current || status !== "idle" || !cursor) return;
    const io = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) load(cursor); }, { rootMargin: "600px" });
    io.observe(sentinel.current);
    return () => io.disconnect();
  }, [status, cursor, load]);

  if (!token) return <p className="text-sm text-muted-foreground text-center py-10" data-testid="reels-feed-login">Inicia sesión para ver el Feed de las cuentas que sigues.</p>;

  return (
    <div className="max-w-xl mx-auto" data-testid="reels-feed">
      <FeedStoriesStrip token={token} user={user} onClose={onClose} />
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-2" data-testid="feed-filters">
        {KINDS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setKind(id)} aria-pressed={kind === id} className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${kind === id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} data-testid={`feed-filter-${id}`}>{Icon && <Icon className="w-3.5 h-3.5" />}{label}</button>
        ))}
        <button onClick={() => setOnlyFollowing((v) => !v)} aria-pressed={onlyFollowing} className={`shrink-0 h-8 px-3 rounded-full text-[11px] font-semibold inline-flex items-center gap-1 ${onlyFollowing ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`} data-testid="feed-filter-following"><Users className="w-3.5 h-3.5" />Solo cuentas que sigo</button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2">
        <span data-testid="reels-feed-source">{onlyFollowing && meta.following_count === 0 ? "Solo cuentas que sigues: aún no sigues a nadie" : meta.source === "public" ? "Aún no sigues a nadie: publicaciones públicas recientes" : `Tus publicaciones y las de ${meta.following_count} cuenta${meta.following_count === 1 ? "" : "s"} que sigues`}</span>
        <button onClick={refresh} className="w-7 h-7 rounded-full bg-muted grid place-items-center" aria-label="Actualizar" data-testid="reels-feed-refresh"><RefreshCw className={`w-3.5 h-3.5 ${status === "loading" ? "animate-spin" : ""}`} /></button>
      </div>

      {status === "loading" && items.length === 0 && <div className="grid place-items-center py-16" data-testid="reels-feed-loading"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>}

      {status === "error" && items.length === 0 && (
        <div className="text-center py-12 space-y-3" data-testid="reels-feed-error">
          <AlertCircle className="w-7 h-7 mx-auto text-red-500" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={refresh} className="h-9 px-4 rounded-full bg-primary text-white text-sm font-semibold">Reintentar</button>
        </div>
      )}

      {status !== "loading" && status !== "error" && items.length === 0 && (
        <div className="text-center py-12 space-y-4" data-testid="reels-feed-empty">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 grid place-items-center"><Users className="w-7 h-7 text-primary" /></div>
          <div><p className="font-bold">Tu Feed está vacío</p><p className="text-sm text-muted-foreground mt-1">Sigue a personas o publica algo para empezar a ver contenido aquí.</p></div>
          <div className="flex justify-center gap-2">
            <button onClick={() => { onClose?.(); navigate("/search"); }} className="h-9 px-4 rounded-full bg-primary text-white text-sm font-semibold inline-flex items-center gap-1.5" data-testid="reels-feed-follow-cta"><UserPlus className="w-4 h-4" /> Buscar cuentas</button>
            <button onClick={() => { onClose?.(); navigate("/camera"); }} className="h-9 px-4 rounded-full bg-muted text-sm font-semibold inline-flex items-center gap-1.5" data-testid="reels-feed-create-cta"><Camera className="w-4 h-4" /> Publicar</button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((post) => <PostCard key={post.id} post={post} onDelete={(id) => setItems((prev) => prev.filter((p) => p.id !== id))} />)}
      </div>

      <div ref={sentinel} className="h-8" />
      {status === "more" && <div className="grid place-items-center py-4" data-testid="reels-feed-loading-more"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
      {status === "idle" && cursor && <button onClick={() => load(cursor)} className="mx-auto block h-9 px-4 rounded-full bg-muted text-xs font-semibold mb-4" data-testid="reels-feed-load-more">Cargar más</button>}
      {status === "end" && items.length > 0 && <p className="text-center text-[11px] text-muted-foreground py-4" data-testid="reels-feed-end">Estás al día.</p>}
    </div>
  );
}
