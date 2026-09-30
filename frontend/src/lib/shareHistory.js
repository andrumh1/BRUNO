/* Historial de imágenes generadas (IndexedDB, últimas 12) para volver a compartir sin regenerar. */
const DB = "bruno_share_history", STORE = "images", MAX = 12;

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: "id" });
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => { const db = await open(); return new Promise((res, rej) => { const t = db.transaction(STORE, mode); const out = fn(t.objectStore(STORE)); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); }); };

export async function listHistory() {
  try { const all = await tx("readonly", (s) => s.getAll()); return (all || []).sort((a, b) => b.createdAt - a.createdAt); } catch { return []; }
}
export async function saveToHistory({ blob, name, kind, label, link, text }) {
  try {
    const item = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, blob, name, kind, label, link, text, createdAt: Date.now() };
    await tx("readwrite", (s) => s.put(item));
    const all = await listHistory();
    for (const old of all.slice(MAX)) await tx("readwrite", (s) => s.delete(old.id));
    return item;
  } catch { return null; }
}
export async function removeFromHistory(id) { try { await tx("readwrite", (s) => s.delete(id)); } catch { /* ignore */ } }

/* Sello personalizado (Premium): URL del logo del usuario. */
export const SEAL_KEY = "bruno_custom_seal";
export const getCustomSeal = () => { try { return localStorage.getItem(SEAL_KEY) || ""; } catch { return ""; } };
export const setCustomSeal = (url) => { try { url ? localStorage.setItem(SEAL_KEY, url) : localStorage.removeItem(SEAL_KEY); } catch { /* ignore */ } };
