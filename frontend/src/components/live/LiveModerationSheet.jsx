import React, { useMemo, useState } from "react";
import axios from "axios";
import { Pin, PinOff, MicOff, Mic, UserX, Shield, ShieldOff, Loader2 } from "lucide-react";
import { BottomSheet } from "@/components/reels/ReelSheets";
import { Switch } from "@/components/ui/switch";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** Panel del anfitrión/moderador: fijar mensajes, silenciar, expulsar, moderadores, palabras bloqueadas. */
export default function LiveModerationSheet({ live, events, pinned, mutedIds, isHost, token, onClose, onLiveChange }) {
  const [busy, setBusy] = useState("");
  const [words, setWords] = useState((live?.blocked_words || []).join(", "));
  const headers = { Authorization: `Bearer ${token}` };
  const people = useMemo(() => {
    const m = new Map();
    [...events].reverse().forEach((e) => { if (e.user_id && e.user_id !== live?.host_id && !m.has(e.user_id)) m.set(e.user_id, { id: e.user_id, name: e.user_name, avatar: e.user_avatar, last: e.kind === "comment" ? e.text : null, commentId: e.kind === "comment" ? e.id : null }); });
    return [...m.values()].slice(0, 40);
  }, [events, live?.host_id]);
  const mods = live?.moderators || [];

  const act = async (action, extra = {}, okMsg) => {
    setBusy(action + (extra.user_id || extra.comment_id || ""));
    try { const r = await axios.post(`${API}/lives/${live.id}/moderation`, { action, ...extra }, { headers }); onLiveChange?.(r.data); if (okMsg) brunoToast.success(okMsg); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo aplicar"); }
    finally { setBusy(""); }
  };
  const saveWords = () => act("settings", { blocked_words: words.split(/[,\n]/).map((w) => w.trim()).filter(Boolean) }, "Filtro de palabras guardado");

  return (
    <BottomSheet open onClose={onClose} title="Moderación del live" testid="live-moderation-sheet" height="80vh">
      <div className="px-4 pb-8 space-y-5">
        {isHost && (
          <section className="space-y-3">
            <label className="flex items-center justify-between"><span className="text-sm font-medium">Permitir comentarios</span><Switch checked={live?.allow_comments !== false} onCheckedChange={(v) => act("settings", { allow_comments: v })} data-testid="live-allow-comments-toggle" /></label>
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Palabras bloqueadas (separadas por coma)</p>
              <div className="flex gap-2"><input value={words} onChange={(e) => setWords(e.target.value)} placeholder="spam, insulto…" className="flex-1 h-10 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid="live-blocked-words-input" /><button onClick={saveWords} className="h-10 px-3 rounded-xl bg-primary text-white text-xs font-semibold" data-testid="live-blocked-words-save">Guardar</button></div>
            </div>
          </section>
        )}
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Mensaje fijado</p>
          {pinned ? (
            <div className="flex items-start gap-2 rounded-2xl bg-primary/10 p-3" data-testid="live-pinned-current"><Pin className="w-4 h-4 text-primary mt-0.5" /><p className="flex-1 text-sm"><b>{pinned.user_name}</b>: {pinned.text}</p><button onClick={() => act("unpin", {}, "Mensaje desfijado")} className="text-xs text-primary font-semibold" data-testid="live-unpin-btn"><PinOff className="w-4 h-4" /></button></div>
          ) : <p className="text-xs text-muted-foreground">Toca el pin junto a un mensaje para fijarlo.</p>}
        </section>
        <section>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Participantes recientes</p>
          {people.length === 0 && <p className="text-xs text-muted-foreground">Aún nadie ha participado.</p>}
          <div className="space-y-1.5">
            {people.map((p) => {
              const muted = mutedIds.includes(p.id); const isMod = mods.includes(p.id);
              return (
                <div key={p.id} className="flex items-center gap-2 rounded-2xl bg-foreground/[0.04] px-3 py-2" data-testid={`live-mod-row-${p.id}`}>
                  <div className="w-8 h-8 rounded-full bg-foreground/10 overflow-hidden shrink-0">{p.avatar && <img src={p.avatar} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{p.name} {isMod && <span className="text-[10px] text-primary">· mod</span>}</p>{p.last && <p className="text-[11px] text-muted-foreground truncate">{p.last}</p>}</div>
                  {p.commentId && <button onClick={() => act("pin", { comment_id: p.commentId }, "Mensaje fijado")} className="p-2 rounded-full hover:bg-foreground/10" title="Fijar" data-testid={`live-pin-${p.id}`}>{busy === `pin${p.commentId}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pin className="w-4 h-4" />}</button>}
                  <button onClick={() => act(muted ? "unmute" : "mute", { user_id: p.id }, muted ? "Usuario reactivado" : "Usuario silenciado")} className={`p-2 rounded-full hover:bg-foreground/10 ${muted ? "text-amber-500" : ""}`} title={muted ? "Quitar silencio" : "Silenciar"} data-testid={`live-mute-${p.id}`}>{muted ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}</button>
                  {isHost && <button onClick={() => act(isMod ? "remove_mod" : "add_mod", { user_id: p.id }, isMod ? "Moderador retirado" : "Moderador asignado")} className={`p-2 rounded-full hover:bg-foreground/10 ${isMod ? "text-primary" : ""}`} title="Moderador" data-testid={`live-mod-toggle-${p.id}`}>{isMod ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}</button>}
                  <button onClick={() => { if (window.confirm(`¿Expulsar a ${p.name}? No podrá volver a entrar.`)) act("kick", { user_id: p.id }, "Usuario expulsado"); }} className="p-2 rounded-full hover:bg-destructive/10 text-destructive" title="Expulsar" data-testid={`live-kick-${p.id}`}><UserX className="w-4 h-4" /></button>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}
