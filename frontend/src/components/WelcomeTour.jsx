import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles,
  User,
  Check,
  CreditCard,
  Palette,
  Nfc
} from "lucide-react";
import { SCENES } from "@/components/tour/TourScenes";

// Guided tour (shown ONCE to new users): from completing the profile to the first Digital Business Card
const TOUR_STEPS = [
  {
    id: "welcome",
    title: "¡Bienvenido a BRUNO!",
    message: "En 4 pasos crearás tu Digital Business Card: tu perfil, tu tarjeta, tu estilo y cómo compartirla con un toque. ¿Empezamos?",
    icon: Sparkles,
    color: "from-orange-500 to-yellow-500",
    position: "center",
    scene: "welcome",
  },
  {
    id: "profile",
    title: "1 · Completa tu perfil",
    message: "Sube tu foto y escribe tu nombre, profesión y empresa. Esta información se usa como base para tu tarjeta. Pulsa Guardar cuando termines.",
    icon: User,
    color: "from-blue-500 to-cyan-500",
    target: "/edit-profile",
    highlight: "[data-testid='edit-profile-save']",
    scene: "profile",
  },
  {
    id: "card",
    title: "2 · Crea tu tarjeta",
    message: "Elige el tipo de tarjeta (personal, negocio, profesional…), escribe un título y un subtítulo y añade teléfono, email y sitio web.",
    icon: CreditCard,
    color: "from-primary to-orange-400",
    target: "/cards/new",
    scene: "card",
  },
  {
    id: "customize",
    title: "3 · Dale tu estilo",
    message: "Colores, plantilla, redes sociales, galería y ubicación. Tu tarjeta se ve igual de bien en cualquier teléfono.",
    icon: Palette,
    color: "from-violet-500 to-fuchsia-500",
    target: "/cards/new",
    scene: "customize",
  },
  {
    id: "share",
    title: "4 · Compártela con un toque",
    message: "Acerca tu teléfono a otro (Android o iPhone) para transferir la tarjeta por NFC, muéstrala como QR o pégala en un tag PIUP. Quien la recibe la guarda en su BRUNO.",
    icon: Nfc,
    color: "from-emerald-500 to-teal-500",
    position: "center",
    scene: "share",
  },
  {
    id: "complete",
    title: "¡Todo listo!",
    message: "Ya sabes cómo funciona. Crea tu primera tarjeta ahora, te toma menos de 2 minutos.",
    icon: Check,
    color: "from-green-500 to-emerald-500",
    position: "center",
    scene: "done",
    actions: [
      { label: "Crear mi primera tarjeta", path: "/cards/new", primary: true },
      { label: "Completar mi perfil primero", path: "/edit-profile" },
      { label: "Explorar la app", path: "/reels" }
    ]
  }
];

// Tour Context
const TourContext = React.createContext(null);

export const useTour = () => {
  const context = React.useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
};

export const TourProvider = ({ children }) => {
  const { user } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(false);

  // Check if user has completed tour
  useEffect(() => {
    if (user) {
      const completed = localStorage.getItem(`bruno_tour_completed_${user.id}`);
      setHasCompletedTour(!!completed);
      
      // Show tour for new users
      const isNewUser = !completed && user.created_at;
      const userCreatedAt = new Date(user.created_at);
      const now = new Date();
      const hoursSinceCreation = (now - userCreatedAt) / (1000 * 60 * 60);
      
      // Auto-show tour if user was created less than 1 hour ago
      if (isNewUser && hoursSinceCreation < 24) {
        setTimeout(() => setIsActive(true), 1000);
      }
    }
  }, [user]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback((_completed = false) => {
    setIsActive(false);
    if (user) {
      localStorage.setItem(`bruno_tour_completed_${user.id}`, "true");
      setHasCompletedTour(true);
    }
  }, [user]);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      endTour(true);
    }
  }, [currentStep, endTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const value = {
    isActive,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    step: TOUR_STEPS[currentStep],
    hasCompletedTour,
    startTour,
    endTour,
    nextStep,
    prevStep
  };

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  );
};

// Tour Overlay Component
export const TourOverlay = () => {
  const navigate = useNavigate();
  const { isActive, currentStep, totalSteps, step, endTour, nextStep, prevStep } = useTour();
  const [spot, setSpot] = useState(null);

  // Interactive: each step navigates to its screen and spotlights its nav button
  useEffect(() => {
    if (!isActive || !step) return undefined;
    if (step.target) navigate(step.target);
    setSpot(null);
    if (!step.highlight) return undefined;
    let tries = 0;
    const find = () => {
      const el = document.querySelector(step.highlight);
      if (el) { const r = el.getBoundingClientRect(); if (r.width) { setSpot({ x: r.left, y: r.top, w: r.width, h: r.height }); return; } }
      if (tries++ < 20) setTimeout(find, 150);
    };
    const t = setTimeout(find, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, currentStep]);

  if (!isActive || !step) return null;

  const Icon = step.icon;
  const progress = ((currentStep + 1) / totalSteps) * 100;
  const anchorTop = !!step.highlight;

  const handleAction = (action) => {
    endTour(true);
    navigate(action.path);
  };

  return (
    <div className={`fixed inset-0 z-[10500] flex justify-center p-4 ${anchorTop ? "items-start pt-[max(1rem,env(safe-area-inset-top))]" : "items-center"}`} data-testid="tour-overlay">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        onClick={() => endTour(false)}
      />

      {/* Spotlight ring over the highlighted nav button */}
      {spot && (
        <div
          className="absolute pointer-events-none rounded-2xl ring-4 ring-primary animate-pulse"
          style={{ left: spot.x - 8, top: spot.y - 8, width: spot.w + 16, height: spot.h + 16, boxShadow: "0 0 0 9999px rgba(0,0,0,0.0), 0 0 30px 6px rgba(255,106,0,.55)" }}
          data-testid="tour-spotlight"
        />
      )}
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300" data-testid={`tour-step-${step.id}`}>
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div 
            className="h-full bg-gradient-to-r from-primary to-orange-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Close button */}
        <button
          onClick={() => endTour(false)}
          data-testid="tour-close-btn"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className={`${anchorTop ? "p-5 pt-7" : "p-6 pt-8"}`}>
          {/* Animated scene */}
          {step.scene && SCENES[step.scene] ? (
            <div className={`${anchorTop ? "mb-3" : "mb-5"}`} data-testid={`tour-scene-${step.scene}`}>
              {React.createElement(SCENES[step.scene])}
            </div>
          ) : (
          <div className={`flex items-center justify-center gap-4 ${anchorTop ? "mb-4" : "mb-6"}`}>
            {step.mascot && (
              <img src={step.mascot} alt="BRUNO Mascot" className={`${anchorTop ? "w-14 h-14" : "w-20 h-20"} object-contain rounded-2xl`} />
            )}
            <div className={`${anchorTop ? "w-12 h-12" : "w-16 h-16"} rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
              <Icon className={`${anchorTop ? "w-6 h-6" : "w-8 h-8"} text-white`} />
            </div>
          </div>
          )}

          {/* Text */}
          <h2 className={`${anchorTop ? "text-xl" : "text-2xl"} font-bold text-center mb-2`}>{step.title}</h2>
          <p className={`text-muted-foreground text-center leading-relaxed ${anchorTop ? "text-sm mb-4" : "mb-6"}`}>
            {step.message}
          </p>

          {/* Step indicator */}
          <div className="flex justify-center gap-1.5 mb-6">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={`_-${idx}`}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep 
                    ? "w-6 bg-primary" 
                    : idx < currentStep 
                      ? "w-2 bg-primary/50" 
                      : "w-2 bg-muted"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          {step.actions ? (
            <div className="flex flex-col gap-2">
              {step.actions.map((action, idx) => (
                <Button
                  key={`action-${idx}`}
                  variant={action.primary ? "default" : "outline"}
                  className={`w-full ${action.primary ? "bg-gradient-to-r from-primary to-orange-500 hover:opacity-90" : ""}`}
                  onClick={() => handleAction(action)}
                  data-testid={`tour-action-${idx}`}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={prevStep}
                data-testid="tour-prev-btn"
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-orange-500 hover:opacity-90"
                onClick={nextStep}
                data-testid="tour-next-btn"
              >
                {currentStep === totalSteps - 1 ? "Finalizar" : "Siguiente"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>

        {/* Skip link */}
        {currentStep < totalSteps - 1 && (
          <div className="pb-4 text-center">
            <button
              onClick={() => endTour(true)}
              data-testid="tour-skip-btn"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Omitir tour
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Start Tour Button (for settings/help)
export const StartTourButton = ({ className = "" }) => {
  const { startTour } = useTour();

  return (
    <Button
      variant="outline"
      onClick={startTour}
      className={className}
    >
      <Sparkles className="w-4 h-4 mr-2" />
      Ver tour de bienvenida
    </Button>
  );
};

export default TourOverlay;
