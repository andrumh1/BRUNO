import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const roundRect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };

/** 1080×1920 coupon sticker card rendered in-browser (brand orange on charcoal), returned as a JPEG blob. */
export async function renderCouponStory({ code, value, sellerName }) {
  const c = document.createElement("canvas"); c.width = 1080; c.height = 1920;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2b2b2b"; ctx.fillRect(0, 0, 1080, 1920);
  const g = ctx.createRadialGradient(540, 760, 80, 540, 760, 900); g.addColorStop(0, "rgba(242,106,27,.55)"); g.addColorStop(1, "rgba(242,106,27,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = "#F9F1EA"; roundRect(ctx, 120, 620, 840, 680, 56); ctx.fill();
  ctx.fillStyle = "#F26A1B"; ctx.font = "700 34px Arial"; ctx.textAlign = "center"; ctx.letterSpacing = "8px"; ctx.fillText("CUPÓN BRUNO", 540, 720);
  ctx.letterSpacing = "0px"; ctx.fillStyle = "#2b2b2b"; ctx.font = "600 44px Arial"; ctx.fillText(`de ${sellerName || "tu creador"}`, 540, 800);
  ctx.fillStyle = "#F26A1B"; roundRect(ctx, 200, 860, 680, 170, 40); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.font = "900 108px Arial"; ctx.letterSpacing = "10px"; ctx.fillText(code, 540, 980);
  ctx.letterSpacing = "0px"; ctx.fillStyle = "#2b2b2b"; ctx.font = "800 88px Arial"; ctx.fillText(`−${value}`, 540, 1150);
  ctx.fillStyle = "#6b6b6b"; ctx.font = "500 36px Arial"; ctx.fillText("Toca el enlace y se aplica solo al pagar", 540, 1230);
  ctx.fillStyle = "#F9F1EA"; ctx.font = "700 40px Arial"; ctx.letterSpacing = "6px"; ctx.fillText("BRUNO", 540, 1480);
  return new Promise((res) => c.toBlob((b) => res(b), "image/jpeg", 0.92));
}

/** Uploads the sticker image and publishes a 24h story whose link opens the coupon landing. */
export async function publishCouponStory(coupon, token, sellerName) {
  const blob = await renderCouponStory({ code: coupon.code, value: coupon.value, sellerName });
  const fd = new FormData(); fd.append("file", blob, `cupon_${coupon.code}.jpg`);
  const up = await axios.post(`${API}/upload/image?aspect=story&folder=bruno/stories`, fd, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "multipart/form-data" } });
  const r = await axios.post(`${API}/stories/`, { media_url: up.data.url, media_type: "image", caption: `Cupón ${coupon.code} · −${coupon.value}`, duration: 7, visibility: "public", link_url: coupon.url, link_text: `Usar cupón ${coupon.code}` }, { headers: { Authorization: `Bearer ${token}` } });
  return r.data;
}
