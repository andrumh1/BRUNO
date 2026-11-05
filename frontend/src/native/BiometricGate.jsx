/* Pantalla de bloqueo biométrico (solo app nativa). Se muestra al abrir la app y al volver tras >20 s en segundo plano. */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { App } from "@capacitor/app";
import { Fingerprint, ScanFace, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { isNative } from "./capacitor";
import { authenticateBiometric, biometricInfo, getBiometricLock, BIOMETRIC_EVENT } from "./biometric";

const RELOCK_AFTER_MS = 20_000;

export default function BiometricGate() {
  const { isAuthenticated, logout } = useAuth() || {};
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState("fingerprint");
  const hiddenAt = useRef(0);

  useEffect(() => {
    if (!isNative()) return undefined;
    getBiometricLock().then((v) => {
      setEnabled(v);
      if (v) { setLocked(true); biometricInfo().then((i) => setType(i.type)); } // solo consulta BiometricAuth si el usuario activó el bloqueo
    });
    const onChange = (e) => setEnabled(!!e.detail?.enabled);
    window.addEventListener(BIOMETRIC_EVENT, onChange);
    const sub = App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) { hiddenAt.current = Date.now(); return; }
      if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setLocked(true);
    });
    return () => { window.removeEventListener(BIOMETRIC_EVENT, onChange); sub.then((h) => h.remove()); };
  }, []);

  const unlock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    const ok = await authenticateBiometric("Desbloquea BRUNO para continuar");
    setBusy(false);
    if (ok) setLocked(false);
  }, [busy]);

  const show = isNative() && enabled && locked && isAuthenticated;
  useEffect(() => { if (show) unlock(); }, [show]); // eslint-disable-line

  if (!show) return null;
  const Icon = type === "face" ? ScanFace : type === "fingerprint" ? Fingerprint : Lock;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background px-8 text-center" data-testid="biometric-gate">
      <img src="/brand/icon-orange.png" alt="BRUNO" className="h-20 w-20 object-contain" />
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">BRUNO está bloqueado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Usa {type === "face" ? "tu rostro" : type === "fingerprint" ? "tu huella" : "el código del teléfono"} para entrar.</p>
      </div>
      <button type="button" onClick={unlock} disabled={busy} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 disabled:opacity-60" data-testid="biometric-unlock-btn" aria-label="Desbloquear">
        <Icon className="h-10 w-10" />
      </button>
      <button type="button" onClick={() => { setLocked(false); logout?.(); }} className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline" data-testid="biometric-logout-btn">
        Cerrar sesión y usar otra cuenta
      </button>
    </div>,
    document.body
  );
}
