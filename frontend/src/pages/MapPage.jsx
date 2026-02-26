import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { MiniCard, MapMarkerCard } from "@/components/CardVariants";
import { AvatarWithBadge } from "@/components/VerifiedBadge";
import axios from "axios";
import { 
  MapPin, 
  ArrowLeft, 
  Navigation, 
  Search, 
  Crosshair,
  Layers,
  ZoomIn,
  ZoomOut,
  Route,
  X,
  MessageCircle,
  Eye,
  Users,
  Radio,
  Wifi
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

const MapPage = () => {
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCardList, setShowCardList] = useState(false);
  const [mapStyle, setMapStyle] = useState("streets");
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const wsRef = useRef(null);
  const locationWatchRef = useRef(null);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Fetch cards with location
  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }
    fetchCards();
  }, [user, token, navigate]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/cards/public?with_location=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cardsWithLocation = response.data.filter(card => card.location?.lat && card.location?.lng);
      setCards(cardsWithLocation);
    } catch (error) {
      console.error("Error fetching cards:", error);
      // Fallback to user's own cards
      try {
        const response = await axios.get(`${API}/cards`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const cardsWithLocation = response.data.filter(card => card.location?.lat && card.location?.lng);
        setCards(cardsWithLocation);
      } catch (e) {
        console.error("Error fetching user cards:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  // Calculate distance between two points (Haversine formula)
  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c;
    
    if (d < 1) {
      return `${Math.round(d * 1000)} m`;
    }
    return `${d.toFixed(1)} km`;
  }, []);

  // Update distance when card is selected
  useEffect(() => {
    if (selectedCard && userLocation && selectedCard.location) {
      const dist = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        selectedCard.location.lat,
        selectedCard.location.lng
      );
      setDistance(dist);
    } else {
      setDistance(null);
    }
  }, [selectedCard, userLocation, calculateDistance]);

  // Open directions in maps app
  const openDirections = (card) => {
    if (!card.location) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    let url;
    
    if (userLocation) {
      url = isIOS
        ? `maps://maps.apple.com/?saddr=${userLocation.lat},${userLocation.lng}&daddr=${card.location.lat},${card.location.lng}`
        : `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${card.location.lat},${card.location.lng}`;
    } else {
      url = isIOS
        ? `maps://maps.apple.com/?q=${card.location.lat},${card.location.lng}`
        : `https://www.google.com/maps/search/?api=1&query=${card.location.lat},${card.location.lng}`;
    }
    
    window.open(url, '_blank');
  };

  // Start chat with card owner
  const startChat = async (card) => {
    if (!token) {
      navigate("/login");
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/chats?participant_id=${card.user_id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/chat/${response.data.id}`);
    } catch (error) {
      console.error("Error starting chat:", error);
    }
  };

  // Filter cards by search
  const filteredCards = cards.filter(card => 
    card.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.location?.place_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Center map on user location
  const centerOnUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setCenter([userLocation.lng, userLocation.lat]);
      mapInstanceRef.current.setZoom(15);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header - Snapchat style */}
      <header className="absolute top-0 left-0 right-0 z-20 p-4 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full shadow-lg bg-card/80 backdrop-blur-xl"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex-1 max-w-md mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar tarjetas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full bg-card/80 backdrop-blur-xl border-0 shadow-lg"
              />
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full shadow-lg bg-card/80 backdrop-blur-xl"
            onClick={() => setShowCardList(!showCardList)}
          >
            <Layers className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Cargando mapa...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Visual Map Representation */}
            <div 
              ref={mapRef}
              className="absolute inset-0 bg-gradient-to-b from-blue-100 to-green-100"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 30%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
                  radial-gradient(circle at 80% 70%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
                `
              }}
            >
              {/* Grid overlay for map feel */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '50px 50px'
                }}
              />
              
              {/* User location marker */}
              {userLocation && (
                <div 
                  className="absolute z-30"
                  style={{
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="relative">
                    <div className="w-6 h-6 bg-blue-500 rounded-full border-3 border-white shadow-lg animate-pulse" />
                    <div className="absolute inset-0 bg-blue-500/30 rounded-full animate-ping" />
                  </div>
                </div>
              )}
              
              {/* Card markers - distributed around the map */}
              {filteredCards.map((card, index) => {
                // Calculate position based on card location relative to center
                const angle = (index / filteredCards.length) * 2 * Math.PI;
                const radius = 30 + (index % 3) * 15; // Vary radius
                const x = 50 + Math.cos(angle) * radius;
                const y = 50 + Math.sin(angle) * radius;
                
                return (
                  <div
                    key={card.id}
                    className="absolute z-20 cursor-pointer"
                    style={{
                      left: `${Math.min(90, Math.max(10, x))}%`,
                      top: `${Math.min(85, Math.max(15, y))}%`,
                      transform: 'translate(-50%, -50%)'
                    }}
                    onClick={() => setSelectedCard(card)}
                  >
                    <MapMarkerCard 
                      card={card} 
                      isSelected={selectedCard?.id === card.id}
                      onClick={() => setSelectedCard(card)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Map Controls */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full shadow-lg bg-card/80 backdrop-blur-xl"
                onClick={centerOnUser}
              >
                <Crosshair className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full shadow-lg bg-card/80 backdrop-blur-xl"
              >
                <ZoomIn className="w-5 h-5" />
              </Button>
              <Button 
                variant="secondary" 
                size="icon" 
                className="rounded-full shadow-lg bg-card/80 backdrop-blur-xl"
              >
                <ZoomOut className="w-5 h-5" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Card List Drawer */}
      {showCardList && (
        <div className="absolute inset-x-0 bottom-0 z-30 max-h-[60vh] bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
          <div className="p-4">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h3 className="font-bold mb-4">{filteredCards.length} tarjetas con ubicación</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredCards.map((card) => (
                <MiniCard
                  key={card.id}
                  card={card}
                  onClick={() => {
                    setSelectedCard(card);
                    setShowCardList(false);
                  }}
                  showDistance={!!userLocation}
                  distance={userLocation ? calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    card.location.lat,
                    card.location.lng
                  ) : null}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Card Detail */}
      {selectedCard && !showCardList && (
        <div className="absolute inset-x-0 bottom-0 z-30 bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
          <div className="p-4">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setSelectedCard(null)}
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="flex gap-4">
              {/* Avatar */}
              {selectedCard.avatar_url ? (
                <img 
                  src={selectedCard.avatar_url} 
                  alt={selectedCard.title}
                  className="w-20 h-20 rounded-2xl object-cover border-2"
                  style={{ borderColor: selectedCard.background_color }}
                />
              ) : (
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: selectedCard.background_color, color: selectedCard.text_color }}
                >
                  {selectedCard.title?.charAt(0) || "?"}
                </div>
              )}
              
              {/* Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{selectedCard.title}</h3>
                {selectedCard.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{selectedCard.subtitle}</p>
                )}
                
                {/* Location */}
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{selectedCard.location?.place_name}</span>
                </div>
                
                {/* Distance */}
                {distance && (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-primary/10 rounded-full text-sm font-medium text-primary">
                    <Route className="w-4 h-4" />
                    {distance} de distancia
                  </div>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <Button 
                className="flex-1"
                style={{ backgroundColor: selectedCard.background_color }}
                onClick={() => openDirections(selectedCard)}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Cómo llegar
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => startChat(selectedCard)}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate(`/c/${selectedCard.id}`)}
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <Card className="max-w-sm mx-4">
            <CardContent className="text-center py-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">No hay tarjetas con ubicación</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agrega ubicaciones a tus tarjetas para verlas en el mapa
              </p>
              <Button onClick={() => navigate("/cards/new")}>
                Crear Tarjeta
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default MapPage;
