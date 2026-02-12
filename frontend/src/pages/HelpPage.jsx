import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  HelpCircle, 
  BookOpen, 
  Video, 
  MessageSquare,
  ChevronDown,
  ChevronUp
} from "lucide-react";

const HelpPage = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      question: "¿Cómo creo mi primera tarjeta digital?",
      answer: "Para crear tu primera tarjeta, inicia sesión y ve a 'Crear Nueva Tarjeta' en el dashboard. Selecciona el tipo de tarjeta (Personal, Empresarial, Negocio o Lugares), completa la información y personaliza el diseño con tus colores favoritos."
    },
    {
      question: "¿Puedo compartir mi tarjeta sin que otros la editen?",
      answer: "Sí, absolutamente. Cuando compartes tu tarjeta, otros solo pueden verla. Solo tú puedes editarla desde tu cuenta. Cada tarjeta tiene su propio link permanente que puedes compartir de forma segura."
    },
    {
      question: "¿Cómo funciona el sistema NFC?",
      answer: "Si tienes una tarjeta NFC física de BRUNO, puedes vincularla a una de tus tarjetas digitales desde el dashboard. Cuando alguien escanee tu tarjeta física, verá automáticamente tu tarjeta digital."
    },
    {
      question: "¿Cómo solicito tarjetas NFC físicas?",
      answer: "Desde tu dashboard, selecciona la tarjeta que quieres en físico y haz clic en 'Solicitar Tarjeta NFC'. Ingresa tu dirección de envío y recibirás tus tarjetas físicas que podrás activar fácilmente."
    },
    {
      question: "¿Puedo tener múltiples tarjetas?",
      answer: "¡Sí! Puedes crear tantas tarjetas como necesites. Por ejemplo, una personal, una de tu negocio, y otra para un lugar turístico. Gestiónalas todas desde tu dashboard."
    },
    {
      question: "¿Los códigos QR son permanentes?",
      answer: "Sí, los códigos QR y links de tus tarjetas son permanentes y nunca cambian. Puedes imprimirlos en tarjetas físicas, folletos o donde quieras sin preocuparte de que expiren."
    },
    {
      question: "¿Cómo instalo BRUNO como app en mi teléfono?",
      answer: "BRUNO es una PWA (Progressive Web App). En iOS: Safari > Compartir > Agregar a pantalla de inicio. En Android: Chrome > Menú > Instalar app. También estará disponible en las tiendas próximamente."
    },
    {
      question: "¿Puedo cambiar el diseño de mi tarjeta después de crearla?",
      answer: "Sí, puedes editar tu tarjeta en cualquier momento. Los cambios se reflejan inmediatamente en el link compartido, sin necesidad de cambiar el QR o link."
    },
    {
      question: "¿Las tarjetas funcionan offline?",
      answer: "Las tarjetas públicas necesitan conexión para verse. Sin embargo, si instalas BRUNO como app, podrás acceder a tu dashboard y gestionar tus tarjetas incluso sin internet."
    },
    {
      question: "¿Cómo agrego mis redes sociales?",
      answer: "En tu perfil, puedes configurar todas tus redes sociales. Luego, al crear o editar una tarjeta, selecciona cuáles quieres mostrar en esa tarjeta específica. Cada red se muestra con su logo oficial."
    }
  ];

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const filteredFaqs = searchQuery
    ? faqs.filter(
        (faq) =>
          faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : faqs;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/bruno-logo.png" alt="BRUNO" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/contact">
              <Button variant="ghost">Contacto</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Iniciar Sesión</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <HelpCircle className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Centro de Ayuda</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Encuentra respuestas rápidas a tus preguntas sobre BRUNO
          </p>
        </div>

        {/* Búsqueda */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Busca tu pregunta aquí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>

        {/* Enlaces rápidos */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Guías</h3>
              <p className="text-sm text-muted-foreground">
                Tutoriales paso a paso
              </p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardContent className="pt-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Video className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Videos</h3>
              <p className="text-sm text-muted-foreground">
                Aprende viendo
              </p>
            </CardContent>
          </Card>

          <Link to="/contact">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">Contáctanos</h3>
                <p className="text-sm text-muted-foreground">
                  Habla con soporte
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Preguntas Frecuentes */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8">Preguntas Frecuentes</h2>
          
          {filteredFaqs.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <p className="text-muted-foreground">
                  No se encontraron resultados para "{searchQuery}"
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <Card key={index} className="overflow-hidden">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left p-6 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold pr-4">{faq.question}</h3>
                      {openFaq === index ? (
                        <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  </button>
                  {openFaq === index && (
                    <div className="px-6 pb-6">
                      <p className="text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* CTA de contacto */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>¿No encontraste lo que buscabas?</CardTitle>
              <CardDescription>
                Nuestro equipo de soporte está aquí para ayudarte
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button size="lg">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Contactar Soporte
                </Button>
              </Link>
              <a href="mailto:soporte@bruno.com">
                <Button size="lg" variant="outline">
                  soporte@bruno.com
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default HelpPage;
