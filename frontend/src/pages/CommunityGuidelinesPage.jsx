import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const CommunityGuidelinesPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-9 w-9">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-base font-bold">Normas de la Comunidad</h1>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8 prose prose-sm dark:prose-invert">
        <p className="text-sm text-muted-foreground">Ultima actualizacion: Marzo 2026</p>

        <h2>1. Respeto Mutuo</h2>
        <p>BRUNO es una comunidad profesional. Trata a todos con respeto y cortesia. No se tolera el acoso, bullying, discriminacion ni discursos de odio.</p>

        <h2>2. Contenido Permitido</h2>
        <ul>
          <li>Publicaciones profesionales y de networking</li>
          <li>Contenido educativo y de valor</li>
          <li>Promocion de servicios y productos legitimos</li>
          <li>Eventos profesionales y oportunidades laborales</li>
        </ul>

        <h2>3. Contenido Prohibido</h2>
        <ul>
          <li>Contenido explicito, violento o ilegal</li>
          <li>Spam, phishing o estafas</li>
          <li>Suplantacion de identidad</li>
          <li>Informacion falsa o enganosa</li>
          <li>Contenido que infrinja derechos de autor</li>
          <li>Publicidad no autorizada o invasiva</li>
        </ul>

        <h2>4. Tarjetas Profesionales</h2>
        <p>Las tarjetas deben contener informacion veridica. No se permite crear tarjetas con identidades falsas o con propositos fraudulentos.</p>

        <h2>5. Productos NFC (PIUP)</h2>
        <p>Los productos NFC de BRUNO son exclusivos de la plataforma. Queda prohibido manipular, clonar o usar los tags NFC para fines no autorizados.</p>

        <h2>6. Sistema de Reportes</h2>
        <p>Si encuentras contenido que viola estas normas, usa el boton de reporte. Nuestro equipo revisara cada caso en un plazo de 24-48 horas.</p>

        <h2>7. Sanciones</h2>
        <ul>
          <li><strong>Primera infraccion:</strong> Advertencia y eliminacion del contenido</li>
          <li><strong>Segunda infraccion:</strong> Suspension temporal (7 dias)</li>
          <li><strong>Tercera infraccion:</strong> Suspension permanente de la cuenta</li>
          <li><strong>Infracciones graves:</strong> Eliminacion inmediata de la cuenta</li>
        </ul>

        <h2>8. Contacto</h2>
        <p>Para reportar problemas o apelar una sancion: community@bruno.social</p>
      </main>
    </div>
  );
};

export default CommunityGuidelinesPage;
