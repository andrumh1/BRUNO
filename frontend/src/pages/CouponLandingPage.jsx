import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Ticket, CheckCircle2, Store, Radio, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const COUPON_KEY = "bruno_coupon";

export const saveSharedCoupon = (c) => { try { localStorage.setItem(COUPON_KEY, JSON.stringify({ id: c.id, code: c.code, seller_id: c.seller.id, at: Date.now() })); } catch { /* ignore */ } };
export const getSharedCoupon = () => { try { const c = JSON.parse(localStorage.getItem(COUPON_KEY) || "null"); return c && Date.now() - c.at < 30 * 86400000 ? c : null; } catch { return null; } };
export const clearSharedCoupon = () => { try { localStorage.removeItem(COUPON_KEY); } catch { /* ignore */ } };

// /cupon/:id — public landing of a shared creator coupon. Saves it so checkout applies it automatically for that creator.
export default function CouponLandingPage() {
  const { couponId } = useParams();
  const navigate = useNavigate();
  const [c, setC] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    axios.get(`${API}/money/coupons/${couponId}/public`).then((r) => { setC(r.data); if (r.data.valid) saveSharedCoupon(r.data); }).catch(() => setErr("Este cupón no existe o fue eliminado."));
  }, [couponId]);

  if (err) return <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="coupon-landing-error"><div><p className="font-semibold">{err}</p><Button className="rounded-full mt-4" onClick={() => navigate("/")}>Ir a BRUNO</Button></div></div>;
  if (!c) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const value = c.pct ? `${c.pct} %` : fmtMoney(c.amount, c.currency);
  return (
    <div className="min-h-screen bg-background grid place-items-center p-5" data-testid="coupon-landing" style={{ paddingTop: "calc(var(--safe-top, 0px) + 20px)" }}>
      <div className="w-full max-w-sm rounded-[28px] border border-border/60 bg-card p-6 text-center space-y-4 shadow-xl">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center"><Ticket className="w-7 h-7" /></div>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          {c.seller.avatar_url ? <img src={c.seller.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" /> : <User className="w-5 h-5" />}
          <span>Cupón de <b className="text-foreground">{c.seller.name}</b></span>
        </div>
        <p className="font-mono text-3xl font-black tracking-[0.2em] text-primary" data-testid="coupon-landing-code">{c.code}</p>
        <p className="text-lg font-bold">−{value} de descuento</p>
        <p className="text-xs text-muted-foreground">Válido en: {c.applies_label}{c.expires_at ? ` · hasta el ${new Date(c.expires_at).toLocaleDateString("es")}` : ""}</p>
        {c.valid ? (
          <p className="text-xs text-emerald-600 flex items-center justify-center gap-1" data-testid="coupon-landing-saved"><CheckCircle2 className="w-4 h-4" /> Guardado: se aplicará solo al pagar a este creador.</p>
        ) : (
          <p className="text-xs text-destructive" data-testid="coupon-landing-invalid">Este cupón ya no está disponible.</p>
        )}
        <div className="grid grid-cols-1 gap-2 pt-1">
          <Button className="rounded-full" onClick={() => navigate(`/profile/${c.seller.id}`)} data-testid="coupon-landing-profile"><User className="w-4 h-4 mr-1.5" /> Ver perfil del creador</Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => navigate("/marketplace")} data-testid="coupon-landing-market"><Store className="w-4 h-4 mr-1.5" /> Tienda</Button>
            <Button variant="outline" className="rounded-full" onClick={() => navigate("/lives")} data-testid="coupon-landing-lives"><Radio className="w-4 h-4 mr-1.5" /> Lives</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
