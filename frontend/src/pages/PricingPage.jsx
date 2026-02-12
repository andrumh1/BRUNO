import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star, Zap, Building2, Users } from "lucide-react";

const PricingPage = () => {
  const plans = [
    {
      name: "Personal",
      icon: Star,
      price: "Gratis",
      period: "siempre",
      description: "Perfecto para individuos",
      features: [
        "1 tarjeta digital",
        "Códigos QR ilimitados",
        "Compartir sin límites",
        "Edición básica",
        "Soporte por email"
      ],
      cta: "Comenzar Gratis",
      highlighted: false,
      type: "free"
    },
    {
      name: "Corporativo Básico",
      icon: Building2,
      price: "$29",
      period: "/mes",
      description: "Para pequeñas empresas",
      features: [
        "Hasta 10 empleados",
        "Tarjetas ilimitadas por empleado",
        "Panel de administración",
        "Diseños personalizados",
        "5 tarjetas NFC incluidas",
        "Soporte prioritario",
        "Analytics básico"
      ],
      cta: "Empezar Prueba",
      highlighted: false,
      type: "corporate_basic"
    },
    {
      name: "Corporativo Pro",
      icon: Users,
      price: "$79",
      period: "/mes",
      description: "Para empresas en crecimiento",
      features: [
        "Hasta 50 empleados",
        "Todo de Básico, más:",
        "20 tarjetas NFC incluidas",
        "Plantillas exclusivas",
        "Branding personalizado",
        "Analytics avanzado",
        "API access",
        "Soporte 24/7"
      ],
      cta: "Empezar Prueba",
      highlighted: true,
      type: "corporate_pro"
    },
    {
      name: "Enterprise",
      icon: Zap,
      price: "Custom",
      period: "",
      description: "Para grandes organizaciones",
      features: [
        "Empleados ilimitados",
        "Todo de Pro, más:",
        "Tarjetas NFC ilimitadas",
        "Gerente de cuenta dedicado",
        "Onboarding personalizado",
        "Integración SSO",
        "SLA garantizado",
        "Capacitación del equipo"
      ],
      cta: "Contactar Ventas",
      highlighted: false,
      type: "enterprise"
    }
  ];

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
            <Link to="/register">
              <Button>Comenzar</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">
            Planes para cada necesidad
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Desde individuos hasta grandes empresas. Encuentra el plan perfecto para ti.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            return (
              <Card
                key={index}
                className={`relative ${
                  plan.highlighted
                    ? "border-primary shadow-xl scale-105"
                    : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-medium rounded-full">
                    Más Popular
                  </div>
                )}
                
                <CardHeader>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    {plan.period && (
                      <span className="text-muted-foreground">{plan.period}</span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Link to={plan.type === "enterprise" ? "/contact" : "/register"}>
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Características comparativas */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">
            Compara características
          </h2>
          <Card>
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Característica</th>
                      <th className="text-center p-4 font-semibold">Personal</th>
                      <th className="text-center p-4 font-semibold">Corporativo Básico</th>
                      <th className="text-center p-4 font-semibold">Corporativo Pro</th>
                      <th className="text-center p-4 font-semibold">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-4">Tarjetas digitales</td>
                      <td className="text-center p-4">1</td>
                      <td className="text-center p-4">Ilimitadas</td>
                      <td className="text-center p-4">Ilimitadas</td>
                      <td className="text-center p-4">Ilimitadas</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Empleados</td>
                      <td className="text-center p-4">1</td>
                      <td className="text-center p-4">10</td>
                      <td className="text-center p-4">50</td>
                      <td className="text-center p-4">Ilimitados</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Tarjetas NFC físicas</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4">5</td>
                      <td className="text-center p-4">20</td>
                      <td className="text-center p-4">Ilimitadas</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Panel de administración</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4"><Check className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="text-center p-4"><Check className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="text-center p-4"><Check className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Analytics</td>
                      <td className="text-center p-4">Básico</td>
                      <td className="text-center p-4">Básico</td>
                      <td className="text-center p-4">Avanzado</td>
                      <td className="text-center p-4">Avanzado</td>
                    </tr>
                    <tr>
                      <td className="p-4">Soporte</td>
                      <td className="text-center p-4">Email</td>
                      <td className="text-center p-4">Prioritario</td>
                      <td className="text-center p-4">24/7</td>
                      <td className="text-center p-4">Dedicado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">
            Preguntas Frecuentes sobre Planes
          </h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Puedo cambiar de plan después?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sí, puedes actualizar o cambiar tu plan en cualquier momento desde tu cuenta.
                  Los cambios se aplican inmediatamente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Ofrecen descuentos anuales?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sí, al pagar anualmente obtienes 2 meses gratis (equivalente a un 17% de descuento).
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">¿Qué incluye la prueba gratuita?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Los planes corporativos incluyen 14 días de prueba gratis con acceso completo a todas
                  las funciones. No se requiere tarjeta de crédito.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardContent className="pt-8 pb-8">
              <h3 className="text-2xl font-bold mb-4">
                ¿Necesitas un plan personalizado?
              </h3>
              <p className="text-muted-foreground mb-6">
                Para empresas con necesidades específicas, creamos un plan a tu medida
              </p>
              <Link to="/contact">
                <Button size="lg">
                  Hablar con Ventas
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
