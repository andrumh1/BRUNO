import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SocialLinkButton from "@/components/SocialLinkButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PostCard from "@/components/PostCard";
import CreatePost from "@/components/CreatePost";
import ReelsFeed from "@/components/ReelsFeed";
import { StoriesRow, CreateStoryModal } from "@/components/Stories";
import NotificationBell from "@/components/NotificationBell";
import BeaconsStyleCard from "@/components/BeaconsStyleCard";
import { FeedSidebar } from "@/components/FeedSidebar";
import axios from "axios";
import { Search, Eye, Share2, TrendingUp, LogOut, Grid3X3, List, MapPin, ShoppingBag, Home, CreditCard, RefreshCw, MessageCircle, Globe, User, Film, Store, Map, Briefcase, Users, HandHelping, Hash, UserPlus, Sparkles } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FeedPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  
  // Tab state: "foryou", "social", "reels" or "cards"
  const [activeTab, setActiveTab] = useState("foryou");
  
  // Social feed state
  const [posts, setPosts] = useState([]);
  const [forYouPosts, setForYouPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingForYou, setLoadingForYou] = useState(false);
  const [userCards, setUserCards] = useState([]);
  
  // Cards explorer state
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [trending, setTrending] = useState([]);
  const [suggested, setSuggested] = useState([]);

  // Fetch trending & suggested
  const fetchSocial = useCallback(async () => {
    try {
      const [trendRes, suggestRes] = await Promise.all([
        axios.get(`${API}/social/trending`).catch(() => ({ data: [] })),
        token 
          ? axios.get(`${API}/social/suggested`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
          : Promise.resolve({ data: [] })
      ]);
      setTrending(trendRes.data);
      setSuggested(suggestRes.data);
    } catch (e) {}
  }, [token]);

  // Fetch For You feed
  const fetchForYou = useCallback(async () => {
    if (!token) return;
    setLoadingForYou(true);
    try {
      const res = await axios.get(`${API}/feed/for-you`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setForYouPosts(res.data);
    } catch (e) {
      console.error("Error fetching for-you:", e);
    } finally {
      setLoadingForYou(false);
    }
  }, [token]);

  // Track post view for recommendation engine
  const trackView = useCallback(async (postId) => {
    if (!token) return;
    try {
      await axios.post(`${API}/feed/interaction?post_id=${postId}&interaction_type=view`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {}
  }, [token]);

  // Fetch posts for social feed
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get(`${API}/posts`, { headers });
      setPosts(response.data);
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoadingPosts(false);
    }
  }, [token]);

  // Fetch user's cards for sharing in posts
  const fetchUserCards = useCallback(async () => {
    if (!token) return;
    try {
      const response = await axios.get(`${API}/cards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserCards(response.data);
    } catch (error) {
      console.error("Error fetching user cards:", error);
    }
  }, [token]);

  // Fetch public cards for explorer tab
  const fetchPublicCards = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/public/cards`);
      setCards(response.data);
    } catch (error) {
      console.error("Error fetching public cards:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "foryou") {
      fetchForYou();
      fetchSocial();
    } else if (activeTab === "social") {
      fetchPosts();
      fetchSocial();
      if (token) fetchUserCards();
    } else if (activeTab === "cards") {
      fetchPublicCards();
    }
  }, [activeTab, token, fetchPosts, fetchUserCards, fetchPublicCards, fetchSocial, fetchForYou]);

  // Handle new post created
  const handlePostCreated = (newPost) => {
    // Add user info to the new post
    const enrichedPost = {
      ...newPost,
      user: {
        id: user?.id,
        username: user?.username,
        avatar_url: user?.avatar_url,
        display_name: user?.display_name || user?.username
      },
      is_liked: false,
      likes_count: 0,
      comments_count: 0
    };
    setPosts([enrichedPost, ...posts]);
  };

  // Handle post deletion
  const handlePostDelete = (postId) => {
    setPosts(posts.filter(p => p.id !== postId));
  };

  // Handle like update
  const handleLikeUpdate = (postId, data) => {
    setPosts(posts.map(p => 
      p.id === postId 
        ? { ...p, is_liked: data.liked, likes_count: data.likes_count }
        : p
    ));
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.subtitle && card.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterType === "all" || card.card_type === filterType;
    const visibleInFeed = card.show_in_feed !== false;
    
    return matchesSearch && matchesFilter && visibleInFeed;
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getCardTypeLabel = (type) => {
    const labels = {
      personal: t("cards.types.personal"),
      empresarial: t("cards.types.empresarial"),
      negocio: t("cards.types.negocio"),
      lugares: t("cards.types.lugares"),
      guardian: t("cards.types.guardian"),
      curriculum: t("cards.types.curriculum"),
      oferta_trabajo: "Oferta de Trabajo",
      busqueda_personal: "Búsqueda de Personal",
      solicitud_servicio: "Solicitud de Servicio",
    };
    return labels[type] || type;
  };

  // Check if card is a job-type card (uses Beacons style)
  const isJobCard = (cardType) => {
    return ["oferta_trabajo", "busqueda_personal", "solicitud_servicio"].includes(cardType);
  };

  // Grid Card Component
  const GridCard = ({ card }) => {
    // Use BeaconsStyleCard for job-type cards
    if (isJobCard(card.card_type)) {
      return <BeaconsStyleCard card={card} />;
    }

    return (
      <Card
        className={`overflow-hidden transition-all group backdrop-blur-xl bg-card/80 border border-white/40 shadow-[0_18px_45px_rgba(0,0,0,0.08)] card-hover-lift ${
          card.is_animated ? "card-bubble-animated" : "card-bubble-static"
        }`}
      >
        {/* Banner or Colored Header */}
        <div
          className="h-32 relative"
          style={{
            background: card.banner_url
              ? `url(${card.banner_url}) center/cover`
              : `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
          }}
        >
          <div className="absolute top-3 right-3">
            <div className="px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium">
              {getCardTypeLabel(card.card_type)}
            </div>
          </div>
        </div>

      <CardContent className="pt-6 pb-4 relative">
        {/* Avatar */}
        <div className="absolute -top-10 left-6">
          {card.avatar_url ? (
            <img
              src={card.avatar_url}
              alt={card.title}
              className="w-20 h-20 rounded-full border-4 border-background object-cover shadow-lg"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full border-4 border-background flex items-center justify-center text-2xl font-bold shadow-lg"
              style={{
                backgroundColor: card.background_color,
                color: card.text_color,
              }}
            >
              {card.title.charAt(0)}
            </div>
          )}
        </div>

        <div className="mt-12 space-y-3">
          <div>
            <Link to={`/c/${card.id}`} className="hover:opacity-80 transition-opacity">
              <h3 className="text-lg font-bold truncate">{card.title}</h3>
            </Link>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
            )}
            {card.user_id && (
              <Link to={`/profile/${card.user_id}`} className="text-xs text-primary hover:underline cursor-pointer" data-testid="card-user-profile-link">
                Ver perfil del autor
              </Link>
            )}
          </div>

          {card.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{card.description}</p>
          )}

          {/* Social Links */}
          {card.social_links && card.social_links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {card.social_links.slice(0, 5).map((link, index) => (
                <SocialLinkButton
                  key={index}
                  link={link}
                  size="sm"
                  onlyIcon={true}
                />
              ))}
              {card.social_links.length > 5 && (
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                  +{card.social_links.length - 5}
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/60">
            <div className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              <span>{card.views || 0} {t("feed.views")}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Link to={`/c/${card.id}`} className="flex-1">
              <Button variant="outline" size="sm" className="w-full">
                {t("dashboard.view")}
              </Button>
            </Link>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
    );
  };

  // List Card Component
  const ListCard = ({ card }) => (
    <div className="list-view-card">
      {/* Avatar */}
      {card.avatar_url ? (
        <img
          src={card.avatar_url}
          alt={card.title}
          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{
            backgroundColor: card.background_color,
            color: card.text_color,
          }}
        >
          {card.title.charAt(0)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold truncate">{card.title}</h3>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
            )}
          </div>
          <span className="px-2 py-1 rounded-full bg-primary/10 text-xs font-medium flex-shrink-0">
            {getCardTypeLabel(card.card_type)}
          </span>
        </div>
        
        {card.description && (
          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">{card.description}</p>
        )}

        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {card.views || 0}
          </span>
          {card.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {card.location.city || card.location.address}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <Link to={`/c/${card.id}`}>
          <Button variant="outline" size="sm">
            {t("dashboard.view")}
          </Button>
        </Link>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Share2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Simplified for mobile */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Link to="/">
              <img src="/bruno-logo.png" alt="BRUNO" className="bruno-logo hover:scale-105 transition-transform" />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Website Icon - Desktop only */}
              <Link to="/website" className="hidden md:block">
                <Button variant="ghost" size="icon" className="relative spring-button" title="Sitio Web BRUNO">
                  <Globe className="w-5 h-5" />
                </Button>
              </Link>
              {/* Store Icon - Always visible */}
              <Link to="/store">
                <Button variant="ghost" size="icon" className="relative spring-button" title="Tienda PIUP">
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              </Link>
              {/* Notification Bell */}
              {user && <NotificationBell />}
              <LanguageSwitcher variant="minimal" />
              {user ? (
                <>
                  {/* Dashboard - Desktop text, Mobile icon */}
                  <Link to="/my-profile" className="hidden sm:block">
                    <Button variant="ghost" size="sm">{t("nav.myPanel")}</Button>
                  </Link>
                  <Link to="/my-profile" className="sm:hidden">
                    <Button variant="ghost" size="icon"><Grid3X3 className="w-4 h-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="hidden md:flex">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" size="sm">{t("nav.login")}</Button>
                  </Link>
                  <Link to="/register" className="hidden sm:block">
                    <Button size="sm">{t("nav.register")}</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mb-3 sm:mb-4">
            {user && (
              <button
                onClick={() => setActiveTab("foryou")}
                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  activeTab === "foryou"
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground"
                }`}
                data-testid="foryou-tab-btn"
              >
                <Sparkles className="w-4 h-4" />
                <span>Para Ti</span>
              </button>
            )}
            <button
              onClick={() => setActiveTab("social")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "social"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              }`}
              data-testid="social-tab-btn"
            >
              <Home className="w-4 h-4" />
              <span>Feed</span>
            </button>
            <button
              onClick={() => setActiveTab("reels")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "reels"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              }`}
              data-testid="reels-tab-btn"
            >
              <Film className="w-4 h-4" />
              <span>Reels</span>
            </button>
            <button
              onClick={() => setActiveTab("cards")}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                activeTab === "cards"
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground"
              }`}
              data-testid="cards-tab-btn"
            >
              <CreditCard className="w-4 h-4" />
              <span>{t("nav.explore") || "Explorar"}</span>
            </button>
          </div>

          {/* Search and Filters - Only show for cards tab */}
          {activeTab === "cards" && (
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder={t("feed.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  data-testid="cards-search-input"
                />
              </div>
              <div className="flex gap-2 flex-wrap overflow-x-auto pb-2 sm:pb-0">
                <Button
                  variant={filterType === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("all")}
                >
                  {t("feed.allTypes")}
                </Button>
                <Button
                  variant={filterType === "personal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("personal")}
                >
                  {t("cards.types.personal")}
                </Button>
                <Button
                  variant={filterType === "empresarial" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("empresarial")}
                >
                  {t("cards.types.empresarial")}
                </Button>
                <Button
                  variant={filterType === "negocio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("negocio")}
                >
                  {t("cards.types.negocio")}
                </Button>
                <Button
                  variant={filterType === "lugares" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("lugares")}
                >
                  {t("cards.types.lugares")}
                </Button>
                <Button
                  variant={filterType === "guardian" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("guardian")}
                >
                  {t("cards.types.guardian")}
                </Button>
                <Button
                  variant={filterType === "curriculum" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("curriculum")}
                >
                  {t("cards.types.curriculum")}
                </Button>
                {/* New Job Card Types */}
                <Button
                  variant={filterType === "oferta_trabajo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("oferta_trabajo")}
                  className="flex items-center gap-1"
                >
                  <Briefcase className="w-3 h-3" />
                  Empleos
                </Button>
                <Button
                  variant={filterType === "busqueda_personal" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("busqueda_personal")}
                  className="flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  Personal
                </Button>
                <Button
                  variant={filterType === "solicitud_servicio" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterType("solicitud_servicio")}
                  className="flex items-center gap-1"
                >
                  <HandHelping className="w-3 h-3" />
                  Servicios
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* For You Tab */}
        {activeTab === "foryou" && (
          <div className="flex gap-6 max-w-5xl mx-auto">
            <div className="flex-1 max-w-xl mx-auto lg:mx-0 space-y-4">
              {/* Stories */}
              <div className="bg-card rounded-xl border mb-4">
                <StoriesRow onCreateStory={() => setShowCreateStory(true)} />
              </div>

              {/* Refresh */}
              <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={fetchForYou} disabled={loadingForYou} className="text-muted-foreground hover:text-primary" data-testid="refresh-foryou-btn">
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingForYou ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>

              {loadingForYou && forYouPosts.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-muted-foreground">Preparando tu feed personalizado...</p>
                </div>
              )}

              {!loadingForYou && forYouPosts.length === 0 && (
                <Card className="text-center py-16 glass-card">
                  <CardContent>
                    <Sparkles className="w-12 h-12 text-primary mx-auto mb-4" />
                    <h3 className="text-xl font-bold mb-2">Tu feed personalizado</h3>
                    <p className="text-muted-foreground mb-4">
                      Interactua con publicaciones para que aprendamos tus gustos. 
                      Dale like, guarda, y comenta para mejorar tus recomendaciones.
                    </p>
                    <Button onClick={() => setActiveTab("social")}>Explorar feed general</Button>
                  </CardContent>
                </Card>
              )}

              {forYouPosts.length > 0 && (
                <div className="space-y-4" data-testid="foryou-feed">
                  {forYouPosts.map((post) => (
                    <div key={post.id} onMouseEnter={() => trackView(post.id)}>
                      {/* Reason badge */}
                      {post._for_you_reason && post._for_you_reason !== "discover" && (
                        <div className="flex items-center gap-1.5 mb-1.5 ml-1">
                          {post._for_you_reason === "following" && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Users className="w-3 h-3" /> De alguien que sigues
                            </span>
                          )}
                          {post._for_you_reason === "hashtag_match" && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <Hash className="w-3 h-3" /> Basado en tus intereses
                            </span>
                          )}
                          {post._for_you_reason === "trending" && (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> Trending
                            </span>
                          )}
                        </div>
                      )}
                      <PostCard
                        post={post}
                        onLikeUpdate={handleLikeUpdate}
                        onDelete={(id) => setForYouPosts(prev => prev.filter(p => p.id !== id))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Sidebar */}
            <div className="hidden lg:block w-72 shrink-0 space-y-4 sticky top-28 self-start">
              {trending.length > 0 && (
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm">Tendencias</h3>
                    </div>
                    <div className="space-y-2">
                      {trending.slice(0, 6).map((t, i) => (
                        <Link key={i} to={`/hashtag/${t.hashtag}`} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted transition-colors group">
                          <div className="flex items-center gap-2 min-w-0">
                            <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="text-sm font-medium truncate group-hover:text-primary">#{t.hashtag}</span>
                          </div>
                          {t.count > 0 && <span className="text-[10px] text-muted-foreground shrink-0">{t.count}</span>}
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
              {suggested.length > 0 && (
                <Card className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <UserPlus className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-sm">Personas sugeridas</h3>
                    </div>
                    <div className="space-y-2.5">
                      {suggested.slice(0, 5).map((u) => (
                        <Link key={u.id} to={`/profile/${u.id}`} className="flex items-center gap-2.5 py-1 hover:opacity-80 transition-opacity">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                              {(u.name || "U")[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{u.name || u.username}</p>
                            {u.mutual_count > 0 && <p className="text-[10px] text-muted-foreground">{u.mutual_count} mutuales</p>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Social Feed Tab */}
        {activeTab === "social" && (
          <div className="flex gap-6 max-w-5xl mx-auto">
            {/* Main Feed */}
            <div className="flex-1 max-w-xl mx-auto lg:mx-0 space-y-4">
              {/* Stories Row */}
              <div className="bg-card rounded-xl border mb-4">
                <StoriesRow onCreateStory={() => setShowCreateStory(true)} />
              </div>
              
              {/* Create Post (only for logged in users) */}
              {user && (
                <CreatePost 
                  onPostCreated={handlePostCreated} 
                  userCards={userCards}
                />
              )}
              
              {/* Refresh Button */}
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchPosts}
                  disabled={loadingPosts}
                  className="text-muted-foreground hover:text-primary"
                  data-testid="refresh-feed-btn"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${loadingPosts ? "animate-spin" : ""}`} />
                  Actualizar
                </Button>
              </div>
              
              {/* Loading State */}
              {loadingPosts && posts.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Cargando publicaciones...</p>
                </div>
              )}
              
              {/* Empty State */}
              {!loadingPosts && posts.length === 0 && (
                <Card className="text-center py-16 glass-card">
                  <CardContent>
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Home className="w-8 h-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">Bienvenido al Feed!</h3>
                    <p className="text-muted-foreground mb-6">
                      {user 
                        ? "Se el primero en publicar algo. Comparte tu tarjeta o cuenta algo interesante!"
                        : "Inicia sesion para ver y crear publicaciones en la comunidad."
                      }
                    </p>
                    {!user && (
                      <Link to="/login">
                        <Button>{t("nav.login")}</Button>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              )}
              
              {/* Posts List */}
              {posts.length > 0 && (
                <div className="space-y-4" data-testid="posts-feed">
                  {posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onLikeUpdate={handleLikeUpdate}
                      onDelete={handlePostDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Right Sidebar - Desktop Only */}
            {/* Right Sidebar - Extracted */}
            <FeedSidebar trending={trending} suggested={suggested} user={user} />
          </div>
        )}

        {/* Reels Tab - Full Screen TikTok Style */}
        {activeTab === "reels" && (
          <div className="fixed inset-0 z-40 bg-black">
            <ReelsFeed />
            {/* Back button */}
            <button 
              onClick={() => setActiveTab("social")}
              className="absolute top-4 left-4 z-50 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
            >
              <Home className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Cards Explorer Tab */}
        {activeTab === "cards" && (
          <>
            {/* Hero Section */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 border border-primary/20 mb-3 sm:mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs sm:text-sm font-medium">{t("feed.subtitle")}</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-bold mb-2 sm:mb-4">{t("feed.title")}</h1>
            </div>

            {/* View Toggle */}
            <div className="flex justify-end mb-4 sm:mb-6">
              <div className="view-toggle">
                <button
                  className={viewMode === "grid" ? "active" : ""}
                  onClick={() => setViewMode("grid")}
                >
                  <Grid3X3 className="w-4 h-4" />
                  {t("feed.gridView")}
                </button>
                <button
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  <List className="w-4 h-4" />
                  {t("feed.listView")}
                </button>
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">{t("common.loading")}</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && filteredCards.length === 0 && (
              <Card className="text-center py-16 glass-card">
                <CardContent>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t("feed.noResults")}</h3>
                  <p className="text-muted-foreground mb-6">
                    {searchQuery ? `No hay resultados para "${searchQuery}"` : t("feed.noResults")}
                  </p>
                  <Link to="/register">
                    <Button>{t("dashboard.createCard")}</Button>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Cards Grid/List */}
            {!loading && filteredCards.length > 0 && (
              viewMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
                  {filteredCards.map((card) => (
                    <GridCard key={card.id} card={card} />
                  ))}
                </div>
              ) : (
                <div className="space-y-4 mb-10">
                  {filteredCards.map((card) => (
                    <ListCard key={card.id} card={card} />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </main>
      
      {/* Create Story Modal */}
      <CreateStoryModal 
        isOpen={showCreateStory}
        onClose={() => setShowCreateStory(false)}
        onCreated={() => {
          setShowCreateStory(false);
          // Optionally refresh stories
        }}
      />
    </div>
  );
};

export default FeedPage;
