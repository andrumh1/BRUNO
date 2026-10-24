const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "mkv", "avi", "ogv", "3gp", "qt", "hevc"];

// Fallback only; the real per-file limit comes from the storage plan via GET /api/upload/limits (see setVideoLimit).
export let MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const setVideoLimit = (bytes) => { if (bytes > 0) MAX_VIDEO_BYTES = bytes; };
export const videoLimitMb = () => Math.round(MAX_VIDEO_BYTES / (1024 * 1024));

export const fileExt = (file) => {
  const name = (file?.name || "").toLowerCase();
  return name.includes(".") ? name.split(".").pop() : "";
};

// Mobile galleries (iOS .MOV, Android octet-stream) often ship files with an empty MIME type.
export const isVideoFile = (file) =>
  !!file && ((file.type || "").startsWith("video") || VIDEO_EXTS.includes(fileExt(file)));

const IMAGE_BRANDS = ["heic", "heix", "hevc", "hevx", "mif1", "msf1", "avif", "avis"];

/** Lee la cabecera del archivo cuando no hay MIME ni extensión (p. ej. selector de fotos de Android): "video" | "image" | null. */
export const sniffMediaKind = async (file) => {
  if (!file) return null;
  if (isVideoFile(file)) return "video";
  if ((file.type || "").startsWith("image")) return "image";
  try {
    const b = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const ascii = (from, len) => String.fromCharCode(...b.slice(from, from + len));
    if (b[0] === 0xff && b[1] === 0xd8) return "image"; // JPEG
    if (b[0] === 0x89 && ascii(1, 3) === "PNG") return "image";
    if (ascii(0, 3) === "GIF") return "image";
    if (ascii(0, 4) === "RIFF") return ascii(8, 4) === "WEBP" ? "image" : ascii(8, 4) === "AVI " ? "video" : null;
    if (ascii(4, 4) === "ftyp") return IMAGE_BRANDS.includes(ascii(8, 4).toLowerCase().trim()) ? "image" : "video"; // MP4 / MOV / 3GP / M4V vs HEIC/AVIF
    if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video"; // WebM / MKV
    if (ascii(0, 4) === "OggS") return "video";
  } catch { /* ignore */ }
  return null;
};

export const UNSUPPORTED_MEDIA_MSG = "No reconocemos este archivo como foto o video. Elige un MP4, MOV, WebM, JPG, PNG o HEIC.";
export const PREVIEW_UNAVAILABLE_MSG = "Este navegador no puede reproducir la vista previa de este formato (p. ej. MOV/HEVC). Puedes publicar igual: el video se convierte automáticamente a MP4.";

export const videoTooLarge = (file) => isVideoFile(file) && file.size > MAX_VIDEO_BYTES;

// Size is the limit, never duration: a 3-hour video fits if its bitrate keeps it under the plan's per-file cap.
export const videoTooLargeMsg = () => `El video supera los ${videoLimitMb()} MB que permite el plan de almacenamiento actual (la duración no es el límite). Baja la calidad o exporta a menor bitrate.`;
export const VIDEO_TOO_LARGE_MSG = videoTooLargeMsg();
