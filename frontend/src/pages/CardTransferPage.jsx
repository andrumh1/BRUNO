import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { nfcCapabilities, writeUrlToTag, startHceEmulation, stopHceEmulation, checkHceSupport } from "@/native/nfcShare";
import { ArrowLeft, Check, Copy, Loader2, Nfc, QrCode, RefreshCw, Share2, Smartphone, Wallet, Wifi } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL + "/api";

const Phone = ({ label, color, filled }) => (
  <div className="relative w-14 h-24 rounded-[16px] border-[3px] border-white/90 bg-black/20 flex items-center justify-center">
    <span className="absolute top-1.5 w-5 h-1 rounded-full bg-white/70" />
    <motion.div className="w-8 h-5 rounded-md" style={{ background: color }} animate={{ opacity: filled ? [0.2, 1] : [1, 0.3] }} transition={{ repeat: Infinity, repeatType: "reverse", duration: 1.5 }} />
    <span className="absolute -bottom-5 text-[10px] font-semibold text-white/80 whitespace-nowrap">{label}</span>
  </div>
);

/** Sender side: /cards/:cardId/transfer — NFC tap · QR · link, live "received by" feedback */
export default function CardTransferPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [card, setCard] = useState(null);
  const [transfer, setTransfer] = useState(null);
  const [left, setLeft] = useState(0);
  const [nfcState, setNfcState] = useState("idle"); // idle | waiting | written | error
  const [copied, setCopied] = useState(false);
  const [receivers, setReceivers] = useState([]);
  const abortRef = useRef(null);
  const [hce, setHce] = useState(false);
  useEffect(() => { checkHceSupport().then(setHce); }, []);
  const caps = { ...nfcCapabilities(), hce };
  const headers = { Authorization: `Bearer ${token}` };

  const createToken = useCallback(async () => {
    try {
      const r = await axios.post(`${API}/cards/${cardId}/transfer-token`, {}, { headers });
      setTransfer(r.data); setReceivers([]);
      return r.data;
    } catch (e) { brunoToast.error(e?.response?.data?.detail || "No se pudo preparar la transferencia"); return null; }
  }, [cardId, token]); // eslint-disable-line

  useEffect(() => {
    (async () => {
      try { const r = await axios.get(`${API}/cards/${cardId}`, { headers }); setCard(r.data); } catch { navigate(-1); }
      await createToken();
    })();
    return () => { abortRef.current?.abort(); stopHceEmulation(); };
  }, [cardId]); // eslint-disable-line

  // Countdown + poll for receivers
  useEffect(() => {
    if (!transfer) return undefined;
    const tick = () => setLeft(Math.max(0, Math.floor((new Date(transfer.expires_at) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    const poll = setInterval(async () => {
      try {
        const r = await axios.get(`${API}/transfer/${transfer.token}`, { headers });
        if ((r.data.receivers || []).length > receivers.length) {
          const fresh = r.data.receivers.slice(receivers.length);
          fresh.forEach((u) => brunoToast.success(`¡${u.name} guardó tu tarjeta!`));
          if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
        }
        setReceivers(r.data.receivers || []);
      } catch { /* ignore */ }
    }, 3000);
    return () => { clearInterval(t); clearInterval(poll); };
  }, [transfer, receivers.length]); // eslint-disable-line

  // Native Android: emulate a tag so iPhones/Androids read it with a tap
  useEffect(() => {
    if (!transfer?.url || !hce) return undefined;
    startHceEmulation(transfer.url).then((ok) => { if (ok) setNfcState((s) => (s === "idle" ? "emitting" : s)); });
    return () => { stopHceEmulation(); };
  }, [transfer?.url, hce]);

  const startNfc = async () => {
    if (!transfer?.url) return;
    abortRef.current?.abort();
    const ctrl = new AbortController(); abortRef.current = ctrl;
    setNfcState("waiting");
    try {
      await writeUrlToTag(transfer.url, { signal: ctrl.signal });
      setNfcState("written");
      brunoToast.success("Tarjeta transferida por NFC", { description: "El otro dispositivo ya puede abrirla." });
      if (navigator.vibrate) navigator.vibrate(60);
    } catch (e) {
      if (e?.name !== "AbortError") { setNfcState("error"); brunoToast.error("No se completó el toque NFC", { description: "Acerca bien los teléfonos o usa el QR." }); }
      else setNfcState("idle");
    }
  };

  const share = async () => {
    if (!transfer?.url) return;
    if (navigator.share) {
      try { await navigator.share({ title: card?.title || "Mi tarjeta BRUNO", text: `Te comparto mi tarjeta digital: ${card?.title || ""}`, url: transfer.url }); } catch { /* cancelled */ }
    } else { await navigator.clipboard.writeText(transfer.url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };
  const copy = async () => { if (!transfer?.url) return; await navigator.clipboard.writeText(transfer.url); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const color = card?.background_color || "#FF6B35";

  return (
    <div className="min-h-screen bg-background pb-28" data-testid="card-transfer-page">
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 h-14 bg-background/80 backdrop-blur border-b">
        <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)} data-testid="transfer-back-btn"><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1 min-w-0"><h1 className="font-bold text-sm truncate">Transferir por contacto</h1><p className="text-[11px] text-muted-foreground truncate">{card?.title}</p></div>
        <Button variant="ghost" size="sm" className="rounded-full text-xs" onClick={() => navigate("/wallet")} data-testid="transfer-wallet-btn"><Wallet className="w-4 h-4 mr-1" /> Recibidas</Button>
      </div>

      <div className="max-w-md mx-auto px-4 pt-5 space-y-5">
        {/* Tap stage */}
        <motion.div className="relative rounded-3xl p-6 text-white overflow-hidden shadow-2xl" style={{ background: `linear-gradient(135deg, ${color}, ${color}AA)` }} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" style={{ width: 120 + i * 90, height: 120 + i * 90 }}
              animate={{ scale: nfcState === "waiting" ? [0.8, 1.15] : [0.95, 1.05], opacity: [0.5, 0] }} transition={{ repeat: Infinity, duration: nfcState === "waiting" ? 1.4 : 2.6, delay: i * 0.35 }} />
          ))}
          <div className="relative flex items-center justify-center gap-4 pt-2 pb-8">
            <motion.div animate={{ x: [0, 10, 10, 0] }} transition={{ repeat: Infinity, duration: 3, repeatDelay: 0.6 }}><Phone label="Tú" color="#fff" /></motion.div>
            <motion.div animate={{ scale: [1, 1.25, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className="flex flex-col items-center"><Wifi className="w-7 h-7 rotate-90" /><span className="text-[9px] font-black">NFC</span></motion.div>
            <motion.div animate={{ x: [0, -10, -10, 0] }} transition={{ repeat: Infinity, duration: 3, repeatDelay: 0.6 }}><Phone label="Android · iPhone" color="#fff" filled /></motion.div>
          </div>
          <div className="relative text-center">
            <p className="font-bold text-lg leading-tight">{nfcState === "written" ? "¡Transferida!" : nfcState === "waiting" ? "Acerca los teléfonos…" : nfcState === "emitting" ? "Emitiendo por NFC · acerca el otro teléfono" : "Acerca tu teléfono al otro"}</p>
            <p className="text-xs text-white/85 mt-1">
              {caps.hce ? "Tu teléfono está emitiendo la tarjeta por NFC. Cualquier Android o iPhone la recibe con un toque." :
               caps.webNfc ? "Pulsa Activar NFC y acerca el otro teléfono o un tag PIUP." :
               caps.ios ? "iPhone: comparte con AirDrop desde “Compartir” o muestra el QR. Para recibir, basta acercar el iPhone a un Android con BRUNO o a un tag PIUP." :
               "Este navegador no expone NFC: usa el QR o el enlace, funcionan en cualquier teléfono."}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {caps.webNfc && nfcState !== "written" && (
                <Button className="rounded-full bg-white text-black hover:bg-white/90" onClick={startNfc} disabled={nfcState === "waiting"} data-testid="transfer-nfc-btn">
                  {nfcState === "waiting" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Nfc className="w-4 h-4 mr-2" />} {nfcState === "waiting" ? "Esperando toque" : "Activar NFC"}
                </Button>
              )}
              {nfcState === "written" && <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold"><Check className="w-4 h-4" /> Listo</span>}
              <Button variant="secondary" className="rounded-full bg-white/20 text-white hover:bg-white/30 border-0" onClick={share} data-testid="transfer-share-btn"><Share2 className="w-4 h-4 mr-2" /> {caps.ios ? "AirDrop / Compartir" : "Compartir"}</Button>
            </div>
          </div>
        </motion.div>

        {/* QR */}
        <div className="rounded-3xl border bg-card p-5 flex flex-col items-center gap-3" data-testid="transfer-qr-card">
          <div className="flex items-center gap-2 self-start text-sm font-semibold"><QrCode className="w-4 h-4 text-primary" /> Código QR de transferencia</div>
          {transfer ? (
            <motion.img key={transfer.token} src={transfer.qr_code} alt="QR" className="w-52 h-52 rounded-2xl" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} data-testid="transfer-qr-img" />
          ) : <div className="w-52 h-52 rounded-2xl bg-muted animate-pulse" />}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className={`font-mono font-semibold ${left < 60 ? "text-red-500" : ""}`} data-testid="transfer-countdown">{left > 0 ? `Válido ${mm}:${ss}` : "Expirado"}</span>
            <button onClick={createToken} className="inline-flex items-center gap-1 text-primary font-medium" data-testid="transfer-renew-btn"><RefreshCw className="w-3.5 h-3.5" /> Renovar</button>
          </div>
          <div className="w-full flex gap-2">
            <button onClick={copy} className="flex-1 min-w-0 h-10 rounded-full bg-muted text-xs font-medium flex items-center justify-center gap-1.5 px-3" data-testid="transfer-copy-btn">
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Copiado</> : <><Copy className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{transfer?.url?.replace(/^https?:\/\//, "") || "…"}</span></>}
            </button>
          </div>
        </div>

        {/* Received by */}
        <AnimatePresence>
          {receivers.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-3xl border bg-emerald-500/10 border-emerald-500/30 p-4" data-testid="transfer-receivers">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-2"><Check className="w-4 h-4" /> Guardada por {receivers.length} persona{receivers.length > 1 ? "s" : ""}</p>
              <p className="text-xs text-muted-foreground mt-1">{receivers.map((r) => r.name).join(", ")}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-2xl bg-muted/50 p-4 text-[11px] text-muted-foreground leading-relaxed flex gap-3">
          <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
          <p><b>Cómo funciona:</b> Android → iPhone y Android → Android por NFC con un toque (app nativa) o escribiendo un tag PIUP (Chrome Android). iPhone → cualquier teléfono con AirDrop o QR. Quien recibe pulsa “Guardar” y la tarjeta queda en su BRUNO, sin importar el sistema.</p>
        </div>
      </div>
    </div>
  );
}
