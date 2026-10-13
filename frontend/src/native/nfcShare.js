/* NFC card transfer helpers — honest cross-platform strategy:
 *  • App nativa (Capacitor, Android + iPhone): @exxili/capacitor-nfc lee tags y escribe la URL en un tag PIUP/NTAG.
 *  • Android Chrome (Web NFC): read tags + write the transfer URL to a PIUP/NTAG tag.
 *  • Native Android (Capacitor): if a HCE plugin is registered as `BrunoNfcHce`, the phone
 *    emulates an NDEF tag with the URL → an iPhone reads it natively with a simple tap.
 *  • iPhone: cannot emulate NFC tags (Apple restriction); it CAN read tags/HCE,
 *    and shares via AirDrop through the Share sheet. QR + link always work everywhere.
 */
import { registerPlugin } from "@capacitor/core";
import { NFC } from "@exxili/capacitor-nfc";
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

let nativeNfc = null;
export const checkNativeNfc = async () => {
  if (nativeNfc !== null) return nativeNfc;
  try { nativeNfc = isNative() && !!(await NFC.isSupported())?.supported; } catch { nativeNfc = false; }
  return nativeNfc;
};

export const nfcCapabilities = () => {
  const webNfc = typeof window !== "undefined" && "NDEFReader" in window;
  const hce = hceSupported === true || !!window?.Capacitor?.Plugins?.BrunoNfcHce;
  return {
    webNfc: webNfc || nativeNfc === true,
    nativeNfc: nativeNfc === true,
    hce,
    native: isNative(),
    android: isAndroid() || /android/i.test(navigator.userAgent),
    ios: isIOS() || /iphone|ipad|ipod/i.test(navigator.userAgent),
    canShare: typeof navigator !== "undefined" && !!navigator.share,
  };
};

const abortError = () => Object.assign(new Error("aborted"), { name: "AbortError" });

const nativeWrite = (url, signal) => new Promise((resolve, reject) => {
  let done = false;
  const offs = [];
  const finish = (fn) => { if (done) return; done = true; offs.forEach((o) => { try { o(); } catch { /* ignore */ } }); fn(); };
  offs.push(NFC.onWrite(() => finish(() => resolve(true))));
  offs.push(NFC.onError((e) => finish(() => reject(new Error(e?.error || "NFC error")))));
  signal?.addEventListener("abort", () => { NFC.cancelWriteAndroid?.().catch(() => {}); NFC.cancelScan?.().catch(() => {}); finish(() => reject(abortError())); });
  NFC.writeNDEF({ records: [{ type: "U", payload: url }] }).catch((e) => finish(() => reject(e)));
});

const nativeRead = (signal) => new Promise((resolve, reject) => {
  let done = false;
  const offs = [];
  const finish = (fn) => { if (done) return; done = true; offs.forEach((o) => { try { o(); } catch { /* ignore */ } }); fn(); };
  offs.push(NFC.onRead((data) => {
    const msgs = data.string?.().messages || [];
    for (const m of msgs) for (const r of m.records || []) {
      const p = String(r.payload || "");
      if (/^https?:\/\//i.test(p)) return finish(() => resolve(p));
    }
    finish(() => reject(new Error("El tag no contiene un enlace")));
  }));
  offs.push(NFC.onError((e) => finish(() => reject(new Error(e?.error || "NFC error")))));
  signal?.addEventListener("abort", () => { NFC.cancelScan?.().catch(() => {}); finish(() => reject(abortError())); });
  NFC.startScan().catch((e) => finish(() => reject(e)));
});

/** Write the URL as an NDEF record on the next tag/phone that touches the device. */
export const writeUrlToTag = async (url, { signal } = {}) => {
  if (await checkNativeNfc()) return nativeWrite(url, signal);
  if (!("NDEFReader" in window)) throw new Error("NFC no disponible en este navegador");
  const ndef = new window.NDEFReader();
  await ndef.write({ records: [{ recordType: "url", data: url }] }, { signal });
  return true;
};

/** Listen for a tag; resolves with the first URL record found. */
export const readTagUrl = async ({ signal } = {}) => {
  if (await checkNativeNfc()) return nativeRead(signal);
  return new Promise((resolve, reject) => {
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
};

/** Android native HCE (phone acts as an NFC tag the iPhone can read). No-op if plugin missing. */
export const startHceEmulation = async (url) => {
  if (!(await checkHceSupport())) return false;
  try { return !!(await BrunoNfcHce.startEmulation({ url }))?.emulating; } catch { return false; }
};
export const stopHceEmulation = async () => {
  if (hceSupported !== true) return;
  try { await BrunoNfcHce.stopEmulation(); } catch { /* ignore */ }
};
