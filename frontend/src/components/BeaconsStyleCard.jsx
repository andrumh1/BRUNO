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
  CheckCircle2
} from "lucide-react";

/**
 * BeaconsStyleCard - Modern profile card inspired by Beacons.ai / Linktree
 * Features:
 * - Full-screen background image support
 * - Rounded avatar with border
 * - Social media icons row
 * - Action buttons with bubble style
 * - Support for job/service cards with specific fields
 */
const BeaconsStyleCard = ({ 
  card, 
  variant = "default", // "default", "compact", "job"
  showActions = true,
  onActionClick = null
}) => {
  if (!card) return null;

  const isJobCard = ["oferta_trabajo", "busqueda_personal", "solicitud_servicio"].includes(card.card_type);
  const jobDetails = card.custom_fields?.job_details || {};

  // Get urgency badge style
  const getUrgencyBadge = (urgency) => {
    switch (urgency) {
      case "urgent":
        return { bg: "bg-red-500", text: "Urgente", icon: "🔴" };
      case "low":
        return { bg: "bg-green-500", text: "Flexible", icon: "🟢" };
      default:
        return { bg: "bg-yellow-500", text: "Normal", icon: "🟡" };
    }
  };

  // Get card type icon
  const getCardTypeIcon = (type) => {
    switch (type) {
      case "oferta_trabajo":
        return <Briefcase className="w-4 h-4" />;
      case "busqueda_personal":
        return <Users className="w-4 h-4" />;
      case "solicitud_servicio":
        return <HandHelping className="w-4 h-4" />;
      default:
        return null;
    }
  };

  // Get card type label
  const getCardTypeLabel = (type) => {
    const labels = {
      personal: "Personal",
      empresarial: "Empresa",
      negocio: "Negocio",
      servicios: "Servicios",
      lugares: "Lugar",
      guardian: "Guardian",
      curriculum: "Curriculum",
      mascotas: "Mascota",
      oferta_trabajo: "Oferta de Trabajo",
      busqueda_personal: "Búsqueda de Personal",
      solicitud_servicio: "Solicitud de Servicio"
    };
    return labels[type] || type;
  };

  // Format salary range
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
      className="beacons-card relative overflow-hidden rounded-3xl shadow-xl"
      style={{
        backgroundColor: card.background_color || "#FF5A00",
      }}
      data-testid={`beacons-card-${card.id}`}
    >
      {/* Background image */}
      {card.banner_url ? (
        <div className="absolute inset-0">
          <img src={card.banner_url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-black/70" />
        </div>
      ) : (
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${card.background_color || "#FF5A00"}, ${card.background_color || "#FF5A00"}dd)` }} />
      )}
      {/* Card Type Badge */}
      <div className="relative z-10 absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-xs font-medium text-gray-800">
        {getCardTypeIcon(card.card_type)}
        <span>{getCardTypeLabel(card.card_type)}</span>
      </div>

      {/* Urgency Badge for job cards */}
      {isJobCard && jobDetails.urgency && (
        <div className={`relative z-10 absolute top-3 right-3 px-2.5 py-1 rounded-full ${getUrgencyBadge(jobDetails.urgency).bg} text-white text-xs font-medium flex items-center gap-1`}>
          <span>{getUrgencyBadge(jobDetails.urgency).icon}</span>
          <span>{getUrgencyBadge(jobDetails.urgency).text}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-10 p-6 pt-14 text-center" style={{ color: card.text_color || "#FFFFFF" }}>
        {/* Avatar */}
        <div className="relative inline-block mb-4">
          {card.avatar_url ? (
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-4 border-white/80 shadow-lg">
              <img 
                src={card.avatar_url} 
                alt={card.title}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center text-3xl font-bold border-4 border-white/80 shadow-lg"
              style={{ backgroundColor: `${card.text_color}20` }}
            >
              {card.title?.charAt(0) || "?"}
            </div>
          )}
          {card.is_verified && (
            <div className="absolute -bottom-1 -right-1">
              <VerifiedBadge size="md" />
            </div>
          )}
        </div>

        {/* Name */}
        <h2 className="text-xl font-bold mb-1">{card.title}</h2>
        
        {/* Subtitle */}
        {card.subtitle && (
          <p className="text-sm opacity-80 mb-2">{card.subtitle}</p>
        )}

        {/* Social Links Row */}
        {card.social_links && card.social_links.length > 0 && (
          <div className="flex justify-center gap-2 my-3">
            {card.social_links.slice(0, 6).map((link, index) => (
              <SocialLinkButton 
                key={index} 
                link={link} 
                size="sm" 
                onlyIcon 
                className="!w-8 !h-8 !bg-white/20 hover:!bg-white/30 !text-current"
              />
            ))}
          </div>
        )}

        {/* Job Card Specific Info */}
        {isJobCard && (
          <div className="mt-4 space-y-2">
            {/* Salary */}
            {formatSalary() && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm">
                <DollarSign className="w-4 h-4" />
                <span>{formatSalary()}</span>
              </div>
            )}

            {/* Contract Type & Remote */}
            <div className="flex flex-wrap justify-center gap-2">
              {jobDetails.contract_type && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs">
                  {jobDetails.contract_type === "full-time" && "Tiempo Completo"}
                  {jobDetails.contract_type === "part-time" && "Medio Tiempo"}
                  {jobDetails.contract_type === "freelance" && "Freelance"}
                  {jobDetails.contract_type === "temporary" && "Temporal"}
                  {jobDetails.contract_type === "internship" && "Pasantía"}
                </span>
              )}
              {jobDetails.remote_option && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs">
                  {jobDetails.remote_option === "remote" && "100% Remoto"}
                  {jobDetails.remote_option === "hybrid" && "Híbrido"}
                  {jobDetails.remote_option === "on-site" && "Presencial"}
                </span>
              )}
              {jobDetails.experience_required && (
                <span className="px-2.5 py-1 rounded-full bg-white/15 text-xs">
                  {jobDetails.experience_required === "entry" && "Sin experiencia"}
                  {jobDetails.experience_required === "junior" && "1-2 años"}
                  {jobDetails.experience_required === "mid" && "3-5 años"}
                  {jobDetails.experience_required === "senior" && "5+ años"}
                  {jobDetails.experience_required === "expert" && "10+ años"}
                </span>
              )}
            </div>

            {/* Vacancies */}
            {card.card_type === "busqueda_personal" && jobDetails.vacancies > 1 && (
              <div className="flex items-center justify-center gap-1 text-sm opacity-80">
                <Users className="w-4 h-4" />
                <span>{jobDetails.vacancies} vacantes</span>
              </div>
            )}

            {/* Application Deadline */}
            {jobDetails.application_deadline && (
              <div className="flex items-center justify-center gap-1 text-xs opacity-70">
                <Clock className="w-3 h-3" />
                <span>Hasta: {new Date(jobDetails.application_deadline).toLocaleDateString("es-ES")}</span>
              </div>
            )}

            {/* Requirements Preview */}
            {jobDetails.requirements && jobDetails.requirements.length > 0 && (
              <div className="mt-3 text-left bg-white/10 rounded-xl p-3">
                <div className="flex items-center gap-1 text-xs font-semibold mb-2 opacity-80">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Requisitos</span>
                </div>
                <ul className="space-y-1">
                  {jobDetails.requirements.slice(0, 3).map((req, index) => (
                    <li key={index} className="text-xs opacity-80 flex items-start gap-1">
                      <span className="text-primary mt-0.5">•</span>
                      <span className="line-clamp-1">{req}</span>
                    </li>
                  ))}
                  {jobDetails.requirements.length > 3 && (
                    <li className="text-xs opacity-60">+{jobDetails.requirements.length - 3} más...</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {card.description && !isJobCard && (
          <p className="text-sm opacity-75 mt-2 line-clamp-2">{card.description}</p>
        )}

        {/* Location */}
        {card.location && (
          <div className="flex items-center justify-center gap-1 mt-3 text-xs opacity-70">
            <MapPin className="w-3 h-3" />
            <span>{card.location.city || card.location.address}</span>
          </div>
        )}

        {/* Action Button - Beacons Style */}
        {showActions && (
          <Link 
            to={`/c/${card.id}`}
            className="mt-4 block"
            onClick={onActionClick}
          >
            <button className="w-full py-3 px-6 rounded-full bg-white/90 hover:bg-white text-gray-900 font-semibold text-sm transition-all hover:shadow-lg flex items-center justify-center gap-2">
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
