import React, { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Minus, Plus, Wallet, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useBrunoCheckout, fmtMoney } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/** Regalos con saldo de créditos: elegir → cantidad → total → confirmar explícitamente → débito atómico en servidor. */
export default function LiveGiftSheet({ liveId, onClose, onSent }) {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const checkout = useBrunoCheckout();
  const [catalog, setCatalog] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [sel, setSel] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [topup, setTopup] = useState(false);

  const load = () => Promise.all([axios.get(`${API}/credits/gifts`), axios.get(`${API}/credits/wallet`, { headers })]).then(([g, w]) => { setCatalog(g.data); setWallet(w.data); }).catch(() => brunoToast.error("No se pudo cargar el catálogo"));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const total = sel ? sel.price_minor * qty : 0;
  const balance = wallet?.balance_minor ?? 0;
  const enough = total > 0 && balance >= total;

  const send = async () => {
    if (!sel || busy) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/credits/gift`, { live_id: liveId, gift_id: sel.id, quantity: qty }, { headers });
      setWallet((w) => ({ ...w, balance_minor: r.data.balance_minor }));
      brunoToast.success(`Enviaste ${sel.emoji} ${sel.name} ×${qty}`);
      onSent?.(r.data); setSel(null); setQty(1);
    } catch (e) {
      const d = e?.response?.data?.detail;
      if (d?.code === "credits_required") { setTopup(true); brunoToast.error("Saldo insuficiente", { description: `Tienes ${fmtMoney(d.balance_minor / 100)} y necesitas ${fmtMoney(d.needed_minor / 100)}.` }); }
      else brunoToast.error(typeof d === "string" ? d : d?.message || "No se pudo enviar el regalo");
    } finally { setBusy(false); }
  };
  const buyPack = (pack) => checkout.pay({ kind: "credits", ref_id: liveId, option: pack.id });

  return (
    <div className="absolute inset-0 z-[70] flex items-end" data-testid="live-gift-sheet" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full bruno-glass rounded-t-[28px] border-t p-4 space-y-3 max-h-[72vh] flex flex-col" style={{ paddingBottom: "calc(var(--safe-bottom) + 12px)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <p className="font-bold text-sm">Regalos</p>
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold rounded-full bg-primary/10 text-primary px-2.5 h-7" data-testid="gift-balance"><Wallet className="w-3.5 h-3.5" /> {wallet ? fmtMoney(balance / 100) : "…"}</span>
          <button onClick={() => setTopup((t) => !t)} className="h-7 px-2.5 rounded-full bg-foreground/[0.06] text-xs font-semibold" data-testid="gift-topup-toggle">Recargar</button>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-foreground/[0.06] grid place-items-center" aria-label="Cerrar" data-testid="gift-close"><X className="w-4 h-4" /></button>
        </div>
        {topup && wallet && (
          <div className="grid grid-cols-4 gap-1.5" data-testid="gift-packs">
            {wallet.packs.map((p) => <button key={p.id} onClick={() => buyPack(p)} disabled={checkout.busy} className="h-12 rounded-xl bg-foreground/[0.06] text-xs font-bold leading-tight" data-testid={`gift-pack-${p.id}`}>{fmtMoney(p.usd / 100)}<span className="block text-[9px] font-normal text-muted-foreground">créditos</span></button>)}
            <p className="col-span-4 text-[10px] text-muted-foreground">1 crédito = 1 USD. Pago seguro con tarjeta; el saldo no se transfiere ni se retira. Volverás a este live al terminar.</p>
          </div>
        )}
        {!catalog ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
          <div className="grid grid-cols-4 gap-1.5 overflow-y-auto no-scrollbar" data-testid="gift-catalog">
            {catalog.gifts.map((g) => (
              <button key={g.id} onClick={() => { setSel(g); setQty(1); }} className={`h-[74px] rounded-2xl flex flex-col items-center justify-center gap-0.5 ${sel?.id === g.id ? "bg-primary/20 ring-2 ring-primary" : "bg-foreground/[0.05]"}`} data-testid={`gift-${g.id}`} aria-pressed={sel?.id === g.id}>
                <span className="text-2xl leading-none">{g.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight truncate max-w-full px-1">{g.name}</span>
                <span className="text-[10px] text-primary font-bold">{fmtMoney(g.price_minor / 100)}</span>
              </button>
            ))}
          </div>
        )}
        {sel && (
          <div className="rounded-2xl bg-foreground/[0.05] p-3 flex items-center gap-3" data-testid="gift-confirm-row">
            <span className="text-2xl">{sel.emoji}</span>
            <div className="flex items-center gap-1">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full bg-foreground/[0.08] grid place-items-center" aria-label="Menos" data-testid="gift-qty-minus"><Minus className="w-4 h-4" /></button>
              <span className="w-7 text-center text-sm font-bold" data-testid="gift-qty">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(50, q + 1))} className="w-8 h-8 rounded-full bg-foreground/[0.08] grid place-items-center" aria-label="Más" data-testid="gift-qty-plus"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="ml-auto text-right leading-tight"><p className="text-[10px] text-muted-foreground">Total</p><p className="text-sm font-bold" data-testid="gift-total">{fmtMoney(total / 100)}</p></div>
            <button onClick={send} disabled={busy || !enough} className="h-10 px-4 rounded-full bg-primary text-white text-xs font-bold disabled:opacity-50" data-testid="gift-send-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : enough ? "Confirmar y enviar" : "Saldo insuficiente"}</button>
          </div>
        )}
        {catalog && <p className="text-[10px] text-muted-foreground">El creador recibe el {100 - catalog.bruno_fee_pct} % del importe base; BRUNO retiene el {catalog.bruno_fee_pct} %. Cada regalo guarda el precio y la comisión del momento.</p>}
      </div>
    </div>
  );
}
