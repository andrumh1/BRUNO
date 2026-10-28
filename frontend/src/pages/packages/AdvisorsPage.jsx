import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Briefcase, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { api, DELIV, PAY, PREP, Pill } from "./packagesApi";
import { SalesReport } from "./SalesReport";

const Sel = ({ value, onChange, options, testId }) => <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg bg-muted px-2 text-xs" data-testid={testId}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;

/** /asesores — área interna: cada asesor ve sus paquetes; el administrador ve todos con filtros. */
export default function AdvisorsPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [access, setAccess] = useState(null);
  const [rows, setRows] = useState([]);
  const [f, setF] = useState({ advisor: "", market: "", payment_method: "", payment: "", delivery: "", since: "", until: "" });
  const [error, setError] = useState("");
  const load = (acc) => api.list(token, Object.fromEntries(Object.entries(f).filter(([, v]) => v))).then(setRows).catch(() => setError("No se pudieron cargar los paquetes."));
  useEffect(() => { if (!token) return; api.access(token).then((a) => { setAccess(a); if (a.advisor) load(a); else setError("Acceso solo para asesores y administradores autorizados."); }).catch(() => setError("Sin acceso")); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (access?.advisor) load(access); }, [f]); // eslint-disable-line react-hooks/exhaustive-deps
  const create = async () => { try { const p = await api.create(token); navigate(`/asesores/paquete/${p.id}`); } catch (e) { brunoToast.error(e.response?.data?.detail || "No se pudo crear el paquete"); } };
  if (error) return <div className="min-h-screen grid place-items-center p-6 text-sm text-destructive text-center" data-testid="advisors-denied">{error}</div>;
  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-28" data-testid="advisors-page">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="advisors-back"><ArrowLeft className="w-5 h-5" /></Button>
          <Briefcase className="w-5 h-5 text-primary" /><h1 className="text-xl font-bold flex-1">Área de asesores</h1>
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => load(access)} data-testid="advisors-refresh"><RefreshCw className="w-4 h-4" /></Button>
          <Button className="rounded-full" onClick={create} data-testid="advisors-new-package"><Plus className="w-4 h-4 mr-1" />Nuevo paquete</Button>
        </div>
        <p className="text-xs text-muted-foreground mb-4 ml-12" data-testid="advisors-handle">Sesión: <b>{access?.handle ? `@${access.handle}` : "…"}</b>{access?.admin ? " · administrador" : access?.cash ? " · con permiso de cobro" : ""} · Oferta: perfil completo + 3 tarjetas · COP $30.000 (CO) / US$30 (US)</p>
        {access?.admin && <SalesReport />}
        <div className="flex flex-wrap gap-2 mb-4">
          {access?.admin && <Input value={f.advisor} onChange={(e) => setF({ ...f, advisor: e.target.value })} placeholder="@asesor" className="h-9 w-36 text-xs" data-testid="advisors-filter-advisor" />}
          <Sel value={f.market} onChange={(v) => setF({ ...f, market: v })} options={[["", "País"], ["CO", "Colombia"], ["US", "Estados Unidos"]]} testId="advisors-filter-market" />
          <Sel value={f.payment_method} onChange={(v) => setF({ ...f, payment_method: v })} options={[["", "Método"], ["virtual", "Virtual"], ["cash", "Efectivo"]]} testId="advisors-filter-method" />
          <Sel value={f.payment} onChange={(v) => setF({ ...f, payment: v })} options={[["", "Pago"], ...Object.keys(PAY).map((k) => [k, PAY[k][0]])]} testId="advisors-filter-payment" />
          <Sel value={f.delivery} onChange={(v) => setF({ ...f, delivery: v })} options={[["", "Entrega"], ...Object.keys(DELIV).map((k) => [k, DELIV[k][0]])]} testId="advisors-filter-delivery" />
          <Input type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} className="h-9 w-36 text-xs" data-testid="advisors-filter-since" />
          <Input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} className="h-9 w-36 text-xs" data-testid="advisors-filter-until" />
        </div>
        {rows.length === 0 && <p className="text-sm text-muted-foreground" data-testid="advisors-empty">Aún no hay paquetes. Crea el primero con «Nuevo paquete».</p>}
        <div className="space-y-2">
          {rows.map((p) => (
            <button key={p.id} type="button" onClick={() => navigate(`/asesores/paquete/${p.id}`)} className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors" data-testid={`package-row-${p.id}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1"><span className="font-mono text-xs text-muted-foreground">{p.ref}</span><span className="font-semibold">{p.client?.name || "Cliente sin nombre"}</span><span className="text-xs text-muted-foreground">· @{p.advisor_handle} · {p.market || "—"} {p.price_label || ""} · {p.payment_method === "cash" ? "Efectivo" : p.payment_method === "virtual" ? "Virtual" : "sin método"}</span><span className="text-xs text-muted-foreground ml-auto">{(p.created_at || "").slice(0, 10)}</span></div>
              <div className="flex flex-wrap gap-1.5"><Pill map={PREP} value={p.prep_status} force="es" /><Pill map={PAY} value={p.payment_status} force="es" /><Pill map={DELIV} value={p.delivery_status} force="es" /></div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
