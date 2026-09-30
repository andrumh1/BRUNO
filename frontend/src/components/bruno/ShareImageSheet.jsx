import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, ImageDown } from "lucide-react";
import BrunoLogo from "@/components/bruno/BrunoLogo";

const PRESETS = [["#FF6A00", "Naranja"], ["#F9F1EA", "Crema"], ["#474747", "Gris"], ["#FFFFFF", "Blanco"], ["#1F1F1F", "Noche"], ["#0EA5E9", "Cielo"], ["#16A34A", "Bosque"], ["#DB2777", "Fresa"]];

/**
 * ShareImageSheet — plantilla editable antes de generar la imagen (tarjeta, perfil o reel).
 *  onGenerate({ format, bgColor, phrase }) → Promise
 */
export default function ShareImageSheet({ open, onClose, title = "Imagen para redes", defaultColor = "#FF6A00", defaultPhrase = "", formats = ["story", "square"], onGenerate }) {
  const [format, setFormat] = useState(formats[0]);
  const [bgColor, setBgColor] = useState(defaultColor);
  const [phrase, setPhrase] = useState(defaultPhrase);
  const [busy, setBusy] = useState(false);
  const run = async () => { if (busy) return; setBusy(true); try { await onGenerate({ format, bgColor, phrase: phrase.trim() }); onClose(); } finally { setBusy(false); } };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto" data-testid="share-image-sheet">
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
              <div className={`${format === "square" ? "w-16 h-16" : "w-12 h-20"} rounded-lg bg-white/85 grid place-items-center`}><BrunoLogo variant="icon" tone="orange" className="w-6" /></div>
            </div>
            <Button onClick={run} disabled={busy} className="flex-1 rounded-full h-11 shadow-lg shadow-primary/25" data-testid="share-generate-btn">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ImageDown className="w-4 h-4 mr-2" />} Generar y compartir
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
