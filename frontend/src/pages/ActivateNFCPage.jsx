import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { ArrowLeft, Nfc, CheckCircle2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ActivateNFCPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [nfcId, setNfcId] = useState("");
  const [selectedCard, setSelectedCard] = useState("");
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  React.useEffect(() => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(
        `${API}/nfc/activate`,
        { nfc_id: nfcId, card_id: selectedCard },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSuccess(true);
      setTimeout(() => {
        navigate("/my-profile");
      }, 2000);
    } catch (error) {
      console.error("Error activating NFC:", error);
      alert("Error al activar la tarjeta NFC");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-16">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2">¡Tarjeta activada!</h2>
            <p className="text-muted-foreground">Tu tarjeta NFC ha sido activada exitosamente</p>
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
            <h1 className="text-xl font-bold">Activar Tarjeta NFC</h1>
            <p className="text-sm text-muted-foreground">Vincula tu tarjeta física con una tarjeta digital</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader>
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Nfc className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-center">Activar Tarjeta NFC</CardTitle>
            <CardDescription className="text-center">
              Ingresa el ID de tu tarjeta NFC y selecciona la tarjeta digital que deseas vincular
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">ID de Tarjeta NFC *</label>
                <Input
                  placeholder="Ingresa el ID (ej: NFC123456789)"
                  value={nfcId}
                  onChange={(e) => setNfcId(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  El ID se encuentra en la parte posterior de tu tarjeta física
                </p>
              </div>

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
                          required
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/my-profile")}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || cards.length === 0}>
                  {loading ? "Activando..." : "Activar Tarjeta"}
                </Button>
              </div>
            </form>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2">¿Cómo funciona?</h4>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Encuentra el ID en tu tarjeta NFC física</li>
                <li>Selecciona la tarjeta digital que deseas vincular</li>
                <li>Cuando alguien escanee tu tarjeta NFC, verá esta tarjeta digital</li>
              </ol>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ActivateNFCPage;
