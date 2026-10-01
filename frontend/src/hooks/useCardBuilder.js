import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { DEFAULT_DESIGN, EMPTY_CUSTOM_FIELDS, applyPreset, deepMerge, resolveDesign } from "@/lib/cardDesign";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const SAVE_FIELDS = ["card_type", "title", "subtitle", "description", "avatar_url", "banner_url", "gallery_photos", "social_links", "contact_info", "location", "locations", "custom_fields", "is_public", "show_in_feed", "is_animated", "is_draft", "card_design", "background_color", "text_color"];

export const newCard = (type = "personal") => ({
  card_type: type, title: "", subtitle: "", description: "", avatar_url: "", banner_url: "", gallery_photos: [], social_links: [],
  contact_info: {}, location: null, locations: [], custom_fields: EMPTY_CUSTOM_FIELDS, is_public: true, show_in_feed: true, is_animated: true, is_draft: true,
  card_design: applyPreset(DEFAULT_DESIGN, "modern"),
});

const toPayload = (card) => {
  const out = {};
  SAVE_FIELDS.forEach((k) => { if (card[k] !== undefined) out[k] = card[k]; });
  out.location = card.location || {};
  out.contact_info = card.contact_info || {};
  out.background_color = card.card_design.background.color;
  out.text_color = card.card_design.colors.text;
  return out;
};

// State + undo/redo + debounced autosave for the BRUNO Card Builder.
export const useCardBuilder = ({ cardId, token, onCreated }) => {
  const [card, setCardState] = useState(cardId ? null : newCard());
  const [id, setId] = useState(cardId || null);
  const [status, setStatus] = useState(cardId ? "loading" : "idle");
  const [error, setError] = useState("");
  const [, bump] = useState(0);
  const hist = useRef({ past: [], future: [], lastPush: 0 });
  const dirty = useRef(false);
  const saving = useRef(false);
  const latest = useRef(card);
  latest.current = card;
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    if (!cardId || cardId === id && card) return;
    setStatus("loading");
    axios.get(`${API}/cards/${cardId}`, auth).then((r) => {
      const c = r.data; c.card_design = resolveDesign(c); c.custom_fields = deepMerge(EMPTY_CUSTOM_FIELDS, c.custom_fields || {});
      setCardState(c); setId(cardId); setStatus("saved");
    }).catch((e) => { setError(e.response?.data?.detail || "No se pudo cargar la tarjeta"); setStatus("error"); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId]);

  const update = useCallback((patch) => {
    setCardState((prev) => {
      if (!prev) return prev;
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      const now = Date.now();
      const h = hist.current;
      if (now - h.lastPush > 700) h.past = [...h.past.slice(-49), prev];
      h.lastPush = now; h.future = [];
      dirty.current = true;
      return next;
    });
    setStatus((s) => (s === "saved" || s === "idle" ? "dirty" : s));
  }, []);

  const updateDesign = useCallback((patch) => update((p) => ({ ...p, card_design: deepMerge(p.card_design, typeof patch === "function" ? patch(p.card_design) : patch) })), [update]);
  const setDesign = useCallback((design) => update((p) => ({ ...p, card_design: design })), [update]);
  const setPreset = useCallback((presetId) => update((p) => ({ ...p, card_design: applyPreset(p.card_design, presetId) })), [update]);
  const resetDesign = useCallback(() => update((p) => ({ ...p, card_design: applyPreset(p.card_design, p.card_design.preset) })), [update]);

  const undo = useCallback(() => { const h = hist.current; if (!h.past.length) return; const prev = h.past.pop(); h.future.push(latest.current); dirty.current = true; setCardState(prev); setStatus("dirty"); bump((n) => n + 1); }, []);
  const redo = useCallback(() => { const h = hist.current; if (!h.future.length) return; const next = h.future.pop(); h.past.push(latest.current); dirty.current = true; setCardState(next); setStatus("dirty"); bump((n) => n + 1); }, []);

  const save = useCallback(async (extra = {}) => {
    const c = latest.current; if (!c || saving.current) return null;
    saving.current = true; dirty.current = false; setStatus("saving");
    try {
      const payload = { ...toPayload(c), ...extra };
      let res;
      if (id) res = await axios.put(`${API}/cards/${id}`, payload, auth);
      else { res = await axios.post(`${API}/cards`, payload, auth); setId(res.data.id); onCreated?.(res.data.id); }
      if (Object.keys(extra).length) setCardState((p) => ({ ...p, ...extra }));
      setStatus(dirty.current ? "dirty" : "saved");
      return res.data.id;
    } catch (e) { setStatus("error"); setError(e.response?.data?.detail || "Error al guardar"); return null; }
    finally { saving.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  useEffect(() => {
    if (!dirty.current || status === "loading") return;
    const t = setTimeout(() => { if (dirty.current) save(); }, 1200);
    return () => clearTimeout(t);
  }, [card, status, save]);

  const publish = useCallback(() => save({ is_draft: false }), [save]);

  return { card, id, status, error, update, updateDesign, setDesign, setPreset, resetDesign, undo, redo, canUndo: hist.current.past.length > 0, canRedo: hist.current.future.length > 0, save, publish, isNew: !id };
};
