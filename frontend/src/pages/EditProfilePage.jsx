import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Camera, Eye, Image as ImageIcon, Sparkles, Loader2, Check, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBrunoCamera } from "@/contexts/BrunoCameraContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import BrunoStoryViewer from "@/components/bruno/BrunoStoryViewer";
import BrunoAvatar from "@/components/bruno/BrunoAvatar";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Field = ({ label, value, onChange, multiline, placeholder, testId, maxLength }) => (
  <label className="block">
    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      {label}
    </span>
    {multiline ? (
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        maxLength={maxLength}
        data-testid={testId}
        className="mt-1.5 w-full rounded-2xl bg-muted/50 border border-border/60 p-3 text-sm outline-none focus:ring-2 focus:ring-orange-500/30 resize-none"
      />
    ) : (
      <input
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        data-testid={testId}
        className="mt-1.5 w-full rounded-2xl bg-muted/50 border border-border/60 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-orange-500/30"
      />
    )}
  </label>
);

export default function EditProfilePage() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { open: openCamera } = useBrunoCamera();
  const galleryRef = useRef(null);

  const [profile, setProfile] = useState({
    display_name: "",
    bio: "",
    avatar_url: "",
    location: "",
    website: "",
    profession: "",
    company: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showAvatarFull, setShowAvatarFull] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [storiesData, setStoriesData] = useState(null);
  const [loadingStories, setLoadingStories] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await axios.get(`${API}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProfile({
          display_name: res.data.display_name || "",
          bio: res.data.bio || "",
          avatar_url: res.data.avatar_url || "",
          location: res.data.location || "",
          website: res.data.website || "",
          profession: res.data.profession || "",
          company: res.data.company || "",
        });
      } catch (_) {
        // try /auth/me fallback
        try {
          const me = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setProfile((p) => ({
            ...p,
            display_name: me.data.display_name || me.data.username || "",
            avatar_url: me.data.avatar_url || "",
          }));
        } catch (_) {
          /* ignore */
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await axios.put(`${API}/profile`, profile, {
        headers: { Authorization: `Bearer ${token}` },
      });
      brunoToast.success("Perfil actualizado");
      navigate(-1);
    } catch (e) {
      brunoToast.error("No se pudo guardar", {
        description: e?.response?.data?.detail || "Vuelve a intentarlo.",
      });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    setUploadingAvatar(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await axios.post(`${API}/upload/image`, form, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const url = res.data.url || res.data.secure_url;
      if (!url) throw new Error("upload failed");

      // Optimistically reflect in local state
      setProfile((p) => ({ ...p, avatar_url: url }));

      // Persist avatar immediately so it survives navigation away from this page.
      // We send a PATCH-style payload with current values + new avatar_url to keep
      // the rest of the profile intact.
      try {
        await axios.put(
          `${API}/profile`,
          { ...profile, avatar_url: url },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        brunoToast.success("Foto de perfil actualizada");
      } catch (err) {
        // If auto-persist fails, still keep optimistic update but inform user.
        brunoToast.info("Foto cargada — pulsa Guardar para conservar el cambio");
      }
    } catch (_) {
      brunoToast.error("No se pudo subir la foto");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleChooseFromCamera = () => {
    setShowAvatarMenu(false);
    openCamera({
      mode: "photo",
      onCapture: (file) => uploadAvatar(file),
    });
  };

  const handleChooseFromGallery = () => {
    setShowAvatarMenu(false);
    galleryRef.current?.click();
  };

  const openMyStories = async () => {
    if (!user?.id) {
      brunoToast.info("Inicia sesion para ver tus historias");
      return;
    }
    setShowAvatarMenu(false);
    setLoadingStories(true);
    try {
      const res = await axios.get(`${API}/stories/user/${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const stories = res.data || [];
      if (stories.length === 0) {
        brunoToast.info("No tienes historias activas", {
          description: "Publica una historia desde tu perfil para verla aqui.",
        });
        return;
      }
      setStoriesData({
        user_id: user.id,
        user_name: profile.display_name || user.email || "Tu",
        avatar_url: profile.avatar_url,
        stories,
      });
    } catch (_) {
      brunoToast.error("No se pudieron cargar tus historias");
    } finally {
      setLoadingStories(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="edit-profile-page">
      <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-muted"
            aria-label="Volver"
            data-testid="edit-profile-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-base">Editar perfil</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            data-testid="edit-profile-save"
            className="text-sm font-semibold rounded-full px-4 py-2 bg-orange-500 text-white shadow-md shadow-orange-500/30 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Guardar
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Avatar with camera-icon menu trigger */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <BrunoAvatar
              userId={user?.id}
              src={profile.avatar_url}
              name={profile.display_name || user?.email}
              size={112}
              thickness={3}
              testId="edit-profile-avatar"
            />
            <button
              onClick={() => setShowAvatarMenu(true)}
              disabled={uploadingAvatar}
              data-testid="edit-profile-avatar-camera-btn"
              className="absolute -bottom-1 -right-1 h-10 w-10 rounded-full bg-orange-500 text-white grid place-items-center shadow-lg shadow-orange-500/30 hover:bg-orange-600 disabled:opacity-60 z-10"
            >
              {uploadingAvatar ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Toca la cámara para opciones</p>
        </div>

        {/* Hidden gallery picker for option 3 */}
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadAvatar(f);
            e.target.value = "";
          }}
          data-testid="edit-profile-gallery-input"
        />

        {/* Fields */}
        <div className="space-y-4">
          <Field
            label="Nombre"
            value={profile.display_name}
            onChange={(v) => setProfile((p) => ({ ...p, display_name: v }))}
            placeholder="Tu nombre completo"
            testId="edit-profile-name"
            maxLength={80}
          />
          <Field
            label="Bio"
            value={profile.bio}
            onChange={(v) => setProfile((p) => ({ ...p, bio: v }))}
            placeholder="Cuéntale al mundo quién eres..."
            multiline
            testId="edit-profile-bio"
            maxLength={250}
          />
          <Field
            label="Ubicación"
            value={profile.location}
            onChange={(v) => setProfile((p) => ({ ...p, location: v }))}
            placeholder="Ciudad, País"
            testId="edit-profile-location"
            maxLength={120}
          />
          <Field
            label="Profesión"
            value={profile.profession}
            onChange={(v) => setProfile((p) => ({ ...p, profession: v }))}
            placeholder="Ej. Diseñador, Desarrollador..."
            testId="edit-profile-profession"
            maxLength={120}
          />
          <Field
            label="Empresa"
            value={profile.company}
            onChange={(v) => setProfile((p) => ({ ...p, company: v }))}
            placeholder="¿Dónde trabajas?"
            testId="edit-profile-company"
            maxLength={120}
          />
          <Field
            label="Sitio web"
            value={profile.website}
            onChange={(v) => setProfile((p) => ({ ...p, website: v }))}
            placeholder="https://..."
            testId="edit-profile-website"
            maxLength={200}
          />
        </div>
      </div>

      {/* Avatar bottom-sheet menu */}
      <AnimatePresence>
        {showAvatarMenu && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="avatar-menu"
          >
            <motion.div
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowAvatarMenu(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: 0 }}
              exit={{ y: 200 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl p-4 pb-8"
            >
              <div className="flex justify-center mb-3">
                <span className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    if (!profile.avatar_url) {
                      brunoToast.info("No tienes foto de perfil aún");
                      return;
                    }
                    setShowAvatarMenu(false);
                    setShowAvatarFull(true);
                  }}
                  data-testid="avatar-menu-view"
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-muted/60 text-left"
                >
                  <span className="grid place-items-center h-10 w-10 rounded-full bg-blue-500/10 text-blue-500">
                    <Eye className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold">Ver foto de perfil</span>
                </button>
                <button
                  onClick={openMyStories}
                  data-testid="avatar-menu-stories"
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-muted/60 text-left disabled:opacity-60"
                  disabled={loadingStories}
                >
                  <span className="grid place-items-center h-10 w-10 rounded-full bg-purple-500/10 text-purple-500">
                    {loadingStories ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                  </span>
                  <span className="flex-1 text-sm font-semibold">Ver historia</span>
                </button>
                <button
                  onClick={handleChooseFromCamera}
                  data-testid="avatar-menu-camera"
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-muted/60 text-left"
                >
                  <span className="grid place-items-center h-10 w-10 rounded-full bg-orange-500/10 text-orange-500">
                    <Camera className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Cambiar foto de perfil</p>
                    <p className="text-xs text-muted-foreground">Tomar nueva con la cámara</p>
                  </div>
                </button>
                <button
                  onClick={handleChooseFromGallery}
                  data-testid="avatar-menu-gallery"
                  className="w-full flex items-center gap-3 px-3 py-3.5 rounded-2xl hover:bg-muted/60 text-left"
                >
                  <span className="grid place-items-center h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Elegir de la galería</p>
                    <p className="text-xs text-muted-foreground">Importar desde tus archivos</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen avatar viewer (option 1) */}
      <AnimatePresence>
        {showAvatarFull && profile.avatar_url && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black grid place-items-center"
            onClick={() => setShowAvatarFull(false)}
            data-testid="avatar-fullscreen"
          >
            <button
              className="absolute top-4 right-4 grid place-items-center h-10 w-10 rounded-full bg-white/15 text-white"
              onClick={() => setShowAvatarFull(false)}
            >
              <X className="h-5 w-5" />
            </button>
            <motion.img
              src={profile.avatar_url}
              alt="Avatar"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              className="max-h-[80vh] max-w-[90vw] rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Story viewer (option 2 from avatar menu) */}
      <AnimatePresence>
        {storiesData && (
          <BrunoStoryViewer
            userStories={storiesData}
            allUsers={[]}
            onClose={() => setStoriesData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
