import React from "react";
import { Clock, X, TrendingUp, History, Sparkles, Loader2, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";

/** Pantalla inicial: historial personal (reejecutar / borrar / desactivar) + tendencias agregadas de contenido público. */
export function SearchHome({ history, trending, onPick, onRemove, onToggle, loggedIn }) {
  return (
    <div className="space-y-6" data-testid="search-home">
      {loggedIn && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold flex items-center gap-1.5"><History className="w-4 h-4 text-muted-foreground" />Recientes</h2>
            <div className="flex items-center gap-3">
              {history.items.length > 0 && <button onClick={() => onRemove(null)} className="text-xs text-primary font-medium" data-testid="search-history-clear">Borrar todo</button>}
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span>Guardar</span><Switch checked={history.enabled} onCheckedChange={onToggle} data-testid="search-history-toggle" /></label>
            </div>
          </div>
          {!history.enabled ? <p className="text-xs text-muted-foreground">El historial está desactivado: tus búsquedas no se guardan.</p>
            : history.items.length === 0 ? <p className="text-xs text-muted-foreground">Aún no has buscado nada.</p>
              : (
                <ul className="space-y-1">
                  {history.items.map((h) => (
                    <li key={h.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-foreground/[0.04]" data-testid={`search-history-${h.id}`}>
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <button onClick={() => onPick(h.q, h.type)} className="flex-1 text-left text-sm truncate" data-testid={`search-history-run-${h.id}`}>{h.q}</button>
                      <button onClick={() => onRemove(h.id)} className="p-1 rounded-full hover:bg-foreground/10" aria-label="Eliminar" data-testid={`search-history-del-${h.id}`}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </li>
                  ))}
                </ul>
              )}
        </section>
      )}
      {trending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-2"><TrendingUp className="w-4 h-4 text-muted-foreground" />Tendencias en BRUNO</h2>
          <div className="flex flex-wrap gap-2">
            {trending.map((t) => <button key={t.tag} onClick={() => onPick(`#${t.tag}`, "all")} className="rounded-full bg-card/60 border border-border/40 px-3 py-1.5 text-sm hover:bg-primary/10 hover:text-primary transition-colors" data-testid={`search-trend-${t.tag}`}>#{t.tag} <span className="text-[11px] text-muted-foreground">{t.count}</span></button>)}
          </div>
        </section>
      )}
    </div>
  );
}

/** Acción separada: genera una respuesta nueva de BRUNO IA a partir de los resultados visibles (nunca se mezcla con ellos). */
export function AskBrunoCard({ q, asking, answer, onAsk, onOpenSource }) {
  if (!q) return null;
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-3" data-testid="search-ask-card">
      {!answer ? (
        <button onClick={onAsk} disabled={asking} className="w-full flex items-center gap-2 text-left" data-testid="search-ask-btn">
          <div className="w-9 h-9 rounded-full bg-primary/15 grid place-items-center shrink-0">{asking ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Sparkles className="w-4 h-4 text-primary" />}</div>
          <div className="min-w-0"><p className="text-sm font-semibold">Preguntar a BRUNO IA</p><p className="text-xs text-muted-foreground truncate">Resume lo que encontraste sobre “{q}” citando las fuentes</p></div>
        </button>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-wide text-primary font-semibold flex items-center gap-1"><Sparkles className="w-3 h-3" />Respuesta generada por BRUNO IA · no es una publicación</p>
          <p className="text-sm whitespace-pre-wrap" data-testid="search-ask-answer">{answer.answer}</p>
          {answer.sources?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {answer.sources.map((s) => <button key={s.n} onClick={() => onOpenSource(s)} className="text-[11px] rounded-full bg-card/70 border border-border/40 px-2 py-1 inline-flex items-center gap-1 max-w-full" data-testid={`search-ask-source-${s.n}`}><span className="text-primary font-bold">[{s.n}]</span><span className="truncate max-w-[160px]">{s.label}</span><ExternalLink className="w-3 h-3 text-muted-foreground" /></button>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
