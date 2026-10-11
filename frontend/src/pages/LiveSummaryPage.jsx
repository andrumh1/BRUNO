/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { ArrowLeft, Users, TrendingUp, Clock, MessageCircle, Heart, Gift, MessageCircleQuestion, BarChart3, UserPlus, Disc3, Loader2, Clapperboard, Check, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import { Button } from "@/components/ui/button";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const fmtDur = (s) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

const Stat = ({ Icon, label, value, hint, testId, accent }) => (
  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-3xl border border-border/60 p-4 ${accent ? "bg-primary/10 border-primary/30" : "bg-card/70"}`} data-testid={testId}>
    <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-semibold uppercase tracking-wider"><Icon className={`w-3.5 h-3.5 ${accent ? "text-primary" : ""}`} />{label}</div>
    <div className="mt-1.5 text-2xl sm:text-3xl font-black tabular-nums" data-testid={`${testId}-value`}>{value}</div>
    {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
  </motion.div>
);

const REC_LABEL = { none: "Este live no se grabó", recording: "Grabando…", stopped: "Grabación detenida", processing: "Daily.co está procesando la grabación…", importing: "Copiando el video a tu biblioteca…", ready: "Lista en tus borradores", ready_external: "Lista en tus borradores (enlace externo, válido 12 h)" };

// Resumen al terminar un live: pico de espectadores, duración, mensajes, regalos, preguntas, encuestas, invitados y estado de la grabación.
export default function LiveSummaryPage() {
  const { liveId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [sum, setSum] = useState(null);
  const [rec, setRec] = useState(null);
  const [error, setError] = useState("");
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => { if (!token) return; axios.get(`${API}/lives/${liveId}/summary`, { headers }).then((r) => { setSum(r.data); setRec(r.data.recording); }).catch((e) => setError(e?.response?.data?.detail || "No se pudo cargar el resumen")); }, [liveId, token]);
  useEffect(() => {
    if (!token || !["recording", "stopped", "processing", "importing"].includes(rec?.status)) return;
    const t = setInterval(() => axios.get(`${API}/lives/${liveId}/recording`, { headers }).then((r) => setRec(r.data)).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, [rec?.status, token]);

  if (error) return <div className="min-h-screen grid place-items-center p-6 text-center"><div><p className="font-semibold">{error}</p><Button className="mt-4" onClick={() => navigate("/lives")}>Volver</Button></div></div>;
  if (!sum) return <BrunoLoader />;
  const recStatus = rec?.status || "none";
  const ready = ["ready", "ready_external"].includes(recStatus) || (rec?.draft_id && recStatus === "importing");

  return (
    <div className="min-h-screen bg-background pb-28" data-testid="live-summary-page">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border/60" style={{ paddingTop: "var(--safe-top)" }}>
        <div className="h-14 px-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/lives")} data-testid="live-summary-back"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0"><p className="text-xs text-muted-foreground leading-none">Resumen del live</p><h1 className="text-base font-bold truncate" data-testid="live-summary-title">{sum.title || "Live"}</h1></div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-5">
        <div className="rounded-[28px] bg-foreground text-background p-5 relative overflow-hidden" data-testid="live-summary-hero">
          <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-primary/40 blur-3xl" />
          <p className="text-[11px] uppercase tracking-[0.2em] opacity-70">{sum.status === "live" ? "En curso" : "Terminado"}</p>
          <div className="mt-2 flex items-end gap-6">
            <div><p className="text-4xl sm:text-5xl font-black tabular-nums" data-testid="live-summary-duration">{fmtDur(sum.duration_seconds)}</p><p className="text-xs opacity-70 mt-1 inline-flex items-center gap-1"><Clock className="w-3 h-3" /> duración</p></div>
            <div><p className="text-4xl sm:text-5xl font-black tabular-nums text-primary" data-testid="live-summary-peak">{sum.peak_viewers}</p><p className="text-xs opacity-70 mt-1 inline-flex items-center gap-1"><TrendingUp className="w-3 h-3" /> pico de espectadores</p></div>
          </div>
        </div>

        {sum.money && (sum.money.gross_minor > 0) && (
          <div className="rounded-3xl border border-border/60 p-4 text-sm space-y-1" data-testid="live-summary-money">
            <p className="font-bold mb-1">Ingresos de este live (confirmados)</p>
            <div className="flex justify-between"><span className="text-muted-foreground">Entradas ({sum.money.tickets_count})</span><span>{(sum.money.tickets_minor / 100).toFixed(2)} USD</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Regalos ({sum.money.gifts_count})</span><span>{(sum.money.gifts_minor / 100).toFixed(2)} USD</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Comisión BRUNO</span><span>−{(sum.money.fee_minor / 100).toFixed(2)} USD</span></div>
            {sum.money.refunded_minor > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Devoluciones</span><span>−{(sum.money.refunded_minor / 100).toFixed(2)} USD</span></div>}
            <div className="flex justify-between font-bold border-t pt-1"><span>Ganancia estimada</span><span data-testid="live-summary-net">{(sum.money.net_minor / 100).toFixed(2)} USD</span></div>
            <p className="text-[11px] text-muted-foreground">Pasa a saldo disponible cuando el procesador liquida; retira desde Mis ingresos.</p>
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat Icon={Users} label="Espectadores únicos" value={sum.total_viewers} testId="stat-viewers" />
          <Stat Icon={MessageCircle} label="Mensajes" value={sum.comments} testId="stat-comments" />
          <Stat Icon={Heart} label="Corazones" value={sum.hearts} testId="stat-hearts" />
          <Stat Icon={Gift} label="Regalos" value={sum.gifts} hint={sum.money?.gifts_minor ? `${(sum.money.gifts_minor / 100).toFixed(2)} USD brutos` : undefined} testId="stat-gifts" />
          <Stat Icon={MessageCircleQuestion} label="Preguntas" value={sum.questions} hint={sum.questions ? `${sum.questions_answered} respondidas` : undefined} testId="stat-questions" />
          <Stat Icon={BarChart3} label="Encuestas" value={sum.polls} hint={sum.polls ? `${sum.poll_votes} votos` : undefined} testId="stat-polls" />
          <Stat Icon={UserPlus} label="Invitados" value={sum.guests} testId="stat-guests" />
        </div>

        <div className="rounded-3xl border border-border/60 p-4 space-y-3" data-testid="live-summary-recording" data-status={recStatus}>
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl grid place-items-center ${ready ? "bg-emerald-500/15 text-emerald-600" : recStatus === "none" ? "bg-muted text-muted-foreground" : "bg-red-500/10 text-red-500"}`}>{ready ? <Check className="w-5 h-5" /> : recStatus === "none" ? <Disc3 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}</div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Grabación del live</p><p className="text-xs text-muted-foreground" data-testid="live-summary-rec-label">{REC_LABEL[recStatus] || recStatus}</p>{rec?.duration ? <p className="text-[11px] text-muted-foreground">{fmtDur(Math.round(rec.duration))} grabados</p> : null}</div>
          </div>
          {rec?.import_error && <p className="text-[11px] text-amber-600">No pudimos copiar el video a tu biblioteca; publícalo desde el borrador antes de que caduque el enlace.</p>}
          {ready && !sum.replay_post_id && (
            <Button className="w-full rounded-full h-12" onClick={() => navigate("/camera?drafts=1")} data-testid="live-summary-publish-btn"><Clapperboard className="w-4 h-4 mr-2" /> Revisar y publicar como video</Button>
          )}
          {sum.replay_post_id && <Button variant="outline" className="w-full rounded-full h-12" onClick={() => navigate(`/reels?id=${sum.replay_post_id}`)} data-testid="live-summary-replay-btn"><ExternalLink className="w-4 h-4 mr-2" /> Ver la repetición publicada</Button>}
          {ready && !sum.replay_post_id && <p className="text-[11px] text-muted-foreground">Al publicarla avisaremos a quienes estuvieron en el live.</p>}
          {["processing", "importing", "stopped"].includes(recStatus) && <p className="text-[11px] text-muted-foreground">Puedes salir; la grabación seguirá preparándose y aparecerá en Borradores de la cámara.</p>}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-full h-12" onClick={() => navigate("/lives")} data-testid="live-summary-done">Listo</Button>
          <Button className="flex-1 rounded-full h-12" onClick={() => navigate("/lives/start")} data-testid="live-summary-new">Nuevo live</Button>
        </div>
      </div>
    </div>
  );
}
