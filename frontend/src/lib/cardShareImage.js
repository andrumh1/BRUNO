/* Genera una imagen de una tarjeta/perfil BRUNO con el sello corporativo.
   format: "story" 1080×1920 (IG/WhatsApp) · "square" 1080×1080 (feed IG/Facebook/TikTok/LinkedIn). */
import QRCode from "qrcode";
import { getCustomSeal } from "@/lib/shareHistory";
import { rasterizeCard } from "@/lib/cardRasterize";
import { resolveDesign, deepMerge } from "@/lib/cardDesign";

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

export async function renderCardImage(card, { qr, url, dark = false, format = "story", bgColor, phrase, design } = {}) {
  // Diseño real de la tarjeta (ONE CARD ENGINE) + overrides de la plantilla de compartir.
  let d = design || resolveDesign(card);
  if (bgColor) d = deepMerge(d, { background: { color: bgColor, type: ["image", "fullimage"].includes(d.background.type) ? d.background.type : d.background.type === "animated" ? "gradient" : d.background.type }, colors: { text: lum(bgColor) > 0.72 ? GRAY : "#ffffff" } });
  if (phrase) card = { ...card, description: phrase };
  const F = FORMATS[format] || FORMATS.story; const W = F.W, H = F.H;
  if (!qr && url) { try { qr = await QRCode.toDataURL(url, { width: 520, margin: 1, color: { dark: "#474747", light: "#ffffff" } }); } catch { /* sin QR */ } }
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const bg = d.background.color || ORANGE;
  const fg = d.colors.text || "#ffffff";
  const cx = 90, cw = W - 180, sq = format === "square";
  const [cardCanvas, bear, wordmark, qrImg, seal] = await Promise.all([
    rasterizeCard(card, d, { width: 390, pixelRatio: cw / 390 }).catch(() => null), loadImg("/brand/icon-white.png"), loadImg("/brand/logo-h-white.png"), loadImg(qr), loadImg(getCustomSeal()),
  ]);

  // Fondo: gris/crema corporativo con glow del color de la tarjeta
  ctx.fillStyle = dark ? "#333333" : CREAM; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H * 0.4, 80, W / 2, H * 0.4, W * 0.85); glow.addColorStop(0, `${bg}66`); glow.addColorStop(1, `${bg}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Zonas: tarjeta real arriba · fila QR + sello · pie con logotipo
  const qs = sq ? 170 : 230, footerH = sq ? 120 : 190, rowH = qs + 32, gap = sq ? 28 : 44;
  const top = sq ? 60 : 170, avail = H - top - footerH - rowH - gap * 2;
  const r = (d.layout?.radius ?? 24) * (cw / 390);
  let drawW = cw, drawH = Math.min(avail, 600);
  if (cardCanvas) { const scale = Math.min(1, avail / cardCanvas.height); drawW = cw * scale; drawH = cardCanvas.height * scale; }
  const dx = cx + (cw - drawW) / 2, cy = top + (avail - drawH) / 2;
  ctx.save(); ctx.shadowColor = "rgba(71,71,71,.35)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rr(ctx, dx, cy, drawW, drawH, r); ctx.fillStyle = bg; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, dx, cy, drawW, drawH, r); ctx.clip();
  if (cardCanvas) ctx.drawImage(cardCanvas, dx, cy, drawW, drawH);
  else { ctx.fillStyle = fg; ctx.font = "800 72px Inter, system-ui, sans-serif"; ctx.textBaseline = "top"; for (const [i, line] of wrap(ctx, card.title || "BRUNO", cw - 140, 2).entries()) ctx.fillText(line, dx + 70, cy + 120 + i * 84); }
  ctx.restore();

  // Fila: QR (pastilla blanca) + URL + sello "Hecho con BRUNO"
  const rowY = cy + drawH + gap, sealFg = dark ? CREAM : GRAY;
  let tx = cx;
  if (qrImg) { ctx.save(); ctx.shadowColor = "rgba(0,0,0,.18)"; ctx.shadowBlur = 24; rr(ctx, cx, rowY, qs + 32, qs + 32, 28); ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.restore(); ctx.drawImage(qrImg, cx + 16, rowY + 16, qs, qs); tx = cx + qs + 32 + 36; }
  const maxW = cx + cw - tx;
  if (url) {
    ctx.font = `600 ${sq ? 26 : 30}px Inter, system-ui, sans-serif`; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    let short = url.replace(/^https?:\/\//, "");
    while (short.length > 4 && ctx.measureText(`${short}…`).width > maxW - 48) short = short.slice(0, -1);
    const label = short === url.replace(/^https?:\/\//, "") ? short : `${short}…`; const tw = ctx.measureText(label).width;
    ctx.save(); rr(ctx, tx, rowY + 8, tw + 48, 56, 28); ctx.fillStyle = dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.9)"; ctx.fill(); ctx.restore();
    ctx.fillStyle = sealFg; ctx.fillText(label, tx + 24, rowY + 36);
  }
  ctx.save(); ctx.font = "700 26px Inter, system-ui, sans-serif"; ctx.textAlign = "left"; const label = "Hecho con BRUNO"; const tw = ctx.measureText(label).width; const pw = tw + 110, px = tx + (seal ? 90 : 0), py = rowY + (url ? 80 : 8);
  rr(ctx, px, py, pw, 56, 28); ctx.fillStyle = `${sealFg}22`; ctx.fill();
  if (bear) { const bh = 30, bw = bh * bear.width / bear.height; ctx.drawImage(tint(bear, ORANGE), px + 28, py + 13, bw, bh); }
  ctx.fillStyle = sealFg; ctx.textBaseline = "middle"; ctx.fillText(label, px + 78, py + 29); ctx.restore();
  drawSeal(ctx, seal, tx, py - 6, 68, sealFg);
  if (card.subtitle || card.title) { ctx.font = `500 ${sq ? 24 : 28}px Inter, system-ui, sans-serif`; ctx.fillStyle = sealFg; ctx.globalAlpha = .75; ctx.textBaseline = "top"; ctx.textAlign = "left"; const who = `${card.title || ""}${card.subtitle ? ` · ${card.subtitle}` : ""}`; ctx.fillText(wrap(ctx, who, maxW, 1)[0] || "", tx, py + 72); ctx.globalAlpha = 1; }

  // Pie: logotipo
  const fy = H - footerH;
  if (wordmark) { const lh = sq ? 52 : 64, lw = lh * wordmark.width / wordmark.height; ctx.drawImage(tint(wordmark, ORANGE), (W - lw) / 2, fy, lw, lh); }
  ctx.font = `500 ${sq ? 26 : 30}px Inter, system-ui, sans-serif`; ctx.fillStyle = sealFg; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.globalAlpha = .8;
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
  const [coverImg, avatar, bear, wordmark, qrImg, seal] = await Promise.all([
    loadImg(reel.thumbnail_url || reel.poster_url || reel.image_url), loadImg(reel.user?.avatar_url || reel.avatar_url), loadImg("/brand/icon-white.png"), loadImg("/brand/logo-h-white.png"), loadImg(qr), loadImg(getCustomSeal()),
  ]);
  ctx.fillStyle = bgColor || GRAY; ctx.fillRect(0, 0, W, H);
  if (coverImg) cover(ctx, coverImg, 0, 0, W, H);
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
