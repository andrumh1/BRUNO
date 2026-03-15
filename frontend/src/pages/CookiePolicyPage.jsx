import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Cookie } from "lucide-react";

const CookiePolicyPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold">Politica de Cookies</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm dark:prose-invert">
        <p className="text-sm text-muted-foreground">Ultima actualizacion: Marzo 2026</p>

        <h2>1. Que son las Cookies</h2>
        <p>Las cookies son pequenos archivos de texto que se almacenan en su dispositivo cuando visita BRUNO. Nos ayudan a mejorar su experiencia, recordar sus preferencias y analizar como se usa la plataforma.</p>

        <h2>2. Tipos de Cookies que Usamos</h2>
        <h3>Cookies Esenciales</h3>
        <p>Necesarias para el funcionamiento basico de la plataforma: autenticacion, seguridad de sesion, preferencias de idioma.</p>
        <h3>Cookies de Rendimiento</h3>
        <p>Nos ayudan a entender como los usuarios interactuan con BRUNO para mejorar el servicio.</p>
        <h3>Cookies de Funcionalidad</h3>
        <p>Permiten recordar sus preferencias (tema oscuro/claro, configuraciones de notificacion).</p>
        <h3>Cookies de Publicidad</h3>
        <p>Utilizadas para mostrar contenido patrocinado relevante en la plataforma.</p>

        <h2>3. Control de Cookies</h2>
        <p>Puede gestionar sus preferencias de cookies desde la configuracion de su navegador. Tenga en cuenta que deshabilitar cookies esenciales puede afectar el funcionamiento de BRUNO.</p>

        <h2>4. Cookies de Terceros</h2>
        <p>Algunos servicios integrados (mapas, analytics, redes sociales) pueden establecer sus propias cookies. BRUNO no controla estas cookies de terceros.</p>

        <h2>5. Actualizaciones</h2>
        <p>Podemos actualizar esta politica periodicamente. Le notificaremos sobre cambios significativos.</p>

        <h2>6. Contacto</h2>
        <p>Para preguntas sobre nuestra politica de cookies, contactenos en: cookies@bruno.social</p>
      </main>
    </div>
  );
};

export default CookiePolicyPage;
