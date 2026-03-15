import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PostCard from "@/components/PostCard";
import { PointsWidget } from "@/components/PointsSystem";
import axios from "axios";
import { 
  ArrowLeft,
  Settings,
  Edit3,
  Grid3X3,
  Bookmark,
  Film,
  CreditCard,
  Share2,
  MapPin,
  Link as LinkIcon,
  Calendar,
  LogOut,
  Camera,
  Check,
  X,
  Loader2,
  Trophy,
  Bell,
  HelpCircle,
  Globe,
  ChevronRight,
  User,
  Mail,
  Phone,
  Shield,
  Palette,
  Moon,
  Sun,
  FileText,
  Trash2,
  FolderOpen
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const MyProfilePage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [cards, setCards] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exploreCards, setExploreCards] = useState([]);

  // Fetch profile data
  const fetchProfile = useCallback(async () => {
    if (!token || !user) return;
    try {
      const response = await axios.get(`${API}/users/${user.id}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setEditData({
        name: response.data.name || '',
        bio: response.data.bio || '',
        location: response.data.location || '',
        website: response.data.website || '',
        phone: response.data.phone || ''
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Create basic profile from user data
      setProfile({
        ...user,
        followers_count: 0,
        following_count: 0,
        posts_count: 0
      });
    }
  }, [token, user]);

  // Fetch user's posts
  const fetchPosts = useCallback(async () => {
    if (!token || !user) return;
    try {
      const response = await axios.get(`${API}/users/${user.id}/posts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPosts(response.data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    }
  }, [token, user]);

  // Fetch user's cards
  const fetchCards = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCards(response.data);
    } catch (error) {
      console.error("Error fetching cards:", error);
    }
  }, [token]);

  // Fetch explore (all public) cards
  const fetchExploreCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cards/explore?limit=20`);
      setExploreCards(response.data || []);
    } catch (error) {
      console.error("Error fetching explore cards:", error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchPosts(), fetchCards(), fetchExploreCards()]);
      setLoading(false);
    };
    
    if (user && token) {
      loadData();
    }
  }, [fetchProfile, fetchPosts, fetchCards, fetchExploreCards, user, token]);

  // Handle profile update
  const handleSaveProfile = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await axios.put(`${API}/users/${user.id}/profile`, editData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(prev => ({ ...prev, ...editData }));
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Inicia sesión para ver tu perfil</p>
          <Link to="/login">
            <Button>Iniciar Sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const reels = posts.filter(p => p.video_url || p.media_type === 'video');

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link to="/feed">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-lg font-bold">{profile?.name || user.name}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowSettings(false)}>
          <div 
            className="absolute right-0 top-0 bottom-0 w-80 bg-card shadow-xl animate-in slide-in-from-right"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-bold">Configuración</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-2">
              <Link to="/points" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="flex-1 text-left">Mis Puntos</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/settings/notifications" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Bell className="w-5 h-5 text-blue-500" />
                  <span className="flex-1 text-left">Notificaciones</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/privacy" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Shield className="w-5 h-5 text-green-500" />
                  <span className="flex-1 text-left">Política de Privacidad</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/terms" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <span className="flex-1 text-left">Términos de Servicio</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/website" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Globe className="w-5 h-5 text-orange-500" />
                  <span className="flex-1 text-left">Sitio Web BRUNO</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/help" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <HelpCircle className="w-5 h-5 text-purple-500" />
                  <span className="flex-1 text-left">Ayuda</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <div className="border-t my-2" />
              
              <Link to="/settings/delete-account" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors">
                  <Trash2 className="w-5 h-5" />
                  <span className="flex-1 text-left">Eliminar Cuenta</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </Link>
              
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span className="flex-1 text-left">Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="px-4 py-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-primary to-orange-500 p-0.5">
              <div className="w-full h-full rounded-full bg-background overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <User className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background">
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Stats */}
          <div className="flex-1">
            <div className="flex justify-around mb-4">
              <div className="text-center">
                <p className="text-xl font-bold">{posts.length}</p>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{profile?.followers_count || 0}</p>
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold">{profile?.following_count || 0}</p>
                <p className="text-xs text-muted-foreground">Siguiendo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Name and Bio */}
        {isEditing ? (
          <div className="mt-4 space-y-3">
            <Input
              value={editData.name}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
              placeholder="Nombre"
              className="font-bold"
            />
            <Input
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Biografía"
            />
            <Input
              value={editData.location}
              onChange={(e) => setEditData({ ...editData, location: e.target.value })}
              placeholder="Ubicación"
            />
            <Input
              value={editData.website}
              onChange={(e) => setEditData({ ...editData, website: e.target.value })}
              placeholder="Sitio web"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveProfile} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Guardar
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <h2 className="font-bold text-lg">{profile?.name || user.name}</h2>
            {profile?.bio && <p className="text-sm text-muted-foreground mt-1">{profile.bio}</p>}
            
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
              {profile?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {profile.location}
                </span>
              )}
              {profile?.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary">
                  <LinkIcon className="w-4 h-4" />
                  {profile.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Se unió en {new Date(user.created_at).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!isEditing && (
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => setIsEditing(true)}
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Editar perfil
            </Button>
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => navigate("/nfc/manage")}
              title="NFC PIUP Manager"
              data-testid="nfc-manager-btn"
            >
              <CreditCard className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Points Widget */}
        <div className="mt-4">
          <PointsWidget />
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b sticky top-14 bg-background z-20">
        <div className="flex">
          <button
            onClick={() => setActiveTab("posts")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "posts" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Grid3X3 className="w-5 h-5" />
            <span className="text-sm font-medium">Posts</span>
          </button>
          <button
            onClick={() => setActiveTab("reels")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "reels" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Film className="w-5 h-5" />
            <span className="text-sm font-medium">Reels</span>
          </button>
          <button
            onClick={() => setActiveTab("cards")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "cards" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <CreditCard className="w-5 h-5" />
            <span className="text-sm font-medium">Tarjetas</span>
          </button>
          <button
            onClick={() => setActiveTab("explore")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "explore" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Globe className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Explorar</span>
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "saved" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Bookmark className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Guardados</span>
          </button>
          <button
            onClick={() => navigate("/albums")}
            className="flex-1 py-3 flex items-center justify-center gap-2 border-b-2 border-transparent text-muted-foreground hover:text-primary transition-colors"
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Álbumes</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {/* Posts Grid */}
        {activeTab === "posts" && (
          posts.length === 0 ? (
            <div className="text-center py-12">
              <Grid3X3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay publicaciones aún</p>
              <Link to="/feed">
                <Button className="mt-4">Crear publicación</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(post => (
                <Link key={post.id} to={`/feed?post=${post.id}`}>
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                    {post.image_url || post.attachments?.[0]?.url ? (
                      <img 
                        src={post.image_url || post.attachments?.[0]?.url} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-primary/10 to-primary/5">
                        <p className="text-xs line-clamp-4 text-center">{post.content}</p>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Reels Grid */}
        {activeTab === "reels" && (
          reels.length === 0 ? (
            <div className="text-center py-12">
              <Film className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay reels aún</p>
              <Button className="mt-4">Crear reel</Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {reels.map(reel => (
                <Link key={reel.id} to={`/reels?id=${reel.id}`}>
                  <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative">
                    <img 
                      src={reel.thumbnail_url || reel.image_url} 
                      alt="" 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-1 left-1 flex items-center gap-1 text-white text-xs">
                      <Film className="w-3 h-3" />
                      {reel.views_count || 0}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Cards */}
        {activeTab === "cards" && (
          cards.length === 0 ? (
            <div className="text-center py-12">
              <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No tienes tarjetas aún</p>
              <Link to="/cards/new">
                <Button className="mt-4">Crear tarjeta</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {cards.map(card => (
                <Link key={card.id} to={`/c/${card.id}`}>
                  <div 
                    className="aspect-[1.6/1] rounded-xl overflow-hidden relative"
                    style={{ 
                      background: `linear-gradient(135deg, ${card.primary_color || '#f97316'}, ${card.secondary_color || '#ea580c'})`
                    }}
                  >
                    <div className="absolute inset-0 p-3 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent">
                      <p className="text-white font-bold text-sm truncate">{card.title || 'Mi Tarjeta'}</p>
                      <p className="text-white/70 text-xs truncate">{card.subtitle}</p>
                    </div>
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/20 rounded-full">
                      <span className="text-white text-[10px] uppercase">{card.type}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Saved */}
        {activeTab === "saved" && (
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay posts guardados</p>
          </div>
        )}

        {/* Explore Cards */}
        {activeTab === "explore" && (
          exploreCards.length === 0 ? (
            <div className="text-center py-12">
              <Globe className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No hay tarjetas publicas aun</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {exploreCards.map(card => (
                <Link key={card.id} to={`/c/${card.id}`}>
                  <div 
                    className="rounded-xl overflow-hidden relative shadow-md hover:shadow-lg transition-shadow border border-border/50"
                  >
                    <div 
                      className="h-28"
                      style={{
                        background: card.banner_url
                          ? `url(${card.banner_url}) center/cover`
                          : `linear-gradient(135deg, ${card.background_color || '#f97316'}, ${card.background_color || '#ea580c'}dd)`
                      }}
                    />
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/90 rounded-full">
                      <span className="text-[10px] font-medium capitalize">{card.card_type || card.type}</span>
                    </div>
                    <div className="p-3 bg-card relative">
                      <div className="absolute -top-6 left-3">
                        {card.avatar_url ? (
                          <img src={card.avatar_url} alt="" className="w-12 h-12 rounded-full border-3 border-background object-cover shadow" />
                        ) : (
                          <div className="w-12 h-12 rounded-full border-3 border-background flex items-center justify-center text-lg font-bold shadow" style={{ backgroundColor: card.background_color || '#f97316', color: card.text_color || '#fff' }}>
                            {card.title?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>
                      <div className="mt-7">
                        <h3 className="font-bold text-sm truncate">{card.title}</h3>
                        {card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}
                        {card.user_id && (
                          <Link 
                            to={`/profile/${card.user_id}`} 
                            className="text-[10px] text-primary hover:underline mt-1 block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Ver perfil del autor
                          </Link>
                        )}
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
  );
};

export default MyProfilePage;
