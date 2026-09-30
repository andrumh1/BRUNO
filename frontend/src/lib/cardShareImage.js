/* Genera una imagen de una tarjeta/perfil BRUNO con el sello corporativo.
   format: "story" 1080×1920 (IG/WhatsApp) · "square" 1080×1080 (feed IG/Facebook/TikTok/LinkedIn). */
import QRCode from "qrcode";
import { getCustomSeal } from "@/lib/shareHistory";
const FORMATS = { story: { W: 1080, H: 1920, cy: 300, ch: 1180 }, square: { W: 1080, H: 1080, cy: 70, ch: 800 } };
const ORANGE = "#ff6a00", CREAM = "#f9f1ea", GRAY = "#474747";

const loadImg = (src) => new Promise((res) => {
  if (!src) return res(null);
  const im = new Image(); im.crossOrigin = "anonymous";
  im.onload = () => res(im); im.onerror = () => res(null); im.src = src;
});
const lum = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return 0; const n = parseInt(m[1], 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
const wrap = (ctx, text, maxW, maxLines) => {
  const words = String(text || "").split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const t = cur ? `${cur} ${w}` : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = lines[maxLines - 1].replace(/\s?\S*$/, "…"); }
  return lines;
};
const cover = (ctx, im, x, y, w, h) => { const s = Math.max(w / im.width, h / im.height); const dw = im.width * s, dh = im.height * s; ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); };

export async function renderCardImage(card, { qr, url, dark = false, format = "story", bgColor, phrase } = {}) {
  if (bgColor) card = { ...card, background_color: bgColor, text_color: lum(bgColor) > 0.72 ? GRAY : "#ffffff" };
  if (phrase) card = { ...card, description: phrase };
  const F = FORMATS[format] || FORMATS.story; const W = F.W, H = F.H;
  if (!qr && url) { try { qr = await QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#474747", light: "#ffffff" } }); } catch { /* sin QR */ } }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const rawBg = card.background_color || ORANGE;
  const light = lum(rawBg) > 0.72;
  const bg = dark && light ? GRAY : rawBg;
  const fg = dark && light ? CREAM : (card.text_color || "#ffffff");
  const [avatar, banner, bear, wordmark, qrImg, seal] = await Promise.all([
    loadImg(card.avatar_url), loadImg(card.banner_url), loadImg("/brand/icon-white.png"), loadImg("/brand/logo-h-white.png"), loadImg(qr), loadImg(getCustomSeal()),
  ]);

  // Fondo: gris/crema corporativo con glow del color de la tarjeta
  ctx.fillStyle = dark ? "#333333" : CREAM; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.4, 80, W / 2, H * 0.4, W * 0.85); glow.addColorStop(0, `${bg}66`); glow.addColorStop(1, `${bg}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Tarjeta
  const cx = 90, cy = F.cy, cw = W - 180, ch = F.ch, r = 56;
  ctx.save(); ctx.shadowColor = "rgba(71,71,71,.35)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rr(ctx, cx, cy, cw, ch, r); const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch); g.addColorStop(0, bg); g.addColorStop(1, `${bg}ee`); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, cx, cy, cw, ch, r); ctx.clip();
  if (banner) { cover(ctx, banner, cx, cy, cw, 300); const bg2 = ctx.createLinearGradient(0, cy, 0, cy + 300); bg2.addColorStop(0, "rgba(0,0,0,.05)"); bg2.addColorStop(1, `${bg}`); ctx.fillStyle = bg2; ctx.fillRect(cx, cy, cw, 300); }
  else { ctx.fillStyle = `${fg}14`; ctx.fillRect(cx, cy, cw, 300); }
  ctx.restore();

  // Avatar
  const sq = format === "square";
  const ax = cx + 70, ay = cy + (sq ? 120 : 190), as = sq ? 200 : 240;
  ctx.save(); rr(ctx, ax, ay, as, as, 48); ctx.fillStyle = light || dark ? "#ffffff" : CREAM; ctx.fill(); ctx.clip();
  if (avatar) cover(ctx, avatar, ax, ay, as, as);
  else if (bear) { ctx.fillStyle = CREAM; ctx.fillRect(ax, ay, as, as); const bw = as * 0.62, bh = bw * bear.height / bear.width; ctx.save(); ctx.globalCompositeOperation = "source-over"; ctx.drawImage(tint(bear, ORANGE), ax + (as - bw) / 2, ay + (as - bh) / 2, bw, bh); ctx.restore(); }
  ctx.restore(); ctx.save(); rr(ctx, ax, ay, as, as, 48); ctx.lineWidth = 10; ctx.strokeStyle = bg; ctx.stroke(); ctx.restore();

  // Textos
  ctx.fillStyle = fg; ctx.textBaseline = "top";
  ctx.font = "800 72px Inter, system-ui, sans-serif";
  let y = ay + as + 60;
  for (const line of wrap(ctx, card.title || "BRUNO", cw - 140, 2)) { ctx.fillText(line, cx + 70, y); y += 84; }
  if (card.subtitle) { ctx.font = "600 40px Inter, system-ui, sans-serif"; ctx.globalAlpha = .9; for (const line of wrap(ctx, card.subtitle, cw - 140, 2)) { ctx.fillText(line, cx + 70, y + 8); y += 52; } ctx.globalAlpha = 1; y += 10; }
  if (card.description) { ctx.font = "400 34px Inter, system-ui, sans-serif"; ctx.globalAlpha = .82; for (const line of wrap(ctx, card.description, sq ? cw - 440 : cw - 140, sq ? 3 : 4)) { ctx.fillText(line, cx + 70, y + 14); y += 46; } ctx.globalAlpha = 1; }

  // QR + url
  const qs = sq ? 220 : 260, qx = cx + cw - 70 - qs, qy = cy + ch - 90 - qs - (sq ? 30 : 70);
  if (qrImg) { ctx.save(); rr(ctx, qx - 16, qy - 16, qs + 32, qs + 32, 28); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.restore(); ctx.drawImage(qrImg, qx, qy, qs, qs); }
  if (url) {
    ctx.font = "500 28px Inter, system-ui, sans-serif"; ctx.fillStyle = fg; ctx.globalAlpha = .85;
    const maxW = (qrImg ? qx - 40 : cx + cw - 70) - (cx + 70);
    let short = url.replace(/^https?:\/\//, "");
    while (short.length > 4 && ctx.measureText(`${short}…`).width > maxW) short = short.slice(0, -1);
    ctx.fillText(short === url.replace(/^https?:\/\//, "") ? short : `${short}…`, cx + 70, qy + qs - 40); ctx.globalAlpha = 1;
  }

  // Sello "Hecho con BRUNO"
  ctx.save(); ctx.font = "700 26px Inter, system-ui, sans-serif"; const label = "Hecho con BRUNO"; const tw = ctx.measureText(label).width; const pw = tw + 110, px = cx + (cw - pw) / 2, py = cy + ch - 84;
  rr(ctx, px, py, pw, 56, 28); ctx.fillStyle = `${fg}26`; ctx.fill();
  if (bear) { const bh = 30, bw = bh * bear.width / bear.height; ctx.drawImage(tint(bear, fg), px + 28, py + 13, bw, bh); }
  ctx.fillStyle = fg; ctx.textBaseline = "middle"; ctx.fillText(label, px + 78, py + 29); ctx.restore();
  drawSeal(ctx, seal, px - 90, py - 6, 68, fg);

  // Pie: logotipo
  const fy = cy + ch + (sq ? 40 : 110);
  if (wordmark) { const lh = sq ? 52 : 64, lw = lh * wordmark.width / wordmark.height; ctx.drawImage(tint(wordmark, ORANGE), (W - lw) / 2, fy, lw, lh); }
  ctx.font = `500 ${sq ? 26 : 30}px Inter, system-ui, sans-serif`; ctx.fillStyle = dark ? CREAM : GRAY; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.globalAlpha = .8;
  ctx.fillText(card.footer_text || "Tarjetas digitales NFC · brunocard.com", W / 2, fy + (sq ? 66 : 90)); ctx.globalAlpha = 1;

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

/* Sello personalizado (Premium): logo del usuario en una pastilla blanca junto al sello BRUNO. */
function drawSeal(ctx, seal, x, y, size, ringColor) {
  if (!seal) return;
  ctx.save(); rr(ctx, x, y, size, size, size * 0.3); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = `${ringColor}55`; ctx.stroke(); ctx.clip();
  const s = Math.min((size - 12) / seal.width, (size - 12) / seal.height); const w = seal.width * s, h = seal.height * s;
  ctx.drawImage(seal, x + (size - w) / 2, y + (size - h) / 2, w, h); ctx.restore();
}

function tint(img, color) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function shareCardImage(card, opts) {
  const blob = await renderCardImage(card, opts);
  if (!blob) throw new Error("render");
  const file = new File([blob], `bruno-${(card.title || "tarjeta").replace(/[^\w-]+/g, "_")}-${opts?.format === "square" ? "feed" : "story"}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: card.title, text: opts?.url || "" }); return "shared"; } catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}

/* Portada de reel 1080×1920: fotograma/portada de fondo, autor, texto, QR y sello BRUNO. */
export async function renderReelCover(reel, { url, phrase, bgColor } = {}) {
  const W = 1080, H = 1920;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const ctx = c.getContext("2d");
  let qr = null; try { qr = await QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#474747", light: "#ffffff" } }); } catch { /* sin QR */ }
  const [cover, avatar, bear, wordmark, qrImg, seal] = await Promise.all([
    loadImg(reel.thumbnail_url || reel.poster_url || reel.image_url), loadImg(reel.user?.avatar_url || reel.avatar_url), loadImg("/brand/icon-white.png"), loadImg("/brand/logo-h-white.png"), loadImg(qr), loadImg(getCustomSeal()),
  ]);
  ctx.fillStyle = bgColor || GRAY; ctx.fillRect(0, 0, W, H);
  if (cover) { cover(ctx, cover, 0, 0, W, H); }
  const g = ctx.createLinearGradient(0, H * 0.35, 0, H); g.addColorStop(0, "rgba(71,71,71,0)"); g.addColorStop(0.55, `${bgColor || GRAY}cc`); g.addColorStop(1, bgColor || GRAY); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const top = ctx.createLinearGradient(0, 0, 0, 300); top.addColorStop(0, "rgba(0,0,0,.45)"); top.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = top; ctx.fillRect(0, 0, W, 300);
  if (wordmark) { const lh = 56, lw = lh * wordmark.width / wordmark.height; ctx.drawImage(tint(wordmark, "#ffffff"), 70, 80, lw, lh); }
  // autor
  const ax = 70, ay = H - 640, as = 120;
  ctx.save(); ctx.beginPath(); ctx.arc(ax + as / 2, ay + as / 2, as / 2, 0, Math.PI * 2); ctx.fillStyle = CREAM; ctx.fill(); ctx.clip();
  if (avatar) cover(ctx, avatar, ax, ay, as, as); else if (bear) { const bw = as * .6, bh = bw * bear.height / bear.width; ctx.drawImage(tint(bear, ORANGE), ax + (as - bw) / 2, ay + (as - bh) / 2, bw, bh); }
  ctx.restore(); ctx.beginPath(); ctx.arc(ax + as / 2, ay + as / 2, as / 2 + 4, 0, Math.PI * 2); ctx.lineWidth = 8; ctx.strokeStyle = ORANGE; ctx.stroke();
  ctx.fillStyle = "#ffffff"; ctx.textBaseline = "top"; ctx.font = "800 44px Inter, system-ui, sans-serif";
  const name = reel.user?.name || reel.user_name || reel.author_name || "BRUNO"; ctx.fillText(name, ax + as + 30, ay + 18);
  ctx.font = "500 32px Inter, system-ui, sans-serif"; ctx.globalAlpha = .8; ctx.fillText(reel.user?.username ? `@${reel.user.username}` : "en BRUNO", ax + as + 30, ay + 72); ctx.globalAlpha = 1;
  // frase / caption
  const text = phrase || reel.content || "Mira este reel en BRUNO";
  ctx.font = "600 46px Inter, system-ui, sans-serif"; let y = ay + as + 50;
  for (const line of wrap(ctx, text, W - 140 - 300, 4)) { ctx.fillText(line, 70, y); y += 60; }
  // QR
  const qs = 240, qx = W - 70 - qs, qy = H - 200 - qs;
  if (qrImg) { ctx.save(); rr(ctx, qx - 16, qy - 16, qs + 32, qs + 32, 28); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.restore(); ctx.drawImage(qrImg, qx, qy, qs, qs); }
  // sello
  ctx.save(); ctx.font = "700 28px Inter, system-ui, sans-serif"; const label = "Hecho con BRUNO"; const tw = ctx.measureText(label).width; const pw = tw + 110, px = 70, py = H - 150;
  rr(ctx, px, py, pw, 60, 30); ctx.fillStyle = "rgba(255,255,255,.18)"; ctx.fill();
  if (bear) { const bh = 32, bw = bh * bear.width / bear.height; ctx.drawImage(bear, px + 28, py + 14, bw, bh); }
  ctx.fillStyle = "#ffffff"; ctx.textBaseline = "middle"; ctx.fillText(label, px + 78, py + 31); ctx.restore();
  drawSeal(ctx, seal, px + pw + 20, py - 6, 72, "#ffffff");
  ctx.font = "500 26px Inter, system-ui, sans-serif"; ctx.fillStyle = "#ffffff"; ctx.globalAlpha = .75; ctx.textBaseline = "top";
  const short = (url || "").replace(/^https?:\/\//, ""); ctx.fillText(short.length > 40 ? `${short.slice(0, 39)}…` : short, 70, H - 70); ctx.globalAlpha = 1;
  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

export async function shareBlob(blob, name, text) {
  const file = new File([blob], name, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return "shared"; } catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
