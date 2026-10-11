import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, Link } from "react-router-dom";
import { ArrowLeft, Loader2, Ban, Search, AlertTriangle, EyeOff, UserX, Radio, CheckCircle2, ShieldCheck, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ACTION = {
  warn_user: ["Advertencia", AlertTriangle, "text-amber-500 bg-amber-500/10"], warn: ["Advertencia", AlertTriangle, "text-amber-500 bg-amber-500/10"],
  remove_content: ["Contenido retirado", EyeOff, "text-orange-500 bg-orange-500/10"], remove: ["Contenido retirado", EyeOff, "text-orange-500 bg-orange-500/10"],
  suspend_user: ["Cuenta suspendida", UserX, "text-destructive bg-destructive/10"], suspend: ["Cuenta suspendida", UserX, "text-destructive bg-destructive/10"], ban: ["Baneo permanente", Ban, "text-destructive bg-destructive/10"],
  stop_live: ["Live detenido", Radio, "text-red-500 bg-red-500/10"], dismiss: ["Reporte descartado", CheckCircle2, "text-emerald-500 bg-emerald-500/10"], review: ["Revisado", ShieldCheck, "text-muted-foreground bg-foreground/[0.06]"],
};
const TYPE = { live: "live", post: "publicación", user: "cuenta", comment: "comentario", product: "producto", message: "mensaje" };

const TimelineEvent = ({ e, i }) => {
  const [label, Icon, cls] = ACTION[e.action] || [e.action, ShieldCheck, "text-muted-foreground bg-foreground/[0.06]"];
  return (
    <li className="relative pl-10 pb-5 last:pb-0" data-testid={`mod-event-${i}`}>
      <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border/60 last:hidden" />
      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full grid place-items-center ${cls}`}><Icon className="w-4 h-4" /></div>
      <div className="rounded-2xl border border-border/50 bg-card/60 p-3 text-sm">
        <p className="font-semibold">{label}{e.content_type && e.content_type !== "user" ? <span className="text-muted-foreground font-normal"> · sobre {TYPE[e.content_type] || e.content_type}{e.content_label ? ` «${e.content_label}»` : ""}</span> : null}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{e.at ? new Date(e.at).toLocaleString("es") : "fecha desconocida"} · por <b className="text-foreground" data-testid={`mod-event-by-${i}`}>{e.by?.name || "Sistema"}</b></p>
        {e.reason && <p className="text-xs mt-1.5 rounded-lg bg-foreground/[0.05] px-2 py-1"><span className="text-muted-foreground">Motivo:</span> {e.reason}</p>}
        {e.report_ids?.length > 0 && <p className="text-[10px] text-muted-foreground mt-1">Reporte{e.report_ids.length > 1 ? "s" : ""}: {e.report_ids.join(", ")}</p>}
      </div>
    </li>
  );
};

export default function AdminUserModerationPage() {
  const { userId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const headers = { Authorization: `Bearer ${token}` };
  const [data, setData] = useState(null);
  const [forbidden, setForbidden] = useState(false);
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);

  useEffect(() => {
    if (!token || !userId) return;
    setData(null);
    axios.get(`${API}/admin/users/${userId}/moderation-timeline`, { headers }).then((r) => setData(r.data)).catch((e) => { if (e?.response?.status === 403) setForbidden(true); else setData({ error: e?.response?.data?.detail || "No se pudo cargar" }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, userId]);

  useEffect(() => {
    if (!token || q.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => axios.get(`${API}/admin/users/lookup`, { params: { q }, headers }).then((r) => setFound(r.data)).catch((e) => { if (e?.response?.status === 403) setForbidden(true); }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, token]);

  if (forbidden) return <div className="min-h-screen grid place-items-center p-6 text-center" data-testid="admin-mod-forbidden"><div><Ban className="w-10 h-10 mx-auto text-destructive" /><p className="font-bold mt-2">Solo administración</p><Button className="rounded-full mt-4" onClick={() => navigate(-1)}>Volver</Button></div></div>;
  return (
    <div className="min-h-screen bg-background" data-testid="admin-user-moderation-page">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <div className="h-14 px-3 flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="admin-mod-back"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-base font-bold">Historial de moderación</h1></div>
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2 h-10 rounded-full bg-foreground/[0.05] px-3"><Search className="w-4 h-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuario por nombre, correo o id" className="flex-1 bg-transparent outline-none text-sm" data-testid="admin-mod-user-search" /></div>
          {found.length > 0 && (
            <div className="mt-2 rounded-2xl border border-border/50 bg-card/80 overflow-hidden" data-testid="admin-mod-user-results">
              {found.map((u) => <Link key={u.id} to={`/admin/users/${u.id}/moderation`} onClick={() => { setQ(""); setFound([]); }} className="flex items-center gap-2 px-3 py-2 hover:bg-foreground/[0.04]" data-testid={`admin-mod-user-${u.id}`}><div className="w-8 h-8 rounded-full bg-foreground/[0.08] overflow-hidden grid place-items-center">{u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-muted-foreground" />}</div><div className="min-w-0"><p className="text-sm font-semibold truncate">{u.name}{u.is_active === false ? <span className="text-destructive text-xs"> · suspendido</span> : null}</p><p className="text-[11px] text-muted-foreground truncate">{u.email}</p></div></Link>)}
            </div>
          )}
        </div>
      </div>
      <div className="max-w-2xl mx-auto p-4">
        {!userId ? <p className="text-sm text-muted-foreground text-center py-16" data-testid="admin-mod-pick-user">Busca un usuario para ver todas las acciones de moderación aplicadas sobre él.</p>
          : data === null ? <div className="grid place-items-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : data.error ? <p className="text-sm text-destructive text-center py-16">{data.error}</p>
          : (
            <>
              <div className="rounded-2xl border border-border/50 bg-card/60 p-3 flex items-center gap-3 mb-5" data-testid="admin-mod-user-card">
                <div className="w-12 h-12 rounded-full bg-foreground/[0.08] overflow-hidden grid place-items-center shrink-0">{data.user.avatar_url ? <img src={data.user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}</div>
                <div className="min-w-0 flex-1"><p className="font-bold truncate">{data.user.name}</p><p className="text-xs text-muted-foreground truncate">{data.user.email}</p><p className="text-[11px] mt-0.5">{data.user.is_active === false ? <span className="text-destructive font-semibold">Cuenta suspendida</span> : <span className="text-emerald-600 font-semibold">Cuenta activa</span>} · {data.strikes} strike{data.strikes === 1 ? "" : "s"} · {data.reports_received} reportes recibidos · {data.reports_made} enviados</p></div>
                <Link to={`/profile/${data.user.id}`} className="text-xs text-primary font-semibold shrink-0" data-testid="admin-mod-open-profile">Ver perfil</Link>
              </div>
              {data.events.length === 0 ? <p className="text-sm text-muted-foreground text-center py-10" data-testid="admin-mod-empty">Sin acciones de moderación sobre este usuario.</p>
                : <ol data-testid="admin-mod-timeline">{data.events.map((e, i) => <TimelineEvent key={`${e.at}-${i}`} e={e} i={i} />)}</ol>}
            </>
          )}
        <div style={{ height: "var(--content-bottom)" }} />
      </div>
    </div>
  );
}
