// Hand-off of a picked file between the publish menu and the editor: selecting a file never publishes anything.
let pending = null;
export const setPendingMedia = (file, meta = {}) => { pending = file ? { file, meta, at: Date.now() } : null; };
export const takePendingMedia = () => { const p = pending; pending = null; return p && Date.now() - p.at < 5 * 60 * 1000 ? p : null; };
