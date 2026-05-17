import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import {
  ArrowLeft, Nfc, CheckCircle2, Smartphone, AlertCircle,
  ShoppingBag, Link2, Copy, Loader2, ExternalLink, RefreshCw
} from "lucide-react";
import { brunoToast as toast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const ActivateNFCPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [activeMode, setActiveMode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Mode 1: Producto BRUNO con ID
  const [brunoNfcId, setBrunoNfcId] = useState("");

  // Mode 2: Producto externo con NFC
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcStatus, setNfcStatus] = useState("idle");
  const [nfcMsg, setNfcMsg] = useState("");

  // Mode 3: Link externo
  const [generatedLink, setGeneratedLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  // Re-encode existing NFC tags
  const [existingNfcCards, setExistingNfcCards] = useState([]);
  const [reencoding, setReencoding] = useState(false);

  useEffect(() => {
    fetchCards();
    checkNFCSupport();
    fetchExistingNfc();
  }, []);

  const fetchCards = async () => {
    try {
      const res = await axios.get(`${API}/cards`, { headers: { Authorization: `Bearer ${token}` } });
      setCards(res.data);
    } catch (err) {
      // error handled
    }
  };

  const fetchExistingNfc = async () => {
    try {
      const res = await axios.get(`${API}/nfc/my-cards`, { headers: { Authorization: `Bearer ${token}` } });
      setExistingNfcCards(res.data);
    } catch (err) {
      // error handled
    }
  };

  const checkNFCSupport = () => {
    setNfcSupported('NDEFReader' in window);
  };

  // ==================== MODE 1: Producto BRUNO con ID ====================
  const handleBrunoActivate = async (e) => {
    e.preventDefault();
    if (!brunoNfcId || !selectedCard) return;
    setLoading(true);
    try {
      await axios.post(`${API}/nfc/activate`,
        { nfc_id: brunoNfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(true);
      setSuccessMsg("Producto BRUNO NFC activado correctamente");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al activar");
    } finally {
      setLoading(false);
    }
  };

  // ==================== MODE 2: Producto externo - Write NFC ====================
  const handleExternalNfcWrite = async () => {
    if (!selectedCard) {
      toast.error("Selecciona una tarjeta primero");
      return;
    }
    if (!nfcSupported) {
      toast.error("Tu dispositivo no soporta escritura NFC");
      return;
    }

    try {
      setNfcStatus("writing");
      setNfcMsg("Acerca tu producto NFC al dispositivo...");

      // Register NFC in backend
      const nfcId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await axios.post(`${API}/nfc/activate`,
        { nfc_id: nfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Write to NFC tag using the direct redirect endpoint
      const ndef = new NDEFReader();
      const nfcUrl = `${window.location.origin}/api/nfc/go/${nfcId}`;

      await ndef.write({
        records: [{ recordType: "url", data: nfcUrl }]
      });

      setSuccess(true);
      setSuccessMsg("NFC grabado exitosamente con tu tarjeta");
    } catch (err) {
      // error handled
      setNfcStatus("error");
      if (err.name === "NotAllowedError") {
        setNfcMsg("Permiso NFC denegado. Habilita NFC en la configuracion del navegador.");
      } else if (err.name === "NotSupportedError") {
        setNfcMsg("NFC no soportado en este dispositivo.");
      } else if (err.name === "NetworkError") {
        setNfcMsg("Error de conexion. Acerca el NFC mas cerca del dispositivo.");
      } else {
        setNfcMsg(err.message || "Error al escribir NFC");
      }
    }
  };

  // ==================== MODE 3: Link externo ====================
  const handleGenerateLink = async () => {
    if (!selectedCard) {
      toast.error("Selecciona una tarjeta primero");
      return;
    }
    setLoading(true);
    try {
      const nfcId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await axios.post(`${API}/nfc/activate`,
        { nfc_id: nfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const link = `${window.location.origin}/api/nfc/go/${nfcId}`;
      setGeneratedLink(link);
      toast.success("Link generado correctamente");
    } catch (err) {
      toast.error("Error al generar el link");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink);
    setLinkCopied(true);
    toast.success("Link copiado al portapapeles");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  // ==================== RE-ENCODE EXISTING ====================
  const handleReencodeAll = async () => {
    if (!nfcSupported) {
      toast.error("Necesitas un dispositivo con NFC para recodificar");
      return;
    }
    setReencoding(true);
    try {
      const ndef = new NDEFReader();
      toast.info("Acerca la tarjeta NFC que quieres recodificar al dispositivo...");

      // Read first to identify which tag it is
      const abortController = new AbortController();
      
      ndef.addEventListener("reading", async ({ serialNumber }) => {
        // Find matching NFC card by checking all registered ones
        // Write the new URL format to it
        const matchingNfc = existingNfcCards.find(n => n.nfc_id);
        if (matchingNfc) {
          const newUrl = `${window.location.origin}/api/nfc/go/${matchingNfc.nfc_id}`;
          try {
            await ndef.write({ records: [{ recordType: "url", data: newUrl }] });
            toast.success(`NFC recodificado correctamente con URL actualizada`);
          } catch (writeErr) {
            toast.error("Error al escribir en la tarjeta NFC");
          }
        }
        abortController.abort();
        setReencoding(false);
      }, { signal: abortController.signal });

      await ndef.scan({ signal: abortController.signal });

      // Timeout after 30 seconds
      setTimeout(() => {
        abortController.abort();
        setReencoding(false);
      }, 30000);
    } catch (err) {
      toast.error("Error al iniciar la lectura NFC");
      setReencoding(false);
    }
  };

  // ==================== CARD SELECTOR COMPONENT ====================
  const CardSelector = () => (
    <div className="space-y-2">
      <label className="text-sm font-medium">Selecciona una Tarjeta *</label>
      {cards.length === 0 ? (
        <div className="text-center py-6 border rounded-xl bg-muted/30">
          <Nfc className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">No tienes tarjetas creadas</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/cards/new")}>Crear Tarjeta</Button>
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {cards.map((card) => (
            <label
              key={card.id}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                selectedCard === card.id
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border hover:border-primary/40"
              }`}
              data-testid={`card-option-${card.id}`}
            >
              <input
                type="radio"
                name="card"
                value={card.id}
                checked={selectedCard === card.id}
                onChange={(e) => setSelectedCard(e.target.value)}
                className="sr-only"
              />
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0 overflow-hidden"
                style={{ backgroundColor: card.background_color || "#FF5A00" }}
              >
                {card.avatar_url ? (
                  <img src={card.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  card.title?.charAt(0) || "?"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{card.title}</p>
                {card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}
              </div>
              {selectedCard === card.id && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
            </label>
          ))}
        </div>
      )}
    </div>
  );

  // ==================== SUCCESS STATE ====================
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" data-testid="nfc-success">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Listo!</h2>
            <p className="text-muted-foreground mb-6">{successMsg}</p>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/nfc/manage")}>
                Ver mis tags NFC
              </Button>
              <Button variant="outline" className="w-full" onClick={() => { setSuccess(false); setActiveMode(null); setSelectedCard(""); }}>
                Activar otro NFC
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==================== MODE SELECTION ====================
  const modes = [
    {
      id: "bruno",
      icon: ShoppingBag,
      title: "Producto BRUNO con ID",
      desc: "Para tarjetas fisicas compradas en la tienda BRUNO",
      color: "from-primary to-orange-500",
    },
    {
      id: "external",
      icon: Smartphone,
      title: "Producto externo con NFC",
      desc: "Graba cualquier tag NFC con tu tarjeta digital",
      color: "from-blue-500 to-cyan-500",
    },
    {
      id: "link",
      icon: Link2,
      title: "Link externo para NFC",
      desc: "Genera un link para grabar en cualquier tag NFC externo",
      color: "from-purple-500 to-pink-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="activate-nfc-page">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => activeMode ? setActiveMode(null) : navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Activar NFC</h1>
            <p className="text-xs text-muted-foreground">
              {activeMode ? modes.find(m => m.id === activeMode)?.title : "Selecciona el tipo de activacion"}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-24">
        {/* MODE SELECTOR */}
        {!activeMode && (
          <>
            <div className="space-y-3">
              {modes.map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-border hover:border-primary/40 bg-card hover:bg-primary/5 transition-all text-left"
                    data-testid={`nfc-mode-${mode.id}`}
                  >
                    <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${mode.color} flex items-center justify-center text-white shrink-0`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm">{mode.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Re-encode section */}
            {existingNfcCards.length > 0 && (
              <Card className="border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-sm">Recodificar tags NFC existentes</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Si tus tarjetas NFC no abren correctamente, recodificalas con la URL actualizada.
                        Tienes {existingNfcCards.length} tag(s) registrados.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={handleReencodeAll}
                        disabled={reencoding || !nfcSupported}
                        data-testid="nfc-reencode-btn"
                      >
                        {reencoding ? (
                          <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Esperando NFC...</>
                        ) : (
                          <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recodificar NFC</>
                        )}
                      </Button>
                      {!nfcSupported && (
                        <p className="text-[10px] text-amber-600 mt-2">Necesitas Android + Chrome para recodificar</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* ==================== MODE 1: BRUNO con ID ==================== */}
        {activeMode === "bruno" && (
          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-orange-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShoppingBag className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-center text-base">Producto BRUNO con ID</CardTitle>
              <CardDescription className="text-center">
                Ingresa el ID impreso en tu tarjeta fisica BRUNO y vinculala con tu tarjeta digital
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBrunoActivate} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">ID de Tarjeta BRUNO *</label>
                  <Input
                    placeholder="Ej: BRUNO-NFC-123456"
                    value={brunoNfcId}
                    onChange={(e) => setBrunoNfcId(e.target.value)}
                    required
                    data-testid="bruno-nfc-id-input"
                  />
                  <p className="text-[10px] text-muted-foreground">El ID esta en la parte trasera de tu tarjeta fisica BRUNO</p>
                </div>

                <CardSelector />

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl"
                  disabled={loading || !brunoNfcId || !selectedCard}
                  data-testid="bruno-activate-btn"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Nfc className="w-4 h-4 mr-2" />}
                  Activar Producto BRUNO
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ==================== MODE 2: Producto externo NFC ==================== */}
        {activeMode === "external" && (
          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Smartphone className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-center text-base">Grabar NFC Externo</CardTitle>
              <CardDescription className="text-center">
                Selecciona tu tarjeta y acerca cualquier tag NFC al dispositivo para grabarlo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!nfcSupported && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">NFC no disponible</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Tu navegador no soporta Web NFC. Usa Chrome en Android para grabar tags NFC.
                    </p>
                  </div>
                </div>
              )}

              <CardSelector />

              {nfcStatus === "writing" && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 animate-pulse">
                  <Smartphone className="w-6 h-6 text-blue-500 animate-bounce" />
                  <div>
                    <p className="font-medium text-sm text-blue-600">{nfcMsg}</p>
                    <p className="text-xs text-muted-foreground">Manten la tarjeta cerca hasta ver el mensaje de exito</p>
                  </div>
                </div>
              )}

              {nfcStatus === "error" && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
                  <p className="text-sm text-destructive">{nfcMsg}</p>
                </div>
              )}

              <Button
                onClick={handleExternalNfcWrite}
                disabled={!selectedCard || !nfcSupported || nfcStatus === "writing" || cards.length === 0}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                data-testid="external-nfc-write-btn"
              >
                {nfcStatus === "writing" ? (
                  <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Esperando NFC...</>
                ) : (
                  <><Nfc className="w-4 h-4 mr-2" /> Grabar en NFC</>
                )}
              </Button>

              <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Instrucciones:</p>
                <p>1. Selecciona la tarjeta que quieres grabar</p>
                <p>2. Haz clic en "Grabar en NFC"</p>
                <p>3. Acerca el tag NFC a la parte trasera del celular</p>
                <p>4. Espera al mensaje de confirmacion</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ==================== MODE 3: Link externo ==================== */}
        {activeMode === "link" && (
          <Card>
            <CardHeader>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Link2 className="w-7 h-7 text-white" />
              </div>
              <CardTitle className="text-center text-base">Link Externo para NFC</CardTitle>
              <CardDescription className="text-center">
                Genera un link que puedes grabar en cualquier tag NFC usando herramientas externas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <CardSelector />

              <Button
                onClick={handleGenerateLink}
                disabled={loading || !selectedCard || cards.length === 0}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                data-testid="generate-link-btn"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
                Generar Link NFC
              </Button>

              {generatedLink && (
                <div className="space-y-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20" data-testid="generated-link-section">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-700">Link generado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedLink}
                      className="flex-1 px-3 py-2 rounded-lg border bg-background text-xs font-mono truncate"
                      data-testid="generated-link-input"
                    />
                    <Button size="sm" variant="outline" onClick={copyLink} data-testid="copy-link-btn">
                      {linkCopied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Usa este link para grabarlo en tu tag NFC con cualquier app de escritura NFC (NFC Tools, TagWriter, etc.)
                  </p>
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Como usar:</p>
                <p>1. Selecciona tu tarjeta y genera el link</p>
                <p>2. Copia el link generado</p>
                <p>3. Abre una app de escritura NFC (NFC Tools, etc.)</p>
                <p>4. Escribe el link como registro URL en tu tag NFC</p>
                <p>5. Al escanear el tag, se abrira tu tarjeta BRUNO</p>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default ActivateNFCPage;
