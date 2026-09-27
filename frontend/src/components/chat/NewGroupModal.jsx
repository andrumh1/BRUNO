import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, Check, Loader2, Search, Users, X } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Avatar = ({ user, size = 44 }) =>
  user?.avatar_url ? (
    <img src={user.avatar_url} alt={user.display_name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white font-bold" style={{ width: size, height: size }}>
      {(user?.display_name || user?.username || "?")[0].toUpperCase()}
    </div>
  );

/** NewGroupModal — pick several contacts, name + photo → POST /chats/group */
const NewGroupModal = ({ isOpen, onClose, token, onCreated }) => {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!isOpen) { setStep(1); setQuery(""); setResults([]); setSelected([]); setName(""); setAvatar(null); }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const q = query.trim() || "a";
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await axios.get(`${API}/users/search?q=${encodeURIComponent(q)}&limit=30`, { headers: { Authorization: `Bearer ${token}` } });
        setResults(r.data || []);
      } catch (_) { /* ignore */ } finally { setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, token, isOpen]);

  const toggle = (u) => setSelected((prev) => (prev.some((s) => s.id === u.id) ? prev.filter((s) => s.id !== u.id) : [...prev, u]));

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await axios.post(`${API}/upload/avatar`, fd, { headers: { Authorization: `Bearer ${token}` } });
      setAvatar(r.data?.url || r.data?.secure_url || r.data?.avatar_url);
    } catch (_) { brunoToast.error("No se pudo subir la foto"); } finally { setUploading(false); }
  };

  const create = async () => {
    if (!name.trim()) return brunoToast.error("Ponle un nombre al grupo");
    setCreating(true);
    try {
      const r = await axios.post(`${API}/chats/group`, { name: name.trim(), avatar_url: avatar, participant_ids: selected.map((s) => s.id) }, { headers: { Authorization: `Bearer ${token}` } });
      brunoToast.success("Grupo creado", { description: `${selected.length + 1} participantes · ya puedes iniciar una llamada grupal` });
      onCreated?.(r.data);
      onClose();
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo crear el grupo"); } finally { setCreating(false); }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="new-group-modal">
          <motion.div
            className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: "88vh" }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div>
                <h3 className="font-bold text-lg leading-tight">{step === 1 ? "Nuevo grupo" : "Detalles del grupo"}</h3>
                <p className="text-xs text-muted-foreground">{step === 1 ? `${selected.length} seleccionado${selected.length === 1 ? "" : "s"}` : `${selected.length + 1} participantes`}</p>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose} data-testid="new-group-close"><X className="w-5 h-5" /></Button>
            </div>

            {step === 1 ? (
              <>
                {selected.length > 0 && (
                  <div className="flex gap-2 px-5 pb-3 overflow-x-auto" data-testid="new-group-selected-strip">
                    {selected.map((u) => (
                      <button key={u.id} onClick={() => toggle(u)} className="relative shrink-0" data-testid={`new-group-selected-${u.id}`}>
                        <Avatar user={u} size={40} />
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background text-[10px] flex items-center justify-center">×</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative mx-5 mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar contactos..." className="pl-10 rounded-full" autoFocus data-testid="new-group-search-input" />
                </div>
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
                  {searching && results.length === 0 ? (
                    <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : results.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-6">Sin resultados</p>
                  ) : results.map((u) => {
                    const on = selected.some((s) => s.id === u.id);
                    return (
                      <button key={u.id} onClick={() => toggle(u)} className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-colors text-left ${on ? "bg-primary/10" : "hover:bg-muted"}`} data-testid={`new-group-user-${u.id}`}>
                        <Avatar user={u} />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{u.display_name || u.username}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${on ? "bg-primary border-primary text-white" : "border-muted-foreground/40"}`}>{on && <Check className="w-3.5 h-3.5" />}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="p-4 border-t">
                  <Button className="w-full rounded-full" disabled={selected.length < 1} onClick={() => setStep(2)} data-testid="new-group-next-btn">
                    Siguiente · {selected.length} contacto{selected.length === 1 ? "" : "s"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="px-5 pb-5 flex flex-col gap-5">
                <div className="flex flex-col items-center gap-3 pt-2">
                  <button onClick={() => fileRef.current?.click()} className="relative w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-4 ring-primary/15 active:scale-95 transition-transform" data-testid="new-group-photo-btn">
                    {avatar ? <img src={avatar} alt="grupo" className="w-full h-full object-cover" /> : <Users className="w-9 h-9 text-muted-foreground" />}
                    <span className="absolute bottom-0 inset-x-0 bg-primary text-white text-[10px] font-semibold py-1 flex items-center justify-center gap-1">
                      {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />} Foto
                    </span>
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del grupo" maxLength={60} className="text-center rounded-full h-11" autoFocus data-testid="new-group-name-input" />
                </div>
                <div className="flex -space-x-2 justify-center">
                  {selected.slice(0, 6).map((u) => <div key={u.id} className="ring-2 ring-card rounded-full"><Avatar user={u} size={34} /></div>)}
                  {selected.length > 6 && <div className="w-[34px] h-[34px] rounded-full bg-muted text-xs flex items-center justify-center ring-2 ring-card">+{selected.length - 6}</div>}
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep(1)} data-testid="new-group-back-btn">Atrás</Button>
                  <Button className="flex-1 rounded-full" onClick={create} disabled={creating || uploading || !name.trim()} data-testid="new-group-create-btn">
                    {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear grupo"}
                  </Button>
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

export default NewGroupModal;
