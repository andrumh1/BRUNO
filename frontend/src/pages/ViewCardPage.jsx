import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SocialLinkButton from "@/components/SocialLinkButton";
import axios from "axios";
import { Share2, QrCode, Eye, Globe, Phone, Mail, MapPin } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewCardPage = () => {
  const { cardId } = useParams();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);

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

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}/qr`);
      setQrData(response.data);
      setShowQR(true);
    } catch (error) {
      console.error("Error fetching QR:", error);
      alert("Error al generar el código QR");
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
      alert("¡Enlace copiado al portapapeles!");
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    alert("¡Enlace copiado al portapapeles!");
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
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Blurred Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-20 left-10 w-96 h-96 rounded-full blur-3xl animate-pulse opacity-30"
          style={{ backgroundColor: card.background_color }}
        ></div>
        <div 
          className="absolute bottom-20 right-10 w-80 h-80 rounded-full blur-3xl animate-pulse opacity-20"
          style={{ backgroundColor: card.background_color, animationDelay: "1s" }}
        ></div>
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl animate-pulse opacity-10"
          style={{ backgroundColor: card.background_color, animationDelay: "2s" }}
        ></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-16">
        {/* Header Info */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4 backdrop-blur-sm">
            <Eye className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{card.views} visualizaciones</span>
          </div>
        </div>

        {/* Enhanced Card */}
        <div 
          className="rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden border-2 mb-8"
          style={{
            background: `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)`,
            color: card.text_color,
            borderColor: `${card.background_color}40`
          }}
        >
          {/* Banner Image */}
          {card.banner_url && (
            <div 
              className="h-48 sm:h-64 bg-cover bg-center relative"
              style={{ backgroundImage: `url(${card.banner_url})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/50"></div>
            </div>
          )}

          {/* Card Content */}
          <div className="p-6 sm:p-12">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-8">
              {/* Avatar */}
              <div className="relative">
                {card.avatar_url ? (
                  <img 
                    src={card.avatar_url} 
                    alt={card.title}
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4 shadow-2xl"
                    style={{ borderColor: card.text_color }}
                  />
                ) : (
                  <div 
                    className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-5xl sm:text-6xl font-bold shadow-2xl border-4"
                    style={{ 
                      backgroundColor: `${card.text_color}20`,
                      borderColor: card.text_color
                    }}
                  >
                    {card.title.charAt(0).toUpperCase()}
                  </div>
                )}
                {/* Badge for card type */}
                <div 
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border"
                  style={{ 
                    backgroundColor: `${card.text_color}30`,
                    borderColor: `${card.text_color}50`
                  }}
                >
                  {card.card_type === "personal" && "Personal"}
                  {card.card_type === "empresarial" && "Empresarial"}
                  {card.card_type === "negocio" && "Negocio"}
                  {card.card_type === "lugares" && "Lugar"}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleShare}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-all shadow-lg"
                  style={{ backgroundColor: `${card.text_color}20` }}
                  title="Compartir"
                >
                  <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
                <button
                  onClick={copyLink}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full backdrop-blur-sm flex items-center justify-center hover:scale-110 transition-all shadow-lg"
                  style={{ backgroundColor: `${card.text_color}20` }}
                  title="Copiar enlace"
                >
                  <QrCode className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Name and Title */}
            <div className="mb-6">
              <h1 className="text-4xl sm:text-5xl font-bold mb-3">{card.title}</h1>
              {card.subtitle && (
                <p className="text-xl sm:text-2xl opacity-90 font-medium">{card.subtitle}</p>
              )}
            </div>

            {/* Description */}
            {card.description && (
              <p className="text-base sm:text-lg opacity-80 leading-relaxed mb-8 max-w-2xl">
                {card.description}
              </p>
            )}

            {/* Contact Info */}
            {card.contact_info && (
              <div className="grid sm:grid-cols-2 gap-3 mb-8">
                {card.contact_info.phone && (
                  <a 
                    href={`tel:${card.contact_info.phone}`}
                    className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm hover:scale-105 transition-all"
                    style={{ backgroundColor: `${card.text_color}15` }}
                  >
                    <Phone className="w-5 h-5" />
                    <span className="text-sm">{card.contact_info.phone}</span>
                  </a>
                )}
                {card.contact_info.email && (
                  <a 
                    href={`mailto:${card.contact_info.email}`}
                    className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm hover:scale-105 transition-all"
                    style={{ backgroundColor: `${card.text_color}15` }}
                  >
                    <Mail className="w-5 h-5" />
                    <span className="text-sm">{card.contact_info.email}</span>
                  </a>
                )}
                {card.contact_info.address && (
                  <div 
                    className="flex items-center gap-3 p-3 rounded-xl backdrop-blur-sm sm:col-span-2"
                    style={{ backgroundColor: `${card.text_color}15` }}
                  >
                    <MapPin className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">
                      {card.contact_info.address}
                      {card.contact_info.city && `, ${card.contact_info.city}`}
                      {card.contact_info.country && `, ${card.contact_info.country}`}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Social Links */}
            {card.social_links && card.social_links.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold opacity-90">Conecta conmigo</h3>
                <div className="flex flex-wrap gap-3">
                  {card.social_links.map((link, index) => (
                    <SocialLinkButton 
                      key={index} 
                      link={link} 
                      size="default"
                      theme="dark"
                      onlyIcon={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Gallery */}
            {card.gallery_photos && card.gallery_photos.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold opacity-90 mb-4">Galería</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {card.gallery_photos.map((photo, index) => (
                    <div 
                      key={index}
                      className="aspect-square rounded-xl overflow-hidden shadow-lg hover:scale-105 transition-all cursor-pointer"
                    >
                      <img 
                        src={photo} 
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center space-y-4">
          <Link to="/register">
            <Button size="lg" className="shadow-xl">
              Crear mi tarjeta BRUNO
            </Button>
          </Link>
          
          <p className="text-sm text-muted-foreground">
            Creado con{" "}
            <Link to="/" className="text-primary font-medium hover:underline">
              BRUNO
            </Link>
            {" "}- Tarjetas digitales del futuro
          </p>
        </div>
      </div>
    </div>
  );
};

export default ViewCardPage;
