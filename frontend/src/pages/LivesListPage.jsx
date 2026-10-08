import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { InlineVerifiedBadge } from "@/components/VerifiedBadge";
import axios from "axios";
import UpcomingLives from "@/components/live/UpcomingLives";
import {
  Radio,
  ArrowLeft,
  Search,
  Plus,
  Eye,
  Users,
  Music,
  Gamepad2,
  MessageCircle,
  ChefHat,
  Dumbbell,
  Palette,
  GraduationCap,
  Briefcase,
  Cpu,
  Loader2,
  RefreshCw,
  Sparkles
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Category icons mapping
const CATEGORY_ICONS = {
  general: Radio,
  music: Music,
  gaming: Gamepad2,
  talk: MessageCircle,
  cooking: ChefHat,
  fitness: Dumbbell,
  art: Palette,
  education: GraduationCap,
  business: Briefcase,
  technology: Cpu
};

const LivesListPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [lives, setLives] = useState([]);
  const [followingLives, setFollowingLives] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, [token, selectedCategory]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch categories
      const catRes = await axios.get(`${API}/lives/categories`);
      setCategories(catRes.data);
      
      // Fetch active lives
      const livesRes = await axios.get(`${API}/lives`, {
        params: { category: selectedCategory, limit: 50 }
      });
      setLives(livesRes.data);
      
      // Fetch following lives if logged in
      if (token) {
        const followingRes = await axios.get(`${API}/lives/following`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFollowingLives(followingRes.data);
      }
    } catch (err) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const filteredLives = lives.filter(live => 
    live.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    live.host_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatViewers = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3 mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-8 h-8 bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 rounded-lg flex items-center justify-center">
                  <Radio className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-background animate-pulse" />
              </div>
              <h1 className="text-xl font-bold">BRUNO Live</h1>
            </div>
            <div className="flex-1" />
            <Button 
              className="bg-gradient-to-r from-pink-500 to-red-500 hover:opacity-90"
              onClick={() => navigate("/lives/start")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Ir en vivo
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar lives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 rounded-full"
            />
          </div>
        </div>
        
        {/* Categories */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            className="rounded-full shrink-0"
            onClick={() => setSelectedCategory(null)}
          >
            Todos
          </Button>
          {categories.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Radio;
            return (
              <Button
                key={cat.id}
                variant={selectedCategory === cat.id ? "default" : "outline"}
                size="sm"
                className="rounded-full shrink-0"
                onClick={() => setSelectedCategory(cat.id)}
              >
                <Icon className="w-4 h-4 mr-1" />
                {cat.name}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <UpcomingLives token={token} />
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Following Lives */}
            {followingLives.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <h2 className="font-bold">Siguiendo</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {followingLives.map((live) => (
                    <LiveCard key={live.id} live={live} onClick={() => navigate(`/lives/${live.id}`)} />
                  ))}
                </div>
              </section>
            )}

            {/* All Lives */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Radio className="w-5 h-5 text-red-500" />
                  <h2 className="font-bold">
                    {selectedCategory ? categories.find(c => c.id === selectedCategory)?.name : "En vivo ahora"}
                  </h2>
                  <span className="text-sm text-muted-foreground">({filteredLives.length})</span>
                </div>
                <Button variant="ghost" size="icon" onClick={fetchData}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {filteredLives.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <Radio className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">No hay Lives activos</h3>
                  <p className="text-muted-foreground mb-4">
                    Sé el primero en ir en vivo
                  </p>
                  <Button 
                    className="bg-gradient-to-r from-pink-500 to-red-500"
                    onClick={() => navigate("/lives/start")}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Iniciar Live
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {filteredLives.map((live) => (
                    <LiveCard key={live.id} live={live} onClick={() => navigate(`/lives/${live.id}`)} />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
};

// Live Card Component
const LiveCard = ({ live, onClick }) => {
  const formatViewers = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count;
  };

  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary transition-all group"
      onClick={onClick}
    >
      <div className="aspect-[9/16] relative bg-gradient-to-b from-gray-800 to-gray-900">
        {/* Thumbnail or host avatar */}
        {live.thumbnail_url ? (
          <img 
            src={live.thumbnail_url}
            alt={live.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {live.host_avatar ? (
              <img 
                src={live.host_avatar}
                alt={live.host_name}
                className="w-20 h-20 rounded-full object-cover border-4 border-red-500"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-bold text-primary border-4 border-red-500">
                {live.host_name?.charAt(0) || "?"}
              </div>
            )}
          </div>
        )}
        
        {/* Live badge */}
        <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-red-500 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-[10px] font-bold">LIVE</span>
        </div>
        
        {/* Viewers */}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 bg-black/50 rounded-full backdrop-blur-sm">
          <Eye className="w-3 h-3 text-white" />
          <span className="text-white text-[10px]">{formatViewers(live.viewer_count || 0)}</span>
        </div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/80 to-transparent" />
        
        {/* Host info */}
        <div className="absolute bottom-2 left-2 right-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-xs font-semibold truncate">{live.host_name}</span>
            <InlineVerifiedBadge tier={live.host_tier} size="sm" />
          </div>
          <p className="text-white/80 text-[10px] line-clamp-2">{live.title}</p>
        </div>
      </div>
    </Card>
  );
};

export default LivesListPage;
