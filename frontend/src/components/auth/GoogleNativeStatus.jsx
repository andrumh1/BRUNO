/* Estado visible del login con Google en la app nativa: abriendo / esperando / error con Reintentar. En web no renderiza. */
import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isNative } from '@/native/capacitor';
import { startGoogleLogin, cancelNativeHandoff } from '@/lib/googleLogin';

export default function GoogleNativeStatus() {
  const [st, setSt] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    if (!isNative()) return undefined;
    const on = (e) => setSt(e.detail || { status: 'idle', message: '' });
    window.addEventListener('bruno:google-status', on);
    return () => window.removeEventListener('bruno:google-status', on);
  }, []);

  if (!isNative() || st.status === 'idle' || st.status === 'done') return null;

  if (st.status === 'error') {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 space-y-2" role="alert" data-testid="google-native-error">
        <p className="text-xs text-destructive" data-testid="google-native-error-text">{st.message}</p>
        <div className="flex gap-2">
          <Button type="button" size="sm" className="rounded-full flex-1" onClick={() => startGoogleLogin()} data-testid="google-native-retry-btn"><RefreshCw className="w-3.5 h-3.5 mr-1" /> Reintentar</Button>
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => cancelNativeHandoff()} data-testid="google-native-dismiss-btn">Cerrar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/40 p-3 flex items-center gap-3" data-testid="google-native-waiting">
      <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium" data-testid="google-native-waiting-text">{st.status === 'opening' ? 'Abriendo Google…' : 'Completa el inicio de sesión en la ventana de Google y vuelve a BRUNO.'}</p>
        {st.message ? <p className="text-[11px] text-muted-foreground mt-0.5">{st.message}</p> : null}
      </div>
      <button type="button" onClick={() => cancelNativeHandoff()} className="w-8 h-8 rounded-full grid place-items-center text-muted-foreground hover:bg-muted shrink-0" aria-label="Cancelar" data-testid="google-native-cancel-btn"><X className="w-4 h-4" /></button>
    </div>
  );
}
