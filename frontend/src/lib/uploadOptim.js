// Comprime fotos en el dispositivo antes de subirlas (clave en redes lentas). Mantiene PNG/GIF/SVG intactos salvo reescalado de PNG grandes.
const MAX_SIDE = 2048;
const MIN_BYTES = 900 * 1024;
const SKIP = /gif|svg|heic|heif|avif/i;

async function compressImage(file) {
  if (!/^image\//.test(file.type) || SKIP.test(file.type) || file.size < MIN_BYTES || typeof createImageBitmap !== "function") return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    if (scale === 1 && file.type === "image/png") { bmp.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const isPng = file.type === "image/png";
    const blob = await new Promise((res) => canvas.toBlob(res, isPng ? "image/png" : "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    const name = isPng ? file.name : (file.name || "foto").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    return new File([blob], name, { type: blob.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function compressFormDataImages(fd) {
  if (!(typeof FormData !== "undefined" && fd instanceof FormData)) return fd;
  const entries = [...fd.entries()];
  if (!entries.some(([, v]) => v instanceof File && /^image\//.test(v.type) && v.size >= MIN_BYTES)) return fd;
  const out = new FormData();
  for (const [k, v] of entries) {
    out.append(k, v instanceof File ? await compressImage(v) : v);
  }
  return out;
}

// Tamaño de trozo para subidas resumibles según la red (Cloudinary exige ≥ 5 MB por trozo).
export function adaptiveChunkBytes(defaultBytes) {
  const c = navigator.connection || {};
  const mb = 1024 * 1024;
  if (c.saveData || /2g|slow-2g/.test(c.effectiveType || "") || (c.downlink && c.downlink < 1.5)) return Math.min(defaultBytes, 5 * mb);
  if (c.effectiveType === "3g" || (c.downlink && c.downlink < 5)) return Math.min(defaultBytes, 6 * mb);
  if (c.downlink && c.downlink < 10) return Math.min(defaultBytes, 10 * mb);
  return defaultBytes;
}
