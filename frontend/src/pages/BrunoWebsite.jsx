import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ServicePromoBubble, serviceLang } from "@/components/bruno/ServicePromoBubble";
import { 
  ChevronRight, 
  CreditCard, 
  MessageCircle, 
  Map, 
  ShoppingBag, 
  Smartphone,
  Zap,
  Shield,
  Globe,
  Users,
  Star,
  Play,
  Check,
  ArrowRight,
  Sparkles,
  Mail,
  Phone,
  MapPin,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  Menu,
  X
} from "lucide-react";

// Animated counter component
const AnimatedCounter = ({ end, duration = 2000, suffix = "" }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count.toLocaleString()}{suffix}</span>;
};

// Feature Card
const FeatureCard = ({ icon: Icon, title, description, color }) => (
  <div className="group p-6 bg-white rounded-3xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100">
    <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
      <Icon className="w-7 h-7 text-white" />
    </div>
    <h3 className="text-xl font-bold mb-2 text-gray-900">{title}</h3>
    <p className="text-gray-600 leading-relaxed">{description}</p>
  </div>
);

// Pricing Card
const PricingCard = ({ name, price, period, features, popular, cta }) => (
  <div className={`relative p-8 rounded-3xl ${popular ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white scale-105 shadow-2xl' : 'bg-white shadow-lg border border-gray-100'}`}>
    {popular && (
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-yellow-400 text-yellow-900 text-sm font-bold rounded-full">
        Más Popular
      </div>
    )}
    <h3 className={`text-2xl font-bold mb-2 ${popular ? 'text-white' : 'text-gray-900'}`}>{name}</h3>
    <div className="mb-6">
      <span className="text-4xl font-bold">${price}</span>
      <span className={popular ? 'text-white/70' : 'text-gray-500'}>/{period}</span>
    </div>
    <ul className="space-y-3 mb-8">
      {features.map((feature, i) => (
        <li key={`feature-${i}`} className="flex items-center gap-2">
          <Check className={`w-5 h-5 ${popular ? 'text-yellow-300' : 'text-green-500'}`} />
          <span className={popular ? 'text-white/90' : 'text-gray-600'}>{feature}</span>
        </li>
      ))}
    </ul>
    <Button 
      className={`w-full ${popular ? 'bg-white text-orange-600 hover:bg-gray-100' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
      size="lg"
    >
      {cta}
    </Button>
  </div>
);

// Testimonial Card
const TestimonialCard = ({ name, role, image, quote }) => (
  <div className="p-6 bg-white rounded-3xl shadow-lg border border-gray-100">
    <div className="flex items-center gap-4 mb-4">
      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl">
        {name.charAt(0)}
      </div>
      <div>
        <h4 className="font-bold text-gray-900">{name}</h4>
        <p className="text-sm text-gray-500">{role}</p>
      </div>
    </div>
    <p className="text-gray-600 italic">"{quote}"</p>
    <div className="flex gap-1 mt-4">
      {[1,2,3,4,5].map(i => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
    </div>
  </div>
);

const BrunoWebsite = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-lg shadow-lg' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-xl">B</span>
              </div>
              <span className="text-2xl font-bold text-gray-900">BRUNO</span>
            </Link>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 hover:text-orange-500 transition-colors">Funciones</a>
              <a href="#pricing" className="text-gray-600 hover:text-orange-500 transition-colors">Precios</a>
              <a href="#store" className="text-gray-600 hover:text-orange-500 transition-colors">Tienda</a>
              <a href="#contact" className="text-gray-600 hover:text-orange-500 transition-colors">Contacto</a>
            </div>

            {/* CTA Buttons */}
            <div className="hidden md:flex items-center gap-3">
              <Link to="/login">
                <Button variant="ghost">Iniciar Sesión</Button>
              </Link>
              <Link to="/register">
                <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700">
                  Comenzar Gratis
                </Button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="px-4 py-6 space-y-4">
              <a href="#features" className="block py-2 text-gray-600">Funciones</a>
              <a href="#pricing" className="block py-2 text-gray-600">Precios</a>
              <a href="#store" className="block py-2 text-gray-600">Tienda</a>
              <a href="#contact" className="block py-2 text-gray-600">Contacto</a>
              <div className="pt-4 border-t space-y-2">
                <Link to="/login" className="block">
                  <Button variant="outline" className="w-full">Iniciar Sesión</Button>
                </Link>
                <Link to="/register" className="block">
                  <Button className="w-full bg-gradient-to-r from-orange-500 to-orange-600">Comenzar Gratis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-yellow-200 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full text-orange-600 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            La nueva forma de hacer networking
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 mb-6 leading-tight">
            Tu tarjeta de presentación
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-yellow-500">
              del futuro
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-10">
            Crea tarjetas digitales impresionantes, conecta con profesionales, 
            y haz crecer tu red de contactos como nunca antes.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link to="/register">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-lg px-8 py-6 rounded-full">
                Crear mi tarjeta gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-lg px-8 py-6 rounded-full">
              <Play className="w-5 h-5 mr-2" />
              Ver demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div>
              <p className="text-4xl font-bold text-gray-900">
                <AnimatedCounter end={10000} suffix="+" />
              </p>
              <p className="text-gray-500">Usuarios activos</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">
                <AnimatedCounter end={50000} suffix="+" />
              </p>
              <p className="text-gray-500">Tarjetas creadas</p>
            </div>
            <div>
              <p className="text-4xl font-bold text-gray-900">
                <AnimatedCounter end={1000000} suffix="+" />
              </p>
              <p className="text-gray-500">Conexiones hechas</p>
            </div>
          </div>
        </div>

        {/* Hero Image - Phone Mockup */}
        <div className="max-w-5xl mx-auto mt-16 relative">
          <div className="aspect-video bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden border-8 border-gray-800">
            <div className="w-full h-full bg-gradient-to-br from-orange-400 via-orange-500 to-yellow-500 flex items-center justify-center">
              <div className="text-center text-white">
                <CreditCard className="w-24 h-24 mx-auto mb-4 opacity-50" />
                <p className="text-2xl font-bold">Vista previa de la app</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Todo lo que necesitas en un solo lugar
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              BRUNO combina tarjetas digitales, red social profesional, y herramientas de networking.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={CreditCard}
              title="Tarjetas Digitales"
              description="Crea tarjetas personales, profesionales o de empresa con diseños únicos y compártelas al instante."
              color="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <FeatureCard 
              icon={MessageCircle}
              title="Chat en Tiempo Real"
              description="Mensajes, notas de voz, stickers y videollamadas. Todo en un chat moderno y fácil de usar."
              color="bg-gradient-to-br from-green-500 to-green-600"
            />
            <FeatureCard 
              icon={Map}
              title="Mapa de Contactos"
              description="Descubre profesionales cerca de ti con nuestro mapa interactivo estilo Snapchat."
              color="bg-gradient-to-br from-red-500 to-red-600"
            />
            <FeatureCard 
              icon={Smartphone}
              title="NFC & QR"
              description="Comparte tu tarjeta con un toque NFC o escaneo QR. La forma más rápida de hacer networking."
              color="bg-gradient-to-br from-purple-500 to-purple-600"
            />
            <FeatureCard 
              icon={Users}
              title="Red Social"
              description="Publica contenido, sigue a otros profesionales y construye tu marca personal."
              color="bg-gradient-to-br from-pink-500 to-pink-600"
            />
            <FeatureCard 
              icon={Zap}
              title="BRUNO IA"
              description="Tu asistente inteligente te ayuda a crear tarjetas, responder mensajes y más."
              color="bg-gradient-to-br from-yellow-500 to-orange-500"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-b from-orange-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Planes para cada necesidad
            </h2>
            <p className="text-xl text-gray-600">
              Comienza gratis y escala cuando lo necesites.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto items-center">
            <PricingCard 
              name="Gratis"
              price="0"
              period="siempre"
              features={[
                "1 tarjeta digital",
                "Perfil básico",
                "Chat ilimitado",
                "Compartir QR"
              ]}
              cta="Comenzar Gratis"
            />
            <PricingCard 
              name="Pro"
              price="9.99"
              period="mes"
              popular={true}
              features={[
                "5 tarjetas digitales",
                "Plantillas premium",
                "Videollamadas",
                "Analíticas avanzadas",
                "Soporte prioritario"
              ]}
              cta="Empezar Prueba"
            />
            <PricingCard 
              name="Empresa"
              price="29.99"
              period="mes"
              features={[
                "Tarjetas ilimitadas",
                "Equipo completo",
                "API personalizada",
                "Branding propio",
                "Soporte 24/7"
              ]}
              cta="Contactar Ventas"
            />
          </div>
        </div>
      </section>

      {/* Servicio «Creamos tu tarjeta» (BRUNO + OVC) — mismo destino que Perfil › Tarjetas */}
      <section id="servicio-tarjeta" className="py-16 px-4 bg-white" data-testid="website-service-section">
        <div className="max-w-5xl mx-auto rounded-[32px] p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8" style={{ background: "linear-gradient(120deg,#ffffff88,#ffb36c55)", border: "1px solid #ffffffb3", boxShadow: "inset 0 1px 0 #fff,0 15px 40px #343b3210", backdropFilter: "blur(20px)" }}>
          <img src="/servicios/tarjeta-bruno/assets/bruno-mascota.webp" alt="" className="w-36 h-44 object-cover rounded-[70px_70px_24px_24px] border-4 border-white shadow-lg shrink-0" loading="lazy" />
          <div className="text-center sm:text-left">
            <p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e] mb-3">BRUNO × OVC</p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-gray-900 tracking-tight mb-3">{serviceLang() === "en" ? "Your world, in one card. We create it for you." : "Tu mundo, en una tarjeta. La creamos por ti."}</h2>
            <p className="text-gray-700 mb-6 max-w-xl">{serviceLang() === "en" ? "We design and set up your BRUNO card, its link and its digital QR, with one round of adjustments. One payment: COP $30.000 in Colombia or US$30 in the United States." : "Diseñamos y configuramos tu tarjeta BRUNO, su enlace y su QR digital, con una ronda de ajustes. Un solo pago: COP $30.000 en Colombia o US$30 en Estados Unidos."}</p>
            <ServicePromoBubble variant="banner" from="/website#servicio-tarjeta" />
          </div>
        </div>
      </section>

      {/* Store Preview Section */}
      <section id="store" className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tienda BRUNO
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Tarjetas NFC físicas, productos para tu negocio y servicios de marketing digital.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6">
            {[
              { name: "Tarjeta NFC Negra", price: "$24.99", category: "NFC" },
              { name: "Tarjeta NFC Dorada", price: "$34.99", category: "Premium" },
              { name: "Pack Empresa x10", price: "$199.99", category: "Empresas" },
              { name: "Diseño Personalizado", price: "$49.99", category: "Servicios" }
            ].map((product, i) => (
              <div key={`product-${i}`} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl mb-4 flex items-center justify-center">
                  <CreditCard className="w-16 h-16 text-white/80" />
                </div>
                <span className="text-xs text-orange-500 font-medium">{product.category}</span>
                <h3 className="font-bold text-gray-900 mt-1">{product.name}</h3>
                <p className="text-lg font-bold text-orange-600 mt-2">{product.price}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/store">
              <Button size="lg" variant="outline" className="rounded-full">
                Ver toda la tienda
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-gradient-to-b from-white to-orange-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Lo que dicen nuestros usuarios
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <TestimonialCard 
              name="María García"
              role="CEO, StartupX"
              quote="BRUNO cambió completamente la forma en que hago networking. Mis contactos aumentaron un 300%."
            />
            <TestimonialCard 
              name="Carlos López"
              role="Freelancer"
              quote="La mejor inversión que he hecho. Mi tarjeta NFC siempre impresiona a mis clientes."
            />
            <TestimonialCard 
              name="Ana Martínez"
              role="Consultora"
              quote="El chat y las videollamadas integradas hacen todo más fácil. Una app increíble."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10">
            <h2 className="text-4xl font-bold mb-4">¿Listo para el futuro?</h2>
            <p className="text-xl text-white/80 mb-8">
              Únete a miles de profesionales que ya están usando BRUNO.
            </p>
            <Link to="/register">
              <Button size="lg" className="bg-white text-orange-600 hover:bg-gray-100 text-lg px-8 py-6 rounded-full">
                Crear mi cuenta gratis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-gray-900 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-xl">B</span>
                </div>
                <span className="text-2xl font-bold">BRUNO</span>
              </div>
              <p className="text-gray-400">
                La plataforma de tarjetas digitales y networking profesional más avanzada.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Producto</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#features" className="hover:text-white transition-colors">Funciones</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Precios</a></li>
                <li><Link to="/store" className="hover:text-white transition-colors">Tienda</Link></li>
                <li><Link to="/help" className="hover:text-white transition-colors">Ayuda</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Empresa</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Sobre nosotros</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Carreras</a></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Contacto</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Contacto</h4>
              <ul className="space-y-3 text-gray-400">
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  hola@bruno.com
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  +1 (555) 123-4567
                </li>
                <li className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Ciudad de México, MX
                </li>
              </ul>
              <div className="flex gap-4 mt-6">
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Linkedin className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-white transition-colors">
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-500 text-sm">
              © 2025 BRUNO. Todos los derechos reservados.
            </p>
            <div className="flex gap-6 text-sm text-gray-500">
              <a href="#" className="hover:text-white transition-colors">Privacidad</a>
              <a href="#" className="hover:text-white transition-colors">Términos</a>
              <a href="#" className="hover:text-white transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BrunoWebsite;
