import { useRef, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

/** Dictado (Whisper vía clave Emergent) y lectura en voz alta (TTS) para el buscador. */
export function useVoiceSearch({ token, onText }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const recRef = useRef(null);
  const audioRef = useRef(null);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined";

  const toggleRecording = async () => {
    setError("");
    if (!token) { setError("Inicia sesión para dictar"); return; }
    if (recording) { recRef.current?.stop(); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        if (!chunks.length) return;
        setTranscribing(true);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          const fd = new FormData();
          fd.append("file", blob, `voz.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`);
          const r = await axios.post(`${API}/ai/transcribe`, fd, { headers: { Authorization: `Bearer ${token}` } });
          const text = (r.data?.text || "").trim().replace(/[.。]$/, "");
          if (text) onText(text); else setError("No se entendió el audio");
        } catch (e) { setError(e?.response?.data?.detail || "No se pudo transcribir"); }
        finally { setTranscribing(false); }
      };
      recRef.current = rec; rec.start(); setRecording(true);
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 15000);
    } catch { setError("No hay acceso al micrófono"); }
  };

  const speak = async (text) => {
    if (speaking) { audioRef.current?.pause(); setSpeaking(false); return; }
    try {
      setSpeaking(true);
      const res = await fetch(`${API}/ai/speak`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ text: String(text).replace(/\[\d+\]/g, "").slice(0, 1500), voice: "nova" }) });
      if (!res.ok) throw new Error("tts");
      const url = URL.createObjectURL(await res.blob());
      const a = new Audio(url); audioRef.current = a;
      a.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
      a.onerror = () => setSpeaking(false);
      await a.play();
    } catch { setSpeaking(false); setError("No se pudo reproducir la voz"); }
  };

  return { supported, recording, transcribing, speaking, error, toggleRecording, speak };
}
