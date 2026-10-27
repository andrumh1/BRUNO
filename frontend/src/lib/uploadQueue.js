// Cola de publicaciones en segundo plano: el video sigue subiendo mientras el usuario navega por BRUNO.
import axios from "axios";
import { useSyncExternalStore } from "react";
import { uploadVideoDirect } from "@/lib/videoUpload";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
let jobs = [];
const listeners = new Set();
const emit = () => { jobs = [...jobs]; listeners.forEach((l) => l()); };
const patch = (id, data) => { const j = jobs.find((x) => x.id === id); if (j) Object.assign(j, data); emit(); };

export const subscribeUploads = (l) => { listeners.add(l); return () => listeners.delete(l); };
export const getUploads = () => jobs;
export const useUploads = () => useSyncExternalStore(subscribeUploads, getUploads, getUploads);
export const dismissUpload = (id) => { jobs = jobs.filter((j) => j.id !== id); emit(); };
export const hasActiveUploads = () => jobs.some((j) => ["uploading", "processing", "publishing"].includes(j.status));

window.addEventListener("beforeunload", (e) => { if (hasActiveUploads()) { e.preventDefault(); e.returnValue = ""; } });

async function run(job) {
  const { token, file, trim, coverAt, overlays, body, draftId, liveId, preUploaded } = job.input;
  try {
    patch(job.id, { status: preUploaded ? "publishing" : "uploading", pct: preUploaded ? 100 : 0, error: null });
    const up = preUploaded || await uploadVideoDirect(file, {
      token, trim, coverAt, overlays,
      onProgress: (p) => patch(job.id, { pct: p.pct ?? 0, status: p.phase === "process" || (p.pct ?? 0) >= 99 ? "processing" : "uploading", loaded: p.loaded, total: p.total }),
    });
    patch(job.id, { status: "publishing", pct: 100, up });
    const created = await axios.post(`${API}/posts`, { ...body, media: [{ type: "video", url: up.url, mp4_url: up.mp4_url, poster_url: up.poster_url, f_auto_url: up.f_auto_url }] }, { headers: { Authorization: `Bearer ${token}` } });
    const postId = created.data?.id || null;
    if (draftId) axios.delete(`${API}/post-drafts/${draftId}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    if (liveId && postId) axios.post(`${API}/lives/${liveId}/replay-published`, { post_id: postId }, { headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    patch(job.id, { status: "done", postId, finishedAt: Date.now() });
    const { brunoToast } = await import("@/components/bruno/BrunoToast");
    brunoToast.publish("Reel publicado", { description: "Ya aparece en tu perfil, el feed y Reels.", action: { label: "Ver", onClick: () => window.dispatchEvent(new CustomEvent("bruno:navigate", { detail: `/reels?id=${postId || ""}` })) } });
    setTimeout(() => { if (jobs.find((j) => j.id === job.id)?.status === "done") dismissUpload(job.id); }, 12_000);
  } catch (err) {
    const msg = err?.userMessage || err?.response?.data?.detail || "Falló la subida. Tu video sigue aquí: puedes reintentar.";
    patch(job.id, { status: "error", error: typeof msg === "string" ? msg : "No se pudo publicar." });
    const { brunoToast } = await import("@/components/bruno/BrunoToast");
    brunoToast.error("No se pudo publicar el video", { description: typeof msg === "string" ? msg : undefined, action: { label: "Reintentar", onClick: () => retryUpload(job.id) } });
  }
}

export function enqueueVideoPost(input) {
  const job = { id: `up_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, status: "uploading", pct: 0, error: null, postId: null, input, title: input.body?.content?.slice(0, 40) || "Video", poster: input.posterDataUrl || null, createdAt: Date.now() };
  jobs = [...jobs, job]; emit();
  run(job);
  return job.id;
}

export const retryUpload = (id) => { const j = jobs.find((x) => x.id === id); if (j && j.status === "error") { if (j.up) j.input.preUploaded = j.up; run(j); } };
