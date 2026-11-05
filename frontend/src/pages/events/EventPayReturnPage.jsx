import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/pages/events/eventsApi";

/** Retorno de la pasarela: la confirmación real la hace el servidor (verificación autenticada / webhook), no esta pantalla. */
export default function EventPayReturnPage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const { token } = useAuth();
  const [res, setRes] = useState(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!token) return undefined;
    const params = { purchase: sp.get("purchase"), session_id: sp.get("session_id") || undefined, id: sp.get("id") || undefined, cancel: sp.get("cancel") || undefined };
    api.paymentStatus(token, id, params).then(setRes).catch(() => setRes({ purchase: { status: "unknown" } }));
    if (tries < 6) { const t = setTimeout(() => setTries((n) => n + 1), 4000); return () => clearTimeout(t); }
    return undefined;
  }, [token, id, sp, tries]);
  const st = res?.purchase?.status;
  const done = st === "paid"; const failed = ["failed", "cancelled", "voided"].includes(st);
  return (
    <div className="min-h-screen flex items-center justify-center p-6" data-testid="event-pay-return">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center space-y-3">
        {!res ? <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /> : done ? <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" /> : failed ? <XCircle className="w-12 h-12 text-destructive mx-auto" /> : <Clock className="w-12 h-12 text-amber-500 mx-auto" />}
        <h1 className="text-lg font-bold" data-testid="pay-status-title">{!res ? "Verificando pago…" : done ? "Pago confirmado" : failed ? "Pago no completado" : "Pago en proceso"}</h1>
        <p className="text-sm text-muted-foreground">{done ? (res.purchase.kind === "activation" ? "Tu tarjeta de evento ya está activa. Publícala cuando quieras." : "La ampliación ya se aplicó al álbum; tus fotos siguen intactas.") : failed ? "No se realizó ningún cargo. Puedes intentarlo de nuevo." : "Esperando la confirmación del proveedor. Puedes cerrar esta pantalla; te avisaremos en BRUNO."}</p>
        <Button asChild className="w-full rounded-full" data-testid="pay-back-btn"><Link to={`/events/${id}/manage`}>Volver al evento</Link></Button>
      </div>
    </div>
  );
}
