// Hand-off of a picked file between the publish menu and the editor: selecting a file never publishes anything.
export const PENDING_MEDIA_EVENT = "bruno:pending-media";
let pending = null;
export const setPendingMedia = (file, meta = {}) => {
  pending = file ? { file, meta, at: Date.now() } : null;
  if (pending) window.dispatchEvent(new CustomEvent(PENDING_MEDIA_EVENT));
};
export const takePendingMedia = () => { const p = pending; pending = null; return p && Date.now() - p.at < 5 * 60 * 1000 ? p : null; };
export const hasPendingMedia = () => !!pending;
