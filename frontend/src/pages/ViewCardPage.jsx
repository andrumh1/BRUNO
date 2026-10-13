import React, { useState, useEffect, useCallback } from "react";
import { useShareHit } from "@/lib/shareStats";
import { saveToDevice } from "@/native/files";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import axios from "axios";
import { Share2, QrCode, Globe, ArrowLeft, Pencil, Copy, ExternalLink, Minimize2, Nfc, Sun, Moon, ImageDown } from "lucide-react";
import { useTheme } from "@/contexts/ThemeProvider";
import { renderCardImage } from "@/lib/cardShareImage";
import ShareImageSheet from "@/components/bruno/ShareImageSheet";
import CardRenderer from "@/components/cards/CardRenderer";
import { resolveDesign, deepMerge, luminance } from "@/lib/cardDesign";
import { useNavScroll } from "@/contexts/NavScrollContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ViewCardPage = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { addMinimizedCard } = useNavScroll();
  const { resolved: resolvedTheme, setTheme } = useTheme();
  useShareHit("card");
  const isDark = resolvedTheme === "dark";
  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [copied, setCopied] = useState(false);

  const isOwner = user && card && user.id === card.user_id && !card.is_example;
  const [demo, setDemo] = useState(null);
  useEffect(() => { const on = (e) => setDemo(e.detail); window.addEventListener("bruno:example-action", on); return () => window.removeEventListener("bruno:example-action", on); }, []);

  const fetchCard = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}${cardId.startsWith("example-") ? window.location.search : ""}`);
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

  const [shareSheet, setShareSheet] = useState(false);
  const renderShareImage = async ({ format = "story", bgColor, phrase, withRef } = {}) => {
    const link = withRef ? withRef(`${window.location.origin}/c/${cardId}`) : `${window.location.origin}/c/${cardId}`;
    const blob = await renderCardImage(card, { url: link, dark: isDark, format, bgColor, phrase, design });
    return { blob, name: `bruno-${(card.title || "tarjeta").replace(/[^\w-]+/g, "_")}-${format}.png`, text: `${card.title} · Mi tarjeta BRUNO`, link, label: card.title, targetId: cardId };
  };

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

  // Modo oscuro: fondos claros (crema/blanco) pasan a gris corporativo con texto crema.
  const baseDesign = resolveDesign(card);
  const lightCard = ["color", "gradient"].includes(baseDesign.background.type) && luminance(baseDesign.background.color) > 0.72;
  const design = isDark && lightCard ? deepMerge(baseDesign, { background: { color: "#474747", color2: "#2f2f2f" }, colors: { text: "#F9F1EA" } }) : baseDesign;
  const bg = design.background.color;

  return (
    <div className="min-h-screen bg-background" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 72px)" }} data-testid="view-card-page" data-card-theme={isDark ? "dark" : "light"}>
      {/* Subtle background glow — decorative only, never above controls nor interactive */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden>
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] rounded-full blur-[140px] opacity-10" style={{ backgroundColor: bg }} />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full blur-[120px] opacity-8" style={{ backgroundColor: bg }} />
      </div>

      {/* Top bar - sticky under the status bar/notch, solid glass so controls stay readable over any card */}
      <div className="sticky top-0 z-40 w-full isolate" data-testid="card-top-bar" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl border-b border-border/40 pointer-events-none" aria-hidden />
        <div className="relative px-3 sm:px-6 lg:px-10 py-2 flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} data-testid="card-back-btn" aria-label="Volver" className="h-11 w-11 rounded-full bg-card shadow-sm shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
            <Button variant="outline" size="icon" className="h-11 w-11 rounded-full bg-card shadow-sm shrink-0" onClick={() => {
              addMinimizedCard({
                id: cardId,
                title: card?.title || card?.name || '',
                card_type: card?.card_type || '',
                thumbnail: card?.avatar_url || card?.banner_url || null,
              });
              navigate(-1);
            }} data-testid="card-minimize-btn" title="Minimizar" aria-label="Minimizar">
              <Minimize2 className="w-4 h-4" />
            </Button>
            {isOwner && (
              <Button size="sm" onClick={() => navigate(`/cards/${cardId}/edit`)} data-testid="card-edit-btn" className="h-11 rounded-full px-4 shadow-sm shrink-0">
                <Pencil className="w-4 h-4 mr-1.5" /> Editar
              </Button>
            )}
            {isOwner && (
              <Button variant="outline" size="icon" onClick={() => navigate(`/cards/${cardId}/transfer`)} data-testid="card-nfc-transfer-btn" title="Transferir por NFC" aria-label="Transferir por NFC" className="h-11 w-11 rounded-full bg-card shadow-sm text-primary shrink-0">
                <Nfc className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" size="icon" onClick={() => setTheme(isDark ? "light" : "dark")} data-testid="card-theme-toggle" title={isDark ? "Modo claro" : "Modo oscuro"} aria-pressed={isDark} className="h-11 w-11 rounded-full bg-card shadow-sm shrink-0">
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={handleShare} data-testid="card-share-btn" aria-label="Compartir" className="h-11 w-11 rounded-full bg-card shadow-sm shrink-0">
              <Share2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={fetchQRCode} data-testid="card-qr-btn" aria-label="Código QR" className="h-11 w-11 rounded-full bg-card shadow-sm shrink-0">
              <QrCode className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Full-width card container */}
      <div className="relative z-10 w-full px-3 sm:px-6 lg:px-10 xl:px-16">
        {/* ===== ONE CARD ENGINE ===== */}
        <CardRenderer data={card} design={design} cardId={cardId} onChat={card.is_example ? () => window.dispatchEvent(new CustomEvent("bruno:example-action", { detail: { label: "Chat", href: "chat" } })) : card.user_id && (!user || card.user_id !== user.id) ? handleStartChat : null} className="lg:rounded-3xl" />
        {demo && (
          <div className="fixed inset-0 z-[120] bg-black/60 grid place-items-center p-6" onClick={() => setDemo(null)} role="dialog" aria-modal="true" data-testid="example-demo-modal">
            <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <p className="font-bold">{card.example_lang === "en" ? "This is a sample card" : "Esta es una tarjeta de ejemplo"}</p>
              <p className="text-sm text-muted-foreground">{card.example_lang === "en" ? `On a real card, "${demo.label}" would contact the owner or open their real link.` : `En una tarjeta real, «${demo.label}» contactaría al titular o abriría su enlace real.`}</p>
              <div className="flex gap-2"><button onClick={() => setDemo(null)} className="flex-1 h-10 rounded-full bg-foreground/[0.06] text-sm font-semibold" data-testid="example-demo-close">{card.example_lang === "en" ? "Close" : "Cerrar"}</button><button onClick={() => navigate(`/cards/examples/${card.card_type}?template=${card.example_preset}`)} className="flex-1 h-10 rounded-full bg-primary text-white text-sm font-semibold">{card.example_lang === "en" ? "Create my card" : "Crear mi tarjeta"}</button></div>
            </div>
          </div>
        )}
        {card.is_example && (
          <div className="mt-3 rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 flex items-center gap-3" data-testid="example-public-cta">
            <p className="text-xs flex-1">{card.example_lang === "en" ? "Fictional sample card. Like this design?" : "Tarjeta de ejemplo ficticia. ¿Te gusta este diseño?"}</p>
            <button onClick={() => navigate(`/cards/examples/${card.card_type}?template=${card.example_preset}`)} className="h-9 px-3 rounded-full bg-primary text-white text-xs font-semibold shrink-0" data-testid="example-public-use">{card.example_lang === "en" ? "Use this template" : "Usar esta plantilla"}</button>
          </div>
        )}
        {/* Share bar */}
        <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
          <Button variant="outline" size="sm" onClick={copyLink} data-testid="card-copy-link">
            {copied ? "Copiado!" : <><Copy className="w-3.5 h-3.5 mr-1.5" /> Copiar enlace</>}
          </Button>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Compartir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShareSheet(true)} data-testid="card-share-image-btn" className="border-primary/40 text-primary hover:bg-primary/10" title="Historia 9:16 o cuadrada 1:1 · Instagram, WhatsApp, Facebook, TikTok, LinkedIn">
            <ImageDown className="w-3.5 h-3.5 mr-1.5" /> Imagen para redes
          </Button>
          <ShareImageSheet open={shareSheet} onClose={() => setShareSheet(false)} title="Imagen de tu tarjeta" defaultColor={card.background_color || "#FF6A00"} defaultPhrase={card.description || ""} render={renderShareImage} kind="card" />
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
                onClick={() => saveToDevice(qrData.qr_code, `bruno-qr-${cardId}.png`, { title: "Mi QR de BRUNO" }).catch(() => {})}
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
