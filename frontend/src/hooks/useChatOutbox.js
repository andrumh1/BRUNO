import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const key = (chatId) => `bruno_outbox_${chatId}`;

/**
 * useChatOutbox — offline-first sending for a chat.
 *  queue(messageData) → returns an optimistic message (status "pending") persisted in localStorage
 *  flush() runs automatically when the browser comes back online; resolves each pending message via REST.
 */
export function useChatOutbox({ chatId, token, onSent, onFailed }) {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [pending, setPending] = useState(() => { try { return JSON.parse(localStorage.getItem(key(chatId)) || "[]"); } catch { return []; } });
  const flushing = useRef(false);

  const persist = (list) => { try { localStorage.setItem(key(chatId), JSON.stringify(list)); } catch { /* ignore */ } };

  const queue = useCallback((messageData) => {
    const optimistic = { id: `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, chat_id: chatId, ...messageData, status: "pending", created_at: new Date().toISOString() };
    setPending((prev) => { const next = [...prev, optimistic]; persist(next); return next; });
    return optimistic;
  }, [chatId]); // eslint-disable-line

  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine || !pending.length) return;
    flushing.current = true;
    try {
      for (const msg of pending) {
        const { id, status, created_at, chat_id, ...body } = msg;
        try {
          const r = await axios.post(`${API}/chats/${chatId}/messages`, body, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
          setPending((prev) => { const next = prev.filter((m) => m.id !== id); persist(next); return next; });
          onSent?.(id, r.data);
        } catch (e) {
          if (!navigator.onLine || !e?.response) break; // still offline → retry later
          setPending((prev) => { const next = prev.filter((m) => m.id !== id); persist(next); return next; });
          onFailed?.(id, e);
        }
      }
    } finally { flushing.current = false; }
  }, [pending, chatId, token, onSent, onFailed]);

  useEffect(() => {
    const up = () => { setOnline(true); setTimeout(flush, 400); };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, [flush]);

  useEffect(() => { if (online && pending.length) flush(); }, [online, pending.length, flush]);

  return { online, pending, queue, flush };
}
