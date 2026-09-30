import React, { useState, useEffect, useCallback } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SocialLinkButton from "@/components/SocialLinkButton";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Share2, QrCode, Eye, Globe, Phone, Mail, MapPin, MessageCircle, ArrowLeft, Pencil, Copy, ExternalLink, Minimize2, Nfc, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeProvider";

const luminance = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const n = parseInt(m[1], 16); const r = n >> 16, g = (n >> 8) & 255, b = n & 255; return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };
import { useNavScroll } from "@/contexts/NavScrollContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewCardPage = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { addMinimizedCard } = useNavScroll();
  const { resolved: resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [copied, setCopied] = useState(false);

  const isOwner = user && card && user.id === card.user_id;

  const fetchCard = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}`);
      setCard(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Tarjeta no encontrada");
    } finally { setLoading(false); }
  }, [cardId]);

  const handleStartChat = async () => {
    if (!token || !user) { navigate("/login"); return; }
    if (!card?.user_id || card.user_id === user.id) return;
    try {
      const response = await axios.post(`${API}/chats?participant_id=${card.user_id}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate(`/chat/${response.data.id}`);
    } catch (e) {
      console.warn("ViewCardPage: could not start chat", e);
    }
  };

  useEffect(() => { fetchCard(); }, [fetchCard]);

  // Track card view for analytics
  useEffect(() => {
    if (!cardId) return;
    axios.post(`${API}/analytics/cards/${cardId}/view`, null, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      params: { source_url: document.referrer || undefined }
    }).catch(() => {});
  }, [cardId, token]);

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}/qr`);
      setQrData(response.data);
      setShowQR(true);
    } catch (e) {
      console.warn("ViewCardPage: could not fetch QR", e);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: card.title, text: card.subtitle || "", url }); } catch (e) {
        console.warn("ViewCardPage: share cancelled", e);
      }
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
      <BrunoLoader />
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

  // Modo oscuro: las tarjetas claras (crema/blanco) pasan a gris corporativo con texto crema.
  const rawBg = card.background_color || "#FF6A00";
  const lightCard = luminance(rawBg) > 0.72;
  const bg = isDark && lightCard ? "#474747" : rawBg;
  const fg = isDark && lightCard ? "#F9F1EA" : (card.text_color || "#FFFFFF");
  const isFullBanner = card.template_id === "full_banner_bubble";
  const isEdge = card.template_id === "edge_actions";
  const isPremiumGlass = card.template_id === "premium_glass";
  const isPremiumFormal = card.template_id === "premium_formal";
  const isPremiumFullImg = card.template_id === "premium_fullimg";
  const isPremiumAnimated = card.template_id === "premium_animated";

  const cardTypeLabel = card.card_type === "personal" ? "Personal" : card.card_type === "empresarial" ? "Empresarial" : card.card_type === "negocio" ? "Negocio" : card.card_type === "servicios" ? "Servicios" : card.card_type === "lugares" ? "Lugar" : card.card_type === "guardian" ? "Guardian" : card.card_type === "curriculum" ? "CV" : card.card_type === "mascotas" ? "Mascota" : card.card_type;

  const hasContact = card.contact_info && (card.contact_info.phone || card.contact_info.email || card.contact_info.address);
  const hasSocial = card.social_links && card.social_links.length > 0;
  const hasGallery = card.gallery_photos && card.gallery_photos.length > 0;

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="view-card-page" data-card-theme={isDark ? "dark" : "light"}>
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
          <Button variant="ghost" size="icon" onClick={() => {
            addMinimizedCard({
              id: cardId,
              title: card?.title || card?.name || '',
              card_type: card?.card_type || '',
              thumbnail: card?.avatar_url || card?.banner_url || null,
            });
            navigate(-1);
          }} data-testid="card-minimize-btn" title="Minimizar">
            <Minimize2 className="w-4 h-4" />
          </Button>
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`/cards/${cardId}/edit`)} data-testid="card-edit-btn">
              <Pencil className="w-4 h-4 mr-1.5" /> Editar
            </Button>
          )}
          {isOwner && (
            <Button variant="ghost" size="icon" onClick={() => navigate(`/cards/${cardId}/transfer`)} data-testid="card-nfc-transfer-btn" title="Transferir por NFC" className="text-primary">
              <Nfc className="w-4 h-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} data-testid="card-theme-toggle" title={isDark ? "Modo claro" : "Modo oscuro"} aria-pressed={isDark}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
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
          className={`rounded-2xl lg:rounded-3xl shadow-2xl overflow-hidden border ${isPremiumGlass ? 'backdrop-blur-xl bg-white/10' : ''} ${isPremiumFormal ? 'border-amber-400/40' : ''}`}
          style={{
            borderColor: isPremiumFormal ? undefined : `${bg}30`,
            ...(isPremiumAnimated ? { background: `linear-gradient(135deg, ${bg}, ${bg}CC, ${bg}88, ${bg})`, backgroundSize: '400% 400%', animation: 'gradientShift 8s ease infinite' } : {}),
            ...(isPremiumFullImg && card.banner_url ? { backgroundImage: `url(${card.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
          }}
          data-testid="card-container"
        >
          {/* Premium animated gradient keyframes */}
          {isPremiumAnimated && (
            <style>{`@keyframes gradientShift { 0%,100% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } }`}</style>
          )}
          {/* Banner / Header */}
          {isPremiumFullImg ? (
            /* premium_fullimg: dark overlay on the background image for readability */
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70 pointer-events-none" />
          ) : card.banner_url ? (
            <div className="relative w-full overflow-hidden" style={{ aspectRatio: isFullBanner ? "21/9" : "4/1" }}>
              <img
                src={card.banner_url}
                alt="Banner"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />

              {isFullBanner && (
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 lg:p-8">
                  <div className="bg-white/90 dark:bg-[#474747]/85 backdrop-blur-xl rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg max-w-3xl">
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
            className={`relative ${isPremiumGlass ? 'backdrop-blur-xl' : ''}`}
            style={{
              background: isPremiumFullImg ? 'transparent' : isPremiumGlass ? `${bg}40` : `linear-gradient(180deg, ${bg}, ${bg}ee)`,
              color: fg
            }}
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
                    className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl lg:rounded-3xl flex items-center justify-center border-4 shadow-xl overflow-hidden bg-[#f9f1ea]"
                    style={{ borderColor: bg }}
                    data-testid="card-avatar-fallback"
                  >
                    <BrunoLogo variant="icon" tone="orange" className="w-[62%]" />
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
                  <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 ${isPremiumFormal ? 'font-serif tracking-tight' : ''}`} data-testid="card-title">{card.title}</h1>
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
                      {card.social_links.map((link) => (
                        <SocialLinkButton key={`${link.platform}-${link.url}`} link={link} size="default" theme="dark" onlyIcon={true} />
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
                        <div key={photo} className="aspect-square rounded-xl overflow-hidden">
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
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${card.location.lat},${card.location.lng}`, '_blank')}>
                        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}15` }}>
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          {card.location.place_name && <span className="text-xs font-semibold block">{card.location.place_name}</span>}
                          <span className="text-sm opacity-80">{card.location.city || card.location.address}</span>
                        </div>
                      </div>
                      {/* Additional locations */}
                      {card.locations?.length > 0 && card.locations.map((loc, idx) => (
                        loc.address && (
                          <div key={`loc-${loc.address}-${idx}`} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => loc.lat && loc.lng && window.open(`https://www.google.com/maps/search/?api=1&query=${loc.lat},${loc.lng}`, '_blank')}
                            data-testid={`card-location-${idx}`}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${fg}10` }}>
                              <MapPin className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {loc.label && <span className="text-xs font-semibold block">{loc.label}</span>}
                              <span className="text-xs opacity-70">{loc.address}</span>
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Sello BRUNO */}
            <div className="px-5 sm:px-8 lg:px-12 pb-4 pt-1 flex items-center justify-between" data-testid="card-brand-seal">
              <span className="h-px flex-1 mr-3" style={{ background: `linear-gradient(90deg, transparent, ${fg}55)` }} />
              <Link to="/" className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide backdrop-blur-md hover:scale-105 transition-transform" style={{ backgroundColor: `${fg}18`, color: fg }} title="Hecho con BRUNO">
                <span className="bruno-mark h-3.5" style={{ color: fg }} aria-hidden />
                Hecho con BRUNO
              </Link>
              <span className="h-px flex-1 ml-3" style={{ background: `linear-gradient(90deg, ${fg}55, transparent)` }} />
            </div>
          </div>
        </div>

        {/* Share bar */}
        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyLink} data-testid="card-copy-link">
            {copied ? "Copiado!" : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar enlace</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Compartir
          </Button>
          {isOwner && (
            <Button size="sm" onClick={() => navigate(`/cards/${cardId}/transfer`)} className="rounded-full" data-testid="card-transfer-nfc-cta">
              <Nfc className="w-3.5 h-3.5 mr-1.5" /> Transferir por contacto
            </Button>
          )}
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link to="/register">
            <Button size="lg" className="shadow-xl">Crear mi tarjeta BRUNO</Button>
          </Link>
          <Link to="/" className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground" data-testid="card-footer-brand">
            <BrunoLogo variant="wordmark" tone="orange" className="h-4" /> · Tarjetas digitales del futuro
          </Link>
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
