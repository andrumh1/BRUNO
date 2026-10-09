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

export const videoTooLarge = (file) => isVideoFile(file) && file.size > MAX_VIDEO_BYTES;

// Size is the limit, never duration: a 3-hour video fits if its bitrate keeps it under the plan's per-file cap.
export const videoTooLargeMsg = () => `El video supera los ${videoLimitMb()} MB que permite el plan de almacenamiento actual (la duración no es el límite). Baja la calidad o exporta a menor bitrate.`;
export const VIDEO_TOO_LARGE_MSG = videoTooLargeMsg();
