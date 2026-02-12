import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import axios from "axios";
import { ArrowLeft, Save } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const cardTypes = [
  { value: "personal", label: "Personal", desc: "Tarjeta de presentación personal" },
  { value: "empresarial", label: "Empresarial", desc: "Presentación corporativa" },
  { value: "negocio", label: "Negocio", desc: "Información de empresa o negocio" },
  { value: "lugares", label: "Lugares", desc: "Turismo, información, advertencias" },
];

const CreateCardPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    card_type: "personal",
    title: "",
    subtitle: "",
    description: "",
    background_color: "#FF6B35",
    text_color: "#FFFFFF",
    is_public: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
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
                        onChange={handleChange}
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
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Diseño</CardTitle>
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
                <Button type="submit" className="flex-1" disabled={loading}>
                  <Save className="w-4 h-4 mr-2" />
                  {loading ? "Creando..." : "Crear Tarjeta"}
                </Button>
              </div>
            </form>
          </div>

          {/* Preview */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Vista Previa</CardTitle>
                <CardDescription>Así se verá tu tarjeta</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="rounded-2xl p-8 shadow-lg"
                  style={{
                    background: `linear-gradient(135deg, ${formData.background_color}, ${formData.background_color}dd)`,
                    color: formData.text_color,
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold mb-4">
                    {formData.title.charAt(0) || "?"}
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{formData.title || "Título"}</h3>
                  {formData.subtitle && <p className="mb-4 opacity-90">{formData.subtitle}</p>}
                  {formData.description && (
                    <p className="text-sm opacity-75">{formData.description}</p>
                  )}
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
