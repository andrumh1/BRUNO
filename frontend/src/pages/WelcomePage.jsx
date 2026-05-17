import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CreditCard,
  Bell,
  Fingerprint,
  WifiOff,
  Send,
  Heart,
  CheckCircle2,
  Zap,
} from "lucide-react";
import ExpandableCard from "@/components/bruno/ExpandableCard";
import { brunoToast } from "@/components/bruno/BrunoToast";
import BrunoModal from "@/components/bruno/BrunoModal";

/* ─── Step bodies ──────────────────────────────────────────────────────── */

const StepIntro = () => (
  <motion.div
    key="intro"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="text-center"
  >
    <motion.div
      initial={{ scale: 0.6, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 16 }}
      className="mx-auto mb-6 grid place-items-center h-28 w-28 rounded-3xl bg-orange-500/10"
    >
      <img
        src="/bruno-mascot.png"
        alt="Bruno"
        className="h-24 w-24 object-contain"
      />
    </motion.div>
    <h2 className="text-3xl sm:text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
      Hola, soy Bruno
    </h2>
    <p className="mt-3 text-base text-zinc-600 dark:text-zinc-300 max-w-md mx-auto leading-relaxed">
      Tu red social con tarjetas digitales, NFC, marketplace y comisiones DEAL —
      todo en una experiencia fluida y bonita.
    </p>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-orange-600 bg-orange-50 dark:bg-orange-500/10 rounded-full px-4 py-2"
    >
      <Sparkles className="h-3.5 w-3.5" /> Versión Native-Ready
    </motion.div>
  </motion.div>
);

const FeatureChip = ({ icon: Icon, label, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="flex items-center gap-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2.5 shadow-sm"
  >
    <span className="grid place-items-center h-8 w-8 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-500">
      <Icon className="h-4 w-4" />
    </span>
    <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
      {label}
    </span>
  </motion.div>
);

const StepFeatures = () => (
  <motion.div
    key="features"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    <div className="text-center mb-6">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
        Lo que puedes hacer
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Toca cualquier característica para ver detalles.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2.5 mb-5">
      <FeatureChip icon={CreditCard} label="Tarjetas NFC" delay={0.05} />
      <FeatureChip icon={Bell} label="Push" delay={0.1} />
      <FeatureChip icon={Fingerprint} label="FaceID" delay={0.15} />
      <FeatureChip icon={WifiOff} label="Offline" delay={0.2} />
    </div>

    <div className="space-y-2.5">
      <ExpandableCard
        testId="welcome-feature-cards"
        icon={<CreditCard className="h-4 w-4" />}
        summary={
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
              Tarjetas dinámicas
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Personal · Empresa · Lugares · Servicios
            </p>
          </div>
        }
        details={
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3 leading-relaxed">
            Crea tarjetas digitales con QR y NFC. Drag-to-reorder, plantillas premium,
            analytics integrado y compartibles en un toque.
          </p>
        }
      />
      <ExpandableCard
        testId="welcome-feature-deal"
        icon={<Zap className="h-4 w-4" />}
        summary={
          <div>
            <p className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm">
              DEAL · Marketplace + Comisiones
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Vende productos y servicios con tu partner code
            </p>
          </div>
        }
        details={
          <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3 leading-relaxed">
            Integra DEAL para procesar pagos. Recibes comisión automática en cada
            venta referida y notificación push al instante.
          </p>
        }
      />
    </div>
  </motion.div>
);

const StepInteract = () => (
  <motion.div
    key="interact"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
  >
    <div className="text-center mb-6">
      <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
        Pruébame
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        Toca los botones para ver mis animaciones.
      </p>
    </div>

    <div className="grid grid-cols-2 gap-2.5">
      <DemoBtn
        testId="welcome-try-follow"
        onClick={() =>
          brunoToast.follow("¡Bienvenido a BRUNO!", {
            description: "Ahora forman parte de tu red.",
          })
        }
      >
        <Heart className="h-4 w-4" /> Seguir
      </DemoBtn>
      <DemoBtn
        testId="welcome-try-publish"
        primary
        onClick={() =>
          brunoToast.publish("Tu primera tarjeta", {
            description: "Lista para compartir vía QR o NFC.",
          })
        }
      >
        <Send className="h-4 w-4" /> Publicar
      </DemoBtn>
      <DemoBtn
        testId="welcome-try-like"
        onClick={() => brunoToast.like("Te gusta esto")}
      >
        <Heart className="h-4 w-4" /> Like
      </DemoBtn>
      <DemoBtn
        testId="welcome-try-loading"
        onClick={() => {
          const id = brunoToast.loading("Sincronizando catálogo...");
          setTimeout(() => {
            brunoToast.dismiss(id);
            brunoToast.success("Listo");
          }, 1400);
        }}
      >
        <Sparkles className="h-4 w-4" /> Sync
      </DemoBtn>
    </div>
  </motion.div>
);

const StepReady = ({ onStart, onSkip }) => (
  <motion.div
    key="ready"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="text-center"
  >
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 18 }}
      className="mx-auto mb-5 grid place-items-center h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
    >
      <CheckCircle2 className="h-10 w-10" strokeWidth={2.4} />
    </motion.div>
    <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
      Todo listo
    </h2>
    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300 max-w-sm mx-auto leading-relaxed">
      Crea tu primera tarjeta digital, activa NFC y empieza a recibir tu red.
    </p>
    <div className="mt-7 flex flex-col sm:flex-row gap-2 justify-center">
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.96 }}
        onClick={onStart}
        data-testid="welcome-cta-start"
        className="rounded-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold shadow-lg shadow-orange-500/30 inline-flex items-center justify-center gap-2 transition-colors"
      >
        Crear mi primera tarjeta
        <ArrowRight className="h-4 w-4" />
      </motion.button>
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={onSkip}
        data-testid="welcome-cta-skip"
        className="rounded-full px-6 py-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      >
        Explorar la app
      </motion.button>
    </div>
  </motion.div>
);

const DemoBtn = ({ children, onClick, primary, testId }) => (
  <motion.button
    whileTap={{ scale: 0.95 }}
    whileHover={{ y: -1 }}
    onClick={onClick}
    data-testid={testId}
    className={`rounded-2xl px-3 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all ${
      primary
        ? "bg-orange-500 text-white shadow-md shadow-orange-500/30 hover:bg-orange-600"
        : "bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
    }`}
  >
    {children}
  </motion.button>
);

/* ─── Page ─────────────────────────────────────────────────────────────── */

const STEPS = ["intro", "features", "interact", "ready"];

export default function WelcomePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [skipModalOpen, setSkipModalOpen] = useState(false);

  // Mark welcome as seen so we don't show again
  const markSeen = () => {
    try {
      localStorage.setItem("bruno_welcome_seen", "1");
    } catch (_) {
      /* ignore */
    }
  };

  useEffect(() => {
    // Smooth scroll to top on step change
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));
  const onStart = () => {
    markSeen();
    navigate("/cards/new");
  };
  const onSkip = () => {
    markSeen();
    navigate("/feed");
  };

  const renderStep = () => {
    switch (STEPS[step]) {
      case "intro":
        return <StepIntro />;
      case "features":
        return <StepFeatures />;
      case "interact":
        return <StepInteract />;
      case "ready":
        return <StepReady onStart={onStart} onSkip={onSkip} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden">
      {/* Decorative blobs */}
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2 }}
        className="absolute -top-32 -right-24 h-80 w-80 rounded-full bg-orange-300/30 blur-3xl"
      />
      <motion.div
        aria-hidden
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, delay: 0.2 }}
        className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-orange-500/20 blur-3xl"
      />

      {/* Skip top-right */}
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/bruno-icon.png"
            alt="Bruno"
            className="h-8 w-8 rounded-lg object-contain"
          />
          <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            BRUNO
          </span>
        </div>
        {step < STEPS.length - 1 && (
          <button
            type="button"
            onClick={() => setSkipModalOpen(true)}
            data-testid="welcome-skip-btn"
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            Saltar
          </button>
        )}
      </div>

      {/* Step content */}
      <div className="relative max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          layout
          className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-900/5 p-6 sm:p-10 overflow-hidden"
          data-testid="welcome-card"
        >
          <AnimatePresence mode="wait">{renderStep()}</AnimatePresence>

          {/* Step indicator + nav (hidden on final step) */}
          {step < STEPS.length - 1 && (
            <div className="mt-8 flex items-center justify-between">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={prev}
                disabled={step === 0}
                data-testid="welcome-prev"
                className="rounded-full p-2 text-zinc-500 disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </motion.button>

              <div className="flex items-center gap-2">
                {STEPS.map((_, i) => (
                  <motion.span
                    key={i}
                    layout
                    animate={{
                      width: i === step ? 24 : 8,
                      backgroundColor: i === step ? "#FF5A00" : "#D4D4D8",
                    }}
                    transition={{ duration: 0.3 }}
                    className="h-2 rounded-full"
                  />
                ))}
              </div>

              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.95 }}
                onClick={next}
                data-testid="welcome-next"
                className="rounded-full px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 shadow-md shadow-orange-500/30 transition-colors"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>

      {/* Skip confirmation modal */}
      <BrunoModal
        open={skipModalOpen}
        onClose={() => setSkipModalOpen(false)}
        variant="info"
        title="¿Saltar el tour?"
        description="Te lleva sólo 30 segundos descubrir qué puede hacer BRUNO por ti."
        primaryAction={{
          label: "Continuar tour",
          onClick: () => setSkipModalOpen(false),
        }}
        secondaryAction={{
          label: "Saltar",
          onClick: () => {
            setSkipModalOpen(false);
            onSkip();
          },
        }}
        testId="welcome-skip-modal"
      />
    </div>
  );
}
