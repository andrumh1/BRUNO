import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { EyeOff, Eye, Heart, Loader2, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { JoinBrunoNudge } from "@/components/bruno/JoinBrunoNudge";
import { SMART_API, auth, errText } from "@/pages/events/eventsApi";

const social = {
  get: (eid, pid, tk) => axios.get(`${SMART_API}/events/${eid}/photos/${pid}/social`, auth(tk)).then((r) => r.data),
  react: (eid, pid, tk) => axios.post(`${SMART_API}/events/${eid}/photos/${pid}/react`, {}, auth(tk)).then((r) => r.data),
  comment: (eid, pid, tk, text) => axios.post(`${SMART_API}/events/${eid}/photos/${pid}/comments`, { text }, auth(tk)).then((r) => r.data),
  hide: (eid, pid, cid, tk, hidden) => axios.patch(`${SMART_API}/events/${eid}/photos/${pid}/comments/${cid}`, null, { ...auth(tk), params: { hidden } }).then((r) => r.data),
  remove: (eid, pid, cid, tk) => axios.delete(`${SMART_API}/events/${eid}/photos/${pid}/comments/${cid}`, auth(tk)).then((r) => r.data),
};

/** Foto a pantalla completa con reacción (corazón) y comentarios. Ver es libre; reaccionar/comentar pide sesión; el organizador oculta. */
export const PhotoDialog = ({ eventId, photo, onClose, benefits }) => {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [nudge, setNudge] = useState(false);
  const load = () => social.get(eventId, photo.id, token).then(setData).catch(() => setData({ likes: 0, liked: false, comments: [], viewer: {} }));
  useEffect(() => { load(); }, [photo.id, token]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const esc = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", esc); document.body.setAttribute("data-bruno-overlay", "photo"); return () => { window.removeEventListener("keydown", esc); document.body.removeAttribute("data-bruno-overlay"); }; }, [onClose]);
  const needLogin = () => { setNudge(true); return !user; };
  const like = async () => { if (needLogin()) return; try { const r = await social.react(eventId, photo.id, token); setData((d) => ({ ...d, ...r })); } catch (e) { brunoToast.error(errText(e, "No se pudo reaccionar")); } };
  const send = async () => { if (needLogin() || !text.trim()) return; setBusy(true); try { const c = await social.comment(eventId, photo.id, token, text); setData((d) => ({ ...d, comments: [...d.comments, c] })); setText(""); } catch (e) { brunoToast.error(errText(e, "No se pudo comentar")); } finally { setBusy(false); } };
  const hide = async (c) => { try { await social.hide(eventId, photo.id, c.id, token, !c.hidden); load(); } catch (e) { brunoToast.error(errText(e, "No se pudo moderar")); } };
  const del = async (c) => { try { await social.remove(eventId, photo.id, c.id, token); setData((d) => ({ ...d, comments: d.comments.filter((x) => x.id !== c.id) })); } catch (e) { brunoToast.error(errText(e, "No se pudo borrar")); } };
  const v = data?.viewer || {};
  return createPortal(
    <div className="fixed inset-0 z-[10002] bg-black/90 flex flex-col" role="dialog" aria-modal="true" data-testid="photo-dialog">
      <button type="button" onClick={onClose} className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-white/15 text-white flex items-center justify-center" style={{ marginTop: "var(--safe-top, 0px)" }} aria-label="Cerrar" data-testid="photo-dialog-close"><X className="w-5 h-5" /></button>
      <div className="flex-1 min-h-0 flex items-center justify-center p-3"><img src={photo.url} alt={photo.caption || ""} className="max-h-full max-w-full object-contain rounded-xl" /></div>
      <div className="bg-background rounded-t-3xl p-4 max-h-[48vh] flex flex-col gap-3" style={{ paddingBottom: "calc(var(--safe-bottom, 0px) + 16px)" }}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={like} className="inline-flex items-center gap-1.5 text-sm font-semibold" data-testid="photo-like-btn"><Heart className={`w-5 h-5 ${data?.liked ? "fill-red-500 text-red-500" : ""}`} /> <span data-testid="photo-like-count">{data?.likes ?? 0}</span></button>
          <p className="text-xs text-muted-foreground flex-1 truncate">Foto de {photo.uploader_name}{photo.caption ? ` · ${photo.caption}` : ""}</p>
        </div>
        {nudge && !user && <JoinBrunoNudge reason="Inicia sesión para reaccionar y comentar" benefits={benefits} />}
        <ul className="flex-1 min-h-0 overflow-y-auto space-y-2" data-testid="photo-comments">
          {!data ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : data.comments.length === 0 ? <li className="text-xs text-muted-foreground text-center py-2" data-testid="photo-comments-empty">Sé el primero en comentar</li> : data.comments.map((c) => (
            <li key={c.id} className={`text-sm flex items-start gap-2 ${c.hidden ? "opacity-50" : ""}`} data-testid={`comment-${c.id}`}>
              <div className="flex-1 min-w-0"><span className="font-semibold mr-1.5">{c.name}</span><span className="break-words">{c.text}</span>{c.hidden && <span className="ml-1 text-[10px] uppercase text-amber-700">oculto</span>}</div>
              {v.is_owner && <button type="button" onClick={() => hide(c)} className="p-1 text-muted-foreground" aria-label={c.hidden ? "Mostrar" : "Ocultar"} data-testid={`comment-hide-${c.id}`}>{c.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>}
              {c.user_id === v.id && <button type="button" onClick={() => del(c)} className="p-1 text-destructive" aria-label="Borrar" data-testid={`comment-delete-${c.id}`}><Trash2 className="w-4 h-4" /></button>}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={user ? "Escribe un comentario…" : "Inicia sesión para comentar"} onFocus={() => !user && setNudge(true)} maxLength={300} data-testid="photo-comment-input" />
          <Button onClick={send} disabled={busy || !text.trim()} className="rounded-full" aria-label="Enviar" data-testid="photo-comment-send"><Send className="w-4 h-4" /></Button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
