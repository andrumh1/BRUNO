import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { ArrowLeft, Nfc, CheckCircle2, Smartphone, AlertCircle, Shield, Settings, RefreshCw } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NFCWritePage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcPermission, setNfcPermission] = useState("unknown"); // unknown, granted, denied, prompt
  const [nfcStatus, setNfcStatus] = useState("idle"); // idle, checking, writing, success, error
  const [statusMessage, setStatusMessage] = useState("");
  const [deviceInfo, setDeviceInfo] = useState({ browser: "", os: "", isAndroid: false, isIOS: false });

  useEffect(() => {
    detectDevice();
    checkNFCSupport();
    fetchCards();
  }, []);

  const detectDevice = () => {
    const ua = navigator.userAgent;
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isChrome = /Chrome/i.test(ua) && !/Edge|Edg/i.test(ua);
    const isSafari = /Safari/i.test(ua) && !/Chrome/i.test(ua);
    const isFirefox = /Firefox/i.test(ua);
    
    let browser = "Desconocido";
    if (isChrome) browser = "Chrome";
    else if (isSafari) browser = "Safari";
    else if (isFirefox) browser = "Firefox";
    
    let os = "Desconocido";
    if (isAndroid) os = "Android";
    else if (isIOS) os = "iOS";
    else if (/Windows/i.test(ua)) os = "Windows";
    else if (/Mac/i.test(ua)) os = "macOS";
    else if (/Linux/i.test(ua)) os = "Linux";
    
    setDeviceInfo({ browser, os, isAndroid, isIOS });
  };

  const checkNFCSupport = async () => {
    // Check if Web NFC API is available
    if ('NDEFReader' in window) {
      setNfcSupported(true);
      
      // Try to check permission status
      try {
        if ('permissions' in navigator) {
          // Note: NFC permission query might not be supported in all browsers
          const result = await navigator.permissions.query({ name: 'nfc' }).catch(() => null);
          if (result) {
            setNfcPermission(result.state);
            result.addEventListener('change', () => {
              setNfcPermission(result.state);
            });
          }
        }
      } catch (e) {
        // Permission query not supported, will check on write attempt
        setNfcPermission("unknown");
      }
    } else {
      setNfcSupported(false);
    }
  };

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCards(response.data);
    } catch (error) {
      // error handled
    }
  };

  const requestNFCPermission = async () => {
    setNfcStatus("checking");
    setStatusMessage("Solicitando permisos NFC...");
    
    try {
      const ndef = new NDEFReader();
      // This will trigger the permission prompt
      await ndef.scan();
      setNfcPermission("granted");
      setNfcStatus("idle");
      setStatusMessage("¡Permisos NFC concedidos!");
    } catch (error) {
      // error handled
      if (error.name === "NotAllowedError") {
        setNfcPermission("denied");
        setNfcStatus("error");
        setStatusMessage("Permiso NFC denegado. Por favor, habilita NFC en la configuración de tu navegador.");
      } else if (error.name === "NotSupportedError") {
        setNfcSupported(false);
        setNfcStatus("error");
        setStatusMessage("NFC no está soportado en este dispositivo o navegador.");
      } else {
        setNfcStatus("error");
        setStatusMessage(`Error: ${error.message}`);
      }
    }
  };

  const writeToNFC = async () => {
    if (!selectedCard) {
      alert("Por favor selecciona una tarjeta");
      return;
    }

    if (!nfcSupported) {
      alert("Tu dispositivo no soporta escritura NFC.");
      return;
    }

    try {
      setNfcStatus("writing");
      setStatusMessage("Acerca tu tarjeta NFC al dispositivo...");

      // First register NFC card in backend to get a tracked nfc_id
      const nfcId = `nfc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await axios.post(
        `${API}/nfc/activate`,
        { nfc_id: nfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const ndef = new NDEFReader();
      
      // Use the backend direct redirect endpoint for instant NFC resolution
      // This does HTTP 302 redirect server-side without loading the React SPA
      const nfcUrl = `${window.location.origin}/api/nfc/go/${nfcId}`;
      
      await ndef.write({
        records: [
          {
            recordType: "url",
            data: nfcUrl
          }
        ]
      });

      setNfcStatus("success");
      setStatusMessage("Tarjeta NFC programada exitosamente!");
      
      setTimeout(() => {
        navigate("/my-profile");
      }, 3000);
    } catch (error) {
      // error handled
      setNfcStatus("error");
      
      if (error.name === "NotAllowedError") {
        setNfcPermission("denied");
        setStatusMessage("Permiso denegado. Por favor, permite el acceso a NFC en la configuracion de tu navegador.");
      } else if (error.name === "NotSupportedError") {
        setStatusMessage("Tu dispositivo no soporta escritura NFC.");
      } else if (error.name === "NetworkError") {
        setStatusMessage("Error de red. Asegurate de que la tarjeta NFC este cerca del dispositivo.");
      } else if (error.name === "AbortError") {
        setStatusMessage("Operacion cancelada. Intentalo de nuevo.");
      } else if (error.name === "InvalidStateError") {
        setStatusMessage("Estado invalido. Por favor, recarga la pagina e intentalo de nuevo.");
      } else {
        setStatusMessage(`Error: ${error.message || "Error desconocido al escribir en NFC"}`);
      }
    }
  };

  const getCompatibilityInfo = () => {
    if (deviceInfo.isAndroid) {
      return {
        supported: true,
        message: "Android soporta NFC a través de Chrome.",
        instructions: [
          "Asegúrate de tener Chrome actualizado (versión 89+)",
          "Activa NFC en Configuración > Conexiones > NFC",
          "Permite el acceso a NFC cuando el navegador lo solicite",
          "Mantén la tarjeta NFC cerca de la parte trasera del teléfono"
        ]
      };
    } else if (deviceInfo.isIOS) {
      return {
        supported: false,
        message: "iOS tiene soporte limitado para NFC en navegadores web.",
        instructions: [
          "Safari en iOS no soporta Web NFC API actualmente",
          "Para escribir NFC en iOS, necesitas una app nativa",
          "Considera usar un dispositivo Android para programar tarjetas NFC",
          "La lectura NFC funciona automáticamente al acercar la tarjeta"
        ]
      };
    } else {
      return {
        supported: false,
        message: "NFC generalmente solo está disponible en dispositivos móviles.",
        instructions: [
          "Usa un dispositivo Android con Chrome para programar tarjetas NFC",
          "Asegúrate de que tu dispositivo tenga hardware NFC",
          "Algunos ordenadores portátiles tienen NFC pero el soporte web es limitado"
        ]
      };
    }
  };

  const compatibility = getCompatibilityInfo();

  if (nfcStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-16">
            <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Tarjeta NFC Programada!</h2>
            <p className="text-muted-foreground mb-4">{statusMessage}</p>
            <p className="text-sm text-muted-foreground">
              Redirigiendo al panel en 3 segundos...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/my-profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Programar Tarjeta NFC</h1>
            <p className="text-sm text-muted-foreground">Escribe tu tarjeta digital en una tarjeta NFC física</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Device & Compatibility Info */}
        <Card className={compatibility.supported ? "border-green-500/50 bg-green-500/5" : "border-yellow-500/50 bg-yellow-500/5"}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                compatibility.supported ? "bg-green-500/20" : "bg-yellow-500/20"
              }`}>
                {compatibility.supported ? (
                  <Shield className="w-6 h-6 text-green-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-yellow-500" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold">
                    {compatibility.supported ? "Dispositivo Compatible" : "Compatibilidad Limitada"}
                  </h3>
                  <span className="text-xs px-2 py-1 rounded-full bg-muted">
                    {deviceInfo.os} • {deviceInfo.browser}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{compatibility.message}</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {compatibility.instructions.map((instruction, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NFC Permission Status */}
        {nfcSupported && nfcPermission !== "granted" && (
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Permisos NFC</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {nfcPermission === "denied" 
                      ? "Los permisos NFC fueron denegados. Habilítalos en la configuración del navegador."
                      : "Necesitas conceder permisos NFC para programar tarjetas."
                    }
                  </p>
                  <Button 
                    onClick={requestNFCPermission}
                    disabled={nfcStatus === "checking"}
                    variant={nfcPermission === "denied" ? "destructive" : "default"}
                  >
                    {nfcStatus === "checking" ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Verificando...
                      </>
                    ) : nfcPermission === "denied" ? (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Reintentar Permisos
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4 mr-2" />
                        Solicitar Permisos NFC
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main NFC Programming Card */}
        <Card>
          <CardHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Nfc className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-center">Programar Tarjeta NFC</CardTitle>
            <CardDescription className="text-center">
              Selecciona la tarjeta que deseas programar en tu tarjeta NFC física
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Card Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Selecciona una Tarjeta *</label>
                {cards.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg bg-muted/50">
                    <Nfc className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No tienes tarjetas creadas. Crea una tarjeta primero.
                    </p>
                    <Button variant="outline" onClick={() => navigate("/cards/new")}>
                      Crear Tarjeta
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {cards.map((card) => (
                      <label
                        key={card.id}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedCard === card.id
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                        }`}
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
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                          style={{ backgroundColor: card.background_color }}
                        >
                          {card.avatar_url ? (
                            <img src={card.avatar_url} alt="" className="w-full h-full rounded-lg object-cover" />
                          ) : (
                            card.title.charAt(0)
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{card.title}</div>
                          {card.subtitle && (
                            <div className="text-sm text-muted-foreground truncate">{card.subtitle}</div>
                          )}
                        </div>
                        {selectedCard === card.id && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Messages */}
              {nfcStatus === "writing" && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20 animate-pulse">
                  <Smartphone className="w-6 h-6 text-blue-500 animate-bounce" />
                  <div>
                    <p className="font-medium text-blue-600">{statusMessage}</p>
                    <p className="text-sm text-muted-foreground">Mantén la tarjeta cerca hasta que veas el mensaje de éxito</p>
                  </div>
                </div>
              )}

              {nfcStatus === "error" && (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="w-6 h-6 text-destructive flex-shrink-0" />
                  <div>
                    <p className="font-medium text-destructive">Error</p>
                    <p className="text-sm text-muted-foreground">{statusMessage}</p>
                  </div>
                </div>
              )}

              {/* Write Button */}
              <Button
                onClick={writeToNFC}
                disabled={!selectedCard || nfcStatus === "writing" || cards.length === 0 || !nfcSupported}
                className="w-full h-14 text-lg"
                size="lg"
              >
                {nfcStatus === "writing" ? (
                  <>
                    <Nfc className="w-5 h-5 mr-2 animate-pulse" />
                    Esperando tarjeta NFC...
                  </>
                ) : (
                  <>
                    <Nfc className="w-5 h-5 mr-2" />
                    Programar Tarjeta NFC
                  </>
                )}
              </Button>

              {/* Instructions */}
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">?</span>
                  Instrucciones
                </h4>
                <ol className="text-sm text-muted-foreground space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">1</span>
                    <span>Selecciona la tarjeta que quieres programar</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">2</span>
                    <span>Haz clic en "Programar Tarjeta NFC"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">3</span>
                    <span>Acerca tu tarjeta NFC a la parte trasera del celular</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary flex-shrink-0">4</span>
                    <span>Mantén la tarjeta cerca hasta que veas el mensaje de éxito</span>
                  </li>
                </ol>
              </div>

              {/* Tips */}
              <div className="text-xs text-muted-foreground space-y-1 border-t pt-4">
                <p><strong>💡 Consejos:</strong></p>
                <p>• Asegúrate de que tu tarjeta NFC sea escribible (no de solo lectura)</p>
                <p>• La antena NFC suele estar en la parte superior trasera del teléfono</p>
                <p>• Retira cualquier funda gruesa que pueda interferir con la señal</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default NFCWritePage;
