import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  ChevronRight, 
  ChevronLeft, 
  X, 
  Sparkles,
  CreditCard,
  MessageCircle,
  Map,
  ShoppingBag,
  Trophy,
  Bell,
  User,
  Check
} from "lucide-react";

// Tour steps configuration
const TOUR_STEPS = [
  {
    id: "welcome",
    title: "¡Bienvenido a BRUNO!",
    message: "Soy BRUNO IA, tu asistente personal. Te guiaré por todas las funciones increíbles que tenemos para ti. ¿Comenzamos?",
    icon: Sparkles,
    color: "from-orange-500 to-yellow-500",
    position: "center"
  },
  {
    id: "cards",
    title: "Tarjetas Digitales",
    message: "Crea tarjetas de presentación digitales únicas. Puedes elegir entre tarjetas personales, profesionales, de empresa o de servicios. ¡Compártelas con un solo toque!",
    icon: CreditCard,
    color: "from-blue-500 to-cyan-500",
    target: "/dashboard",
    highlight: "[data-testid='create-card-btn']"
  },
  {
    id: "feed",
    title: "Feed Social",
    message: "Comparte publicaciones, fotos y videos con tu red. Descubre contenido de otros profesionales y haz crecer tu comunidad.",
    icon: User,
    color: "from-purple-500 to-pink-500",
    target: "/feed"
  },
  {
    id: "chat",
    title: "Chat en Tiempo Real",
    message: "Comunícate con otros usuarios mediante mensajes, notas de voz, stickers, ¡y hasta videollamadas! Todo en un solo lugar.",
    icon: MessageCircle,
    color: "from-green-500 to-emerald-500",
    target: "/chat"
  },
  {
    id: "map",
    title: "Mapa de Tarjetas",
    message: "Descubre profesionales y negocios cerca de ti. El mapa te muestra tarjetas de otros usuarios con su ubicación y distancia.",
    icon: Map,
    color: "from-red-500 to-orange-500",
    target: "/map"
  },
  {
    id: "store",
    title: "Tienda BRUNO",
    message: "Explora nuestra tienda con tarjetas NFC físicas, productos para tu negocio y servicios de marketing digital.",
    icon: ShoppingBag,
    color: "from-amber-500 to-yellow-500",
    target: "/store"
  },
  {
    id: "points",
    title: "Sistema de Puntos",
    message: "Gana puntos por usar BRUNO: check-in diario, publicaciones, interacciones. ¡Sube de nivel y compite en el ranking!",
    icon: Trophy,
    color: "from-yellow-500 to-orange-500",
    target: "/points"
  },
  {
    id: "notifications",
    title: "Notificaciones",
    message: "Activa las notificaciones para no perderte llamadas, mensajes o interacciones importantes. ¡Mantente conectado!",
    icon: Bell,
    color: "from-indigo-500 to-purple-500"
  },
  {
    id: "complete",
    title: "¡Listo para comenzar!",
    message: "Ya conoces lo básico de BRUNO. ¿Qué te gustaría hacer primero? Puedes crear tu primera tarjeta o explorar el feed.",
    icon: Check,
    color: "from-green-500 to-emerald-500",
    position: "center",
    actions: [
      { label: "Crear mi tarjeta", path: "/cards/new", primary: true },
      { label: "Explorar feed", path: "/feed" }
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
      if (isNewUser && hoursSinceCreation < 1) {
        setTimeout(() => setIsActive(true), 1000);
      }
    }
  }, [user]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsActive(true);
  }, []);

  const endTour = useCallback((completed = false) => {
    setIsActive(false);
    if (completed && user) {
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

  if (!isActive || !step) return null;

  const Icon = step.icon;
  const progress = ((currentStep + 1) / totalSteps) * 100;

  const handleAction = (action) => {
    endTour(true);
    navigate(action.path);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => endTour(false)}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
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
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        {/* Content */}
        <div className="p-6 pt-8">
          {/* Icon */}
          <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mx-auto mb-6 shadow-lg`}>
            <Icon className="w-10 h-10 text-white" />
          </div>

          {/* Text */}
          <h2 className="text-2xl font-bold text-center mb-3">{step.title}</h2>
          <p className="text-muted-foreground text-center leading-relaxed mb-6">
            {step.message}
          </p>

          {/* Step indicator */}
          <div className="flex justify-center gap-1.5 mb-6">
            {TOUR_STEPS.map((_, idx) => (
              <div
                key={idx}
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
                  key={idx}
                  variant={action.primary ? "default" : "outline"}
                  className={`w-full ${action.primary ? "bg-gradient-to-r from-primary to-orange-500 hover:opacity-90" : ""}`}
                  onClick={() => handleAction(action)}
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
                disabled={currentStep === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Anterior
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-orange-500 hover:opacity-90"
                onClick={nextStep}
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
