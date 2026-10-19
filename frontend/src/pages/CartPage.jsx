import React, { useCallback, useEffect, useState } from "react";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, Truck, MessageCircle, AlertTriangle, Lock, Package, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";
import { openCheckout } from "@/lib/openCheckout";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const EMPTY_ADDR = { name: "", phone: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "CO", notes: "" };

const QtyControl = ({ item, onChange, onRemove }) => (
  <div className="flex items-center gap-1">
    <button type="button" onClick={() => onChange(item.quantity - 1)} disabled={item.quantity <= 1} className="w-7 h-7 rounded-full border grid place-items-center disabled:opacity-40" data-testid={`cart-dec-${item.product_id}`}><Minus className="w-3 h-3" /></button>
    <span className="w-6 text-center text-sm tabular-nums" data-testid={`cart-qty-${item.product_id}`}>{item.quantity}</span>
    <button type="button" onClick={() => onChange(item.quantity + 1)} disabled={item.stock != null && item.quantity >= item.stock} className="w-7 h-7 rounded-full border grid place-items-center disabled:opacity-40" data-testid={`cart-inc-${item.product_id}`}><Plus className="w-3 h-3" /></button>
    <button type="button" onClick={onRemove} className="ml-1 w-7 h-7 rounded-full grid place-items-center text-destructive hover:bg-destructive/10" data-testid={`cart-remove-${item.product_id}`}><Trash2 className="w-3.5 h-3.5" /></button>
  </div>
);

const DeliveryPicker = ({ group, value, onChange }) => (
  <div className="grid grid-cols-2 gap-2" data-testid={`delivery-${group.seller_id}`}>
    <button type="button" disabled={!group.can_ship} onClick={() => onChange("ship")} className={`rounded-xl border p-2.5 text-left text-xs transition-colors disabled:opacity-40 ${value === "ship" ? "border-primary bg-primary/5" : "border-border"}`} data-testid={`delivery-ship-${group.seller_id}`}>
      <span className="flex items-center gap-1.5 font-semibold"><Truck className="w-3.5 h-3.5" /> Envío a domicilio</span>
      <span className="text-muted-foreground">{group.can_ship ? (group.shipping > 0 ? `+ ${fmtMoney(group.shipping, group.currency)}` : "Envío incluido") : "No disponible para estos productos"}</span>
    </button>
    <button type="button" disabled={!group.can_chat} onClick={() => onChange("chat")} className={`rounded-xl border p-2.5 text-left text-xs transition-colors disabled:opacity-40 ${value === "chat" ? "border-primary bg-primary/5" : "border-border"}`} data-testid={`delivery-chat-${group.seller_id}`}>
      <span className="flex items-center gap-1.5 font-semibold"><MessageCircle className="w-3.5 h-3.5" /> Coordinar por chat</span>
      <span className="text-muted-foreground">{group.can_chat ? "Pagas aquí, acuerdan la entrega" : "El vendedor solo envía"}</span>
    </button>
  </div>
);

const AddressForm = ({ value, onChange }) => {
  const f = (k) => ({ value: value[k] || "", onChange: (e) => onChange({ ...value, [k]: e.target.value }), "data-testid": `addr-${k}` });
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="address-form">
      <Input placeholder="Nombre de quien recibe *" className="col-span-2 h-10" {...f("name")} />
      <Input placeholder="Teléfono" className="h-10" {...f("phone")} />
      <Input placeholder="País *" className="h-10" {...f("country")} />
      <Input placeholder="Dirección *" className="col-span-2 h-10" {...f("line1")} />
      <Input placeholder="Apto, torre, referencia" className="col-span-2 h-10" {...f("line2")} />
      <Input placeholder="Ciudad *" className="h-10" {...f("city")} />
      <Input placeholder="Departamento / Estado" className="h-10" {...f("state")} />
      <Input placeholder="Código postal" className="h-10" {...f("postal_code")} />
      <Input placeholder="Notas para la entrega" className="h-10" {...f("notes")} />
    </div>
  );
};

const CartPage = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [summary, setSummary] = useState(null);
  const [delivery, setDelivery] = useState({});
  const [address, setAddress] = useState(EMPTY_ADDR);
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await axios.get(`${API}/marketplace/cart/summary`, { headers });
      setSummary(r.data);
      setDelivery((d) => Object.fromEntries(r.data.groups.map((g) => [g.seller_id, d[g.seller_id] || (g.can_ship ? "ship" : "chat")])));
    } catch { setSummary({ groups: [], problems: [], subtotal: 0 }); }
    // eslint-disable-next-line
  }, [token]);

  useEffect(() => { if (!user) navigate("/login"); else load(); }, [user, load, navigate]);

  const setQty = async (pid, q) => { try { await axios.put(`${API}/marketplace/cart/${pid}`, { quantity: q }, { headers }); load(); } catch (e) { brunoToast.error(detailMsg(e) || "No se pudo actualizar"); } };
  const remove = async (pid) => { await axios.delete(`${API}/marketplace/cart/${pid}`, { headers }); load(); };

  const needsAddress = summary?.groups.some((g) => delivery[g.seller_id] === "ship");
  const shippingTotal = (summary?.groups || []).reduce((a, g) => a + (delivery[g.seller_id] === "ship" ? g.shipping : 0), 0);
  const total = (summary?.subtotal || 0) + shippingTotal;
  const blocked = !summary || summary.groups.length === 0 || summary.problems?.length > 0 || summary.groups.some((g) => !g.seller_ready) || (needsAddress && (!address.name || !address.line1 || !address.city || !address.country));

  const checkout = async () => {
    setProcessing(true);
    try {
      const r = await axios.post(`${API}/marketplace/checkout`, { origin_url: window.location.origin, delivery, address: needsAddress ? address : null }, { headers });
      openCheckout(r.data.checkout_url);
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d?.code === "cart_problems") { brunoToast.error(d.problems.map((p) => p.message).join(" · ")); load(); }
      else brunoToast.error(detailMsg(e) || "No se pudo iniciar el pago");
      setProcessing(false);
    }
  };

  if (!summary) return <BrunoLoader />;

  return (
    <div className="min-h-screen bg-background" data-testid="cart-page">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/marketplace"><Button variant="ghost" size="icon" className="rounded-full" data-testid="cart-back"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <h1 className="text-xl font-bold flex-1">Carrito</h1>
          <span className="text-xs text-muted-foreground">{summary.items_count || 0} {summary.items_count === 1 ? "producto" : "productos"}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {summary.groups.length === 0 ? (
          <div className="text-center py-20" data-testid="cart-empty">
            <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Tu carrito está vacío</h3>
            <p className="text-muted-foreground mb-6">Explora el marketplace y encuentra productos de la comunidad.</p>
            <Link to="/marketplace"><Button>Ir al Marketplace</Button></Link>
          </div>
        ) : (
          <>
            {summary.problems?.length > 0 && (
              <div className="rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs space-y-1" data-testid="cart-problems">
                {summary.problems.map((p, i) => <p key={i} className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600" />{p.message}</p>)}
              </div>
            )}
            {summary.groups.map((g) => (
              <section key={g.seller_id} className="rounded-2xl border border-border/60 p-3 space-y-3" data-testid={`cart-group-${g.seller_id}`}>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 grid place-items-center"><Store className="w-4 h-4 text-primary" /></div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{g.seller.name}</p>{g.seller.username && <p className="text-[11px] text-muted-foreground">@{g.seller.username}</p>}</div>
                  {!g.seller_ready && <span className="text-[10px] font-semibold rounded-full bg-amber-500/15 text-amber-700 px-2 py-0.5" data-testid={`seller-not-ready-${g.seller_id}`}>Cobros no activados</span>}
                </div>
                {g.items.map((it) => (
                  <div key={it.product_id} className="flex items-center gap-3" data-testid={`cart-item-${it.product_id}`}>
                    <Link to={`/marketplace/${it.product_id}`} className="shrink-0">{it.image ? <img src={it.image} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <div className="w-14 h-14 rounded-xl bg-muted grid place-items-center"><Package className="w-5 h-5 text-muted-foreground" /></div>}</Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.title}</p>
                      <p className="text-xs text-muted-foreground">{fmtMoney(it.price, g.currency)} c/u{it.stock != null && ` · ${it.stock} disp.`}</p>
                      <QtyControl item={it} onChange={(q) => setQty(it.product_id, q)} onRemove={() => remove(it.product_id)} />
                    </div>
                    <p className="text-sm font-bold tabular-nums">{fmtMoney(it.subtotal, g.currency)}</p>
                  </div>
                ))}
                <DeliveryPicker group={g} value={delivery[g.seller_id]} onChange={(v) => setDelivery({ ...delivery, [g.seller_id]: v })} />
                {!g.seller_ready && <p className="text-[11px] text-amber-700" data-testid={`seller-not-ready-msg-${g.seller_id}`}>Este vendedor aún no completó su cuenta de cobros en BRUNO. No podemos cobrarle en su nombre: quita sus productos o escríbele por chat.</p>}
              </section>
            ))}

            {needsAddress && (
              <section className="rounded-2xl border border-border/60 p-3 space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1.5"><Truck className="w-4 h-4" /> Dirección de envío</p>
                <AddressForm value={address} onChange={setAddress} />
                <p className="text-[11px] text-muted-foreground">Transportadoras integradas: próximamente. Por ahora cada vendedor envía con su medio y te comparte la guía.</p>
              </section>
            )}

            <section className="rounded-2xl bg-muted/40 p-4 space-y-1.5 text-sm" data-testid="cart-summary">
              <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums" data-testid="cart-subtotal">{fmtMoney(summary.subtotal, summary.currency)}</span></div>
              <div className="flex justify-between"><span>Envío</span><span className="tabular-nums" data-testid="cart-shipping">{shippingTotal > 0 ? fmtMoney(shippingTotal, summary.currency) : "—"}</span></div>
              <div className="flex justify-between text-muted-foreground text-xs"><span>Impuestos</span><span>Incluidos en el precio del vendedor</span></div>
              <div className="flex justify-between font-bold text-base pt-1.5 border-t"><span>Total a pagar</span><span className="tabular-nums" data-testid="cart-total">{fmtMoney(total, summary.currency)}</span></div>
              <p className="text-[11px] text-muted-foreground pt-1">Un solo pago seguro con Stripe. BRUNO reparte a cada vendedor y retiene su comisión del {summary.bruno_fee_pct}% (no se suma a tu total). No guardamos datos de tu tarjeta.</p>
            </section>

            <Button className="w-full h-12 rounded-full text-base" disabled={blocked || processing} onClick={checkout} data-testid="cart-checkout-btn">
              {processing ? "Abriendo pago seguro…" : <><Lock className="w-4 h-4 mr-2" /> Pagar {fmtMoney(total, summary.currency)}</>}
            </Button>
            <div style={{ height: "var(--content-bottom, 80px)" }} />
          </>
        )}
      </div>
    </div>
  );
};

export default CartPage;
