/* Cuentas recordadas en este dispositivo: solo identificadores públicos (id, nombre, usuario, avatar, correo). Nunca contraseñas.
 * En la app nativa se guarda además, cifrado en el dispositivo, el token de cada cuenta para restaurarla tras Face ID/huella. */
import { secureStorage } from "@/utils/secureStorage";
import { isNative } from "@/native/capacitor";

const KEY = "bruno_accounts";
const tokenKey = (id) => `bruno_acct_token_${id}`;

export async function listAccounts() {
  try { return JSON.parse((await secureStorage.getItem(KEY)) || "[]"); } catch { return []; }
}

export async function rememberAccount(user, token) {
  if (!user?.id) return;
  const list = (await listAccounts()).filter((a) => a.id !== user.id);
  list.unshift({ id: user.id, name: user.name || "", username: user.username || "", email: user.email || "", avatar_url: user.avatar_url || user.profile?.avatar_url || "", last_used: Date.now() });
  await secureStorage.setItem(KEY, JSON.stringify(list.slice(0, 6)));
  if (isNative() && token) await secureStorage.setItem(tokenKey(user.id), token);
}

export async function forgetAccount(id) {
  const list = (await listAccounts()).filter((a) => a.id !== id);
  await secureStorage.setItem(KEY, JSON.stringify(list));
  secureStorage.removeItem(tokenKey(id));
  return list;
}

/** Al cerrar sesión se elimina el token guardado de esa cuenta; la cuenta sigue en la lista hasta que el usuario la quite. */
export function dropAccountToken(id) { if (id) secureStorage.removeItem(tokenKey(id)); }

export async function storedAccountToken(id) {
  if (!isNative()) return null;
  try { return await secureStorage.getItem(tokenKey(id)); } catch { return null; }
}

export const maskEmail = (e = "") => { const i = e.indexOf("@"); return i > 1 ? `${e[0]}${"•".repeat(Math.min(6, i - 1))}${e.slice(i)}` : e; };
export const initials = (name = "") => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "B";
