const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "mkv", "avi", "ogv", "3gp", "qt", "hevc"];

export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export const fileExt = (file) => {
  const name = (file?.name || "").toLowerCase();
  return name.includes(".") ? name.split(".").pop() : "";
};

// Mobile galleries (iOS .MOV, Android octet-stream) often ship files with an empty MIME type.
export const isVideoFile = (file) =>
  !!file && ((file.type || "").startsWith("video") || VIDEO_EXTS.includes(fileExt(file)));

export const videoTooLarge = (file) => isVideoFile(file) && file.size > MAX_VIDEO_BYTES;

export const VIDEO_TOO_LARGE_MSG = "El video supera los 100 MB. Recórtalo o bájale la calidad e inténtalo de nuevo.";
