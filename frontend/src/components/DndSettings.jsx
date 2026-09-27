import React, { useEffect, useState } from "react";
import axios from "axios";
import { MoonStar } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Profile → settings: Do-Not-Disturb toggle + time window. Silences calls and pushes server-side.
export default function DndSettings({ token }) {
  const [dnd, setDnd] = useState({ enabled: false, start: "22:00", end: "07:00" });
  const [saving, setSaving] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/auth/me/dnd`, { headers }).then((r) => setDnd(r.data)).catch(() => {});
  }, [token]);

  const save = async (next) => {
    setDnd(next); setSaving(true);
    try {
      const r = await axios.put(`${API}/auth/me/dnd`, { ...next, tz_offset_min: -new Date().getTimezoneOffset() }, { headers });
      setDnd(r.data);
      if (next.enabled !== dnd.enabled) brunoToast.success(next.enabled ? "No molestar activado" : "No molestar desactivado", { description: next.enabled ? `Silencio de ${next.start} a ${next.end}` : undefined });
    } catch (_) { brunoToast.error("No se pudo guardar"); }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-lg" data-testid="dnd-settings">
      <button onClick={() => save({ ...dnd, enabled: !dnd.enabled })} disabled={saving} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors" data-testid="dnd-toggle">
        <MoonStar className={`w-5 h-5 ${dnd.enabled ? "text-indigo-500" : "text-muted-foreground"}`} />
        <span className="flex-1 text-left">No molestar</span>
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${dnd.enabled ? "bg-indigo-500" : "bg-muted-foreground/30"}`} aria-checked={dnd.enabled} role="switch">
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${dnd.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
      </button>
      {dnd.enabled && (
        <div className="px-3 pb-3 -mt-1 flex items-center gap-2 text-sm" data-testid="dnd-window">
          <span className="text-xs text-muted-foreground">De</span>
          <input type="time" value={dnd.start} onChange={(e) => save({ ...dnd, start: e.target.value })} className="h-9 rounded-lg bg-muted px-2 text-sm" data-testid="dnd-start" />
          <span className="text-xs text-muted-foreground">a</span>
          <input type="time" value={dnd.end} onChange={(e) => save({ ...dnd, end: e.target.value })} className="h-9 rounded-lg bg-muted px-2 text-sm" data-testid="dnd-end" />
          {dnd.active && <span className="ml-auto text-[10px] font-semibold text-indigo-500" data-testid="dnd-active-badge">Activo ahora</span>}
        </div>
      )}
      <p className="px-3 pb-2 -mt-1 text-[11px] text-muted-foreground">En ese horario no suena el timbre ni llegan notificaciones; las llamadas quedan como perdidas.</p>
    </div>
  );
}
