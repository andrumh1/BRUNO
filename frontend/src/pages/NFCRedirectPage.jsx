import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle, CreditCard } from "lucide-react";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const NFCRedirectPage = () => {
  const { nfcId } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading, redirecting, not_found, error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const resolveNFC = async () => {
      try {
        const response = await axios.get(`${API}/nfc/resolve/${nfcId}`);
        
        if (response.data.found && response.data.redirect_url) {
          setStatus("redirecting");
          setMessage(`Redirigiendo a: ${response.data.card_title || "tarjeta"}...`);
          
          // Redirect after a brief moment
          setTimeout(() => {
            window.location.href = response.data.redirect_url;
          }, 500);
        } else {
          setStatus("not_found");
          setMessage(response.data.message || "Esta tarjeta NFC no está registrada.");
        }
      } catch (error) {
        console.error("Error resolving NFC:", error);
        setStatus("error");
        setMessage("Error al procesar la tarjeta NFC. Intenta de nuevo.");
      }
    };

    if (nfcId) {
      resolveNFC();
    }
  }, [nfcId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="max-w-md w-full glass-card">
        <CardContent className="pt-8 pb-8 text-center">
          {status === "loading" && (
            <>
              <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto mb-6" />
              <h2 className="text-xl font-semibold mb-2">Leyendo tarjeta NFC...</h2>
              <p className="text-muted-foreground">Por favor espera un momento</p>
            </>
          )}

          {status === "redirecting" && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">¡Tarjeta encontrada!</h2>
              <p className="text-muted-foreground">{message}</p>
            </>
          )}

          {status === "not_found" && (
            <>
              <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-yellow-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Tarjeta no registrada</h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <div className="space-y-3">
                <Button 
                  className="w-full"
                  onClick={() => navigate("/nfc/activate")}
                >
                  Registrar esta tarjeta NFC
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/")}
                >
                  Ir al inicio
                </Button>
              </div>
            </>
          )}

          {status === "error" && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Error</h2>
              <p className="text-muted-foreground mb-6">{message}</p>
              <Button 
                className="w-full"
                onClick={() => window.location.reload()}
              >
                Intentar de nuevo
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NFCRedirectPage;
