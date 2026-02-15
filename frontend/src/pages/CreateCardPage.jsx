import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import SocialLinkSelector from "@/components/SocialLinkSelector";
import TemplateSelector from "@/components/TemplateSelector";
import LocationSelector from "@/components/LocationSelector";
import axios from "axios";
import { ArrowLeft, Save, Upload, Image as ImageIcon } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const cardTypes = [
  { value: "personal", label: "Personal", desc: "Tarjeta de presentación personal" },
  { value: "empresarial", label: "Empresarial", desc: "Presentación corporativa" },
  { value: "negocio", label: "Negocio", desc: "Información de empresa o negocio" },
  { value: "lugares", label: "Lugares", desc: "Turismo, información, advertencias" },
  { value: "guardian", label: "Guardián", desc: "Para niños, ancianos o personas con necesidades especiales" },
  { value: "curriculum", label: "Curriculum", desc: "Hoja de vida profesional" },
];

const CreateCardPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  
  const [formData, setFormData] = useState({
    card_type: "personal",
    title: "",
    subtitle: "",
    description: "",
    avatar_url: "",
    banner_url: "",
    background_color: "#FF6B35",
    text_color: "#FFFFFF",
    social_links: [],
    location: null,
    template_id: "personal_classic",
    is_public: true,
    show_in_feed: true,
    is_animated: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleCardTypeChange = (type) => {
    const defaultTemplates = {
      personal: "personal_classic",
      empresarial: "empresarial_pro",
      negocio: "negocio_showcase",
      lugares: "lugares_tour",
      guardian: "guardian_safe",
      curriculum: "curriculum_clean",
    };
    
    setFormData({
      ...formData,
      card_type: type,
      template_id: defaultTemplates[type]
    });
  };

  const handleImageUpload = async (file, type) => {
    if (!file) return;

    const uploadSetter = type === "avatar" ? setUploadingAvatar : setUploadingBanner;
    uploadSetter(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("file", file);

      const endpoint = type === "avatar" ? "/upload/avatar" : "/upload/banner";
      const response = await axios.post(`${API}${endpoint}`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setFormData({
        ...formData,
        [`${type}_url`]: response.data.url,
      });
    } catch (error) {
      console.error(`Error uploading ${type}:`, error);
      alert(`Error al subir la imagen. Por favor intenta de nuevo.`);
    } finally {
      uploadSetter(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/cards`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      navigate(`/dashboard`);
    } catch (error) {
      console.error("Error creating card:", error);
      alert("Error al crear la tarjeta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <img src="/bruno-mascot.png" alt="BRUNO" className="h-8" />
          <div>
            <h1 className="text-xl font-bold">Crear Nueva Tarjeta</h1>
            <p className="text-sm text-muted-foreground">Completa la información de tu tarjeta</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tipo de Tarjeta */}
              <Card>
                <CardHeader>
                  <CardTitle>Tipo de Tarjeta</CardTitle>
                  <CardDescription>Selecciona el tipo de tarjeta</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cardTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                        formData.card_type === type.value
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="card_type"
                        value={type.value}
                        checked={formData.card_type === type.value}
                        onChange={() => handleCardTypeChange(type.value)}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.desc}</div>
                      </div>
                    </label>
                  ))}
                </CardContent>
              </Card>

              {/* Plantilla */}
              <Card>
                <CardHeader>
                  <CardTitle>Plantilla</CardTitle>
                  <CardDescription>Elige el diseño de tu tarjeta</CardDescription>
                </CardHeader>
                <CardContent>
                  <TemplateSelector
                    cardType={formData.card_type}
                    selectedTemplate={formData.template_id}
                    onChange={(template) => setFormData({ ...formData, template_id: template })}
                  />
                </CardContent>
              </Card>

              {/* Imágenes */}
              <Card>
                <CardHeader>
                  <CardTitle>Imágenes</CardTitle>
                  <CardDescription>Sube tu foto de perfil y banner</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Banner */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Banner (1200x400px)</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      {formData.banner_url ? (
                        <div className="space-y-2">
                          <img
                            src={formData.banner_url}
                            alt="Banner"
                            className="w-full h-32 object-cover rounded-lg"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({ ...formData, banner_url: "" })}
                          >
                            Cambiar Banner
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e.target.files[0], "banner")}
                            className="hidden"
                            disabled={uploadingBanner}
                          />
                          <ImageIcon className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">
                            {uploadingBanner ? "Subiendo..." : "Click para subir banner"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Recomendado: 1200x400px
                          </p>
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Avatar */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Foto de Perfil (400x400px)</label>
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                      {formData.avatar_url ? (
                        <div className="space-y-2">
                          <img
                            src={formData.avatar_url}
                            alt="Avatar"
                            className="w-32 h-32 object-cover rounded-full mx-auto"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setFormData({ ...formData, avatar_url: "" })}
                          >
                            Cambiar Foto
                          </Button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleImageUpload(e.target.files[0], "avatar")}
                            className="hidden"
                            disabled={uploadingAvatar}
                          />
                          <Upload className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium mb-1">
                            {uploadingAvatar ? "Subiendo..." : "Click para subir foto"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Recomendado: 400x400px
                          </p>
                        </label>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Información Básica */}
              <Card>
                <CardHeader>
                  <CardTitle>Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Título *</label>
                    <Input
                      name="title"
                      placeholder="Juan Pérez"
                      value={formData.title}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subtítulo</label>
                    <Input
                      name="subtitle"
                      placeholder="UX Designer @ Tech Co"
                      value={formData.subtitle}
                      onChange={handleChange}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Descripción</label>
                    <textarea
                      name="description"
                      placeholder="Agrega una descripción..."
                      value={formData.description}
                      onChange={handleChange}
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Redes Sociales y Contacto */}
              <Card>
                <CardHeader>
                  <CardTitle>Redes Sociales y Contacto</CardTitle>
                  <CardDescription>
                    Agrega tus redes sociales, sitio web y formas de contacto
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SocialLinkSelector
                    links={formData.social_links}
                    onChange={(links) => setFormData({ ...formData, social_links: links })}
                  />
                </CardContent>
              </Card>

              {/* Ubicación */}
              <Card>
                <CardHeader>
                  <CardTitle>Ubicación</CardTitle>
                  <CardDescription>
                    Agrega la ubicación de tu tarjeta (opcional)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LocationSelector
                    location={formData.location}
                    onChange={(location) => setFormData({ ...formData, location })}
                  />
                </CardContent>
              </Card>

              {/* Diseño */}
              <Card>
                <CardHeader>
                  <CardTitle>Colores</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Color de Fondo</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          name="background_color"
                          value={formData.background_color}
                          onChange={handleChange}
                          className="h-10 w-20"
                        />
                        <Input
                          type="text"
                          name="background_color"
                          value={formData.background_color}
                          onChange={handleChange}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Color de Texto</label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          name="text_color"
                          value={formData.text_color}
                          onChange={handleChange}
                          className="h-10 w-20"
                        />
                        <Input
                          type="text"
                          name="text_color"
                          value={formData.text_color}
                          onChange={handleChange}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Privacidad */}
              <Card>
                <CardHeader>
                  <CardTitle>Privacidad</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_public"
                      checked={formData.is_public}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Tarjeta pública</div>
                      <div className="text-sm text-muted-foreground">
                        Cualquiera con el enlace puede ver esta tarjeta
                      </div>
                    </div>
              {/* Visibilidad en Feed */}
              <Card>
                <CardHeader>
                  <CardTitle>Visibilidad en el Feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="show_in_feed"
                      checked={formData.show_in_feed}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Mostrar en el Feed pablico</div>
                      <div className="text-sm text-muted-foreground">
                        Si est 0e1 desmarcado, solo se podr e1 acceder con el enlace directo
                      </div>
                    </div>
                  </label>
                </CardContent>
              </Card>

              {/* Animaci f3n */}
              <Card>
                <CardHeader>
                  <CardTitle>Animaci f3n</CardTitle>
                </CardHeader>
                <CardContent>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="is_animated"
                      checked={formData.is_animated}
                      onChange={handleChange}
                      className="w-4 h-4"
                    />
                    <div>
                      <div className="font-medium">Activar efecto din e1mico</div>
                      <div className="text-sm text-muted-foreground">
                        Aplica suaves movimientos tipo burbuja a la tarjeta
                      </div>
                    </div>
                  </label>
                </CardContent>
              </Card>


                  </label>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate("/dashboard")}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" disabled={loading || uploadingAvatar || uploadingBanner}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? "Creando..." : "Crear Tarjeta"}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview */}
          <div className="lg:sticky lg:top-8 h-fit">
            <Card>
              <CardHeader>
                <CardTitle>Vista Previa</CardTitle>
                <CardDescription>Así se verá tu tarjeta</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-2xl shadow-lg relative overflow-hidden"
                  style={{
                    background: `linear-gradient(135deg, ${formData.background_color}, ${formData.background_color}dd)`,
                    color: formData.text_color,
                  }}
                >
                  {/* Banner */}
                  {formData.banner_url && (
                    <div 
                      className="h-32 bg-cover bg-center"
                      style={{ backgroundImage: `url(${formData.banner_url})` }}
                    />
                  )}

                  <div className="p-8">
                    {/* Avatar */}
                    {formData.avatar_url ? (
                      <img
                        src={formData.avatar_url}
                        alt="Avatar"
                        className="w-24 h-24 rounded-full object-cover border-4 mb-4"
                        style={{ borderColor: formData.text_color }}
                      />
                    ) : (
                      <div
                        className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold mb-4 border-4"
                        style={{
                          backgroundColor: `${formData.text_color}20`,
                          borderColor: formData.text_color
                        }}
                      >
                        {formData.title.charAt(0) || "?"}
                      </div>
                    )}

                    <h3 className="text-2xl font-bold mb-2">{formData.title || "Título"}</h3>
                    {formData.subtitle && <p className="mb-4 opacity-90">{formData.subtitle}</p>}
                    {formData.description && (
                      <p className="text-sm opacity-75 mb-4">{formData.description}</p>
                    )}

                    {/* Social Links Preview */}
                    {formData.social_links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {formData.social_links.map((link, index) => (
                          <div
                            key={index}
                            className="w-10 h-10 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: `${formData.text_color}20` }}
                          >
                            <span className="text-xs font-bold">
                              {link.type.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CreateCardPage;
