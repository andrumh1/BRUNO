/**
 * Secure Token Storage.
 * Native (Capacitor): iOS Keychain / Android Keystore. Web: AES-GCM in localStorage.
 * Falls back to in-memory storage if crypto is unavailable.
 */
import { Capacitor } from '@capacitor/core';

const STORAGE_PREFIX = 'bruno_sec_';
let memoryStore = {};
let cryptoKey = null;

/* App nativa: Keychain (iOS) / Keystore (Android) vía @aparajita/capacitor-secure-storage. Web: AES-GCM en localStorage. */
let _native;
const isNative = () => { try { return Capacitor.isNativePlatform(); } catch { return false; } };
async function nativePlugin() {
  if (!_native) {
    const { SecureStorage, KeychainAccess } = await import('@aparajita/capacitor-secure-storage');
    await SecureStorage.setKeyPrefix('bruno_').catch(() => {});
    await SecureStorage.setSynchronize(false).catch(() => {}); // nunca iCloud Keychain: la sesión se queda en este dispositivo
    _native = { SecureStorage, KeychainAccess };
  }
  return _native;
}
const nativeSet = async (k, v) => { const { SecureStorage, KeychainAccess } = await nativePlugin(); await SecureStorage.set(k, v, false, false, KeychainAccess.afterFirstUnlockThisDeviceOnly); };
const nativeGet = async (k) => { const { SecureStorage } = await nativePlugin(); const v = await SecureStorage.get(k, false, false); return typeof v === 'string' ? v : (v == null ? null : JSON.stringify(v)); };
const nativeRemove = async (k) => { const { SecureStorage } = await nativePlugin(); await SecureStorage.remove(k, false); };
const nativeClear = async () => { const { SecureStorage } = await nativePlugin(); await SecureStorage.clear(false); };

async function getOrCreateKey() {
  if (cryptoKey) return cryptoKey;
  
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}dk`);
    if (stored) {
      const raw = Uint8Array.from(atob(stored), c => c.charCodeAt(0));
      cryptoKey = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
      return cryptoKey;
    }
    
    cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const exported = await crypto.subtle.exportKey('raw', cryptoKey);
    localStorage.setItem(`${STORAGE_PREFIX}dk`, btoa(String.fromCharCode(...new Uint8Array(exported))));
    return cryptoKey;
  } catch {
    return null;
  }
}

async function encrypt(text) {
  const key = await getOrCreateKey();
  if (!key) return null;
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(data) {
  const key = await getOrCreateKey();
  if (!key) return null;
  
  const combined = Uint8Array.from(atob(data), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

export const secureStorage = {
  async setItem(key, value) {
    if (isNative()) { try { await nativeSet(key, value); return; } catch (err) { console.warn("[secureStorage] Keychain/Keystore set failed", err?.message); } }
    try {
      const encrypted = await encrypt(value);
      if (encrypted) {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, encrypted);
        return;
      }
    } catch (err) {
      // crypto unavailable → fallback to in-memory store. Logged so devs can spot
      // browsers that disabled Web Crypto (private mode, old browsers).
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[secureStorage] setItem encrypt failed, using memory fallback", err?.message);
      }
    }
    memoryStore[key] = value;
  },

  async getItem(key) {
    if (isNative()) {
      try {
        const v = await nativeGet(key);
        if (v != null) return v;
        // Migración única: valor cifrado en localStorage (versiones anteriores) → Keychain/Keystore
        const legacy = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (legacy) {
          const plain = await decrypt(legacy).catch(() => null);
          if (plain) { await nativeSet(key, plain); localStorage.removeItem(`${STORAGE_PREFIX}${key}`); return plain; }
        }
        return memoryStore[key] || null;
      } catch (err) { console.warn("[secureStorage] Keychain/Keystore get failed", err?.message); }
    }
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (stored) {
        return await decrypt(stored);
      }
    } catch (err) {
      // decryption failed (key changed, tampered, or crypto unavailable)
      if (typeof console !== "undefined" && console.warn) {
        console.warn("[secureStorage] getItem decrypt failed, using memory fallback", err?.message);
      }
    }
    return memoryStore[key] || null;
  },

  removeItem(key) {
    if (isNative()) nativeRemove(key).catch(() => {});
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    delete memoryStore[key];
  },

  clear() {
    if (isNative()) nativeClear().catch(() => {});
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(STORAGE_PREFIX) && k !== `${STORAGE_PREFIX}dk`) {
        localStorage.removeItem(k);
      }
    });
    memoryStore = {};
  },
};
