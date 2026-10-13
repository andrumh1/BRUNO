/* Bloqueo biométrico (Face ID / Touch ID / huella / rostro Android). Web: no disponible. */
import { Preferences } from "@capacitor/preferences";
import { isNative } from "./capacitor";

const LOCK_KEY = "bruno_biometric_lock";
export const BIOMETRIC_EVENT = "bruno:biometric-lock";

let mod = null;
const lib = async () => {
  if (!mod) mod = await import("@aparajita/capacitor-biometric-auth");
  return mod;
};

export async function biometricInfo() {
  if (!isNative()) return { available: false, type: "none", reason: "web" };
  try {
    const { BiometricAuth, BiometryType } = await lib();
    const r = await BiometricAuth.checkBiometry();
    const type = r.biometryType === BiometryType.faceId ? "face" : r.biometryType === BiometryType.touchId || r.biometryType === BiometryType.fingerprintAuthentication ? "fingerprint" : r.biometryType === BiometryType.faceAuthentication ? "face" : "device";
    return { available: !!(r.isAvailable || r.deviceIsSecure), type, strong: !!r.isAvailable, reason: r.reason || "" };
  } catch (e) {
    return { available: false, type: "none", reason: e?.message || "error" };
  }
}

export async function authenticateBiometric(reason = "Desbloquea BRUNO") {
  if (!isNative()) return true;
  const { BiometricAuth } = await lib();
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancelar",
      allowDeviceCredential: true,
      iosFallbackTitle: "Usar código",
      androidTitle: "BRUNO",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch {
    return false;
  }
}

export async function getBiometricLock() {
  if (!isNative()) return false;
  try { return (await Preferences.get({ key: LOCK_KEY })).value === "1"; } catch { return false; }
}

export async function setBiometricLock(enabled) {
  await Preferences.set({ key: LOCK_KEY, value: enabled ? "1" : "0" });
  window.dispatchEvent(new CustomEvent(BIOMETRIC_EVENT, { detail: { enabled } }));
}
