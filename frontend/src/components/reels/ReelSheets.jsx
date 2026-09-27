/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { X, Send, Loader2, Link2, MessageSquare, Share2, Clock, Play, Pause, User, Columns2, Scissors, Layers, Music2, Video, Check, Trash2, Flag, EyeOff, Pencil } from "lucide-react";
import TextStylePicker from "@/components/TextStylePicker";
import { useNavigate } from "react-router-dom";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { normalizeReel } from "./useReelsFeed";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export function BottomSheet({ open, onClose, title, children, testid, height = "62vh" }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[10400] bg-black/30 backdrop-blur-[4px]" onClick={onClose} data-testid={`${testid}-backdrop`}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", stiffness: 400, damping: 36 }}
            className="bruno-glass absolute inset-x-0 bottom-0 rounded-t-[28px] border flex flex-col overflow-hidden"
            style={{ height, paddingBottom: "env(safe-area-inset-bottom, 0px)", maxWidth: 560, marginInline: "auto" }}
            onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}
            data-testid={testid}
          >
            <div className="flex justify-center pt-2"><div className="h-1 w-9 rounded-full bg-foreground/20" /></div>
            <div className="flex items-center justify-between px-4 py-2">
              <span className="w-8" />
              <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-foreground/[0.06] grid place-items-center" data-testid={`${testid}-close`}><X className="w-4 h-4" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function ReelCommentsSheet({ reel, token, onClose, onPosted, onDeleted, currentUserId, highlightId = null }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  useEffect(() => {
    if (!reel) return;
    setLoading(true);
    axios.get(`${API}/posts/${reel.id}/comments`, { headers }).then((r) => setComments(r.data || [])).catch(() => setComments([])).finally(() => setLoading(false));
  }, [reel?.id]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const t = setTimeout(() => document.getElementById(`reel-comment-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 200);
    return () => clearTimeout(t);
  }, [highlightId, loading]);

  const send = async () => {
    if (!text.trim() || !token) return;
    setSending(true);
    try {
      const r = await axios.post(`${API}/posts/${reel.id}/comments`, { content: text.trim() }, { headers });
      setComments((p) => [{ ...r.data, user: r.data.user || { username: "Tú" } }, ...p]);
      setText(""); onPosted?.(reel.id);
    } catch (_) { brunoToast.error("No se pudo comentar"); }
    setSending(false);
  };

  return (
    <BottomSheet open={!!reel} onClose={onClose} title={`${comments.length} comentarios`} testid="reel-comments-sheet">
      <div className="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
        {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          : comments.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">Sé el primero en comentar</p>
          : comments.map((c) => (
            <div key={c.id} id={`reel-comment-${c.id}`} className={`flex gap-2.5 rounded-xl transition-colors ${highlightId === c.id ? "bg-primary/10 ring-2 ring-primary/40 p-2 -mx-1" : ""}`} data-testid={`reel-comment-${c.id}`}>
              <div className="w-8 h-8 rounded-full bg-foreground/10 overflow-hidden shrink-0 grid place-items-center">
                {c.user?.avatar_url ? <img src={c.user.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-foreground/60" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground/80">{c.user?.display_name || c.user?.username || "Usuario"}</p>
                <p className="text-sm leading-snug break-words">{c.content}</p>
              </div>
              {token && (c.user_id === currentUserId || (reel.author?.id || reel.user_id) === currentUserId) && (
                <button
                  onClick={async () => {
                    try {
                      const r = await axios.delete(`${API}/posts/${reel.id}/comments/${c.id}`, { headers });
                      setComments((prev) => prev.filter((x) => x.id !== c.id && x.parent_id !== c.id));
                      onDeleted?.(reel.id, r.data?.comments_count);
                      brunoToast.success("Comentario eliminado");
                    } catch (_) { brunoToast.error("No se pudo eliminar"); }
                  }}
                  className="self-start p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10" aria-label="Eliminar comentario" data-testid={`reel-comment-delete-${c.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
      </div>
      <div className="px-3 py-2 border-t border-foreground/10 flex items-center gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={token ? "Añade un comentario…" : "Inicia sesión para comentar"} disabled={!token}
          className="flex-1 h-10 rounded-full px-4 text-sm bg-foreground/[0.06] outline-none focus:ring-2 ring-primary/40" data-testid="reel-comment-input" />
        <button onClick={send} disabled={sending || !text.trim()} className="w-10 h-10 rounded-full bg-primary text-white grid place-items-center disabled:opacity-40" data-testid="reel-comment-send">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </BottomSheet>
  );
}

export function ReelLikersSheet({ reel, token, onClose, onFollow }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  useEffect(() => {
    if (!reel) return;
    setData(null);
    axios.get(`${API}/posts/${reel.id}/likes`, { headers }).then((r) => setData(r.data)).catch(() => setData({ total: 0, users: [] }));
  }, [reel?.id]);

  const follow = async (u) => {
    if (!token) return brunoToast.error("Inicia sesión para seguir");
    setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, is_following: !x.is_following } : x)) }));
    try { await axios.post(`${API}/users/${u.id}/follow`, {}, { headers }); onFollow?.(u.id, !u.is_following); }
    catch (_) { setData((d) => ({ ...d, users: d.users.map((x) => (x.id === u.id ? { ...x, is_following: u.is_following } : x)) })); }
  };

  return (
    <BottomSheet open={!!reel} onClose={onClose} title={data ? `${data.total} me gusta` : "Me gusta"} testid="reel-likers-sheet" height="60vh">
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        {!data ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          : data.users.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10" data-testid="reel-likers-empty">Sé el primero en dar me gusta</p>
          : data.users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 py-2" data-testid={`reel-liker-${u.id}`}>
              <button onClick={() => { onClose(); navigate(`/profile/${u.id}`); }} className="w-11 h-11 rounded-full overflow-hidden bg-muted shrink-0 grid place-items-center">
                {u.avatar_url ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
              </button>
              <button onClick={() => { onClose(); navigate(`/profile/${u.id}`); }} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold truncate">{u.display_name || u.username || "Usuario"}</p>
                {u.username && <p className="text-xs text-muted-foreground truncate">@{u.username}</p>}
              </button>
              {!u.is_me && (
                <button onClick={() => follow(u)} className={`h-8 px-3 rounded-full text-xs font-semibold ${u.is_following ? "bg-foreground/[0.08]" : "bg-primary text-white"}`} data-testid={`reel-liker-follow-${u.id}`}>
                  {u.is_following ? "Siguiendo" : "Seguir"}
                </button>
              )}
            </div>
          ))}
      </div>
    </BottomSheet>
  );
}

export function ReelOptionsSheet({ reel, token, currentUserId, onClose, onDeleted, onEdit }) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (!reel) return null;
  const isOwner = (reel.author?.id || reel.user_id) === currentUserId;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const del = async () => {
    setBusy(true);
    try { await axios.delete(`${API}/posts/${reel.id}`, { headers }); brunoToast.success("Publicación eliminada"); onDeleted?.(reel.id); onClose(); }
    catch (e) { brunoToast.error("No se pudo eliminar", { description: e?.response?.data?.detail }); }
    finally { setBusy(false); }
  };
  const report = () => { brunoToast.success("Gracias, revisaremos este contenido"); onClose(); };
  return (
    <BottomSheet open onClose={onClose} title="Opciones" testid="reel-options-sheet" height="auto">
      <div className="px-4 pb-6 pt-1 space-y-1.5">
        {isOwner ? (
          confirm ? (
            <div className="rounded-2xl bg-destructive/10 p-3" data-testid="reel-delete-confirm">
              <p className="text-sm font-medium mb-2">¿Eliminar esta publicación? Esta acción no se puede deshacer.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirm(false)} className="flex-1 h-10 rounded-full bg-foreground/[0.06] text-sm">Cancelar</button>
                <button onClick={del} disabled={busy} className="flex-1 h-10 rounded-full bg-destructive text-white text-sm font-semibold" data-testid="reel-delete-confirm-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Eliminar"}</button>
              </div>
            </div>
          ) : (
            <>
              <button onClick={() => { onClose(); onEdit?.(reel); }} className="w-full h-12 rounded-2xl bg-foreground/[0.05] flex items-center gap-3 px-4 text-sm" data-testid="reel-edit-btn"><Pencil className="w-4 h-4" /> Editar publicación</button>
              <button onClick={() => setConfirm(true)} className="w-full h-12 rounded-2xl bg-foreground/[0.05] flex items-center gap-3 px-4 text-sm text-destructive" data-testid="reel-delete-btn"><Trash2 className="w-4 h-4" /> Eliminar publicación</button>
            </>
          )
        ) : (
          <>
            <button onClick={report} className="w-full h-12 rounded-2xl bg-foreground/[0.05] flex items-center gap-3 px-4 text-sm" data-testid="reel-report-btn"><Flag className="w-4 h-4" /> Reportar</button>
            <button onClick={() => { brunoToast.success("Verás menos contenido como este"); onClose(); }} className="w-full h-12 rounded-2xl bg-foreground/[0.05] flex items-center gap-3 px-4 text-sm" data-testid="reel-not-interested-btn"><EyeOff className="w-4 h-4" /> No me interesa</button>
          </>
        )}
      </div>
    </BottomSheet>
  );
}

export function ReelShareSheet({ reel, token, onClose }) {
  const [chats, setChats] = useState(null);
  const [sentTo, setSentTo] = useState({});
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  useEffect(() => {
    if (!token) { setChats([]); return; }
    axios.get(`${API}/chats`, { headers }).then((r) => setChats((Array.isArray(r.data) ? r.data : []).filter((c) => c.other_participants?.length).slice(0, 20))).catch(() => setChats([]));
  }, [token]);
  if (!reel) return null;
  const url = `${process.env.REACT_APP_BACKEND_URL}/api/share/p/${reel.id}`;
  const appUrl = `${window.location.origin}/reels?id=${reel.id}`;
  const copy = async () => { try { await navigator.clipboard.writeText(appUrl); brunoToast.success("Link copiado"); } catch (_) { brunoToast.error("No se pudo copiar"); } onClose(); };
  const native = async () => {
    if (navigator.share) { try { await navigator.share({ title: "Reel en BRUNO", text: reel.content || "", url }); } catch (_) { /* cancelled */ } }
    else copy();
    onClose();
  };
  const sendToChat = async (chat) => {
    if (sentTo[chat.id]) return;
    setSentTo((s) => ({ ...s, [chat.id]: "sending" }));
    const who = reel.author?.username || reel.author?.name || "usuario";
    try {
      await axios.post(`${API}/chats/${chat.id}/messages`, {
        content: `🎬 Reel de @${who}: ${appUrl}`,
        message_type: "reel",
        attachments: [{ type: "reel", post_id: reel.id, url: appUrl, poster_url: reel.poster_url || reel.thumbnail_url || reel.image_url || null, caption: (reel.content || "").slice(0, 120), author_name: who, kind: reel.kind || (reel.video_url ? "video" : "post") }],
      }, { headers });
      setSentTo((s) => ({ ...s, [chat.id]: "sent" }));
      brunoToast.success(`Enviado a ${chat.other_participants[0]?.display_name || chat.other_participants[0]?.username}`);
    } catch (_) { setSentTo((s) => ({ ...s, [chat.id]: undefined })); brunoToast.error("No se pudo enviar"); }
  };
  const opts = [
    { id: "native", label: "Compartir…", Icon: Share2, run: native },
    { id: "copy", label: "Copiar link", Icon: Link2, run: copy },
    { id: "wa", label: "WhatsApp", Icon: MessageSquare, run: () => { window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, "_blank"); onClose(); } },
  ];
  return (
    <BottomSheet open onClose={onClose} title="Enviar a" testid="reel-share-sheet" height="auto">
      {token && (
        <div className="px-4 pt-1 pb-2" data-testid="reel-share-contacts">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Enviar por chat</p>
          {chats === null ? <div className="py-3 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            : chats.length === 0 ? <p className="text-xs text-muted-foreground py-2" data-testid="reel-share-no-chats">Aún no tienes chats. Escríbele a alguien desde su perfil.</p>
            : (
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
                {chats.map((c) => { const p = c.other_participants[0]; const st = sentTo[c.id]; return (
                  <button key={c.id} onClick={() => sendToChat(c)} disabled={!!st} className="flex flex-col items-center gap-1 shrink-0 w-16 active:scale-95 transition-transform" data-testid={`reel-share-chat-${c.id}`}>
                    <div className="relative w-12 h-12 rounded-full overflow-hidden bg-muted grid place-items-center">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-5 h-5 text-muted-foreground" />}
                      {st === "sent" && <span className="absolute inset-0 bg-primary/85 grid place-items-center text-white"><Check className="w-5 h-5" strokeWidth={3} /></span>}
                      {st === "sending" && <span className="absolute inset-0 bg-black/40 grid place-items-center"><Loader2 className="w-4 h-4 text-white animate-spin" /></span>}
                    </div>
                    <span className="text-[10px] truncate w-full text-center">{st === "sent" ? "Enviado" : (p.display_name || p.username)}</span>
                  </button>
                ); })}
              </div>
            )}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 px-5 pb-6 pt-2">
        {opts.map((o) => (
          <button key={o.id} onClick={o.run} className="flex flex-col items-center gap-2 rounded-2xl p-3 bg-foreground/[0.05] active:scale-95 transition-transform" data-testid={`reel-share-${o.id}`}>
            <div className="w-11 h-11 rounded-full bg-foreground/[0.08] grid place-items-center"><o.Icon className="w-5 h-5" /></div>
            <span className="text-[11px] font-medium">{o.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}

export function ReelHistorySheet({ open, token, onClose, onPick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const swipe = React.useRef({});
  const headers = { Authorization: `Bearer ${token}` };
  useEffect(() => {
    if (!open || !token) return;
    setLoading(true); setConfirmClear(false);
    axios.get(`${API}/posts/history/videos`, { headers })
      .then((r) => setItems((r.data || []).map(normalizeReel))).catch(() => setItems([])).finally(() => setLoading(false));
  }, [open, token]);
  const removeOne = async (id) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    try { await axios.delete(`${API}/posts/history/videos?post_id=${id}`, { headers }); } catch (_) { brunoToast.error("No se pudo quitar del historial"); }
  };
  const clearAll = async () => {
    try { await axios.delete(`${API}/posts/history/videos`, { headers }); setItems([]); setConfirmClear(false); brunoToast.success("Historial limpiado"); }
    catch (_) { brunoToast.error("No se pudo limpiar el historial"); }
  };
  const onTouchStart = (id) => (e) => { swipe.current[id] = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (id) => (e) => {
    const s = swipe.current[id]; if (!s) return;
    const dx = e.changedTouches[0].clientX - s.x, dy = e.changedTouches[0].clientY - s.y;
    delete swipe.current[id];
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) { e.preventDefault(); removeOne(id); }
  };
  return (
    <BottomSheet open={open} onClose={onClose} title="Historial de reels" testid="reel-history-sheet" height="72vh">
      {token && items.length > 0 && (
        <div className="px-4 pb-2 flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">Desliza un reel hacia el lado para quitarlo</p>
          {confirmClear ? (
            <div className="flex items-center gap-1.5">
              <button onClick={() => setConfirmClear(false)} className="h-8 px-3 rounded-full bg-foreground/[0.06] text-xs">Cancelar</button>
              <button onClick={clearAll} className="h-8 px-3 rounded-full bg-destructive text-white text-xs font-semibold" data-testid="reel-history-clear-confirm">Limpiar todo</button>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="h-8 px-3 rounded-full bg-foreground/[0.06] text-xs inline-flex items-center gap-1" data-testid="reel-history-clear-btn"><Trash2 className="w-3.5 h-3.5" /> Limpiar</button>
          )}
        </div>
      )}
      {!token ? <p className="text-center text-sm text-muted-foreground py-10">Inicia sesión para ver tu historial</p>
        : loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <div className="flex flex-col items-center py-12 text-muted-foreground" data-testid="reel-history-empty"><Clock className="w-8 h-8 mb-2" /><p className="text-sm">Aún no has visto reels</p></div>
        : (
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4 overflow-y-auto">
            {items.map((r) => (
              <div key={r.id} className="relative aspect-[9/14] rounded-xl overflow-hidden bg-black no-glass group" onTouchStart={onTouchStart(r.id)} onTouchEnd={onTouchEnd(r.id)} data-testid={`reel-history-item-${r.id}`}>
                <button onClick={() => onPick(r)} className="absolute inset-0 w-full h-full text-left">
                  {(r.poster_url || r.thumbnail_url || r.image_url) ? <img src={r.poster_url || r.thumbnail_url || r.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Play className="w-6 h-6 text-white/70" /></div>}
                  <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent">
                    <p className="text-white text-[10px] font-semibold truncate">@{r.author?.username || r.author?.name}</p>
                    <p className="text-white/70 text-[9px]">{r.watch_count > 1 ? `Visto ${r.watch_count}×` : "Visto"}</p>
                  </div>
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeOne(r.id); }} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white grid place-items-center" aria-label="Quitar del historial" data-testid={`reel-history-remove-${r.id}`}><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
    </BottomSheet>
  );
}

export function ReelEditSheet({ reel, token, onClose, onSaved }) {
  const [content, setContent] = useState(reel?.content || "");
  const [style, setStyle] = useState(reel?.text_style || { bg: "ember", font: "sans", align: "center", emoji: null });
  const [saving, setSaving] = useState(false);
  if (!reel) return null;
  const isText = reel.kind === "text";
  const save = async () => {
    setSaving(true);
    try {
      const r = await axios.put(`${API}/posts/${reel.id}`, { content, text_style: isText ? style : undefined }, { headers: { Authorization: `Bearer ${token}` } });
      onSaved?.(reel.id, { content: r.data?.content ?? content, text_style: r.data?.text_style ?? (isText ? style : reel.text_style) });
      brunoToast.success("Publicación actualizada"); onClose();
    } catch (e) { brunoToast.error("No se pudo guardar", { description: e?.response?.data?.detail }); }
    finally { setSaving(false); }
  };
  return (
    <BottomSheet open onClose={onClose} title="Editar publicación" testid="reel-edit-sheet" height="85vh">
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={2200} placeholder="Escribe algo…" className="w-full rounded-2xl bg-foreground/[0.05] p-3 text-sm outline-none resize-none" data-testid="reel-edit-content" />
        {isText && <TextStylePicker value={style} onChange={setStyle} text={content} />}
      </div>
      <div className="px-4 pb-5 pt-2 border-t border-border/40 flex gap-2">
        <button onClick={onClose} className="flex-1 h-11 rounded-full bg-foreground/[0.06] text-sm">Cancelar</button>
        <button onClick={save} disabled={saving || (!content.trim() && isText)} className="flex-1 h-11 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-50" data-testid="reel-edit-save">{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Guardar"}</button>
      </div>
    </BottomSheet>
  );
}

export function ReelRemixSheet({ reel, onClose, onPick }) {
  if (!reel) return null;
  const opts = [
    { id: "duet", label: "Dúo", hint: "Pantalla dividida: el original y tú, grabados juntos", Icon: Columns2 },
    { id: "stitch", label: "Stitch", hint: "Recorta hasta 5s del original y añade tu parte", Icon: Scissors },
  ];
  return (
    <BottomSheet open onClose={onClose} title="Remix" testid="reel-remix-sheet" height="auto">
      <div className="px-4 pb-5 space-y-2">
        {opts.map((o) => (
          <button key={o.id} onClick={() => onPick(o.id)} className="w-full flex items-center gap-3 rounded-2xl p-3 bg-foreground/[0.05] active:scale-[0.98] transition-transform text-left" data-testid={`reel-remix-${o.id}`}>
            <div className="w-11 h-11 rounded-xl bg-primary/15 text-primary grid place-items-center shrink-0"><o.Icon className="w-5 h-5" /></div>
            <div className="min-w-0"><p className="text-sm font-semibold">{o.label}</p><p className="text-[11px] text-muted-foreground">{o.hint}</p></div>
          </button>
        ))}
        {reel.remix_count > 0 && (
          <button onClick={() => onPick("list")} className="w-full flex items-center justify-center gap-2 h-10 rounded-full bg-foreground/[0.05] text-xs font-medium" data-testid="reel-remix-list-btn"><Layers className="w-4 h-4" /> Ver {reel.remix_count} remix{reel.remix_count === 1 ? "" : "es"} de este reel</button>
        )}
      </div>
    </BottomSheet>
  );
}

export function ReelRemixesSheet({ sourceId, token, onClose, onPick }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!sourceId) return;
    setLoading(true);
    axios.get(`${API}/posts/${sourceId}/remixes`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => setItems((r.data || []).map(normalizeReel))).catch(() => setItems([])).finally(() => setLoading(false));
  }, [sourceId]);
  return (
    <BottomSheet open={!!sourceId} onClose={onClose} title="Remixes" testid="reel-remixes-sheet" height="62vh">
      {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        : items.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">Aún no hay dúos ni stitches</p>
        : (
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4 overflow-y-auto">
            {items.map((r) => (
              <button key={r.id} onClick={() => onPick(r)} className="relative aspect-[9/14] rounded-xl overflow-hidden bg-black no-glass" data-testid={`reel-remix-item-${r.id}`}>
                {(r.poster_url || r.thumbnail_url) && <img src={r.poster_url || r.thumbnail_url} alt="" className="w-full h-full object-cover" />}
                <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 text-white text-[9px] px-1.5 py-0.5">{r.remix?.type === "duet" ? <Columns2 className="w-2.5 h-2.5" /> : <Scissors className="w-2.5 h-2.5" />}{r.remix?.type === "duet" ? "Dúo" : "Stitch"}</span>
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent text-left"><p className="text-white text-[10px] font-semibold truncate">@{r.author?.username || r.author?.name}</p></div>
              </button>
            ))}
          </div>
        )}
    </BottomSheet>
  );
}

export function ReelSoundSheet({ reel, token, onClose, onPick }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const audioRef = React.useRef(null);
  useEffect(() => () => { audioRef.current?.pause(); }, []);
  const togglePreview = () => {
    const url = data?.sound?.url;
    if (!url) return brunoToast.error("Este sonido no tiene audio para previsualizar");
    if (!audioRef.current) { audioRef.current = new Audio(url); audioRef.current.onended = () => setPlaying(false); audioRef.current.onerror = () => { setPlaying(false); brunoToast.error("No se pudo reproducir el sonido"); }; }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().then(() => setPlaying(true)).catch(() => brunoToast.error("No se pudo reproducir el sonido")); }
  };
  useEffect(() => {
    if (!reel) return;
    setLoading(true);
    axios.get(`${API}/posts/sound/${reel.sound_source_id || reel.id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => setData({ ...r.data, posts: (r.data.posts || []).map(normalizeReel) })).catch(() => setData(null)).finally(() => setLoading(false));
  }, [reel?.id]);
  if (!reel) return null;
  const sound = data?.sound;
  return (
    <BottomSheet open onClose={onClose} title="Sonido" testid="reel-sound-sheet" height="70vh">
      {loading ? <div className="grid place-items-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div> : (
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 pb-3 flex items-center gap-3">
            <button onClick={togglePreview} className={`w-16 h-16 rounded-2xl bg-zinc-900 grid place-items-center overflow-hidden reel-disc shrink-0 relative ${playing ? "" : "[animation-play-state:paused]"}`} data-testid="reel-sound-preview-btn" aria-label={playing ? "Pausar" : "Escuchar"}>
              {sound?.author?.avatar_url ? <img src={sound.author.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <Music2 className="w-6 h-6 text-white" />}
              <span className="absolute inset-0 grid place-items-center bg-black/35">{playing ? <Pause className="w-5 h-5 text-white fill-white" /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}</span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate" data-testid="reel-sound-name">{sound?.name || "Sonido original"}</p>
              <p className="text-xs text-muted-foreground truncate">@{sound?.author?.username || sound?.author?.name || "usuario"} · {sound?.uses || 0} {sound?.uses === 1 ? "video lo usa" : "videos lo usan"}</p>
            </div>
          </div>
          <div className="px-4 pb-3 flex gap-2">
            <button onClick={() => { onClose(); navigate(`/camera?sound=${sound?.source_post_id || reel.id}`); }} className="flex-1 h-12 rounded-full bg-primary text-white font-semibold text-sm inline-flex items-center justify-center gap-2 active:scale-[0.98]" data-testid="reel-use-sound-btn">
              <Video className="w-4 h-4" /> Usar este sonido
            </button>
            <button onClick={() => { onClose(); navigate(`/sound/${sound?.source_post_id || reel.id}`); }} className="h-12 px-4 rounded-full bg-foreground/[0.06] text-sm font-medium" data-testid="reel-sound-page-btn">Ver página</button>
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-3 pb-4">
            {(data?.posts || []).map((r) => (
              <button key={r.id} onClick={() => onPick(r)} className="relative aspect-[9/14] rounded-xl overflow-hidden bg-black no-glass" data-testid={`reel-sound-item-${r.id}`}>
                {(r.poster_url || r.thumbnail_url) ? <img src={r.poster_url || r.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center"><Play className="w-6 h-6 text-white/70" /></div>}
                {r.id === sound?.source_post_id && <span className="absolute top-1.5 left-1.5 rounded-full bg-primary text-white text-[9px] px-1.5 py-0.5">Original</span>}
                <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/70 to-transparent text-left"><p className="text-white text-[10px] font-semibold truncate">@{r.author?.username || r.author?.name}</p></div>
              </button>
            ))}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
