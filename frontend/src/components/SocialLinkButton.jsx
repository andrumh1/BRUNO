import React from "react";
import { 
  Globe, 
  Mail, 
  Phone, 
  MapPin,
  Linkedin,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  MessageCircle,
  Music,
  Link
} from "lucide-react";

// Mapeo de tipos de redes sociales a iconos y colores
export const socialMediaConfig = {
  instagram: {
    icon: Instagram,
    color: "#E4405F",
    label: "Instagram"
  },
  facebook: {
    icon: Facebook,
    color: "#1877F2",
    label: "Facebook"
  },
  linkedin: {
    icon: Linkedin,
    color: "#0A66C2",
    label: "LinkedIn"
  },
  twitter: {
    icon: Twitter,
    color: "#1DA1F2",
    label: "Twitter / X"
  },
  tiktok: {
    icon: Music,
    color: "#000000",
    label: "TikTok"
  },
  youtube: {
    icon: Youtube,
    color: "#FF0000",
    label: "YouTube"
  },
  whatsapp: {
    icon: MessageCircle,
    color: "#25D366",
    label: "WhatsApp"
  },
  email: {
    icon: Mail,
    color: "#EA4335",
    label: "Email"
  },
  phone: {
    icon: Phone,
    color: "#34A853",
    label: "Teléfono"
  },
  website: {
    icon: Globe,
    color: "#FF6B35",
    label: "Sitio Web"
  },
  location: {
    icon: MapPin,
    color: "#FBBC04",
    label: "Ubicación"
  },
  custom: {
    icon: Link,
    color: "#6B7280",
    label: "Enlace"
  }
};

export const getSocialIcon = (type) => {
  const config = socialMediaConfig[type] || socialMediaConfig.custom;
  return config.icon;
};

export const getSocialColor = (type) => {
  const config = socialMediaConfig[type] || socialMediaConfig.custom;
  return config.color;
};

export const getSocialLabel = (type) => {
  const config = socialMediaConfig[type] || socialMediaConfig.custom;
  return config.label;
};

const SocialLinkButton = ({ link, size = "default", theme = "light", onlyIcon = false }) => {
  const Icon = getSocialIcon(link.type);
  const color = getSocialColor(link.type);
  
  const sizeClasses = {
    sm: onlyIcon ? "w-10 h-10" : "px-3 py-2 text-sm",
    default: onlyIcon ? "w-12 h-12" : "px-4 py-2.5",
    lg: onlyIcon ? "w-14 h-14" : "px-5 py-3 text-lg"
  };
  
  const handleClick = () => {
    let url = link.url;
    
    // Handle special cases
    if (link.type === "email" && !url.startsWith("mailto:")) {
      url = `mailto:${url}`;
    } else if (link.type === "phone" && !url.startsWith("tel:")) {
      url = `tel:${url}`;
    } else if (link.type === "whatsapp") {
      // Format WhatsApp URL
      const phone = url.replace(/\D/g, "");
      url = `https://wa.me/${phone}`;
    } else if (!url.startsWith("http") && !url.startsWith("mailto:") && !url.startsWith("tel:")) {
      url = `https://${url}`;
    }
    
    window.open(url, "_blank", "noopener,noreferrer");
  };
  
  if (onlyIcon) {
    return (
      <button
        onClick={handleClick}
        className={`${sizeClasses[size]} rounded-full backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110 hover:shadow-lg`}
        style={{ 
          backgroundColor: theme === "light" ? `${color}20` : `${color}30`,
          color: theme === "light" ? color : "#fff"
        }}
        title={link.label}
      >
        <Icon className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <button
      onClick={handleClick}
      className={`${sizeClasses[size]} rounded-lg backdrop-blur-sm flex items-center gap-2 transition-all hover:scale-105 hover:shadow-lg font-medium`}
      style={{ 
        backgroundColor: theme === "light" ? `${color}20` : `${color}30`,
        color: theme === "light" ? color : "#fff"
      }}
    >
      <Icon className="w-5 h-5" />
      {link.label}
    </button>
  );
};

export default SocialLinkButton;
