import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import axios from "axios";
import { Plus, CreditCard, QrCode, Nfc, LogOut, Eye, Edit, Trash2, Settings, MapPin, Grid3X3, List, Share2 } from "lucide-react";
import BrunoModal from "@/components/bruno/BrunoModal";
import { brunoToast } from "@/components/bruno/BrunoToast";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const { t } = useLanguage();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, views: 0 });
  const [viewMode, setViewMode] = useState("grid");
  const [cardToDelete, setCardToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

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
        const totalViews = response.data.reduce((acc, card) => acc + (card.views || 0), 0);
        setStats({ total: response.data.length, views: totalViews });
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    loadCards();
  }, [user, token, navigate]);

  const handleDeleteCard = async (cardId) => {
    setCardToDelete(cards.find((c) => c.id === cardId) || { id: cardId, title: "" });
  };

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/cards/${cardToDelete.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCards((prev) => prev.filter((c) => c.id !== cardToDelete.id));
      setStats((prev) => ({ ...prev, total: Math.max(prev.total - 1, 0) }));
      brunoToast.success("Tarjeta eliminada", {
        description: cardToDelete.title ? `"${cardToDelete.title}" se ha eliminado.` : undefined,
      });
      setCardToDelete(null);
    } catch (_e) {
      brunoToast.error("No se pudo eliminar", {
        description: "Vuelve a intentarlo en unos segundos.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const getCardTypeLabel = (type) => {
    return t(`cards.types.${type}`) || type;
  };

  const getCardTypeColor = (type) => {
    const colors = {
      personal: "bg-blue-500",
      empresarial: "bg-purple-500",
      negocio: "bg-green-500",
      lugares: "bg-orange-500",
      guardian: "bg-red-500",
      curriculum: "bg-teal-500",
    };
    return colors[type] || "bg-gray-500";
  };

  const handleShare = async (card) => {
    const url = `${window.location.origin}/c/${card.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: card.title,
          text: card.subtitle || "",
          url: url,
        });
      } catch (err) {
        // share cancelled or unsupported
      }
    } else {
      navigator.clipboard.writeText(url);
      alert(t("cardView.linkCopied"));
    }
  };

  // Grid Card Component
  const GridCard = ({ card }) => (
    <Card key={card.id} className="overflow-hidden hover:shadow-lg transition-all card-hover-lift glass-card">
      <div
        className="h-32 relative"
        style={{
          background: card.banner_url
            ? `url(${card.banner_url}) center/cover`
            : `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
        }}
      >
        <div className="p-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`px-2 py-1 rounded text-xs font-medium text-white ${getCardTypeColor(card.card_type)}`}
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
            <span>{card.views || 0} {t("feed.views")}</span>
          </div>
          <span className={card.is_public ? "text-green-500" : "text-yellow-500"}>
            {card.is_public ? t("cardForm.isPublic") : "Privado"}
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
            {t("dashboard.edit")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleShare(card)}
          >
            <Share2 className="w-4 h-4" />
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
  );

  // List Card Component
  const ListCard = ({ card }) => (
    <div className="list-view-card">
      {/* Avatar */}
      {card.avatar_url ? (
        <img
          src={card.avatar_url}
          alt={card.title}
          className="w-16 h-16 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{
            backgroundColor: card.background_color,
            color: card.text_color,
          }}
        >
          {card.title.charAt(0)}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-bold truncate">{card.title}</h3>
            {card.subtitle && (
              <p className="text-sm text-muted-foreground truncate">{card.subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getCardTypeColor(card.card_type)}`}>
              {getCardTypeLabel(card.card_type)}
            </span>
            <span className={`text-xs ${card.is_public ? "text-green-500" : "text-yellow-500"}`}>
              {card.is_public ? "Público" : "Privado"}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {card.views || 0} {t("feed.views")}
          </span>
          {card.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {card.location.city || card.location.address}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 flex-shrink-0">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/cards/${card.id}/edit`)}
        >
          <Edit className="w-3 h-3 mr-1" />
          {t("dashboard.edit")}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => window.open(`/c/${card.id}`, "_blank")}
        >
          <Eye className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => navigate(`/cards/${card.id}/qr`)}
        >
          <QrCode className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => handleShare(card)}
        >
          <Share2 className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => handleDeleteCard(card.id)}
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Compact Header - User Panel + Website + Store only */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 group">
              <img src="/bruno-logo.png" alt="BRUNO" className="h-8 group-hover:scale-105 transition-transform" />
            </button>
            <div className="hidden sm:block">
              <p className="text-xs font-semibold">
                {user?.name || user?.email?.split("@")[0]}
              </p>
              <p className="text-[10px] text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <LanguageSwitcher variant="minimal" />
            <Link to="/store">
              <Button variant="ghost" size="sm" className="text-xs">Tienda PIUP</Button>
            </Link>
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleLogout}>
              <LogOut className="w-3.5 h-3.5 mr-1" />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("dashboard.myCards")}</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">{t("dashboard.myCards")}</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("feed.views")}</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.views}</div>
              <p className="text-xs text-muted-foreground">{t("feed.views")} totales</p>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">NFC</CardTitle>
              <Nfc className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold">{t("dashboard.myCards")}</h2>
            <p className="text-muted-foreground">{t("cardForm.selectType")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* View Toggle */}
            <div className="view-toggle">
              <button
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="w-4 h-4" />
                {t("feed.gridView")}
              </button>
              <button
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
              >
                <List className="w-4 h-4" />
                {t("feed.listView")}
              </button>
            </div>
            <Button variant="outline" onClick={() => navigate("/nfc/write")}>
              <Nfc className="w-4 h-4 mr-2" />
              NFC
            </Button>
            <Button onClick={() => navigate("/cards/new")}>
              <Plus className="w-4 h-4 mr-2" />
              {t("dashboard.createCard")}
            </Button>
          </div>
        </div>

        {/* Cards Grid/List */}
        {cards.length === 0 ? (
          <Card className="text-center py-16 glass-card">
            <CardContent>
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold mb-2">{t("dashboard.noCards")}</h3>
              <p className="text-muted-foreground mb-6">{t("dashboard.noCardsDesc")}</p>
              <Button onClick={() => navigate("/cards/new")}>
                <Plus className="w-4 h-4 mr-2" />
                {t("dashboard.createCard")}
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card) => (
              <GridCard key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {cards.map((card) => (
              <ListCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </main>

      <BrunoModal
        open={!!cardToDelete}
        onClose={() => !deleting && setCardToDelete(null)}
        variant="danger"
        title="Eliminar tarjeta"
        description={
          cardToDelete?.title
            ? `Vas a eliminar "${cardToDelete.title}". Esta acción no se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        primaryAction={{
          label: deleting ? "Eliminando..." : "Eliminar",
          onClick: confirmDeleteCard,
          loading: deleting,
        }}
        secondaryAction={{
          label: "Cancelar",
          onClick: () => setCardToDelete(null),
        }}
        testId="dashboard-delete-modal"
      />
    </div>
  );
};

export default Dashboard;
