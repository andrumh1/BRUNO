import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Trophy, 
  Flame, 
  Star, 
  Gift, 
  ChevronRight,
  Crown,
  Zap,
  Medal
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Points Widget - Compact version for header/sidebar
export const PointsWidget = ({ className = "" }) => {
  const { token, user } = useAuth();
  const [points, setPoints] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    const fetchPoints = async () => {
      try {
        const response = await axios.get(`${API}/points/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPoints(response.data);
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    fetchPoints();
  }, [token]);

  if (!user || loading) return null;
  if (!points) return null;

  const progress = points.next_level 
    ? ((points.total_points - points.level.min_points) / 
       (points.next_level.min_points - points.level.min_points)) * 100
    : 100;

  return (
    <div className={`bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-3 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="text-2xl">{points.level.badge}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">{points.total_points}</span>
            <Zap className="w-3 h-3 text-yellow-500" />
          </div>
          <Progress value={progress} className="h-1.5 mt-1" />
        </div>
        {points.streak_days > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <Flame className="w-4 h-4" />
            <span className="text-xs font-medium">{points.streak_days}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Daily Check-in Button
export const DailyCheckIn = ({ onCheckIn }) => {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleCheckIn = async () => {
    if (!token || loading) return;
    
    setLoading(true);
    try {
      const response = await axios.post(`${API}/points/daily-check-in`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setResult(response.data);
      if (onCheckIn) onCheckIn(response.data);
    } catch (error) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  if (result?.already_checked_in) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
        <div className="text-green-500 text-2xl mb-2">✓</div>
        <p className="text-sm text-green-600 font-medium">¡Ya hiciste check-in hoy!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Racha: {result.streak_days} días 🔥
        </p>
      </div>
    );
  }

  if (result?.points_earned) {
    return (
      <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-center animate-in zoom-in">
        <div className="text-4xl mb-2">🎉</div>
        <p className="text-lg font-bold text-primary">+{result.points_earned} puntos</p>
        <p className="text-sm text-muted-foreground mt-1">
          Racha: {result.streak_days} días 🔥
        </p>
        {result.bonus_message && (
          <p className="text-xs text-yellow-600 mt-2 font-medium">
            {result.bonus_message}
          </p>
        )}
      </div>
    );
  }

  return (
    <Button
      onClick={handleCheckIn}
      disabled={loading}
      className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white"
    >
      {loading ? (
        "Registrando..."
      ) : (
        <>
          <Gift className="w-4 h-4 mr-2" />
          Check-in Diario (+5 pts)
        </>
      )}
    </Button>
  );
};

// Full Points Page Component
export const PointsPage = () => {
  const { token, user } = useAuth();
  const [points, setPoints] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      try {
        const [pointsRes, leaderboardRes, historyRes] = await Promise.all([
          axios.get(`${API}/points/me`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/points/leaderboard`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API}/points/history`, { headers: { Authorization: `Bearer ${token}` } })
        ]);
        
        setPoints(pointsRes.data);
        setLeaderboard(leaderboardRes.data);
        setHistory(historyRes.data);
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Inicia sesión para ver tus puntos</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header Card */}
      {points && (
        <div className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 rounded-3xl p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white/70 text-sm">Nivel {points.level.level}</p>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span className="text-3xl">{points.level.badge}</span>
                  {points.level.name}
                </h2>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-sm">Puntos totales</p>
                <p className="text-3xl font-bold">{points.total_points.toLocaleString()}</p>
              </div>
            </div>
            
            {points.next_level && (
              <div>
                <div className="flex justify-between text-sm text-white/70 mb-1">
                  <span>Progreso a {points.next_level.name}</span>
                  <span>{points.points_to_next_level} pts restantes</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ 
                      width: `${((points.total_points - points.level.min_points) / 
                              (points.next_level.min_points - points.level.min_points)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-orange-300" />
                <span className="font-medium">{points.streak_days} días</span>
              </div>
              {leaderboard?.my_rank && (
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-300" />
                  <span className="font-medium">#{leaderboard.my_rank}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Daily Check-in */}
      <DailyCheckIn onCheckIn={() => {
        // Refresh points after check-in
        axios.get(`${API}/points/me`, { headers: { Authorization: `Bearer ${token}` } })
          .then(res => setPoints(res.data));
      }} />

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["overview", "leaderboard", "history"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "overview" && "Cómo ganar"}
            {tab === "leaderboard" && "Ranking"}
            {tab === "history" && "Historial"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-3">
          <h3 className="font-semibold">Gana puntos con estas acciones:</h3>
          {[
            { action: "Check-in diario", points: 5, icon: "☀️" },
            { action: "Crear publicación", points: 10, icon: "📝" },
            { action: "Recibir like", points: 2, icon: "❤️" },
            { action: "Recibir comentario", points: 3, icon: "💬" },
            { action: "Nuevo seguidor", points: 5, icon: "👥" },
            { action: "Compartir tarjeta", points: 15, icon: "💼" },
            { action: "Completar perfil", points: 50, icon: "✅" },
            { action: "Primera tarjeta", points: 100, icon: "🎯" },
            { action: "Invitar amigo", points: 200, icon: "🎁" },
            { action: "Racha 7 días", points: 50, icon: "🔥" },
            { action: "Racha 30 días", points: 200, icon: "⚡" },
          ].map((item, i) => (
            <div key={`item-${i}`} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm">{item.action}</span>
              </div>
              <span className="text-sm font-bold text-primary">+{item.points}</span>
            </div>
          ))}
        </div>
      )}

      {activeTab === "leaderboard" && leaderboard && (
        <div className="space-y-2">
          {leaderboard.leaderboard.map((user, i) => (
            <div 
              key={user.user_id}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                i < 3 ? "bg-gradient-to-r from-yellow-500/10 to-transparent" : "bg-muted/50"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                i === 0 ? "bg-yellow-500 text-white" :
                i === 1 ? "bg-gray-400 text-white" :
                i === 2 ? "bg-amber-600 text-white" :
                "bg-muted text-muted-foreground"
              }`}>
                {i + 1}
              </div>
              <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-lg">
                    {user.level.badge}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.username}</p>
                <p className="text-xs text-muted-foreground">{user.level.name}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">{user.total_points.toLocaleString()}</p>
                {user.streak_days > 0 && (
                  <p className="text-xs text-orange-500 flex items-center gap-1 justify-end">
                    <Flame className="w-3 h-3" /> {user.streak_days}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Aún no tienes transacciones de puntos
            </p>
          ) : (
            history.map((tx, i) => (
              <div key={tx.id || i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString('es-ES', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className={`font-bold ${tx.points > 0 ? "text-green-500" : "text-red-500"}`}>
                  {tx.points > 0 ? "+" : ""}{tx.points}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default PointsPage;
