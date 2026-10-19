import { useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { getSharedCoupon } from "@/pages/CouponLandingPage";
import { openCheckout } from "@/lib/openCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const fmtMoney = (v, cur = "usd") => { try { return new Intl.NumberFormat("es", { style: "currency", currency: (cur || "usd").toUpperCase() }).format(Number(v || 0)); } catch { return `${v} ${cur}`; } };

// Server computes price, discounts, fee and recipient; the client only names what it wants to buy (+ an optional coupon code).
export function useBrunoCheckout() {
  const { token } = useAuth();
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [couponError, setCouponError] = useState(null);
  const lastBody = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const getQuote = async (body) => {
    setBusy(true);
    lastBody.current = { ...body, discount_code: body.discount_code || null };
    try {
      let r = await axios.post(`${API}/money/quote`, { ...lastBody.current, origin_url: window.location.origin }, { headers });
      // A coupon saved from a shared link (/cupon/:id) is applied silently when it belongs to this seller.
      const shared = !body.discount_code && r.data?.accepts_coupons ? getSharedCoupon() : null;
      if (shared) {
        try {
          const r2 = await axios.post(`${API}/money/quote`, { ...lastBody.current, discount_code: shared.code, origin_url: window.location.origin }, { headers });
          if (r2.data?.discount_code) { r = r2; lastBody.current.discount_code = shared.code; }
        } catch { /* belongs to another seller or no longer valid → ignore */ }
      }
      setQuote(r.data); setCouponError(null); return r.data;
    }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo calcular el precio"); return null; }
    finally { setBusy(false); }
  };
  // Re-quotes with the coupon; on a bad code the previous quote stays and the error is shown inline.
  const applyCoupon = async (code) => {
    if (!lastBody.current) return null;
    const clean = (code || "").trim().toUpperCase();
    setBusy(true); setCouponError(null);
    try { const r = await axios.post(`${API}/money/quote`, { ...lastBody.current, discount_code: clean || null, origin_url: window.location.origin }, { headers }); lastBody.current.discount_code = clean || null; setQuote(r.data); return r.data; }
    catch (e) { setCouponError(detailMsg(e) || "Cupón no válido"); return null; }
    finally { setBusy(false); }
  };
  const pay = async (body) => {
    setBusy(true);
    const full = { ...body, discount_code: body.discount_code ?? lastBody.current?.discount_code ?? null };
    try {
      const r = await axios.post(`${API}/money/checkout`, { ...full, origin_url: window.location.origin }, { headers });
      sessionStorage.setItem("bruno_last_checkout", JSON.stringify({ session_id: r.data.session_id, kind: body.kind, ref_id: body.ref_id }));
      openCheckout(r.data.checkout_url);
    } catch (e) { const m = detailMsg(e) || "No se pudo iniciar el pago"; setError(m); brunoToast.error(m); setBusy(false); }
  };
  return { quote, busy, error, couponError, getQuote, applyCoupon, pay };
}

export const detailMsg = (e) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : d?.message; };
