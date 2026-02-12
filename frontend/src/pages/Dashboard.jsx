import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { Plus, CreditCard, QrCode, Nfc, LogOut, Eye, Edit, Trash2, Settings } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, views: 0 });

  useEffect(() => {
    if (!user || !token) {
      navigate("/login");
      return;
    }
    
    const loadCards = async () => {
      try {
        const response = await axios.get(`${API}/cards`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCards(response.data);
        
        // Calculate stats
        const totalViews = response.data.reduce((acc, card) => acc + card.views, 0);
        setStats({ total: response.data.length, views: totalViews });
      } catch (error) {
        console.error("Error fetching cards:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadCards();
  }, [user, token, navigate]);

  const handleDeleteCard = async (cardId) => {
    if (!window.confirm("¿Estás seguro de eliminar esta tarjeta?")) return;

    try {
      await axios.delete(`${API}/cards/${cardId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCards(cards.filter((card) => card.id !== cardId));
    } catch (error) {
      console.error("Error deleting card:", error);
      alert("Error al eliminar la tarjeta");
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getCardTypeLabel = (type) => {
    const types = {
      personal: "Personal",
      empresarial: "Empresarial",
      negocio: "Negocio",
      lugares: "Lugares",
    };
    return types[type] || type;
  };

  const getCardTypeColor = (type) => {
    const colors = {
      personal: "bg-blue-500",
      empresarial: "bg-purple-500",
      negocio: "bg-green-500",
      lugares: "bg-orange-500",
    };
    return colors[type] || "bg-gray-500";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">B</span>
            </div>
            <div>
              <h1 className="text-xl font-bold">BRUNO</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tarjetas</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">Tarjetas creadas</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Visualizaciones</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.views}</div>
              <p className="text-xs text-muted-foreground">Vistas totales</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tarjetas NFC</CardTitle>
              <Nfc className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Mis Tarjetas</h2>
            <p className="text-muted-foreground">Gestiona tus tarjetas de presentación</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate("/nfc/activate")}>
              <Nfc className="w-4 h-4 mr-2" />
              Activar NFC
            </Button>
            <Button onClick={() => navigate("/cards/new")}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Tarjeta
            </Button>
          </div>
        </div>

        {/* Cards Grid */}
        {cards.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">No tienes tarjetas aún</h3>
              <p className="text-muted-foreground mb-6">
                Crea tu primera tarjeta de presentación digital
              </p>
              <Button onClick={() => navigate("/cards/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Crear Tarjeta
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <Card key={card.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div
                  className="h-32"
                  style={{
                    background: `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
                  }}
                >
                  <div className="p-4 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`px-2 py-1 rounded text-xs font-medium text-white ${getCardTypeColor(
                          card.card_type
                        )}`}
                      >
                        {getCardTypeLabel(card.card_type)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => window.open(`/c/${card.id}`, "_blank")}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-white hover:bg-white/20"
                        onClick={() => navigate(`/cards/${card.id}/qr`)}
                      >
                        <QrCode className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <CardHeader>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                  {card.subtitle && (
                    <CardDescription>{card.subtitle}</CardDescription>
                  )}
                </CardHeader>

                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{card.views} vistas</span>
                    </div>
                    <span className={card.is_public ? "text-green-500" : "text-yellow-500"}>
                      {card.is_public ? "Público" : "Privado"}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/cards/${card.id}/edit`)}
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => navigate(`/cards/${card.id}/order`)}
                    >
                      <Nfc className="w-3 h-3 mr-1" />
                      Solicitar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteCard(card.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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

export default Dashboard;
