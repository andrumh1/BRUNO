/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from "react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = BACKEND.replace("https://", "wss://").replace("http://", "ws://");

/**
 * useLiveRTC — canal de eventos en tiempo real del live (/api/lives/{id}/ws):
 * comentarios, corazones, regalos, espectadores, fijados, moderación, fin del live.
 * El audio/video viaja por Daily.co (ver useDailyLive). Reconecta con backoff.
 */
export function useLiveRTC({ liveId, token, role, accessCode, enabled = true }) {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [hostOnline, setHostOnline] = useState(role === "host");
  const [viewerCount, setViewerCount] = useState(0);
  const [events, setEvents] = useState([]);
  const [hearts, setHearts] = useState([]);
  const [pinned, setPinned] = useState(null);
  const [settings, setSettings] = useState({});
  const [mutedIds, setMutedIds] = useState([]);
  const [ended, setEnded] = useState(false);
  const [denied, setDenied] = useState(false);
  const [kicked, setKicked] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [guestRequests, setGuestRequests] = useState([]);
  const [guests, setGuests] = useState([]);
  const [guestStatus, setGuestStatus] = useState("none"); // none | pending | accepted | rejected
  const [guestRtc, setGuestRtc] = useState(null);
  const [poll, setPoll] = useState(null);
  const [questions, setQuestions] = useState([]);

  const send = useCallback((msg) => { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }, []);
  const pushEvent = (e) => setEvents((p) => [...p.slice(-80), e]);

  useEffect(() => {
    if (!enabled || !liveId || !token || ended || kicked || denied) return;
    const url = `${WS_BASE}/api/lives/${liveId}/ws?token=${encodeURIComponent(token)}${accessCode ? `&code=${encodeURIComponent(accessCode)}` : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    let closedByUs = false;
    let retry;
    ws.onopen = () => { setConnected(true); setAttempt(0); };
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4003) return setDenied(true);
      if (e.code === 4005) return setKicked(true);
      if (e.code === 4004) return setEnded(true);
      if (e.code === 4000 || closedByUs) return;
      retry = setTimeout(() => setAttempt((a) => a + 1), Math.min(8000, 1000 * 2 ** Math.min(attempt, 3)));
    };
    ws.onmessage = (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
      switch (msg.type) {
        case "error": if (msg.code === 4003) setDenied(true); break;
        case "welcome": setViewerCount(msg.viewer_count || 0); setPinned(msg.pinned_comment || null); if (role !== "host") setHostOnline(!!msg.host_online); break;
        case "viewer_joined": setViewerCount(msg.viewer_count ?? 0); pushEvent({ id: `j-${Date.now()}`, kind: "join", user_name: msg.viewer?.name, user_id: msg.viewer?.id }); break;
        case "viewer_left": setViewerCount(msg.viewer_count ?? 0); break;
        case "host_online": setHostOnline(true); break;
        case "host_offline": setHostOnline(false); break;
        case "new_comment": pushEvent({ kind: "comment", ...msg.comment }); break;
        case "new_gift": pushEvent({ kind: "gift", id: msg.gift.id, user_name: msg.gift.sender_name, gift_type: msg.gift.gift_type, amount: msg.gift.amount }); break;
        case "heart": { const id = `${Date.now()}-${Math.random()}`; setHearts((p) => [...p.slice(-20), { id, dx: Math.round(Math.random() * 80 - 40) }]); setTimeout(() => setHearts((p) => p.filter((h) => h.id !== id)), 2500); break; }
        case "pinned": setPinned(msg.comment || null); break;
        case "user_muted": setMutedIds((p) => [...new Set([...p, msg.user_id])]); break;
        case "user_unmuted": setMutedIds((p) => p.filter((x) => x !== msg.user_id)); break;
        case "user_kicked": setEvents((p) => p.filter((e) => e.user_id !== msg.user_id)); break;
        case "kicked": setKicked(true); break;
        case "settings": setSettings((s) => ({ ...s, ...msg })); break;
        case "live_ended": setEnded(true); break;
        case "guest_request": setGuestRequests((p) => [...p.filter((g) => g.id !== msg.user.id), msg.user]); break;
        case "guest_request_cancel": setGuestRequests((p) => p.filter((g) => g.id !== msg.user_id)); break;
        case "guest_accepted": setGuestStatus("accepted"); setGuestRtc(msg.rtc); break;
        case "guest_rejected": setGuestStatus("rejected"); break;
        case "guest_added": setGuests((p) => [...p.filter((g) => g.id !== msg.user.id), msg.user]); setGuestRequests((p) => p.filter((g) => g.id !== msg.user.id)); break;
        case "guest_removed": setGuests((p) => p.filter((g) => g.id !== msg.user_id)); break;
        case "guest_removed_you": setGuestStatus("none"); setGuestRtc(null); break;
        case "poll": setPoll(msg.poll); break;
        case "question": setQuestions((p) => { const rest = p.filter((q) => q.id !== msg.question.id); return [...rest, msg.question].sort((a, b) => (a.answered - b.answered) || (b.upvotes - a.upvotes)); }); break;
        default: break;
      }
    };
    const ping = setInterval(() => send({ type: "ping" }), 25000);
    return () => { closedByUs = true; clearInterval(ping); clearTimeout(retry); try { ws.close(); } catch (_) { /* ignore */ } wsRef.current = null; };
  }, [liveId, token, role, accessCode, enabled, attempt, ended, kicked, denied]);

  const sendHeart = useCallback(() => send({ type: "heart" }), [send]);

  return { connected, hostOnline, viewerCount, events, hearts, pinned, settings, mutedIds, ended, denied, kicked, sendHeart, reconnecting: !connected && attempt > 0,
    guestRequests, guests, guestStatus, setGuestStatus, guestRtc, setGuestRtc, poll, setPoll, questions, setQuestions };
}
