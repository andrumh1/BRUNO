import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import axios from "axios";
import {
  ArrowLeft,
  Bell,
  Shield,
  Eye,
  Moon,
  Globe,
  Palette,
  User,
  Lock,
  MessageCircle,
  Video,
  FileText,
  Trash2,
  LogOut,
  ChevronRight,
  Check,
  Loader2,
  Settings as SettingsIcon
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/settings/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrefs(res.data);
      } catch (e) {
        // defaults
        setPrefs({
          feed_mode: "for_you",
          language: "es",
          theme: "system",
          notifications: { likes: true, comments: true, follows: true, messages: true, mentions: true },
          privacy: { show_online_status: true, allow_messages_from: "everyone", show_read_receipts: true, profile_visibility: "public" },
          content: { autoplay_videos: true, show_sensitive_content: false, default_post_visibility: "public" }
        });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const savePrefs = async (update) => {
    const newPrefs = { ...prefs, ...update };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await axios.put(`${API}/settings/preferences`, update, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ value, onChange, label }) => (
    <div className="flex items-center justify-between py-3">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted"}`}
        data-testid={`toggle-${label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );

  const OptionRow = ({ icon: Icon, label, value, onClick, danger }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 py-3.5 px-1 hover:bg-muted/50 rounded-lg transition-colors ${danger ? "text-destructive" : ""}`}
      data-testid={`setting-${label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="flex-1 text-sm text-left font-medium">{label}</span>
      {value && <span className="text-xs text-muted-foreground">{value}</span>}
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="settings-page">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <SettingsIcon className="w-5 h-5 text-primary" />
          <h1 className="font-bold">Configuracion</h1>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-primary ml-auto" />}
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Notifications */}
        {activeSection === "notifications" ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setActiveSection(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="font-bold">Notificaciones</h2>
              </div>
              <div className="divide-y">
                <Toggle label="Likes" value={prefs.notifications.likes} onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, likes: v } })} />
                <Toggle label="Comentarios" value={prefs.notifications.comments} onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, comments: v } })} />
                <Toggle label="Seguidores nuevos" value={prefs.notifications.follows} onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, follows: v } })} />
                <Toggle label="Mensajes" value={prefs.notifications.messages} onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, messages: v } })} />
                <Toggle label="Menciones" value={prefs.notifications.mentions} onChange={(v) => savePrefs({ notifications: { ...prefs.notifications, mentions: v } })} />
              </div>
            </CardContent>
          </Card>
        ) : activeSection === "privacy" ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setActiveSection(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Shield className="w-5 h-5 text-primary" />
                <h2 className="font-bold">Privacidad</h2>
              </div>
              <div className="divide-y">
                <Toggle label="Mostrar estado en linea" value={prefs.privacy.show_online_status} onChange={(v) => savePrefs({ privacy: { ...prefs.privacy, show_online_status: v } })} />
                <Toggle label="Confirmaciones de lectura" value={prefs.privacy.show_read_receipts} onChange={(v) => savePrefs({ privacy: { ...prefs.privacy, show_read_receipts: v } })} />
                <div className="py-3">
                  <span className="text-sm block mb-2">Quien puede enviarme mensajes</span>
                  <div className="flex gap-2">
                    {["everyone", "followers", "nobody"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ privacy: { ...prefs.privacy, allow_messages_from: opt } })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${prefs.privacy.allow_messages_from === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "everyone" ? "Todos" : opt === "followers" ? "Seguidores" : "Nadie"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-3">
                  <span className="text-sm block mb-2">Visibilidad del perfil</span>
                  <div className="flex gap-2">
                    {["public", "followers", "private"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ privacy: { ...prefs.privacy, profile_visibility: opt } })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${prefs.privacy.profile_visibility === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "public" ? "Publico" : opt === "followers" ? "Seguidores" : "Privado"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : activeSection === "content" ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setActiveSection(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Eye className="w-5 h-5 text-primary" />
                <h2 className="font-bold">Contenido</h2>
              </div>
              <div className="divide-y">
                <Toggle label="Autoplay de videos" value={prefs.content.autoplay_videos} onChange={(v) => savePrefs({ content: { ...prefs.content, autoplay_videos: v } })} />
                <Toggle label="Contenido sensible" value={prefs.content.show_sensitive_content} onChange={(v) => savePrefs({ content: { ...prefs.content, show_sensitive_content: v } })} />
                <div className="py-3">
                  <span className="text-sm block mb-2">Visibilidad por defecto de posts</span>
                  <div className="flex gap-2">
                    {["public", "followers", "private"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ content: { ...prefs.content, default_post_visibility: opt } })}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${prefs.content.default_post_visibility === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "public" ? "Publico" : opt === "followers" ? "Seguidores" : "Privado"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : activeSection === "appearance" ? (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <Button variant="ghost" size="icon" onClick={() => setActiveSection(null)}>
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Palette className="w-5 h-5 text-primary" />
                <h2 className="font-bold">Apariencia</h2>
              </div>
              <div className="divide-y">
                <div className="py-3">
                  <span className="text-sm block mb-2">Tema</span>
                  <div className="flex gap-2">
                    {["light", "dark", "system"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ theme: opt })}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${prefs.theme === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "light" ? "Claro" : opt === "dark" ? "Oscuro" : "Sistema"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-3">
                  <span className="text-sm block mb-2">Idioma</span>
                  <div className="flex gap-2">
                    {["es", "en", "pt"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ language: opt })}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${prefs.language === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "es" ? "Espanol" : opt === "en" ? "English" : "Portugues"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-3">
                  <span className="text-sm block mb-2">Feed por defecto</span>
                  <div className="flex gap-2">
                    {["for_you", "chronological"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ feed_mode: opt })}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${prefs.feed_mode === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "for_you" ? "Para Ti" : "Cronologico"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* MAIN MENU */
          <>
            {/* Account */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Cuenta</h2>
                <div className="divide-y">
                  <OptionRow icon={User} label="Editar perfil" onClick={() => navigate("/edit-profile")} />
                  <OptionRow icon={Lock} label="Cambiar contrasena" onClick={() => {}} value="" />
                  <OptionRow icon={Shield} label="Usuarios bloqueados" onClick={() => navigate("/settings/blocked")} />
                </div>
              </CardContent>
            </Card>

            {/* Preferences */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Preferencias</h2>
                <div className="divide-y">
                  <OptionRow icon={Bell} label="Notificaciones" onClick={() => setActiveSection("notifications")} />
                  <OptionRow icon={Shield} label="Privacidad" onClick={() => setActiveSection("privacy")} value={prefs?.privacy?.profile_visibility === "public" ? "Publico" : "Privado"} />
                  <OptionRow icon={Eye} label="Contenido" onClick={() => setActiveSection("content")} />
                  <OptionRow icon={Palette} label="Apariencia" onClick={() => setActiveSection("appearance")} value={prefs?.theme === "dark" ? "Oscuro" : prefs?.theme === "light" ? "Claro" : "Sistema"} />
                </div>
              </CardContent>
            </Card>

            {/* Legal */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Legal y soporte</h2>
                <div className="divide-y">
                  <OptionRow icon={FileText} label="Terminos y condiciones" onClick={() => navigate("/terms")} />
                  <OptionRow icon={FileText} label="Politica de privacidad" onClick={() => navigate("/privacy")} />
                  <OptionRow icon={FileText} label="Centro legal" onClick={() => navigate("/legal")} />
                </div>
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Zona de peligro</h2>
                <div className="divide-y">
                  <OptionRow icon={LogOut} label="Cerrar sesion" onClick={() => { logout(); navigate("/login"); }} />
                  <OptionRow icon={Trash2} label="Eliminar cuenta" onClick={() => navigate("/settings/delete-account")} danger />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
