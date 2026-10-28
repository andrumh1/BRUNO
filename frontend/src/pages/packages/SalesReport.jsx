import React, { useEffect, useState } from "react";
import { BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { api } from "./packagesApi";

const money = (v, cur) => (cur === "COP" ? `COP $${Math.round(v).toLocaleString("es-CO")}` : `US$${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0 })}`);
const val = (r, k) => { const [a, cur] = k.split("_"); return cur === "COP" || cur === "USD" ? money(r[a]?.[cur] || 0, cur) : r[k]; };
const Cell = ({ r, k }) => <td className="px-2 py-1.5 text-right whitespace-nowrap" data-testid={`sales-${k}-${r.advisor_handle}`}>{val(r, k)}</td>;

/** Resumen mensual de ventas por asesor (solo admin): efectivo vs. virtual, por moneda, con exportación a Excel. */
export const SalesReport = () => {
  const { token } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [rep, setRep] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (token && month) api.salesReport(token, month).then(setRep).catch(() => setRep(null)); }, [token, month]);
  const download = async () => {
    setBusy(true);
    try {
      const blob = await api.salesXlsx(token, month);
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `bruno-ventas-${month}.xlsx`; a.click(); URL.revokeObjectURL(a.href);
    } catch { brunoToast.error("No se pudo generar el Excel"); } finally { setBusy(false); }
  };
  const t = rep?.totals;
  const cols = [["sales", "Ventas"], ["cash_count", "Efectivo (n)"], ["cash_COP", "Efectivo COP"], ["cash_USD", "Efectivo USD"], ["virtual_count", "Virtual (n)"], ["virtual_COP", "Virtual COP"], ["virtual_USD", "Virtual USD"], ["activated", "Activados"], ["pending", "Pendientes"]];
  return (
    <section className="rounded-2xl border border-border bg-card p-4 mb-5" data-testid="sales-report">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-primary" /><h2 className="font-semibold text-sm flex-1">Reporte de ventas por asesor</h2>
        <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-40 text-xs" data-testid="sales-month" />
        <Button variant="outline" size="sm" className="rounded-full" onClick={download} disabled={busy || !rep} data-testid="sales-export-xlsx"><Download className="w-4 h-4 mr-1" />Excel</Button>
      </div>
      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
          <div className="rounded-xl bg-muted p-2" data-testid="sales-total-sales"><div className="text-muted-foreground">Ventas pagadas</div><div className="text-lg font-bold">{t.sales}</div></div>
          <div className="rounded-xl bg-muted p-2" data-testid="sales-total-cash"><div className="text-muted-foreground">Efectivo ({t.cash_count})</div><div className="font-bold">{money(t.cash.COP, "COP")}</div><div className="font-bold">{money(t.cash.USD, "USD")}</div></div>
          <div className="rounded-xl bg-muted p-2" data-testid="sales-total-virtual"><div className="text-muted-foreground">Virtual ({t.virtual_count})</div><div className="font-bold">{money(t.virtual.COP, "COP")}</div><div className="font-bold">{money(t.virtual.USD, "USD")}</div></div>
          <div className="rounded-xl bg-muted p-2" data-testid="sales-total-pending"><div className="text-muted-foreground">Activados / pendientes</div><div className="text-lg font-bold">{t.activated} / {t.pending}</div></div>
        </div>
      )}
      {rep && rep.rows.length === 0 && <p className="text-xs text-muted-foreground" data-testid="sales-empty">Sin ventas ni paquetes en {rep.month}.</p>}
      {rep && rep.rows.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="text-xs min-w-full" data-testid="sales-table">
            <thead><tr className="text-muted-foreground border-b border-border"><th className="px-2 py-1.5 text-left">Asesor</th>{cols.map(([k, l]) => <th key={k} className="px-2 py-1.5 text-right whitespace-nowrap">{l}</th>)}</tr></thead>
            <tbody>{rep.rows.map((r) => <tr key={r.advisor_id} className="border-b border-border/60" data-testid={`sales-row-${r.advisor_handle}`}><td className="px-2 py-1.5 font-semibold">@{r.advisor_handle}</td>{cols.map(([k]) => <Cell key={k} r={r} k={k} />)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
};
