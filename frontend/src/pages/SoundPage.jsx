/* eslint-disable react-hooks/exhaustive-deps */
/** /sound/:postId — shareable page for a sound: header, "Usar este sonido", ranking of reels using it. */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Music2, Video, Share2, Play, Eye, Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { normalizeReel } from "@/components/reels/useReelsFeed";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const fmt = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

export default function SoundPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/posts/sound/${postId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => setData({ ...r.data, posts: (r.data.posts || []).map(normalizeReel).sort((a, b) => (b.views_count || 0) - (a.views_count || 0)) }))
      .catch(() => setError(true));
  }, [postId, token]);

  const share = async () => {
    const url = `${window.location.origin}/sound/${data?.sound?.source_post_id || postId}`;
    if (navigator.share) { try { await navigator.share({ title: data?.sound?.name, url }); return; } catch (_) { /* cancelled */ } }
    try { await navigator.clipboard.writeText(url); brunoToast.success("Link del sonido copiado"); } catch (_) { /* ignore */ }
  };

  const sound = data?.sound;
  return (
    <div className="min-h-screen bg-background pb-28" data-testid="sound-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-foreground/[0.06]" data-testid="sound-back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-semibold text-base">Sonido</h1>
          <button onClick={share} className="ml-auto w-9 h-9 rounded-full grid place-items-center hover:bg-foreground/[0.06]" data-testid="sound-share"><Share2 className="w-5 h-5" /></button>
        </div>
      </header>

      {error ? <p className="text-center text-muted-foreground py-16">Este sonido no está disponible</p>
        : !data ? <div className="grid place-items-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        : (
          <div className="max-w-2xl mx-auto px-4 py-5">
            <div className="glass-card rounded-[28px] border p-4 flex items-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-zinc-900 grid place-items-center overflow-hidden reel-disc shrink-0 no-glass">
                {sound?.author?.avatar_url ? <img src={sound.author.avatar_url} alt="" className="w-11 h-11 rounded-full object-cover" /> : <Music2 className="w-7 h-7 text-white" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-base leading-tight truncate" data-testid="sound-name">{sound?.name}</h2>
                <button onClick={() => navigate(`/profile/${sound?.author?.id}`)} className="text-sm text-muted-foreground truncate">@{sound?.author?.username || sound?.author?.name}</button>
                <p className="text-xs text-muted-foreground mt-1" data-testid="sound-uses">{data.posts.length} {data.posts.length === 1 ? "video" : "videos"} · {sound?.uses || 0} reutilizaciones</p>
              </div>
            </div>
            <button onClick={() => navigate(token ? `/camera?sound=${sound?.source_post_id}` : "/login")} className="mt-4 w-full h-12 rounded-full bg-primary text-white font-semibold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98]" data-testid="sound-use-btn">
              <Video className="w-4 h-4" /> Usar este sonido
            </button>

            <h3 className="mt-7 mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">Ranking · más vistos</h3>
            <div className="grid grid-cols-3 gap-2" data-testid="sound-ranking">
              {data.posts.map((r, i) => (
                <button key={r.id} onClick={() => navigate(`/reels?id=${r.id}`)} className="relative aspect-[9/14] rounded-2xl overflow-hidden bg-black no-glass text-left" data-testid={`sound-rank-${i + 1}`}>
                  {(r.poster_url || r.thumbnail_url) ? <img src={r.poster_url || r.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Play className="w-6 h-6 text-white/70" /></div>}
                  <span className={`absolute top-1.5 left-1.5 w-6 h-6 rounded-full grid place-items-center text-[10px] font-black ${i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-zinc-300 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-black/60 text-white"}`}>#{i + 1}</span>
                  {r.id === sound?.source_post_id && <span className="absolute top-1.5 right-1.5 rounded-full bg-primary text-white text-[9px] px-1.5 py-0.5">Original</span>}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-[10px] font-semibold truncate">@{r.author?.username || r.author?.name}</p>
                    <p className="text-white/80 text-[9px] inline-flex items-center gap-2"><span className="inline-flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{fmt(r.views_count)}</span><span className="inline-flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{fmt(r.likes_count)}</span></p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
