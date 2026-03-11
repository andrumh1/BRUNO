import React from "react";
import { Check } from "lucide-react";

// Plantillas por tipo de tarjeta
// Se añaden dos diseños comunes extra para todos los tipos:
// - edge_actions: compartir y QR en el borde del avatar
// - full_banner_bubble: banner dominante + info en burbuja semitransparente
const templates = {
  personal: [
    { id: "personal_classic", name: "Clasico", preview: "Avatar grande con info centrada" },
    { id: "personal_modern", name: "Moderno", preview: "Banner + avatar flotante" },
    { id: "personal_minimal", name: "Minimalista", preview: "Solo avatar + texto" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  empresarial: [
    { id: "empresarial_pro", name: "Profesional", preview: "Banner corporativo + logo" },
    { id: "empresarial_elegant", name: "Elegante", preview: "Diseno sofisticado" },
    { id: "empresarial_bold", name: "Impactante", preview: "Full banner + info destacada" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  negocio: [
    { id: "negocio_showcase", name: "Escaparate", preview: "Galeria de productos" },
    { id: "negocio_info", name: "Informativo", preview: "Enfoque en datos" },
    { id: "negocio_promo", name: "Promocional", preview: "Call-to-action destacado" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  servicios: [
    { id: "servicios_portfolio", name: "Portfolio", preview: "Muestra tus servicios con estilo" },
    { id: "servicios_catalog", name: "Catalogo", preview: "Lista de servicios con precios" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  lugares: [
    { id: "lugares_tour", name: "Turistico", preview: "Banner panoramico" },
    { id: "lugares_map", name: "Ubicacion", preview: "Mapa + info" },
    { id: "lugares_gallery", name: "Galeria", preview: "Grid de fotos" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  guardian: [
    { id: "guardian_safe", name: "Seguridad", preview: "Info de contacto destacada" },
    { id: "guardian_medical", name: "Medico", preview: "Info medica importante" },
    { id: "guardian_emergency", name: "Emergencia", preview: "Contactos de emergencia" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  curriculum: [
    { id: "curriculum_clean", name: "Curriculum limpio", preview: "Layout tipo hoja de vida minimalista" },
    { id: "curriculum_blocks", name: "Curriculum bloques", preview: "Secciones destacadas por bloques" },
    { id: "curriculum_card", name: "Curriculum tarjeta", preview: "Perfil compacto con detalles expandibles" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  mascotas: [
    { id: "mascotas_friend", name: "Amigo", preview: "Tarjeta tierna para tu mascota" },
    { id: "mascotas_gallery", name: "Galeria", preview: "Fotos destacadas de tu mascota" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  oferta_trabajo: [
    { id: "job_offer_pro", name: "Profesional", preview: "Oferta clara con detalles del puesto" },
    { id: "job_offer_modern", name: "Moderno", preview: "Diseno llamativo para atraer talento" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  busqueda_personal: [
    { id: "staff_search_modern", name: "Moderno", preview: "Busqueda de personal con estilo" },
    { id: "staff_search_classic", name: "Clasico", preview: "Formato tradicional de reclutamiento" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
  solicitud_servicio: [
    { id: "service_request_clean", name: "Limpio", preview: "Solicitud de servicio ordenada" },
    { id: "service_request_urgent", name: "Urgente", preview: "Destaca la urgencia del servicio" },
    { id: "edge_actions", name: "Avatar Acciones", preview: "Compartir y QR en el borde del avatar" },
    { id: "full_banner_bubble", name: "Banner burbuja", preview: "Banner dominante + info en burbuja" },
  ],
};

const TemplateSelector = ({ cardType, selectedTemplate, onChange }) => {
  const availableTemplates = templates[cardType] || templates.personal;

  const getTemplateIcon = (templateId) => {
    if (templateId === "edge_actions") return "QR";
    if (templateId === "full_banner_bubble") return "BB";
    return templateId.charAt(0).toUpperCase();
  };

  const getTemplateGradient = (templateId) => {
    if (templateId === "edge_actions") return "from-violet-500/20 to-blue-500/20";
    if (templateId === "full_banner_bubble") return "from-amber-500/20 to-rose-500/20";
    if (templateId.includes("classic") || templateId.includes("clean")) return "from-slate-500/20 to-zinc-500/20";
    if (templateId.includes("modern") || templateId.includes("pro")) return "from-blue-500/20 to-cyan-500/20";
    if (templateId.includes("minimal") || templateId.includes("friend")) return "from-green-500/20 to-emerald-500/20";
    return "from-primary/10 to-accent/10";
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Plantilla de Diseno</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {availableTemplates.map((template) => (
          <div
            key={template.id}
            className={`cursor-pointer transition-all rounded-xl border-2 p-3 hover:shadow-md ${
              selectedTemplate === template.id
                ? "border-primary shadow-lg bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
            onClick={() => onChange(template.id)}
            data-testid={`template-${template.id}`}
          >
            <div className="relative">
              {selectedTemplate === template.id && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center z-10">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div className={`aspect-[4/3] bg-gradient-to-br ${getTemplateGradient(template.id)} rounded-lg mb-2 flex items-center justify-center text-lg font-bold text-muted-foreground`}>
                {getTemplateIcon(template.id)}
              </div>
              <h4 className="font-medium text-xs text-center">{template.name}</h4>
              <p className="text-[10px] text-muted-foreground text-center mt-0.5 line-clamp-1">
                {template.preview}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TemplateSelector;
