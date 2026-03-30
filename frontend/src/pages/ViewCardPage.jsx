import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SocialLinkButton from "@/components/SocialLinkButton";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Share2, QrCode, Eye, Globe, Phone, Mail, MapPin, MessageCircle, ArrowLeft, Pencil, Copy, ExternalLink } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewCardPage = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [copied, setCopied] = useState(false);

  const isOwner = user && card && user.id === card.user_id;

  const handleStartChat = async () => {
    if (!token || !user) { navigate("/login"); return; }
    if (!card?.user_id || card.user_id === user.id) return;
    try {
      const response = await axios.post(`${API}/chats?participant_id=${card.user_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/chat/${response.data.id}`);
    } catch (e) { console.error("Error starting chat:", e); }
  };

  useEffect(() => { fetchCard(); }, [cardId]);

  // Track card view for analytics
  useEffect(() => {
    if (!cardId) return;
    axios.post(`${API}/analytics/cards/${cardId}/view`, null, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      params: { source_url: document.referrer || undefined }
    }).catch(() => {});
  }, [cardId, token]);

  const fetchCard = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}`);
      setCard(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Tarjeta no encontrada");
    } finally { setLoading(false); }
  };

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}/qr`);
      setQrData(response.data);
      setShowQR(true);
    } catch (e) { console.error("Error fetching QR:", e); }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: card.title, text: card.subtitle || "", url }); } catch (e) {}
    } else {
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-16">
            <Globe className="w-16 h-16 text-destructive mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold mb-2">Tarjeta no encontrada</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link to="/"><Button>Volver al inicio</Button></Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bg = card.background_color || "#FF5A00";
  const fg = card.text_color || "#FFFFFF";
  const isFullBanner = card.template_id === "full_banner_bubble";
  const isEdge = card.template_id === "edge_actions";

  const cardTypeLabel = card.card_type === "personal" ? "Personal" : card.card_type === "empresarial" ? "Empresarial" : card.card_type === "negocio" ? "Negocio" : card.card_type === "servicios" ? "Servicios" : card.card_type === "lugares" ? "Lugar" : card.card_type === "guardian" ? "Guardian" : card.card_type === "curriculum" ? "CV" : card.card_type === "mascotas" ? "Mascota" : card.card_type;

  const hasContact = card.contact_info && (card.contact_info.phone || card.contact_info.email || card.contact_info.address);
  const hasSocial = card.social_links && card.social_links.length > 0;
  const hasGallery = card.gallery_photos && card.gallery_photos.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="view-card-page">
      {/* Subtle background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] opacity-10" style={{ backgroundColor: bg }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-8" style={{ backgroundColor: bg }} />
      </div>

      {/* Top bar - full width */}
      <div className="relative z-20 w-full px-4 sm:px-6 lg:px-10 pt-3 sm:pt-4 pb-2 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="card-back-btn">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1 sm:gap-2">
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/cards/${cardId}/edit`)} data-testid="card-edit-btn">
              <Pencil className="w-4 h-4 mr-1.5" /> Editar
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={handleShare} data-testid="card-share-btn">
            <Share2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchQRCode} data-testid="card-qr-btn">
            <QrCode className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Full-width card container */}
      <div className="relative z-10 w-full px-3 sm:px-6 lg:px-10 xl:px-16">
        {/* ===== MAIN CARD - full width ===== */}
        <div
          className="rounded-2xl lg:rounded-3xl shadow-2xl overflow-hidden border"
          style={{ borderColor: `${bg}30` }}
          data-testid="card-container"
        >
          {/* Banner / Header */}
          {card.banner_url ? (
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: isFullBanner ? "21/9" : "4/1" }}>
              <img
                src={card.banner_url}
                alt="Banner"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

              {isFullBanner && (
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
                  <div className="bg-white/90 dark:bg-black/70 backdrop-blur-xl rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg max-w-3xl">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold" style={{ color: fg === "#FFFFFF" ? "inherit" : fg }}>{card.title}</h1>
                    {card.subtitle && <p className="text-sm sm:text-base text-muted-foreground mt-1">{card.subtitle}</p>}
                    {card.description && <p className="text-sm mt-2 line-clamp-3">{card.description}</p>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full h-28 sm:h-36 md:h-44 lg:h-52" style={{ background: `linear-gradient(135deg, ${bg}, ${bg}cc)` }} />
          )}

          {/* Card body */}
          <div
            className="relative"
            style={{ background: `linear-gradient(180deg, ${bg}, ${bg}ee)`, color: fg }}
          >
            {/* Avatar row */}
            <div className="px-5 sm:px-8 lg:px-12 -mt-12 sm:-mt-14 lg:-mt-16 flex items-end justify-between">
              <div className="relative">
                {card.avatar_url ? (
                  <img
                    src={card.avatar_url}
                    alt={card.title}
                    className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl lg:rounded-3xl object-cover border-4 shadow-xl overflow-hidden"
                    style={{ borderColor: bg }}
                    data-testid="card-avatar"
                  />
                ) : (
                  <div
                    className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl lg:rounded-3xl flex items-center justify-center text-4xl sm:text-5xl font-bold border-4 shadow-xl overflow-hidden"
                    style={{ backgroundColor: `${fg}20`, borderColor: bg }}
                  >
                    {(card.title || "?")[0].toUpperCase()}
                  </div>
                )}
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] sm:text-[11px] font-semibold whitespace-nowrap"
                  style={{ backgroundColor: `${fg}25`, backdropFilter: "blur(8px)" }}
                >
                  {cardTypeLabel}
                </div>
              </div>

              {!isFullBanner && (
                <div className="flex gap-2 mb-3">
                  {card.user_id && (!user || card.user_id !== user.id) && (
                    <button onClick={handleStartChat} className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center hover:scale-105 transition-transform" style={{ backgroundColor: `${fg}20` }} title="Mensaje" data-testid="card-chat-btn">
                      <MessageCircle className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Content - responsive grid on large screens */}
            <div className="px-5 sm:px-8 lg:px-12 pt-5 sm:pt-6 lg:pt-8 pb-6 sm:pb-8 lg:pb-10">
              {!isFullBanner && (
                <div className="mb-6">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1" data-testid="card-title">{card.title}</h1>
                  {card.subtitle && <p className="text-sm sm:text-base lg:text-lg opacity-85 font-medium mb-1.5">{card.subtitle}</p>}
                  {card.description && <p className="text-sm sm:text-base opacity-75 leading-relaxed max-w-4xl">{card.description}</p>}
                </div>
              )}

              {/* Bubble grid - distributed content sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 lg:gap-5">
                {/* Contact Info Bubble */}
                {hasContact && (
                  <div className="rounded-2xl p-4 lg:p-5 space-y-2.5" style={{ backgroundColor: `${fg}10` }} data-testid="card-contact-bubble">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Contacto</h3>
                    {card.contact_info.phone && (
                      <a href={`tel:${card.contact_info.phone}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:scale-[1.02] transition-transform" style={{ backgroundColor: `${fg}10` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}15` }}>
                          <Phone className="w-4 h-4" />
                        </div>
                        <span className="text-sm truncate">{card.contact_info.phone}</span>
                      </a>
                    )}
                    {card.contact_info.email && (
                      <a href={`mailto:${card.contact_info.email}`} className="flex items-center gap-3 p-2.5 rounded-xl hover:scale-[1.02] transition-transform" style={{ backgroundColor: `${fg}10` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}15` }}>
                          <Mail className="w-4 h-4" />
                        </div>
                        <span className="text-sm truncate">{card.contact_info.email}</span>
                      </a>
                    )}
                    {card.contact_info.address && (
                      <div className="flex items-center gap-3 p-2.5 rounded-xl" style={{ backgroundColor: `${fg}10` }}>
                        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}15` }}>
                          <MapPin className="w-4 h-4" />
                        </div>
                        <span className="text-sm">
                          {card.contact_info.address}
                          {card.contact_info.city && `, ${card.contact_info.city}`}
                          {card.contact_info.country && `, ${card.contact_info.country}`}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Social Links Bubble */}
                {hasSocial && (
                  <div className="rounded-2xl p-4 lg:p-5" style={{ backgroundColor: `${fg}10` }} data-testid="card-social-bubble">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Conecta conmigo</h3>
                    <div className="flex flex-wrap gap-2.5">
                      {card.social_links.map((link, i) => (
                        <SocialLinkButton key={i} link={link} size="default" theme="dark" onlyIcon={true} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Gallery Bubble */}
                {hasGallery && (
                  <div className="rounded-2xl p-4 lg:p-5 md:col-span-2 xl:col-span-1" style={{ backgroundColor: `${fg}10` }} data-testid="card-gallery-bubble">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Galeria</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {card.gallery_photos.map((photo, i) => (
                        <div key={i} className="aspect-square rounded-xl overflow-hidden">
                          <img src={photo} alt={`Foto ${i + 1}`} className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Location bubble (if separate from contact) */}
                {card.location && (card.location.city || card.location.address) && (
                  <div className="rounded-2xl p-4 lg:p-5" style={{ backgroundColor: `${fg}10` }} data-testid="card-location-bubble">
                    <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3">Ubicacion</h3>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}15` }}>
                        <MapPin className="w-5 h-5" />
                      </div>
                      <span className="text-sm">{card.location.city || card.location.address}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Share bar */}
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={copyLink} data-testid="card-copy-link">
            {copied ? "Copiado!" : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar enlace</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Compartir
          </Button>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link to="/register">
            <Button size="lg" className="shadow-xl">Crear mi tarjeta BRUNO</Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-3">
            Creado con <Link to="/" className="text-primary font-medium hover:underline">BRUNO</Link> - Tarjetas digitales del futuro
          </p>
        </div>
      </div>

      {/* QR Modal */}
      {showQR && qrData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQR(false)}>
          <Card className="w-full max-w-md" onClick={e => e.stopPropagation()}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Codigo QR</h3>
                <button onClick={() => setShowQR(false)} className="text-muted-foreground hover:text-foreground text-lg">&times;</button>
              </div>
              <div className="p-6 bg-white rounded-xl mb-4 flex items-center justify-center">
                <img src={qrData.qr_code} alt="QR Code" className="w-56 h-56" />
              </div>
              <div className="p-2.5 bg-muted rounded-lg mb-3">
                <p className="text-xs text-muted-foreground break-all text-center">{qrData.card_url}</p>
              </div>
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = qrData.qr_code;
                  link.download = `bruno-qr-${cardId}.png`;
                  link.click();
                }}
                className="w-full"
              >
                Descargar QR
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ViewCardPage;
