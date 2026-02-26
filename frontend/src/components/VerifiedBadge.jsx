import React from "react";
import { Star, Crown, Shield, CheckCircle } from "lucide-react";

/**
 * VerifiedBadge Component
 * Shows verification badges for Pro and Business users
 * 
 * Props:
 * - tier: "free" | "pro" | "business"
 * - size: "xs" | "sm" | "md" | "lg"
 * - showLabel: boolean - whether to show text label
 * - className: string - additional CSS classes
 */

const TIERS = {
  free: {
    label: null,
    icon: null,
    color: null,
    bgColor: null
  },
  pro: {
    label: "PRO",
    icon: Star,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    gradient: "from-yellow-400 to-amber-500"
  },
  business: {
    label: "BUSINESS",
    icon: Crown,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    gradient: "from-purple-400 to-indigo-500"
  }
};

const SIZES = {
  xs: {
    iconSize: "w-3 h-3",
    textSize: "text-[10px]",
    padding: "px-1 py-0.5",
    badgeOnly: "w-4 h-4"
  },
  sm: {
    iconSize: "w-3.5 h-3.5",
    textSize: "text-xs",
    padding: "px-1.5 py-0.5",
    badgeOnly: "w-5 h-5"
  },
  md: {
    iconSize: "w-4 h-4",
    textSize: "text-sm",
    padding: "px-2 py-1",
    badgeOnly: "w-6 h-6"
  },
  lg: {
    iconSize: "w-5 h-5",
    textSize: "text-base",
    padding: "px-3 py-1.5",
    badgeOnly: "w-8 h-8"
  }
};

// Simple badge icon (for use in avatars, cards, etc.)
export const VerifiedIcon = ({ tier = "free", size = "sm", className = "" }) => {
  if (tier === "free" || !TIERS[tier]?.icon) return null;
  
  const tierConfig = TIERS[tier];
  const sizeConfig = SIZES[size];
  const Icon = tierConfig.icon;
  
  return (
    <div 
      className={`inline-flex items-center justify-center rounded-full ${tierConfig.bgColor} ${tierConfig.color} ${sizeConfig.badgeOnly} ${className}`}
      title={`Usuario ${tierConfig.label}`}
    >
      <Icon className={sizeConfig.iconSize} fill="currentColor" />
    </div>
  );
};

// Badge with optional label (for profiles, posts, etc.)
export const VerifiedBadge = ({ 
  tier = "free", 
  size = "sm", 
  showLabel = false,
  className = "" 
}) => {
  if (tier === "free" || !TIERS[tier]?.icon) return null;
  
  const tierConfig = TIERS[tier];
  const sizeConfig = SIZES[size];
  const Icon = tierConfig.icon;
  
  if (!showLabel) {
    return <VerifiedIcon tier={tier} size={size} className={className} />;
  }
  
  return (
    <div 
      className={`inline-flex items-center gap-1 rounded-full border ${tierConfig.bgColor} ${tierConfig.borderColor} ${tierConfig.color} ${sizeConfig.padding} ${className}`}
      title={`Usuario ${tierConfig.label}`}
    >
      <Icon className={sizeConfig.iconSize} fill="currentColor" />
      <span className={`font-bold ${sizeConfig.textSize}`}>{tierConfig.label}</span>
    </div>
  );
};

// Inline badge for usernames (smaller, inline with text)
export const InlineVerifiedBadge = ({ tier = "free", className = "" }) => {
  if (tier === "free" || !TIERS[tier]?.icon) return null;
  
  const tierConfig = TIERS[tier];
  const Icon = tierConfig.icon;
  
  return (
    <Icon 
      className={`inline-block w-4 h-4 ml-1 ${tierConfig.color} ${className}`}
      fill="currentColor"
      title={`Usuario ${tierConfig.label}`}
    />
  );
};

// Avatar wrapper with badge overlay
export const AvatarWithBadge = ({ 
  src, 
  name = "", 
  tier = "free", 
  size = "md",
  className = "" 
}) => {
  const avatarSizes = {
    xs: "w-6 h-6",
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
    xl: "w-16 h-16"
  };
  
  const badgeSizes = {
    xs: "xs",
    sm: "xs",
    md: "xs",
    lg: "sm",
    xl: "sm"
  };
  
  const badgePositions = {
    xs: "-bottom-0.5 -right-0.5",
    sm: "-bottom-0.5 -right-0.5",
    md: "-bottom-1 -right-1",
    lg: "-bottom-1 -right-1",
    xl: "-bottom-1 -right-1"
  };
  
  return (
    <div className={`relative inline-block ${className}`}>
      {src ? (
        <img 
          src={src} 
          alt={name}
          className={`${avatarSizes[size]} rounded-full object-cover border-2 border-background`}
        />
      ) : (
        <div className={`${avatarSizes[size]} rounded-full bg-primary flex items-center justify-center text-white font-bold`}>
          {(name || "?")[0].toUpperCase()}
        </div>
      )}
      
      {tier !== "free" && (
        <div className={`absolute ${badgePositions[size]}`}>
          <VerifiedIcon tier={tier} size={badgeSizes[size]} />
        </div>
      )}
    </div>
  );
};

// Subscription tier selector (for settings/upgrade pages)
export const TierSelector = ({ currentTier, onSelect }) => {
  const tiers = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      features: ["1 tarjeta digital", "QR básico", "Perfil público"]
    },
    {
      id: "pro",
      name: "Pro",
      price: "$9.99/mes",
      features: ["5 tarjetas", "Badge verificado ⭐", "NFC activado", "Analytics", "Sin marca de agua"],
      popular: true
    },
    {
      id: "business",
      name: "Business",
      price: "$29.99/mes",
      features: ["Tarjetas ilimitadas", "Badge verificado 👑", "Equipo de 10", "API access", "Soporte prioritario"]
    }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {tiers.map((tier) => {
        const isSelected = currentTier === tier.id;
        const tierConfig = TIERS[tier.id];
        
        return (
          <div
            key={tier.id}
            onClick={() => onSelect(tier.id)}
            className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all hover:shadow-lg ${
              isSelected 
                ? 'border-primary bg-primary/5' 
                : tier.popular 
                  ? 'border-yellow-500/50' 
                  : 'border-border'
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full">
                POPULAR
              </div>
            )}
            
            <div className="flex items-center gap-2 mb-2">
              {tierConfig.icon && (
                <tierConfig.icon className={`w-5 h-5 ${tierConfig.color}`} fill="currentColor" />
              )}
              <h3 className="font-bold text-lg">{tier.name}</h3>
            </div>
            
            <div className="text-2xl font-bold text-primary mb-3">{tier.price}</div>
            
            <ul className="space-y-2">
              {tier.features.map((feature, idx) => (
                <li key={idx} className="text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
            
            {isSelected && (
              <div className="mt-4 text-center text-sm font-medium text-primary">
                Plan actual
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default VerifiedBadge;
