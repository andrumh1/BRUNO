import React from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LanguageSwitcher = ({ variant = "default", showLabel = false }) => {
  const { language, toggleLanguage } = useLanguage();

  if (variant === "minimal") {
    return (
      <button
        onClick={toggleLanguage}
        className="px-2 py-1 text-xs font-medium rounded-md bg-muted hover:bg-muted/80 transition-colors"
        title={language === "es" ? "Switch to English" : "Cambiar a Español"}
      >
        {language === "es" ? "EN" : "ES"}
      </button>
    );
  }

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleLanguage}
        title={language === "es" ? "Switch to English" : "Cambiar a Español"}
      >
        <Globe className="w-5 h-5" />
        <span className="sr-only">{language === "es" ? "EN" : "ES"}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2"
    >
      <Globe className="w-4 h-4" />
      {showLabel ? (
        <span>{language === "es" ? "English" : "Español"}</span>
      ) : (
        <span className="font-medium">{language === "es" ? "EN" : "ES"}</span>
      )}
    </Button>
  );
};

export default LanguageSwitcher;
