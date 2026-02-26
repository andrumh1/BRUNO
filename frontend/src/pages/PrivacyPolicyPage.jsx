import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Shield, FileText, AlertTriangle, Trash2, CheckCircle } from "lucide-react";

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Shield className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold">Política de Privacidad</h1>
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
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Introducción
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              En BRUNO, nos comprometemos a proteger tu privacidad y la seguridad de tus datos personales. 
              Esta Política de Privacidad explica cómo recopilamos, usamos, compartimos y protegemos tu información 
              cuando utilizas nuestra plataforma de red social profesional.
            </p>
          </section>

          {/* Data Collection */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">1. Información que Recopilamos</h2>
            
            <h3 className="text-lg font-semibold mb-2">1.1 Información que nos proporcionas:</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
              <li>Datos de registro (nombre, email, contraseña)</li>
              <li>Información de perfil (foto, biografía, ubicación, sitio web)</li>
              <li>Contenido que publicas (posts, fotos, videos, historias)</li>
              <li>Información de tarjetas profesionales</li>
              <li>Mensajes y comunicaciones</li>
              <li>Información de pago (procesada por terceros seguros)</li>
            </ul>

            <h3 className="text-lg font-semibold mb-2">1.2 Información recopilada automáticamente:</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Datos de uso y navegación</li>
              <li>Información del dispositivo</li>
              <li>Dirección IP y ubicación aproximada</li>
              <li>Cookies y tecnologías similares</li>
            </ul>
          </section>

          {/* Data Usage */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">2. Cómo Usamos tu Información</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Proporcionar y mejorar nuestros servicios</li>
              <li>Personalizar tu experiencia</li>
              <li>Facilitar conexiones profesionales</li>
              <li>Procesar transacciones</li>
              <li>Enviar notificaciones relevantes</li>
              <li>Garantizar la seguridad de la plataforma</li>
              <li>Cumplir con obligaciones legales</li>
            </ul>
          </section>

          {/* Data Sharing */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">3. Compartir Información</h2>
            <p className="text-muted-foreground mb-4">
              No vendemos tu información personal. Podemos compartir datos con:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Otros usuarios (según tu configuración de privacidad)</li>
              <li>Proveedores de servicios (hosting, analytics, pagos)</li>
              <li>Autoridades legales (cuando sea requerido por ley)</li>
              <li>En caso de fusión o adquisición empresarial</li>
            </ul>
          </section>

          {/* User Rights */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">4. Tus Derechos</h2>
            <p className="text-muted-foreground mb-4">
              Tienes derecho a:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Acceso:</strong> Solicitar una copia de tus datos</li>
              <li><strong>Rectificación:</strong> Corregir datos inexactos</li>
              <li><strong>Eliminación:</strong> Solicitar la eliminación de tu cuenta y datos</li>
              <li><strong>Portabilidad:</strong> Exportar tus datos en formato común</li>
              <li><strong>Oposición:</strong> Oponerte al procesamiento de tus datos</li>
              <li><strong>Limitación:</strong> Restringir el uso de tus datos</li>
            </ul>
          </section>

          {/* Data Retention */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">5. Retención de Datos</h2>
            <p className="text-muted-foreground">
              Conservamos tu información mientras tu cuenta esté activa o sea necesario para proporcionarte servicios. 
              Puedes solicitar la eliminación de tu cuenta en cualquier momento desde la configuración de tu perfil.
              Tras la eliminación, tus datos serán eliminados permanentemente en un plazo máximo de 30 días, 
              salvo que la ley requiera su conservación.
            </p>
          </section>

          {/* Security */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">6. Seguridad</h2>
            <p className="text-muted-foreground">
              Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos, incluyendo:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-2">
              <li>Encriptación de datos en tránsito y en reposo</li>
              <li>Autenticación segura</li>
              <li>Monitoreo de seguridad continuo</li>
              <li>Control de acceso estricto</li>
            </ul>
          </section>

          {/* Children */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">7. Menores de Edad</h2>
            <p className="text-muted-foreground">
              BRUNO no está dirigido a menores de 13 años. No recopilamos conscientemente información de menores. 
              Si eres padre/tutor y crees que tu hijo ha proporcionado información, contáctanos para eliminarla.
            </p>
          </section>

          {/* International */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">8. Transferencias Internacionales</h2>
            <p className="text-muted-foreground">
              Tus datos pueden ser procesados en servidores ubicados fuera de tu país. 
              Garantizamos que todas las transferencias cumplan con las leyes de protección de datos aplicables 
              y se realicen con las salvaguardas adecuadas.
            </p>
          </section>

          {/* Changes */}
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">9. Cambios en esta Política</h2>
            <p className="text-muted-foreground">
              Podemos actualizar esta política ocasionalmente. Te notificaremos sobre cambios significativos 
              a través de la aplicación o por email. El uso continuado de BRUNO después de los cambios 
              constituye tu aceptación de la política actualizada.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-8 p-6 bg-card rounded-2xl border">
            <h2 className="text-xl font-bold mb-4">10. Contacto</h2>
            <p className="text-muted-foreground mb-4">
              Para preguntas sobre esta política o ejercer tus derechos:
            </p>
            <ul className="text-muted-foreground space-y-2">
              <li><strong>Email:</strong> privacy@bruno.app</li>
              <li><strong>Formulario:</strong> <a href="/contact" className="text-primary hover:underline">Página de Contacto</a></li>
            </ul>
          </section>

          {/* GDPR/CCPA Notice */}
          <section className="p-6 bg-primary/5 rounded-2xl border border-primary/20">
            <h3 className="font-bold mb-2 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Cumplimiento Legal
            </h3>
            <p className="text-sm text-muted-foreground">
              Esta política cumple con el Reglamento General de Protección de Datos (GDPR), 
              la Ley de Privacidad del Consumidor de California (CCPA), y otras leyes de protección 
              de datos aplicables a nivel mundial.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
