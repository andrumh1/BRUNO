/**
 * StoryInsightsModal — analytics drawer for a story.
 *
 * For the story owner:  uses /api/stories/:id/insights (full PII, names, answers)
 * For viewers:          uses /api/stories/:id/public-insights (aggregate-only)
 *
 * Renders:
 *   • View / reaction counters
 *   • Poll results (bars per option, % + votes)
 *   • Free-text answers (owner only)
 */
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, BarChart3, Eye, Heart, MessageCircle, Loader2 } from "lucide-react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

export default function StoryInsightsModal({ open, onClose, storyId, isOwner }) {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !storyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const path = isOwner ? "insights" : "public-insights";
        const r = await axios.get(`${API}/stories/${storyId}/${path}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled) setData(r.data);
      } catch (_e) {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, storyId, isOwner, token]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-md flex items-end justify-center"
          onClick={onClose}
          data-testid="story-insights-modal"
        >
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="w-full max-w-md bg-stone-950 border-t border-white/10 rounded-t-3xl max-h-[78vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber */}
            <div className="flex justify-center pt-2.5">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-orange-500" />
                <h3 className="text-white font-bold text-base">
                  {isOwner ? "Insights" : "Resultados"}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-white/10 grid place-items-center text-white"
                data-testid="story-insights-close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                </div>
              ) : !data ? (
                <p className="text-white/60 text-sm text-center py-10">
                  No hay datos para mostrar todavía.
                </p>
              ) : (
                <>
                  {/* Owner-only counters */}
                  {isOwner && (
                    <div className="grid grid-cols-3 gap-2" data-testid="story-insights-counters">
                      <Counter icon={Eye} label="Vistas" value={data.views_count} />
                      <Counter icon={Heart} label="Reacciones" value={data.reactions_count} />
                      <Counter icon={MessageCircle} label="Respuestas" value={data.answers_count} />
                    </div>
                  )}

                  {/* Poll results */}
                  {data.poll && (
                    <section data-testid="story-insights-poll">
                      <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-2">
                        Encuesta
                      </p>
                      <p className="text-white text-sm font-semibold mb-3">
                        {data.poll.question}
                      </p>
                      <div className="space-y-2">
                        {data.poll.options.map((o, idx) => (
                          <div key={`po-${idx}`}>
                            <div className="flex items-center justify-between text-xs text-white mb-1">
                              <span className="font-medium">{o.text}</span>
                              <span className="text-white/60">
                                {o.votes} · {o.pct}%
                              </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${o.pct}%` }}
                                transition={{ duration: 0.6, delay: idx * 0.05 }}
                                className="h-full bg-gradient-to-r from-orange-500 to-pink-500 rounded-full"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="text-[11px] text-white/40 mt-2">
                        Total: {data.poll.total_votes} votos
                      </p>
                    </section>
                  )}

                  {/* Reaction breakdown — owner only */}
                  {isOwner && data.reactions_by_emoji && Object.keys(data.reactions_by_emoji).length > 0 && (
                    <section data-testid="story-insights-reactions">
                      <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-2">
                        Por reacción
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(data.reactions_by_emoji).map(([emoji, count]) => (
                          <div
                            key={emoji}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10"
                          >
                            <span className="text-base leading-none">{emoji}</span>
                            <span className="text-white text-xs font-bold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Free-text answers — owner only */}
                  {isOwner && data.answers && data.answers.length > 0 && (
                    <section data-testid="story-insights-answers">
                      <p className="text-white/60 text-[10px] uppercase tracking-wider font-bold mb-2">
                        Respuestas ({data.answers_count})
                      </p>
                      <div className="space-y-2">
                        {data.answers.map((a, i) => (
                          <div
                            key={`ans-${i}`}
                            className="flex items-start gap-2 p-2.5 rounded-xl bg-white/5"
                          >
                            <div className="w-7 h-7 rounded-full bg-orange-500/30 grid place-items-center shrink-0 overflow-hidden">
                              {a.avatar_url ? (
                                <img src={a.avatar_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-white text-[10px] font-bold">
                                  {(a.user_name || "?")[0]}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/80 text-[11px] font-medium leading-none mb-1">
                                {a.user_name || "Anónimo"}
                              </p>
                              <p className="text-white text-sm break-words">{a.answer}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Viewer-only: answers count */}
                  {!isOwner && (data.answers_count > 0 || data.poll) && (
                    <p className="text-center text-white/50 text-xs">
                      {data.answers_count > 0
                        ? `${data.answers_count} ${data.answers_count === 1 ? "respuesta" : "respuestas"}`
                        : "Ver resultados arriba"}
                    </p>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Counter({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-white/5 border border-white/10">
      <Icon className="w-4 h-4 text-orange-500 mb-1" />
      <p className="text-white font-bold text-lg leading-none">{value ?? 0}</p>
      <p className="text-white/50 text-[10px] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
