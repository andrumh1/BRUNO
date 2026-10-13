import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertTriangle, Ban, CheckCircle, Shield } from "lucide-react";
import { OvcAttribution } from "@/components/brand/OvcAttribution";

const TermsOfServicePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <FileText className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Términos de Servicio</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="prose prose-sm max-w-none">
          {/* Last Updated */}
          <p className="text-sm text-muted-foreground mb-6">
            Última actualización: 26 de Febrero, 2026
          </p>

          {/* Introduction */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">1. Aceptación de los Términos</h2>
            <p className="text-muted-foreground leading-relaxed">
              Al acceder o utilizar BRUNO ("la Plataforma"), aceptas estar sujeto a estos Términos de Servicio. 
              Si no estás de acuerdo con alguna parte de estos términos, no podrás acceder a la Plataforma.
            </p>
          </section>

          {/* Service Description */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">2. Descripción del Servicio</h2>
            <p className="text-muted-foreground mb-4">
              BRUNO es una red social profesional que permite a los usuarios:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Crear y compartir tarjetas profesionales digitales</li>
              <li>Publicar contenido (posts, fotos, videos, historias)</li>
              <li>Conectar con otros profesionales</li>
              <li>Acceder a un marketplace de productos y servicios</li>
              <li>Utilizar herramientas de análisis y promoción</li>
            </ul>
          </section>

          {/* User Accounts */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">3. Cuentas de Usuario</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Debes tener al menos 13 años para crear una cuenta</li>
              <li>Debes proporcionar información precisa y actualizada</li>
              <li>Eres responsable de mantener la seguridad de tu cuenta</li>
              <li>Una persona o entidad solo puede mantener una cuenta</li>
              <li>Nos reservamos el derecho de suspender cuentas que violen estos términos</li>
            </ul>
          </section>

          {/* Content Policy Section */}
          <section className="mb-8 p-6 bg-destructive/5 rounded-2xl border border-destructive/20">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Ban className="w-5 h-5 text-destructive" />
              4. Política de Contenido Prohibido
            </h2>
            <p className="text-muted-foreground mb-4">
              Está estrictamente prohibido publicar contenido que:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Violencia:</strong> Promueva, glorifique o incite a la violencia</li>
              <li><strong>Odio:</strong> Contenga discurso de odio basado en raza, etnia, religión, género, orientación sexual o discapacidad</li>
              <li><strong>Acoso:</strong> Acose, intimide o amenace a otros usuarios</li>
              <li><strong>Contenido sexual:</strong> Material sexualmente explícito, pornografía o explotación</li>
              <li><strong>Menores:</strong> Cualquier contenido que involucre o explote a menores</li>
              <li><strong>Desinformación:</strong> Información falsa que pueda causar daño</li>
              <li><strong>Spam:</strong> Contenido repetitivo, engañoso o promocional no solicitado</li>
              <li><strong>Ilegal:</strong> Actividades ilegales, venta de sustancias controladas o bienes robados</li>
              <li><strong>Propiedad intelectual:</strong> Material que infrinja derechos de autor o marcas registradas</li>
              <li><strong>Suplantación:</strong> Hacerse pasar por otra persona u organización</li>
            </ul>
          </section>

          {/* Moderation */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              5. Moderación y Consecuencias
            </h2>
            <p className="text-muted-foreground mb-4">
              BRUNO se reserva el derecho de:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Eliminar contenido que viole estas políticas sin previo aviso</li>
              <li>Emitir advertencias a usuarios</li>
              <li>Suspender temporalmente cuentas</li>
              <li>Eliminar permanentemente cuentas en casos graves o reincidentes</li>
              <li>Reportar actividades ilegales a las autoridades competentes</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">6. Propiedad Intelectual</h2>
            <p className="text-muted-foreground mb-4">
              <strong>Tu contenido:</strong> Mantienes la propiedad de todo el contenido que publicas. 
              Al publicar, nos otorgas una licencia mundial, no exclusiva, libre de regalías para usar, 
              mostrar y distribuir tu contenido en la Plataforma.
            </p>
            <p className="text-muted-foreground">
              <strong>Nuestra propiedad:</strong> BRUNO, su logo, diseño y tecnología son propiedad de 
              Octopus Vision Company (OVC) y están protegidos por leyes de propiedad intelectual.
            </p>
          </section>

          {/* Subscriptions */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">7. Suscripciones y Pagos</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Las suscripciones se renuevan automáticamente</li>
              <li>Puedes cancelar en cualquier momento desde tu perfil</li>
              <li>Los reembolsos se procesarán según la política de la tienda de aplicaciones correspondiente</li>
              <li>Los precios pueden cambiar con previo aviso</li>
            </ul>
          </section>

          {/* Disclaimer */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">8. Exención de Responsabilidad</h2>
            <p className="text-muted-foreground">
              La Plataforma se proporciona "tal cual". No garantizamos que el servicio esté libre de errores 
              o interrupciones. No somos responsables del contenido publicado por los usuarios ni de las 
              transacciones realizadas entre usuarios en el marketplace.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">9. Limitación de Responsabilidad</h2>
            <p className="text-muted-foreground">
              En la máxima medida permitida por la ley, BRUNO no será responsable de daños indirectos, 
              incidentales, especiales o consecuentes que surjan del uso de la Plataforma.
            </p>
          </section>

          {/* Termination */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">10. Terminación</h2>
            <p className="text-muted-foreground mb-4">
              Puedes eliminar tu cuenta en cualquier momento desde la configuración de tu perfil.
            </p>
            <p className="text-muted-foreground">
              Nos reservamos el derecho de suspender o eliminar tu cuenta si violas estos términos, 
              con o sin previo aviso.
            </p>
          </section>

          {/* Changes */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">11. Modificaciones</h2>
            <p className="text-muted-foreground">
              Podemos modificar estos términos en cualquier momento. Te notificaremos sobre cambios 
              significativos. El uso continuado de la Plataforma después de las modificaciones 
              constituye tu aceptación de los nuevos términos.
            </p>
          </section>

          {/* Governing Law */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">12. Ley Aplicable</h2>
            <p className="text-muted-foreground">
              Estos términos se rigen por las leyes aplicables en tu jurisdicción. 
              Cualquier disputa se resolverá en los tribunales competentes.
            </p>
          </section>

          {/* Contact */}
          <section className="p-6 bg-card rounded-2xl border">
            <h2 className="text-xl font-bold mb-4">13. Contacto</h2>
            <p className="text-muted-foreground mb-4">
              Para preguntas sobre estos términos:
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li><strong>Email:</strong> legal@bruno.app</li>
              <li><strong>Formulario:</strong> <a href="/contact" className="text-primary hover:underline">Página de Contacto</a></li>
            </ul>
          </section>

          {/* Acceptance */}
          <section className="mt-8 p-6 bg-primary/5 rounded-2xl border border-primary/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold mb-2">Aceptación</h3>
                <p className="text-sm text-muted-foreground">
                  Al crear una cuenta o usar BRUNO, confirmas que has leído, entendido y aceptas 
                  estar sujeto a estos Términos de Servicio y nuestra Política de Privacidad.
                </p>
              </div>
            </div>
          </section>
          <OvcAttribution variant="legal" className="pt-8 pb-6" />
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
