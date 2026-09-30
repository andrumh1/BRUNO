/* Marca de agua BRUNO en cliente (fallback): reproduce el video en un canvas, dibuja el sello y graba con MediaRecorder. */
import { getCustomSeal } from "@/lib/shareHistory";
const loadImg = (src) => new Promise((res) => { const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });

export const canWatermarkInBrowser = () => typeof MediaRecorder !== "undefined" && !!HTMLCanvasElement.prototype.captureStream;

export async function watermarkVideo(url, { onProgress } = {}) {
  const video = document.createElement("video");
  video.crossOrigin = "anonymous"; video.muted = false; video.playsInline = true; video.preload = "auto"; video.src = url;
  await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("No se pudo cargar el video")); });
  const [bear, seal] = await Promise.all([loadImg("/brand/icon-white.png"), loadImg(getCustomSeal())]);
  const c = document.createElement("canvas"); c.width = video.videoWidth || 720; c.height = video.videoHeight || 1280;
  const ctx = c.getContext("2d");
  const stream = c.captureStream(30);
  try { const a = video.captureStream?.(); a?.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch { /* sin audio */ }
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 4_000_000 } : undefined);
  const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || "video/webm" })); });

  const bw = Math.round(c.width * 0.16), bh = bear ? Math.round(bw * bear.height / bear.width) : 0, pad = Math.round(c.width * 0.04);
  const draw = () => {
    ctx.drawImage(video, 0, 0, c.width, c.height);
    ctx.save(); ctx.globalAlpha = 0.75; ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 12;
    if (bear) ctx.drawImage(bear, c.width - bw - pad, c.height - bh - pad, bw, bh);
    ctx.font = `700 ${Math.round(c.width * 0.032)}px Inter, system-ui, sans-serif`; ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.fillText("BRUNO", c.width - pad, c.height - bh - pad - 6); ctx.restore();
    if (seal) { const sw = Math.round(c.width * 0.13), sh = Math.round(sw * seal.height / seal.width); ctx.save(); ctx.globalAlpha = 0.85; ctx.drawImage(seal, pad, c.height - sh - pad, sw, sh); ctx.restore(); }
    onProgress?.(video.duration ? video.currentTime / video.duration : 0);
  };
  let raf;
  const loop = () => { draw(); if (!video.ended) raf = requestAnimationFrame(loop); };
  rec.start(250);
  await video.play();
  loop();
  await new Promise((res) => { video.onended = res; });
  cancelAnimationFrame(raf); draw(); rec.stop();
  const blob = await done;
  return { blob, ext: (rec.mimeType || "").includes("mp4") ? "mp4" : "webm" };
}
