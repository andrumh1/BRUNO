import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, X, Loader2, WifiOff, RotateCcw, SearchX, ChevronRight, ArrowUpDown, Mic, Square } from "lucide-react";
import { useVoiceSearch } from "@/components/search/useVoiceSearch";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { useSearch, FILTERS, saveScroll, readScroll } from "@/components/search/useSearch";
import { SearchResultItem } from "@/components/search/SearchResultItem";
import { SearchHome, AskBrunoCard } from "@/components/search/SearchHome";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const GROUP_LABEL = { user: "Personas", business: "Empresas", hashtag: "Hashtags", video: "Videos", series: "Series", post: "Publicaciones", card: "Tarjetas", product: "Tienda", comment: "Comentarios", ai_public: "Respuestas públicas de BRUNO IA", ai_private: "Mis conversaciones con BRUNO IA" };
const GROUP_FILTER = { user: "people", business: "businesses", hashtag: "hashtags", video: "videos", series: "videos", post: "posts", card: "cards", product: "store", comment: "comments", ai_public: "ai", ai_private: "ai" };
const SORTS = [["relevance", "Relevancia"], ["newest", "Más recientes"], ["oldest", "Más antiguos"]];

export default function SearchPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const s = useSearch({ token, userId: user?.id });
  const inputRef = useRef(null);
  const sentinelRef = useRef(null);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const voice = useVoiceSearch({ token, onText: (text) => { s.submit(text); brunoToast.success(`Buscando “${text}”`); } });
  useEffect(() => { if (voice.error) brunoToast.error(voice.error); }, [voice.error]);

  // Deep-link /search?ai=session:id (abre mi conversación) o /search?q=
  useEffect(() => {
    const ai = params.get("ai");
    if (ai) { const [session_id, message_id] = ai.split(":"); window.dispatchEvent(new CustomEvent("bruno:open-ai", { detail: { session_id, message_id } })); }
    const q0 = params.get("q");
    if (q0 && q0 !== s.q) s.submit(q0);
    else if (!s.q) setTimeout(() => inputRef.current?.focus(), 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restaurar posición al volver de un resultado
  useEffect(() => { if (s.status === "results") { const y = readScroll(); if (y) requestAnimationFrame(() => window.scrollTo(0, y)); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { const on = () => setOnline(true), off = () => setOnline(false); window.addEventListener("online", on); window.addEventListener("offline", off); return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); }; }, []);
  useEffect(() => { setAnswer(null); }, [s.q, s.type]);

  // Carga por lotes al llegar al final (listas por categoría)
  useEffect(() => {
    if (!sentinelRef.current || s.type === "all") return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) s.loadMore(); }, { rootMargin: "300px" });
    io.observe(sentinelRef.current);
    return () => io.disconnect();
  }, [s.type, s.items.length, s.hasMore, s]);

  const onOpen = () => saveScroll(window.scrollY);
  const follow = async (item) => {
    if (!token) { navigate(`/login?next=/search`); return; }
    try { await axios.post(`${API}/users/${item.id}/follow`, {}, { headers }); brunoToast.success(item.is_following ? "Dejaste de seguir" : `Ahora sigues a ${item.name}`); s.retry(); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo seguir"); }
  };
  const ask = async () => {
    if (!token) { navigate("/login?next=/search"); return; }
    setAsking(true);
    try { const r = await axios.post(`${API}/search/ask`, { q: s.q }, { headers }); setAnswer(r.data); }
    catch (e) { brunoToast.error(e?.response?.data?.detail || "BRUNO IA no pudo responder"); }
    finally { setAsking(false); }
  };

  const listItems = s.type === "all" ? [] : s.items;
  const showHome = s.status === "idle" || (s.status === "typing" && !s.result);

  return (
    <div className="min-h-screen bg-background" data-testid="search-page" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 16px)" }}>
      <header className="sticky top-0 z-40 bruno-glass border-b border-border/40">
        <div className="max-w-2xl mx-auto px-3 pt-2 pb-2">
          <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); s.submit(); inputRef.current?.blur(); }} role="search">
            <button type="button" onClick={() => navigate(-1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-foreground/[0.06]" aria-label="Volver" data-testid="search-back"><ArrowLeft className="w-5 h-5" /></button>
            <div className="flex-1 min-w-0 flex items-center gap-2 h-11 rounded-full bg-card/60 border border-border/50 px-3 focus-within:border-primary/60 transition-colors">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <input ref={inputRef} value={s.q} onChange={(e) => s.onType(e.target.value)} placeholder="Busca en BRUNO" enterKeyHint="search" autoComplete="off" maxLength={100} className="flex-1 min-w-0 bg-transparent outline-none text-base placeholder:text-muted-foreground" data-testid="search-input" />
              {s.q && <button type="button" onClick={() => { s.clear(); inputRef.current?.focus(); }} className="w-7 h-7 rounded-full bg-foreground/[0.08] grid place-items-center" aria-label="Limpiar" data-testid="search-clear"><X className="w-3.5 h-3.5" /></button>}
              {voice.supported && token && (
                <button type="button" onClick={voice.toggleRecording} disabled={voice.transcribing} className={`w-7 h-7 rounded-full grid place-items-center transition-colors ${voice.recording ? "bg-red-500 text-white animate-pulse" : "bg-foreground/[0.08]"}`} aria-label={voice.recording ? "Detener dictado" : "Buscar por voz"} data-testid="search-voice-btn">
                  {voice.transcribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : voice.recording ? <Square className="w-3 h-3" /> : <Mic className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
            <button type="submit" className="h-10 w-10 sm:w-auto sm:px-3 shrink-0 rounded-full bg-primary text-white text-sm font-semibold active:scale-95 transition-transform grid place-items-center" aria-label="Buscar" data-testid="search-submit"><Search className="w-4 h-4 sm:hidden" /><span className="hidden sm:inline">Buscar</span></button>
          </form>
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-2 -mx-3 px-3" data-testid="search-filters">
            {FILTERS.filter(([k]) => k !== "ai" || token).map(([k, label]) => (
              <button key={k} onClick={() => s.changeType(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${s.type === k ? "bg-primary text-white border-primary" : "bg-card/50 border-border/40 text-foreground/80 hover:bg-foreground/[0.05]"}`} data-testid={`search-filter-${k}`}>{label}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 pt-3 space-y-3">
        {s.suggestions.length > 0 && s.status === "typing" && (
          <div className="rounded-2xl bg-card/70 border border-border/40 overflow-hidden" data-testid="search-suggestions">
            {s.suggestions.map((sg) => (
              <button key={`${sg.kind}-${sg.id}`} onClick={() => { if (sg.kind === "user" || sg.kind === "hashtag") { onOpen(); navigate(sg.url); } else s.submit(sg.label); }} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-foreground/[0.04]" data-testid={`search-suggestion-${sg.kind}-${sg.id}`}>
                <div className="w-8 h-8 rounded-full bg-foreground/[0.06] overflow-hidden grid place-items-center shrink-0">{sg.avatar ? <img src={sg.avatar} alt="" className="w-full h-full object-cover" /> : <Search className="w-3.5 h-3.5 text-muted-foreground" />}</div>
                <div className="min-w-0"><p className="text-sm truncate">{sg.label}</p>{sg.sub && <p className="text-[11px] text-muted-foreground truncate">{sg.sub}</p>}</div>
              </button>
            ))}
          </div>
        )}

        {!online && <div className="rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2 text-sm flex items-center gap-2" data-testid="search-offline"><WifiOff className="w-4 h-4" />Sin conexión. Los resultados mostrados pueden no estar actualizados.</div>}

        {showHome && <SearchHome history={s.history} trending={s.trending} loggedIn={!!token} onPick={(q, t) => { if (t && t !== s.type) s.changeType(t); s.submit(q); }} onRemove={s.removeHistory} onToggle={s.toggleHistory} />}

        {s.status === "loading" && <div className="flex justify-center py-14" data-testid="search-loading"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>}

        {s.status === "error" && (
          <div className="text-center py-14 space-y-3" data-testid="search-error"><p className="text-sm text-muted-foreground">{s.error}</p><button onClick={s.retry} className="inline-flex items-center gap-1.5 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold" data-testid="search-retry"><RotateCcw className="w-4 h-4" />Reintentar</button></div>
        )}
        {s.status === "offline" && (
          <div className="text-center py-14 space-y-3" data-testid="search-offline-state"><WifiOff className="w-10 h-10 mx-auto text-muted-foreground" /><p className="text-sm text-muted-foreground">No hay conexión. Conéctate e inténtalo de nuevo.</p><button onClick={s.retry} className="rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold" data-testid="search-retry-offline">Reintentar</button></div>
        )}

        {s.status === "empty" && (
          <div className="text-center py-12 space-y-3" data-testid="search-empty">
            <SearchX className="w-12 h-12 mx-auto text-muted-foreground/60" />
            <h2 className="text-base font-semibold">Sin resultados para “{s.q}”</h2>
            <p className="text-sm text-muted-foreground">Revisa la ortografía, prueba con menos palabras{s.type !== "all" ? " o cambia el filtro a “Todo”" : ""}.</p>
            {s.type !== "all" && <button onClick={() => s.changeType("all")} className="text-sm text-primary font-semibold" data-testid="search-empty-all">Buscar en todo</button>}
            {s.trending.length > 0 && <div className="flex flex-wrap justify-center gap-2 pt-2">{s.trending.slice(0, 5).map((t) => <button key={t.tag} onClick={() => s.submit(`#${t.tag}`)} className="rounded-full bg-card/60 border border-border/40 px-3 py-1 text-xs">#{t.tag}</button>)}</div>}
          </div>
        )}

        {(s.status === "results" || (s.status === "typing" && s.result)) && (
          <>
            {s.result?.fuzzy_terms?.length > 0 && <p className="text-xs text-muted-foreground" data-testid="search-fuzzy-hint">Incluye coincidencias parecidas: {s.result.fuzzy_terms.slice(0, 4).join(", ")}</p>}
            {token && <AskBrunoCard q={s.q} asking={asking} answer={answer} onAsk={ask} onOpenSource={(src) => { if (src.url) { onOpen(); navigate(src.url); } }} onSpeak={(t) => voice.speak(t)} speaking={voice.speaking} />}

            {s.type === "all" && (s.result?.groups || []).map((g) => (
              <section key={g.kind} data-testid={`search-group-${g.kind}`}>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <h2 className="text-sm font-semibold">{GROUP_LABEL[g.kind] || g.kind} <span className="text-muted-foreground font-normal">· {g.total}</span></h2>
                  {g.has_more && <button onClick={() => s.changeType(GROUP_FILTER[g.kind])} className="text-xs text-primary font-semibold inline-flex items-center" data-testid={`search-group-more-${g.kind}`}>Ver todos<ChevronRight className="w-3.5 h-3.5" /></button>}
                </div>
                <div className="space-y-1.5">{g.items.map((it) => <SearchResultItem key={`${it.kind}-${it.id}`} item={it} onOpen={onOpen} onFollow={follow} />)}</div>
              </section>
            ))}

            {s.type !== "all" && (
              <>
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs text-muted-foreground" data-testid="search-total">{s.result?.total ?? listItems.length} resultados</p>
                  <label className="inline-flex items-center gap-1 text-xs text-muted-foreground"><ArrowUpDown className="w-3.5 h-3.5" /><select value={s.sort} onChange={(e) => s.changeSort(e.target.value)} className="bg-transparent outline-none text-xs text-foreground" data-testid="search-sort">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
                </div>
                <div className="space-y-1.5" data-testid="search-list">{listItems.map((it) => <SearchResultItem key={`${it.kind}-${it.id}`} item={it} onOpen={onOpen} onFollow={follow} />)}</div>
                <div ref={sentinelRef} className="h-6 flex items-center justify-center">{s.loadingMore && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}</div>
                {s.hasMore && !s.loadingMore && <button onClick={s.loadMore} className="w-full text-sm text-primary font-semibold py-2" data-testid="search-load-more">Cargar más</button>}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
