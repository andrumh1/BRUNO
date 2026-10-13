/* Panel OVC: catálogo, inventario y pedidos PIUP (solo administradores). Separado de los vendedores del Marketplace. */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Package, Plus, Save, Boxes, ClipboardList, BarChart3, Truck, CheckCircle2, XCircle, Cog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";
import { OvcMark } from "@/components/brand/OvcAttribution";
import { StatusChip } from "@/components/marketplace/OrderCards";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TABS = [{ id: "orders", label: "Pedidos", icon: ClipboardList }, { id: "catalog", label: "Catálogo e inventario", icon: Boxes }, { id: "stats", label: "Resumen", icon: BarChart3 }];
const NEXT = { paid: ["processing", "shipped", "cancelled"], pending: ["processing", "cancelled"], processing: ["encoding", "shipped", "cancelled"], encoding: ["shipped", "cancelled"], shipped: ["delivered"] };
const NEXT_LABEL = { processing: ["En producción", Cog], encoding: ["Grabando NFC", Cog], shipped: ["Enviado", Truck], delivered: ["Entregado", CheckCircle2], cancelled: ["Cancelar y reembolsar", XCircle] };

const ProductRow = ({ p, headers, onSaved }) => {
  const [form, setForm] = useState({ base_price: p.base_price, stock: p.stock ?? "", active: p.active !== false, name: p.name });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const body = { name: form.name, base_price: Number(form.base_price), active: form.active, ...(form.stock === "" ? { unlimited_stock: true } : { stock: Number(form.stock) }) };
      const r = await axios.patch(`${API}/piup/admin/products/${p.id}`, body, { headers });
      onSaved(r.data); brunoToast.success("Producto PIUP actualizado");
    } catch (e) { brunoToast.error(detailMsg(e) || "No se pudo guardar"); }
    finally { setBusy(false); }
  };
  return (
    <div className="rounded-xl border border-border/60 p-3 grid grid-cols-2 md:grid-cols-[1fr_110px_110px_90px_auto] gap-2 items-center text-sm" data-testid={`piup-admin-product-${p.id}`}>
      <div className="col-span-2 md:col-span-1 min-w-0">
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 font-medium" data-testid={`piup-admin-name-${p.id}`} />
        <p className="text-[11px] text-muted-foreground mt-0.5">{p.category_label || p.category} · estilos {p.styles?.join(" ")} · vendidos {p.sold || 0}</p>
      </div>
      <label className="text-xs"><span className="text-muted-foreground">Precio USD</span><Input type="number" step="0.01" min="0.5" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="h-9" data-testid={`piup-admin-price-${p.id}`} /></label>
      <label className="text-xs"><span className="text-muted-foreground">Stock (vacío = ilimitado)</span><Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-9" data-testid={`piup-admin-stock-${p.id}`} /></label>
      <button type="button" onClick={() => setForm({ ...form, active: !form.active })} className={`h-9 rounded-full text-xs font-semibold ${form.active ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-500/15 text-zinc-600"}`} data-testid={`piup-admin-active-${p.id}`}>{form.active ? "Visible" : "Oculto"}</button>
      <Button size="sm" className="h-9 rounded-full" onClick={save} disabled={busy} data-testid={`piup-admin-save-${p.id}`}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-1" /> Guardar</>}</Button>
    </div>
  );
};

const NewProduct = ({ categories, headers, onCreated }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: categories[0]?.id || "oficinas", base_price: 9.99, styles: "R7", stock: "" });
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const r = await axios.post(`${API}/piup/admin/products`, { ...form, base_price: Number(form.base_price), styles: form.styles.split(/[\s,]+/).filter(Boolean), stock: form.stock === "" ? null : Number(form.stock) }, { headers });
      onCreated(r.data); setOpen(false); brunoToast.success("Producto PIUP creado");
    } catch (e) { brunoToast.error(detailMsg(e) || "No se pudo crear"); }
    finally { setBusy(false); }
  };
  if (!open) return <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)} data-testid="piup-admin-new-btn"><Plus className="w-4 h-4 mr-1" /> Nuevo producto PIUP</Button>;
  return (
    <div className="rounded-xl border border-dashed border-orange-400/60 p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm" data-testid="piup-admin-new-form">
      <Input placeholder="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-9 col-span-2" data-testid="piup-new-name" />
      <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm" data-testid="piup-new-category">{categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
      <Input type="number" step="0.01" placeholder="Precio USD" value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="h-9" data-testid="piup-new-price" />
      <Input placeholder="Estilos (R7 C2 …)" value={form.styles} onChange={(e) => setForm({ ...form, styles: e.target.value })} className="h-9" data-testid="piup-new-styles" />
      <Input type="number" placeholder="Stock (vacío = ilimitado)" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="h-9 col-span-2" data-testid="piup-new-stock" />
      <div className="col-span-2 md:col-span-3 flex gap-2 justify-end"><Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Cancelar</Button><Button className="rounded-full" onClick={create} disabled={busy || !form.name} data-testid="piup-new-save">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear"}</Button></div>
    </div>
  );
};

const OrderRow = ({ o, statuses, headers, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState(o.tracking_number || "");
  const go = async (status) => {
    if (status === "cancelled" && !window.confirm("Cancelar el pedido y reembolsar por Stripe?")) return;
    setBusy(true);
    try { const r = await axios.patch(`${API}/piup/admin/orders/${o.id}/status`, { status, tracking_number: tracking || null }, { headers }); onChange(r.data); brunoToast.success(`Pedido → ${statuses[status] || status}`); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo actualizar"); }
    finally { setBusy(false); }
  };
  const addr = o.shipping_address || {};
  return (
    <div className="rounded-xl border border-border/60 p-3 text-sm space-y-2" data-testid={`piup-admin-order-${o.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold truncate">{o.product_name} <span className="text-muted-foreground font-normal">· {o.shape_label} {o.size_label} · {o.color_name} · ×{o.quantity}</span></p>
          <p className="text-[11px] text-muted-foreground">Pedido {o.id.slice(0, 8).toUpperCase()} · {new Date(o.created_at).toLocaleString("es")} · {o.buyer?.name} {o.buyer?.email ? `· ${o.buyer.email}` : ""}</p>
          {addr.line1 && <p className="text-[11px] text-muted-foreground">{addr.name || ""} · {addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city || ""} {addr.state || ""} {addr.postal_code || ""} · {addr.country || ""} {addr.phone ? `· ${addr.phone}` : ""}</p>}
          {o.card_id && <p className="text-[11px] text-muted-foreground">Tarjeta BRUNO a grabar: {o.card_id}</p>}
        </div>
        <div className="text-right shrink-0"><StatusChip status={o.status} label={o.status_label} /><p className="font-bold tabular-nums mt-1">{fmtMoney(o.total_price, o.currency)}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {(NEXT[o.status] || []).includes("shipped") && <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Nº guía / transportadora" className="h-8 w-48 text-xs" data-testid={`piup-admin-tracking-${o.id}`} />}
        {(NEXT[o.status] || []).map((st) => { const [label, Icon] = NEXT_LABEL[st]; return <Button key={st} size="sm" variant={st === "cancelled" ? "ghost" : "outline"} className={`h-8 rounded-full ${st === "cancelled" ? "text-destructive" : ""}`} disabled={busy} onClick={() => go(st)} data-testid={`piup-admin-${st}-${o.id}`}><Icon className="w-3.5 h-3.5 mr-1" />{label}</Button>; })}
        {busy && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
    </div>
  );
};

export default function AdminPiupPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "orders";
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [catalog, setCatalog] = useState(null);
  const [orders, setOrders] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("");
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!token) return;
    const onErr = (e) => { if (e?.response?.status === 403) setDenied(true); };
    axios.get(`${API}/piup/admin/products`, { headers }).then((r) => setCatalog(r.data)).catch(onErr);
    axios.get(`${API}/piup/admin/orders${filter ? `?status=${filter}` : ""}`, { headers }).then((r) => setOrders(r.data)).catch(onErr);
    axios.get(`${API}/piup/admin/stats`, { headers }).then((r) => setStats(r.data)).catch(onErr);
  }, [token, headers, filter]);

  if (denied) return <div className="min-h-screen grid place-items-center text-center p-6"><div><p className="font-bold">Solo administradores de BRUNO / OVC</p><Button className="mt-3 rounded-full" onClick={() => navigate(-1)}>Volver</Button></div></div>;

  return (
    <div className="min-h-screen bg-background" data-testid="admin-piup-page">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)} data-testid="admin-piup-back"><ArrowLeft className="w-5 h-5" /></Button>
          <OvcMark size={32} />
          <div className="flex-1 min-w-0"><h1 className="text-lg font-bold">PIUP · Administración OVC</h1><p className="text-[11px] text-muted-foreground">Catálogo, inventario y pedidos de Octopus Vision Company. {user?.name}</p></div>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate("/admin/money")} data-testid="admin-piup-money">Finanzas</Button>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-1">
          {TABS.map((t) => <button key={t.id} onClick={() => setParams({ tab: t.id })} className={`px-3 h-8 rounded-full text-xs font-semibold flex items-center gap-1.5 ${tab === t.id ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`} data-testid={`admin-piup-tab-${t.id}`}><t.icon className="w-3.5 h-3.5" />{t.label}</button>)}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {tab === "orders" && (<>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[["", "Activos"], ["paid", "Pagados"], ["processing", "En producción"], ["encoding", "Grabando"], ["shipped", "Enviados"], ["delivered", "Entregados"], ["cancelled", "Cancelados"], ["refunded", "Reembolsados"]].map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} className={`px-3 h-7 rounded-full text-[11px] font-semibold whitespace-nowrap ${filter === v ? "bg-foreground text-background" : "bg-muted"}`} data-testid={`admin-piup-filter-${v || "active"}`}>{l}{orders?.counts?.[v] ? ` · ${orders.counts[v]}` : ""}</button>
            ))}
          </div>
          {orders === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            : orders.orders.length === 0 ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="admin-piup-orders-empty">Sin pedidos en este estado.</p>
            : orders.orders.map((o) => <OrderRow key={o.id} o={o} statuses={orders.statuses} headers={headers} onChange={(u) => setOrders((s) => ({ ...s, orders: s.orders.map((x) => (x.id === u.id ? { ...x, ...u, status_label: s.statuses[u.status] } : x)) }))} />)}
          <p className="text-[11px] text-muted-foreground">Transportadoras: espacio reservado; cuando OVC contrate una, aparecerá aquí para asignarla a cada pedido.</p>
        </>)}

        {tab === "catalog" && (catalog === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (<>
          <NewProduct categories={catalog.categories} headers={headers} onCreated={(p) => setCatalog((c) => ({ ...c, products: [p, ...c.products] }))} />
          <div className="space-y-2" data-testid="admin-piup-catalog">
            {catalog.products.map((p) => <ProductRow key={p.id} p={p} headers={headers} onSaved={(u) => setCatalog((c) => ({ ...c, products: c.products.map((x) => (x.id === u.id ? { ...x, ...u } : x)) }))} />)}
          </div>
        </>))}

        {tab === "stats" && (stats === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (
          <div className="space-y-4" data-testid="admin-piup-stats">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.entries(stats.revenue).length === 0 ? <div className="p-4 rounded-xl border text-center col-span-2"><p className="text-2xl font-bold">0</p><p className="text-xs text-muted-foreground">Ventas PIUP confirmadas</p></div>
                : Object.entries(stats.revenue).map(([cur, r]) => (<React.Fragment key={cur}>
                  <div className="p-4 rounded-xl border text-center"><p className="text-xl font-bold tabular-nums">{fmtMoney(r.net, cur)}</p><p className="text-xs text-muted-foreground">Ingreso neto OVC</p></div>
                  <div className="p-4 rounded-xl border text-center"><p className="text-xl font-bold tabular-nums">{fmtMoney(r.gross, cur)}</p><p className="text-xs text-muted-foreground">Bruto · {r.count} pedidos</p></div>
                  <div className="p-4 rounded-xl border text-center"><p className="text-xl font-bold tabular-nums">{fmtMoney(r.refunds, cur)}</p><p className="text-xs text-muted-foreground">Reembolsos</p></div>
                </React.Fragment>))}
              <div className="p-4 rounded-xl border text-center"><p className="text-xl font-bold">{Object.values(stats.orders_by_status).reduce((a, b) => a + b, 0)}</p><p className="text-xs text-muted-foreground">Pedidos totales</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl border p-3"><p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Package className="w-4 h-4" /> Más vendidos</p>{stats.top_products.map((p) => <p key={p.id} className="text-xs flex justify-between py-0.5"><span>{p.name}</span><span className="tabular-nums text-muted-foreground">{p.sold || 0} · stock {p.stock == null ? "∞" : p.stock}</span></p>)}</div>
              <div className="rounded-xl border p-3"><p className="text-sm font-semibold mb-2">Stock bajo (≤ 5)</p>{stats.low_stock.length === 0 ? <p className="text-xs text-muted-foreground">Sin alertas.</p> : stats.low_stock.map((p) => <p key={p.id} className="text-xs flex justify-between py-0.5 text-amber-700"><span>{p.name}</span><span>{p.stock}</span></p>)}</div>
            </div>
            <p className="text-[11px] text-muted-foreground">{stats.note}</p>
          </div>
        ))}
        <div style={{ height: "var(--content-bottom, 80px)" }} />
      </div>
    </div>
  );
}
