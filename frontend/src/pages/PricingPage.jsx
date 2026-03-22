import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import axios from "axios";
import { Check, Star, Zap, Building2, Users, Loader2, CheckCircle2, XCircle } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PricingPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);

  // Check for session_id in URL (return from Stripe)
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (sessionId) {
      checkPaymentStatus(sessionId);
    }
  }, [searchParams]);

  const checkPaymentStatus = async (sessionId) => {
    try {
      const response = await axios.get(`${API}/payments/checkout/status/${sessionId}`);
      setPaymentStatus(response.data);
    } catch (error) {
      console.error("Error checking payment status:", error);
      setPaymentStatus({ status: "error", payment_status: "failed" });
    }
  };

  const handleCheckout = async (planId, packageId = null) => {
    if (!user || !token) {
      navigate("/login");
      return;
    }

    setLoading(planId || packageId);

    try {
      const payload = {
        origin: window.location.origin,
      };
      
      if (planId) {
        payload.plan_id = planId;
      } else if (packageId) {
        payload.package_id = packageId;
      }

      const response = await axios.post(`${API}/payments/checkout`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Redirect to Stripe Checkout
      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error("Error creating checkout session:", error);
      alert(t("common.error"));
    } finally {
      setLoading(null);
    }
  };

  const plans = [
    {
      name: t("cards.types.personal"),
      icon: Star,
      price: t("pricing.free"),
      period: t("pricing.forever"),
      description: "Perfecto para individuos",
      features: [
        "1 tarjeta digital",
        "Códigos QR ilimitados",
        "Compartir sin límites",
        "Edición básica",
        "Soporte por email"
      ],
      cta: t("pricing.startFree"),
      highlighted: false,
      type: "free",
      planId: null
    },
    {
      name: "Bruno Personal",
      icon: Star,
      price: "$4.99",
      period: t("pricing.month"),
      description: "Para profesionales",
      features: [
        "5 tarjetas digitales",
        "Códigos QR personalizados",
        "Plantillas premium",
        "Sin marca de agua",
        "Analytics básico",
        "Soporte prioritario"
      ],
      cta: t("pricing.startTrial"),
      highlighted: false,
      type: "subscription",
      planId: "bruno_personal"
    },
    {
      name: "Bruno Business",
      icon: Building2,
      price: "$14.99",
      period: t("pricing.month"),
      description: "Para pequeños equipos",
      features: [
        "Hasta 10 usuarios",
        "Tarjetas ilimitadas",
        "5 tarjetas NFC incluidas",
        "Panel de administración",
        "Diseños personalizados",
        "Analytics avanzado",
        "API access"
      ],
      cta: t("pricing.startTrial"),
      highlighted: true,
      type: "subscription",
      planId: "bruno_business"
    },
    {
      name: "Bruno Corporate",
      icon: Users,
      price: "$39.99",
      period: t("pricing.month"),
      description: "Para grandes empresas",
      features: [
        "Usuarios ilimitados",
        "Todo de Business, más:",
        "20 tarjetas NFC incluidas",
        "Branding personalizado",
        "Gerente de cuenta",
        "Integración SSO",
        "SLA garantizado",
        "Soporte 24/7"
      ],
      cta: t("pricing.startTrial"),
      highlighted: false,
      type: "subscription",
      planId: "bruno_corporate"
    }
  ];

  // Payment Status Modal
  if (paymentStatus) {
    const isSuccess = paymentStatus.payment_status === "paid" || paymentStatus.status === "complete";
    
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full glass-card">
          <CardContent className="pt-8 pb-8 text-center">
            {isSuccess ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">¡Pago Exitoso!</h2>
                <p className="text-muted-foreground mb-6">
                  Tu suscripción ha sido activada correctamente. Ya puedes disfrutar de todas las funciones premium.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <XCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Pago No Completado</h2>
                <p className="text-muted-foreground mb-6">
                  El pago no se completó. Por favor intenta de nuevo o contacta soporte si el problema persiste.
                </p>
              </>
            )}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => navigate("/my-profile")}>
                Ir al Panel
              </Button>
              <Button className="flex-1" onClick={() => setPaymentStatus(null)}>
                Ver Planes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/">
            <img src="/bruno-logo.png" alt="BRUNO" className="h-10" />
          </Link>
          <div className="flex items-center gap-4">
            <LanguageSwitcher variant="minimal" />
            <Link to="/contact">
              <Button variant="ghost">{t("nav.contact")}</Button>
            </Link>
            <Link to="/login">
              <Button variant="ghost">{t("nav.login")}</Button>
            </Link>
            <Link to="/register">
              <Button>{t("nav.register")}</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-4">{t("pricing.title")}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t("pricing.subtitle")}
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {plans.map((plan, index) => {
            const Icon = plan.icon;
            const isLoading = loading === plan.planId;
            
            return (
              <Card
                key={index}
                className={`relative glass-card ${
                  plan.highlighted
                    ? "border-primary shadow-xl scale-105"
                    : "border-border"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-sm font-medium rounded-full">
                    {t("pricing.mostPopular")}
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
                    {plan.period && plan.type !== "free" && (
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

                  {plan.type === "free" ? (
                    <Link to="/register">
                      <Button className="w-full" variant={plan.highlighted ? "default" : "outline"}>
                        {plan.cta}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      className="w-full"
                      variant={plan.highlighted ? "default" : "outline"}
                      onClick={() => handleCheckout(plan.planId)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Procesando...
                        </>
                      ) : (
                        plan.cta
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* One-time Purchases */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">Compras Únicas</h2>
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Pack NFC Básico</CardTitle>
                <CardDescription>Ideal para empezar</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$9.99</span>
                  <span className="text-muted-foreground"> único</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    1 tarjeta NFC física
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Diseño estándar
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Envío incluido
                  </li>
                </ul>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleCheckout(null, "nfc_basic")}
                  disabled={loading === "nfc_basic"}
                >
                  {loading === "nfc_basic" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Comprar
                </Button>
              </CardContent>
            </Card>

            <Card className="glass-card border-primary">
              <CardHeader>
                <CardTitle>Pack NFC Pro</CardTitle>
                <CardDescription>Mejor valor</CardDescription>
                <div className="mt-2">
                  <span className="text-3xl font-bold">$24.99</span>
                  <span className="text-muted-foreground"> único</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    3 tarjetas NFC físicas
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Diseño personalizado
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    Envío express incluido
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary" />
                    1 mes Bruno Personal gratis
                  </li>
                </ul>
                <Button
                  className="w-full"
                  onClick={() => handleCheckout(null, "nfc_pro")}
                  disabled={loading === "nfc_pro"}
                >
                  {loading === "nfc_pro" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : null}
                  Comprar
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Features Comparison */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-8">{t("pricing.compareFeatures")}</h2>
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">Característica</th>
                      <th className="text-center p-4 font-semibold">Gratis</th>
                      <th className="text-center p-4 font-semibold">Personal</th>
                      <th className="text-center p-4 font-semibold">Business</th>
                      <th className="text-center p-4 font-semibold">Corporate</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-4">Tarjetas digitales</td>
                      <td className="text-center p-4">1</td>
                      <td className="text-center p-4">5</td>
                      <td className="text-center p-4">Ilimitadas</td>
                      <td className="text-center p-4">Ilimitadas</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Usuarios</td>
                      <td className="text-center p-4">1</td>
                      <td className="text-center p-4">1</td>
                      <td className="text-center p-4">10</td>
                      <td className="text-center p-4">Ilimitados</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Tarjetas NFC físicas</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4">5</td>
                      <td className="text-center p-4">20</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Panel de administración</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4"><Check className="w-5 h-5 text-primary mx-auto" /></td>
                      <td className="text-center p-4"><Check className="w-5 h-5 text-primary mx-auto" /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-4">Analytics</td>
                      <td className="text-center p-4">-</td>
                      <td className="text-center p-4">Básico</td>
                      <td className="text-center p-4">Avanzado</td>
                      <td className="text-center p-4">Avanzado</td>
                    </tr>
                    <tr>
                      <td className="p-4">Soporte</td>
                      <td className="text-center p-4">Email</td>
                      <td className="text-center p-4">Prioritario</td>
                      <td className="text-center p-4">Chat</td>
                      <td className="text-center p-4">24/7 Dedicado</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">{t("pricing.faq")}</h2>
          <div className="space-y-4">
            <Card className="glass-card">
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

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">¿Ofrecen descuentos anuales?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Sí, al pagar anualmente obtienes 2 meses gratis (equivalente a un 17% de descuento).
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">¿Qué métodos de pago aceptan?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Aceptamos todas las tarjetas de crédito y débito principales (Visa, Mastercard, American Express).
                  También PSE para Colombia y otros métodos locales según tu país.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Final */}
        <div className="mt-16 text-center">
          <Card className="max-w-2xl mx-auto bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 glass-card">
            <CardContent className="pt-8 pb-8">
              <h3 className="text-2xl font-bold mb-4">{t("pricing.customPlan")}</h3>
              <p className="text-muted-foreground mb-6">{t("pricing.customPlanDesc")}</p>
              <Link to="/contact">
                <Button size="lg">{t("pricing.talkToSales")}</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;
