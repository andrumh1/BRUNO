import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Monitor, X } from "lucide-react";

const DownloadAppButton = ({ variant = "default", size = "default", className = "" }) => {
  const [showModal, setShowModal] = useState(false);
  const [deviceType, setDeviceType] = useState("unknown");
  const [canInstallPWA, setCanInstallPWA] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Detectar tipo de dispositivo
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      setDeviceType("ios");
    } else if (/android/i.test(userAgent)) {
      setDeviceType("android");
    } else {
      setDeviceType("web");
    }

    // Detectar si se puede instalar PWA
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstallPWA(true);
    });
  }, []);

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      // Mostrar instrucciones manuales
      setShowModal(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("PWA installed");
    }
    
    setDeferredPrompt(null);
    setCanInstallPWA(false);
    setShowModal(false);
  };

  const getDownloadInstructions = () => {
    switch (deviceType) {
      case "ios":
        return {
          title: "Instalar en iOS",
          steps: [
            "1. Toca el botón de Compartir (el cuadrado con flecha hacia arriba)",
            "2. Desplázate hacia abajo y selecciona 'Agregar a pantalla de inicio'",
            "3. Toca 'Agregar' en la esquina superior derecha"
          ],
          storeLink: null, // Próximamente en App Store
          storeLabel: "Próximamente en App Store"
        };
      case "android":
        return {
          title: "Instalar en Android",
          steps: canInstallPWA 
            ? ["Haz clic en el botón de abajo para instalar la app"]
            : [
                "1. Toca el menú (tres puntos) en Chrome",
                "2. Selecciona 'Instalar aplicación' o 'Agregar a pantalla de inicio'",
                "3. Sigue las instrucciones en pantalla"
              ],
          storeLink: null, // Próximamente en Play Store
          storeLabel: "Próximamente en Play Store"
        };
      default:
        return {
          title: "Instalar en tu Navegador",
          steps: canInstallPWA
            ? ["Haz clic en el botón de abajo para instalar la app"]
            : [
                "1. Busca el icono de instalar en la barra de direcciones",
                "2. Haz clic en 'Instalar' o 'Agregar'",
                "3. La app se abrirá como una aplicación nativa"
              ],
          storeLink: null,
          storeLabel: null
        };
    }
  };

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => canInstallPWA && deviceType === "web" ? handleInstallPWA() : setShowModal(true)}
      >
        <Download className="w-4 h-4 mr-2" />
        Descargar App
      </Button>

      {/* Modal de instrucciones */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  {deviceType === "ios" && <Smartphone className="w-6 h-6 text-primary" />}
                  {deviceType === "android" && <Smartphone className="w-6 h-6 text-primary" />}
                  {deviceType === "web" && <Monitor className="w-6 h-6 text-primary" />}
                  <CardTitle>{getDownloadInstructions().title}</CardTitle>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <CardDescription>
                Instala BRUNO para tener acceso rápido y funcionalidad offline
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Instrucciones paso a paso */}
              <div className="space-y-2">
                {getDownloadInstructions().steps.map((step, index) => (
                  <p key={index} className="text-sm text-muted-foreground">
                    {step}
                  </p>
                ))}
              </div>

              {/* Botón de instalación directa si está disponible */}
              {canInstallPWA && deviceType !== "ios" && (
                <Button onClick={handleInstallPWA} className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Instalar Ahora
                </Button>
              )}

              {/* Enlaces a tiendas (placeholder para el futuro) */}
              {getDownloadInstructions().storeLabel && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground text-center mb-3">
                    {getDownloadInstructions().storeLabel}
                  </p>
                  {/* Aquí se agregarán los badges de las tiendas cuando estén disponibles */}
                </div>
              )}

              <Button variant="outline" onClick={() => setShowModal(false)} className="w-full">
                Cerrar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
};

export default DownloadAppButton;
