import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/PostCard";
import { ArrowLeft, Hash, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const HashtagPage = () => {
  const { tag } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [trending, setTrending] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [postsRes, trendingRes] = await Promise.all([
          axios.get(`${API}/social/hashtag/${tag}`, { headers }),
          axios.get(`${API}/social/trending`),
        ]);
        setPosts(postsRes.data);
        setTrending(trendingRes.data);
      } catch (e) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tag, token]);

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="hashtag-page">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="hashtag-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Hash className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-base" data-testid="hashtag-title">#{tag}</h1>
              <p className="text-xs text-muted-foreground">{posts.length} publicaciones</p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* Related trending */}
        {trending.length > 0 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {trending.filter(t => t.hashtag !== tag.toLowerCase()).slice(0, 6).map((t, i) => (
              <Link
                key={`t-${i}`}
                to={`/hashtag/${t.hashtag}`}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted text-sm font-medium hover:bg-primary/10 hover:text-primary transition-colors"
              >
                #{t.hashtag}
              </Link>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <Hash className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-bold mb-1">Sin resultados</h2>
            <p className="text-muted-foreground text-sm">No hay publicaciones con #{tag}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HashtagPage;
