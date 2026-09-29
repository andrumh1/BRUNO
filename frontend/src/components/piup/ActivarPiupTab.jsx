/**
 * ActivarPiupTab — Escaner QR + asignacion a tarjeta Bruno.
 *
 * Flujo:
 *   1) Escanear QR del producto fisico (jsQR + getUserMedia)  → captura nfc_id
 *      Alternativamente: pegado manual del codigo
 *   2) Elegir tarjeta Bruno destino
 *   3) Confirmar → POST /piup/activate-by-qr
 *   4) Al exito → mostrar confirmacion + WS dispara refresh en otra tab
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { QrCode, Camera, CameraOff, CheckCircle2, ScanLine, Loader2, AlertCircle } from "lucide-react";
import axios from "axios";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Try to parse different QR payload formats and extract nfc_id
function parseScannedPayload(text) {
  if (!text) return null;
  const trimmed = text.trim();
  // Direct nfc_id in plain form (alphanumeric / dashes, 4–64 chars)
  if (/^[A-Za-z0-9_-]{4,64}$/.test(trimmed)) return trimmed;
  // URL form: https://bruno.app/n/{id}  or  /api/nfc/go/{id}  or  /api/nfc/resolve/{id}
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/\/(?:n|nfc\/(?:go|resolve|resolve-product))\/([A-Za-z0-9_-]{4,64})/);
    if (m) return m[1];
  } catch (_) {
    // not a URL — try regex extraction in case of partial text
  }
  const fallback = trimmed.match(/([A-Za-z0-9_-]{8,64})/);
  return fallback ? fallback[1] : null;
}

export default function ActivarPiupTab({ tagsData, auth, onActivated }) {
  const { tags } = tagsData;
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);

  const [scanning, setScanning] = useState(false);
  const [scannedId, setScannedId] = useState("");
  const [manualId, setManualId] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(tags[0]?.card_id || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedCardId && tags.length > 0) {
      setSelectedCardId(tags[0].card_id);
    }
  }, [tags, selectedCardId]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== 4) {
      rafRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });
    if (code && code.data) {
      const nfcId = parseScannedPayload(code.data);
      if (nfcId) {
        setScannedId(nfcId);
        brunoToast.success(`QR detectado: ${nfcId.slice(0, 12)}...`);
        stopCamera();
        return;
      }
    }
    rafRef.current = requestAnimationFrame(scanLoop);
  }, [stopCamera]);

  const startCamera = useCallback(async () => {
    setError("");
    setScannedId("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      rafRef.current = requestAnimationFrame(scanLoop);
    } catch (e) {
      setError("No pudimos acceder a la camara. Permite el acceso o pega el codigo manualmente.");
    }
  }, [scanLoop]);

  const activate = async () => {
    const nfc_id = scannedId || manualId.trim();
    if (!nfc_id) {
      brunoToast.error("Escanea el QR o pega el codigo del PIUP");
      return;
    }
    if (!selectedCardId) {
      brunoToast.error("Elige a que tarjeta vincular el PIUP");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await axios.post(
        `${API}/piup/activate-by-qr`,
        { nfc_id, card_id: selectedCardId },
        auth
      );
      brunoToast.success(`PIUP activado en "${res.data.card_title}"`);
      setScannedId("");
      setManualId("");
      onActivated?.();
    } catch (e) {
      const msg = e?.response?.data?.detail || "No pudimos activar el PIUP";
      setError(msg);
      brunoToast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const detected = !!(scannedId || manualId.trim());

  return (
    <div className="space-y-5" data-testid="piup-activate-tab">
      {/* Step 1: Scanner */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">1</div>
          <h2 className="font-semibold">Escanea el QR del PIUP</h2>
        </div>

        <div className="relative aspect-square sm:aspect-video w-full rounded-xl overflow-hidden bg-black/90">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`absolute inset-0 w-full h-full object-cover ${scanning ? "opacity-100" : "opacity-0"}`}
            data-testid="piup-scanner-video"
          />
          <canvas ref={canvasRef} className="hidden" />

          {!scanning && !scannedId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-3">
              <QrCode className="w-12 h-12 opacity-70" />
              <p className="text-sm opacity-80">Camara apagada</p>
              <Button onClick={startCamera} size="sm" data-testid="piup-start-scanner">
                <Camera className="w-4 h-4 mr-2" />
                Activar camara
              </Button>
            </div>
          )}

          {scanning && (
            <>
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 max-w-[70vw] max-h-[70vw] border-2 border-primary rounded-2xl"
                animate={{ boxShadow: ["0 0 0 0 rgba(255,106,0,.4)", "0 0 0 14px rgba(255,106,0,0)"] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <motion.div
                className="absolute left-1/2 -translate-x-1/2 w-60 max-w-[68vw] h-0.5 bg-primary"
                animate={{ y: [-120, 120, -120] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <Button
                onClick={stopCamera}
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2"
                data-testid="piup-stop-scanner"
              >
                <CameraOff className="w-4 h-4 mr-1" /> Detener
              </Button>
              <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-white/80 flex items-center justify-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5" />
                Apunta al QR del producto fisico
              </p>
            </>
          )}

          {scannedId && (
            <div className="absolute inset-0 bg-emerald-600/95 text-white flex flex-col items-center justify-center gap-2">
              <CheckCircle2 className="w-12 h-12" />
              <p className="font-semibold">Codigo detectado</p>
              <code className="text-xs bg-white/20 px-2 py-1 rounded font-mono">{scannedId}</code>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => { setScannedId(""); startCamera(); }}>
                Escanear otro
              </Button>
            </div>
          )}
        </div>

        {/* Manual input fallback */}
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">O pega el codigo manualmente:</label>
          <Input
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
            placeholder="ej. PIUP-A1B2C3D4"
            className="mt-1 font-mono"
            data-testid="piup-manual-input"
            disabled={!!scannedId}
          />
        </div>
      </section>

      {/* Step 2: Choose card */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">2</div>
          <h2 className="font-semibold">Elige la tarjeta Bruno</h2>
        </div>

        {tags.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground text-center">
            Crea primero una tarjeta para asignarle un PIUP.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-testid="piup-activate-card-picker">
            {tags.map((tag) => {
              const selected = tag.card_id === selectedCardId;
              return (
                <button
                  key={tag.card_id}
                  type="button"
                  onClick={() => setSelectedCardId(tag.card_id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                  data-testid={`piup-activate-pick-${tag.card_id}`}
                >
                  <div
                    className="w-10 h-10 rounded-lg shrink-0"
                    style={{
                      background: tag.avatar_url
                        ? `url(${tag.avatar_url}) center/cover`
                        : `linear-gradient(135deg, ${tag.background_color}, ${tag.background_color}cc)`,
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{tag.title || "Sin titulo"}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {tag.is_physical ? `${tag.physical_tag_count} PIUP fisico${tag.physical_tag_count > 1 ? "s" : ""}` : "Solo digital"}
                    </p>
                  </div>
                  {selected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Step 3: Activate */}
      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center">3</div>
          <h2 className="font-semibold">Confirmar activacion</h2>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm mb-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <Button
          onClick={activate}
          disabled={!detected || !selectedCardId || submitting}
          className="w-full bg-primary h-12 text-base"
          data-testid="piup-confirm-activate"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Activando...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Activar PIUP
            </>
          )}
        </Button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          El QR y el chip NFC quedan sincronizados — ambos redirigen a la misma tarjeta.
        </p>
      </section>
    </div>
  );
}
