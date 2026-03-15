import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const DataRightsPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold">Derechos de Datos (GDPR)</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm dark:prose-invert">
        <p className="text-sm text-muted-foreground">Ultima actualizacion: Marzo 2026</p>

        <h2>1. Tus Derechos</h2>
        <p>Como usuario de BRUNO, tienes los siguientes derechos sobre tus datos personales:</p>

        <h3>Derecho de Acceso</h3>
        <p>Puedes solicitar una copia de todos los datos personales que tenemos sobre ti.</p>

        <h3>Derecho de Rectificacion</h3>
        <p>Puedes corregir o actualizar tus datos personales en cualquier momento desde tu perfil o contactandonos directamente.</p>

        <h3>Derecho al Olvido</h3>
        <p>Puedes solicitar la eliminacion de todos tus datos personales. Esto incluye tu perfil, tarjetas, publicaciones, mensajes y cualquier otra informacion asociada a tu cuenta.</p>

        <h3>Derecho a la Portabilidad</h3>
        <p>Puedes solicitar una exportacion de tus datos en un formato legible por maquina (JSON/CSV).</p>

        <h3>Derecho de Oposicion</h3>
        <p>Puedes oponerte al procesamiento de tus datos para fines de marketing o analytics.</p>

        <h3>Derecho a la Limitacion</h3>
        <p>Puedes solicitar que limitemos el procesamiento de tus datos en ciertas circunstancias.</p>

        <h2>2. Como Ejercer tus Derechos</h2>
        <ul>
          <li><strong>Desde la app:</strong> Configuracion &gt; Privacidad &gt; Mis Datos</li>
          <li><strong>Por email:</strong> gdpr@bruno.social</li>
          <li><strong>Eliminar cuenta:</strong> Configuracion &gt; Eliminar Cuenta</li>
        </ul>

        <h2>3. Tiempo de Respuesta</h2>
        <p>Procesaremos tu solicitud dentro de los 30 dias habiles siguientes a la recepcion. En casos complejos, este plazo puede extenderse hasta 60 dias.</p>

        <h2>4. Datos que Recopilamos</h2>
        <ul>
          <li>Informacion de registro (nombre, email, telefono)</li>
          <li>Datos de perfil y tarjetas profesionales</li>
          <li>Contenido publicado (posts, fotos, videos)</li>
          <li>Mensajes y comunicaciones</li>
          <li>Datos de uso y analytics</li>
          <li>Datos de ubicacion (si lo autorizas)</li>
          <li>Datos de dispositivo y conexion</li>
        </ul>

        <h2>5. Base Legal</h2>
        <p>Procesamos tus datos bajo las siguientes bases legales: consentimiento explicito, ejecucion de contrato, intereses legitimos y obligaciones legales.</p>

        <h2>6. Transferencias Internacionales</h2>
        <p>Tus datos pueden ser procesados en servidores ubicados fuera de tu pais. Garantizamos que todas las transferencias cumplen con las regulaciones aplicables.</p>

        <h2>7. Contacto del DPO</h2>
        <p>Delegado de Proteccion de Datos: dpo@bruno.social</p>
      </main>
    </div>
  );
};

export default DataRightsPage;
