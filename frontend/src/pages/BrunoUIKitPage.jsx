import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  UserPlus,
  Send,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Heart,
  Mail,
  MapPin,
  Briefcase,
  Phone,
  Globe,
} from "lucide-react";
import ExpandableCard from "@/components/bruno/ExpandableCard";
import BrunoModal from "@/components/bruno/BrunoModal";
import { brunoToast } from "@/components/bruno/BrunoToast";

const Section = ({ title, subtitle, children }) => (
  <section className="mb-12">
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="mb-5"
    >
      <h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
        <span className="inline-block w-1.5 h-6 bg-orange-500 rounded-full" />
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 ml-4">
          {subtitle}
        </p>
      )}
    </motion.div>
    {children}
  </section>
);

const DemoButton = ({ children, onClick, variant = "default", testId }) => {
  const variants = {
    default: "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-300",
    primary: "bg-orange-500 text-white hover:bg-orange-600 shadow-lg shadow-orange-500/30",
    outline: "border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800",
    danger: "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      onClick={onClick}
      data-testid={testId}
      className={`text-sm font-semibold rounded-full px-4 py-2.5 transition-all ${variants[variant]}`}
    >
      {children}
    </motion.button>
  );
};

export default function BrunoUIKitPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [dangerOpen, setDangerOpen] = useState(false);
  const [dynamicOpen, setDynamicOpen] = useState(false);
  const [extra, setExtra] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-zinc-200 dark:border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,106,0,0.15),transparent_60%)]" />
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 mb-3"
          >
            <img
              src="/bruno-icon.png"
              alt="Bruno"
              className="h-12 w-12 rounded-xl bg-orange-50 dark:bg-orange-500/10 p-1.5 object-contain"
            />
            <div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight">
                BRUNO UI Kit
              </h1>
              <p className="text-sm text-orange-500 font-semibold flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" /> Dynamic feedback & cards
              </p>
            </div>
          </motion.div>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-2xl">
            Sistema de componentes dinámicos: tarjetas expandibles, toasts y modales
            con animaciones fluidas y la identidad visual de Bruno.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        {/* 1. Expandable Cards */}
        <Section
          title="Tarjetas dinámicas"
          subtitle="Toca cualquier tarjeta para expandirla. Layout animado, alturas fluidas."
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ExpandableCard
              testId="card-bruno"
              icon={<Briefcase className="h-5 w-5" />}
              summary={
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Bruno García
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Founder · BRUNO.app
                  </p>
                </div>
              }
              details={
                <div className="space-y-2.5 text-sm text-zinc-700 dark:text-zinc-300 mt-3">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-orange-500" />
                    <span>founder@bruno.app</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-orange-500" />
                    <span>+34 600 123 456</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-orange-500" />
                    <span>Madrid, España</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-orange-500" />
                    <span>bruno.app</span>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <DemoButton
                      variant="primary"
                      testId="follow-btn"
                      onClick={() =>
                        brunoToast.follow("Ahora sigues a Bruno", {
                          description: "Recibirás sus novedades en tu feed.",
                        })
                      }
                    >
                      Seguir
                    </DemoButton>
                    <DemoButton
                      variant="outline"
                      onClick={() => brunoToast.info("Mensaje enviado")}
                    >
                      Mensaje
                    </DemoButton>
                  </div>
                </div>
              }
            />

            <ExpandableCard
              testId="card-product"
              icon={<Sparkles className="h-5 w-5" />}
              summary={
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    Curso Premium DEAL
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    $99 USD · 12 lecciones
                  </p>
                </div>
              }
              details={
                <div className="space-y-3 mt-3">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                    Aprende a construir tu marca personal con tarjetas digitales,
                    QR dinámicos y NFC. Incluye 12 lecciones grabadas y plantillas
                    listas para usar.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["NFC", "QR", "Stripe", "DEAL"].map((tag) => (
                      <span
                        key={tag}
                        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <DemoButton
                    variant="primary"
                    testId="buy-deal-btn"
                    onClick={() =>
                      brunoToast.promise(
                        new Promise((r) => setTimeout(r, 1400)),
                        {
                          loading: "Conectando con DEAL...",
                          success: "Compra iniciada",
                          error: "No se pudo procesar",
                        }
                      )
                    }
                  >
                    Comprar vía DEAL
                  </DemoButton>
                </div>
              }
            />
          </div>
        </Section>

        {/* 2. Toasts */}
        <Section
          title="Letreros informativos (Toasts)"
          subtitle="Cada toast lleva el logo de Bruno, una barra de marca y animación fluida."
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DemoButton
              variant="primary"
              testId="toast-publish"
              onClick={() =>
                brunoToast.publish("Tu tarjeta está en vivo", {
                  description: "Compártela con tu QR o NFC para empezar.",
                })
              }
            >
              <Send className="inline h-4 w-4 mr-1.5" /> Publicar
            </DemoButton>
            <DemoButton
              testId="toast-follow"
              onClick={() =>
                brunoToast.follow("Siguiendo a María López", {
                  description: "Verás sus posts y stories.",
                  action: { label: "Deshacer", onClick: () => brunoToast.info("Deshecho") },
                })
              }
            >
              <UserPlus className="inline h-4 w-4 mr-1.5" /> Seguir
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="toast-discard"
              onClick={() =>
                brunoToast.discard("Borrador descartado", {
                  description: "Puedes restaurarlo en los próximos 5 segundos.",
                  action: { label: "Restaurar", onClick: () => brunoToast.success("Restaurado") },
                })
              }
            >
              <Trash2 className="inline h-4 w-4 mr-1.5" /> Descartar
            </DemoButton>
            <DemoButton
              testId="toast-like"
              onClick={() => brunoToast.like("Te gusta este post")}
            >
              <Heart className="inline h-4 w-4 mr-1.5" /> Like
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="toast-success"
              onClick={() => brunoToast.success("Tarjeta guardada")}
            >
              <CheckCircle2 className="inline h-4 w-4 mr-1.5" /> Éxito
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="toast-error"
              onClick={() =>
                brunoToast.error("No se pudo guardar", {
                  description: "Comprueba tu conexión e intenta de nuevo.",
                })
              }
            >
              <AlertTriangle className="inline h-4 w-4 mr-1.5" /> Error
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="toast-loading"
              onClick={() => {
                const id = brunoToast.loading("Subiendo foto...", {
                  description: "Esto puede tardar unos segundos.",
                });
                setTimeout(() => {
                  brunoToast.dismiss(id);
                  brunoToast.success("Foto subida");
                }, 2000);
              }}
            >
              <Sparkles className="inline h-4 w-4 mr-1.5" /> Cargando
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="toast-promise"
              onClick={() =>
                brunoToast.promise(
                  new Promise((res, rej) =>
                    setTimeout(() => (Math.random() > 0.3 ? res() : rej()), 1500)
                  ),
                  {
                    loading: "Procesando pago...",
                    success: "Pago confirmado",
                    error: "Pago fallido",
                  }
                ).catch(() => {})
              }
            >
              <Sparkles className="inline h-4 w-4 mr-1.5" /> Promise
            </DemoButton>
          </div>
        </Section>

        {/* 3. Modals */}
        <Section
          title="Modales de feedback"
          subtitle="Modales con logo, animación spring y altura dinámica."
        >
          <div className="flex flex-wrap gap-3">
            <DemoButton
              variant="primary"
              testId="modal-publish-btn"
              onClick={() => setPublishOpen(true)}
            >
              <Send className="inline h-4 w-4 mr-1.5" /> Publicar tarjeta
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="modal-discard-btn"
              onClick={() => setDiscardOpen(true)}
            >
              <Trash2 className="inline h-4 w-4 mr-1.5" /> Descartar
            </DemoButton>
            <DemoButton
              testId="modal-confirm-btn"
              onClick={() => setConfirmOpen(true)}
            >
              Confirmar acción
            </DemoButton>
            <DemoButton
              variant="danger"
              testId="modal-danger-btn"
              onClick={() => setDangerOpen(true)}
            >
              Eliminar cuenta
            </DemoButton>
            <DemoButton
              variant="outline"
              testId="modal-dynamic-btn"
              onClick={() => {
                setExtra(false);
                setDynamicOpen(true);
              }}
            >
              Modal dinámico
            </DemoButton>
          </div>
        </Section>
      </div>

      {/* Modals */}
      <BrunoModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        variant="publish"
        title="Publicar tarjeta"
        description="Tu tarjeta será visible en tu perfil público y compartible vía QR / NFC."
        primaryAction={{
          label: "Publicar ahora",
          onClick: () => {
            setPublishOpen(false);
            brunoToast.publish("Tarjeta publicada", {
              description: "Ya puedes compartirla con el mundo.",
            });
          },
        }}
        secondaryAction={{ label: "Cancelar", onClick: () => setPublishOpen(false) }}
        testId="modal-publish"
      />

      <BrunoModal
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        variant="discard"
        title="Descartar cambios"
        description="Perderás los cambios no guardados. ¿Continuar?"
        primaryAction={{
          label: "Descartar",
          onClick: () => {
            setDiscardOpen(false);
            brunoToast.discard("Cambios descartados");
          },
        }}
        secondaryAction={{ label: "Seguir editando", onClick: () => setDiscardOpen(false) }}
        testId="modal-discard"
      />

      <BrunoModal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        variant="confirm"
        title="Confirmar acción"
        description="Esta acción no se puede deshacer. ¿Estás seguro?"
        primaryAction={{
          label: "Sí, continuar",
          onClick: () => {
            setConfirmOpen(false);
            brunoToast.success("Acción completada");
          },
        }}
        secondaryAction={{ label: "Cancelar", onClick: () => setConfirmOpen(false) }}
        testId="modal-confirm"
      />

      <BrunoModal
        open={dangerOpen}
        onClose={() => setDangerOpen(false)}
        variant="danger"
        title="Eliminar cuenta"
        description="Esta acción es permanente. Se borrarán tus tarjetas, posts, productos y comisiones DEAL."
        primaryAction={{
          label: "Eliminar definitivamente",
          onClick: () => {
            setDangerOpen(false);
            brunoToast.error("Cuenta marcada para eliminación");
          },
        }}
        secondaryAction={{ label: "Cancelar", onClick: () => setDangerOpen(false) }}
        testId="modal-danger"
      />

      <BrunoModal
        open={dynamicOpen}
        onClose={() => setDynamicOpen(false)}
        variant="info"
        title="Contenido dinámico"
        description="El modal expande su altura suavemente al agregar contenido."
        primaryAction={{
          label: extra ? "Ocultar detalles" : "Mostrar más",
          onClick: () => setExtra((v) => !v),
        }}
        secondaryAction={{ label: "Cerrar", onClick: () => setDynamicOpen(false) }}
        testId="modal-dynamic"
      >
        {extra && (
          <div className="space-y-2 rounded-xl bg-orange-50 dark:bg-orange-500/5 p-3 border border-orange-200/60 dark:border-orange-500/20">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              <strong>Tip:</strong> usa <code>layout</code> de framer-motion para que el modal
              se reajuste automáticamente al cambiar su contenido.
            </p>
            <ul className="text-xs text-zinc-600 dark:text-zinc-400 list-disc ml-5 space-y-1">
              <li>Spring animations</li>
              <li>Backdrop blur</li>
              <li>Scroll lock + Escape close</li>
              <li>Branded header con logo</li>
            </ul>
          </div>
        )}
      </BrunoModal>
    </div>
  );
}
