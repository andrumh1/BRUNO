import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Mail, Receipt, CheckCircle2, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";
import { MarketplaceOrderCard, PiupOrderCard } from "@/components/marketplace/OrderCards";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const KIND = { live_ticket: "Entrada a live", gift: "Regalo en vivo", marketplace: "Marketplace", marketplace_order: "Marketplace", piup: "PIUP · OVC", promotion: "Promoción", credits: "Créditos" };
const STATUS = { paid: "Pagado", partially_refunded: "Reembolso parcial", refunded: "Reembolsado", initiated: "Pendiente", failed: "Fallido", expired: "Caducado" };
const LINK = { live_ticket: (r) => `/lives/${r}`, gift: (r) => `/lives/${r}`, marketplace: (r) => `/marketplace/${r}`, marketplace_order: () => "/purchases?tab=orders", piup: () => "/purchases?tab=piup", promotion: () => "/monetization" };
const PIUP_STATUSES = { pending_payment: "Pendiente de pago", pending: "Solicitud manual", paid: "Pagado", processing: "En producción", encoding: "Grabando NFC", shipped: "Enviado", delivered: "Entregado", cancelled: "Cancelado", refunded: "Reembolsado", partially_refunded: "Reembolso parcial", failed: "Pago rechazado", expired: "Expirado" };

const PurchaseRow = ({ p, onResend, busy }) => (
  <div className="rounded-2xl border border-border/60 p-3 text-sm space-y-2" data-testid={`purchase-${p.id}`}>
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0"><Receipt className="w-4 h-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="font-medium truncate">{p.name}</p>
        <p className="text-[11px] text-muted-foreground">{KIND[p.kind] || p.kind} · {new Date(p.date).toLocaleString("es")} · <span data-testid={`purchase-status-${p.id}`}>{STATUS[p.status] || p.status}</span></p>
        {p.receipt_sent_at && <p className="text-[11px] text-emerald-600 flex items-center gap-1" data-testid={`purchase-receipt-${p.id}`}><CheckCircle2 className="w-3 h-3" /> Recibo enviado a {p.receipt_to}</p>}
      </div>
      <p className="font-bold tabular-nums shrink-0">{fmtMoney(p.total, p.currency)}</p>
    </div>
    <div className="flex gap-2">
      {["paid", "partially_refunded", "refunded"].includes(p.status) && (
        <Button size="sm" variant="outline" className="rounded-full h-9" onClick={() => onResend(p)} disabled={busy === p.id} data-testid={`purchase-resend-${p.id}`}>
          {busy === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Mail className="w-4 h-4 mr-1.5" /> Reenviar recibo</>}
        </Button>
      )}
      {LINK[p.kind] && <Button size="sm" variant="ghost" className="rounded-full h-9" asChild><a href={LINK[p.kind](p.ref_id)} data-testid={`purchase-open-${p.id}`}><ExternalLink className="w-4 h-4 mr-1.5" /> Abrir</a></Button>}
    </div>
  </div>
);

const TABS = [{ id: "all", label: "Pagos" }, { id: "orders", label: "Pedidos Marketplace" }, { id: "piup", label: "Pedidos PIUP" }];

export default function MyPurchasesPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "all";
  const [list, setList] = useState(null);
  const [orders, setOrders] = useState(null);
  const [piup, setPiup] = useState(null);
  const [busy, setBusy] = useState("");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/money/purchases`, { headers }).then((r) => setList(r.data)).catch(() => setList([]));
    axios.get(`${API}/marketplace/orders/mine`, { headers }).then((r) => setOrders(r.data)).catch(() => setOrders({ orders: [], statuses: {} }));
    axios.get(`${API}/piup/orders`, { headers }).then((r) => setPiup(r.data.orders || [])).catch(() => setPiup([]));
    // eslint-disable-next-line
  }, [token]);

  const resend = async (p) => {
    setBusy(p.id);
    try { const r = await axios.post(`${API}/money/purchases/${p.id}/receipt`, {}, { headers }); brunoToast.success("Recibo enviado", { description: `Revisa ${r.data.to}` }); setList((l) => l.map((x) => (x.id === p.id ? { ...x, receipt_sent_at: new Date().toISOString(), receipt_to: r.data.to } : x))); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo reenviar el recibo"); }
    finally { setBusy(""); }
  };

  const Spinner = <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background" data-testid="purchases-page">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/40" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="h-14 px-3 flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="purchases-back"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-base font-bold">Mis compras</h1></div>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {TABS.map((t) => <button key={t.id} onClick={() => setParams({ tab: t.id })} className={`px-3 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${tab === t.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`} data-testid={`purchases-tab-${t.id}`}>{t.label}</button>)}
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {tab === "all" && (<>
          <p className="text-xs text-muted-foreground">Cada pago confirmado te llega también por correo. Si no lo encuentras, reenvíalo desde aquí.</p>
          {list === null ? Spinner : list.length === 0 ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="purchases-empty">Aún no has comprado nada en BRUNO.</p> : list.map((p) => <PurchaseRow key={p.id} p={p} onResend={resend} busy={busy} />)}
        </>)}
        {tab === "orders" && (orders === null ? Spinner : orders.orders.length === 0 ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="orders-empty">No tienes pedidos del Marketplace.</p>
          : orders.orders.map((o) => <MarketplaceOrderCard key={o.id} order={o} role="buyer" statuses={orders.statuses} headers={headers} onChange={(u) => setOrders((s) => ({ ...s, orders: s.orders.map((x) => (x.id === u.id ? u : x)) }))} />))}
        {tab === "piup" && (piup === null ? Spinner : piup.length === 0 ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="piup-orders-empty">No tienes pedidos PIUP.</p>
          : piup.map((o) => <PiupOrderCard key={o.id} order={o} statuses={PIUP_STATUSES} />))}
        <div style={{ height: "var(--content-bottom)" }} />
      </div>
    </div>
  );
}
