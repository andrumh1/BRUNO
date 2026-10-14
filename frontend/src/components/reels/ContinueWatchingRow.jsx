/* "Continuar viendo": videos (cortos o largos) dejados a medias. variant "reels" = franja flotante ocultable sobre el feed; "profile" = fila en el perfil. */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Play, X, History } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DISMISS_KEY = "bruno_cw_dismissed_at";
const DISMISS_MS = 6 * 60 * 60 * 1000;

const fmt = (s) => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}`; };

export function useContinueWatching(token) {
  const [items, setItems] = useState(null);
  const headers = { Authorization: `Bearer ${token}` };
  const load = () => { if (!token) { setItems([]); return; } axios.get(`${API}/posts/continue-watching`, { headers }).then((r) => setItems(r.data || [])).catch(() => setItems([])); };
  useEffect(load, [token]); // eslint-disable-line
  const remove = async (id) => { setItems((l) => (l || []).filter((x) => x.id !== id)); try { await axios.delete(`${API}/posts/${id}/progress`, { headers }); } catch { /* ignore */ } };
  return { items, remove, reload: load };
}

const Thumb = ({ item, onOpen, onRemove, dark }) => (
  <div className="relative shrink-0 w-24" data-testid={`cw-item-${item.id}`}>
    <button type="button" onClick={onOpen} className="block w-24 aspect-[9/14] rounded-xl overflow-hidden bg-black relative text-left" data-testid={`cw-open-${item.id}`}>
      {item.thumbnail_url ? <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <video src={item.video_url} muted playsInline preload="metadata" className="w-full h-full object-cover" />}
      <span className="absolute inset-0 grid place-items-center"><span className="w-8 h-8 rounded-full bg-white/85 grid place-items-center"><Play className="w-4 h-4 text-black fill-black ml-0.5" /></span></span>
      <span className="absolute left-1.5 bottom-2.5 text-[10px] font-semibold text-white drop-shadow">{fmt(item.resume_position)}{item.resume_duration ? ` / ${fmt(item.resume_duration)}` : ""}</span>
      <span className="absolute left-0 right-0 bottom-0 h-1 bg-white/25"><span className="block h-full bg-primary" style={{ width: `${item.resume_pct || 0}%` }} data-testid={`cw-progress-${item.id}`} /></span>
    </button>
    <button type="button" onClick={onRemove} className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full grid place-items-center shadow ${dark ? "bg-black/70 text-white" : "bg-background text-foreground border"}`} aria-label="Quitar" data-testid={`cw-remove-${item.id}`}><X className="w-3 h-3" /></button>
    {item.user?.name && <p className={`mt-1 text-[10px] truncate ${dark ? "text-white/80" : "text-muted-foreground"}`}>@{item.user.username || item.user.name}</p>}
  </div>
);

export default function ContinueWatchingRow({ token, variant = "profile", visible = true }) {
  const navigate = useNavigate();
  const { items, remove } = useContinueWatching(token);
  const [dismissed, setDismissed] = useState(() => { try { return Date.now() - Number(localStorage.getItem(DISMISS_KEY) || 0) < DISMISS_MS; } catch { return false; } });
  if (!items || items.length === 0) return null;
  const open = (item) => navigate(`/reels?id=${item.id}`);
  const dark = variant === "reels";

  if (variant === "reels") {
    if (!visible || dismissed) return null;
    return (
      <div className="absolute inset-x-0 z-20" style={{ top: "calc(var(--safe-top, 0px) + 150px)" }} data-testid="continue-watching-reels">
        <div className="mx-3 rounded-2xl bg-black/55 backdrop-blur-md p-3 border border-white/10" onTouchStart={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-white flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Continuar viendo</p>
            <button type="button" onClick={() => { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ } setDismissed(true); }} className="w-7 h-7 rounded-full grid place-items-center text-white/80 hover:bg-white/10" aria-label="Ocultar" data-testid="cw-dismiss"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">{items.map((it) => <Thumb key={it.id} item={it} dark onOpen={() => open(it)} onRemove={() => remove(it.id)} />)}</div>
        </div>
      </div>
    );
  }
  return (
    <section className="mb-5" data-testid="continue-watching-profile">
      <p className="text-sm font-semibold flex items-center gap-1.5 mb-2"><History className="w-4 h-4 text-primary" /> Continuar viendo</p>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">{items.map((it) => <Thumb key={it.id} item={it} dark={dark} onOpen={() => open(it)} onRemove={() => remove(it.id)} />)}</div>
    </section>
  );
}
