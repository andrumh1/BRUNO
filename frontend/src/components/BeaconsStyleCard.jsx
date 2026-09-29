import React from "react";
import { Link } from "react-router-dom";
import SocialLinkButton from "@/components/SocialLinkButton";
import VerifiedBadge from "@/components/VerifiedBadge";
import BannerCarousel from "@/components/bruno/BannerCarousel";
import { 
  ExternalLink, 
  MapPin, 
  Briefcase, 
  Users, 
  HandHelping,
  DollarSign,
  Clock,
  CheckCircle2,
  Phone,
  Mail,
  Globe
} from "lucide-react";

const BeaconsStyleCard = ({ 
  card, 
  variant = "default",
  showActions = true,
  onActionClick = null
}) => {
  if (!card) return null;

  const isJobCard = ["oferta_trabajo", "busqueda_personal", "solicitud_servicio"].includes(card.card_type);
  const jobDetails = card.custom_fields?.job_details || {};
  const bg = card.background_color || "#FF6A00";
  const fg = card.text_color || "#FFFFFF";

  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case "urgent": return { bg: "bg-red-500", text: "Urgente" };
      case "low": return { bg: "bg-green-500", text: "Flexible" };
      default: return { bg: "bg-yellow-500", text: "Normal" };
    }
  };

  const getCardTypeLabel = (type) => {
    const labels = {
      personal: "Personal", empresarial: "Empresa", negocio: "Negocio",
      servicios: "Servicios", lugares: "Lugar", guardian: "Guardian",
      curriculum: "CV", mascotas: "Mascota", oferta_trabajo: "Oferta de Trabajo",
      busqueda_personal: "Busqueda de Personal", solicitud_servicio: "Solicitud de Servicio"
    };
    return labels[type] || type;
  };

  const getCardTypeIcon = (type) => {
    switch (type) {
      case "oferta_trabajo": return <Briefcase className="w-3.5 h-3.5" />;
      case "busqueda_personal": return <Users className="w-3.5 h-3.5" />;
      case "solicitud_servicio": return <HandHelping className="w-3.5 h-3.5" />;
      default: return null;
    }
  };

  const formatSalary = () => {
    if (!jobDetails.salary_min && !jobDetails.salary_max) return null;
    const currency = jobDetails.salary_currency || "USD";
    const min = jobDetails.salary_min ? `${currency} ${Number(jobDetails.salary_min).toLocaleString()}` : "";
    const max = jobDetails.salary_max ? `${currency} ${Number(jobDetails.salary_max).toLocaleString()}` : "";
    if (min && max) return `${min} - ${max}`;
    return min || max;
  };

  return (
    <div 
      className="relative rounded-3xl overflow-hidden shadow-xl isolate"
      style={{ backgroundColor: bg }}
      data-testid={`beacons-card-${card.id}`}
    >
      {/* Background — multi-image carousel from banner_url + gallery_photos */}
      {(() => {
        const slides = [card.banner_url, ...(Array.isArray(card.gallery_photos) ? card.gallery_photos : [])]
          .filter(Boolean)
          .filter((url, i, arr) => arr.indexOf(url) === i);
        if (slides.length === 0) {
          return (
            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${bg}ee, ${bg})` }} />
          );
        }
        return (
          <div className="absolute inset-0 overflow-hidden rounded-3xl">
            <BannerCarousel
              images={slides}
              height="h-full"
              overlay={<div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80 z-10 pointer-events-none" />}
              testIdPrefix={`beacons-banner-${card.id}`}
            />
          </div>
        );
      })()}

      {/* Top badges */}
      <div className="relative z-10 flex items-center justify-between px-4 pt-4">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-[11px] font-semibold text-gray-800 shadow-sm">
          {getCardTypeIcon(card.card_type)}
          <span>{getCardTypeLabel(card.card_type)}</span>
        </div>
        {isJobCard && jobDetails.urgency && (
          <div className={`px-2.5 py-1 rounded-full ${getUrgencyBadge(jobDetails.urgency).bg} text-white text-[11px] font-semibold shadow-sm`}>
            {getUrgencyBadge(jobDetails.urgency).text}
          </div>
        )}
      </div>

      {/* Content - Bubble Layout */}
      <div className="relative z-10 px-4 pt-5 pb-4" style={{ color: fg }}>
        {/* Header bubble: Avatar + Name */}
        <div className="flex items-center gap-3 p-3 rounded-2xl mb-2.5" style={{ backgroundColor: `${fg}10`, backdropFilter: "blur(8px)" }}>
          <div className="relative shrink-0">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 shadow-lg" style={{ borderColor: `${fg}30` }}>
              {card.avatar_url ? (
                <img src={card.avatar_url} alt={card.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ backgroundColor: `${fg}15` }}>
                  {card.title?.charAt(0) || "?"}
                </div>
              )}
            </div>
            {card.is_verified && (
              <div className="absolute -bottom-0.5 -right-0.5">
                <VerifiedBadge size="sm" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold leading-tight truncate">{card.title}</h2>
            {card.subtitle && (
              <p className="text-xs opacity-75 truncate mt-0.5">{card.subtitle}</p>
            )}
          </div>
        </div>

        {/* Description bubble */}
        {card.description && !isJobCard && (
          <div className="p-2.5 rounded-xl mb-2.5 text-xs opacity-80 leading-relaxed line-clamp-2" style={{ backgroundColor: `${fg}08` }}>
            {card.description}
          </div>
        )}

        {/* Contact bubbles row */}
        {card.contact_info && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {card.contact_info.phone && (
              <a href={`tel:${card.contact_info.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs hover:scale-[1.03] transition-transform" style={{ backgroundColor: `${fg}12` }}>
                <Phone className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[110px]">{card.contact_info.phone}</span>
              </a>
            )}
            {card.contact_info.email && (
              <a href={`mailto:${card.contact_info.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs hover:scale-[1.03] transition-transform" style={{ backgroundColor: `${fg}12` }}>
                <Mail className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[110px]">{card.contact_info.email}</span>
              </a>
            )}
            {card.contact_info.website && (
              <a href={card.contact_info.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs hover:scale-[1.03] transition-transform" style={{ backgroundColor: `${fg}12` }}>
                <Globe className="w-3 h-3 shrink-0" />
                <span>Web</span>
              </a>
            )}
          </div>
        )}

        {/* Social Links bubble */}
        {card.social_links && card.social_links.length > 0 && (
          <div className="flex justify-start gap-1.5 mb-2.5">
            {card.social_links.slice(0, 6).map((link, i) => (
              <SocialLinkButton 
                key={`link-${i}`} link={link} size="sm" onlyIcon 
                className="!w-8 !h-8 !rounded-full !bg-white/15 hover:!bg-white/30 !text-current backdrop-blur-sm"
              />
            ))}
          </div>
        )}

        {/* Job Card Details - distributed bubbles */}
        {isJobCard && (
          <div className="space-y-2">
            {/* Salary bubble - prominent */}
            {formatSalary() && (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold" style={{ backgroundColor: `${fg}15` }}>
                <DollarSign className="w-4 h-4" />
                <span>{formatSalary()}</span>
              </div>
            )}

            {/* Tags row */}
            <div className="flex flex-wrap gap-1.5">
              {jobDetails.contract_type && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${fg}12` }}>
                  {jobDetails.contract_type === "full-time" ? "Tiempo Completo" : 
                   jobDetails.contract_type === "part-time" ? "Medio Tiempo" :
                   jobDetails.contract_type === "freelance" ? "Freelance" :
                   jobDetails.contract_type === "temporary" ? "Temporal" : "Pasantia"}
                </span>
              )}
              {jobDetails.remote_option && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${fg}12` }}>
                  {jobDetails.remote_option === "remote" ? "Remoto" : 
                   jobDetails.remote_option === "hybrid" ? "Hibrido" : "Presencial"}
                </span>
              )}
              {jobDetails.experience_required && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: `${fg}12` }}>
                  {jobDetails.experience_required === "entry" ? "Sin experiencia" :
                   jobDetails.experience_required === "junior" ? "1-2 anos" :
                   jobDetails.experience_required === "mid" ? "3-5 anos" :
                   jobDetails.experience_required === "senior" ? "5+ anos" : "10+ anos"}
                </span>
              )}
            </div>

            {/* Vacancies + deadline */}
            <div className="flex flex-wrap gap-2">
              {card.card_type === "busqueda_personal" && jobDetails.vacancies > 1 && (
                <div className="flex items-center gap-1 text-xs opacity-80 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${fg}08` }}>
                  <Users className="w-3.5 h-3.5" /> {jobDetails.vacancies} vacantes
                </div>
              )}
              {jobDetails.application_deadline && (
                <div className="flex items-center gap-1 text-[10px] opacity-60 px-2.5 py-1 rounded-full" style={{ backgroundColor: `${fg}08` }}>
                  <Clock className="w-3 h-3" /> Hasta: {new Date(jobDetails.application_deadline).toLocaleDateString("es-ES")}
                </div>
              )}
            </div>

            {/* Requirements bubble */}
            {jobDetails.requirements?.length > 0 && (
              <div className="rounded-2xl p-3 text-left" style={{ backgroundColor: `${fg}10` }}>
                <p className="text-[10px] font-semibold opacity-70 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Requisitos
                </p>
                <ul className="space-y-0.5">
                  {jobDetails.requirements.slice(0, 3).map((req, i) => (
                    <li key={`req-${i}`} className="text-[11px] opacity-80 flex items-start gap-1">
                      <span className="mt-0.5 shrink-0">-</span>
                      <span className="line-clamp-1">{req}</span>
                    </li>
                  ))}
                  {jobDetails.requirements.length > 3 && (
                    <li className="text-[10px] opacity-50">+{jobDetails.requirements.length - 3} mas...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Location bubble */}
        {card.location && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] opacity-70 px-3 py-1.5 rounded-full w-fit" style={{ backgroundColor: `${fg}08` }}>
            <MapPin className="w-3 h-3" />
            <span>{card.location.city || card.location.address}</span>
          </div>
        )}

        {/* Gallery preview bubbles */}
        {card.gallery_photos?.length > 0 && (
          <div className="flex gap-1.5 mt-2.5">
            {card.gallery_photos.slice(0, 3).map((p, i) => (
              <div key={`p-${i}`} className="w-14 h-14 rounded-xl overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {card.gallery_photos.length > 3 && (
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xs font-bold" style={{ backgroundColor: `${fg}15` }}>
                +{card.gallery_photos.length - 3}
              </div>
            )}
          </div>
        )}

        {/* CTA Button */}
        {showActions && (
          <Link to={`/c/${card.id}`} className="mt-3 block" onClick={onActionClick}>
            <button className="w-full py-2.5 rounded-2xl bg-white/90 hover:bg-white text-gray-900 font-semibold text-sm transition-all hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]" data-testid={`view-card-btn-${card.id}`}>
              <span>{isJobCard ? "Ver Detalles" : "Ver Perfil"}</span>
              <ExternalLink className="w-4 h-4" />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default BeaconsStyleCard;
