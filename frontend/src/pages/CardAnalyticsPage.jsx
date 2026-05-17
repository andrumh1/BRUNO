import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Eye,
  Users,
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  BarChart3,
  Clock,
  ChevronRight,
  Loader2,
  CreditCard,
  Crown,
  Lock
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

// Mini bar chart component
const MiniBarChart = ({ data, maxHeight = 80 }) => {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.views), 1);

  return (
    <div className="flex items-end gap-1 h-20" data-testid="analytics-bar-chart">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: `${(d.views / maxVal) * maxHeight}%` }}
            transition={{ duration: 0.4, delay: i * 0.03 }}
            className="w-full bg-primary/80 rounded-t-sm min-h-[2px]"
            title={`${d.date}: ${d.views} vistas`}
          />
          {i % Math.ceil(data.length / 6) === 0 && (
            <span className="text-[9px] text-muted-foreground whitespace-nowrap">
              {new Date(d.date).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// Device icon helper
const DeviceIcon = ({ device }) => {
  switch (device) {
    case "mobile": return <Smartphone className="w-4 h-4" />;
    case "tablet": return <Tablet className="w-4 h-4" />;
    default: return <Monitor className="w-4 h-4" />;
  }
};

// Stat card
const StatCard = ({ icon: Icon, label, value, color = "text-primary", delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
  >
    <Card className="glass-card">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl ${color.replace("text-", "bg-")}/10 flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  </motion.div>
);

// Analytics Overview Page
const CardAnalyticsPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [cardAnalytics, setCardAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchOverview();
    fetchSubscription();
  }, [token]);

  const fetchSubscription = async () => {
    try {
      const res = await axios.get(`${API}/payments/subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscription(res.data);
    } catch (e) {}
  };

  const fetchOverview = async () => {
    try {
      const res = await axios.get(`${API}/analytics/overview`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setOverview(res.data);
    } catch (e) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const fetchCardDetail = async (cardId) => {
    setDetailLoading(true);
    setSelectedCard(cardId);
    try {
      const res = await axios.get(`${API}/analytics/cards/${cardId}?days=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCardAnalytics(res.data);
    } catch (e) {
      // error handled
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-testid="card-analytics-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h1 className="font-bold text-lg">Card Analytics</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Overview Stats */}
        {overview && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={Eye} label="Vistas (30d)" value={overview.total_views} delay={0} />
              <StatCard icon={Users} label="Visitantes unicos" value={overview.total_unique_visitors} color="text-blue-500" delay={0.1} />
            </div>

            {/* Daily chart */}
            {overview.daily_views?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <h3 className="font-semibold text-sm">Vistas diarias</h3>
                    </div>
                    <MiniBarChart data={overview.daily_views} />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Premium Upsell Banner */}
            {(!subscription || !subscription.is_active) && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="overflow-hidden border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                        <Crown className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm mb-0.5">Desbloquea Analytics Pro</h3>
                        <p className="text-xs text-muted-foreground">Ve quien visita tus tarjetas, desde donde y en que dispositivo. Metricas detalladas por solo <span className="font-bold text-amber-600">$4.99/mes</span></p>
                      </div>
                      <Link to="/premium">
                        <Button size="sm" className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-amber-500/20 shrink-0" data-testid="upsell-premium-btn">
                          <Crown className="w-3.5 h-3.5 mr-1.5" /> Pro
                        </Button>
                      </Link>
                    </div>

                    {/* Blurred preview of premium features */}
                    <div className="mt-3 relative">
                      <div className="grid grid-cols-3 gap-2 opacity-40 blur-[1px] pointer-events-none select-none">
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <Lock className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[9px] text-muted-foreground">Visitantes por dispositivo</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <Lock className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[9px] text-muted-foreground">Fuentes de trafico</p>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2 text-center">
                          <Lock className="w-3 h-3 mx-auto mb-1 text-muted-foreground" />
                          <p className="text-[9px] text-muted-foreground">Perfil de visitantes</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Cards list */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Tus tarjetas</h3>
                  </div>
                  
                  {overview.cards.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm mb-3">No tienes tarjetas aun</p>
                      <Link to="/create-card">
                        <Button size="sm">Crear tarjeta</Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {overview.cards.map((card, idx) => (
                        <motion.button
                          key={card.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + idx * 0.05 }}
                          onClick={() => fetchCardDetail(card.id)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                            selectedCard === card.id ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-muted"
                          }`}
                          data-testid={`analytics-card-${card.id}`}
                        >
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {card.title?.[0]?.toUpperCase() || "T"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{card.title}</p>
                            <p className="text-xs text-muted-foreground">{card.type}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold">{card.views_30d}</p>
                            <p className="text-[10px] text-muted-foreground">vistas 30d</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        </motion.button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}

        {/* Card Detail Analytics */}
        {selectedCard && (
          <motion.div
            key={selectedCard}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {detailLoading ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
              </div>
            ) : cardAnalytics && (
              <>
                <Card className="glass-card overflow-hidden">
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b">
                    <h3 className="font-bold text-sm">{cardAnalytics.card_title}</h3>
                    <p className="text-xs text-muted-foreground">Ultimos {cardAnalytics.period_days} dias</p>
                  </div>
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{cardAnalytics.total_views}</p>
                        <p className="text-xs text-muted-foreground">Vistas</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold">{cardAnalytics.unique_viewers}</p>
                        <p className="text-xs text-muted-foreground">Visitantes unicos</p>
                      </div>
                    </div>
                    
                    {cardAnalytics.daily_views?.length > 0 && (
                      <MiniBarChart data={cardAnalytics.daily_views} />
                    )}
                  </CardContent>
                </Card>

                {/* Device breakdown */}
                {cardAnalytics.device_breakdown?.length > 0 && (
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Smartphone className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Dispositivos</h3>
                      </div>
                      <div className="space-y-2">
                        {cardAnalytics.device_breakdown.map((d, i) => {
                          const total = cardAnalytics.total_views || 1;
                          const pct = Math.round((d.count / total) * 100);
                          return (
                            <div key={i} className="flex items-center gap-3">
                              <DeviceIcon device={d.device} />
                              <span className="text-sm capitalize flex-1">{d.device}</span>
                              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ duration: 0.5 }}
                                  className="h-full bg-primary rounded-full"
                                />
                              </div>
                              <span className="text-sm font-medium w-10 text-right">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sources */}
                {cardAnalytics.source_breakdown?.length > 0 && (
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Fuentes de trafico</h3>
                      </div>
                      <div className="space-y-2">
                        {cardAnalytics.source_breakdown.slice(0, 8).map((s, i) => (
                          <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-sm truncate flex-1">{s.source}</span>
                            <span className="text-sm font-medium ml-2">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Recent viewers */}
                {cardAnalytics.recent_viewers?.length > 0 && (
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-primary" />
                        <h3 className="font-semibold text-sm">Visitantes recientes</h3>
                      </div>
                      <div className="space-y-2">
                        {cardAnalytics.recent_viewers.map((v, i) => (
                          <Link
                            key={i}
                            to={`/profile/${v.id}`}
                            className="flex items-center gap-3 py-2 hover:bg-muted/50 rounded-lg px-2 transition-colors"
                            data-testid={`viewer-${v.id}`}
                          >
                            {v.avatar_url ? (
                              <img src={v.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                {(v.display_name || v.username || "U")[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate hover:text-primary transition-colors">
                                {v.display_name || v.username}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {new Date(v.viewed_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            <DeviceIcon device={v.device} />
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default CardAnalyticsPage;
