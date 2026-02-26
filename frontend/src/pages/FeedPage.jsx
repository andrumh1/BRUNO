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
import axios from "axios";
import { Search, Eye, Share2, TrendingUp, LogOut, Grid3X3, List, MapPin, ShoppingBag, Home, CreditCard, RefreshCw, MessageCircle, Globe, User, Film, Store } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FeedPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  
  // Tab state: "social" or "cards"
  const [activeTab, setActiveTab] = useState("social");
  
  // Social feed state
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [userCards, setUserCards] = useState([]);
  
  // Cards explorer state
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [showCreateStory, setShowCreateStory] = useState(false);

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
    if (activeTab === "social") {
      fetchPosts();
      if (token) fetchUserCards();
    } else {
      fetchPublicCards();
    }
  }, [activeTab, token, fetchPosts, fetchUserCards, fetchPublicCards]);

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
    };
    return labels[type] || type;
  };

  // Grid Card Component
  const GridCard = ({ card }) => (
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
            <h3 className="text-lg font-bold truncate">{card.title}</h3>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <Link to="/">
              <img src="/bruno-logo.png" alt="BRUNO" className="bruno-logo hover:scale-105 transition-transform" />
            </Link>
            <div className="flex items-center gap-1 sm:gap-2">
              {/* Website Icon */}
              <Link to="/website">
                <Button variant="ghost" size="icon" className="relative spring-button" title="Sitio Web BRUNO">
                  <Globe className="w-5 h-5" />
                </Button>
              </Link>
              {/* Marketplace Icon */}
              <Link to="/marketplace">
                <Button variant="ghost" size="icon" className="relative spring-button" title="Marketplace">
                  <Store className="w-5 h-5" />
                </Button>
              </Link>
              {/* Store Icon */}
              <Link to="/store">
                <Button variant="ghost" size="icon" className="relative spring-button" title="Tienda PIUP">
                  <ShoppingBag className="w-5 h-5" />
                </Button>
              </Link>
              {/* Chat Icon - only for logged in users */}
              {user && (
                <Link to="/chat">
                  <Button variant="ghost" size="icon" className="relative spring-button" title="Mensajes" data-testid="chat-nav-btn">
                    <MessageCircle className="w-5 h-5" />
                  </Button>
                </Link>
              )}
              <LanguageSwitcher variant="minimal" />
              {user ? (
                <>
                  {/* Profile Icon */}
                  <Link to="/my-profile">
                    <Button variant="ghost" size="icon" className="spring-button" title="Mi Perfil">
                      <User className="w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/dashboard" className="hidden sm:block">
                    <Button variant="ghost" size="sm">{t("nav.myPanel")}</Button>
                  </Link>
                  <Link to="/dashboard" className="sm:hidden">
                    <Button variant="ghost" size="icon"><Grid3X3 className="w-4 h-4" /></Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout}>
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
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Social Feed Tab */}
        {activeTab === "social" && (
          <div className="max-w-xl mx-auto space-y-4">
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
                  <h3 className="text-xl font-bold mb-2">¡Bienvenido al Feed!</h3>
                  <p className="text-muted-foreground mb-6">
                    {user 
                      ? "Sé el primero en publicar algo. ¡Comparte tu tarjeta o cuenta algo interesante!"
                      : "Inicia sesión para ver y crear publicaciones en la comunidad."
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
                    onLike={handleLikeUpdate}
                    onDelete={handlePostDelete}
                  />
                ))}
              </div>
            )}
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
