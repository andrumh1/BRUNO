import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Check, Loader2, Lock, Plus, Users, X } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** PollMessage — live poll inside a chat bubble (tap to vote, results with bars, who voted) */
export const PollMessage = ({ pollId, isOwn, token, currentUserId, isAdmin }) => {
  const [poll, setPoll] = useState(null);
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    axios.get(`${API}/polls/${pollId}`, { headers }).then((r) => setPoll(r.data)).catch(() => {});
    const onUpdate = (e) => {
      const p = e.detail;
      if (p?.id !== pollId) return;
      setPoll((prev) => ({ ...(prev || {}), ...p, my_votes: (p.votes || {})[currentUserId] || [] }));
    };
    window.addEventListener("bruno:poll", onUpdate);
    return () => window.removeEventListener("bruno:poll", onUpdate);
  }, [pollId]); // eslint-disable-line

  if (!poll) return <div className="w-56 h-20 rounded-xl bg-black/5 animate-pulse" />;

  const vote = async (oid) => {
    if (poll.closed || busy) return;
    let next = poll.multiple ? (poll.my_votes.includes(oid) ? poll.my_votes.filter((x) => x !== oid) : [...poll.my_votes, oid]) : (poll.my_votes[0] === oid ? [] : [oid]);
    setBusy(true);
    try { const r = await axios.post(`${API}/polls/${poll.id}/vote`, { option_ids: next }, { headers }); setPoll(r.data); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo votar"); } finally { setBusy(false); }
  };
  const close = async () => {
    try { const r = await axios.post(`${API}/polls/${poll.id}/close`, {}, { headers }); setPoll(r.data); } catch { /* ignore */ }
  };
  const canClose = !poll.closed && (poll.created_by === currentUserId || isAdmin);
  const bar = isOwn ? "bg-white/30" : "bg-primary/20";

  return (
    <div className="w-[240px] sm:w-[280px]" data-testid={`poll-${poll.id}`} data-no-dbltap>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70 flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Encuesta{poll.multiple ? " · varias opciones" : ""}{poll.closed ? " · cerrada" : ""}</p>
      <p className="font-semibold text-sm leading-snug mt-0.5" data-testid="poll-question">{poll.question}</p>
      <div className="mt-2 space-y-1.5">
        {poll.options.map((o) => {
          const mine = poll.my_votes.includes(o.id);
          return (
            <button key={o.id} type="button" onClick={() => vote(o.id)} disabled={poll.closed || busy}
              className={`relative w-full text-left rounded-xl overflow-hidden px-2.5 py-2 text-xs transition-transform active:scale-[0.98] ${isOwn ? "bg-white/10" : "bg-background/70"} ${mine ? (isOwn ? "ring-1 ring-white/70" : "ring-1 ring-primary") : ""}`}
              data-testid={`poll-option-${o.id}`}>
              <motion.span className={`absolute inset-y-0 left-0 ${bar}`} initial={{ width: 0 }} animate={{ width: `${o.pct}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
              <span className="relative flex items-center gap-2">
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${mine ? (isOwn ? "bg-white text-primary border-white" : "bg-primary text-white border-primary") : "border-current opacity-50"}`}>{mine && <Check className="w-3 h-3" />}</span>
                <span className="flex-1 truncate">{o.text}</span>
                <span className="font-semibold tabular-nums" data-testid={`poll-pct-${o.id}`}>{o.pct}%</span>
              </span>
              {!poll.anonymous && o.voters?.length > 0 && <span className="relative block pl-6 text-[10px] opacity-70 truncate">{o.voters.map((v) => (v.id === currentUserId ? "Tú" : v.name)).join(", ")}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] opacity-75">
        <span className="flex items-center gap-1" data-testid="poll-total"><Users className="w-3 h-3" /> {poll.total_voters} voto{poll.total_voters === 1 ? "" : "s"}{poll.anonymous ? " · anónima" : ""}</span>
        {canClose && <button type="button" onClick={close} className="underline flex items-center gap-1" data-testid="poll-close-btn"><Lock className="w-3 h-3" /> Cerrar</button>}
      </div>
    </div>
  );
};

/** CreatePollSheet — question + 2..10 options, single/multiple, anonymous */
export const CreatePollSheet = ({ chatId, token, isOpen, onClose, onCreated }) => {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!isOpen) { setQ(""); setOpts(["", ""]); setMultiple(false); setAnonymous(false); } }, [isOpen]);
  const valid = q.trim() && opts.filter((o) => o.trim()).length >= 2;

  const create = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const r = await axios.post(`${API}/chats/${chatId}/polls`, { question: q.trim(), options: opts.filter((o) => o.trim()), multiple, anonymous }, { headers: { Authorization: `Bearer ${token}` } });
      onCreated?.(r.data); onClose(); brunoToast.success("Encuesta publicada");
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo crear la encuesta"); } finally { setBusy(false); }
  };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} data-testid="create-poll-sheet">
          <motion.div className="w-full sm:max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 flex flex-col gap-3" style={{ maxHeight: "88vh", overflowY: "auto" }}
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }} transition={{ type: "spring", damping: 26, stiffness: 300 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Nueva encuesta</h3><button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted" data-testid="create-poll-close"><X className="w-5 h-5" /></button></div>
            <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={200} placeholder="Pregunta" className="h-11 rounded-xl bg-muted/60 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" autoFocus data-testid="poll-question-input" />
            <div className="space-y-2">
              {opts.map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} maxLength={80} placeholder={`Opción ${i + 1}`} className="flex-1 h-10 rounded-xl bg-muted/60 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/40" data-testid={`poll-option-input-${i}`} />
                  {opts.length > 2 && <button onClick={() => setOpts((p) => p.filter((_, j) => j !== i))} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" aria-label="Quitar opción"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              {opts.length < 10 && <button onClick={() => setOpts((p) => [...p, ""])} className="text-xs text-primary font-medium flex items-center gap-1" data-testid="poll-add-option"><Plus className="w-3.5 h-3.5" /> Añadir opción</button>}
            </div>
            <label className="flex items-center justify-between text-sm"><span>Permitir varias respuestas</span><input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} className="accent-primary w-4 h-4" data-testid="poll-multiple-toggle" /></label>
            <label className="flex items-center justify-between text-sm"><span>Votación anónima</span><input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="accent-primary w-4 h-4" data-testid="poll-anonymous-toggle" /></label>
            <button onClick={create} disabled={!valid || busy} className="h-11 rounded-full bg-primary text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2" data-testid="poll-create-btn">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publicar encuesta"}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
