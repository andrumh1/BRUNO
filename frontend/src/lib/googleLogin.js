/* Google login (Emergent Auth). Web: redirección normal. Nativo: Custom Tab/SFSafariViewController hacia la web de
 * producción con ?native_auth=1; esa página devuelve el session_id a la app por el esquema com.brunocard.app:// */
import { isNative } from '@/native/capacitor';

export const NATIVE_AUTH_SCHEME = 'com.brunocard.app://auth/callback';
const EMERGENT_AUTH = 'https://auth.emergentagent.com/?redirect=';

export async function startGoogleLogin() {
  if (!isNative()) {
    window.location.href = `${EMERGENT_AUTH}${encodeURIComponent(window.location.origin + '/dashboard')}`;
    return;
  }
  // En la app el origen es https://localhost (no existe fuera del WebView): la vuelta debe caer en la web real.
  const webOrigin = process.env.REACT_APP_BACKEND_URL;
  const url = `${EMERGENT_AUTH}${encodeURIComponent(`${webOrigin}/dashboard?native_auth=1`)}`;
  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.open(url, '_system');
  }
}

export async function closeNativeBrowser() {
  try { const { Browser } = await import('@capacitor/browser'); await Browser.close(); } catch { /* Android Custom Tabs no soporta close(); la app ya está al frente */ }
}
