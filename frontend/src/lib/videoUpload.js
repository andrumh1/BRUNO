import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const STATE_PREFIX = "bruno_vup_";
const MAX_RETRIES = 4;

const fileKey = (file) => `${STATE_PREFIX}${file.name || "blob"}_${file.size}_${file.lastModified || 0}`;
const loadState = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const saveState = (k, s) => { try { localStorage.setItem(k, JSON.stringify(s)); } catch { /* ignore */ } };
const clearState = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let limitsCache = null;
export const getUploadLimits = async (token) => {
  if (limitsCache) return limitsCache;
  const r = await axios.get(`${API}/upload/limits`, { headers: { Authorization: `Bearer ${token}` } });
  limitsCache = r.data;
  return limitsCache;
};

const sendChunk = async ({ uploadUrl, params, uploadId, file, start, end, onProgress, signal }) => {
  const fd = new FormData();
  Object.entries(params).forEach(([k, v]) => fd.append(k, v));
  fd.append("file", file.slice(start, end), file.name || "video");
  const r = await axios.post(uploadUrl, fd, {
    headers: { "X-Unique-Upload-Id": uploadId, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` },
    timeout: 0, signal,
    onUploadProgress: (e) => onProgress?.(start + (e.loaded || 0)),
  });
  return r.data;
};

/**
 * Direct, chunked, resumable upload browser → Cloudinary (the file never passes through BRUNO's server).
 * - 20 MB chunks, each retried with backoff; progress and the signed session survive a reload (same file → resumes).
 * - When the last chunk lands, BRUNO verifies the asset and returns the media descriptor (mp4/poster/hls, duration).
 * Errors carry `.userMessage` for the UI.
 */
export async function uploadVideoDirect(file, { token, folder = "bruno", trim, coverAt, overlays, onProgress, signal } = {}) {
  const key = fileKey(file);
  let st = loadState(key);
  const fresh = !st || Date.now() - st.at > 50 * 60 * 1000 || st.size !== file.size;
  if (fresh) {
    const r = await axios.post(`${API}/upload/video/sign`, null, { params: { folder, size: file.size }, headers: { Authorization: `Bearer ${token}` } });
    st = { ...r.data, offset: 0, at: Date.now(), size: file.size };
    saveState(key, st);
  }
  const chunk = st.chunk_bytes || 20 * 1024 * 1024;
  let result = null;
  const report = (loaded, phase = "upload") => onProgress?.({ loaded, total: file.size, pct: Math.min(99, Math.round((loaded * 100) / file.size)), phase, resumed: !fresh });
  report(st.offset);
  while (st.offset < file.size) {
    const end = Math.min(file.size, st.offset + chunk);
    let attempt = 0;
    for (;;) {
      try {
        result = await sendChunk({ uploadUrl: st.upload_url, params: st.params, uploadId: st.upload_id, file, start: st.offset, end, onProgress: (l) => report(l), signal });
        break;
      } catch (e) {
        if (signal?.aborted || e?.code === "ERR_CANCELED") throw Object.assign(new Error("cancelled"), { userMessage: "Subida cancelada" });
        const status = e?.response?.status;
        const msg = e?.response?.data?.error?.message || "";
        if (status === 400 && /too large|File size/i.test(msg)) { clearState(key); throw Object.assign(e, { userMessage: `El almacenamiento rechazó el archivo: ${msg}` }); }
        if (status === 401 || (status === 400 && /Stale|signature|timestamp/i.test(msg))) { clearState(key); throw Object.assign(e, { userMessage: "La sesión de subida caducó. Vuelve a intentarlo para reanudar." }); }
        if (++attempt > MAX_RETRIES) throw Object.assign(e, { userMessage: "Se perdió la conexión varias veces. Pulsa Reintentar: continuará donde se quedó." });
        onProgress?.({ loaded: st.offset, total: file.size, pct: Math.round((st.offset * 100) / file.size), phase: "retry", attempt });
        await sleep(800 * 2 ** (attempt - 1));
      }
    }
    st.offset = end; saveState(key, st);
  }
  if (!result?.public_id) { clearState(key); throw Object.assign(new Error("no public_id"), { userMessage: "El almacenamiento no confirmó el video. Inténtalo de nuevo." }); }
  report(file.size, "process");
  const params = { ...(trim?.start > 0 ? { trim_start: trim.start.toFixed(2) } : {}), ...(trim?.end > 0 ? { trim_end: trim.end.toFixed(2) } : {}), ...(coverAt != null ? { cover_at: coverAt.toFixed(2) } : {}) };
  const done = await axios.post(`${API}/upload/video/complete`, { public_id: result.public_id, overlays: overlays || [] }, { params, headers: { Authorization: `Bearer ${token}` } });
  clearState(key);
  return done.data;
}

export const fmtBytes = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : `${Math.round(b / 1024 ** 2)} MB`);
