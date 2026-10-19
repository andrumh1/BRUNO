import { isNative } from "@/native/capacitor";

/**
 * Abre el checkout de Stripe.
 * Web: misma pestaña. App nativa: pestaña in-app (SFSafariViewController / Custom Tab) y, al volver a
 * brunocard.com (success/cancel), el Universal/App Link reabre BRUNO y cerramos la pestaña.
 */
export async function openCheckout(url) {
  if (!url) return;
  if (!isNative()) { window.location.href = url; return; }
  const [{ Browser }, { App }] = await Promise.all([import("@capacitor/browser"), import("@capacitor/app")]);
  const sub = await App.addListener("appUrlOpen", () => { Browser.close().catch(() => {}); sub.remove(); });
  await Browser.open({ url, presentationStyle: "popover" });
}
