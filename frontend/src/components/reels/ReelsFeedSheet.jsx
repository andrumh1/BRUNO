/**
 * ReelsFeedSheet — sección "Feed" de Reels: publicaciones reales (propias + cuentas seguidas),
 * de la más reciente a la más antigua, con carga progresiva por cursor y sin duplicados.
 * Reutiliza <PostCard> (me gusta, reacciones, comentarios, guardar, perfil del autor).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Loader2, AlertCircle, UserPlus, Camera, RefreshCw, Users } from "lucide-react";
import PostCard from "@/components/PostCard";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function ReelsFeedSheet({ token, onClose }) {
  const navigate = useNavigate();
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
      const r = await axios.get(`${API}/feed/timeline`, { params: { limit: 15, before: before || undefined }, headers: { Authorization: `Bearer ${token}` } });
      const fresh = (r.data?.items || []).filter((p) => { if (seen.current.has(p.id)) return false; seen.current.add(p.id); return true; });
      setItems((prev) => (before ? [...prev, ...fresh] : fresh));
      setMeta({ source: r.data?.source, following_count: r.data?.following_count || 0 });
      setCursor(r.data?.next_cursor || null);
      setStatus(r.data?.next_cursor ? "idle" : "end");
    } catch (e) {
      setError(e?.response?.data?.detail || "No pudimos cargar el Feed. Revisa tu conexión e inténtalo de nuevo.");
      setStatus("error");
    } finally { busy.current = false; }
  }, [token]);

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
      <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2">
        <span data-testid="reels-feed-source">{meta.source === "public" ? "Aún no sigues a nadie: publicaciones públicas recientes" : `Tus publicaciones y las de ${meta.following_count} cuenta${meta.following_count === 1 ? "" : "s"} que sigues`}</span>
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
