import axios from "axios";

export const SMART_API = `${process.env.REACT_APP_BACKEND_URL}/api/smart`;
export const auth = (tk) => (tk ? { headers: { Authorization: `Bearer ${tk}` } } : {});
export const errText = (e, fb) => { const d = e?.response?.data?.detail; if (!d) return fb; return typeof d === "string" ? d : d.message || fb; };
export const fmtBytes = (b = 0) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(b % 1024 ** 3 ? 1 : 0)} GB` : `${Math.round(b / 1024 ** 2)} MB`);
export const fmtDate = (d) => { if (!d) return ""; try { return new Date(d).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: d.includes("T") ? "short" : undefined }); } catch { return d; } };

export const api = {
  settings: () => axios.get(`${SMART_API}/settings`).then((r) => r.data),
  adminSettings: (tk) => axios.get(`${SMART_API}/admin/settings`, auth(tk)).then((r) => r.data),
  saveSettings: (tk, patch) => axios.put(`${SMART_API}/admin/settings`, patch, auth(tk)).then((r) => r.data),
  grant: (tk, id) => axios.post(`${SMART_API}/admin/events/${id}/grant`, {}, auth(tk)).then((r) => r.data),
  mine: (tk) => axios.get(`${SMART_API}/events/mine`, auth(tk)).then((r) => r.data),
  create: (tk, body) => axios.post(`${SMART_API}/events`, body, auth(tk)).then((r) => r.data),
  update: (tk, id, body) => axios.put(`${SMART_API}/events/${id}`, body, auth(tk)).then((r) => r.data),
  manage: (tk, id) => axios.get(`${SMART_API}/events/${id}/manage`, auth(tk)).then((r) => r.data),
  publish: (tk, id) => axios.post(`${SMART_API}/events/${id}/publish`, {}, auth(tk)).then((r) => r.data),
  invite: (tk, id, body) => axios.post(`${SMART_API}/events/${id}/invitations`, body, auth(tk)).then((r) => r.data),
  removeInvite: (tk, id, iid) => axios.delete(`${SMART_API}/events/${id}/invitations/${iid}`, auth(tk)).then((r) => r.data),
  respond: (tk, iid, body) => axios.post(`${SMART_API}/invitations/${iid}/respond`, body, auth(tk)).then((r) => r.data),
  publicEvent: (id, tk) => axios.get(`${SMART_API}/events/${id}/public`, auth(tk)).then((r) => r.data),
  publicInvitation: (iid, tk) => axios.get(`${SMART_API}/invitations/${iid}/public`, auth(tk)).then((r) => r.data),
  photos: (id, before) => axios.get(`${SMART_API}/events/${id}/photos`, { params: { before } }).then((r) => r.data),
  upload: (tk, id, file, caption, onProgress) => { const fd = new FormData(); fd.append("file", file); fd.append("caption", caption || ""); return axios.post(`${SMART_API}/events/${id}/photos`, fd, { ...auth(tk), onUploadProgress: (p) => onProgress?.(Math.round((p.loaded / (p.total || 1)) * 100)) }).then((r) => r.data); },
  deletePhoto: (tk, id, pid) => axios.delete(`${SMART_API}/events/${id}/photos/${pid}`, auth(tk)).then((r) => r.data),
  connections: (cardId) => axios.get(`${SMART_API}/cards/${cardId}/connections`).then((r) => r.data),
  checkout: (tk, id, body) => axios.post(`${SMART_API}/events/${id}/checkout`, body, auth(tk)).then((r) => r.data),
  paymentStatus: (tk, id, params) => axios.get(`${SMART_API}/events/${id}/payment-status`, { ...auth(tk), params }).then((r) => r.data),
};

/* Rastro de navegación entre tarjetas/eventos para "volver a la tarjeta anterior". */
const TRAIL = "bruno_card_trail";
export const pushTrail = (entry) => { try { const t = JSON.parse(sessionStorage.getItem(TRAIL) || "[]"); if (t[t.length - 1]?.path !== entry.path) t.push(entry); sessionStorage.setItem(TRAIL, JSON.stringify(t.slice(-12))); } catch { /* ignore */ } };
export const popTrail = (currentPath) => { try { const t = JSON.parse(sessionStorage.getItem(TRAIL) || "[]"); while (t.length && t[t.length - 1].path === currentPath) t.pop(); const prev = t.pop(); sessionStorage.setItem(TRAIL, JSON.stringify(t)); return prev || null; } catch { return null; } };
export const peekTrail = (currentPath) => { try { const t = JSON.parse(sessionStorage.getItem(TRAIL) || "[]").filter((x) => x.path !== currentPath); return t[t.length - 1] || null; } catch { return null; } };
