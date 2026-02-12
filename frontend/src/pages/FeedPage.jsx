import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import SocialLinkButton from "@/components/SocialLinkButton";
import axios from "axios";
import { Search, Eye, Heart, MessageSquare, Share2, Filter, TrendingUp, LogOut } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const FeedPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    fetchPublicCards();
  }, []);

  const fetchPublicCards = async () => {
    try {
      // Por ahora obtenemos todas las tarjetas
      // TODO: Crear endpoint específico para tarjetas públicas
      const response = await axios.get(`${API}/cards`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setCards(response.data.filter(card => card.is_public));
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCards = cards.filter(card => {
    const matchesSearch = 
      card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (card.subtitle && card.subtitle.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterType === "all" || card.card_type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link to="/">
              <img src="/bruno-logo.png" alt="BRUNO" className="h-10" />
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link to="/dashboard">
                    <Button variant="ghost">Mi Panel</Button>
                  </Link>
                  <Button variant="ghost" onClick={handleLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Salir
                  </Button>
                </>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost">Iniciar Sesión</Button>
                  </Link>
                  <Link to="/register">
                    <Button>Registrarse</Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar tarjetas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterType === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("all")}
              >
                Todas
              </Button>
              <Button
                variant={filterType === "personal" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("personal")}
              >
                Personal
              </Button>
              <Button
                variant={filterType === "empresarial" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("empresarial")}
              >
                Empresarial
              </Button>
              <Button
                variant={filterType === "negocio" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("negocio")}
              >
                Negocio
              </Button>
              <Button
                variant={filterType === "lugares" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterType("lugares")}
              >
                Lugares
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Explora la comunidad BRUNO</span>
          </div>
          <h1 className="text-4xl font-bold mb-4">Descubre Tarjetas Increíbles</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Explora miles de tarjetas digitales de profesionales, empresas y lugares
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando tarjetas...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCards.length === 0 && (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">No se encontraron tarjetas</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? `No hay resultados para "${searchQuery}"` : "Aún no hay tarjetas públicas"}
              </p>
              <Link to="/register">
                <Button>Crear la primera tarjeta</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Cards Grid */}
        {!loading && filteredCards.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCards.map((card) => (
              <Card key={card.id} className="overflow-hidden hover:shadow-xl transition-all group">
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
                      {card.card_type === "personal" && "Personal"}
                      {card.card_type === "empresarial" && "Empresarial"}
                      {card.card_type === "negocio" && "Negocio"}
                      {card.card_type === "lugares" && "Lugar"}
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
                    <div className="flex items-center gap-4 text-sm text-muted-foreground pt-3 border-t">
                      <div className="flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        <span>{card.views || 0}</span>
                      </div>
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <Heart className="w-4 h-4" />
                        <span>0</span>
                      </button>
                      <button className="flex items-center gap-1 hover:text-primary transition-colors">
                        <MessageSquare className="w-4 h-4" />
                        <span>0</span>
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Link to={`/c/${card.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          Ver Tarjeta
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm">
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FeedPage;
