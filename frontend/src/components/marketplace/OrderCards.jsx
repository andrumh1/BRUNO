/* Seguimiento de pedidos del Marketplace (comprador y vendedor) y pedidos PIUP (comprador). */
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Loader2, MessageCircle, Package, Truck, CheckCircle2, XCircle, MapPin, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";
import { OvcMark } from "@/components/brand/OvcAttribution";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STATUS_STYLE = {
  paid: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", processing: "bg-amber-500/10 text-amber-700 dark:text-amber-300", encoding: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  shipped: "bg-sky-500/10 text-sky-700 dark:text-sky-300", delivered: "bg-emerald-600/15 text-emerald-800 dark:text-emerald-200", cancelled: "bg-zinc-500/10 text-zinc-600", refunded: "bg-rose-500/10 text-rose-700",
  partially_refunded: "bg-rose-500/10 text-rose-700", disputed: "bg-rose-600/15 text-rose-800", pending_payment: "bg-zinc-500/10 text-zinc-600", pending: "bg-zinc-500/10 text-zinc-600",
};

export const StatusChip = ({ status, label }) => (
  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] || "bg-muted text-muted-foreground"}`} data-testid={`order-status-${status}`}>{label || status}</span>
);

const Timeline = ({ history = [], statuses = {} }) => (
  <ol className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" data-testid="order-timeline">
    {history.map((h, i) => <li key={i}>{statuses[h.status] || h.status} · {new Date(h.at).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}</li>)}
  </ol>
);

/** role: "buyer" | "seller" */
export const MarketplaceOrderCard = ({ order, role, statuses, headers, onChange }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(order.tracking_number || "");
  const other = role === "buyer" ? order.seller : order.buyer;
  const openChat = async () => {
    try {
      const r = await axios.post(`${API}/chats`, { participant_id: other.id }, { headers });
      navigate(`/chat/${r.data?.id || r.data?.chat_id}`);
    } catch { brunoToast.error("No se pudo abrir el chat"); }
  };

  const setStatus = async (status, extra = {}) => {
    setBusy(true);
    try {
      const r = await axios.patch(`${API}/marketplace/orders/${order.id}/status`, { status, ...extra }, { headers });
      onChange?.(r.data);
      brunoToast.success(`Pedido ${statuses[status] || status}`);
    } catch (e) { brunoToast.error(detailMsg(e) || "No se pudo actualizar el pedido"); }
    finally { setBusy(false); }
  };

  const sellerActions = role === "seller" && (
    <div className="flex flex-wrap gap-2">
      {order.status === "paid" && <Button size="sm" className="rounded-full h-8" disabled={busy} onClick={() => setStatus("processing")} data-testid={`order-processing-${order.id}`}><Package className="w-3.5 h-3.5 mr-1" /> Preparando</Button>}
      {["paid", "processing"].includes(order.status) && (
        <div className="flex items-center gap-1.5">
          {order.delivery_mode === "ship" && <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Nº de guía (opcional)" className="h-8 w-40 text-xs" data-testid={`order-tracking-${order.id}`} />}
          <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => setStatus("shipped", { tracking_number: tracking || null })} data-testid={`order-shipped-${order.id}`}><Truck className="w-3.5 h-3.5 mr-1" /> {order.delivery_mode === "ship" ? "Enviado" : "Entregando"}</Button>
        </div>
      )}
      {order.status === "shipped" && <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => setStatus("delivered")} data-testid={`order-delivered-${order.id}`}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Entregado</Button>}
      {["paid", "processing"].includes(order.status) && <Button size="sm" variant="ghost" className="rounded-full h-8 text-destructive" disabled={busy} onClick={() => { if (window.confirm("Cancelar y reembolsar al comprador por Stripe?")) setStatus("cancelled", { note: "Cancelado por el vendedor" }); }} data-testid={`order-cancel-${order.id}`}><XCircle className="w-3.5 h-3.5 mr-1" /> Cancelar y reembolsar</Button>}
    </div>
  );
  const buyerActions = role === "buyer" && ["shipped", "processing", "paid"].includes(order.status) && (
    <Button size="sm" variant="outline" className="rounded-full h-8" disabled={busy} onClick={() => setStatus("delivered")} data-testid={`order-confirm-${order.id}`}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar que lo recibí</Button>
  );

  return (
    <div className="rounded-2xl border border-border/60 p-3 text-sm space-y-2.5" data-testid={`mkt-order-${order.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">Pedido {order.id.slice(0, 8).toUpperCase()}</p>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Store className="w-3 h-3" /> {role === "buyer" ? "Vendedor" : "Comprador"}: {other?.name}{other?.username ? ` · @${other.username}` : ""}</p>
        </div>
        <StatusChip status={order.status} label={order.status_label} />
      </div>
      <ul className="space-y-1">
        {order.items.map((it) => (
          <li key={it.product_id} className="flex items-center gap-2">
            {it.image ? <img src={it.image} alt="" className="w-9 h-9 rounded-lg object-cover" /> : <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center"><Package className="w-4 h-4 text-muted-foreground" /></div>}
            <span className="flex-1 truncate">{it.title} <span className="text-muted-foreground">× {it.quantity}</span></span>
            <span className="tabular-nums">{fmtMoney(it.subtotal, order.currency)}</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{order.delivery_mode === "ship" ? <><Truck className="inline w-3.5 h-3.5 mr-1" />Envío {order.shipping > 0 ? fmtMoney(order.shipping, order.currency) : "incluido"}{order.carrier ? ` · ${order.carrier}` : ""}{order.tracking_number ? ` · guía ${order.tracking_number}` : ""}</> : <><MessageCircle className="inline w-3.5 h-3.5 mr-1" />Entrega coordinada por chat</>}</span>
        <span className="font-bold text-foreground tabular-nums">Total {fmtMoney(order.total, order.currency)}</span>
      </div>
      {role === "seller" && <p className="text-[11px] text-muted-foreground">Comisión BRUNO {fmtMoney(order.bruno_fee, order.currency)} · recibes {fmtMoney(order.seller_net, order.currency)}</p>}
      {order.delivery_mode === "ship" && order.address && role === "seller" && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1" data-testid={`order-address-${order.id}`}><MapPin className="w-3 h-3 mt-0.5 shrink-0" />{order.address.name} · {order.address.line1}{order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}{order.address.state ? `, ${order.address.state}` : ""} {order.address.postal_code || ""} · {order.address.country}{order.address.phone ? ` · ${order.address.phone}` : ""}</p>
      )}
      <Timeline history={order.history} statuses={statuses} />
      <div className="flex flex-wrap items-center gap-2">
        {sellerActions}{buyerActions}
        {other?.id && <Button size="sm" variant="ghost" className="rounded-full h-8" onClick={openChat} data-testid={`order-chat-${order.id}`}><MessageCircle className="w-3.5 h-3.5 mr-1" /> Chat</Button>}
        {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
};

export const PiupOrderCard = ({ order, statuses = {} }) => (
  <div className="rounded-2xl border border-orange-300/50 bg-orange-50/40 dark:bg-orange-950/10 p-3 text-sm space-y-2" data-testid={`piup-order-${order.id}`}>
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="font-semibold truncate flex items-center gap-1.5"><OvcMark size={16} /> PIUP · {order.product_name}</p>
        <p className="text-[11px] text-muted-foreground">{order.shape_label} {order.size_label} · {order.color_name} · × {order.quantity} · Pedido {order.id.slice(0, 8).toUpperCase()}</p>
      </div>
      <StatusChip status={order.status} label={statuses[order.status] || order.status} />
    </div>
    <div className="flex items-center justify-between text-xs text-muted-foreground">
      <span>{order.tracking_number ? `Guía ${order.tracking_number}${order.carrier ? ` · ${order.carrier}` : ""}` : "Lo prepara Octopus Vision Company"}</span>
      <span className="font-bold text-foreground tabular-nums">{fmtMoney(order.total_price, order.currency)}</span>
    </div>
    {order.history && <Timeline history={order.history} statuses={statuses} />}
  </div>
);
