import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import axios from "axios";
import {
  ArrowLeft,
  BarChart3,
  Eye,
  Users,
  TrendingUp,
  MapPin,
  Globe,
  Clock,
  Calendar,
  Download,
  ChevronRight,
  Loader2,
  Crown,
  Star,
  Lock,
  RefreshCw
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Simple chart component
const SimpleBarChart = ({ data, height = 120 }) => {
  if (!data || data.length === 0) return null;
  
  const maxValue = Math.max(...data.map(d => d.views), 1);
  
  return (
    <div className="flex items-end gap-1 h-full" style={{ height }}>
      {data.map((item, idx) => (
        <div
          key={idx}
          className="flex-1 flex flex-col items-center gap-1"
        >
          <div 
            className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors cursor-pointer"
            style={{ 
              height: `${(item.views / maxValue) * 100}%`,
              minHeight: item.views > 0 ? '4px' : '0'
            }}
            title={`${item.date}: ${item.views} vistas`}
          />
          {idx % 5 === 0 && (
            <span className="text-[10px] text-muted-foreground">
              {item.date.slice(5)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subtext, color = "primary" }) => (
  <div className="p-4 bg-card rounded-xl border">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}/10`}>
        <Icon className={`w-5 h-5 text-${color}`} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  </div>
);

// Upgrade Banner
const UpgradeBanner = ({ currentTier }) => {
  const navigate = useNavigate();
  
  return (
    <div className="p-6 bg-gradient-to-r from-primary/20 to-orange-500/20 rounded-2xl border border-primary/30">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/20 rounded-full">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg">Desbloquea Analíticas Avanzadas</h3>
          <p className="text-sm text-muted-foreground">
            {currentTier === "free" 
              ? "Actualiza a Pro o Business para ver quién visita tus tarjetas"
              : "Actualiza a Business para ver visitantes individuales y exportar datos"
            }
          </p>
        </div>
        <Button onClick={() => navigate("/store")}>
          <Crown className="w-4 h-4 mr-2" />
          Actualizar
        </Button>
      </div>
    </div>
  );
};

const AnalyticsPage = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { user, token, isLoading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const [subscriptionTier, setSubscriptionTier] = useState("free");
  const [selectedPeriod, setSelectedPeriod] = useState(30);

  useEffect(() => {
    if (authLoading) return;
    
    if (!token) {
      navigate('/login');
      return;
    }
    
    fetchData();
  }, [token, cardId, selectedPeriod, authLoading]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get subscription status
      const subRes = await axios.get(`${API}/store/subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscriptionTier(subRes.data.tier);
      
      if (subRes.data.tier === "free") {
        setLoading(false);
        return;
      }
      
      if (cardId) {
        // Get specific card analytics
        const res = await axios.get(`${API}/analytics/cards/${cardId}?days=${selectedPeriod}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAnalytics(res.data);
      } else {
        // Get overview
        const res = await axios.get(`${API}/analytics/overview`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setOverview(res.data);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setError("upgrade");
      } else {
        setError(err.response?.data?.detail || "Error al cargar analíticas");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await axios.get(
        `${API}/analytics/export/${cardId}?days=${selectedPeriod}&format=csv`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Download CSV
      const blob = new Blob([res.data.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${cardId}-${selectedPeriod}days.csv`;
      a.click();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al exportar");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Free tier - show upgrade prompt
  if (subscriptionTier === "free") {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Analíticas</h1>
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto px-4 py-8">
          <UpgradeBanner currentTier="free" />
          
          {/* Preview of what they'd get */}
          <div className="mt-8 opacity-50 pointer-events-none">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Eye} label="Vistas totales" value="---" />
              <StatCard icon={Users} label="Visitantes únicos" value="---" />
              <StatCard icon={TrendingUp} label="Hoy" value="---" />
              <StatCard icon={Clock} label="Tiempo promedio" value="---" />
            </div>
            
            <div className="h-32 bg-muted rounded-xl flex items-center justify-center">
              <p className="text-muted-foreground">Gráfico de vistas</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Card-specific analytics
  if (cardId && analytics) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">{analytics.card_title}</h1>
                <p className="text-xs text-muted-foreground">Analíticas</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Period selector */}
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(Number(e.target.value))}
                className="px-3 py-1.5 bg-muted rounded-lg text-sm"
              >
                <option value={7}>7 días</option>
                <option value={30}>30 días</option>
                <option value={90}>90 días</option>
                <option value={365}>1 año</option>
              </select>
              
              {subscriptionTier === "business" && (
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="w-4 h-4 mr-1" />
                  Exportar
                </Button>
              )}
              
              <Button variant="ghost" size="icon" onClick={fetchData}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard 
              icon={Eye} 
              label="Vistas totales" 
              value={analytics.total_views.toLocaleString()}
              subtext={`Últimos ${selectedPeriod} días`}
            />
            <StatCard 
              icon={Users} 
              label="Visitantes únicos" 
              value={analytics.unique_visitors.toLocaleString()}
            />
            <StatCard 
              icon={TrendingUp} 
              label="Hoy" 
              value={analytics.views_today.toLocaleString()}
              subtext={`Esta semana: ${analytics.views_this_week}`}
            />
            <StatCard 
              icon={Clock} 
              label="Tiempo promedio" 
              value={`${analytics.average_view_duration}s`}
              subtext="Por visita"
            />
          </div>

          {/* Views Chart */}
          <div className="p-4 bg-card rounded-xl border">
            <h3 className="font-semibold mb-4">Vistas por día</h3>
            <SimpleBarChart data={analytics.views_by_day} height={150} />
          </div>

          {/* Two columns */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Locations */}
            <div className="p-4 bg-card rounded-xl border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ubicaciones principales
              </h3>
              {analytics.top_locations.length > 0 ? (
                <div className="space-y-2">
                  {analytics.top_locations.slice(0, 5).map((loc, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm">{loc.location}</span>
                      <span className="text-sm font-medium">{loc.views}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos de ubicación</p>
              )}
            </div>

            {/* Top Referrers */}
            <div className="p-4 bg-card rounded-xl border">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Fuentes de tráfico
              </h3>
              {analytics.top_referrers.length > 0 ? (
                <div className="space-y-2">
                  {analytics.top_referrers.slice(0, 5).map((ref, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="text-sm truncate max-w-[200px]">{ref.referrer}</span>
                      <span className="text-sm font-medium">{ref.views}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Todas las visitas son directas</p>
              )}
            </div>
          </div>

          {/* Returning visitors */}
          <div className="p-4 bg-card rounded-xl border">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Visitantes recurrentes</h3>
                <p className="text-sm text-muted-foreground">
                  Personas que visitaron más de una vez
                </p>
              </div>
              <div className="text-3xl font-bold text-primary">
                {analytics.returning_visitors}
              </div>
            </div>
          </div>

          {/* Business-only: Recent visitors */}
          {subscriptionTier !== "business" && (
            <UpgradeBanner currentTier={subscriptionTier} />
          )}
        </div>
      </div>
    );
  }

  // Overview dashboard
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Analíticas</h1>
              <VerifiedBadge tier={subscriptionTier} size="sm" showLabel />
            </div>
          </div>
          
          <Button variant="ghost" size="icon" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {overview && (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={BarChart3} 
                label="Tarjetas" 
                value={overview.total_cards}
              />
              <StatCard 
                icon={Eye} 
                label="Vistas de tarjetas" 
                value={overview.total_card_views_30d.toLocaleString()}
                subtext="Últimos 30 días"
              />
              <StatCard 
                icon={TrendingUp} 
                label="Vistas de posts" 
                value={overview.total_post_views.toLocaleString()}
              />
              <div className="p-4 bg-gradient-to-br from-primary/20 to-orange-500/20 rounded-xl border border-primary/30">
                <div className="flex items-center gap-2">
                  {subscriptionTier === "pro" ? (
                    <Star className="w-5 h-5 text-yellow-500" fill="currentColor" />
                  ) : (
                    <Crown className="w-5 h-5 text-purple-500" fill="currentColor" />
                  )}
                  <span className="font-bold uppercase">{subscriptionTier}</span>
                </div>
              </div>
            </div>

            {/* Cards List */}
            <div className="p-4 bg-card rounded-xl border">
              <h3 className="font-semibold mb-4">Tus tarjetas más vistas</h3>
              <div className="space-y-3">
                {overview.cards.map((card) => (
                  <div 
                    key={card.card_id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    onClick={() => navigate(`/analytics/${card.card_id}`)}
                  >
                    <div>
                      <p className="font-medium">{card.card_title}</p>
                      <p className="text-sm text-muted-foreground">
                        {card.views_30d} vistas (30d) • {card.total_views} total
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsPage;
