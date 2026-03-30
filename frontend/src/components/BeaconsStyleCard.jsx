import React from "react";
import { Link } from "react-router-dom";
import SocialLinkButton from "@/components/SocialLinkButton";
import VerifiedBadge from "@/components/VerifiedBadge";
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
  const bg = card.background_color || "#FF5A00";
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
      className="relative rounded-3xl overflow-hidden shadow-xl"
      style={{ backgroundColor: bg }}
      data-testid={`beacons-card-${card.id}`}
    >
      {/* Background */}
      {card.banner_url ? (
        <div className="absolute inset-0 overflow-hidden">
          <img src={card.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${bg}ee, ${bg})` }} />
      )}

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

      {/* Content */}
      <div className="relative z-10 px-5 pt-6 pb-5 flex flex-col items-center" style={{ color: fg }}>
        {/* Avatar Bubble */}
        <div className="relative mb-3">
          <div className="w-22 h-22 sm:w-24 sm:h-24 rounded-full overflow-hidden border-[3px] shadow-2xl" style={{ borderColor: `${fg}40` }}>
            {card.avatar_url ? (
              <img src={card.avatar_url} alt={card.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ backgroundColor: `${fg}15` }}>
                {card.title?.charAt(0) || "?"}
              </div>
            )}
          </div>
          {card.is_verified && (
            <div className="absolute -bottom-0.5 -right-0.5">
              <VerifiedBadge size="md" />
            </div>
          )}
        </div>

        {/* Name & subtitle */}
        <h2 className="text-lg sm:text-xl font-bold text-center leading-tight mb-0.5">{card.title}</h2>
        {card.subtitle && (
          <p className="text-xs sm:text-sm opacity-80 text-center mb-2 max-w-[240px]">{card.subtitle}</p>
        )}

        {/* Social Links */}
        {card.social_links && card.social_links.length > 0 && (
          <div className="flex justify-center gap-1.5 my-2.5">
            {card.social_links.slice(0, 6).map((link, i) => (
              <SocialLinkButton 
                key={i} link={link} size="sm" onlyIcon 
                className="!w-8 !h-8 !rounded-full !bg-white/15 hover:!bg-white/30 !text-current backdrop-blur-sm"
              />
            ))}
          </div>
        )}

        {/* Contact Info Bubbles */}
        {card.contact_info && (
          <div className="flex flex-wrap justify-center gap-1.5 my-2">
            {card.contact_info.phone && (
              <a href={`tel:${card.contact_info.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs hover:bg-white/25 transition-colors">
                <Phone className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{card.contact_info.phone}</span>
              </a>
            )}
            {card.contact_info.email && (
              <a href={`mailto:${card.contact_info.email}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs hover:bg-white/25 transition-colors">
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{card.contact_info.email}</span>
              </a>
            )}
            {card.contact_info.website && (
              <a href={card.contact_info.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-xs hover:bg-white/25 transition-colors">
                <Globe className="w-3 h-3" />
                <span>Web</span>
              </a>
            )}
          </div>
        )}

        {/* Job Card Details */}
        {isJobCard && (
          <div className="w-full mt-3 space-y-2">
            {formatSalary() && (
              <div className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl bg-white/15 backdrop-blur-sm text-sm font-semibold">
                <DollarSign className="w-4 h-4" />
                <span>{formatSalary()}</span>
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-1.5">
              {jobDetails.contract_type && (
                <span className="px-2.5 py-1 rounded-full bg-white/12 text-[11px]">
                  {jobDetails.contract_type === "full-time" ? "Tiempo Completo" : 
                   jobDetails.contract_type === "part-time" ? "Medio Tiempo" :
                   jobDetails.contract_type === "freelance" ? "Freelance" :
                   jobDetails.contract_type === "temporary" ? "Temporal" : "Pasantia"}
                </span>
              )}
              {jobDetails.remote_option && (
                <span className="px-2.5 py-1 rounded-full bg-white/12 text-[11px]">
                  {jobDetails.remote_option === "remote" ? "Remoto" : 
                   jobDetails.remote_option === "hybrid" ? "Hibrido" : "Presencial"}
                </span>
              )}
              {jobDetails.experience_required && (
                <span className="px-2.5 py-1 rounded-full bg-white/12 text-[11px]">
                  {jobDetails.experience_required === "entry" ? "Sin experiencia" :
                   jobDetails.experience_required === "junior" ? "1-2 anos" :
                   jobDetails.experience_required === "mid" ? "3-5 anos" :
                   jobDetails.experience_required === "senior" ? "5+ anos" : "10+ anos"}
                </span>
              )}
            </div>
            {card.card_type === "busqueda_personal" && jobDetails.vacancies > 1 && (
              <div className="flex items-center justify-center gap-1 text-xs opacity-80">
                <Users className="w-3.5 h-3.5" /> {jobDetails.vacancies} vacantes
              </div>
            )}
            {jobDetails.application_deadline && (
              <div className="flex items-center justify-center gap-1 text-[10px] opacity-60">
                <Clock className="w-3 h-3" /> Hasta: {new Date(jobDetails.application_deadline).toLocaleDateString("es-ES")}
              </div>
            )}
            {jobDetails.requirements?.length > 0 && (
              <div className="bg-white/10 rounded-2xl p-3 text-left">
                <p className="text-[10px] font-semibold opacity-70 mb-1.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Requisitos
                </p>
                <ul className="space-y-0.5">
                  {jobDetails.requirements.slice(0, 3).map((req, i) => (
                    <li key={i} className="text-[11px] opacity-80 flex items-start gap-1">
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

        {/* Description (non-job) */}
        {card.description && !isJobCard && (
          <p className="text-xs opacity-70 text-center mt-1.5 line-clamp-2 max-w-[260px] leading-relaxed">{card.description}</p>
        )}

        {/* Location */}
        {card.location && (
          <div className="flex items-center justify-center gap-1 mt-2 text-[11px] opacity-60">
            <MapPin className="w-3 h-3" />
            <span>{card.location.city || card.location.address}</span>
          </div>
        )}

        {/* Gallery preview */}
        {card.gallery_photos?.length > 0 && (
          <div className="flex gap-1.5 mt-3 justify-center">
            {card.gallery_photos.slice(0, 3).map((p, i) => (
              <div key={i} className="w-14 h-14 rounded-xl overflow-hidden">
                <img src={p} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
            {card.gallery_photos.length > 3 && (
              <div className="w-14 h-14 rounded-xl bg-white/15 flex items-center justify-center text-xs font-bold">
                +{card.gallery_photos.length - 3}
              </div>
            )}
          </div>
        )}

        {/* CTA Button */}
        {showActions && (
          <Link to={`/c/${card.id}`} className="mt-4 w-full block" onClick={onActionClick}>
            <button className="w-full py-3 rounded-2xl bg-white/90 hover:bg-white text-gray-900 font-semibold text-sm transition-all hover:shadow-lg flex items-center justify-center gap-2 active:scale-[0.98]">
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
