/**
 * Privacy screen bridge — native anti-capture when running inside Capacitor.
 *  Android: FLAG_SECURE (blocks screenshots + screen recording, black in recents)
 *  iOS:     content hidden when app goes to background / app switcher
 * On the web it degrades to a no-op; PrivacyShield adds the web-side deterrents.
 */
import { isNative, isAndroid } from "./capacitor";

let plugin = null;
async function load() {
  if (plugin || !isNative()) return plugin;
  try {
    const mod = await import("@capacitor-community/privacy-screen");
    plugin = mod.PrivacyScreen;
  } catch (_) { plugin = null; }
  return plugin;
}

export async function enablePrivacyScreen() {
  const p = await load();
  if (!p) return { native: false, blocksScreenshots: false };
  try { await p.enable(); } catch (_) { return { native: false, blocksScreenshots: false }; }
  return { native: true, blocksScreenshots: isAndroid() };
}

export async function disablePrivacyScreen() {
  const p = await load();
  if (!p) return;
  try { await p.disable(); } catch (_) { /* ignore */ }
}
