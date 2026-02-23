import React, { useState } from "react";
import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing, X } from "lucide-react";

export const NotificationPrompt = ({ onDismiss }) => {
  const { isSupported, permission, requestPermission, isSubscribed } = useNotifications();
  const [loading, setLoading] = useState(false);

  if (!isSupported) return null;
  if (permission === 'granted' && isSubscribed) return null;
  if (permission === 'denied') return null;

  const handleEnable = async () => {
    setLoading(true);
    await requestPermission();
    setLoading(false);
    if (onDismiss) onDismiss();
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-card border rounded-2xl p-4 shadow-lg z-40 animate-in slide-in-from-bottom-4">
      <button 
        onClick={onDismiss}
        className="absolute top-2 right-2 p-1 hover:bg-muted rounded-full"
      >
        <X className="w-4 h-4" />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
          <BellRing className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Activa las notificaciones</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Recibe alertas cuando tengas llamadas entrantes, mensajes nuevos o interacciones en tus publicaciones.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={loading}
              className="flex-1"
            >
              {loading ? "Activando..." : "Activar"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
            >
              Ahora no
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Notification toggle for settings
export const NotificationToggle = () => {
  const { isSupported, permission, requestPermission, unsubscribe, isSubscribed } = useNotifications();
  const [loading, setLoading] = useState(false);

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-3">
          <BellOff className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Tu navegador no soporta notificaciones push
          </span>
        </div>
      </div>
    );
  }

  const handleToggle = async () => {
    setLoading(true);
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await requestPermission();
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-between p-4 bg-card border rounded-lg">
      <div className="flex items-center gap-3">
        {isSubscribed ? (
          <Bell className="w-5 h-5 text-primary" />
        ) : (
          <BellOff className="w-5 h-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Notificaciones push</p>
          <p className="text-xs text-muted-foreground">
            {isSubscribed 
              ? "Recibirás alertas de llamadas y mensajes" 
              : permission === 'denied'
                ? "Bloqueadas en el navegador"
                : "Activa para no perderte nada"
            }
          </p>
        </div>
      </div>
      <Button
        variant={isSubscribed ? "secondary" : "default"}
        size="sm"
        onClick={handleToggle}
        disabled={loading || permission === 'denied'}
      >
        {loading ? "..." : isSubscribed ? "Desactivar" : "Activar"}
      </Button>
    </div>
  );
};

export default NotificationPrompt;
