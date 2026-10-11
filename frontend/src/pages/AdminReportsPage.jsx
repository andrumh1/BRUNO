import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldAlert, Radio, Ban, EyeOff, AlertTriangle, CheckCircle2, UserX, History } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { detailMsg } from "@/hooks/useBrunoCheckout";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const TABS = [["pending", "Pendientes"], ["reviewing", "En revisión"], ["resolved", "Resueltos"], ["dismissed", "Descartados"], ["all", "Todos"]];
const TYPE = { live: "Live", post: "Publicación", user: "Usuario", comment: "Comentario", product: "Producto", message: "Mensaje" };

const ReportCard = ({ r, onAction, onStopLive, busy }) => (
  <div className="rounded-2xl border border-border/60 p-3 text-sm space-y-2" data-testid={`report-${r.id}`}>
    <div className="flex items-start gap-2">
      <div className="w-9 h-9 rounded-xl bg-destructive/10 text-destructive grid place-items-center shrink-0"><ShieldAlert className="w-4 h-4" /></div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="font-semibold">{TYPE[r.content_type] || r.content_type} · <span className="text-destructive">{r.reason}</span></p>
        <p className="text-[11px] text-muted-foreground">Reportado por {r.reporter_name} · {new Date(r.created_at).toLocaleString("es")} · <span data-testid={`report-status-${r.id}`}>{r.status}</span>{r.action_taken ? ` · acción: ${r.action_taken}` : ""}</p>
        {r.additional_info && <p className="text-xs mt-1">{r.additional_info}</p>}
        {r.target?.kind === "live" && <p className="text-xs mt-1 rounded-lg bg-foreground/[0.05] px-2 py-1"><Radio className="inline w-3 h-3 mr-1 text-red-500" />«{r.target.title}» de {r.target.host_name} · estado <b>{r.target.status}</b>{r.target.is_private ? " · privado" : ""}</p>}
        {r.target?.kind === "post" && <p className="text-xs mt-1 rounded-lg bg-foreground/[0.05] px-2 py-1 truncate">Post: {r.target.preview || "(sin texto)"}</p>}
        {r.target?.kind === "user" && <p className="text-xs mt-1 rounded-lg bg-foreground/[0.05] px-2 py-1">Usuario: {r.target.name} {r.target.is_active === false ? "· suspendido" : ""}</p>}
        {!r.target && <p className="text-[11px] text-muted-foreground mt-1">Contenido no encontrado (id {r.content_id})</p>}
        {(r.target_user_id || r.target?.host_id || r.target?.user_id || (r.content_type === "user" && r.content_id)) && (
          <Link to={`/admin/users/${r.target_user_id || r.target?.host_id || r.target?.user_id || r.content_id}/moderation`} className="inline-flex items-center gap-1 text-[11px] text-primary font-semibold mt-1" data-testid={`report-user-history-${r.id}`}><History className="w-3 h-3" />Historial de moderación del usuario</Link>
        )}
      </div>
    </div>
    {["pending", "reviewing"].includes(r.status) && (
      <div className="flex flex-wrap gap-1.5">
        {r.target?.kind === "live" && r.target.can_stop && <Button size="sm" className="rounded-full h-9 bg-red-600 hover:bg-red-700" disabled={busy} onClick={() => onStopLive(r)} data-testid={`report-stop-live-${r.id}`}><Radio className="w-4 h-4 mr-1" /> Detener live</Button>}
        <Button size="sm" variant="outline" className="rounded-full h-9" disabled={busy} onClick={() => onAction(r, "warn_user")} data-testid={`report-warn-${r.id}`}><AlertTriangle className="w-4 h-4 mr-1" /> Advertir</Button>
        {r.content_type !== "user" && <Button size="sm" variant="outline" className="rounded-full h-9" disabled={busy} onClick={() => onAction(r, "remove_content")} data-testid={`report-remove-${r.id}`}><EyeOff className="w-4 h-4 mr-1" /> Quitar contenido</Button>}
        <Button size="sm" variant="outline" className="rounded-full h-9 text-destructive" disabled={busy} onClick={() => onAction(r, "suspend_user")} data-testid={`report-suspend-${r.id}`}><UserX className="w-4 h-4 mr-1" /> Suspender</Button>
        <Button size="sm" variant="ghost" className="rounded-full h-9" disabled={busy} onClick={() => onAction(r, "dismiss")} data-testid={`report-dismiss-${r.id}`}><CheckCircle2 className="w-4 h-4 mr-1" /> Descartar</Button>
      </div>
    )}
  </div>
);

export default function AdminReportsPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };
  const [tab, setTab] = useState("pending");
  const [list, setList] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = () => axios.get(`${API}/admin/reports`, { params: { status: tab }, headers }).then((r) => setList(r.data)).catch((e) => { if (e?.response?.status === 403) setForbidden(true); else setList([]); });
  useEffect(() => { if (token) { setList(null); load(); } /* eslint-disable-next-line */ }, [token, tab]);

  const act = async (r, action) => {
    setBusy(true);
    try { await axios.put(`${API}/admin/reports/${r.id}`, null, { params: { action }, headers }); brunoToast.success("Reporte actualizado"); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo aplicar la acción"); }
    finally { setBusy(false); }
  };
  const stopLive = async (r) => {
    setBusy(true);
    try { await axios.post(`${API}/admin/lives/${r.target.id}/stop`, null, { params: { report_id: r.id, reason: `Reporte: ${r.reason}` }, headers }); brunoToast.success("Live detenido y reporte resuelto"); load(); }
    catch (e) { brunoToast.error(detailMsg(e) || "No se pudo detener el live"); }
    finally { setBusy(false); }
  };

  if (forbidden) return <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="admin-reports-forbidden"><div><Ban className="w-10 h-10 mx-auto text-destructive" /><p className="font-bold mt-2">Solo administración</p><Button className="rounded-full mt-4" onClick={() => navigate(-1)}>Volver</Button></div></div>;
  return (
    <div className="min-h-screen bg-background" data-testid="admin-reports-page">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/40" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="h-14 px-3 flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="admin-reports-back"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-base font-bold flex-1">Reportes y moderación</h1><Link to="/admin/users" className="h-9 px-3 rounded-full bg-foreground/[0.06] text-xs font-semibold inline-flex items-center gap-1" data-testid="admin-reports-history-link"><History className="w-3.5 h-3.5" />Historial</Link></div>
        <div className="flex gap-1.5 px-3 pb-2 overflow-x-auto no-scrollbar">{TABS.map(([id, label]) => <button key={id} onClick={() => setTab(id)} className={`shrink-0 h-8 px-3 rounded-full text-xs font-semibold ${tab === id ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid={`admin-reports-tab-${id}`}>{label}</button>)}</div>
      </div>
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        {list === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : list.length === 0 ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="admin-reports-empty">No hay reportes en esta lista.</p>
          : list.map((r) => <ReportCard key={r.id} r={r} onAction={act} onStopLive={stopLive} busy={busy} />)}
        <div style={{ height: "var(--content-bottom)" }} />
      </div>
    </div>
  );
}
