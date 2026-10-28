import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";

/** Tarjeta de entrega BRUNO (adicional, no consume las 3 tarjetas): referencia, botón «Activar mi paquete», enlace único y QR. */
export default function DeliveryCard({ pkg, url }) {
  const canvasRef = useRef(null);
  const [qr, setQr] = useState(null);
  useEffect(() => { if (url) QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: "#1c1c1a", light: "#ffffff" } }).then(setQr); }, [url]);
  const copy = async () => { try { await navigator.clipboard.writeText(url); brunoToast.success("Enlace copiado"); } catch { brunoToast.error("No se pudo copiar"); } };
  const download = async () => {
    const W = 1000, H = 600, c = canvasRef.current; c.width = W; c.height = H; const g = c.getContext("2d");
    g.fillStyle = "#fff7f1"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#ffffff"; g.beginPath(); g.roundRect(40, 40, W - 80, H - 80, 48); g.fill(); g.strokeStyle = "#ffd9bf"; g.lineWidth = 3; g.stroke();
    const logo = new Image(); logo.src = "/brand/logo-h-orange.png"; await new Promise((r) => { logo.onload = r; logo.onerror = r; });
    if (logo.width) g.drawImage(logo, 80, 80, 260, 260 * (logo.height / logo.width));
    g.fillStyle = "#fa632e"; g.font = "bold 22px Arial"; g.fillText("PERFIL COMPLETO + 3 TARJETAS DIGITALES", 80, 200);
    g.fillStyle = "#1c1c1a"; g.font = "bold 44px Arial"; g.fillText(`Hola, ${(pkg.client?.name || "").split(" ")[0] || "bienvenido"}`, 80, 260);
    g.font = "26px Arial"; g.fillStyle = "#4a4b45"; g.fillText(`Tu paquete BRUNO está listo. Referencia ${pkg.ref}`, 80, 305);
    g.fillStyle = "#fa632e"; g.beginPath(); g.roundRect(80, 350, 380, 72, 36); g.fill(); g.fillStyle = "#fff"; g.font = "bold 28px Arial"; g.fillText("Activar mi paquete", 125, 397);
    g.fillStyle = "#6c6d64"; g.font = "18px Arial"; g.fillText("Escanea el QR o abre el enlace. Asesor: @" + pkg.advisor_handle, 80, 470);
    g.fillText("Abrirlo no activa nada: tú confirmas dentro de BRUNO.", 80, 498);
    g.fillText("BRUNO · Octopus Vision Company · bruno@brunocard.com", 80, 530);
    if (qr) { const q = new Image(); q.src = qr; await new Promise((r) => { q.onload = r; }); g.drawImage(q, W - 80 - 320, 120, 320, 320); g.font = "16px Arial"; g.fillStyle = "#6c6d64"; g.fillText(url.replace(/^https?:\/\//, "").slice(0, 44), W - 80 - 320, 470); }
    const a = document.createElement("a"); a.download = `BRUNO-entrega-${pkg.ref}.png`; a.href = c.toDataURL("image/png"); a.click();
  };
  if (!url) return null;
  return (
    <div className="rounded-[28px] border border-orange-200 bg-[linear-gradient(135deg,#fff7f1,#ffffff)] p-5 sm:p-6" data-testid="delivery-card">
      <div className="flex flex-col sm:flex-row gap-5 items-center">
        <div className="flex-1 min-w-0">
          <img src="/brand/logo-h-orange.png" alt="BRUNO" className="h-7 mb-3" />
          <p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e]">Perfil completo + 3 tarjetas digitales</p>
          <h3 className="text-2xl font-semibold mt-1">Hola, {(pkg.client?.name || "").split(" ")[0] || "bienvenido"}</h3>
          <p className="text-sm text-[#4a4b45] mt-1">Tu paquete BRUNO está listo. Referencia <b data-testid="delivery-card-ref">{pkg.ref}</b>.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex mt-4 h-11 px-6 items-center rounded-full bg-[#fa632e] text-white font-semibold" data-testid="delivery-card-activate">Activar mi paquete</a>
          <p className="text-[11px] text-[#6c6d64] mt-3 break-all" data-testid="delivery-card-url">{url}</p>
          <p className="text-[11px] text-[#6c6d64]">Abrir o escanear no activa nada; el cliente confirma dentro de BRUNO. Enlace de un solo uso, vence en 30 días.</p>
        </div>
        {qr && <img src={qr} alt="QR del paquete" className="w-40 h-40 rounded-2xl border border-orange-100 bg-white p-1" data-testid="delivery-card-qr" />}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="outline" className="rounded-full" onClick={copy} data-testid="delivery-card-copy"><Copy className="w-4 h-4 mr-1.5" />Copiar enlace</Button>
        <Button className="rounded-full" onClick={download} data-testid="delivery-card-download"><Download className="w-4 h-4 mr-1.5" />Descargar tarjeta</Button>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
