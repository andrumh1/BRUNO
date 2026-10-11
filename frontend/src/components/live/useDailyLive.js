/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useRef, useState } from "react";
import Daily from "@daily-co/daily-js";

/**
 * useDailyLive — transporte de audio/video del live sobre Daily.co (SFU).
 *  host:   publica cámara + micrófono (token owner, canSend).
 *  viewer: solo recibe (token canSend=false) → remoteStream del anfitrión.
 * Expone estado de red para mostrar "Reconectando…" y controles de dispositivos.
 */
export function useDailyLive({ url, token, role, hostId, enabled = true }) {
  const callRef = useRef(null);
  const [state, setState] = useState("idle"); // idle | connecting | connected | interrupted | left | error
  const [quality, setQuality] = useState("good");
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [participants, setParticipants] = useState(0);
  const [devices, setDevices] = useState({ cameras: [], mics: [] });
  const [error, setError] = useState(null);
  const [remoteParticipants, setRemoteParticipants] = useState([]); // invitados (y anfitrión si soy invitado)
  const publish = role === "host" || role === "guest";

  const syncTracks = useCallback(() => {
    const call = callRef.current; if (!call) return;
    const all = call.participants();
    setParticipants(Object.keys(all).length);
    const local = all.local;
    setRemoteParticipants(Object.values(all).filter((p) => !p.local && p.user_id !== hostId && p.tracks?.video?.persistentTrack).map((p) => ({ id: p.user_id || p.session_id, name: p.user_name, stream: new MediaStream([p.tracks.video.persistentTrack, p.tracks?.audio?.persistentTrack].filter(Boolean)) })));
    if (publish && local) {
      const tracks = [local.tracks?.video?.persistentTrack, local.tracks?.audio?.persistentTrack].filter(Boolean);
      setLocalStream((prev) => (prev && tracks.every((t) => prev.getTracks().includes(t)) && prev.getTracks().length === tracks.length ? prev : tracks.length ? new MediaStream(tracks) : null));
    }
    if (role !== "host") {
      const host = Object.values(all).find((p) => !p.local && (p.user_id === hostId || p.owner));
      const tracks = host ? [host.tracks?.video?.persistentTrack, host.tracks?.audio?.persistentTrack].filter(Boolean) : [];
      setRemoteStream((prev) => (prev && tracks.length && tracks.every((t) => prev.getTracks().includes(t)) && prev.getTracks().length === tracks.length ? prev : tracks.length ? new MediaStream(tracks) : null));
    }
  }, [role, hostId]);

  useEffect(() => {
    if (!enabled || !url || !token) return;
    let destroyed = false;
    let call = null;
    (async () => {
      // Daily permite una sola instancia: si quedó una viva (reload, re-render rápido) la cerramos antes de crear otra.
      const prev = Daily.getCallInstance?.();
      if (prev) { try { await prev.leave(); } catch (_) { /* ignore */ } try { await prev.destroy(); } catch (_) { /* ignore */ } }
      if (destroyed) return;
      call = Daily.createCallObject({ subscribeToTracksAutomatically: true });
      callRef.current = call;
      setState("connecting"); setError(null);
      call.on("joined-meeting", () => { setState("connected"); syncTracks(); if (publish) call.enumerateDevices().then((d) => setDevices({ cameras: d.devices.filter((x) => x.kind === "videoinput"), mics: d.devices.filter((x) => x.kind === "audioinput") })).catch(() => {}); })
        .on("participant-joined", syncTracks).on("participant-updated", syncTracks).on("participant-left", syncTracks).on("track-started", syncTracks).on("track-stopped", syncTracks)
        .on("network-connection", (e) => { if (e.event === "interrupted") setState("interrupted"); else if (e.event === "connected") setState("connected"); })
        .on("network-quality-change", (e) => setQuality(e.threshold || e.networkState || "good"))
        .on("left-meeting", () => setState("left"))
        .on("error", (e) => { setState("error"); setError(e?.errorMsg || "Error de conexión con el servidor de video"); })
        .on("camera-error", (e) => setError(e?.errorMsg?.errorMsg || "No se pudo acceder a la cámara o el micrófono"));
      call.join({ url, token, startVideoOff: !publish, startAudioOff: !publish }).catch((e) => { if (!destroyed) { setState("error"); setError(e?.message || "No se pudo conectar"); } });
    })();
    return () => { destroyed = true; callRef.current = null; if (call) call.leave().catch(() => {}).finally(() => call.destroy()); };
  }, [url, token, role, enabled]);

  const setMic = useCallback((on) => callRef.current?.setLocalAudio(on), []);
  const setCam = useCallback((on) => callRef.current?.setLocalVideo(on), []);
  const cycleCamera = useCallback(() => callRef.current?.cycleCamera({ preferDifferentFacingMode: true }), []);
  const setVideoDevice = useCallback((videoDeviceId) => callRef.current?.setInputDevicesAsync({ videoDeviceId }), []);
  const setAudioDevice = useCallback((audioDeviceId) => callRef.current?.setInputDevicesAsync({ audioDeviceId }), []);

  return { state, quality, error, localStream, remoteStream, remoteParticipants, participants, devices, setMic, setCam, cycleCamera, setVideoDevice, setAudioDevice };
}
