import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
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
  X,
  MessageCircle,
  Eye,
  Users,
  Radio,
  Wifi,
  Route
} from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color, size = 30) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      width: ${size}px; 
      height: ${size}px; 
      background-color: ${color}; 
      border-radius: 50% 50% 50% 0; 
      transform: rotate(-45deg);
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
  });
};

const userIcon = L.divIcon({
  className: 'user-marker',
  html: `<div style="
    width: 20px; 
    height: 20px; 
    background-color: #3B82F6; 
    border-radius: 50%;
    border: 4px solid white;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.3), 0 2px 8px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const onlineUserIcon = (avatarUrl, name) => L.divIcon({
  className: 'online-user-marker',
  html: `<div style="
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid #22C55E;
    background: ${avatarUrl ? `url(${avatarUrl}) center/cover` : '#6B7280'};
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
  ">${!avatarUrl ? name?.charAt(0) || '?' : ''}</div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

// Component to recenter map
function RecenterMap({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
}

const MapPage = () => {
  const navigate = useNavigate();
  const { token, user, loading: authLoading } = useAuth();
  
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [distance, setDistance] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCardList, setShowCardList] = useState(false);
  const [mapCenter, setMapCenter] = useState([19.4326, -99.1332]); // Default: Mexico City
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [showOnlineUsers, setShowOnlineUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const wsRef = useRef(null);
  const locationWatchRef = useRef(null);

  // Get user's current location and watch for updates
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(loc);
          setMapCenter([loc.lat, loc.lng]);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        { enableHighAccuracy: true }
      );
      
      locationWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(newLocation);
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              action: "location_update",
              location: newLocation
            }));
          }
        },
        (error) => console.error("Location watch error:", error),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
      );
    }
    
    return () => {
      if (locationWatchRef.current) {
        navigator.geolocation.clearWatch(locationWatchRef.current);
      }
    };
  }, []);

  // WebSocket for real-time user locations
  useEffect(() => {
    if (!token) return;
    
    const connectWS = () => {
      try {
        const ws = new WebSocket(`${WS_URL}/ws/map/${token}`);
        
        ws.onopen = () => {
          console.log("Map WebSocket connected");
          wsRef.current = ws;
          
          if (userLocation) {
            ws.send(JSON.stringify({
              action: "location_update",
              location: userLocation
            }));
          }
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === "users_nearby") {
              setOnlineUsers(data.users || []);
            } else if (data.type === "user_location_update") {
              setOnlineUsers(prev => {
                const existing = prev.find(u => u.id === data.user.id);
                if (existing) {
                  return prev.map(u => u.id === data.user.id ? data.user : u);
                }
                return [...prev, data.user];
              });
            } else if (data.type === "user_disconnected") {
              setOnlineUsers(prev => prev.filter(u => u.id !== data.user_id));
            }
          } catch (e) {}
        };
        
        ws.onclose = () => {
          console.log("Map WebSocket disconnected");
          setTimeout(connectWS, 3000);
        };
        
        return ws;
      } catch (e) {
        console.error("WebSocket error:", e);
        return null;
      }
    };
    
    const ws = connectWS();
    
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [token, userLocation]);

  // Fetch cards with location
  useEffect(() => {
    if (authLoading) return;
    
    if (!user || !token) {
      navigate("/login");
      return;
    }
    fetchCards();
  }, [user, token, navigate, authLoading]);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/cards/public?with_location=true`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const cardsWithLocation = response.data.filter(card => card.location?.lat && card.location?.lng);
      setCards(cardsWithLocation);
    } catch (error) {
      console.error("Error fetching cards:", error);
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
    const R = 6371;
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

  // Start chat with user
  const startChatWithUser = async (userId) => {
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

  // Filter cards by search
  const filteredCards = cards.filter(card => 
    card.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.subtitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.location?.place_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Center map on user location
  const centerOnUser = () => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  };

  // Loading state
  if (loading || authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-background overflow-hidden">
      {/* Header - Snapchat style */}
      <header className="absolute top-0 left-0 right-0 z-[1000] p-4 pointer-events-none">
        <div className="flex items-center justify-between pointer-events-auto">
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full shadow-lg bg-card/90 backdrop-blur-xl"
            onClick={() => navigate("/dashboard")}
            data-testid="map-back-btn"
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
                className="pl-10 rounded-full bg-card/90 backdrop-blur-xl border-0 shadow-lg"
                data-testid="map-search-input"
              />
            </div>
          </div>
          
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full shadow-lg bg-card/90 backdrop-blur-xl"
            onClick={() => setShowCardList(!showCardList)}
            data-testid="map-layers-btn"
          >
            <Layers className="w-5 h-5" />
          </Button>
          
          <Button 
            variant={showOnlineUsers ? "default" : "secondary"}
            size="icon" 
            className={`rounded-full shadow-lg ml-2 relative ${showOnlineUsers ? '' : 'bg-card/90 backdrop-blur-xl'}`}
            onClick={() => setShowOnlineUsers(!showOnlineUsers)}
            title={showOnlineUsers ? "Ocultar usuarios en línea" : "Mostrar usuarios en línea"}
            data-testid="map-users-btn"
          >
            <Users className="w-5 h-5" />
            {onlineUsers.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {onlineUsers.length}
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* Map Container */}
      <div className="flex-1 relative">
        <MapContainer 
          center={mapCenter} 
          zoom={13} 
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <RecenterMap center={mapCenter} />
          
          {/* User location marker with accuracy circle */}
          {userLocation && (
            <>
              <Circle
                center={[userLocation.lat, userLocation.lng]}
                radius={100}
                pathOptions={{ 
                  color: '#3B82F6', 
                  fillColor: '#3B82F6', 
                  fillOpacity: 0.1,
                  weight: 2
                }}
              />
              <Marker 
                position={[userLocation.lat, userLocation.lng]} 
                icon={userIcon}
              >
                <Popup>
                  <div className="text-center">
                    <strong>Tu ubicación</strong>
                  </div>
                </Popup>
              </Marker>
            </>
          )}
          
          {/* Card markers */}
          {filteredCards.map((card) => (
            <Marker
              key={card.id}
              position={[card.location.lat, card.location.lng]}
              icon={createCustomIcon(card.background_color || '#FF6B35')}
              eventHandlers={{
                click: () => {
                  setSelectedCard(card);
                  setSelectedUser(null);
                },
              }}
            >
              <Popup>
                <div className="min-w-[200px]">
                  <div className="flex items-center gap-2 mb-2">
                    {card.avatar_url ? (
                      <img 
                        src={card.avatar_url} 
                        alt={card.title}
                        className="w-10 h-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div 
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: card.background_color || '#FF6B35' }}
                      >
                        {card.title?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-sm">{card.title}</p>
                      {card.subtitle && (
                        <p className="text-xs text-muted-foreground">{card.subtitle}</p>
                      )}
                    </div>
                  </div>
                  {card.location?.place_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {card.location.place_name}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
          
          {/* Online user markers */}
          {showOnlineUsers && onlineUsers.map((onlineUser) => (
            onlineUser.location && (
              <Marker
                key={onlineUser.id}
                position={[onlineUser.location.lat, onlineUser.location.lng]}
                icon={onlineUserIcon(onlineUser.avatar_url, onlineUser.name)}
                eventHandlers={{
                  click: () => {
                    setSelectedUser(onlineUser);
                    setSelectedCard(null);
                  },
                }}
              >
                <Popup>
                  <div className="text-center">
                    <strong>{onlineUser.name}</strong>
                    <p className="text-xs text-green-500 flex items-center gap-1 justify-center mt-1">
                      <Wifi className="w-3 h-3" /> En línea
                    </p>
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>

        {/* Map Controls */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2">
          <Button 
            variant="secondary" 
            size="icon" 
            className="rounded-full shadow-lg bg-card/90 backdrop-blur-xl"
            onClick={centerOnUser}
            data-testid="map-center-btn"
          >
            <Crosshair className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Card List Drawer */}
      {showCardList && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] max-h-[60vh] bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
          <div className="p-4">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h3 className="font-bold mb-4">{filteredCards.length} tarjetas con ubicación</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {filteredCards.map((card) => (
                <div
                  key={card.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl cursor-pointer hover:bg-muted transition-colors"
                  onClick={() => {
                    setSelectedCard(card);
                    setShowCardList(false);
                    if (card.location) {
                      setMapCenter([card.location.lat, card.location.lng]);
                    }
                  }}
                  data-testid={`card-list-item-${card.id}`}
                >
                  {card.avatar_url ? (
                    <img 
                      src={card.avatar_url} 
                      alt={card.title}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: card.background_color || '#FF6B35' }}
                    >
                      {card.title?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{card.title}</p>
                    {card.subtitle && (
                      <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
                    )}
                    {userLocation && card.location && (
                      <p className="text-xs text-primary">
                        {calculateDistance(userLocation.lat, userLocation.lng, card.location.lat, card.location.lng)}
                      </p>
                    )}
                  </div>
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Selected Card Detail */}
      {selectedCard && !showCardList && !selectedUser && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
          <div className="p-4">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setSelectedCard(null)}
              data-testid="close-card-detail"
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="flex gap-4">
              {selectedCard.avatar_url ? (
                <img 
                  src={selectedCard.avatar_url} 
                  alt={selectedCard.title}
                  className="w-20 h-20 rounded-2xl object-cover border-2"
                  style={{ borderColor: selectedCard.background_color }}
                />
              ) : (
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: selectedCard.background_color || '#FF6B35' }}
                >
                  {selectedCard.title?.charAt(0) || "?"}
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{selectedCard.title}</h3>
                {selectedCard.subtitle && (
                  <p className="text-sm text-muted-foreground truncate">{selectedCard.subtitle}</p>
                )}
                
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{selectedCard.location?.place_name || 'Ubicación'}</span>
                </div>
                
                {distance && (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-primary/10 rounded-full text-sm font-medium text-primary">
                    <Route className="w-4 h-4" />
                    {distance} de distancia
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                className="flex-1"
                style={{ backgroundColor: selectedCard.background_color || '#FF6B35' }}
                onClick={() => openDirections(selectedCard)}
                data-testid="card-directions-btn"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Cómo llegar
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => startChat(selectedCard)}
                data-testid="card-chat-btn"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Chat
              </Button>
              <Button 
                variant="ghost"
                onClick={() => navigate(`/c/${selectedCard.id}`)}
                data-testid="card-view-btn"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Online User Detail */}
      {selectedUser && !showCardList && (
        <div className="absolute inset-x-0 bottom-0 z-[1001] bg-card rounded-t-3xl shadow-2xl border-t border-border animate-in slide-in-from-bottom duration-300">
          <div className="p-4">
            <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-4" />
            
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setSelectedUser(null)}
              data-testid="close-user-detail"
            >
              <X className="w-5 h-5" />
            </Button>
            
            <div className="flex gap-4 items-center">
              <AvatarWithBadge
                src={selectedUser.avatar_url}
                name={selectedUser.name}
                tier={selectedUser.subscription_tier}
                size="lg"
              />
              
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{selectedUser.name}</h3>
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <Wifi className="w-4 h-4" />
                  <span>En línea ahora</span>
                </div>
                
                {selectedUser.location && userLocation && (
                  <div className="inline-flex items-center gap-1 mt-2 px-3 py-1 bg-primary/10 rounded-full text-sm font-medium text-primary">
                    <Route className="w-4 h-4" />
                    {calculateDistance(
                      userLocation.lat,
                      userLocation.lng,
                      selectedUser.location.lat,
                      selectedUser.location.lng
                    )} de distancia
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-3 mt-4">
              <Button 
                className="flex-1"
                onClick={() => startChatWithUser(selectedUser.id)}
                data-testid="user-chat-btn"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Enviar mensaje
              </Button>
              <Button 
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/profile/${selectedUser.id}`)}
                data-testid="user-profile-btn"
              >
                <Eye className="w-4 h-4 mr-2" />
                Ver perfil
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && cards.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-[500] pointer-events-none">
          <Card className="max-w-sm mx-4 pointer-events-auto">
            <CardContent className="text-center py-8">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">No hay tarjetas con ubicación</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Agrega ubicaciones a tus tarjetas para verlas en el mapa
              </p>
              <Button onClick={() => navigate("/cards/new")} data-testid="create-card-btn">
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
