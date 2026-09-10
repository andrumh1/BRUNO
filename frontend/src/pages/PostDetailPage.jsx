import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/PostCard";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** /post/:postId — single post deep-link (notifications, shares). Reels redirect to /reels?id=. */
export default function PostDetailPage() {
  const { postId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [post, setPost] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`${API}/posts/${postId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => {
        const p = r.data;
        const isVideo = p.post_type === "video" || p.video_url || (p.media || []).some((m) => m.type === "video");
        if (isVideo) { navigate(`/reels?id=${p.id}`, { replace: true }); return; }
        setPost(p);
      })
      .catch(() => setError(true));
  }, [postId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen bg-background pb-28" data-testid="post-detail-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-foreground/[0.06]" data-testid="post-detail-back"><ArrowLeft className="w-5 h-5" /></button>
          <h1 className="font-semibold text-base">Publicación</h1>
        </div>
      </header>
      <div className="max-w-2xl mx-auto px-4 py-4">
        {error ? (
          <p className="text-center text-muted-foreground py-16" data-testid="post-detail-missing">Esta publicación ya no está disponible</p>
        ) : !post ? (
          <div className="grid place-items-center py-16"><Loader2 className="w-7 h-7 animate-spin text-muted-foreground" /></div>
        ) : (
          <PostCard post={post} defaultShowComments={params.get("comments") === "1" || !!params.get("comment")} highlightCommentId={params.get("comment")} onDelete={() => navigate(-1)} />
        )}
      </div>
    </div>
  );
}
