import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { Share2, QrCode, Eye, Globe } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewCardPage = () => {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCard();
  }, [cardId]);

  const fetchCard = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}`);
      setCard(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Tarjeta no encontrada");
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: card.title,
          text: card.subtitle || "",
          url: url,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("¡Enlace copiado!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando tarjeta...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Tarjeta no encontrada</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/">
              <Button>Volver al inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Blurred Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-16">
        {/* Header Info */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{card.views} visualizaciones</span>
          </div>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-12 shadow-2xl backdrop-blur-xl mb-8"
          style={{
            background: `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
            color: card.text_color,
          }}
        >
          <div className="flex items-start justify-between mb-8">
            <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold shadow-lg">
              {card.title.charAt(0)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleShare}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <Link to={`/cards/${cardId}/qr`}>
                <button className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors">
                  <QrCode className="w-5 h-5" />
                </button>
              </Link>
            </div>
          </div>

          <h1 className="text-4xl font-bold mb-3">{card.title}</h1>
          {card.subtitle && <p className="text-xl mb-6 opacity-90">{card.subtitle}</p>}
          {card.description && <p className="opacity-80 leading-relaxed">{card.description}</p>}

          {card.social_links && (
            <div className="flex gap-3 mt-8">
              {card.social_links.linkedin && (
                <a
                  href={card.social_links.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/40 transition-colors"
                >
                  <span className="sr-only">LinkedIn</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 justify-center">
          <Link to="/">
            <Button variant="outline" size="lg">
              Crear mi tarjeta
            </Button>
          </Link>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-sm text-muted-foreground">
            Creado con{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              BRUNO
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ViewCardPage;
