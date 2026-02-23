import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PostCard from "@/components/PostCard";
import axios from "axios";
import { 
  ArrowLeft, 
  MapPin, 
  Link as LinkIcon, 
  Calendar,
  MessageCircle,
  UserPlus,
  UserCheck,
  Grid3X3,
  Bookmark,
  Settings,
  Loader2,
  Mail
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const UserProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/users/${userId}/profile`);
      setProfile(response.data);
      setIsFollowing(response.data.is_following || false);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  }, [userId]);

  const fetchUserPosts = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/users/${userId}/posts`, { headers });
      setPosts(response.data);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  }, [userId, token]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchUserPosts()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchUserPosts]);

  const handleFollow = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    
    setFollowLoading(true);
    try {
      await axios.post(
        `${API}/users/${userId}/follow`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setIsFollowing(!isFollowing);
      setProfile(prev => ({
        ...prev,
        followers_count: isFollowing ? prev.followers_count - 1 : prev.followers_count + 1
      }));
    } catch (error) {
      console.error("Error following user:", error);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!token) {
      navigate("/login");
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/chats?participant_id=${userId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/chat/${response.data.id}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  const handleLikeUpdate = (postId, data) => {
    setPosts(posts.map(p => 
      p.id === postId 
        ? { ...p, is_liked: data.liked, likes_count: data.likes_count }
        : p
    ));
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric"
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-bold mb-2">Usuario no encontrado</h2>
          <p className="text-muted-foreground mb-4">Este perfil no existe o ha sido eliminado.</p>
          <Link to="/feed">
            <Button>Volver al Feed</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold">{profile.display_name || profile.name}</h1>
            <p className="text-xs text-muted-foreground">{posts.length} publicaciones</p>
          </div>
        </div>
      </header>

      {/* Profile Header */}
      <div className="max-w-3xl mx-auto">
        {/* Banner */}
        <div 
          className="h-32 sm:h-48 bg-gradient-to-r from-primary/20 to-primary/10"
          style={profile.banner_url ? { 
            backgroundImage: `url(${profile.banner_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          } : {}}
        />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          {/* Avatar & Actions */}
          <div className="flex justify-between items-start -mt-16 sm:-mt-20 mb-4">
            <div className="relative">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.display_name}
                  className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background object-cover"
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">
                  {(profile.display_name || profile.name || "U")[0].toUpperCase()}
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-20 sm:mt-24">
              {isOwnProfile ? (
                <Link to="/dashboard">
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Editar perfil
                  </Button>
                </Link>
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleStartChat}
                    title="Enviar mensaje"
                  >
                    <Mail className="w-5 h-5" />
                  </Button>
                  <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    onClick={handleFollow}
                    disabled={followLoading}
                  >
                    {followLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <UserCheck className="w-4 h-4 mr-2" />
                        Siguiendo
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Seguir
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Name & Username */}
          <div className="mb-3">
            <h2 className="text-xl font-bold">{profile.display_name || profile.name}</h2>
            <p className="text-muted-foreground">@{profile.username || profile.email?.split("@")[0]}</p>
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="mb-3 text-sm">{profile.bio}</p>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profile.location}
              </span>
            )}
            {profile.website && (
              <a 
                href={profile.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                <LinkIcon className="w-4 h-4" />
                {profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Se unió en {formatDate(profile.created_at)}
            </span>
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <span>
              <strong>{profile.following_count || 0}</strong>{" "}
              <span className="text-muted-foreground">Siguiendo</span>
            </span>
            <span>
              <strong>{profile.followers_count || 0}</strong>{" "}
              <span className="text-muted-foreground">Seguidores</span>
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("posts")}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === "posts" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3X3 className="w-4 h-4 mx-auto mb-1" />
              Publicaciones
            </button>
            <button
              onClick={() => setActiveTab("media")}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === "media" 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Grid3X3 className="w-4 h-4 mx-auto mb-1" />
              Media
            </button>
            {isOwnProfile && (
              <button
                onClick={() => setActiveTab("saved")}
                className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                  activeTab === "saved" 
                    ? "border-primary text-primary" 
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bookmark className="w-4 h-4 mx-auto mb-1" />
                Guardados
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === "posts" && (
            posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {isOwnProfile 
                    ? "Aún no has publicado nada. ¡Comparte algo con el mundo!" 
                    : "Este usuario aún no ha publicado nada."}
                </p>
                {isOwnProfile && (
                  <Link to="/feed">
                    <Button className="mt-4">Crear primera publicación</Button>
                  </Link>
                )}
              </div>
            ) : (
              posts.map((post) => (
                <PostCard 
                  key={post.id} 
                  post={post}
                  onLikeUpdate={handleLikeUpdate}
                  onDelete={handlePostDelete}
                />
              ))
            )
          )}

          {activeTab === "media" && (
            <div className="grid grid-cols-3 gap-1">
              {posts
                .filter(p => p.media && p.media.length > 0)
                .flatMap(p => p.media.map((m, i) => ({ ...m, postId: p.id, key: `${p.id}-${i}` })))
                .map((media) => (
                  <div 
                    key={media.key}
                    className="aspect-square bg-muted rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    {media.type === "image" ? (
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={media.url} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))
              }
              {posts.filter(p => p.media && p.media.length > 0).length === 0 && (
                <div className="col-span-3 text-center py-12 text-muted-foreground">
                  No hay contenido multimedia
                </div>
              )}
            </div>
          )}

          {activeTab === "saved" && isOwnProfile && (
            <div className="text-center py-12 text-muted-foreground">
              Tus publicaciones guardadas aparecerán aquí
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfilePage;
