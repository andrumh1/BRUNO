import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { ArrowLeft, Nfc, CheckCircle2, Smartphone, AlertCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NFCWritePage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcStatus, setNfcStatus] = useState("idle"); // idle, writing, success, error
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    // Check if Web NFC is supported
    if ('NDEFReader' in window) {
      setNfcSupported(true);
    }
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const response = await axios.get(`${API}/cards`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCards(response.data);
    } catch (error) {
      console.error("Error fetching cards:", error);
    }
  };

  const writeToNFC = async () => {
    if (!selectedCard) {
      alert("Por favor selecciona una tarjeta");
      return;
    }

    if (!nfcSupported) {
      alert("Tu dispositivo no soporta escritura NFC. Intenta desde Chrome en Android.");
      return;
    }

    try {
      setNfcStatus("writing");
      setStatusMessage("Acerca tu tarjeta NFC al dispositivo...");

      const ndef = new NDEFReader();
      await ndef.write({
        records: [
          {
            recordType: "url",
            data: `${window.location.origin}/c/${selectedCard}`
          }
        ]
      });

      // Register NFC card in backend
      const nfcId = `nfc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await axios.post(
        `${API}/nfc/activate`,
        { nfc_id: nfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setNfcStatus("success");
      setStatusMessage("¡Tarjeta NFC programada exitosamente!");
      
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } catch (error) {
      console.error("Error writing to NFC:", error);
      setNfcStatus("error");
      setStatusMessage(
        error.name === "NotAllowedError"
          ? "Permiso denegado. Permite el acceso a NFC en la configuración."
          : error.name === "NotSupportedError"
          ? "Tu dispositivo no soporta escritura NFC."
          : `Error: ${error.message}`
      );
    }
  };

  if (nfcStatus === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Tarjeta NFC Programada!</h2>
            <p className="text-muted-foreground">{statusMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">Programar Tarjeta NFC</h1>
            <p className="text-sm text-muted-foreground">Escribe tu tarjeta digital en una tarjeta NFC física</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        {!nfcSupported ? (
          <Card className="border-yellow-500/50 bg-yellow-500/10">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-yellow-500 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-2">NFC no disponible</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    La escritura NFC solo está disponible en Chrome para Android.
                    Si estás en Android, asegúrate de:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Usar Chrome o navegador compatible</li>
                    <li>Tener NFC activado en configuración</li>
                    <li>Dar permisos de NFC a la app</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
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
                    <p className="text-sm text-muted-foreground p-4 border rounded-lg">
                      No tienes tarjetas creadas. Crea una tarjeta primero.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cards.map((card) => (
                        <label
                          key={card.id}
                          className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            selectedCard === card.id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="card"
                            value={card.id}
                            checked={selectedCard === card.id}
                            onChange={(e) => setSelectedCard(e.target.value)}
                          />
                          <div
                            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: card.background_color }}
                          >
                            {card.title.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{card.title}</div>
                            {card.subtitle && (
                              <div className="text-sm text-muted-foreground">{card.subtitle}</div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Message */}
                {nfcStatus === "writing" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Smartphone className="w-5 h-5 text-blue-500 animate-pulse" />
                    <p className="text-sm">{statusMessage}</p>
                  </div>
                )}

                {nfcStatus === "error" && (
                  <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <p className="text-sm">{statusMessage}</p>
                  </div>
                )}

                {/* Write Button */}
                <Button
                  onClick={writeToNFC}
                  disabled={!selectedCard || nfcStatus === "writing" || cards.length === 0}
                  className="w-full"
                >
                  {nfcStatus === "writing" ? (
                    <>
                      <Nfc className="w-4 h-4 mr-2 animate-pulse" />
                      Esperando tarjeta NFC...
                    </>
                  ) : (
                    <>
                      <Nfc className="w-4 h-4 mr-2" />
                      Programar Tarjeta NFC
                    </>
                  )}
                </Button>

                {/* Instructions */}
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Instrucciones:</h4>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Selecciona la tarjeta que quieres programar</li>
                    <li>Haz clic en "Programar Tarjeta NFC"</li>
                    <li>Acerca tu tarjeta NFC a la parte trasera del celular</li>
                    <li>Mantén la tarjeta cerca hasta que veas el mensaje de éxito</li>
                  </ol>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default NFCWritePage;
