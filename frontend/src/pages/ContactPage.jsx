import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MapPin, Phone, Send, MessageSquare } from "lucide-react";

const ContactPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Aquí se integrará con el backend cuando esté listo
    console.log("Form submitted:", formData);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/bruno-logo.png" alt="BRUNO" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/help">
              <Button variant="ghost">Ayuda</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Iniciar Sesión</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Contáctanos</h1>
          <p className="text-xl text-muted-foreground">
            Estamos aquí para ayudarte. Envíanos un mensaje y te responderemos pronto.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Formulario de contacto */}
          <Card>
            <CardHeader>
              <CardTitle>Envíanos un mensaje</CardTitle>
              <CardDescription>
                Completa el formulario y nos pondremos en contacto contigo lo antes posible
              </CardDescription>
            </CardHeader>
            <CardContent>
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">¡Mensaje enviado!</h3>
                  <p className="text-muted-foreground">
                    Gracias por contactarnos. Te responderemos pronto.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nombre completo</label>
                    <Input
                      name="name"
                      placeholder="Tu nombre"
                      value={formData.name}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      name="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Asunto</label>
                    <Input
                      name="subject"
                      placeholder="¿En qué podemos ayudarte?"
                      value={formData.subject}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Mensaje</label>
                    <textarea
                      name="message"
                      placeholder="Describe tu consulta..."
                      value={formData.message}
                      onChange={handleChange}
                      required
                      rows={5}
                      className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Mensaje
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Información de contacto */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Información de Contacto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Email</h4>
                    <a href="mailto:contacto@bruno.com" className="text-sm text-muted-foreground hover:text-primary">
                      contacto@bruno.com
                    </a>
                    <br />
                    <a href="mailto:soporte@bruno.com" className="text-sm text-muted-foreground hover:text-primary">
                      soporte@bruno.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Phone className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Teléfono</h4>
                    <p className="text-sm text-muted-foreground">
                      +1 (555) 123-4567
                      <br />
                      Lun - Vie: 9:00 AM - 6:00 PM
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Dirección</h4>
                    <p className="text-sm text-muted-foreground">
                      Calle Principal 123
                      <br />
                      Ciudad, País
                      <br />
                      Código Postal
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Síguenos en Redes Sociales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <a
                    href="https://instagram.com/bruno"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-[#E4405F]/10 flex items-center justify-center hover:bg-[#E4405F]/20 transition-colors"
                  >
                    <span className="text-[#E4405F] font-bold">IG</span>
                  </a>
                  <a
                    href="https://facebook.com/bruno"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-[#1877F2]/10 flex items-center justify-center hover:bg-[#1877F2]/20 transition-colors"
                  >
                    <span className="text-[#1877F2] font-bold">FB</span>
                  </a>
                  <a
                    href="https://twitter.com/bruno"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-full bg-[#1DA1F2]/10 flex items-center justify-center hover:bg-[#1DA1F2]/20 transition-colors"
                  >
                    <span className="text-[#1DA1F2] font-bold">X</span>
                  </a>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  @bruno.oficial (Ejemplo - Actualizar cuando estén listos)
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  ¿Necesitas ayuda inmediata?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Visita nuestro centro de ayuda para encontrar respuestas rápidas a preguntas frecuentes.
                </p>
                <Link to="/help">
                  <Button variant="outline" className="w-full">
                    Ir al Centro de Ayuda
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ContactPage;
