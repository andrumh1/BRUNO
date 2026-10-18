import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { fmtMoney, detailMsg } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const FEE_LABELS = { live_ticket_pct: "Entradas a lives privados", gift_pct: "Regalos y propinas", marketplace_pct: "Ventas Marketplace (pagadas en BRUNO)" };

// Admin: BRUNO commissions (editable), commercial revenue, third-party money, refunds, disputes, reconciliation.
export default function AdminMoneyPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [fees, setFees] = useState({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [refunding, setRefunding] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => axios.get(`${API}/money/admin/overview`, { headers }).then((r) => { setData(r.data); setFees(r.data.fees); }).catch((e) => { if (e?.response?.status === 403) setForbidden(true); });
  useEffect(() => { if (token) load(); /* eslint-disable-next-line */ }, [token]);

  const save = async () => {
    setSaving(true);
    try { await axios.put(`${API}/money/admin/fees`, { ...fees, note }, { headers }); brunoToast.success("Comisiones actualizadas", { description: "Las operaciones anteriores conservan su tarifa original." }); setNote(""); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo guardar"); }
    finally { setSaving(false); }
  };
  const refund = async (id) => {
    if (!window.confirm("¿Reembolsar íntegramente esta operación? Se revierte la transferencia y la comisión.")) return;
    setRefunding(id);
    try { await axios.post(`${API}/money/refund`, { ledger_id: id, reason: "admin" }, { headers }); brunoToast.success("Reembolso enviado a Stripe"); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo reembolsar"); }
    finally { setRefunding(""); }
  };

  if (forbidden) return <div className="min-h-screen grid place-items-center text-center p-6"><div><ShieldAlert className="w-8 h-8 mx-auto text-destructive" /><p className="mt-2 font-semibold" data-testid="admin-money-forbidden">Solo administradores autorizados</p></div></div>;
  if (!data) return <div className="min-h-screen grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-background" data-testid="admin-money-page">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/60" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="h-14 px-3 flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-base font-bold">Finanzas BRUNO</h1><span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-bold uppercase">Modo prueba</span></div>
      </header>
      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-5">
        <section className="rounded-3xl border border-border/60 p-4 space-y-3" data-testid="admin-fees">
          <h2 className="text-sm font-bold">Comisiones de BRUNO (%)</h2>
          <p className="text-[11px] text-muted-foreground">Se calculan sobre el importe tras descuentos comerciales, sin impuestos ni envío. BRUNO absorbe las comisiones de Stripe. Cambiarlas no altera operaciones anteriores.</p>
          <div className="grid sm:grid-cols-3 gap-3">
            {Object.entries(FEE_LABELS).map(([k, l]) => <label key={k} className="text-xs"><span className="text-muted-foreground">{l}</span><Input type="number" min={0} max={50} step={0.5} value={fees[k] ?? ""} onChange={(e) => setFees({ ...fees, [k]: Number(e.target.value) })} className="mt-1 h-10 rounded-xl" data-testid={`fee-input-${k}`} /></label>)}
          </div>
          <div className="flex gap-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo del cambio (opcional)" className="h-10 rounded-xl" data-testid="fee-note" /><Button className="rounded-full" onClick={save} disabled={saving} data-testid="fee-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Guardar</>}</Button></div>
          {data.fees_history?.length > 0 && <p className="text-[11px] text-muted-foreground">Último cambio: {new Date(data.fees_history.at(-1).at).toLocaleString("es")}{data.fees_history.at(-1).note ? ` · ${data.fees_history.at(-1).note}` : ""}</p>}
        </section>

        {Object.entries(data.by_currency || {}).map(([cur, c]) => (
          <section key={cur} className="rounded-3xl border border-border/60 p-4" data-testid={`admin-summary-${cur}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{cur.toUpperCase()} · {c.count_paid} operaciones pagadas</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {[["Comisiones netas BRUNO (ingreso)", c.bruno_net_fees, "font-bold text-emerald-700"], ["Ventas comerciales BRUNO (PIUP, promos)", c.commercial_revenue, "font-bold text-emerald-700"], ["Dinero de terceros (no es ingreso)", c.third_party_gross, ""], ["Transferido a creadores/vendedores", c.transfers_to_sellers, ""], ["Reembolsos", c.refunds, ""], ["Disputas", c.disputes, "text-destructive"], ["Comisiones devueltas", c.fees_refunded, ""]].map(([l, v, cls]) => <div key={l}><p className="text-[11px] text-muted-foreground">{l}</p><p className={`tabular-nums ${cls}`}>{fmtMoney(v, cur)}</p></div>)}
            </div>
          </section>
        ))}
        <section className="grid sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl border border-border/60 p-3" data-testid="admin-platform-balance"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Saldo Stripe de BRUNO</p>{data.platform_balance?.error ? <p className="text-xs text-destructive mt-1">{data.platform_balance.error}</p> : <>{Object.entries(data.platform_balance?.available || {}).map(([k, v]) => <p key={k} className="font-bold">{fmtMoney(v, k)} disponible</p>)}{Object.entries(data.platform_balance?.pending || {}).map(([k, v]) => <p key={k} className="text-muted-foreground">{fmtMoney(v, k)} pendiente</p>)}</>}</div>
          <div className="rounded-2xl border border-border/60 p-3" data-testid="admin-connected"><p className="text-[11px] uppercase tracking-wider text-muted-foreground">Cuentas conectadas</p><p className="font-bold">{data.connected_accounts.total} · {data.connected_accounts.payouts_enabled} con pagos activos</p></div>
        </section>
        <p className="text-[11px] text-muted-foreground">{data.reconciliation_note}</p>
        {data.pending_refunds?.length > 0 && (
          <section className="rounded-3xl border border-amber-400/50 p-4 space-y-2" data-testid="admin-pending-refunds">
            <h2 className="text-sm font-bold">Reembolsos automáticos pendientes ({data.pending_refunds.length})</h2>
            <p className="text-[11px] text-muted-foreground">Entradas de lives cancelados o que nunca empezaron cuyo reembolso Stripe falló. Reintenta cuando el pago exista en Stripe.</p>
            {data.pending_refunds.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs border-t border-border/40 pt-2" data-testid={`pending-refund-${r.id}`}>
                <div className="flex-1 min-w-0"><p className="font-medium truncate">{r.name} · {fmtMoney(r.total, r.currency)}</p><p className="text-muted-foreground truncate">{r.reason} · {r.error}</p></div>
                <Button size="sm" variant="outline" className="rounded-full h-8" onClick={async () => { try { await axios.post(`${API}/money/refund`, { ledger_id: r.id, reason: r.reason || "live_not_started" }, { headers }); brunoToast.success("Reembolso emitido"); load(); } catch (e) { brunoToast.error(detailMsg(e) || "No se pudo reembolsar"); } }} data-testid={`pending-refund-retry-${r.id}`}>Reintentar</Button>
              </div>
            ))}
          </section>
        )}
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/admin/reports")} data-testid="admin-reports-link">Ver reportes y moderación</Button>
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/admin/piup")} data-testid="admin-piup-link">PIUP · Administración OVC</Button>
        <Button variant="outline" className="rounded-full" onClick={() => navigate("/admin/rendimiento")} data-testid="admin-perf-link">Rendimiento por región</Button>

        <section data-testid="admin-ledger">
          <h2 className="text-sm font-bold mb-2">Movimientos recientes</h2>
          <div className="space-y-2">{data.recent.map((e) => (
            <div key={e.id} className="rounded-2xl border border-border/60 p-3 text-xs flex items-center gap-3" data-testid={`ledger-${e.id}`}>
              <div className="min-w-0 flex-1"><p className="font-medium text-sm truncate">{e.name}</p><p className="text-muted-foreground">{e.kind} · {e.status}{e.disputed ? " · DISPUTA" : ""} · {new Date(e.created_at).toLocaleString("es")}</p><p className="text-muted-foreground">Total {fmtMoney(e.total, e.currency)} · comisión {fmtMoney(e.bruno_fee, e.currency)} ({e.fee_pct} %) · a vendedor {fmtMoney(e.seller_net, e.currency)}{e.refunded ? ` · reembolsado ${fmtMoney(e.refunded, e.currency)}` : ""}</p></div>
              {["paid", "partially_refunded"].includes(e.status) && <Button size="sm" variant="outline" className="rounded-full" onClick={() => refund(e.id)} disabled={refunding === e.id} data-testid={`refund-btn-${e.id}`}>{refunding === e.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Reembolsar"}</Button>}
            </div>))}</div>
        </section>
        <div style={{ height: "var(--content-bottom)" }} />
      </div>
    </div>
  );
}
