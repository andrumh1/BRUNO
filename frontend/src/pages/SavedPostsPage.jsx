import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import PostCard from "@/components/PostCard";
import { ArrowLeft, Bookmark, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const SavedPostsPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/posts/saved/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPosts(res.data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const handleRemoveBookmark = (postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="saved-posts-page">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-primary" />
            <h1 className="font-bold">Guardados</h1>
          </div>
          <span className="ml-auto text-sm text-muted-foreground">{posts.length} posts</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : posts.length === 0 ? (
          <div className="text-center py-16">
            <Bookmark className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-bold mb-1">Sin guardados</h2>
            <p className="text-muted-foreground text-sm">Los posts que guardes apareceran aqui</p>
            <Link to="/feed"><Button className="mt-4">Explorar feed</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} onDelete={handleRemoveBookmark} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedPostsPage;
