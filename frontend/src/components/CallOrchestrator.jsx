/**
 * CallOrchestrator — global component mounted once at the App level.
 *
 *  • Connects to the chat WebSocket and listens for `incoming_call` events.
 *  • Listens for the `bruno:start-call` custom event from anywhere in the
 *    app (e.g. FloatingChatBubble, ChatHeader) and starts the call.
 *  • Renders the <VideoCallModal> in the right state at the right time.
 */
import React, { useEffect, useRef, useState, Suspense } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
const VideoCallModal = React.lazy(() => import("@/components/VideoCallModal"));
import { brunoToast } from "@/components/bruno/BrunoToast";
import { makeBackoff, onBackOnline } from "@/lib/wsBackoff";

const OUTGOING_TIMEOUT_MS = 45000;

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const WS_URL = BACKEND_URL.replace("https://", "wss://").replace("http://", "ws://");

export default function CallOrchestrator() {
  const { user, token } = useAuth();
  const [call, setCall] = useState(null); // { id, room_url, type, peerName, peerAvatar, isIncoming }
  const wsRef = useRef(null);

  // Listen to the start-call custom event
  useEffect(() => {
    if (!user || !token) return;
    const onStart = async (e) => {
      const { user_id: peerId, chat_id, type = "video", peer_name = "Usuario", peer_avatar = null } = e.detail || {};
      try {
        let chatId = chat_id;
        // If no chat_id given, find or create one with that peer
        if (!chatId && peerId) {
          const r = await axios.post(`${API}/chats?participant_id=${peerId}`, {}, { headers: { Authorization: `Bearer ${token}` } });
          chatId = r.data?.id;
        }
        if (!chatId) return;
        // Show outgoing UI immediately
        setCall({ id: null, room_url: null, type, peerName: peer_name, peerAvatar: peer_avatar, isIncoming: false });
        const startRes = await axios.post(
          `${API}/calls/start`,
          { chat_id: chatId, call_type: type },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (startRes.data?.busy) { setCall(null); brunoToast.info(`${peer_name} está en otra llamada`, { description: "Inténtalo en unos minutos" }); return; }
        if (startRes.data?.dnd) { setCall(null); brunoToast.info(`${peer_name} tiene activado No molestar`, { description: "Le dejamos aviso de llamada perdida" }); return; }
        setCall((prev) => ({
          ...(prev || {}),
          id: startRes.data.call_id,
          room_url: startRes.data.room_url,
          type,
          isIncoming: false,
          outgoingSince: Date.now(),
        }));
      } catch (err) {
        setCall(null);
        brunoToast.error("No se pudo iniciar la llamada", { description: err?.response?.data?.detail || "Revisa tu conexión e inténtalo de nuevo" });
      }
    };
    window.addEventListener("bruno:start-call", onStart);
    return () => window.removeEventListener("bruno:start-call", onStart);
  }, [user, token]);

  // Connect to chat WS to listen for incoming calls
  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    let timer = null;
    const backoff = makeBackoff();
    const connect = () => {
      if (!alive) return null;
      try {
        const socket = new WebSocket(`${WS_URL}/api/ws/chat/${token}`);
        wsRef.current = socket;
        // Recover a ring we may have missed while this socket was (re)connecting
        socket.onopen = async () => {
          backoff.reset();
          try {
            const r = await axios.get(`${API}/calls/pending`, { headers: { Authorization: `Bearer ${token}` } });
            const d = r.data?.call;
            if (alive && d) setCall((prev) => (prev && (prev.answered || prev.id === d.call_id)) ? prev : { id: d.call_id, room_url: null, type: d.call_type || "video", peerName: d.is_group && d.chat_name ? `${d.chat_name} · ${d.caller_name}` : d.caller_name, peerAvatar: d.caller_avatar || null, isIncoming: true });
          } catch (_e) { /* ignore */ }
        };
        socket.onmessage = (event) => {
          if (!alive) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "incoming_call") {
              // A live (answered) call keeps priority; a stale/ringing one is superseded by the new ring.
              setCall((prev) => (prev && prev.answered) ? prev : {
                id: data.call_id,
                room_url: null,
                type: data.call_type || "video",
                peerName: data.is_group && data.chat_name ? `${data.chat_name} · ${data.caller_name || "Usuario"}` : (data.caller_name || "Usuario"),
                peerAvatar: data.caller_avatar || null,
                _pending_room: data.room_url,
                isIncoming: true,
              });
            } else if (data.type === "call_answered" && data.call_id) {
              // Peer answered our outgoing call → join the room
              setCall((prev) => (prev && prev.id === data.call_id ? { ...prev, room_url: data.room_url || prev.room_url, isIncoming: false, answered: true } : prev));
            } else if (data.type === "call_declined" && data.call_id) {
              setCall((prev) => { if (prev && prev.id === data.call_id) { brunoToast.info(`${prev.peerName} rechazó la llamada`); return null; } return prev; });
            } else if (data.type === "call_ended" && data.call_id) {
              setCall((prev) => {
                if (!prev || prev.id !== data.call_id) return prev;
                if (data.reason === "missed" && !prev.answered) brunoToast.info(prev.isIncoming ? `Llamada perdida de ${prev.peerName}` : `${prev.peerName} no respondió`);
                if (data.reason === "cancelled" && prev.isIncoming) brunoToast.info(`${prev.peerName} canceló la llamada`);
                return null;
              });
            }
          } catch (_e) { /* ignore */ }
        };
        socket.onclose = () => {
          if (!alive) return;
          timer = setTimeout(connect, backoff.next());
        };
        return socket;
      } catch {
        return null;
      }
    };
    connect();
    const offOnline = onBackOnline(() => { if (alive && wsRef.current?.readyState !== WebSocket.OPEN) { clearTimeout(timer); backoff.reset(); connect(); } });
    return () => {
      alive = false;
      clearTimeout(timer);
      offOnline();
      try { wsRef.current?.close?.(); } catch (_e) { /* ignore */ }
    };
  }, [token]);

  // Incoming ring nobody answers → clear after the server timeout (server already logs it as missed)
  useEffect(() => {
    if (!call?.id || !call.isIncoming) return undefined;
    const t = setTimeout(() => setCall((prev) => (prev && prev.id === call.id && prev.isIncoming ? null : prev)), OUTGOING_TIMEOUT_MS + 5000);
    return () => clearTimeout(t);
  }, [call?.id, call?.isIncoming]);

  // Outgoing call nobody answers → hang up as missed (server also enforces the same timeout)
  useEffect(() => {
    if (!call?.id || call.isIncoming || call.answered) return undefined;
    const t = setTimeout(async () => {
      try { await axios.post(`${API}/calls/${call.id}/end`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (_e) { /* ignore */ }
      setCall((prev) => (prev && prev.id === call.id && !prev.answered ? null : prev));
    }, OUTGOING_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [call?.id, call?.isIncoming, call?.answered, token]);

  const handleAccept = async () => {
    if (!call?.id) return;
    try {
      const ans = await axios.post(`${API}/calls/${call.id}/answer`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setCall((prev) => prev ? { ...prev, room_url: ans.data?.room_url || prev._pending_room || prev.room_url, isIncoming: false, answered: true } : prev);
    } catch (_e) { setCall(null); }
  };
  const handleDecline = async () => {
    if (call?.id) {
      try { await axios.post(`${API}/calls/${call.id}/decline`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (_e) { /* ignore */ }
    }
    setCall(null);
  };
  const handleHangup = async () => {
    if (call?.id) {
      try { await axios.post(`${API}/calls/${call.id}/end`, {}, { headers: { Authorization: `Bearer ${token}` } }); } catch (_e) { /* ignore */ }
    }
    setCall(null);
  };
  // The other side left the Daily room (hung up or lost connection) → close our side too
  const handlePeerLeft = () => { setCall((prev) => { if (prev && prev.answered) { brunoToast.info("Llamada finalizada"); if (prev.id) axios.post(`${API}/calls/${prev.id}/end`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {}); return null; } return prev; }); };

  if (!call) return null;

  return (
    <Suspense fallback={null}>
    <VideoCallModal
      isOpen
      onClose={handleHangup}
      roomUrl={call.room_url}
      remoteUserName={call.peerName}
      remoteAvatarUrl={call.peerAvatar}
      isIncoming={call.isIncoming}
      isRinging={!call.isIncoming && !call.answered}
      onAccept={handleAccept}
      onDecline={handleDecline}
      onPeerLeft={handlePeerLeft}
      callType={call.type}
    />
    </Suspense>
  );
}
