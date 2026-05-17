import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Crown,
  BarChart3,
  Shield,
  Zap,
  Star,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const PremiumPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [packages, setPackages] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchData();
  }, [token]);

  // Poll payment status when returning from Stripe
  useEffect(() => {
    if (!sessionId || !token || pollCount >= 5) return;

    const checkStatus = async () => {
      try {
        const res = await axios.get(`${API}/payments/status/${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPaymentStatus(res.data);
        if (res.data.payment_status === "paid") {
          fetchData(); // Refresh subscription
          return;
        }
        if (res.data.status === "expired") return;
        // Continue polling
        setPollCount(prev => prev + 1);
      } catch (e) {
        // error handled
      }
    };

    const timer = setTimeout(checkStatus, pollCount === 0 ? 500 : 2000);
    return () => clearTimeout(timer);
  }, [sessionId, token, pollCount]);

  const fetchData = async () => {
    try {
      const [pkgRes, subRes] = await Promise.all([
        axios.get(`${API}/payments/packages`),
        axios.get(`${API}/payments/subscription`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setPackages(pkgRes.data);
      setSubscription(subRes.data);
    } catch (e) {
      // error handled
    } finally {
      setLoading(false);
    }
  };

  const handleCheckout = async (packageId) => {
    setCheckoutLoading(packageId);
    try {
      const res = await axios.post(`${API}/payments/checkout`, {
        package_id: packageId,
        origin_url: window.location.origin
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (e) {
      // error handled
      alert("Error al iniciar el pago. Intenta de nuevo.");
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Payment success/failure view
  if (sessionId && paymentStatus) {
    const isPaid = paymentStatus.payment_status === "paid";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" data-testid="payment-result">
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center max-w-sm">
          {isPaid ? (
            <>
              <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Pago exitoso</h2>
              <p className="text-muted-foreground mb-1">{paymentStatus.package_name}</p>
              <p className="text-muted-foreground text-sm mb-6">${paymentStatus.amount} USD</p>
              <Button onClick={() => navigate("/analytics")} className="rounded-full">
                Ir a Analytics <BarChart3 className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : paymentStatus.status === "expired" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Pago expirado</h2>
              <p className="text-muted-foreground mb-6">La sesion de pago expiro. Intenta de nuevo.</p>
              <Button onClick={() => navigate("/premium")} className="rounded-full">Volver a intentar</Button>
            </>
          ) : (
            <>
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Procesando pago...</h2>
              <p className="text-muted-foreground text-sm">Verificando con Stripe...</p>
            </>
          )}
        </motion.div>
      </div>
    );
  }

  const isActive = subscription?.is_active;

  return (
    <div className="min-h-screen bg-background" data-testid="premium-page">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h1 className="font-bold text-lg">Bruno Premium</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Active subscription banner */}
        {isActive && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20">
              <CardContent className="p-4 flex items-center gap-3">
                <Crown className="w-8 h-8 text-amber-500" />
                <div>
                  <p className="font-bold">Plan Activo: {subscription.tier}</p>
                  <p className="text-xs text-muted-foreground">
                    Expira: {new Date(subscription.expires).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Hero */}
        <div className="text-center py-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
              <Crown className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Desbloquea todo el potencial</h2>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Obtiene metricas detalladas de tus tarjetas, badge verificado y mucho mas
            </p>
          </motion.div>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: BarChart3, label: "Analytics detallados", color: "text-blue-500" },
            { icon: Shield, label: "Badge verificado", color: "text-amber-500" },
            { icon: Zap, label: "Prioridad en feed", color: "text-purple-500" },
            { icon: Star, label: "Sin anuncios", color: "text-green-500" },
          ].map((f, i) => (
            <motion.div
              key={`f-${i}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="glass-card">
                <CardContent className="p-3 text-center">
                  <f.icon className={`w-6 h-6 ${f.color} mx-auto mb-1.5`} />
                  <p className="text-xs font-medium">{f.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Pricing cards */}
        <div className="grid sm:grid-cols-3 gap-4">
          {Object.entries(packages).map(([id, pkg], i) => {
            const isPopular = id === "analytics_monthly";
            const isCurrent = subscription?.tier === id && isActive;
            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
              >
                <Card className={`relative overflow-hidden ${isPopular ? "ring-2 ring-primary shadow-lg shadow-primary/10" : "glass-card"}`}>
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                      Popular
                    </div>
                  )}
                  <CardContent className="p-5">
                    <h3 className="font-bold text-sm mb-1">{pkg.name}</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-3xl font-bold">${pkg.amount}</span>
                      <span className="text-xs text-muted-foreground">USD</span>
                    </div>
                    
                    <div className="space-y-2 mb-5">
                      {pkg.features.map((f, fi) => (
                        <div key={fi} className="flex items-center gap-2 text-xs">
                          <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button
                      className="w-full rounded-full"
                      variant={isPopular ? "default" : "outline"}
                      disabled={isCurrent || checkoutLoading === id}
                      onClick={() => handleCheckout(id)}
                      data-testid={`checkout-${id}`}
                    >
                      {checkoutLoading === id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCurrent ? (
                        "Plan actual"
                      ) : (
                        <>
                          Suscribirse <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Payment history */}
        {subscription?.payment_history?.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-3">Historial de pagos</h3>
                <div className="space-y-2">
                  {subscription.payment_history.map((txn, i) => (
                    <div key={`txn-${i}`} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{txn.package_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(txn.paid_at || txn.created_at).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">${txn.amount}</p>
                        <p className="text-[10px] text-green-500 font-medium">Pagado</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default PremiumPage;
