/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from "react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;
const WS_BASE = BACKEND.replace("https://", "wss://").replace("http://", "ws://");

/**
 * useLiveRTC — WebRTC live transport over the /api/lives/{id}/ws signaling socket.
 *  role "host":   localStream → one RTCPeerConnection per viewer (offers).
 *  role "viewer": receives the host's offer → remoteStream.
 * Also surfaces realtime events (comments, hearts, gifts, viewer count).
 */
export function useLiveRTC({ liveId, token, role, accessCode, localStream, enabled = true }) {
  const wsRef = useRef(null);
  const pcs = useRef({});            // peerId → RTCPeerConnection
  const iceRef = useRef([{ urls: "stun:stun.l.google.com:19302" }]);
  const selfId = useRef(null);
  const hostId = useRef(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [connected, setConnected] = useState(false);
  const [hostOnline, setHostOnline] = useState(role === "host");
  const [viewerCount, setViewerCount] = useState(0);
  const [events, setEvents] = useState([]);   // comments + gifts (newest last)
  const [hearts, setHearts] = useState([]);   // transient floating hearts
  const [ended, setEnded] = useState(false);
  const [denied, setDenied] = useState(false);

  const send = useCallback((msg) => { const ws = wsRef.current; if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); }, []);

  const newPc = (peerId) => {
    const pc = new RTCPeerConnection({ iceServers: iceRef.current });
    pc.onicecandidate = (e) => { if (e.candidate) send({ type: "ice", to: peerId, candidate: e.candidate }); };
    pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(pc.connectionState) && role === "host") { pc.close(); delete pcs.current[peerId]; } };
    pcs.current[peerId] = pc;
    return pc;
  };

  const offerTo = async (peerId) => {
    if (!localStream) return;
    pcs.current[peerId]?.close();
    const pc = newPc(peerId);
    localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    send({ type: "offer", to: peerId, sdp: pc.localDescription });
  };

  const handleOffer = async (msg) => {
    const pc = newPc(msg.from);
    pc.ontrack = (e) => { setRemoteStream(e.streams[0]); setHostOnline(true); };
    await pc.setRemoteDescription(msg.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    send({ type: "answer", to: msg.from, sdp: pc.localDescription });
  };

  useEffect(() => {
    if (!enabled || !liveId || !token) return;
    if (role === "host" && !localStream) return;
    const url = `${WS_BASE}/api/lives/${liveId}/ws?token=${encodeURIComponent(token)}${accessCode ? `&code=${encodeURIComponent(accessCode)}` : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = (e) => { setConnected(false); if (e.code === 4003) setDenied(true); };
    ws.onmessage = async (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch (_) { return; }
      switch (msg.type) {
        case "error": if (msg.code === 4003) setDenied(true); break;
        case "welcome":
          selfId.current = msg.self_id; hostId.current = msg.host_id;
          if (msg.rtc_config?.iceServers) iceRef.current = msg.rtc_config.iceServers;
          setViewerCount(msg.viewer_count || 0);
          if (role === "host") (msg.viewers || []).forEach((v) => offerTo(v));
          else send({ type: "request_stream" });
          break;
        case "viewer_joined":
          setViewerCount(msg.viewer_count ?? 0);
          if (role === "host" && msg.viewer?.id) offerTo(msg.viewer.id);
          setEvents((p) => [...p.slice(-80), { id: `j-${Date.now()}`, kind: "join", user_name: msg.viewer?.name }]);
          break;
        case "viewer_left":
          setViewerCount(msg.viewer_count ?? 0);
          pcs.current[msg.viewer_id]?.close(); delete pcs.current[msg.viewer_id];
          break;
        case "host_online": setHostOnline(true); send({ type: "request_stream" }); break;
        case "host_offline": setHostOnline(false); setRemoteStream(null); break;
        case "offer": if (role === "viewer") await handleOffer(msg); break;
        case "answer": { const pc = pcs.current[msg.from]; if (pc) await pc.setRemoteDescription(msg.sdp).catch(() => {}); break; }
        case "ice": { const pc = pcs.current[msg.from]; if (pc && msg.candidate) await pc.addIceCandidate(msg.candidate).catch(() => {}); break; }
        case "new_comment": setEvents((p) => [...p.slice(-80), { kind: "comment", ...msg.comment }]); break;
        case "new_gift": setEvents((p) => [...p.slice(-80), { kind: "gift", id: msg.gift.id, user_name: msg.gift.sender_name, gift_type: msg.gift.gift_type, amount: msg.gift.amount }]); break;
        case "heart": { const id = `${Date.now()}-${Math.random()}`; setHearts((p) => [...p.slice(-20), { id, dx: Math.round(Math.random() * 80 - 40) }]); setTimeout(() => setHearts((p) => p.filter((h) => h.id !== id)), 2500); break; }
        case "live_ended": setEnded(true); break;
        default: break;
      }
    };
    const ping = setInterval(() => send({ type: "ping" }), 25000);
    return () => {
      clearInterval(ping);
      Object.values(pcs.current).forEach((pc) => pc.close()); pcs.current = {};
      try { ws.close(); } catch (_) { /* ignore */ }
      wsRef.current = null;
    };
  }, [liveId, token, role, accessCode, localStream, enabled]);

  const sendHeart = useCallback(() => send({ type: "heart" }), [send]);

  return { remoteStream, connected, hostOnline, viewerCount, events, hearts, ended, denied, sendHeart };
}
