import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { QrCode } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Bars = ({ data, height = 130 }) => {
  const max = Math.max(...data.map((d) => d.scans), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
          <div className="w-full bg-primary/80 rounded-t hover:bg-primary transition-colors" style={{ height: `${(d.scans / max) * 100}%`, minHeight: d.scans > 0 ? "4px" : "0" }} title={`${d.date}: ${d.scans} escaneos`} />
          {(i % Math.ceil(data.length / 6) === 0) && <span className="text-[9px] text-muted-foreground">{d.date.slice(5)}</span>}
        </div>
      ))}
    </div>
  );
};

const NETWORK_COLORS = { instagram: "#E1306C", facebook: "#1877F2", whatsapp: "#25D366", telegram: "#229ED9", x: "#111111", linkedin: "#0A66C2", tiktok: "#010101", snapchat: "#FFFC00", bruno: "#ff6a00", qr: "#474747", web: "#7a7674" };

/* Panel de escaneos de imágenes compartidas (por día y por red). */
export default function ScanStatsPanel({ token }) {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    if (!token) return;
    axios.get(`${API}/share-stats/daily`, { params: { days }, headers: { Authorization: `Bearer ${token}` } }).then((r) => setData(r.data)).catch(() => setData({ days: [], networks: {}, total: 0, refs: 0 }));
  }, [token, days]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("tab") === "scans" && data) ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [data]);
  if (!data) return null;
  const total = Object.values(data.networks).reduce((a, b) => a + b, 0) || 1;
  const nets = Object.entries(data.networks).sort((a, b) => b[1] - a[1]);
  return (
    <div ref={ref} id="scans" className="p-4 bg-card rounded-xl border" data-testid="scan-stats-panel">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold flex items-center gap-2"><QrCode className="w-4 h-4 text-primary" /> Escaneos de tus imágenes</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map((d) => <button key={d} onClick={() => setDays(d)} className={`text-[11px] px-2 py-0.5 rounded-full ${days === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} data-testid={`scan-range-${d}`}>{d} d</button>)}
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-4"><span className="text-foreground font-semibold" data-testid="scan-total">{data.total}</span> escaneos · {data.refs} imagen{data.refs === 1 ? "" : "es"} compartida{data.refs === 1 ? "" : "s"}</p>
      {data.total === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Aún no hay escaneos. Comparte una imagen con QR desde tu tarjeta, perfil o un reel.</p>
      ) : (
        <>
          <Bars data={data.days} />
          <div className="mt-5 space-y-2" data-testid="scan-networks">
            {nets.map(([n, c]) => (
              <div key={n} className="flex items-center gap-2 text-xs">
                <span className="w-20 shrink-0 font-medium capitalize">{n === "qr" ? "Cámara/QR" : n === "x" ? "X" : n}</span>
                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full" style={{ width: `${(c / total) * 100}%`, backgroundColor: NETWORK_COLORS[n] || "#ff6a00" }} /></div>
                <span className="w-12 text-right tabular-nums text-muted-foreground">{c} · {Math.round((c / total) * 100)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
