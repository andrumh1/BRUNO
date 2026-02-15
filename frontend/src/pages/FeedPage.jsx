import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import SocialLinkButton from "@/components/SocialLinkButton";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import axios from "axios";
import { Search, Eye, Share2, TrendingUp, LogOut, Grid3X3, List, MapPin } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FeedPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); // grid or list

  useEffect(() => {
    fetchPublicCards();
  }, [token]);

  const fetchPublicCards = async () => {
    try {
      const response = await axios.get(`${API}/public/cards`);
      setCards(response.data);
    } catch (error) {
      console.error("Error fetching public cards:", error);
    } finally {
      setLoading(false);
    }
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
              <LanguageSwitcher variant="minimal" />
              {user ? (
                <>
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

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder={t("feed.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{t("feed.subtitle")}</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">{t("feed.title")}</h1>
        </div>

        {/* View Toggle */}
        <div className="flex justify-end mb-6">
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
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
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
      </main>
    </div>
  );
};

export default FeedPage;
