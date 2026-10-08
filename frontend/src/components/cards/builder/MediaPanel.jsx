import React, { useState } from "react";
import axios from "axios";
import { Upload, Trash2, ImagePlus, Loader2 } from "lucide-react";
import ImageEditor from "@/components/ImageEditor";
import { Section, SliderField, TextField } from "./controls";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Drop = ({ label, hint, url, onPick, onClear, uploading, shape = "wide", testId }) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between"><label className="text-xs font-semibold text-foreground/80">{label}</label><span className="text-[10px] text-muted-foreground">{hint}</span></div>
    {url ? (
      <div className="relative group">
        <img src={url} alt={label} className={`${shape === "square" ? "w-24 h-24 rounded-2xl" : "w-full h-28 rounded-xl"} object-cover border border-border`} />
        <div className="mt-2 flex gap-2">
          <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-border cursor-pointer hover:border-primary/50"><Upload className="w-3.5 h-3.5" />Cambiar<input type="file" accept="image/*" className="hidden" onChange={onPick} data-testid={`${testId}-input`} /></label>
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium border border-border hover:border-destructive/60 hover:text-destructive" data-testid={`${testId}-clear`}><Trash2 className="w-3.5 h-3.5" />Quitar</button>
        </div>
      </div>
    ) : (
      <label className={`flex flex-col items-center justify-center gap-1 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/60 transition-colors ${shape === "square" ? "w-24 h-24" : "w-full h-24"}`} data-testid={testId}>
        <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={uploading} data-testid={`${testId}-input`} />
        {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
        <span className="text-[11px] text-muted-foreground">{uploading ? "Subiendo…" : "Subir"}</span>
      </label>
    )}
  </div>
);

const MediaPanel = ({ card, update, token, design, updateDesign }) => {
  const [editing, setEditing] = useState(null); // {type, src}
  const [busy, setBusy] = useState("");
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const header = design?.layout?.header || "classic";
  const showcase = header !== "classic";
  const sc = card.showcase || {};
  const setSC = (k, v) => update((p) => ({ ...p, showcase: { ...(p.showcase || {}), [k]: v } }));

  const pick = (type) => (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = (ev) => setEditing({ type, src: ev.target.result }); r.readAsDataURL(f); e.target.value = "";
  };
  const upload = async (file) => {
    const { type } = editing; setEditing(null); setBusy(type);
    try {
      const fd = new FormData(); fd.append("file", file);
      const ep = type === "avatar" ? "/upload/avatar" : type === "banner" ? (showcase ? "/upload/image?aspect=4:5" : "/upload/banner") : type === "featured" ? "/upload/image?aspect=free" : "/upload/image?aspect=1:1";
      const { data } = await axios.post(`${API}${ep}`, fd, auth);
      if (type === "gallery") update((p) => ({ ...p, gallery_photos: [...(p.gallery_photos || []), data.url] }));
      else if (type === "featured") setSC("featured_image", data.url);
      else update({ [`${type}_url`]: data.url });
    } catch { brunoToast.error("No se pudo subir la imagen"); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-3" data-testid="panel-media">
      <Section title={showcase ? "Fotografía principal y avatar" : "Avatar y banner"} testId="section-images">
        <div className="flex gap-4 items-start">
          <Drop label="Avatar" hint="400×400" url={card.avatar_url} onPick={pick("avatar")} onClear={() => update({ avatar_url: "" })} uploading={busy === "avatar"} shape="square" testId="drop-avatar" />
          <div className="flex-1 min-w-0"><Drop label={showcase ? "Fotografía principal" : "Banner"} hint={showcase ? "Vertical 4:5 · tu foto" : "1200×400"} url={card.banner_url} onPick={pick("banner")} onClear={() => update({ banner_url: "" })} uploading={busy === "banner"} testId="drop-banner" /></div>
        </div>
        {showcase && !card.banner_url && <p className="text-[11px] text-muted-foreground">Sin fotografía se muestra un fondo elegante. Nunca usamos fotos de otras personas.</p>}
      </Section>
      {design && (showcase || ["image", "fullimage"].includes(design.background.type)) && (
        <Section title="Encuadre de la fotografía" testId="section-framing">
          <p className="text-[11px] text-muted-foreground -mt-1">Mueve el punto de interés para que el rostro quede visible.</p>
          <div className="grid grid-cols-2 gap-3">
            <SliderField label="Horizontal" value={design.hero.focusX} onChange={(v) => updateDesign({ hero: { focusX: v } })} testId="focus-x" />
            <SliderField label="Vertical" value={design.hero.focusY} onChange={(v) => updateDesign({ hero: { focusY: v } })} testId="focus-y" />
          </div>
          <SliderField label="Zoom" value={design.hero.zoom} min={100} max={180} step={2} onChange={(v) => updateDesign({ hero: { zoom: v } })} testId="focus-zoom" />
        </Section>
      )}
      <Section title="Bloque destacado" defaultOpen={!!(sc.featured_title || sc.featured_image)} testId="section-featured">
        <p className="text-[11px] text-muted-foreground -mt-1">Un video, campaña o contenido con imagen, título y enlace. Si no tiene título ni imagen no se muestra.</p>
        <Drop label="Imagen o portada" hint="16:9 recomendado" url={sc.featured_image} onPick={pick("featured")} onClear={() => setSC("featured_image", "")} uploading={busy === "featured"} testId="drop-featured" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Título" value={sc.featured_title} onChange={(v) => setSC("featured_title", v)} placeholder="Nuevo video" testId="input-featured-title" />
          <TextField label="Enlace" value={sc.featured_url} onChange={(v) => setSC("featured_url", v)} placeholder="https://" testId="input-featured-url" />
        </div>
      </Section>
      <Section title="Galería" defaultOpen={(card.gallery_photos || []).length > 0} testId="section-gallery">
        <div className="grid grid-cols-4 gap-2">
          {(card.gallery_photos || []).map((p, i) => (
            <div key={`${p}-${i}`} className="relative aspect-square rounded-xl overflow-hidden group">
              <img src={p} alt="" className="w-full h-full object-cover" />
              <button type="button" onClick={() => update((c) => ({ ...c, gallery_photos: c.gallery_photos.filter((_, j) => j !== i) }))} className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity" data-testid={`gallery-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <label className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60" data-testid="drop-gallery">
            <input type="file" accept="image/*" className="hidden" onChange={pick("gallery")} disabled={!!busy} data-testid="drop-gallery-input" />
            {busy === "gallery" ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <ImagePlus className="w-4 h-4 text-muted-foreground" />}
          </label>
        </div>
      </Section>
      {editing && <ImageEditor imageUrl={editing.src} onSave={upload} onCancel={() => setEditing(null)} />}
    </div>
  );
};

export default MediaPanel;
