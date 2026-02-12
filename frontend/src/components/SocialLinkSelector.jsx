import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { socialMediaConfig, getSocialIcon, getSocialColor } from "./SocialLinkButton";
import { Plus, X } from "lucide-react";

const SocialLinkSelector = ({ links = [], onChange }) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLink, setNewLink] = useState({
    type: "instagram",
    label: "",
    url: ""
  });

  const socialTypes = [
    { value: "instagram", label: "Instagram" },
    { value: "facebook", label: "Facebook" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "twitter", label: "Twitter / X" },
    { value: "tiktok", label: "TikTok" },
    { value: "youtube", label: "YouTube" },
    { value: "whatsapp", label: "WhatsApp" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Teléfono" },
    { value: "website", label: "Sitio Web" },
    { value: "custom", label: "Otro" }
  ];

  const handleAdd = () => {
    if (!newLink.url) return;
    
    const linkToAdd = {
      ...newLink,
      label: newLink.label || socialMediaConfig[newLink.type]?.label || newLink.type
    };
    
    onChange([...links, linkToAdd]);
    
    // Reset form
    setNewLink({ type: "instagram", label: "", url: "" });
    setShowAddForm(false);
  };

  const handleRemove = (index) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      {/* Lista de links agregados */}
      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((link, index) => {
            const Icon = getSocialIcon(link.type);
            const color = getSocialColor(link.type);
            
            return (
              <div
                key={index}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-sm font-medium">{link.label}</span>
                <button
                  onClick={() => handleRemove(index)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Botón para agregar */}
      {!showAddForm && (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowAddForm(true)}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Agregar Red Social / Contacto
        </Button>
      )}

      {/* Formulario para agregar */}
      {showAddForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <select
                value={newLink.type}
                onChange={(e) => setNewLink({ ...newLink, type: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {socialTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {newLink.type === "email" ? "Email" :
                 newLink.type === "phone" ? "Teléfono" :
                 newLink.type === "whatsapp" ? "Número de WhatsApp" :
                 "Usuario o Enlace"}
              </label>
              <Input
                placeholder={
                  newLink.type === "instagram" ? "@usuario o https://instagram.com/usuario" :
                  newLink.type === "facebook" ? "URL de Facebook" :
                  newLink.type === "linkedin" ? "URL de LinkedIn" :
                  newLink.type === "twitter" ? "@usuario o URL" :
                  newLink.type === "email" ? "tu@email.com" :
                  newLink.type === "phone" ? "+1234567890" :
                  newLink.type === "whatsapp" ? "+1234567890" :
                  newLink.type === "website" ? "https://tusitio.com" :
                  "Ingresa el enlace o usuario"
                }
                value={newLink.url}
                onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Etiqueta (opcional)</label>
              <Input
                placeholder="Ej: Mi Instagram Personal"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
              />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!newLink.url}
                className="flex-1"
              >
                Agregar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLink({ type: "instagram", label: "", url: "" });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SocialLinkSelector;
