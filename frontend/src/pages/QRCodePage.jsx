import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { ArrowLeft, Download, Share2 } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const QRCodePage = () => {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQRCode();
  }, [cardId]);

  const fetchQRCode = async () => {
    try {
      const response = await axios.get(`${API}/cards/${cardId}/qr`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setQrData(response.data);
    } catch (error) {
      console.error("Error fetching QR code:", error);
      alert("Error al generar el código QR");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = qrData.qr_code;
    link.download = `bruno-qr-${cardId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mi tarjeta BRUNO",
          text: "Escanea este código QR para ver mi tarjeta",
          url: qrData.card_url,
        });
      } catch (err) {
        // share cancelled or unsupported
      }
    } else {
      navigator.clipboard.writeText(qrData.card_url);
      alert("¡Enlace copiado!");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Generando código QR...</p>
        </div>
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
            <h1 className="text-xl font-bold">Código QR</h1>
            <p className="text-sm text-muted-foreground">Comparte tu tarjeta digital</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Código QR de tu tarjeta</CardTitle>
            <CardDescription>
              Escanea este código para acceder a tu tarjeta digital
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-6">
            {/* QR Code */}
            <div className="p-8 bg-white rounded-2xl shadow-lg">
              <img src={qrData.qr_code} alt="QR Code" className="w-64 h-64" />
            </div>

            {/* URL */}
            <div className="w-full p-4 bg-muted rounded-lg">
              <p className="text-sm text-center text-muted-foreground break-all">
                {qrData.card_url}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="w-4 h-4 mr-2" />
                Descargar QR
              </Button>
              <Button onClick={handleShare} variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" />
                Compartir
              </Button>
            </div>

            {/* Info */}
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Este código QR dirige a tu tarjeta digital.
              </p>
              <p className="text-sm text-muted-foreground">
                Puédalo imprimir en tarjetas físicas, folletos o cualquier material.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default QRCodePage;
