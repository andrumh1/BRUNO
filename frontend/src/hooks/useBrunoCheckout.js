import { useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const fmtMoney = (v, cur = "usd") => { try { return new Intl.NumberFormat("es", { style: "currency", currency: (cur || "usd").toUpperCase() }).format(Number(v || 0)); } catch { return `${v} ${cur}`; } };

// Server computes price, discounts, fee and recipient; the client only names what it wants to buy.
export function useBrunoCheckout() {
  const { token } = useAuth();
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };

  const getQuote = async (body) => {
    setBusy(true);
    try { const r = await axios.post(`${API}/money/quote`, { ...body, origin_url: window.location.origin }, { headers }); setQuote(r.data); return r.data; }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo calcular el precio"); return null; }
    finally { setBusy(false); }
  };
  const pay = async (body) => {
    setBusy(true);
    try {
      const r = await axios.post(`${API}/money/checkout`, { ...body, origin_url: window.location.origin }, { headers });
      sessionStorage.setItem("bruno_last_checkout", JSON.stringify({ session_id: r.data.session_id, kind: body.kind, ref_id: body.ref_id }));
      window.location.href = r.data.checkout_url;
    } catch (e) { const m = detailMsg(e) || "No se pudo iniciar el pago"; setError(m); brunoToast.error(m); setBusy(false); }
  };
  return { quote, busy, error, getQuote, pay };
}

export const detailMsg = (e) => { const d = e?.response?.data?.detail; return typeof d === "string" ? d : d?.message; };
