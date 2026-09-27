/* NFC card transfer helpers — honest cross-platform strategy:
 *  • Android Chrome (Web NFC): read tags + write the transfer URL to a PIUP/NTAG tag.
 *  • Native Android (Capacitor): if a HCE plugin is registered as `BrunoNfcHce`, the phone
 *    emulates an NDEF tag with the URL → an iPhone reads it natively with a simple tap.
 *  • iPhone: cannot emulate NFC tags (Apple restriction); it CAN read tags/HCE in background,
 *    and shares via AirDrop through the Web Share sheet. QR + link always work everywhere.
 */
import { isNative, isAndroid, isIOS } from "./capacitor";

export const nfcCapabilities = () => {
  const webNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const hce = !!window?.Capacitor?.Plugins?.BrunoNfcHce;
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
  const plugin = window?.Capacitor?.Plugins?.BrunoNfcHce;
  if (!plugin) return false;
  try { await plugin.startEmulation({ url }); return true; } catch { return false; }
};
export const stopHceEmulation = async () => {
  const plugin = window?.Capacitor?.Plugins?.BrunoNfcHce;
  if (plugin) { try { await plugin.stopEmulation(); } catch { /* ignore */ } }
};
