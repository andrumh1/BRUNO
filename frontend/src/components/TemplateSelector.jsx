import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";

// 15 plantillas: 3 por cada tipo de tarjeta
const templates = {
  personal: [
    { id: "personal_classic", name: "Clásico", preview: "Avatar grande con info centrada" },
    { id: "personal_modern", name: "Moderno", preview: "Banner + avatar flotante" },
    { id: "personal_minimal", name: "Minimalista", preview: "Solo avatar + texto" }
  ],
  empresarial: [
    { id: "empresarial_pro", name: "Profesional", preview: "Banner corporativo + logo" },
    { id: "empresarial_elegant", name: "Elegante", preview: "Diseño sofisticado" },
    { id: "empresarial_bold", name: "Impactante", preview: "Full banner + info destacada" }
  ],
  negocio: [
    { id: "negocio_showcase", name: "Escaparate", preview: "Galería de productos" },
    { id: "negocio_info", name: "Informativo", preview: "Enfoque en datos" },
    { id: "negocio_promo", name: "Promocional", preview: "Call-to-action destacado" }
  ],
  lugares: [
    { id: "lugares_tour", name: "Turístico", preview: "Banner panorámico" },
    { id: "lugares_map", name: "Ubicación", preview: "Mapa + info" },
    { id: "lugares_gallery", name: "Galería", preview: "Grid de fotos" }
  ],
  guardian: [
    { id: "guardian_safe", name: "Seguridad", preview: "Info de contacto destacada" },
    { id: "guardian_medical", name: "Médico", preview: "Info médica importante" },
    { id: "guardian_emergency", name: "Emergencia", preview: "Contactos de emergencia" }
  ]
};

const TemplateSelector = ({ cardType, selectedTemplate, onChange }) => {
  const availableTemplates = templates[cardType] || templates.personal;

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Plantilla de Diseño</label>
      <div className="grid grid-cols-3 gap-3">
        {availableTemplates.map((template) => (
          <Card
            key={template.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedTemplate === template.id
                ? "border-primary border-2 shadow-lg"
                : "border-border"
            }`}
            onClick={() => onChange(template.id)}
          >
            <CardContent className="p-4 relative">
              {selectedTemplate === template.id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
              <div className="aspect-square bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg mb-2 flex items-center justify-center text-2xl">
                {template.name.charAt(0)}
              </div>
              <h4 className="font-medium text-sm text-center">{template.name}</h4>
              <p className="text-xs text-muted-foreground text-center mt-1">
                {template.preview}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Selecciona la plantilla que mejor represente tu estilo
      </p>
    </div>
  );
};

export default TemplateSelector;
