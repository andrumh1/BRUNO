import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { MapPin, ArrowLeft, Navigation, Eye } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const MapPage = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }
    fetchCards();
  }, [user, token, navigate]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Filtrar solo tarjetas con ubicación
      const cardsWithLocation = response.data.filter(card => card.location);
      setCards(cardsWithLocation);
    } catch (error) {
      console.error("Error fetching cards:", error);
    } finally {
      setLoading(false);
    }
  };

  const openInMaps = (location, title) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?q=${location.lat},${location.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    
    window.open(url, '_blank');
  };

  const openAllInMaps = () => {
    if (cards.length === 0) return;
    
    // Abrir Google Maps con múltiples marcadores
    const markers = cards.map(card => 
      `${card.location.lat},${card.location.lng}`
    ).join('|');
    
    const url = `https://www.google.com/maps/dir/?api=1&waypoints=${markers}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Mapa de Tarjetas</h1>
              <p className="text-sm text-muted-foreground">{cards.length} ubicaciones guardadas</p>
            </div>
          </div>
          {cards.length > 0 && (
            <Button onClick={openAllInMaps}>
              <Navigation className="w-4 h-4 mr-2" />
              Ver Todas en Mapa
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando ubicaciones...</p>
          </div>
        ) : cards.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">No tienes tarjetas con ubicación</h3>
              <p className="text-muted-foreground mb-6">
                Agrega ubicaciones a tus tarjetas para verlas en el mapa
              </p>
              <Link to="/cards/new">
                <Button>Crear Tarjeta con Ubicación</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Card key={card.id} className="overflow-hidden hover:shadow-lg transition-all">
                <div
                  className="h-32 relative cursor-pointer"
                  style={{
                    background: card.banner_url
                      ? `url(${card.banner_url}) center/cover`
                      : `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
                  }}
                  onClick={() => openInMaps(card.location, card.title)}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                    <div className="flex items-center gap-2 text-white">
                      <MapPin className="w-5 h-5" />
                      <span className="text-sm font-medium">Click para abrir en Mapa</span>
                    </div>
                  </div>
                </div>

                <CardContent className="pt-6">
                  <div className="flex items-start gap-4 mb-4">
                    {card.avatar_url ? (
                      <img
                        src={card.avatar_url}
                        alt={card.title}
                        className="w-16 h-16 rounded-full object-cover border-2"
                        style={{ borderColor: card.background_color }}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold"
                        style={{
                          backgroundColor: card.background_color,
                          color: card.text_color,
                        }}
                      >
                        {card.title.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold truncate">{card.title}</h3>
                      {card.subtitle && (
                        <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{card.location.place_name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {card.location.address}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Eye className="w-4 h-4" />
                      <span>{card.views || 0} vistas</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => openInMaps(card.location, card.title)}
                      >
                        <Navigation className="w-4 h-4 mr-1" />
                        Abrir en Mapa
                      </Button>
                      <Link to={`/c/${card.id}`} className="flex-1">
                        <Button size="sm" variant="ghost" className="w-full">
                          Ver Tarjeta
                        </Button>
                      </Link>
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

export default MapPage;
