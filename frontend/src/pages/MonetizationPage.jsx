import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import axios from "axios";
import {
  ArrowLeft,
  Megaphone,
  MapPin,
  TrendingUp,
  DollarSign,
  Sparkles,
  Star,
  Eye,
  MousePointer,
  Calendar,
  ChevronRight,
  Coins,
  CreditCard,
  Wallet,
  Award,
  Gift,
  BarChart3,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const MonetizationPage = () => {
  const navigate = useNavigate();
  const { user, token, isLoading: authLoading } = useAuth();
  
  const [activeTab, setActiveTab] = useState("promote"); // promote, earnings
  const [loading, setLoading] = useState(true);
  const [pricing, setPricing] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [myPromotions, setMyPromotions] = useState([]);
  const [userCards, setUserCards] = useState([]);
  const [userPosts, setUserPosts] = useState([]);
  
  // Promotion form states
  const [selectedType, setSelectedType] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [duration, setDuration] = useState(7);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!token) {
      navigate("/login");
      return;
    }
    fetchData();
  }, [token, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [pricingRes, earningsRes, promotionsRes, cardsRes, postsRes] = await Promise.all([
        axios.get(`${API}/monetization/pricing`),
        axios.get(`${API}/monetization/creator/earnings`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: null })),
        axios.get(`${API}/monetization/sponsored-posts`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/cards`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] })),
        axios.get(`${API}/posts/mine`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => ({ data: [] }))
      ]);
      
      setPricing(pricingRes.data);
      setEarnings(earningsRes.data);
      setMyPromotions(promotionsRes.data);
      setUserCards(cardsRes.data);
      setUserPosts(postsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const calculateCost = () => {
    if (!selectedType || !pricing) return 0;
    const promo = pricing.promotions.find(p => p.type === selectedType);
    return promo ? promo.cost_per_day * duration : 0;
  };

  const handleCreatePromotion = async () => {
    if (!selectedType) return;
    
    setCreating(true);
    try {
      if (selectedType === "sponsored_post") {
        await axios.post(
          `${API}/monetization/sponsored-posts`,
          {
            post_id: selectedPost,
            budget_points: calculateCost(),
            duration_days: duration,
            target_audience: "all"
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        if (!selectedCard) {
          alert("Selecciona una tarjeta");
          return;
        }
        await axios.post(
          `${API}/monetization/promote-card`,
          {
            card_id: selectedCard,
            promotion_type: selectedType,
            budget_points: calculateCost(),
            duration_days: duration
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }
      
      alert("¡Promoción creada exitosamente!");
      setSelectedType(null);
      setSelectedCard(null);
      setSelectedPost(null);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al crear promoción");
    } finally {
      setCreating(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center">
              <Coins className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold">Monetización</h1>
          </div>
          <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full">
            <Coins className="w-4 h-4 text-primary" />
            <span className="font-bold text-primary">{user?.points || 0}</span>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="max-w-4xl mx-auto px-4 pb-3 flex gap-2">
          <Button
            variant={activeTab === "promote" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("promote")}
          >
            <Megaphone className="w-4 h-4 mr-2" />
            Promocionar
          </Button>
          <Button
            variant={activeTab === "earnings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("earnings")}
          >
            <DollarSign className="w-4 h-4 mr-2" />
            Ganancias
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === "promote" && (
          <div className="space-y-6">
            {/* Promotion Types */}
            <section>
              <h2 className="text-lg font-bold mb-4">Tipos de Promoción</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pricing?.promotions.map((promo) => {
                  const icons = {
                    sponsored_post: Megaphone,
                    map_highlight: MapPin,
                    feed_featured: Star,
                    search_boost: TrendingUp
                  };
                  const Icon = icons[promo.type] || Sparkles;
                  const isSelected = selectedType === promo.type;
                  
                  return (
                    <Card 
                      key={promo.type}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedType(promo.type)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isSelected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold">{promo.name}</h3>
                            <p className="text-sm text-muted-foreground">{promo.description}</p>
                            <div className="flex items-center gap-1 mt-2 text-sm font-medium text-primary">
                              <Coins className="w-4 h-4" />
                              {promo.cost_per_day} pts/día
                            </div>
                          </div>
                          {isSelected && <CheckCircle className="w-5 h-5 text-primary" />}
                        </div>
                        
                        <div className="mt-3 flex flex-wrap gap-1">
                          {promo.benefits.map((benefit, idx) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-muted rounded-full">
                              {benefit}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            {/* Configuration */}
            {selectedType && (
              <section className="animate-in slide-in-from-bottom duration-300">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configurar Promoción</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Select Card/Post */}
                    {selectedType === "sponsored_post" ? (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Selecciona un post (opcional - se creará uno nuevo si no seleccionas)
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                          {userPosts.map((post) => (
                            <button
                              key={post.id}
                              onClick={() => setSelectedPost(post.id)}
                              className={`p-3 rounded-lg border text-left ${
                                selectedPost === post.id ? 'border-primary bg-primary/5' : ''
                              }`}
                            >
                              <p className="text-sm line-clamp-2">{post.content || "Post sin texto"}</p>
                            </button>
                          ))}
                          <button
                            onClick={() => setSelectedPost(null)}
                            className={`p-3 rounded-lg border text-left ${
                              selectedPost === null ? 'border-primary bg-primary/5' : ''
                            }`}
                          >
                            <p className="text-sm">+ Crear nuevo post patrocinado</p>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Selecciona una tarjeta
                        </label>
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                          {userCards.map((card) => (
                            <button
                              key={card.id}
                              onClick={() => setSelectedCard(card.id)}
                              className={`flex items-center gap-3 p-3 rounded-lg border text-left ${
                                selectedCard === card.id ? 'border-primary bg-primary/5' : ''
                              }`}
                            >
                              {card.avatar_url ? (
                                <img src={card.avatar_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-primary/20" />
                              )}
                              <div>
                                <p className="font-medium">{card.title}</p>
                                <p className="text-xs text-muted-foreground">{card.card_type}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Duration */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Duración: {duration} días
                      </label>
                      <Slider
                        value={[duration]}
                        onValueChange={([val]) => setDuration(val)}
                        min={1}
                        max={30}
                        step={1}
                      />
                    </div>

                    {/* Cost Summary */}
                    <div className="p-4 bg-muted rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span>Costo total:</span>
                        <span className="text-xl font-bold text-primary flex items-center gap-1">
                          <Coins className="w-5 h-5" />
                          {calculateCost()} pts
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Tu saldo:</span>
                        <span>{user?.points || 0} pts</span>
                      </div>
                      {calculateCost() > (user?.points || 0) && (
                        <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Saldo insuficiente
                        </p>
                      )}
                    </div>

                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleCreatePromotion}
                      disabled={creating || calculateCost() > (user?.points || 0) || 
                        (selectedType !== "sponsored_post" && !selectedCard)}
                    >
                      {creating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Activar Promoción
                    </Button>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* My Promotions */}
            {myPromotions.length > 0 && (
              <section>
                <h2 className="text-lg font-bold mb-4">Mis Promociones Activas</h2>
                <div className="space-y-3">
                  {myPromotions.map((promo) => (
                    <Card key={promo.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              promo.status === 'active' ? 'bg-green-500/10 text-green-600' : 'bg-muted'
                            }`}>
                              {promo.status === 'active' ? 'Activo' : 'Finalizado'}
                            </span>
                            <p className="font-medium mt-1">{promo.type.replace('_', ' ').toUpperCase()}</p>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" />
                                {promo.impressions} imp.
                              </span>
                              <span className="flex items-center gap-1">
                                <MousePointer className="w-3 h-3" />
                                {promo.clicks} clicks
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Termina</p>
                            <p className="font-medium">{new Date(promo.end_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === "earnings" && (
          <div className="space-y-6">
            {/* Earnings Overview */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <DollarSign className="w-4 h-4" />
                    <span className="text-sm">Total Ganado</span>
                  </div>
                  <p className="text-2xl font-bold">{earnings?.total_earnings_points || 0}</p>
                  <p className="text-xs text-muted-foreground">puntos</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Disponible</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {earnings?.available_to_withdraw || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">puntos</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Gift className="w-4 h-4" />
                    <span className="text-sm">Regalos</span>
                  </div>
                  <p className="text-2xl font-bold">{earnings?.total_gifts_received || 0}</p>
                  <p className="text-xs text-muted-foreground">recibidos</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Award className="w-4 h-4" />
                    <span className="text-sm">Comisión</span>
                  </div>
                  <p className="text-2xl font-bold">{earnings?.revenue_share_percentage || 70}%</p>
                  <p className="text-xs text-muted-foreground">para ti</p>
                </CardContent>
              </Card>
            </div>

            {/* Revenue Info */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Cómo Ganar
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Gift className="w-5 h-5 text-pink-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Regalos en Lives</p>
                      <p className="text-sm text-muted-foreground">
                        Recibe el {earnings?.revenue_share_percentage || 70}% del valor de los regalos que te envíen
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <Sparkles className="w-5 h-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Contenido Premium</p>
                      <p className="text-sm text-muted-foreground">
                        Próximamente: suscripciones de fans y contenido exclusivo
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payout Section */}
            <Card>
              <CardContent className="p-4">
                <h3 className="font-bold mb-3">Retirar Fondos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Mínimo para retirar: {earnings?.minimum_payout || 1000} puntos
                </p>
                <Button
                  className="w-full"
                  disabled={(earnings?.available_to_withdraw || 0) < (earnings?.minimum_payout || 1000)}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Solicitar Retiro
                </Button>
                {(earnings?.available_to_withdraw || 0) < (earnings?.minimum_payout || 1000) && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Necesitas {(earnings?.minimum_payout || 1000) - (earnings?.available_to_withdraw || 0)} puntos más
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonetizationPage;
