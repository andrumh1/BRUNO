import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import axios from "axios";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Clock,
  CheckCircle2,
  BarChart3,
  Zap,
  Loader2,
  Package,
  Percent,
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StatCard = ({ icon: Icon, label, value, sub, color = "text-primary" }) => (
  <Card className="glass-card" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
    <CardContent className="p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color} bg-current/10`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </CardContent>
  </Card>
);

const PartnerDashboardPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/deal/partner/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data);
    } catch (err) {
      // fetch failed
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchDashboard();
  }, [token, fetchDashboard]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const s = data?.summary || {};
  const fmt = (n) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div className="min-h-screen bg-background pb-24" data-testid="partner-dashboard">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="partner-back-btn">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500" />
            <h1 className="text-lg font-bold">Partner Dashboard</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 gap-3" data-testid="partner-summary">
          <StatCard icon={DollarSign} label="Total Ganado" value={fmt(s.total_earned)} color="text-emerald-500" />
          <StatCard icon={ShoppingBag} label="Ordenes Totales" value={s.total_orders || 0} color="text-blue-500" />
          <StatCard icon={TrendingUp} label="Volumen Ventas" value={fmt(s.total_sales_volume)} color="text-purple-500" />
          <StatCard icon={Percent} label="Conversion" value={`${s.conversion_rate || 0}%`} sub={`${s.paid_orders || 0} pagadas / ${s.pending_orders || 0} pendientes`} color="text-amber-500" />
        </div>

        {/* Monthly Chart */}
        {data?.monthly?.length > 0 && (
          <Card className="glass-card" data-testid="partner-monthly-chart">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Rendimiento Mensual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.monthly.map((m) => {
                const maxRev = Math.max(...data.monthly.map((x) => x.revenue || 1));
                const pct = Math.max(((m.revenue || 0) / maxRev) * 100, 4);
                return (
                  <div key={m.month} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">{m.month}</span>
                    <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-20 text-right">{fmt(m.revenue)}</span>
                    <span className="text-[10px] text-muted-foreground w-12 text-right">{m.orders}ord</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Top Products */}
        {data?.top_products?.length > 0 && (
          <Card className="glass-card" data-testid="partner-top-products">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Package className="w-4 h-4" /> Top Productos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.top_products.map((p, idx) => (
                <div key={p.name} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-muted-foreground">{p.count} ventas</p>
                  </div>
                  <span className="text-sm font-bold text-emerald-500">{fmt(p.revenue)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Recent Commissions */}
        <Card className="glass-card" data-testid="partner-recent-commissions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Comisiones Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recent_commissions || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aun no hay comisiones</p>
            ) : (
              <div className="space-y-2">
                {data.recent_commissions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div>
                      <p className="text-xs font-mono text-muted-foreground">{c.deal_id || c.order_id?.slice(0, 8)}</p>
                      <p className="text-[10px] text-muted-foreground">{c.created_at?.slice(0, 10)}</p>
                    </div>
                    <span className="text-sm font-bold text-emerald-500">+{fmt(c.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="glass-card" data-testid="partner-recent-orders">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4" /> Ordenes Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recent_orders || []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aun no hay ordenes</p>
            ) : (
              <div className="space-y-2">
                {data.recent_orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.product_name}</p>
                      <p className="text-[10px] text-muted-foreground">{o.created_at?.slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{fmt(o.total)}</span>
                      {o.status === "paid" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PartnerDashboardPage;
