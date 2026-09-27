import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import CreatePost from "@/components/CreatePost";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ComposePage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [userCards, setUserCards] = useState([]);

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setUserCards(r.data || [])).catch(() => {});
  }, [token]);

  return (
    <div className="min-h-screen bg-background" data-testid="compose-page">
      <header className="sticky top-0 z-40 bg-card/70 backdrop-blur-xl border-b border-border/50 flex items-center gap-2 px-3 py-2" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top, 8px))" }}>
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted" data-testid="compose-back-btn" aria-label="Volver"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="font-bold text-base">Nueva publicación</h1>
      </header>
      <main className="max-w-xl mx-auto p-3 pb-32">
        <CreatePost userCards={userCards} onPostCreated={(post) => navigate(post?._scheduled ? "/my-profile" : post?.id ? `/reels?id=${post.id}` : "/reels")} />
      </main>
    </div>
  );
}
