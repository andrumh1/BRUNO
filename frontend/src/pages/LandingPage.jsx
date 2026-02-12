import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DownloadAppButton from "@/components/DownloadAppButton";
import { ArrowRight, Share2, Sparkles, QrCode, Smartphone } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Blurred Bubbles Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-80 h-80 bg-accent/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
        <div className="absolute bottom-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }}></div>
        <div className="absolute bottom-40 right-1/3 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }}></div>
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/bruno-logo.png" alt="BRUNO" className="h-10" />
          </div>
          <div className="flex items-center gap-4">
            <DownloadAppButton variant="ghost" />
            <Link to="/contact">
              <Button variant="ghost">Contacto</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">Iniciar Sesión</Button>
            </Link>
            <Link to="/register">
              <Button>Comenzar</Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Tarjetas digitales del futuro</span>
        </div>
        
        <h1 className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
          Tu identidad
          <br />
          digital única
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
          Crea tarjetas de presentación digitales minimalistas con estilo futurista.
          Comparte tu información con un simple código QR.
        </p>
        
        <div className="flex items-center justify-center gap-4 mb-20">
          <Link to="/register">
            <Button size="lg" className="text-lg px-8">
              Crear mi tarjeta
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link to="/c/demo-card">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Ver demo
            </Button>
          </Link>
        </div>

        {/* Demo Card Preview */}
        <div className="max-w-md mx-auto backdrop-blur-xl bg-gradient-to-br from-primary/10 to-accent/10 rounded-3xl p-8 border border-primary/20 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              JD
            </div>
            <div className="flex gap-2">
              <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                <Share2 className="w-5 h-5 text-primary" />
              </div>
              <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-sm flex items-center justify-center">
                <QrCode className="w-5 h-5 text-primary" />
              </div>
            </div>
          </div>
          <h3 className="text-2xl font-bold mb-2">Juan Diseñador</h3>
          <p className="text-muted-foreground mb-4">UX Designer @ Tech Co</p>
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/30 backdrop-blur-sm"></div>
            <div className="w-12 h-12 rounded-full bg-accent/30 backdrop-blur-sm"></div>
            <div className="w-12 h-12 rounded-full bg-primary/20 backdrop-blur-sm"></div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Todo lo que necesitas</h2>
          <p className="text-xl text-muted-foreground">
            Herramientas poderosas para crear y compartir tu identidad profesional digital
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="backdrop-blur-xl bg-card/50 rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Diseño Personalizado</h3>
            <p className="text-muted-foreground">
              Tarjetas elegantes con animaciones fluidas y estética futurista que impresionan.
            </p>
          </div>

          <div className="backdrop-blur-xl bg-card/50 rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <QrCode className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Código QR</h3>
            <p className="text-muted-foreground">
              Genera códigos QR únicos para compartir tu tarjeta instantáneamente.
            </p>
          </div>

          <div className="backdrop-blur-xl bg-card/50 rounded-2xl p-8 border border-border/50 hover:border-primary/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Smartphone className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Panel de Control</h3>
            <p className="text-muted-foreground">
              Gestiona todas tus tarjetas y visualiza estadísticas de visualizaciones.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <h2 className="text-4xl font-bold mb-4">Comienza a crear tu tarjeta</h2>
        <p className="text-xl text-muted-foreground mb-8">
          Únete a miles de profesionales que ya usan BRUNO para compartir su identidad digital.
        </p>
        <Link to="/register">
          <Button size="lg" className="text-lg px-8">
            Crear cuenta gratis
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            {/* Columna 1: BRUNO */}
            <div>
              <img src="/bruno-logo.png" alt="BRUNO" className="h-8 mb-4" />
              <p className="text-sm text-muted-foreground">
                Tarjetas digitales del futuro
              </p>
            </div>

            {/* Columna 2: Enlaces */}
            <div>
              <h4 className="font-semibold mb-3">Producto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/pricing" className="hover:text-primary transition-colors">Planes</Link></li>
                <li><Link to="/register" className="hover:text-primary transition-colors">Crear Cuenta</Link></li>
                <li><DownloadAppButton variant="link" size="sm" className="p-0 h-auto text-muted-foreground hover:text-primary" /></li>
              </ul>
            </div>

            {/* Columna 3: Ayuda */}
            <div>
              <h4 className="font-semibold mb-3">Soporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/contact" className="hover:text-primary transition-colors">Contacto</Link></li>
                <li><Link to="/help" className="hover:text-primary transition-colors">Ayuda</Link></li>
                <li><a href="mailto:soporte@bruno.com" className="hover:text-primary transition-colors">soporte@bruno.com</a></li>
              </ul>
            </div>

            {/* Columna 4: Legal */}
            <div>
              <h4 className="font-semibold mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/terms" className="hover:text-primary transition-colors">Términos</Link></li>
                <li><Link to="/privacy" className="hover:text-primary transition-colors">Privacidad</Link></li>
              </ul>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground border-t border-border/50 pt-6">
            <p>© 2025 BRUNO. Tarjetas digitales del futuro.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
