import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

/** Invitación discreta a crear cuenta BRUNO para quien mira un evento/invitación sin sesión. Nunca bloquea el contenido. */
export const JoinBrunoNudge = ({ benefits = [], reason, compact = false }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const key = `bruno_nudge_hidden_${location.pathname}`;
  const [hidden, setHidden] = useState(() => sessionStorage.getItem(key) === "1");
  const [open, setOpen] = useState(!!reason);
  if (isLoading || isAuthenticated || hidden) return null;
  const redirect = encodeURIComponent(location.pathname + location.search);
  const dismiss = () => { sessionStorage.setItem(key, "1"); setHidden(true); };
  if (compact && !open && !reason) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="fixed left-1/2 -translate-x-1/2 z-30 rounded-full bg-foreground text-background text-xs font-semibold px-4 py-2 shadow-lg flex items-center gap-2" style={{ bottom: "calc(var(--content-bottom, 80px) + 8px)" }} data-testid="join-nudge-pill">
        <Sparkles className="w-3.5 h-3.5" /> Únete a BRUNO gratis
      </button>
    );
  }
  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-4 shadow-sm" data-testid="join-nudge">
      <div className="flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{reason || "Crea tu cuenta BRUNO gratis"}</p>
          <ul className="mt-1.5 space-y-1">
            {benefits.slice(0, 4).map((b) => <li key={b} className="text-xs text-muted-foreground flex items-center gap-1.5"><Check className="w-3 h-3 text-emerald-600 shrink-0" />{b}</li>)}
          </ul>
          <div className="flex gap-2 mt-3">
            <Button asChild size="sm" className="rounded-full" data-testid="join-nudge-register"><Link to={`/register?redirect=${redirect}`}>Crear cuenta</Link></Button>
            <Button asChild size="sm" variant="outline" className="rounded-full" data-testid="join-nudge-login"><Link to={`/login?redirect=${redirect}`}>Ya tengo cuenta</Link></Button>
          </div>
        </div>
        <button type="button" onClick={dismiss} className="p-1 rounded-full hover:bg-muted" aria-label="Cerrar" data-testid="join-nudge-close"><X className="w-4 h-4" /></button>
      </div>
    </div>
  );
};
