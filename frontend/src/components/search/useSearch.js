import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const STATE_KEY = "bruno_search_state";
export const FILTERS = [
  ["all", "Todo"], ["videos", "Videos"], ["posts", "Publicaciones"], ["people", "Personas"], ["businesses", "Empresas"],
  ["cards", "Tarjetas"], ["hashtags", "Hashtags"], ["store", "Tienda"], ["comments", "Comentarios"], ["ai", "BRUNO IA"],
];

const readState = (uid) => {
  try { const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); return s && s.uid === uid ? s : null; } catch { return null; }
};

/** Estado completo del buscador: consulta, filtro, orden, paginación, sugerencias, historial y persistencia al volver. */
export function useSearch({ token, userId }) {
  const saved = readState(userId || "anon");
  const [q, setQ] = useState(saved?.q || "");
  const [type, setType] = useState(saved?.type || "all");
  const [sort, setSort] = useState(saved?.sort || "relevance");
  const [status, setStatus] = useState(saved?.result ? "results" : "idle"); // idle | typing | loading | results | empty | error | offline
  const [result, setResult] = useState(saved?.result || null);
  const [items, setItems] = useState(saved?.items || []);
  const [page, setPage] = useState(saved?.page || 0);
  const [hasMore, setHasMore] = useState(saved?.hasMore || false);
  const [suggestions, setSuggestions] = useState([]);
  const [history, setHistory] = useState({ enabled: true, items: [] });
  const [trending, setTrending] = useState([]);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const abortRef = useRef(null);
  const debounceRef = useRef(null);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const persist = useCallback((patch) => {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ uid: userId || "anon", q, type, sort, result, items, page, hasMore, ...patch })); } catch { /* quota */ }
  }, [userId, q, type, sort, result, items, page, hasMore]);

  const loadHome = useCallback(() => {
    axios.get(`${API}/search/trending`).then((r) => setTrending(r.data || [])).catch(() => {});
    if (token) axios.get(`${API}/search/history`, { headers }).then((r) => setHistory(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => { loadHome(); }, [loadHome]);

  const run = useCallback(async (query, t = type, s = sort, pg = 0, append = false) => {
    const text = (query || "").trim();
    if (!text) { setStatus("idle"); setResult(null); setItems([]); return; }
    if (abortRef.current) abortRef.current.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    if (!navigator.onLine) { setStatus("offline"); return; }
    if (append) setLoadingMore(true); else setStatus("loading");
    try {
      const r = await axios.get(`${API}/search`, { params: { q: text, type: t, sort: s, page: pg, limit: 20 }, headers, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      const data = r.data;
      let nextItems = items;
      if (t === "all") { nextItems = []; setItems([]); setResult(data); setHasMore(false); }
      else {
        const seen = new Set(append ? items.map((i) => `${i.kind}:${i.id}`) : []);
        const fresh = (data.items || []).filter((i) => !seen.has(`${i.kind}:${i.id}`));
        nextItems = append ? [...items, ...fresh] : fresh;
        setItems(nextItems); setResult(data); setHasMore(!!data.has_more);
      }
      setPage(pg);
      const empty = t === "all" ? !(data.groups || []).length : !nextItems.length;
      setStatus(empty ? "empty" : "results");
      setError("");
      persist({ q: text, type: t, sort: s, result: data, items: nextItems, page: pg, hasMore: !!data.has_more });
      if (pg === 0 && token) axios.get(`${API}/search/history`, { headers }).then((h) => setHistory(h.data)).catch(() => {});
    } catch (e) {
      if (axios.isCancel?.(e) || e?.name === "CanceledError") return;
      if (!navigator.onLine) setStatus("offline");
      else { setError(e?.response?.data?.detail || "No se pudo buscar"); setStatus("error"); }
    } finally { setLoadingMore(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, sort, items, token, persist]);

  // Sugerencias con breve espera al escribir
  const onType = (value) => {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const text = value.trim();
    if (!text) { setSuggestions([]); setStatus(result ? "results" : "idle"); return; }
    setStatus("typing");
    debounceRef.current = setTimeout(async () => {
      try { const r = await axios.get(`${API}/search/suggest`, { params: { q: text }, headers }); setSuggestions(r.data || []); } catch { setSuggestions([]); }
      run(text, type, sort, 0);
    }, 380);
  };

  const submit = (value) => { const text = (value ?? q).trim(); if (debounceRef.current) clearTimeout(debounceRef.current); setQ(text); setSuggestions([]); run(text, type, sort, 0); };
  const changeType = (t) => { setType(t); if (q.trim()) run(q, t, sort, 0); else persist({ type: t }); };
  const changeSort = (s) => { setSort(s); if (q.trim()) run(q, type, s, 0); };
  const loadMore = () => { if (!loadingMore && hasMore) run(q, type, sort, page + 1, true); };
  const clear = () => { setQ(""); setSuggestions([]); setResult(null); setItems([]); setStatus("idle"); setPage(0); setHasMore(false); try { sessionStorage.removeItem(STATE_KEY); } catch { /* ignore */ } };

  const removeHistory = async (id) => { await axios.delete(`${API}/search/history`, { params: id ? { id } : {}, headers }).catch(() => {}); setHistory((h) => ({ ...h, items: id ? h.items.filter((i) => i.id !== id) : [] })); };
  const toggleHistory = async (enabled) => { await axios.put(`${API}/search/history/settings`, { enabled }, { headers }).catch(() => {}); setHistory({ enabled, items: enabled ? history.items : [] }); };

  return { q, type, sort, status, result, items, hasMore, suggestions, history, trending, error, loadingMore, onType, submit, changeType, changeSort, loadMore, clear, removeHistory, toggleHistory, retry: () => run(q, type, sort, 0) };
}

export const saveScroll = (y) => { try { const s = JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}"); s.scrollY = y; sessionStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
export const readScroll = () => { try { return JSON.parse(sessionStorage.getItem(STATE_KEY) || "{}").scrollY || 0; } catch { return 0; } };
export const clearSearchState = () => { try { sessionStorage.removeItem(STATE_KEY); } catch { /* ignore */ } };
