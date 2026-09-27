import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Check, Crown, Loader2, LogOut, Pencil, Phone, Search, UserMinus, UserPlus, Users, Video, X } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Avatar = ({ user, size = 40 }) =>
  user?.avatar_url ? (
    <img src={user.avatar_url} alt={user.display_name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold shrink-0" style={{ width: size, height: size }}>
      {(user?.display_name || user?.username || "?")[0].toUpperCase()}
    </div>
  );

/** GroupInfoSheet — members, add people, rename/photo (admin), leave group, group calls */
const GroupInfoSheet = ({ chat, isOpen, onClose, token, currentUserId, onUpdated, onLeft, onCall }) => {
  const [info, setInfo] = useState(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const r = await axios.get(`${API}/chats/${chat.id}/info`, { headers });
      setInfo(r.data); setName(r.data.name || "");
    } catch (_) { /* ignore */ }
  };
  useEffect(() => { if (isOpen && chat?.id) { load(); setAdding(false); setPicked([]); setQuery(""); } }, [isOpen, chat?.id]); // eslint-disable-line

  useEffect(() => {
    if (!adding) return undefined;
    const t = setTimeout(async () => {
      try {
        const r = await axios.get(`${API}/users/search?q=${encodeURIComponent(query.trim() || "a")}&limit=30`, { headers });
        const ids = new Set((info?.participants || []));
        setResults((r.data || []).filter((u) => !ids.has(u.id)));
      } catch (_) { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [query, adding, info]); // eslint-disable-line

  const isAdmin = info?.admin_id === currentUserId;

  const saveName = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try { await axios.put(`${API}/chats/${chat.id}/group`, { name: name.trim() }, { headers }); setEditName(false); await load(); onUpdated?.({ name: name.trim() }); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo renombrar"); } finally { setBusy(false); }
  };
  const changePhoto = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const up = await axios.post(`${API}/upload/avatar`, fd, { headers });
      await axios.put(`${API}/chats/${chat.id}/group`, { avatar_url: up.data.url }, { headers });
      await load(); onUpdated?.({ avatar_url: up.data.url });
    } catch (_) { brunoToast.error("No se pudo cambiar la foto"); } finally { setBusy(false); }
  };
  const addMembers = async () => {
    if (!picked.length) return;
    setBusy(true);
    try {
      await axios.post(`${API}/chats/${chat.id}/members`, { user_ids: picked.map((p) => p.id) }, { headers });
      brunoToast.success(`${picked.length} miembro${picked.length > 1 ? "s" : ""} añadido${picked.length > 1 ? "s" : ""}`);
      setAdding(false); setPicked([]); await load(); onUpdated?.({});
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo añadir"); } finally { setBusy(false); }
  };
  const removeMember = async (uid) => {
    setBusy(true);
    try { await axios.delete(`${API}/chats/${chat.id}/members/${uid}`, { headers }); await load(); onUpdated?.({}); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo quitar"); } finally { setBusy(false); }
  };
  const leave = async () => {
    setBusy(true);
    try { await axios.delete(`${API}/chats/${chat.id}/members/${currentUserId}`, { headers }); brunoToast.success("Saliste del grupo"); onClose(); onLeft?.(chat.id); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo salir"); } finally { setBusy(false); }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="group-info-sheet">
          <motion.div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: "88vh" }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h3 className="font-bold">{adding ? "Añadir miembros" : "Info del grupo"}</h3>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={adding ? () => setAdding(false) : onClose} data-testid="group-info-close"><X className="w-5 h-5" /></Button>
            </div>

            {!info ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>
            ) : adding ? (
              <>
                <div className="relative mx-5 mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar contactos..." className="pl-10 rounded-full" autoFocus data-testid="group-add-search-input" />
                </div>
                <div className="flex-1 overflow-y-auto px-3 space-y-1">
                  {results.map((u) => {
                    const on = picked.some((p) => p.id === u.id);
                    return (
                      <button key={u.id} onClick={() => setPicked((prev) => (on ? prev.filter((p) => p.id !== u.id) : [...prev, u]))} className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${on ? "bg-primary/10" : "hover:bg-muted"}`} data-testid={`group-add-user-${u.id}`}>
                        <Avatar user={u} />
                        <div className="flex-1 min-w-0"><p className="font-medium text-sm truncate">{u.display_name || u.username}</p><p className="text-xs text-muted-foreground truncate">{u.email}</p></div>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? "bg-primary border-primary text-white" : "border-muted-foreground/40"}`}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      </button>
                    );
                  })}
                  {results.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Sin resultados</p>}
                </div>
                <div className="p-4 border-t">
                  <Button className="w-full rounded-full" disabled={!picked.length || busy} onClick={addMembers} data-testid="group-add-confirm-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : `Añadir ${picked.length || ""}`}</Button>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col items-center gap-3 px-5 pb-4">
                  <button disabled={!isAdmin || busy} onClick={() => fileRef.current?.click()} className="relative w-24 h-24 rounded-full bg-muted overflow-hidden flex items-center justify-center ring-4 ring-primary/15" data-testid="group-photo-btn">
                    {info.avatar_url ? <img src={info.avatar_url} alt={info.name} className="w-full h-full object-cover" /> : <Users className="w-10 h-10 text-muted-foreground" />}
                    {isAdmin && <span className="absolute bottom-0 inset-x-0 bg-primary/90 text-white text-[10px] py-1 flex items-center justify-center gap-1"><Camera className="w-3 h-3" /> Cambiar</span>}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={changePhoto} />
                  {editName ? (
                    <div className="flex gap-2 w-full">
                      <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-full h-10" maxLength={60} autoFocus data-testid="group-name-input" />
                      <Button size="icon" className="rounded-full shrink-0" onClick={saveName} disabled={busy} data-testid="group-name-save"><Check className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <button className="flex items-center gap-2 group" disabled={!isAdmin} onClick={() => setEditName(true)} data-testid="group-name-title">
                      <h2 className="text-xl font-bold">{info.name}</h2>
                      {isAdmin && <Pencil className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary" />}
                    </button>
                  )}
                  <p className="text-xs text-muted-foreground -mt-2">{info.members?.length} participantes</p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="rounded-full" onClick={() => { onClose(); onCall?.("audio"); }} data-testid="group-call-audio-btn"><Phone className="w-4 h-4 mr-2" /> Llamada</Button>
                    <Button className="rounded-full" onClick={() => { onClose(); onCall?.("video"); }} data-testid="group-call-video-btn"><Video className="w-4 h-4 mr-2" /> Videollamada</Button>
                  </div>
                </div>

                <div className="px-3 pb-2">
                  <button onClick={() => setAdding(true)} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-muted text-primary font-medium text-sm" data-testid="group-add-members-btn">
                    <span className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><UserPlus className="w-5 h-5" /></span> Añadir miembros
                  </button>
                  {info.members?.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl" data-testid={`group-member-${m.id}`}>
                      <Avatar user={m} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate flex items-center gap-1.5">{m.id === currentUserId ? "Tú" : (m.display_name || m.username)}{m.is_admin && <Crown className="w-3.5 h-3.5 text-amber-500" />}</p>
                        {m.is_admin && <p className="text-[11px] text-muted-foreground">Administrador</p>}
                      </div>
                      {isAdmin && m.id !== currentUserId && (
                        <Button variant="ghost" size="icon" className="rounded-full text-muted-foreground hover:text-red-500" disabled={busy} onClick={() => removeMember(m.id)} data-testid={`group-remove-${m.id}`}><UserMinus className="w-4 h-4" /></Button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 border-t">
                  <Button variant="ghost" className="w-full rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10" disabled={busy} onClick={leave} data-testid="group-leave-btn"><LogOut className="w-4 h-4 mr-2" /> Salir del grupo</Button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default GroupInfoSheet;
