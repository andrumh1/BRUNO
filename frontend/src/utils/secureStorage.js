/**
 * Secure Token Storage - Encrypts tokens before storing in localStorage.
 * Uses Web Crypto API for AES-GCM encryption.
 * Falls back to in-memory storage if crypto is unavailable.
 */

const STORAGE_PREFIX = 'bruno_sec_';
let memoryStore = {};
let cryptoKey = null;

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
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    delete memoryStore[key];
  },

  clear() {
    Object.keys(localStorage).forEach(k => {
      if (k.startsWith(STORAGE_PREFIX) && k !== `${STORAGE_PREFIX}dk`) {
        localStorage.removeItem(k);
      }
    });
    memoryStore = {};
  },
};
