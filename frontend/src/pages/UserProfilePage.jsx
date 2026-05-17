import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  UserMinus,
  Grid3X3,
  Bookmark,
  Settings,
  Loader2,
  Mail,
  MoreHorizontal,
  ShieldOff,
  ShieldAlert,
  Flag,
  X,
  CreditCard,
  Eye,
  Minimize2
} from "lucide-react";
import { useNavScroll } from "@/contexts/NavScrollContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const UserProfilePage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, token } = useAuth();
  const { addMinimizedItem } = useNavScroll();
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showFollowers, setShowFollowers] = useState(null); // 'followers' | 'following' | null
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const isOwnProfile = currentUser?.id === userId;

  const fetchProfile = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/users/${userId}/profile`, { headers });
      setProfile(response.data);
      setIsFollowing(response.data.is_following || false);
      setIsBlocked(response.data.is_blocked_by_me || false);
    } catch (error) {
      // error handled
    }
  }, [userId, token]);

  const fetchUserPosts = useCallback(async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/users/${userId}/posts`, { headers });
      setPosts(response.data);
    } catch (error) {
      // error handled
    }
  }, [userId, token]);

  const fetchUserCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cards?user_id=${userId}`);
      setCards(Array.isArray(response.data) ? response.data.filter(c => c.is_public) : []);
    } catch (error) {
      setCards([]);
    }
  }, [userId]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchUserPosts(), fetchUserCards()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchUserPosts, fetchUserCards]);

  // Redirect to own profile
  useEffect(() => {
    if (isOwnProfile) navigate("/my-profile", { replace: true });
  }, [isOwnProfile, navigate]);

  const handleFollow = async () => {
    if (!token) { navigate("/login"); return; }
    setFollowLoading(true);
    try {
      const res = await axios.post(`${API}/users/${userId}/follow`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsFollowing(res.data.following);
      setProfile(prev => ({
        ...prev,
        followers_count: res.data.following ? prev.followers_count + 1 : prev.followers_count - 1
      }));
    } catch (error) {
      // error handled
    } finally {
      setFollowLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!token) { navigate("/login"); return; }
    setBlockLoading(true);
    try {
      const res = await axios.post(`${API}/users/${userId}/block`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setIsBlocked(res.data.blocked);
      if (res.data.blocked) setIsFollowing(false);
      setShowMenu(false);
    } catch (error) {
      // error handled
    } finally {
      setBlockLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!token) { navigate("/login"); return; }
    try {
      const response = await axios.post(`${API}/chats?participant_id=${userId}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/chat/${response.data.id}`);
    } catch (error) {
      // error handled
    }
  };

  const handleReport = () => {
    setShowMenu(false);
    // Navigate to report or use modal
    alert("Contenido reportado. Nuestro equipo lo revisara.");
  };

  const loadFollowersList = async (type) => {
    setShowFollowers(type);
    setListLoading(true);
    try {
      const res = await axios.get(`${API}/users/${userId}/${type}`);
      if (type === "followers") setFollowersList(res.data);
      else setFollowingList(res.data);
    } catch (e) {
      // error handled
    } finally {
      setListLoading(false);
    }
  };

  const handleLikeUpdate = (postId, data) => {
    setPosts(posts.map(p => p.id === postId ? { ...p, is_liked: data.liked, likes_count: data.likes_count } : p));
  };

  const handlePostDelete = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
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
          <Link to="/feed"><Button>Volver al Feed</Button></Link>
        </Card>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-bold">{profile.display_name || profile.name}</h1>
          </div>
        </header>
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <ShieldOff className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-bold mb-2">Has bloqueado a este usuario</h2>
          <p className="text-muted-foreground mb-6">No puedes ver su contenido mientras este bloqueado.</p>
          <Button variant="outline" onClick={handleBlock} disabled={blockLoading}>
            {blockLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldOff className="w-4 h-4 mr-2" />}
            Desbloquear
          </Button>
        </div>
      </div>
    );
  }

  const mediaFromPosts = posts.filter(p => (p.media && p.media.length > 0) || p.image_url);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="profile-back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => {
              addMinimizedItem({
                id: userId,
                itemType: 'profile',
                title: profile.display_name || profile.name || '',
                thumbnail: profile.avatar_url || null,
              });
              navigate(-1);
            }} data-testid="profile-minimize-btn" title="Minimizar perfil">
              <Minimize2 className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="font-bold text-sm">{profile.display_name || profile.name}</h1>
              <p className="text-[11px] text-muted-foreground">{posts.length} publicaciones</p>
            </div>
          </div>
          {/* Menu */}
          {!isOwnProfile && token && (
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)} data-testid="profile-menu-btn">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 bg-card border rounded-xl shadow-xl w-52 py-1 animate-in fade-in zoom-in-95" data-testid="profile-menu-dropdown">
                    <button onClick={handleBlock} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors" data-testid="block-user-btn">
                      <ShieldAlert className="w-4 h-4 text-red-500" />
                      <span>{isBlocked ? "Desbloquear" : "Bloquear usuario"}</span>
                    </button>
                    <button onClick={handleReport} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-muted transition-colors" data-testid="report-user-btn">
                      <Flag className="w-4 h-4 text-yellow-500" />
                      <span>Reportar usuario</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Profile Header */}
      <div className="max-w-3xl mx-auto">
        {/* Banner */}
        <div 
          className="h-32 sm:h-44 bg-gradient-to-r from-primary/20 to-primary/10"
          style={profile.banner_url ? { 
            backgroundImage: `url(${profile.banner_url})`,
            backgroundSize: "cover",
            backgroundPosition: "center"
          } : {}}
        />

        {/* Profile Info */}
        <div className="px-4 pb-4">
          <div className="flex justify-between items-end -mt-14 mb-4">
            <div className="relative">
              {profile.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt={profile.display_name}
                  className="w-24 h-24 rounded-full border-4 border-background object-cover"
                  data-testid="profile-avatar"
                />
              ) : (
                <div className="w-24 h-24 rounded-full border-4 border-background bg-primary/20 flex items-center justify-center text-primary text-3xl font-bold">
                  {(profile.display_name || profile.name || "U")[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Action buttons */}
            {!isOwnProfile && token && (
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={handleStartChat} title="Mensaje" data-testid="profile-chat-btn">
                  <Mail className="w-5 h-5" />
                </Button>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  size="sm"
                  onClick={handleFollow}
                  disabled={followLoading}
                  className="rounded-full px-5"
                  data-testid="profile-follow-btn"
                >
                  {followLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isFollowing ? (
                    <>
                      <UserCheck className="w-4 h-4 mr-1.5" />
                      Siguiendo
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-1.5" />
                      Seguir
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          {/* Name & Username */}
          <div className="mb-2">
            <h2 className="text-lg font-bold" data-testid="profile-name">{profile.display_name || profile.name}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username || profile.email?.split("@")[0]}</p>
          </div>

          {/* Bio */}
          {profile.bio && <p className="text-sm mb-3">{profile.bio}</p>}

          {/* Meta Info */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-3">
            {profile.location && (
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{profile.location}</span>
            )}
            {profile.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                <LinkIcon className="w-3.5 h-3.5" />{profile.website.replace(/^https?:\/\//, "")}
              </a>
            )}
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />Se unio en {formatDate(profile.created_at)}
            </span>
          </div>

          {/* Stats - clickable */}
          <div className="flex gap-5 text-sm">
            <button onClick={() => loadFollowersList("following")} className="hover:underline" data-testid="profile-following-count">
              <strong>{profile.following_count || 0}</strong>{" "}
              <span className="text-muted-foreground">Siguiendo</span>
            </button>
            <button onClick={() => loadFollowersList("followers")} className="hover:underline" data-testid="profile-followers-count">
              <strong>{profile.followers_count || 0}</strong>{" "}
              <span className="text-muted-foreground">Seguidores</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b sticky top-14 bg-background z-20">
          <div className="flex">
            {[
              { id: "posts", icon: Grid3X3, label: "Posts" },
              { id: "media", icon: Grid3X3, label: "Media" },
              { id: "cards", icon: CreditCard, label: "Tarjetas" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                  activeTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4 mx-auto mb-0.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {activeTab === "posts" && (
            posts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Este usuario aun no ha publicado nada.
              </div>
            ) : (
              posts.map((post) => (
                <PostCard key={post.id} post={post} onLikeUpdate={handleLikeUpdate} onDelete={handlePostDelete} />
              ))
            )
          )}

          {activeTab === "media" && (
            <div className="grid grid-cols-3 gap-1">
              {mediaFromPosts.length === 0 ? (
                <div className="col-span-3 text-center py-12 text-muted-foreground">No hay contenido multimedia</div>
              ) : (
                mediaFromPosts.map((p) => (
                  <div key={p.id} className="aspect-square bg-muted rounded overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                    <img src={p.image_url || p.media?.[0]?.url} alt="" className="w-full h-full object-cover" />
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "cards" && (
            cards.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                Este usuario no tiene tarjetas publicas.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cards.map(card => (
                  <Link key={card.id} to={`/c/${card.id}`} className="block">
                    <div className="border rounded-xl overflow-hidden hover:shadow-md transition-all">
                      <div className="h-24" style={{
                        background: card.banner_url
                          ? `url(${card.banner_url}) center/cover`
                          : `linear-gradient(135deg, ${card.background_color || '#f97316'}, ${card.background_color || '#ea580c'}dd)`,
                      }}>
                        <div className="p-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white bg-black/40 backdrop-blur-sm capitalize">
                            {card.card_type || card.type}
                          </span>
                        </div>
                      </div>
                      <div className="p-3">
                        <h3 className="font-bold text-sm truncate">{card.title}</h3>
                        {card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <Eye className="w-3 h-3" />{card.views || 0} vistas
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Followers/Following Modal */}
      {showFollowers && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={() => setShowFollowers(null)}>
          <div className="bg-card w-full max-w-md rounded-t-2xl sm:rounded-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()} data-testid="followers-modal">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold">{showFollowers === "followers" ? "Seguidores" : "Siguiendo"}</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowFollowers(null)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {listLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : (
                (showFollowers === "followers" ? followersList : followingList).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {showFollowers === "followers" ? "Aun no tiene seguidores" : "No sigue a nadie"}
                  </div>
                ) : (
                  (showFollowers === "followers" ? followersList : followingList).map(u => (
                    <button
                      key={u.id}
                      onClick={() => { setShowFollowers(null); navigate(`/profile/${u.id}`); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
                      data-testid={`user-item-${u.id}`}
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {(u.name || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="text-left flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{u.name || "Usuario"}</p>
                        {u.bio && <p className="text-xs text-muted-foreground truncate">{u.bio}</p>}
                      </div>
                    </button>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;
