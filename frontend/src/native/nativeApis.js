/**
 * Small wrappers so components can call native APIs without branching everywhere.
 *
 *   const photo = await takePhoto();      // opens native camera or falls back to file input
 *   const pos = await getCurrentLocation();
 *   await shareContent({ title, text, url });
 *   await triggerHaptic();
 */
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './capacitor';
export { saveToDevice } from './files';

export async function takePhoto({ source = 'camera' } = {}) {
  if (!isNative()) {
    // Web fallback: open file input programmatically.
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      if (source === 'camera') input.setAttribute('capture', 'environment');
      input.onchange = () => resolve(input.files?.[0] || null);
      input.oncancel = () => reject(new Error('cancelled'));
      input.click();
    });
  }
  const image = await Camera.getPhoto({
    quality: 88,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: source === 'gallery' ? CameraSource.Photos : CameraSource.Camera,
    saveToGallery: false,
  });
  return image; // { dataUrl, format, ... }
}

export async function getCurrentLocation() {
  if (!isNative()) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('geolocation unsupported'));
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ coords: p.coords, timestamp: p.timestamp }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }
  return Geolocation.getCurrentPosition({ enableHighAccuracy: true });
}

export async function shareContent({ title, text, url }) {
  if (isNative()) return Share.share({ title, text, url });
  if (navigator.share) return navigator.share({ title, text, url });
  await navigator.clipboard.writeText(url || text || '');
  return { activityType: 'clipboard' };
}

export async function triggerHaptic(style = 'medium') {
  if (!isNative()) { try { navigator.vibrate?.(style === 'light' ? 6 : style === 'heavy' ? 18 : 10); } catch { /* no-op */ } return; }
  const map = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
  await Haptics.impact({ style: map[style] || ImpactStyle.Medium }).catch(() => {});
}

export async function hapticNotify(type = 'success') {
  if (!isNative()) return;
  const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
  await Haptics.notification({ type: map[type] || NotificationType.Success }).catch(() => {});
}
