import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import PostCard from "@/components/PostCard";
import CardPreviewModal from "@/components/CardPreviewModal";
import DraggableList from "@/components/DraggableList";
import { PointsWidget } from "@/components/PointsSystem";
import QuickStoryButton from "@/components/bruno/QuickStoryButton";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";
import HighlightsSection from "@/components/bruno/HighlightsSection";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";
import LikesModal from "@/components/bruno/LikesModal";
import MyLikedPostsModal from "@/components/bruno/MyLikedPostsModal";
import useActiveStories from "@/hooks/useActiveStories";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTour } from "@/components/WelcomeTour";
import DndSettings from "@/components/DndSettings";
import axios from "axios";
import { 
  ArrowLeft,
  Settings,
  Search,
  Sparkles,
  Clock,
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
  FolderOpen,
  Plus,
  Eye,
  QrCode,
  Nfc,
  List as ListIcon,
  Scale,
  TrendingUp,
  LayoutGrid,
  ArrowUpDown,
  Heart
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
  const [activeTab, setActiveTab] = useState(() => new URLSearchParams(window.location.search).get("tab") || "reels");
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [saving, setSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { language, toggleLanguage } = useLanguage();
  const { startTour } = useTour();
  const [exploreCards, setExploreCards] = useState([]);
  const [cardViewMode, setCardViewMode] = useState("grid");
  const [showFollowers, setShowFollowers] = useState(null);
  const [followersList, setFollowersList] = useState([]);
  const [followingList, setFollowingList] = useState([]);
  const [showLikes, setShowLikes] = useState(false);
  const [showMyLiked, setShowMyLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [myLikedCount, setMyLikedCount] = useState(0);
  const [albums, setAlbums] = useState([]);

  // Active stories ring + viewer
  const activeStoriesIds = user?.id ? [user.id] : [];
  const { activeMap, openStories, closeStories, openedStories } = useActiveStories(activeStoriesIds, { enabled: !!user?.id });
  const hasActiveStory = !!(user?.id && activeMap[user.id]);
  const [previewCard, setPreviewCard] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);
  const longPressRef = useRef(null);
  const pressStartTime = useRef(0);

  const handleCardPress = (card) => {
    pressStartTime.current = Date.now();
    longPressRef.current = setTimeout(() => setPreviewCard(card), 500);
  };
  const handleCardRelease = (card) => {
    clearTimeout(longPressRef.current);
    if (Date.now() - pressStartTime.current < 500 && !previewCard) navigate(`/c/${card.id}`);
  };
  const [listLoading, setListLoading] = useState(false);

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
      // error handled
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
      const response = await axios.get(`${API}/users/${user.id}/posts?limit=500`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Normalize every media shape (media[], attachments[], legacy image_url/video_url)
      setPosts((response.data || []).map((p) => {
        const m = (p.media || [])[0] || {};
        const a = (p.attachments || [])[0] || {};
        const url = m.url || m.secure_url || a.url || p.media_url || p.image_url || p.video_url || null;
        const isVideo = m.type === "video" || a.type === "video" || p.post_type === "video" || !!p.video_url || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url || "");
        return {
          ...p,
          video_url: isVideo ? (p.video_url || url) : null,
          image_url: !isVideo ? (p.image_url || url) : p.image_url || null,
          thumbnail_url: p.thumbnail_url || m.poster_url || a.poster_url || (!isVideo ? url : null),
          media_count: (p.media || p.attachments || []).length,
        };
      }));
    } catch (error) {
      // error handled
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
      // error handled
    }
  }, [token]);

  // Fetch likes RECEIVED count (for the "Likes" stat on profile)
  const fetchLikesCount = useCallback(async () => {
    if (!token) return;
    try {
      const [received, given] = await Promise.all([
        axios.get(`${API}/users/me/likes-received`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/users/me/liked-posts`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setLikesCount(received.data?.total_likes || 0);
      setMyLikedCount(given.data?.total_likes || 0);
    } catch (error) {
      setLikesCount(0);
      setMyLikedCount(0);
    }
  }, [token]);

  // Fetch explore (all public) cards
  const fetchExploreCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cards/explore?limit=20`);
      setExploreCards(response.data || []);
    } catch (error) {
      // error handled
    }
  }, []);

  const fetchAlbums = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/albums`, { headers: { Authorization: `Bearer ${token}` } });
      setAlbums(response.data || []);
    } catch (error) {
      // error handled
    }
  }, [token]);

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm("Eliminar esta tarjeta?")) return;
    try {
      await axios.delete(`${API}/cards/${cardId}`, { headers: { Authorization: `Bearer ${token}` } });
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (err) {
      // error handled
    }
  };

  const handleShareCard = async (card) => {
    const url = `${window.location.origin}/c/${card.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: card.title, text: card.subtitle || "", url }); } catch (_) {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  const handleReorder = async (newCards) => {
    setCards(newCards);
    setReorderSaving(true);
    try {
      await axios.put(`${API}/cards/reorder`, { card_ids: newCards.map(c => c.id) }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      fetchCards();
    } finally {
      setReorderSaving(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchPosts(), fetchCards(), fetchExploreCards(), fetchAlbums(), fetchLikesCount()]);
      setLoading(false);
    };
    
    if (user && token) {
      loadData();
    }
  }, [fetchProfile, fetchPosts, fetchCards, fetchExploreCards, fetchAlbums, fetchLikesCount, user, token]);

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
      // error handled
    } finally {
      setSaving(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Load followers/following list
  const loadFollowersList = async (type) => {
    if (!user) return;
    setShowFollowers(type);
    setListLoading(true);
    try {
      const res = await axios.get(`${API}/users/${user.id}/${type}`);
      if (type === "followers") setFollowersList(res.data);
      else setFollowingList(res.data);
    } catch (e) {
      // error handled
    } finally {
      setListLoading(false);
    }
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

  const reels = posts.filter(p => p.video_url || p.media_type === 'video' || p.post_type === 'video');

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
              data-testid="profile-settings-btn"
              aria-label="Abrir ajustes"
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
              <h2 className="font-bold">Configuracion</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowSettings(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="p-2">
              <Link to="/settings" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Settings className="w-5 h-5 text-primary" />
                  <span className="flex-1 text-left font-medium">Configuracion completa</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/points" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="flex-1 text-left">Mis Puntos</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>

              <Link to="/saved" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Bookmark className="w-5 h-5 text-blue-500" />
                  <span className="flex-1 text-left">Posts Guardados</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>

              <Link to="/analytics" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="flex-1 text-left">Analytics</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/nfc-manager" onClick={() => setShowSettings(false)}>
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  <span className="flex-1 text-left">NFC Manager</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>
              
              <Link to="/map?explore=1" onClick={() => setShowSettings(false)} data-testid="profile-explore-cards-link">
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Search className="w-5 h-5 text-sky-500" />
                  <span className="flex-1 text-left">Explorar tarjetas</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>

              <button onClick={toggleLanguage} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors" data-testid="profile-language-toggle">
                <Globe className="w-5 h-5 text-emerald-500" />
                <span className="flex-1 text-left">Idioma</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted">{language === "es" ? "Español · ES" : "English · EN"}</span>
              </button>

              <button onClick={() => { setShowSettings(false); startTour(); }} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors" data-testid="profile-start-tour">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <span className="flex-1 text-left">Tour de bienvenida</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>

              <DndSettings token={token} />

              <Link to="/website" onClick={() => setShowSettings(false)} data-testid="profile-website-link">
                <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                  <Globe className="w-5 h-5 text-orange-500" />
                  <span className="flex-1 text-left">Sitio Web BRUNO</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </Link>

              <div className="my-2 border-t" />

              <button
                onClick={() => { logout(); navigate("/login"); }}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 transition-colors text-destructive"
              >
                <LogOut className="w-5 h-5" />
                <span className="flex-1 text-left">Cerrar sesion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header */}
      <div className="px-4 py-6">
        <div className="flex items-start gap-4">
          {/* Avatar with story ring (auto-detects active stories via context) */}
          <div className="relative" data-testid="my-profile-avatar-wrapper">
            <BrunoAvatar
              userId={user?.id}
              src={profile?.avatar_url}
              name={profile?.name || user?.name || user?.email}
              size={96}
              thickness={3}
              testId="my-profile-story-ring"
            />
            <button
              type="button"
              onClick={() => navigate("/edit-profile")}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-2 border-background z-10"
              data-testid="my-profile-avatar-edit-btn"
              aria-label="Editar avatar"
            >
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
              <button className="text-center hover:opacity-70 transition-opacity" onClick={() => loadFollowersList("followers")} data-testid="my-followers-count">
                <p className="text-xl font-bold">{profile?.followers_count || 0}</p>
                <p className="text-xs text-muted-foreground">Seguidores</p>
              </button>
              <button className="text-center hover:opacity-70 transition-opacity" onClick={() => loadFollowersList("following")} data-testid="my-following-count">
                <p className="text-xl font-bold">{profile?.following_count || 0}</p>
                <p className="text-xs text-muted-foreground">Siguiendo</p>
              </button>
              <button className="text-center hover:opacity-70 transition-opacity" onClick={() => setShowLikes(true)} data-testid="my-likes-count">
                <p className="text-xl font-bold text-orange-500">{likesCount}</p>
                <p className="text-xs text-muted-foreground">Likes</p>
              </button>
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
            <QuickStoryButton variant="icon" testId="profile-quick-story" />
          </div>
        )}

        {/* Points Widget */}
        <div className="mt-4">
          <PointsWidget />
        </div>
      </div>

      {/* Saved Stories / Highlights */}
      <HighlightsSection
        userId={user?.id}
        isOwner
        userName={profile?.name || user?.name || ""}
        avatarUrl={profile?.avatar_url || ""}
      />

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
            onClick={() => setActiveTab("saved")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "saved" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <Bookmark className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Guardados</span>
          </button>
          <button
            onClick={() => setActiveTab("albums")}
            className={`flex-1 py-3 flex items-center justify-center gap-2 border-b-2 transition-colors ${
              activeTab === "albums" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            }`}
          >
            <FolderOpen className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Albums</span>
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
              <Link to="/compose">
                <Button className="mt-4">Crear publicación</Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(post => (
                <Link key={post.id} to={post.video_url ? `/reels?id=${post.id}` : `/post/${post.id}`} data-testid={`profile-post-${post.id}`}>
                  <div className="aspect-square bg-muted rounded-lg overflow-hidden relative no-glass">
                    {post.visibility === "scheduled" && (
                      <span className="absolute top-1 left-1 z-10 rounded-full bg-amber-500 text-white text-[9px] font-semibold px-1.5 py-0.5 inline-flex items-center gap-0.5" data-testid={`profile-post-scheduled-${post.id}`}>
                        <Clock className="w-2.5 h-2.5" /> Programado
                      </span>
                    )}
                    {post.thumbnail_url || post.image_url ? (
                      <img src={post.thumbnail_url || post.image_url} alt="" className="w-full h-full object-cover" />
                    ) : post.video_url ? (
                      <video src={post.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-2 bg-gradient-to-br from-primary/10 to-primary/5">
                        <p className="text-xs line-clamp-4 text-center">{post.content}</p>
                      </div>
                    )}
                    {post.video_url && <Film className="absolute top-1 right-1 w-3.5 h-3.5 text-white drop-shadow" />}
                    {post.media_count > 1 && <Grid3X3 className="absolute top-1 right-1 w-3.5 h-3.5 text-white drop-shadow" />}
                    {post.visibility && post.visibility !== "public" && (
                      <span className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">{post.visibility === "followers" ? "Seguidores" : "Privado"}</span>
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
              <Button className="mt-4" onClick={() => navigate("/camera")} data-testid="profile-create-reel">Crear reel</Button>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {reels.map(reel => (
                <Link key={reel.id} to={`/reels?id=${reel.id}`}>
                  <div className="aspect-[9/16] bg-black rounded-lg overflow-hidden relative">
                    {reel.visibility === "scheduled" && (
                      <span className="absolute top-1 left-1 z-10 rounded-full bg-amber-500 text-white text-[9px] font-semibold px-1.5 py-0.5 inline-flex items-center gap-0.5" data-testid={`profile-post-scheduled-${reel.id}`}>
                        <Clock className="w-2.5 h-2.5" /> Programado
                      </span>
                    )}
                    {reel.thumbnail_url ? (
                      <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <video src={reel.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />
                    )}
                    {reel.visibility && reel.visibility !== "public" && (
                      <span className="absolute top-1 left-1 text-[9px] px-1.5 py-0.5 rounded-full bg-black/60 text-white">{reel.visibility === "followers" ? "Seguidores" : "Privado"}</span>
                    )}
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

        {/* Cards - Full Dashboard Panel */}
        {activeTab === "cards" && (
          <div className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{cards.length}</p>
                <p className="text-[10px] text-muted-foreground">Tarjetas</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{cards.reduce((a, c) => a + (c.views || 0), 0)}</p>
                <p className="text-[10px] text-muted-foreground">Vistas</p>
              </div>
              <div className="glass-card rounded-xl p-3 text-center">
                <p className="text-2xl font-bold">{cards.filter(c => c.is_public).length}</p>
                <p className="text-[10px] text-muted-foreground">Publicas</p>
              </div>
            </div>

            {/* Actions Bar */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => navigate("/cards/new")} className="rounded-full" data-testid="create-card-btn">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Nueva Tarjeta
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/nfc/manage")} className="rounded-full">
                <Nfc className="w-3.5 h-3.5 mr-1" />
                NFC
              </Button>
              <Button 
                size="sm" 
                variant={reorderMode ? "default" : "outline"} 
                onClick={() => { setReorderMode(!reorderMode); if (!reorderMode) setCardViewMode("list"); }}
                className="rounded-full"
                data-testid="reorder-cards-btn"
              >
                {reorderSaving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ArrowUpDown className="w-3.5 h-3.5 mr-1" />}
                {reorderMode ? "Listo" : "Ordenar"}
              </Button>
              <div className="ml-auto flex gap-1">
                <button onClick={() => setCardViewMode("compact")} className={`p-1.5 rounded-lg ${cardViewMode === "compact" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`} data-testid="profile-view-compact">
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setCardViewMode("grid")} className={`p-1.5 rounded-lg ${cardViewMode === "grid" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button onClick={() => setCardViewMode("list")} className={`p-1.5 rounded-lg ${cardViewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Cards Display */}
            {cards.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No tienes tarjetas aun</p>
                <Button className="mt-4 rounded-full" onClick={() => navigate("/cards/new")}>
                  <Plus className="w-4 h-4 mr-2" />
                  Crear tarjeta
                </Button>
              </div>
            ) : cardViewMode === "compact" ? (
              /* Compact: 3 cols, smallest */
              <div className="grid grid-cols-3 gap-2">
                {cards.map(card => (
                  <div key={card.id}
                    className="glass-card rounded-xl overflow-hidden cursor-pointer active:scale-[0.96] transition-all"
                    onPointerDown={() => handleCardPress(card)}
                    onPointerUp={() => handleCardRelease(card)}
                    onPointerLeave={() => clearTimeout(longPressRef.current)}
                    data-testid={`profile-compact-card-${card.id}`}
                  >
                    <div className="h-16 relative" style={{ background: card.banner_url ? undefined : `linear-gradient(135deg, ${card.background_color || '#f97316'}, ${card.background_color || '#ea580c'}dd)` }}>
                      {card.banner_url && <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    </div>
                    <div className="p-2">
                      <h4 className="text-[10px] font-bold truncate">{card.title}</h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[8px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-2 h-2" />{card.views || 0}</span>
                        <div className="flex gap-0.5">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/cards/${card.id}/edit`); }} className="p-0.5 rounded hover:bg-muted">
                            <Edit3 className="w-2.5 h-2.5" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }} className="p-0.5 rounded hover:bg-red-50 text-destructive">
                            <Trash2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : cardViewMode === "grid" ? (
              /* Grid: 2 cols, medium */
              <div className="grid grid-cols-2 gap-3">
                {cards.map(card => (
                  <div key={card.id}
                    className="glass-card rounded-xl overflow-hidden cursor-pointer active:scale-[0.97] transition-all hover:shadow-lg"
                    onPointerDown={() => handleCardPress(card)}
                    onPointerUp={() => handleCardRelease(card)}
                    onPointerLeave={() => clearTimeout(longPressRef.current)}
                    data-testid={`profile-grid-card-${card.id}`}
                  >
                    <div className="h-24 relative overflow-hidden rounded-t-xl" style={{ backgroundColor: card.background_color || '#f97316' }}>
                      {card.banner_url ? (
                        <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.background_color || '#f97316'}, ${card.background_color || '#ea580c'}dd)` }} />
                      )}
                      <div className="absolute top-2 left-2">
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium text-white bg-black/40 capitalize">{card.card_type}</span>
                      </div>
                    </div>
                    <div className="p-2.5">
                      <h3 className="font-bold text-xs truncate">{card.title}</h3>
                      {card.subtitle && <p className="text-[10px] text-muted-foreground truncate">{card.subtitle}</p>}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{card.views || 0}</span>
                          <span className={card.is_public ? "text-green-500" : "text-yellow-500"}>{card.is_public ? "Pub" : "Priv"}</span>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); navigate(`/cards/${card.id}/edit`); }} className="p-1 rounded hover:bg-muted" data-testid={`edit-card-${card.id}`}>
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleShareCard(card); }} className="p-1 rounded hover:bg-muted">
                            <Share2 className="w-3 h-3" />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }} className="p-1 rounded hover:bg-red-50 text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* List: compact rows — with drag-to-reorder support */
              reorderMode ? (
                <DraggableList
                  items={cards}
                  onReorder={handleReorder}
                  keyExtractor={(card) => card.id}
                  className="space-y-2"
                  renderItem={(card) => (
                    <div
                      className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 transition-all"
                      data-testid={`profile-list-card-${card.id}`}
                    >
                      {card.avatar_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={card.avatar_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: card.background_color || '#f97316' }}>
                          {card.title?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs truncate">{card.title}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="capitalize">{card.card_type}</span>
                          <span><Eye className="w-2.5 h-2.5 inline" /> {card.views || 0}</span>
                          <span className={card.is_public ? "text-green-500" : "text-yellow-500"}>{card.is_public ? "Pub" : "Priv"}</span>
                        </div>
                      </div>
                    </div>
                  )}
                />
              ) : (
                <div className="space-y-2">
                  {cards.map(card => (
                    <div key={card.id}
                      className="glass-card rounded-xl p-2.5 flex items-center gap-2.5 cursor-pointer active:bg-muted/50 transition-all"
                      onPointerDown={() => handleCardPress(card)}
                      onPointerUp={() => handleCardRelease(card)}
                      onPointerLeave={() => clearTimeout(longPressRef.current)}
                      data-testid={`profile-list-card-${card.id}`}
                    >
                      {card.avatar_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0">
                          <img src={card.avatar_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: card.background_color || '#f97316' }}>
                          {card.title?.charAt(0) || "?"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-xs truncate">{card.title}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span className="capitalize">{card.card_type}</span>
                          <span><Eye className="w-2.5 h-2.5 inline" /> {card.views || 0}</span>
                          <span className={card.is_public ? "text-green-500" : "text-yellow-500"}>{card.is_public ? "Pub" : "Priv"}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/cards/${card.id}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted">
                          <Edit3 className="w-3 h-3" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }} className="p-1.5 rounded-lg hover:bg-red-50 text-destructive">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Card Preview Modal */}
            <CardPreviewModal card={previewCard} isOpen={!!previewCard} onClose={() => setPreviewCard(null)} />
          </div>
        )}

        {/* Saved */}
        {activeTab === "saved" && (
          <div className="text-center py-12">
            <Bookmark className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay posts guardados</p>
          </div>
        )}

        {/* Albums */}
        {activeTab === "albums" && (
          <div data-testid="albums-tab-content">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm">{albums.length} album{albums.length !== 1 ? 'es' : ''}</h3>
              <Button size="sm" variant="outline" onClick={() => navigate("/albums")} data-testid="manage-albums-btn">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Gestionar
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* Pinned virtual album: "Me gusta" (posts the user liked) */}
              <button
                onClick={() => setShowMyLiked(true)}
                className="group relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br from-pink-500 via-orange-500 to-rose-500 border border-orange-200 hover:shadow-lg hover:shadow-orange-500/30 transition-all"
                data-testid="album-card-me-gusta"
              >
                <div className="absolute inset-0 grid place-items-center">
                  <div className="grid place-items-center w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Heart className="w-8 h-8 text-white fill-white drop-shadow" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-left">
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3 h-3 text-white/80 fill-white/80" />
                    <span className="text-white text-sm font-bold truncate">Me gusta</span>
                  </div>
                  <span className="text-white/80 text-[10px]">{myLikedCount} publicaci{myLikedCount === 1 ? "ón" : "ones"}</span>
                </div>
                <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-white/30 backdrop-blur-sm">
                  <span className="text-[9px] font-bold text-white tracking-wider">AUTO</span>
                </div>
              </button>

              {albums.length === 0 && (
                <button
                  onClick={() => navigate("/albums")}
                  className="aspect-square rounded-xl border-2 border-dashed border-orange-300 bg-orange-50/30 hover:bg-orange-50 hover:border-orange-400 transition-colors grid place-items-center"
                  data-testid="album-create-empty"
                >
                  <div className="text-center px-3">
                    <Plus className="w-7 h-7 text-orange-500 mx-auto mb-1.5" />
                    <p className="text-xs font-semibold text-orange-700">Crear álbum</p>
                  </div>
                </button>
              )}

              {albums.map((album) => (
                <button
                  key={album.id}
                  onClick={() => navigate(`/albums?open=${album.id}`)}
                  className="group relative aspect-square rounded-xl overflow-hidden bg-muted border hover:shadow-lg transition-all"
                  data-testid={`album-card-${album.id}`}
                >
                  {album.photos?.length > 0 ? (
                    <img src={album.photos[0].url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <FolderOpen className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8">
                    <div className="flex items-center gap-1.5">
                      {album.is_public ? (
                        <Globe className="w-3 h-3 text-white/70" />
                      ) : (
                        <Shield className="w-3 h-3 text-white/70" />
                      )}
                      <span className="text-white text-sm font-semibold truncate">{album.name}</span>
                    </div>
                    <span className="text-white/60 text-[10px]">{album.photos?.length || 0} fotos</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
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
                    {showFollowers === "followers" ? "Aun no tienes seguidores" : "No sigues a nadie"}
                  </div>
                ) : (
                  (showFollowers === "followers" ? followersList : followingList).map(u => (
                    <Link
                      key={u.id}
                      to={`/profile/${u.id}`}
                      onClick={() => setShowFollowers(null)}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted transition-colors"
                    >
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                          {(u.name || "U")[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{u.name || "Usuario"}</p>
                        {u.bio && <p className="text-xs text-muted-foreground truncate">{u.bio}</p>}
                      </div>
                    </Link>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active 24h story viewer (opens from clicking the story ring around avatar) */}
      {openedStories && (
        <BrunoStoryViewer
          userStories={openedStories}
          allUsers={[]}
          onClose={closeStories}
        />
      )}

      {/* Likes modal — shows people who LIKED MY posts, grouped by liker */}
      <LikesModal open={showLikes} onClose={() => setShowLikes(false)} />

      {/* "Me gusta" virtual album — posts the user has liked, grouped by author */}
      <MyLikedPostsModal open={showMyLiked} onClose={() => setShowMyLiked(false)} />
    </div>
  );
};

export default MyProfilePage;
