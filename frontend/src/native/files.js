/* Guardar / exportar archivos: nativo → Filesystem + hoja de compartir (galería, Archivos, AirDrop…); web → descarga. */
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isNative } from "./capacitor";

const toBase64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] || "");
  r.onerror = rej;
  r.readAsDataURL(blob);
});

async function asBlob(src) {
  if (src instanceof Blob) return src;
  const r = await fetch(src);
  return r.blob();
}

/** src: Blob | dataURL | URL. Devuelve "shared" | "downloaded" | "cancelled". */
export async function saveToDevice(src, filename, { title, text } = {}) {
  const blob = await asBlob(src);
  if (isNative()) {
    const data = await toBase64(blob);
    const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    try {
      await Share.share({ title: title || filename, text, files: [uri], dialogTitle: "Guardar o compartir" });
      return "shared";
    } catch (e) {
      return /cancel/i.test(e?.message || "") ? "cancelled" : "shared";
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}
