import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Gauge, Globe2, Smartphone, Wifi, Route, Server } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { OvcMark } from "@/components/brand/OvcAttribution";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const COUNTRY = { CO: "Colombia", MX: "México", US: "Estados Unidos", PE: "Perú", AR: "Argentina", BR: "Brasil", CL: "Chile", EC: "Ecuador", VE: "Venezuela", ES: "España", CA: "Canadá", PA: "Panamá", CR: "Costa Rica", DO: "Rep. Dominicana", GT: "Guatemala", ZZ: "Sin identificar" };

const grade = (ms, good, poor) => (ms == null ? "text-muted-foreground" : ms <= good ? "text-emerald-500" : ms <= poor ? "text-amber-500" : "text-red-500");
const fmt = (v, suffix = " ms") => (v == null ? "—" : `${Math.round(v).toLocaleString("es")}${suffix}`);

const Table = ({ icon: Icon, title, rows, keyField, label, testid }) => (
  <section className="rounded-2xl border border-border/60 overflow-hidden" data-testid={testid}>
    <header className="px-4 py-2.5 flex items-center gap-2 bg-muted/40 text-sm font-semibold"><Icon className="w-4 h-4 text-orange-500" />{title}</header>
    {rows.length === 0 ? <p className="text-xs text-muted-foreground px-4 py-6 text-center">Aún sin datos: se llenan solos a medida que la gente usa BRUNO.</p> : (
      <div className="overflow-x-auto"><table className="w-full text-xs">
        <thead className="text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium"><th>{label}</th><th>Sesiones</th><th>Carga (LCP p75)</th><th>Respuesta (TTFB p75)</th><th>Interacción (INP p75)</th><th>API media</th><th>Fallos API</th><th>Latencia red</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r[keyField]} className="border-t border-border/40 [&>td]:px-3 [&>td]:py-2 tabular-nums" data-testid={`${testid}-row-${r[keyField]}`}>
            <td className="font-semibold">{keyField === "country" ? `${COUNTRY[r.country] || r.country} (${r.country})` : r[keyField]}</td><td>{r.sessions}</td>
            <td className={grade(r.lcp_p75_ms, 2500, 4000)}>{fmt(r.lcp_p75_ms)}</td><td className={grade(r.ttfb_p75_ms, 800, 1800)}>{fmt(r.ttfb_p75_ms)}</td><td className={grade(r.inp_p75_ms, 200, 500)}>{fmt(r.inp_p75_ms)}</td>
            <td className={grade(r.api_avg_ms, 400, 1200)}>{fmt(r.api_avg_ms)}</td><td className={r.api_fail_rate_pct > 2 ? "text-red-500" : ""}>{r.api_fail_rate_pct}%</td><td>{fmt(r.net_rtt_p75_ms)}</td>
          </tr>))}</tbody>
      </table></div>)}
  </section>
);

export default function AdminPerformancePage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (!token) return;
    setData(null);
    axios.get(`${API}/telemetry/perf/summary?days=${days}`, { headers }).then((r) => setData(r.data)).catch((e) => { if (e?.response?.status === 403) setDenied(true); });
  }, [token, headers, days]);

  if (denied) return <div className="min-h-screen grid place-items-center text-center p-6"><div><p className="font-bold">Solo administradores de BRUNO / OVC</p><Button className="mt-3 rounded-full" onClick={() => navigate(-1)}>Volver</Button></div></div>;

  return (
    <div className="min-h-screen bg-background" data-testid="admin-performance-page">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)} data-testid="admin-perf-back"><ArrowLeft className="w-5 h-5" /></Button>
          <OvcMark size={32} />
          <div className="flex-1 min-w-0"><h1 className="text-lg font-bold flex items-center gap-2"><Gauge className="w-5 h-5 text-orange-500" />Rendimiento real por región</h1><p className="text-[11px] text-muted-foreground">Mediciones anónimas de usuarios reales: país, dispositivo, red y ruta. Verde = bueno, ámbar = mejorable, rojo = lento.</p></div>
          <div className="flex gap-1">{[1, 7, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={`px-3 h-8 rounded-full text-xs font-semibold ${days === d ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"}`} data-testid={`admin-perf-days-${d}`}>{d === 1 ? "24 h" : `${d} días`}</button>)}</div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        {data === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> : (<>
          <p className="text-sm text-muted-foreground" data-testid="admin-perf-sessions">{data.sessions.toLocaleString("es")} sesiones medidas en los últimos {data.days} días. Alerta automática a administradores (centro de notificaciones + push) cuando un país supera {Math.round((data.threshold_ms || 4000) / 1000)} s de carga (p75, mín. 5 sesiones/24 h).</p>
          {(data.alerts || []).length > 0 && (
            <section className="rounded-2xl border border-red-500/40 bg-red-500/5 p-3 space-y-1" data-testid="admin-perf-alerts">
              <p className="text-sm font-semibold text-red-600 dark:text-red-400">Alertas de lentitud recientes</p>
              {data.alerts.map((a) => <p key={a.country} className="text-xs text-muted-foreground" data-testid={`admin-perf-alert-${a.country}`}>{COUNTRY[a.country] || a.country}: {fmt(a.lcp_p75_ms)} (p75, {a.sessions} sesiones) · {new Date(a.at).toLocaleString("es")}</p>)}
            </section>
          )}
          <Table icon={Globe2} title="Por país" rows={data.by_country} keyField="country" label="País" testid="admin-perf-country" />
          <Table icon={Smartphone} title="Por dispositivo" rows={data.by_device} keyField="device" label="Dispositivo" testid="admin-perf-device" />
          <Table icon={Wifi} title="Por tipo de red" rows={data.by_network} keyField="net_type" label="Red" testid="admin-perf-network" />
          <Table icon={Route} title="Por pantalla" rows={data.by_route} keyField="route" label="Ruta" testid="admin-perf-route" />
          <section className="rounded-2xl border border-border/60 overflow-hidden" data-testid="admin-perf-server">
            <header className="px-4 py-2.5 flex items-center gap-2 bg-muted/40 text-sm font-semibold"><Server className="w-4 h-4 text-orange-500" />Servidor: tiempo por endpoint (desde el último arranque)</header>
            <div className="overflow-x-auto"><table className="w-full text-xs">
              <thead className="text-muted-foreground"><tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:font-medium"><th>Endpoint</th><th>Llamadas</th><th>p50</th><th>p95</th><th>Máx</th><th>Errores 5xx</th></tr></thead>
              <tbody>{data.server_routes.map((r) => <tr key={r.route} className="border-t border-border/40 [&>td]:px-3 [&>td]:py-2 tabular-nums"><td className="font-mono">{r.route}</td><td>{r.count}</td><td className={grade(r.p50_ms, 150, 500)}>{fmt(r.p50_ms)}</td><td className={grade(r.p95_ms, 400, 1000)}>{fmt(r.p95_ms)}</td><td>{fmt(r.max_ms)}</td><td className={r.errors_5xx ? "text-red-500 font-semibold" : ""}>{r.errors_5xx}</td></tr>)}</tbody>
            </table></div>
          </section>
        </>)}
      </div>
    </div>
  );
}
