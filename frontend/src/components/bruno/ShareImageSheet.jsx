import React, { useEffect, useState } from "react";
import axios from "axios";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ImageDown, Sparkles, Trash2, Share2 } from "lucide-react";
import BrunoLogo from "@/components/bruno/BrunoLogo";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { shareBlob } from "@/lib/cardShareImage";
import { listHistory, saveToHistory, removeFromHistory } from "@/lib/shareHistory";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const PRESETS = [["#FF6A00", "Naranja"], ["#F9F1EA", "Crema"], ["#474747", "Gris"], ["#FFFFFF", "Blanco"], ["#1F1F1F", "Noche"], ["#0EA5E9", "Cielo"], ["#16A34A", "Bosque"], ["#DB2777", "Fresa"]];

/** Sube la imagen y la publica como historia BRUNO. */
async function publishStory(blob, { token, caption, link }) {
  const fd = new FormData(); fd.append("file", new File([blob], "bruno-story.png", { type: "image/png" }));
  const up = await axios.post(`${API}/upload/image?folder=bruno/stories`, fd, { headers: { Authorization: `Bearer ${token}` } });
  await axios.post(`${API}/stories/`, { media_url: up.data.url, media_type: "image", caption: (caption || "").slice(0, 200), link_url: link || null, link_text: link ? "Ver en BRUNO" : null, duration: 7 }, { headers: { Authorization: `Bearer ${token}` } });
}

/**
 * ShareImageSheet — plantilla editable + compartir, publicar como historia BRUNO e historial.
 *  render({ format, bgColor, phrase }) → Promise<{ blob, name, text, link, label }>
 */
export default function ShareImageSheet({ open, onClose, title = "Imagen para redes", defaultColor = "#FF6A00", defaultPhrase = "", formats = ["story", "square"], render, kind = "card" }) {
  const { token } = useAuth();
  const [format, setFormat] = useState(formats[0]);
  const [bgColor, setBgColor] = useState(defaultColor);
  const [phrase, setPhrase] = useState(defaultPhrase);
  const [busy, setBusy] = useState(null);
  const [history, setHistory] = useState([]);
  useEffect(() => { if (open) listHistory().then(setHistory); }, [open]);

  const produce = async () => {
    const out = await render({ format, bgColor, phrase: phrase.trim() });
    const item = await saveToHistory({ ...out, kind });
    if (item) setHistory((h) => [item, ...h.filter((x) => x.id !== item.id)].slice(0, 12));
    return out;
  };
  const doShare = async (out) => {
    const res = await shareBlob(out.blob, out.name, out.text);
    if (res === "downloaded") brunoToast.success("Imagen lista", { description: "Guardada para Instagram, WhatsApp o LinkedIn." });
    else if (res === "shared") brunoToast.publish("Imagen compartida");
  };
  const doStory = async (out) => {
    if (!token) { brunoToast.error("Inicia sesión para publicar historias"); return; }
    await publishStory(out.blob, { token, caption: out.text, link: out.link });
    brunoToast.publish("¡Historia publicada en BRUNO!", { description: "Ya la pueden ver tus seguidores." });
  };
  const run = async (mode) => {
    if (busy) return; setBusy(mode);
    try { const out = await produce(); if (mode === "story") await doStory(out); else await doShare(out); onClose(); }
    catch (e) { brunoToast.error("No se pudo generar la imagen", { description: e?.response?.data?.detail || e?.message }); }
    finally { setBusy(null); }
  };
  const reuse = async (item, mode) => {
    if (busy) return; setBusy(`${mode}-${item.id}`);
    try { if (mode === "story") await doStory(item); else await doShare(item); onClose(); }
    catch (e) { brunoToast.error("No se pudo compartir", { description: e?.message }); }
    finally { setBusy(null); }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto" data-testid="share-image-sheet">
        <SheetHeader className="text-left"><SheetTitle className="flex items-center gap-2"><BrunoLogo variant="icon" tone="orange" className="h-5" />{title}</SheetTitle></SheetHeader>
        <div className="space-y-5 pt-3" style={{ paddingBottom: "calc(var(--nav-reserve, 64px) + env(safe-area-inset-bottom, 0px) + 16px)" }}>
          {formats.length > 1 && (
            <div className="flex gap-2" data-testid="share-format">
              {formats.map((f) => (
                <button key={f} onClick={() => setFormat(f)} aria-pressed={format === f} data-testid={`share-format-${f}`}
                  className={`flex-1 rounded-2xl py-2.5 text-xs font-semibold transition ${format === f ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : "bg-muted text-muted-foreground"}`}>
                  {f === "story" ? "Historia 9:16" : "Cuadrada 1:1"}
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="text-sm font-medium mb-2">Color de fondo</p>
            <div className="flex flex-wrap gap-2 items-center" data-testid="share-colors">
              {PRESETS.map(([hex, label]) => (
                <button key={hex} title={label} onClick={() => setBgColor(hex)} aria-pressed={bgColor.toUpperCase() === hex} data-testid={`share-color-${hex.slice(1).toLowerCase()}`}
                  className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${bgColor.toUpperCase() === hex ? "border-primary ring-2 ring-primary/30 scale-110" : "border-black/10"}`} style={{ backgroundColor: hex }} />
              ))}
              <label className="w-9 h-9 rounded-full border-2 border-dashed border-border grid place-items-center cursor-pointer text-[10px] font-bold text-muted-foreground" title="Color personalizado">
                +<input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="sr-only" data-testid="share-color-custom" />
              </label>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Frase</p>
            <Input value={phrase} onChange={(e) => setPhrase(e.target.value.slice(0, 120))} placeholder="Escribe una frase para la imagen…" data-testid="share-phrase" />
            <p className="text-[11px] text-muted-foreground mt-1">{phrase.length}/120 · vacío usa el texto original</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/60 p-2 shrink-0" style={{ backgroundColor: bgColor }} data-testid="share-preview">
              <div className={`${format === "square" ? "w-14 h-14" : "w-11 h-[76px]"} rounded-lg bg-white/85 grid place-items-center`}><BrunoLogo variant="icon" tone="orange" className="w-6" /></div>
            </div>
            <div className="flex-1 grid gap-2">
              <Button onClick={() => run("share")} disabled={!!busy} className="rounded-full h-11 shadow-lg shadow-primary/25" data-testid="share-generate-btn">
                {busy === "share" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />} Generar y compartir
              </Button>
              {format === "story" && (
                <Button onClick={() => run("story")} disabled={!!busy} variant="outline" className="rounded-full h-11 border-primary/40 text-primary hover:bg-primary/10" data-testid="share-story-btn">
                  {busy === "story" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />} Publicar como historia BRUNO
                </Button>
              )}
            </div>
          </div>
          {history.length > 0 && (
            <div data-testid="share-history">
              <p className="text-sm font-medium mb-2">Recientes <span className="text-muted-foreground font-normal text-xs">· vuelve a compartir sin regenerar</span></p>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
                {history.map((h) => (
                  <HistoryThumb key={h.id} item={h} busy={busy} onShare={() => reuse(h, "share")} onStory={() => reuse(h, "story")} onRemove={async () => { await removeFromHistory(h.id); setHistory((l) => l.filter((x) => x.id !== h.id)); }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function HistoryThumb({ item, busy, onShare, onStory, onRemove }) {
  const [src, setSrc] = useState(null);
  useEffect(() => { const u = URL.createObjectURL(item.blob); setSrc(u); return () => URL.revokeObjectURL(u); }, [item.blob]);
  const story = item.name?.includes("story") || item.name?.startsWith("bruno-reel");
  return (
    <div className="shrink-0 w-24 flex flex-col gap-1.5" data-testid="share-history-item">
      <div className={`relative rounded-xl overflow-hidden border border-border/60 bg-muted ${story ? "h-40" : "h-24"}`}>
        {src && <img src={src} alt="" className="w-full h-full object-cover" />}
        <button onClick={onRemove} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white grid place-items-center" aria-label="Quitar" data-testid="share-history-remove"><Trash2 className="w-3 h-3" /></button>
      </div>
      <div className="flex gap-1">
        <button onClick={onShare} disabled={!!busy} className="flex-1 h-7 rounded-full bg-primary text-primary-foreground grid place-items-center" title="Compartir" data-testid="share-history-share">{busy === `share-${item.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />}</button>
        {story && <button onClick={onStory} disabled={!!busy} className="flex-1 h-7 rounded-full bg-muted text-primary grid place-items-center" title="Publicar como historia" data-testid="share-history-story">{busy === `story-${item.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}</button>}
      </div>
    </div>
  );
}
