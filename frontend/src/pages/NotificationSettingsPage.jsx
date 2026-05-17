import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import axios from "axios";
import {
  ArrowLeft,
  Bell,
  BellRing,
  BellOff,
  Mail,
  Phone,
  MessageCircle,
  Heart,
  UserPlus,
  ShoppingCart,
  Star,
  Camera,
  AtSign,
  Package,
  Tag,
  Loader2,
  Check,
  Smartphone,
  AlertCircle
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
      checked ? 'bg-primary' : 'bg-muted'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
        checked ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
);

const NotificationSettingsPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  // Push notifications hook
  const { 
    isSupported, 
    isSubscribed, 
    permission, 
    loading: pushLoading,
    subscribe, 
    unsubscribe,
    sendTestNotification 
  } = usePushNotifications(token);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testSent, setTestSent] = useState(false);
  
  const [preferences, setPreferences] = useState({
    // Push notifications
    push_enabled: true,
    calls: true,
    messages: true,
    likes: true,
    comments: true,
    followers: true,
    product_favorites: true,
    product_cart: true,
    stories: true,
    mentions: true,
    order_updates: true,
    promotions: false,
    
    // Email notifications
    email_enabled: false,
    email_messages: false,
    email_followers: false,
    email_product_activity: false,
    email_order_updates: true,
    email_promotions: false,
    email_weekly_digest: false
  });

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    
    const fetchPreferences = async () => {
      try {
        const response = await axios.get(`${API}/notifications/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPreferences(prev => ({ ...prev, ...response.data }));
      } catch (error) {
        // error handled
      } finally {
        setLoading(false);
      }
    };
    
    fetchPreferences();
  }, [token, navigate]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/notifications/preferences`, preferences, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      // error handled
      alert("Error al guardar las preferencias");
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
      updatePref("push_enabled", false);
    } else {
      const success = await subscribe();
      if (success) {
        updatePref("push_enabled", true);
      }
    }
  };

  const handleTestNotification = async () => {
    const success = await sendTestNotification();
    if (success) {
      setTestSent(true);
      setTimeout(() => setTestSent(false), 3000);
    }
  };

  const updatePref = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const pushNotificationItems = [
    { key: "calls", label: "Llamadas entrantes", icon: Phone, description: "Video y audio llamadas" },
    { key: "messages", label: "Mensajes nuevos", icon: MessageCircle, description: "Mensajes de chat" },
    { key: "likes", label: "Likes", icon: Heart, description: "Cuando alguien le da like a tu contenido" },
    { key: "comments", label: "Comentarios", icon: MessageCircle, description: "Comentarios en tus posts" },
    { key: "followers", label: "Nuevos seguidores", icon: UserPlus, description: "Cuando alguien te sigue" },
    { key: "product_favorites", label: "Favoritos en productos", icon: Star, description: "Cuando agregan tus productos a favoritos" },
    { key: "product_cart", label: "Carrito de compras", icon: ShoppingCart, description: "Cuando agregan tus productos al carrito" },
    { key: "stories", label: "Stories", icon: Camera, description: "Stories de personas que sigues" },
    { key: "mentions", label: "Menciones", icon: AtSign, description: "Cuando te mencionan en posts" },
    { key: "order_updates", label: "Pedidos", icon: Package, description: "Actualizaciones de tus pedidos" },
    { key: "promotions", label: "Promociones", icon: Tag, description: "Ofertas y promociones especiales" }
  ];

  const emailNotificationItems = [
    { key: "email_messages", label: "Mensajes", description: "Resumen de mensajes no leídos" },
    { key: "email_followers", label: "Nuevos seguidores", description: "Cuando alguien te sigue" },
    { key: "email_product_activity", label: "Actividad de productos", description: "Favoritos y carritos" },
    { key: "email_order_updates", label: "Pedidos", description: "Estado de tus pedidos" },
    { key: "email_promotions", label: "Promociones", description: "Ofertas especiales" },
    { key: "email_weekly_digest", label: "Resumen semanal", description: "Actividad de la semana" }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Notificaciones</h1>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : saved ? (
              <Check className="w-4 h-4 mr-2" />
            ) : null}
            {saved ? "Guardado" : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
        {/* Push Notifications Status */}
        <div className="p-4 bg-gradient-to-r from-primary/10 to-orange-500/10 rounded-xl border border-primary/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${isSubscribed ? 'bg-green-500/20' : 'bg-muted'}`}>
                {isSubscribed ? (
                  <BellRing className="w-6 h-6 text-green-500" />
                ) : (
                  <BellOff className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div>
                <h2 className="font-bold">Notificaciones Push</h2>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed 
                    ? "Activas en este dispositivo" 
                    : permission === 'denied' 
                      ? "Bloqueadas en este navegador"
                      : "No configuradas"}
                </p>
              </div>
            </div>
            {isSupported ? (
              <Button
                variant={isSubscribed ? "outline" : "default"}
                onClick={handlePushToggle}
                disabled={pushLoading || permission === 'denied'}
              >
                {pushLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : null}
                {isSubscribed ? "Desactivar" : "Activar"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">No soportado</span>
            )}
          </div>
          
          {/* Permission denied warning */}
          {permission === 'denied' && (
            <div className="mt-3 p-2 bg-red-500/10 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span>Debes permitir notificaciones en la configuración de tu navegador</span>
            </div>
          )}
          
          {/* Test notification button */}
          {isSubscribed && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleTestNotification} disabled={testSent}>
                <Smartphone className="w-4 h-4 mr-2" />
                {testSent ? "Enviada!" : "Enviar notificación de prueba"}
              </Button>
            </div>
          )}
        </div>

        {/* Push Notifications Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Tipos de Notificación Push
          </h3>
          
          <div className="space-y-2">
            {pushNotificationItems.map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-3 bg-card rounded-xl border"
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
                <ToggleSwitch
                  checked={preferences[item.key]}
                  onChange={(v) => updatePref(item.key, v)}
                  disabled={!isSubscribed}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Email Notifications Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-card rounded-xl border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-full">
                <Mail className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h2 className="font-bold">Notificaciones por Email</h2>
                <p className="text-sm text-muted-foreground">Recibe notificaciones a tu correo</p>
              </div>
            </div>
            <ToggleSwitch
              checked={preferences.email_enabled}
              onChange={(v) => updatePref("email_enabled", v)}
            />
          </div>

          {preferences.email_enabled && (
            <div className="space-y-2">
              {emailNotificationItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-3 bg-card rounded-xl border"
                >
                  <div>
                    <p className="font-medium text-sm">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                  <ToggleSwitch
                    checked={preferences[item.key]}
                    onChange={(v) => updatePref(item.key, v)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 bg-muted/50 rounded-xl">
          <p className="text-sm text-muted-foreground">
            Las notificaciones push requieren que permitas notificaciones en tu navegador. 
            Recibirás alertas incluso cuando la app esté cerrada.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
