import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import BubbleSelect from "@/components/BubbleSelect";
import { socialMediaConfig, getSocialIcon, getSocialColor } from "./SocialLinkButton";
import { Plus, X, Instagram, Facebook, Linkedin, Twitter, Youtube, MessageCircle, Mail, Phone, Globe, Link as LinkIcon } from "lucide-react";

// Iconos para el selector
const socialIcons = {
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  twitter: Twitter,
  tiktok: MessageCircle,
  youtube: Youtube,
  whatsapp: MessageCircle,
  email: Mail,
  phone: Phone,
  website: Globe,
  custom: LinkIcon
};

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

  // Render option con icono
  const renderSocialOption = (option, isSelected) => {
    const Icon = socialIcons[option.value] || LinkIcon;
    return (
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-muted-foreground" />
        <span className={isSelected ? "font-medium" : ""}>{option.label}</span>
      </div>
    );
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
                className="flex items-center gap-2 px-3 py-2 rounded-xl backdrop-blur-sm border"
                style={{ borderColor: `${color}40`, backgroundColor: `${color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-sm font-medium">{link.label}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="ml-1 p-1 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors"
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
          className="w-full h-12 rounded-xl border-2 border-dashed hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          <Plus className="w-5 h-5 mr-2" />
          Agregar Red Social / Contacto
        </Button>
      )}

      {/* Formulario para agregar - Con estilo burbuja */}
      {showAddForm && (
        <Card className="glass-card overflow-visible">
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo de Red Social</label>
              <BubbleSelect
                value={newLink.type}
                onChange={(value) => setNewLink({ ...newLink, type: value })}
                options={socialTypes}
                placeholder="Selecciona una red social"
                renderOption={renderSocialOption}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                {newLink.type === "email" ? "Email" :
                 newLink.type === "phone" ? "Teléfono" :
                 newLink.type === "whatsapp" ? "Número de WhatsApp" :
                 "Usuario o Enlace"}
              </label>
              <Input
                className="h-12 rounded-xl border-2"
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
                className="h-12 rounded-xl border-2"
                placeholder="Ej: Mi Instagram Personal"
                value={newLink.label}
                onChange={(e) => setNewLink({ ...newLink, label: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                onClick={handleAdd}
                disabled={!newLink.url}
                className="flex-1 h-12 rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setNewLink({ type: "instagram", label: "", url: "" });
                }}
                className="flex-1 h-12 rounded-xl"
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
