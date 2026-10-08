import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BarChart3, MessageCircleQuestion, Users, Check, X, Hand, ThumbsUp, Loader2, UserMinus } from "lucide-react";
import { BottomSheet } from "@/components/reels/ReelSheets";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** Tarjeta de encuesta superpuesta (se ve igual para anfitrión y espectadores; resultados sincronizados por WS). */
export function LivePollCard({ poll, liveId, token, canModerate, onClose }) {
  const [myVote, setMyVote] = useState(poll?.my_vote || null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setMyVote(poll?.my_vote ?? null); }, [poll?.id]);
  if (!poll?.id) return null;
  const open = poll.status === "open";
  const vote = async (oid) => {
    if (!open || busy) return; setBusy(true);
    try { await axios.post(`${API}/lives/${liveId}/polls/${poll.id}/vote`, { option_id: oid }, { headers: { Authorization: `Bearer ${token}` } }); setMyVote(oid); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo votar"); } finally { setBusy(false); }
  };
  const close = () => axios.post(`${API}/lives/${liveId}/polls/${poll.id}/close`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  return (
    <div className="absolute left-3 right-16 z-30 rounded-2xl bg-black/65 backdrop-blur-md text-white p-3" style={{ top: "calc(var(--safe-top) + 140px)" }} data-testid="live-poll-card">
      <div className="flex items-start gap-2 mb-2"><BarChart3 className="w-4 h-4 text-primary mt-0.5 shrink-0" /><p className="flex-1 text-sm font-semibold leading-tight">{poll.question}</p>
        {canModerate && open && <button onClick={close} className="text-[10px] px-2 h-6 rounded-full bg-white/15" data-testid="live-poll-close">Cerrar</button>}
        {!open && <span className="text-[10px] px-2 h-6 rounded-full bg-white/15 inline-flex items-center">Cerrada</span>}
        {onClose && !open && <button onClick={onClose} className="p-1" aria-label="Ocultar"><X className="w-3.5 h-3.5" /></button>}
      </div>
      <div className="space-y-1.5">
        {poll.options.map((o) => (
          <button key={o.id} onClick={() => vote(o.id)} disabled={!open} className="relative w-full h-9 rounded-xl overflow-hidden bg-white/10 text-left disabled:cursor-default" data-testid={`live-poll-option-${o.id}`} aria-pressed={myVote === o.id}>
            <span className="absolute inset-y-0 left-0 bg-primary/70 transition-[width] duration-500" style={{ width: `${o.pct}%` }} />
            <span className="relative flex items-center justify-between px-3 text-xs font-medium"><span className="truncate">{myVote === o.id && <Check className="inline w-3 h-3 mr-1" />}{o.text}</span><span>{o.pct}%</span></span>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-white/70 mt-1.5">{poll.total} {poll.total === 1 ? "voto" : "votos"}</p>
    </div>
  );
}

/** Panel de interacción: Encuesta · Preguntas · Invitados. Mismo componente para anfitrión/moderador y espectador. */
export default function LiveInteractSheet({ live, token, rtc, canModerate, isHost, userId, onClose, initialTab = "poll" }) {
  const [tab, setTab] = useState(initialTab);
  const [q, setQ] = useState(""); const [opts, setOpts] = useState(["", ""]); const [question, setQuestion] = useState(""); const [busy, setBusy] = useState("");
  const headers = { Authorization: `Bearer ${token}` };
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current) return; loaded.current = true;
    axios.get(`${API}/lives/${live.id}/questions`).then((r) => rtc.setQuestions(r.data)).catch(() => {});
    axios.get(`${API}/lives/${live.id}/polls/current`, { headers }).then((r) => { if (r.data?.id) rtc.setPoll(r.data); }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const post = async (path, body, ok) => { setBusy(path); try { const r = await axios.post(`${API}/lives/${live.id}/${path}`, body || {}, { headers }); if (ok) brunoToast.success(ok); return r.data; } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo completar"); } finally { setBusy(""); } };

  const TabBtn = ({ id, Icon, label, badge }) => <button onClick={() => setTab(id)} className={`flex-1 h-9 rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${tab === id ? "bg-primary text-white" : "bg-foreground/[0.06]"}`} data-testid={`live-tab-${id}`}><Icon className="w-3.5 h-3.5" />{label}{badge > 0 && <span className="ml-1 min-w-4 h-4 px-1 rounded-full bg-white text-primary text-[10px] grid place-items-center">{badge}</span>}</button>;

  return (
    <BottomSheet open onClose={onClose} title="Interacción en vivo" testid="live-interact-sheet" height="78vh">
      <div className="px-4 pb-8 space-y-4">
        <div className="flex gap-1.5"><TabBtn id="poll" Icon={BarChart3} label="Encuesta" /><TabBtn id="qa" Icon={MessageCircleQuestion} label="Preguntas" badge={rtc.questions.filter((x) => !x.answered).length} /><TabBtn id="guests" Icon={Users} label="Invitados" badge={isHost ? rtc.guestRequests.length : 0} /></div>

        {tab === "poll" && (
          <div className="space-y-3">
            {rtc.poll?.id ? <div className="rounded-2xl bg-foreground/[0.04] p-3 text-sm"><p className="font-semibold">{rtc.poll.question}</p>{rtc.poll.options.map((o) => <div key={o.id} className="flex justify-between text-xs mt-1"><span>{o.text}</span><span>{o.pct}% · {o.votes}</span></div>)}<p className="text-[11px] text-muted-foreground mt-1">{rtc.poll.status === "open" ? "Abierta · vota en la tarjeta sobre el video" : "Cerrada"}</p></div> : <p className="text-xs text-muted-foreground">No hay encuesta activa.</p>}
            {canModerate && (
              <div className="rounded-2xl border border-border p-3 space-y-2" data-testid="live-poll-form">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pregunta" className="w-full h-10 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid="live-poll-question" />
                {opts.map((o, i) => <input key={i} value={o} onChange={(e) => setOpts((p) => p.map((x, j) => (j === i ? e.target.value : x)))} placeholder={`Opción ${i + 1}`} className="w-full h-9 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid={`live-poll-opt-${i}`} />)}
                <div className="flex gap-2">{opts.length < 4 && <button onClick={() => setOpts((p) => [...p, ""])} className="h-9 px-3 rounded-full bg-foreground/[0.06] text-xs">+ opción</button>}
                  <button onClick={async () => { const d = await post("polls", { question: q, options: opts, duration_s: 120 }, "Encuesta publicada"); if (d) { setQ(""); setOpts(["", ""]); } }} disabled={!!busy} className="flex-1 h-9 rounded-full bg-primary text-white text-xs font-semibold" data-testid="live-poll-create">{busy === "polls" ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Lanzar encuesta (2 min)"}</button></div>
              </div>
            )}
          </div>
        )}

        {tab === "qa" && (
          <div className="space-y-3">
            {!isHost && <div className="flex gap-2"><input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Haz una pregunta al anfitrión" className="flex-1 h-10 rounded-xl bg-foreground/[0.06] px-3 text-sm outline-none" data-testid="live-question-input" /><button onClick={async () => { if (question.trim() && await post("questions", { text: question }, "Pregunta enviada")) setQuestion(""); }} className="h-10 px-3 rounded-xl bg-primary text-white text-xs font-semibold" data-testid="live-question-send">Enviar</button></div>}
            {rtc.questions.length === 0 && <p className="text-xs text-muted-foreground">Aún no hay preguntas.</p>}
            {rtc.questions.map((x) => (
              <div key={x.id} className={`flex items-start gap-2 rounded-2xl p-3 ${x.answered ? "bg-emerald-500/10" : "bg-foreground/[0.04]"}`} data-testid={`live-question-${x.id}`}>
                <div className="flex-1 min-w-0"><p className="text-sm">{x.text}</p><p className="text-[11px] text-muted-foreground">{x.user_name}{x.answered ? " · respondida" : ""}</p></div>
                <button onClick={() => post(`questions/${x.id}/upvote`)} className="inline-flex items-center gap-1 text-xs px-2 h-8 rounded-full bg-foreground/[0.06]" data-testid={`live-question-upvote-${x.id}`}><ThumbsUp className="w-3.5 h-3.5" />{x.upvotes}</button>
                {canModerate && <button onClick={() => post(`questions/${x.id}/answer`)} className={`w-8 h-8 rounded-full grid place-items-center ${x.answered ? "bg-emerald-500 text-white" : "bg-foreground/[0.06]"}`} title="Marcar respondida" data-testid={`live-question-answer-${x.id}`}><Check className="w-4 h-4" /></button>}
              </div>
            ))}
          </div>
        )}

        {tab === "guests" && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">Los invitados aparecen con su cámara y micrófono junto al anfitrión (máx. 3). Audio y video van por Daily.co.</p>
            {!isHost && (
              rtc.guestStatus === "accepted" ? <button onClick={async () => { await post("guest/cancel", {}, "Saliste como invitado"); rtc.setGuestStatus("none"); rtc.setGuestRtc(null); }} className="w-full h-11 rounded-full bg-destructive text-white text-sm font-semibold" data-testid="live-guest-leave">Salir como invitado</button>
              : rtc.guestStatus === "pending" ? <button onClick={async () => { await post("guest/cancel"); rtc.setGuestStatus("none"); }} className="w-full h-11 rounded-full bg-foreground/[0.06] text-sm" data-testid="live-guest-cancel"><Loader2 className="inline w-4 h-4 animate-spin mr-1" /> Esperando al anfitrión… (cancelar)</button>
              : <button onClick={async () => { if (await post("guest/request", {}, "Solicitud enviada")) rtc.setGuestStatus("pending"); }} className="w-full h-11 rounded-full bg-primary text-white text-sm font-semibold inline-flex items-center justify-center gap-2" data-testid="live-guest-request"><Hand className="w-4 h-4" /> Pedir unirme al live</button>
            )}
            {isHost && <>
              <p className="text-xs font-semibold">Solicitudes ({rtc.guestRequests.length})</p>
              {rtc.guestRequests.map((g) => <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-foreground/[0.04] px-3 py-2" data-testid={`live-guest-req-${g.id}`}><div className="w-8 h-8 rounded-full bg-foreground/10 overflow-hidden">{g.avatar && <img src={g.avatar} alt="" className="w-full h-full object-cover" />}</div><span className="flex-1 text-sm font-medium truncate">{g.name}</span><button onClick={() => post("guest/accept", { user_id: g.id }, `${g.name} se unió`)} className="h-8 px-3 rounded-full bg-primary text-white text-xs font-semibold" data-testid={`live-guest-accept-${g.id}`}>Aceptar</button><button onClick={() => post("guest/reject", { user_id: g.id })} className="w-8 h-8 rounded-full bg-foreground/[0.06] grid place-items-center" data-testid={`live-guest-reject-${g.id}`}><X className="w-4 h-4" /></button></div>)}
            </>}
            <p className="text-xs font-semibold">En el live ({rtc.guests.length})</p>
            {rtc.guests.map((g) => <div key={g.id} className="flex items-center gap-2 rounded-2xl bg-foreground/[0.04] px-3 py-2" data-testid={`live-guest-${g.id}`}><span className="flex-1 text-sm">{g.name}</span>{canModerate && g.id !== userId && <button onClick={() => post("guest/remove", { user_id: g.id }, "Invitado retirado")} className="w-8 h-8 rounded-full bg-foreground/[0.06] grid place-items-center text-destructive" data-testid={`live-guest-remove-${g.id}`}><UserMinus className="w-4 h-4" /></button>}</div>)}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}

/** Mosaico de invitados (videos pequeños) sobre el escenario. */
export function GuestTiles({ participants }) {
  if (!participants?.length) return null;
  return (
    <div className="absolute right-3 z-20 flex flex-col gap-2" style={{ top: "calc(var(--safe-top) + 150px)" }} data-testid="live-guest-tiles">
      {participants.slice(0, 3).map((p) => <GuestTile key={p.id} p={p} />)}
    </div>
  );
}
const GuestTile = ({ p }) => {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && ref.current.srcObject !== p.stream) { ref.current.srcObject = p.stream; ref.current.play?.().catch(() => {}); } }, [p.stream]);
  return <div className="w-24 h-32 rounded-2xl overflow-hidden bg-black/60 ring-2 ring-primary/70 relative"><video ref={ref} autoPlay playsInline className="w-full h-full object-cover" /><span className="absolute bottom-1 left-1 right-1 text-[10px] text-white truncate drop-shadow">{p.name}</span></div>;
};
