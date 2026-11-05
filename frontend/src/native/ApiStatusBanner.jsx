/* Solo app nativa: aviso claro cuando no hay internet o https://brunocard.com no responde, y aviso de sesión expirada. */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudOff, RefreshCw } from 'lucide-react';
import { brunoToast } from '@/components/bruno/BrunoToast';

export default function ApiStatusBanner() {
  const [down, setDown] = useState(navigator.onLine === false ? 'offline' : null);
  const navigate = useNavigate();

  useEffect(() => {
    const unreachable = () => setDown(navigator.onLine === false ? 'offline' : 'api');
    const ok = () => setDown(null);
    const offline = () => setDown('offline');
    const online = () => setDown((d) => (d === 'offline' ? null : d));
    const expired = () => { brunoToast.error('Tu sesión expiró. Inicia sesión de nuevo.'); navigate('/login', { replace: true }); };
    window.addEventListener('bruno:api-unreachable', unreachable);
    window.addEventListener('bruno:api-ok', ok);
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    window.addEventListener('bruno:session-expired', expired);
    return () => {
      window.removeEventListener('bruno:api-unreachable', unreachable);
      window.removeEventListener('bruno:api-ok', ok);
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
      window.removeEventListener('bruno:session-expired', expired);
    };
  }, [navigate]);

  if (!down) return null;
  const text = down === 'offline' ? 'Sin conexión a internet. Revisa tu red.' : 'No se pudo conectar con BRUNO (brunocard.com). Inténtalo de nuevo.';
  return (
    <div className="fixed left-0 right-0 z-[10000] flex items-center gap-2 px-3 py-2 bg-zinc-900 text-zinc-100 text-xs shadow-lg"
      style={{ top: 'env(safe-area-inset-top, 0px)' }} role="alert" data-testid="api-status-banner">
      <CloudOff className="w-4 h-4 shrink-0" />
      <span className="flex-1" data-testid="api-status-banner-text">{text}</span>
      <button type="button" onClick={() => window.location.reload()} className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 font-semibold" data-testid="api-status-retry-btn">
        <RefreshCw className="w-3.5 h-3.5" /> Reintentar
      </button>
    </div>
  );
}
