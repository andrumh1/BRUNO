import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Landmark, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";
import { CouponsPanel } from "@/components/money/CouponsPanel";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const KIND = { live_ticket: "Entrada a live", gift: "Regalo", marketplace: "Venta Marketplace", piup: "PIUP", promotion: "Promoción" };
const STATUS = { paid: "Pagado", partially_refunded: "Reembolso parcial", refunded: "Reembolsado", initiated: "Pendiente", failed: "Fallido", expired: "Caducado" };
const COUNTRIES = [["US", "Estados Unidos"], ["MX", "México"], ["CO", "Colombia"], ["ES", "España"], ["CA", "Canadá"], ["BR", "Brasil"], ["GB", "Reino Unido"], ["DE", "Alemania"], ["FR", "Francia"], ["PT", "Portugal"]];

const Money = ({ label, map, testId, tone = "" }) => (
  <div className={`rounded-2xl border border-border/60 p-3.5 ${tone}`} data-testid={testId}>
    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
    {Object.keys(map || {}).length === 0 ? <p className="text-lg font-bold mt-1">—</p> : Object.entries(map).map(([cur, v]) => <p key={cur} className="text-lg font-bold mt-1 tabular-nums">{fmtMoney(v, cur)}</p>)}
  </div>
);

// Panel "Mis ingresos": connected account, balances by currency, per-operation detail, CSV and manual payout.
export default function MyEarningsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [data, setData] = useState(null);
  const [country, setCountry] = useState("US");
  const [busy, setBusy] = useState("");
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => axios.get(`${API}/money/earnings`, { headers }).then((r) => setData(r.data)).catch(() => brunoToast.error("No se pudieron cargar tus ingresos"));
  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);
  useEffect(() => { if (params.get("connect") === "return") brunoToast.success("Datos de cobro enviados a Stripe", { description: "Revisaremos los requisitos pendientes automáticamente." }); }, [params]);

  const onboard = async () => {
    setBusy("onboard");
    try { const r = await axios.post(`${API}/money/connect/onboard`, { country, origin_url: window.location.origin }, { headers }); window.location.href = r.data.url; }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo iniciar el alta"); setBusy(""); }
  };
  const dashboard = async () => { try { const r = await axios.post(`${API}/money/connect/dashboard`, {}, { headers }); window.open(r.data.url, "_blank"); } catch (e) { brunoToast.error(detailMsg(e) || "No disponible"); } };
  const payout = async (cur) => {
    setBusy("payout");
    try { const r = await axios.post(`${API}/money/payout`, { currency: cur }, { headers }); brunoToast.success("Retiro solicitado", { description: `${fmtMoney(r.data.amount_minor / 100, cur)} en camino a tu banco` }); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo solicitar el retiro"); }
    finally { setBusy(""); }
  };
  const csv = async () => { const r = await axios.get(`${API}/money/earnings.csv`, { headers, responseType: "blob" }); const url = URL.createObjectURL(r.data); const a = document.createElement("a"); a.href = url; a.download = "mis-ingresos-bruno.csv"; a.click(); URL.revokeObjectURL(url); };

  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const acct = data.account || {};
  const summary = data.summary || {};
  const availableEntries = Object.entries(data.balances?.available || {}).filter(([, v]) => v > 0);

  return (
    <div className="min-h-screen bg-background" data-testid="earnings-page">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/60" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="h-14 px-3 flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="earnings-back"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-base font-bold">Mis ingresos</h1><div className="ml-auto"><Button variant="outline" size="sm" className="rounded-full" onClick={csv} data-testid="earnings-csv-btn"><Download className="w-4 h-4 mr-1" /> CSV</Button></div></div>
      </header>
      <div className="max-w-3xl mx-auto px-4 pt-4 space-y-5">
        <section className="rounded-3xl border border-border/60 p-4 space-y-3" data-testid="earnings-account" data-connected={acct.connected ? "1" : "0"}>
          <div className="flex items-center gap-3"><div className={`w-11 h-11 rounded-2xl grid place-items-center ${acct.payouts_enabled ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}><Landmark className="w-5 h-5" /></div>
            <div className="min-w-0 flex-1"><p className="font-semibold text-sm">Cuenta de cobros (Stripe)</p>
              <p className="text-xs text-muted-foreground" data-testid="earnings-account-status">{!acct.connected ? "Sin conectar: necesitas una cuenta para recibir entradas, regalos y ventas." : acct.error ? "No se pudo consultar Stripe" : acct.payouts_enabled ? `Activa · ${acct.country} · pagos en ${(acct.currency || "").toUpperCase()}` : "Alta incompleta: Stripe necesita más datos antes de pagarte."}</p></div></div>
          {!acct.connected && (
            <div className="flex gap-2 items-center">
              <select value={country} onChange={(e) => setCountry(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-sm flex-1" data-testid="earnings-country-select">{COUNTRIES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
              <Button className="rounded-full" onClick={onboard} disabled={busy === "onboard"} data-testid="earnings-connect-btn">{busy === "onboard" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Conectar cuenta"}</Button>
            </div>
          )}
          {acct.connected && (acct.requirements_due || []).length > 0 && <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-500/10 rounded-xl p-2.5" data-testid="earnings-requirements"><AlertTriangle className="w-4 h-4 shrink-0" /><span>Requisitos pendientes: {acct.requirements_due.join(", ")}</span></div>}
          {acct.connected && <div className="flex gap-2"><Button variant="outline" size="sm" className="rounded-full" onClick={onboard} data-testid="earnings-continue-onboarding">Completar datos</Button><Button variant="ghost" size="sm" className="rounded-full" onClick={dashboard} data-testid="earnings-stripe-dashboard"><ExternalLink className="w-4 h-4 mr-1" /> Panel Stripe</Button></div>}
        </section>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Money label="Disponible para retirar" map={data.balances?.available} testId="bal-available" tone="bg-emerald-500/5 border-emerald-500/30" />
          <Money label="Pendiente (Stripe)" map={data.balances?.pending} testId="bal-pending" />
          <Money label="Pagado al banco" map={data.paid_out} testId="bal-paid" />
        </section>
        {availableEntries.length > 0 && acct.payouts_enabled && <div className="flex gap-2 flex-wrap">{availableEntries.map(([cur, v]) => <Button key={cur} className="rounded-full" onClick={() => payout(cur)} disabled={busy === "payout"} data-testid={`payout-btn-${cur}`}><Wallet className="w-4 h-4 mr-1.5" /> Retirar {fmtMoney(v, cur)}</Button>)}</div>}
        <p className="text-[11px] text-muted-foreground">Las ganancias acumuladas no son saldo retirable: solo puedes retirar el saldo disponible que Stripe ya liberó. {data.notes?.processor_fees}.</p>

        {Object.entries(summary).map(([cur, s]) => (
          <section key={cur} className="rounded-3xl border border-border/60 p-4" data-testid={`summary-${cur}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Resumen {cur.toUpperCase()} · {s.count} operaciones{s.disputed ? ` · ${s.disputed} en disputa` : ""}</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
              {[["Bruto", s.gross], ["Descuentos", -s.discounts], ["Comisión BRUNO", -s.fees], ["Reembolsos", -s.refunds], ["Neto", s.net]].map(([l, v]) => <div key={l} className={l === "Neto" ? "font-bold" : ""}><p className="text-[11px] text-muted-foreground">{l}</p><p className="tabular-nums">{fmtMoney(v, cur)}</p></div>)}
            </div>
          </section>
        ))}

        <section data-testid="earnings-rows">
          <h2 className="text-sm font-bold mb-2">Detalle por operación</h2>
          {data.rows.length === 0 && <p className="text-sm text-muted-foreground">Aún no tienes ingresos. Cuando vendas entradas, recibas regalos o vendas en el Marketplace aparecerán aquí.</p>}
          <div className="space-y-2">
            {data.rows.map((r) => (
              <div key={r.id} className="rounded-2xl border border-border/60 p-3 text-sm flex items-center gap-3" data-testid={`row-${r.id}`}>
                <div className="min-w-0 flex-1"><p className="font-medium truncate">{r.name}</p><p className="text-[11px] text-muted-foreground">{KIND[r.kind] || r.kind} · {new Date(r.date).toLocaleString("es")} · {STATUS[r.status] || r.status}{r.disputed ? " · DISPUTA" : ""}</p><p className="text-[11px] text-muted-foreground">Bruto {fmtMoney(r.gross, r.currency)} · comisión {fmtMoney(r.bruno_fee, r.currency)} ({r.fee_pct} %){r.refunded ? ` · reembolsado ${fmtMoney(r.refunded, r.currency)}` : ""}</p></div>
                <p className="font-bold tabular-nums shrink-0">{fmtMoney(r.net, r.currency)}</p>
              </div>
            ))}
          </div>
        </section>

        {data.payouts?.length > 0 && <section data-testid="earnings-payouts"><h2 className="text-sm font-bold mb-2">Retiros</h2>{data.payouts.map((p) => <div key={p.id} className="flex items-center justify-between text-sm py-2 border-b border-border/40"><span className="flex items-center gap-2">{p.status === "paid" ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Loader2 className="w-4 h-4 text-muted-foreground" />}{new Date(p.created_at).toLocaleDateString("es")} · {p.status}{p.failure ? ` · ${p.failure}` : ""}</span><span className="font-semibold">{fmtMoney(p.amount_minor / 100, p.currency)}</span></div>)}</section>}
        <CouponsPanel token={token} />
        <div style={{ height: "var(--content-bottom)" }} />
      </div>
    </div>
  );
}
