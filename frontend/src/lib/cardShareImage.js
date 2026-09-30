/* Genera una imagen 1080×1920 (historia IG / WhatsApp) de una tarjeta BRUNO con el sello corporativo. */
const W = 1080, H = 1920;
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

export async function renderCardImage(card, { qr, url, dark = false } = {}) {
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const rawBg = card.background_color || ORANGE;
  const light = lum(rawBg) > 0.72;
  const bg = dark && light ? GRAY : rawBg;
  const fg = dark && light ? CREAM : (card.text_color || "#ffffff");
  const [avatar, banner, bear, wordmark, qrImg] = await Promise.all([
    loadImg(card.avatar_url), loadImg(card.banner_url), loadImg("/brand/icon-white.png"), loadImg("/brand/logo-h-white.png"), loadImg(qr),
  ]);

  // Fondo: gris/crema corporativo con glow del color de la tarjeta
  ctx.fillStyle = dark ? "#333333" : CREAM; ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 760, 80, W / 2, 760, 900); glow.addColorStop(0, `${bg}66`); glow.addColorStop(1, `${bg}00`);
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

  // Tarjeta
  const cx = 90, cy = 300, cw = W - 180, ch = 1180, r = 56;
  ctx.save(); ctx.shadowColor = "rgba(71,71,71,.35)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  rr(ctx, cx, cy, cw, ch, r); const g = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch); g.addColorStop(0, bg); g.addColorStop(1, `${bg}ee`); ctx.fillStyle = g; ctx.fill(); ctx.restore();
  ctx.save(); rr(ctx, cx, cy, cw, ch, r); ctx.clip();
  if (banner) { cover(ctx, banner, cx, cy, cw, 300); const bg2 = ctx.createLinearGradient(0, cy, 0, cy + 300); bg2.addColorStop(0, "rgba(0,0,0,.05)"); bg2.addColorStop(1, `${bg}`); ctx.fillStyle = bg2; ctx.fillRect(cx, cy, cw, 300); }
  else { ctx.fillStyle = `${fg}14`; ctx.fillRect(cx, cy, cw, 300); }
  ctx.restore();

  // Avatar
  const ax = cx + 70, ay = cy + 190, as = 240;
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
  if (card.description) { ctx.font = "400 34px Inter, system-ui, sans-serif"; ctx.globalAlpha = .82; for (const line of wrap(ctx, card.description, cw - 140, 4)) { ctx.fillText(line, cx + 70, y + 14); y += 46; } ctx.globalAlpha = 1; }

  // QR + url
  const qs = 260, qx = cx + cw - 70 - qs, qy = cy + ch - 90 - qs - 70;
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

  // Pie: logotipo
  if (wordmark) { const lh = 64, lw = lh * wordmark.width / wordmark.height; ctx.drawImage(tint(wordmark, ORANGE), (W - lw) / 2, cy + ch + 110, lw, lh); }
  ctx.font = "500 30px Inter, system-ui, sans-serif"; ctx.fillStyle = dark ? CREAM : GRAY; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.globalAlpha = .8;
  ctx.fillText("Tarjetas digitales NFC · brunocard.com", W / 2, cy + ch + 200); ctx.globalAlpha = 1;

  return new Promise((res) => c.toBlob((b) => res(b), "image/png"));
}

function tint(img, color) {
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.globalCompositeOperation = "source-in"; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  return c;
}

export async function shareCardImage(card, opts) {
  const blob = await renderCardImage(card, opts);
  if (!blob) throw new Error("render");
  const file = new File([blob], `bruno-${(card.title || "tarjeta").replace(/[^\w-]+/g, "_")}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: card.title, text: opts?.url || "" }); return "shared"; } catch (e) { if (e?.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
