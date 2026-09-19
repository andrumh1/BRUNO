/**
 * CallOrchestrator — global component mounted once at the App level.
 *
 *  • Connects to the chat WebSocket and listens for `incoming_call` events.
 *  • Listens for the `bruno:start-call` custom event from anywhere in the
 *    app (e.g. FloatingChatBubble, ChatHeader) and starts the call.
 *  • Renders the <VideoCallModal> in the right state at the right time.
 */
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import VideoCallModal from "@/components/VideoCallModal";

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
        setCall((prev) => ({
          ...(prev || {}),
          id: startRes.data.call_id,
          room_url: startRes.data.room_url,
          type,
          isIncoming: false,
        }));
      } catch (_err) {
        setCall(null);
      }
    };
    window.addEventListener("bruno:start-call", onStart);
    return () => window.removeEventListener("bruno:start-call", onStart);
  }, [user, token]);

  // Connect to chat WS to listen for incoming calls
  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    const connect = () => {
      try {
        const socket = new WebSocket(`${WS_URL}/api/ws/chat/${token}`);
        wsRef.current = socket;
        socket.onmessage = (event) => {
          if (!alive) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === "incoming_call") {
              setCall({
                id: data.call_id,
                room_url: null,
                type: data.call_type || "video",
                peerName: data.caller_name || "Usuario",
                peerAvatar: data.caller_avatar || null,
                _pending_room: data.room_url,
                isIncoming: true,
              });
            } else if (data.type === "call_answered" && data.call_id) {
              // Peer answered our outgoing call → join the room
              setCall((prev) => (prev && prev.id === data.call_id ? { ...prev, room_url: data.room_url || prev.room_url, isIncoming: false } : prev));
            } else if (data.type === "call_ended" && data.call_id) {
              setCall((prev) => (prev && prev.id === data.call_id ? null : prev));
            }
          } catch (_e) { /* ignore */ }
        };
        socket.onclose = () => {
          if (!alive) return;
          setTimeout(connect, 3000);
        };
        return socket;
      } catch {
        return null;
      }
    };
    const s = connect();
    return () => {
      alive = false;
      try { s?.close?.(); } catch (_e) { /* ignore */ }
    };
  }, [token]);

  // Permission ringtone — best-effort, doesn't break the call if blocked
  useEffect(() => {
    if (!call?.isIncoming) return undefined;
    let audio;
    try {
      audio = new Audio("/ringtone.mp3");
      audio.loop = true;
      audio.play().catch(() => { /* autoplay blocked */ });
    } catch (_e) { /* ignore */ }
    return () => { try { audio?.pause(); } catch (_e) { /* ignore */ } };
  }, [call?.isIncoming]);

  const handleAccept = async () => {
    if (!call?.id) return;
    try {
      const ans = await axios.post(`${API}/calls/${call.id}/answer`, {}, { headers: { Authorization: `Bearer ${token}` } });
      setCall((prev) => prev ? { ...prev, room_url: ans.data?.room_url || prev._pending_room || prev.room_url, isIncoming: false } : prev);
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

  if (!call) return null;

  return (
    <VideoCallModal
      isOpen
      onClose={handleHangup}
      roomUrl={call.room_url}
      remoteUserName={call.peerName}
      remoteAvatarUrl={call.peerAvatar}
      isIncoming={call.isIncoming}
      isConnecting={false}
      onAccept={handleAccept}
      onDecline={handleDecline}
      callType={call.type}
    />
  );
}
