/* Capacidades del dispositivo (solo app nativa). Android: plugin BrunoDeviceCaps (MainActivity). iOS/web: valores seguros. */
import { registerPlugin } from '@capacitor/core';
import { isNative, isIOS } from './capacitor';

const NONE = { firebase: false, playServices: false, nfc: false, biometricHardware: false, browser: true, customTabs: false };
const BrunoDeviceCaps = registerPlugin('BrunoDeviceCaps', { web: () => Promise.resolve({ get: async () => NONE }) });

let cached = null;
export async function deviceCaps() {
  if (cached) return cached;
  if (!isNative()) return (cached = { ...NONE, native: false });
  try {
    cached = { ...NONE, ...(await BrunoDeviceCaps.get()), native: true };
  } catch {
    // iOS no registra este plugin: Firebase se decide en AppDelegate (GoogleService-Info.plist) y register() no hace crash sin él.
    cached = { ...NONE, firebase: isIOS(), native: true };
  }
  return cached;
}
