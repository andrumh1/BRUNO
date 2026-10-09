import React, { useState } from "react";
import { Loader2, ShieldCheck, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/hooks/useBrunoCheckout";

// Coupon box: only for creator/seller sales. The server validates the code and re-quotes.
const CouponBox = ({ quote, busy, couponError, onApply }) => {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  if (quote.discount_code) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-3 py-2 text-xs" data-testid="coupon-applied">
        <span className="flex items-center gap-1.5 font-semibold text-emerald-700"><Ticket className="w-3.5 h-3.5" /> Cupón {quote.discount_code} aplicado</span>
        <button onClick={() => { setCode(""); onApply(""); }} className="text-muted-foreground hover:text-foreground" aria-label="Quitar cupón" data-testid="coupon-remove-btn"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }
  if (!open) return <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary flex items-center gap-1.5" data-testid="coupon-toggle-btn"><Ticket className="w-3.5 h-3.5" /> ¿Tienes un cupón del creador?</button>;
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter" && code.trim()) onApply(code); }} placeholder="CÓDIGO" maxLength={24}
          className="flex-1 h-9 rounded-xl border bg-background px-3 text-sm uppercase tracking-wider" data-testid="coupon-input" />
        <Button size="sm" variant="secondary" className="rounded-xl h-9" onClick={() => onApply(code)} disabled={busy || !code.trim()} data-testid="coupon-apply-btn">Aplicar</Button>
      </div>
      {couponError && <p className="text-[11px] text-destructive" role="alert" data-testid="coupon-error">{couponError}</p>}
    </div>
  );
};

// Transparent split shown before confirming any purchase (who pays what, who funds discounts and processor fees).
export const QuoteCard = ({ quote, busy, error, couponError, onApplyCoupon, onPay, onCancel, cta = "Pagar con tarjeta" }) => {
  if (!quote) return null;
  const c = quote.currency;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2 text-sm" data-testid="checkout-quote">
      <p className="font-semibold leading-tight" data-testid="quote-name">{quote.name}</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Importe</span><span>{fmtMoney(quote.subtotal, c)}</span></div>
      {quote.discount > 0 && <div className="flex justify-between text-emerald-600" data-testid="quote-discount"><span>Descuento ({quote.discount_code}) · lo financia el vendedor</span><span>−{fmtMoney(quote.discount, c)}</span></div>}
      {quote.shipping > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span>{fmtMoney(quote.shipping, c)}</span></div>}
      <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span data-testid="quote-total">{fmtMoney(quote.total, c)}</span></div>
      {quote.accepts_coupons && onApplyCoupon && <CouponBox quote={quote} busy={busy} couponError={couponError} onApply={onApplyCoupon} />}
      {!quote.is_platform_sale && (
        <p className="text-[11px] text-muted-foreground leading-snug" data-testid="quote-split">Reparto: {fmtMoney(quote.seller_net, c)} para el creador/vendedor · {fmtMoney(quote.bruno_fee, c)} comisión BRUNO ({quote.bruno_fee_pct} %). BRUNO asume las comisiones del procesador de pago. Impuestos y envío no llevan comisión.</p>
      )}
      {quote.is_platform_sale && <p className="text-[11px] text-muted-foreground">Venta directa de BRUNO. Pago seguro procesado por Stripe.</p>}
      <p className="text-[11px] text-muted-foreground">Recibirás el recibo por correo al confirmarse el pago.</p>
      {error && <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-2" role="alert" data-testid="quote-error">{error}</p>}
      <div className="flex gap-2 pt-1">
        {onCancel && <Button variant="outline" className="flex-1 rounded-full" onClick={onCancel} data-testid="quote-cancel-btn">Cancelar</Button>}
        <Button className="flex-1 rounded-full" onClick={onPay} disabled={busy} data-testid="quote-pay-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-1.5" />{cta}</>}</Button>
      </div>
    </div>
  );
};
