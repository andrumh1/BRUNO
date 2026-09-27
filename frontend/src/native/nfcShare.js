/* NFC card transfer helpers — honest cross-platform strategy:
 *  • Android Chrome (Web NFC): read tags + write the transfer URL to a PIUP/NTAG tag.
 *  • Native Android (Capacitor): if a HCE plugin is registered as `BrunoNfcHce`, the phone
 *    emulates an NDEF tag with the URL → an iPhone reads it natively with a simple tap.
 *  • iPhone: cannot emulate NFC tags (Apple restriction); it CAN read tags/HCE in background,
 *    and shares via AirDrop through the Web Share sheet. QR + link always work everywhere.
 */
import { registerPlugin } from "@capacitor/core";
import { isNative, isAndroid, isIOS } from "./capacitor";

/* Native Android HCE plugin (see /frontend/native-android/nfc-hce). Web/iOS fall back to a no-op. */
const BrunoNfcHce = registerPlugin("BrunoNfcHce", {
  web: () => Promise.resolve({
    isSupported: async () => ({ supported: false, enabled: false }),
    startEmulation: async () => ({ emulating: false }),
    stopEmulation: async () => {},
  }),
});
let hceSupported = null;
export const checkHceSupport = async () => {
  if (hceSupported !== null) return hceSupported;
  try { hceSupported = isNative() && isAndroid() && !!(await BrunoNfcHce.isSupported())?.supported; } catch { hceSupported = false; }
  return hceSupported;
};

export const nfcCapabilities = () => {
  const webNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const hce = hceSupported === true || !!window?.Capacitor?.Plugins?.BrunoNfcHce;
  return {
    webNfc,
    hce,
    native: isNative(),
    android: isAndroid() || /android/i.test(navigator.userAgent),
    ios: isIOS() || /iphone|ipad|ipod/i.test(navigator.userAgent),
    canShare: typeof navigator !== "undefined" && !!navigator.share,
  };
};

/** Write the URL as an NDEF record on the next tag/phone that touches the device. */
export const writeUrlToTag = async (url, { signal } = {}) => {
  if (!("NDEFReader" in window)) throw new Error("NFC no disponible en este navegador");
  const ndef = new window.NDEFReader();
  await ndef.write({ records: [{ recordType: "url", data: url }] }, { signal });
  return true;
};

/** Listen for a tag; resolves with the first URL record found. */
export const readTagUrl = ({ signal } = {}) =>
  new Promise((resolve, reject) => {
    if (!("NDEFReader" in window)) return reject(new Error("NFC no disponible en este navegador"));
    const ndef = new window.NDEFReader();
    ndef.onreading = (event) => {
      for (const record of event.message.records) {
        if (record.recordType === "url") {
          resolve(new TextDecoder().decode(record.data));
          return;
        }
      }
    };
    ndef.onreadingerror = () => reject(new Error("No se pudo leer el tag"));
    ndef.scan({ signal }).catch(reject);
  });

/** Android native HCE (phone acts as an NFC tag the iPhone can read). No-op if plugin missing. */
export const startHceEmulation = async (url) => {
  if (!(await checkHceSupport())) return false;
  try { return !!(await BrunoNfcHce.startEmulation({ url }))?.emulating; } catch { return false; }
};
export const stopHceEmulation = async () => {
  if (hceSupported !== true) return;
  try { await BrunoNfcHce.stopEmulation(); } catch { /* ignore */ }
};
