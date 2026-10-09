import React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/hooks/useBrunoCheckout";

// Transparent split shown before confirming any purchase (who pays what, who funds discounts and processor fees).
export const QuoteCard = ({ quote, busy, onPay, onCancel, cta = "Pagar con tarjeta" }) => {
  if (!quote) return null;
  const c = quote.currency;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-2 text-sm" data-testid="checkout-quote">
      <p className="font-semibold leading-tight" data-testid="quote-name">{quote.name}</p>
      <div className="flex justify-between"><span className="text-muted-foreground">Importe</span><span>{fmtMoney(quote.subtotal, c)}</span></div>
      {quote.discount > 0 && <div className="flex justify-between text-emerald-600"><span>Descuento ({quote.discount_code}) · lo financia el vendedor</span><span>−{fmtMoney(quote.discount, c)}</span></div>}
      {quote.shipping > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Envío</span><span>{fmtMoney(quote.shipping, c)}</span></div>}
      <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span data-testid="quote-total">{fmtMoney(quote.total, c)}</span></div>
      {!quote.is_platform_sale && (
        <p className="text-[11px] text-muted-foreground leading-snug" data-testid="quote-split">Reparto: {fmtMoney(quote.seller_net, c)} para el creador/vendedor · {fmtMoney(quote.bruno_fee, c)} comisión BRUNO ({quote.bruno_fee_pct} %). BRUNO asume las comisiones del procesador de pago. Impuestos y envío no llevan comisión.</p>
      )}
      {quote.is_platform_sale && <p className="text-[11px] text-muted-foreground">Venta directa de BRUNO. Pago seguro procesado por Stripe.</p>}
      <div className="flex gap-2 pt-1">
        {onCancel && <Button variant="outline" className="flex-1 rounded-full" onClick={onCancel} data-testid="quote-cancel-btn">Cancelar</Button>}
        <Button className="flex-1 rounded-full" onClick={onPay} disabled={busy} data-testid="quote-pay-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4 mr-1.5" />{cta}</>}</Button>
      </div>
    </div>
  );
};
