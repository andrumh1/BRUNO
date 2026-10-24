import React, { useState, useEffect } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { BrunoHeaderMark } from "@/components/bruno/BrunoLogo";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CurrencySelector from "@/components/i18n/CurrencySelector";
import { useTheme, ACCENTS } from "@/contexts/ThemeProvider";
import { POSE_OPTIONS, POSE_PREF_KEY } from "@/components/bruno/BrunoLoader";
import { getCustomSeal, setCustomSeal } from "@/lib/shareHistory";
import { brunoToast as toast } from "@/components/bruno/BrunoToast";
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
  Smartphone,
  Languages, Sun, Monitor, Sparkles, Upload, Fingerprint, Package } from "lucide-react";
import { isNative } from "@/native/capacitor";
import { biometricInfo, authenticateBiometric, getBiometricLock, setBiometricLock } from "@/native/biometric";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/* Bloqueo con Face ID / huella: solo tiene efecto en la app nativa (iOS/Android). */
const BiometricRow = () => {
  const native = isNative();
  const [info, setInfo] = useState({ available: false, type: "none" });
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!native) return; biometricInfo().then(setInfo); getBiometricLock().then(setEnabled); }, [native]);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!enabled) {
        const ok = await authenticateBiometric("Confirma tu identidad para activar el bloqueo");
        if (!ok) { toast.error("No se pudo verificar tu identidad"); return; }
        await setBiometricLock(true); setEnabled(true); toast.success("Bloqueo biométrico activado");
      } else {
        await setBiometricLock(false); setEnabled(false); toast.success("Bloqueo biométrico desactivado");
      }
    } finally { setBusy(false); }
  };
  const label = info.type === "face" ? "Face ID / rostro" : info.type === "fingerprint" ? "Huella digital" : "Biometría del teléfono";
  return (
    <div className="flex items-center gap-3 py-3.5 px-1" data-testid="setting-biometric-lock">
      <Fingerprint className="w-5 h-5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Bloquear con {native ? label.toLowerCase() : "Face ID o huella"}</p>
        <p className="text-[11px] text-muted-foreground">
          {!native ? "Disponible en la app de BRUNO para iPhone y Android" : info.available ? "Pide tu biometría al abrir la app o al volver a ella" : "Configura una huella, rostro o código en los ajustes del teléfono"}
        </p>
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={!native || !info.available || busy}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${enabled ? "bg-primary" : "bg-muted"}`}
        data-testid="toggle-biometric-lock"
        aria-pressed={enabled}
        aria-label="Bloqueo biométrico"
      >
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? "translate-x-5" : ""}`} />
      </button>
    </div>
  );
};

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();
  const [staffAccess, setStaffAccess] = useState(false);
  useEffect(() => { if (!token) return; axios.get(`${API}/bruno-service/me/access`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setStaffAccess(!!r.data?.staff)).catch(() => {}); }, [token]);
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const { theme, setTheme, accent, setAccent } = useTheme();
  const [posePref, setPosePref] = useState(() => { try { return localStorage.getItem(POSE_PREF_KEY) || "auto"; } catch { return "auto"; } });
  const savePose = (id) => { setPosePref(id); try { localStorage.setItem(POSE_PREF_KEY, id); } catch { /* ignore */ } };
  const [seal, setSeal] = useState(getCustomSeal());
  const [sealBusy, setSealBusy] = useState(false);
  const [tier, setTier] = useState("free");
  useEffect(() => { if (!token) return; axios.get(`${API}/store/subscription`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => setTier(r.data?.tier || "free")).catch(() => {}); }, [token]);
  useEffect(() => { if (prefs?.custom_seal_url !== undefined && prefs.custom_seal_url !== seal) { setSeal(prefs.custom_seal_url || ""); setCustomSeal(prefs.custom_seal_url || ""); } }, [prefs?.custom_seal_url]); // eslint-disable-line react-hooks/exhaustive-deps
  const isPremium = tier && tier !== "free";
  const uploadSeal = async (file) => {
    if (!file) return;
    setSealBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await axios.post(`${API}/upload/image?folder=bruno/seals`, fd, { headers: { Authorization: `Bearer ${token}` } });
      await savePrefs({ custom_seal_url: up.data.url });
      setSeal(up.data.url); setCustomSeal(up.data.url);
      toast.success("Sello personalizado guardado");
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo subir el logo"); }
    finally { setSealBusy(false); }
  };
  const removeSeal = async () => { await savePrefs({ custom_seal_url: "" }); setSeal(""); setCustomSeal(""); };

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      try {
        const res = await axios.get(`${API}/settings/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPrefs(res.data);
        if (res.data?.accent_color) setAccent(res.data.accent_color);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // error handled
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

  const [translateLang, setTranslateLang] = useState(() => { try { return localStorage.getItem("bruno_lang") || "auto"; } catch { return "auto"; } });
  useEffect(() => {
    axios.get(`${API}/settings/preferences`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => {
      const lang = r.data?.language;
      if (lang && lang !== "auto") { setTranslateLang(lang); try { localStorage.setItem("bruno_lang", lang); } catch { /* ignore */ } }
    }).catch(() => {});
  }, [token]);
  const saveTranslateLang = async (v) => {
    setTranslateLang(v);
    try { if (v === "auto") localStorage.removeItem("bruno_lang"); else localStorage.setItem("bruno_lang", v); } catch { /* ignore */ }
    try { await axios.put(`${API}/settings/preferences`, { language: v }, { headers: { Authorization: `Bearer ${token}` } }); } catch { /* ignore */ }
  };

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
      <BrunoLoader />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" data-testid="settings-page">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <BrunoHeaderMark />
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
                <div className="py-3" data-testid="theme-selector">
                  <span className="text-sm block mb-2">Tema</span>
                  <div className="flex gap-2">
                    {[["light", "Claro", Sun], ["dark", "Oscuro", Moon], ["system", "Sistema", Monitor]].map(([opt, label, Icon]) => (
                      <button
                        key={opt}
                        onClick={() => { setTheme(opt); savePrefs({ theme: opt }); }}
                        aria-pressed={theme === opt}
                        data-testid={`theme-${opt}`}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium inline-flex items-center justify-center gap-1.5 transition-all ${theme === opt ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
                      >
                        <Icon className="w-3.5 h-3.5" /> {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Oscuro usa el gris corporativo BRUNO; Sistema sigue el ajuste de tu dispositivo.</p>
                </div>
                <div className="py-3" data-testid="accent-selector">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm block">Color de acento</span>
                    <span className="text-[11px] text-muted-foreground" data-testid="accent-current">{ACCENTS.find((a) => a.id === accent)?.label}{accent === "orange" ? " (predeterminado)" : ""}</span>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {ACCENTS.map((a) => (
                      <button key={a.id} onClick={() => { setAccent(a.id); savePrefs({ accent_color: a.id }); }} aria-pressed={accent === a.id} data-testid={`accent-${a.id}`} title={a.desc || a.label}
                        className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 text-[11px] font-medium transition-all ${accent === a.id ? "bg-primary/10 ring-2 ring-primary text-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}>
                        <span className="relative w-9 h-9 rounded-full border-2 border-white/70 dark:border-white/20 shadow-md grid place-items-center" style={a.id === "neutral" ? { background: "linear-gradient(135deg,#fff 0%,#9a9a9a 50%,#222 100%)" } : { backgroundColor: a.swatch }}>
                          {accent === a.id && <Check className="w-4 h-4 text-white drop-shadow" />}
                        </span>
                        <span className="truncate max-w-full">{a.label}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-border/60 bg-background/60 backdrop-blur-xl p-3 flex items-center gap-3" data-testid="accent-preview">
                    <span className="h-9 px-4 rounded-full bg-primary text-primary-foreground text-xs font-semibold grid place-items-center shadow-md shadow-primary/25">Botón</span>
                    <span className="h-9 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold grid place-items-center">Chip</span>
                    <span className="flex-1 h-2 rounded-full bg-muted overflow-hidden"><span className="block h-full w-2/3 rounded-full bg-primary" /></span>
                    <span className="w-9 h-9 rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-300 grid place-items-center"><Palette className="w-4 h-4" /></span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Se aplica al instante en toda la app y se guarda en tu cuenta. Las fotos y los videos no se tiñen; los avisos de error, éxito y advertencia conservan sus colores.</p>
                </div>
                <div className="py-3" data-testid="pose-selector">
                  <span className="text-sm block mb-2">Personaje en pantallas de carga</span>
                  <div className="grid grid-cols-4 gap-2">
                    {POSE_OPTIONS.map((o) => (
                      <button key={o.id} onClick={() => savePose(o.id)} aria-pressed={posePref === o.id} data-testid={`pose-${o.id}`}
                        className={`flex flex-col items-center gap-1 rounded-2xl p-2 text-[11px] font-medium transition-all ${posePref === o.id ? "bg-primary/10 ring-2 ring-primary text-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}>
                        <span className="h-14 grid place-items-center">{o.src ? <img src={o.src} alt="" className="h-14 w-auto object-contain" /> : <span className="text-xl leading-none">⟳</span>}</span>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">“Alternar” muestra una pose distinta en cada carga.</p>
                </div>
                <div className="py-3" data-testid="custom-seal">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm">Sello personalizado en imágenes y videos</span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">Premium</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl border border-border/60 bg-card grid place-items-center overflow-hidden shrink-0" data-testid="custom-seal-preview">
                      {seal ? <img src={seal} alt="Sello" className="w-full h-full object-contain p-1.5" /> : <Sparkles className="w-5 h-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-2">Tu logo aparecerá junto al sello BRUNO en portadas, tarjetas y videos descargados.</p>
                      <div className="flex gap-2">
                        <label className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold cursor-pointer ${isPremium ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground cursor-not-allowed"}`} data-testid="custom-seal-upload">
                          {sealBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} {seal ? "Cambiar logo" : "Subir logo"}
                          <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={!isPremium || sealBusy} onChange={(e) => uploadSeal(e.target.files?.[0])} data-testid="custom-seal-input" />
                        </label>
                        {seal && <button onClick={removeSeal} className="h-9 px-3 rounded-full text-xs font-semibold bg-muted text-foreground" data-testid="custom-seal-remove">Quitar</button>}
                      </div>
                      {!isPremium && <button onClick={() => navigate("/premium")} className="text-[11px] text-primary font-semibold mt-2 underline-offset-2 hover:underline" data-testid="custom-seal-upgrade">Hazte Premium para activarlo →</button>}
                    </div>
                  </div>
                </div>
                <div className="py-3">
                  <span className="text-sm block mb-2">Idioma</span>
                  <div className="flex gap-2">
                    {["es", "en", "pt", "fr", "de", "it"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => savePrefs({ language: opt })}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${prefs.language === opt ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {opt === "es" ? "ES" : opt === "en" ? "EN" : opt === "pt" ? "PT" : opt === "fr" ? "FR" : opt === "de" ? "DE" : "IT"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="py-3" data-testid="settings-region-row">
                  <span className="text-sm block mb-2">Región y moneda</span>
                  <CurrencySelector />
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
                  <div className="flex items-center gap-3 py-3.5 px-1" data-testid="setting-translate-language">
                    <Languages className="w-5 h-5 shrink-0" />
                    <div className="flex-1"><p className="text-sm font-medium">Idioma de traducción</p><p className="text-[11px] text-muted-foreground">Al que se traducen mensajes, posts y comentarios</p></div>
                    <select value={translateLang} onChange={(e) => saveTranslateLang(e.target.value)} className="h-9 rounded-lg bg-muted px-2 text-sm outline-none" data-testid="translate-language-select">
                      {[["auto", "Del teléfono"], ["es", "Español"], ["en", "English"], ["pt", "Português"], ["fr", "Français"], ["de", "Deutsch"], ["it", "Italiano"], ["zh", "中文"], ["ja", "日本語"], ["ar", "العربية"], ["ru", "Русский"], ["ko", "한국어"], ["hi", "हिन्दी"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <OptionRow icon={Lock} label="Cambiar contrasena" onClick={() => navigate("/change-password")} />
                  <BiometricRow />
                  <OptionRow icon={Shield} label="Usuarios bloqueados" onClick={() => navigate("/settings/blocked")} />
                  <OptionRow icon={Smartphone} label="Dispositivos y sesiones" onClick={() => navigate("/settings/devices")} />
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
                  <OptionRow icon={Palette} label="Apariencia" onClick={() => setActiveSection("appearance")} value={theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema"} />
                </div>
              </CardContent>
            </Card>

            {/* Equipo BRUNO: pedidos del servicio «Creamos tu tarjeta» (solo admin / producción) */}
            {staffAccess && (
              <Card data-testid="settings-staff-card">
                <CardContent className="p-4">
                  <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Equipo BRUNO</h2>
                  <div className="divide-y">
                    <OptionRow icon={Package} label="Pedidos · Creamos tu tarjeta" onClick={() => navigate("/admin/pedidos")} />
                  </div>
                </CardContent>
              </Card>
            )}

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
