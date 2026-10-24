import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { API, PRODUCTION_LABELS, StatusPill, auth } from "./serviceApi";

export default function AdminOrdersPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const load = () => axios.get(`${API}/orders`, { ...auth(token), params: status ? { status } : {} }).then((r) => setRows(r.data)).catch((e) => setError(e.response?.status === 403 ? "Acceso solo para el equipo autorizado de BRUNO." : "No se pudieron cargar los pedidos."));
  useEffect(() => { if (token) load(); }, [token, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = (rows || []).filter((o) => !q || [o.id, o.name, o.email, o.card_name].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="min-h-screen bg-background px-4 py-6 pb-28" data-testid="admin-orders-page">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")} data-testid="admin-orders-back"><ArrowLeft className="w-5 h-5" /></Button>
          <Package className="w-5 h-5 text-primary" /><h1 className="text-xl font-bold flex-1">Pedidos · Creamos tu tarjeta</h1>
          <Button variant="outline" size="icon" className="rounded-full" onClick={load} data-testid="admin-orders-refresh"><RefreshCw className="w-4 h-4" /></Button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]"><Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por referencia, nombre o correo" className="pl-9" data-testid="admin-orders-search" /></div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 rounded-lg bg-muted px-3 text-sm" data-testid="admin-orders-filter">
            <option value="">Todos los estados</option>
            {Object.keys(PRODUCTION_LABELS).map((k) => <option key={k} value={k}>{PRODUCTION_LABELS[k][0]}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-destructive" data-testid="admin-orders-error">{error}</p>}
        {rows && list.length === 0 && !error && <p className="text-sm text-muted-foreground" data-testid="admin-orders-empty">No hay pedidos con ese filtro.</p>}
        <div className="space-y-2">
          {list.map((o) => (
            <button key={o.id} type="button" onClick={() => navigate(`/admin/pedidos/${o.id}`)} className="w-full text-left rounded-2xl border border-border bg-card p-4 hover:bg-muted/40 transition-colors" data-testid={`admin-order-row-${o.id}`}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}</span>
                <span className="font-semibold">{o.card_name}</span>
                <span className="text-xs text-muted-foreground">· {o.type} · {o.market} · {o.currency} {o.amount?.toLocaleString("es-CO")}</span>
                <span className="text-xs text-muted-foreground ml-auto">{(o.created_at || "").slice(0, 10)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{o.name} · {o.email}</span>
                <span className="ml-auto flex gap-2"><StatusPill kind="production" value={o.production_status || "received"} lang="es" /><StatusPill kind="payment" value={o.payment_status || "unpaid"} lang="es" /></span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
