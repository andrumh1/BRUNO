import React, { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Ordered featured links (title + destination). Rendered by LinksBlock as pill buttons.
const LinksEditor = ({ links = [], onChange }) => {
  const [draft, setDraft] = useState({ title: "", url: "" });
  const set = (i, k, v) => onChange(links.map((l, j) => (j === i ? { ...l, [k]: v } : l)));
  const move = (i, d) => { const j = i + d; if (j < 0 || j >= links.length) return; const o = [...links]; [o[i], o[j]] = [o[j], o[i]]; onChange(o); };
  const add = () => { if (!draft.title.trim() || !draft.url.trim()) return; onChange([...links, { title: draft.title.trim(), url: draft.url.trim() }]); setDraft({ title: "", url: "" }); };
  return (
    <div className="space-y-2" data-testid="links-editor">
      {links.map((l, i) => (
        <div key={i} className="flex items-start gap-2 p-2.5 rounded-xl border bg-muted/30" data-testid={`link-row-${i}`}>
          <Link2 className="w-4 h-4 text-primary mt-2 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <Input value={l.title || ""} onChange={(e) => set(i, "title", e.target.value)} placeholder="Título del enlace" className="h-8 text-xs rounded-lg" data-testid={`link-title-${i}`} />
            <Input value={l.url || ""} onChange={(e) => set(i, "url", e.target.value)} placeholder="https://" className="h-8 text-xs rounded-lg" data-testid={`link-url-${i}`} />
          </div>
          <div className="flex flex-col items-center shrink-0">
            <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1 text-muted-foreground disabled:opacity-30" aria-label="Subir" data-testid={`link-up-${i}`}><ChevronUp className="w-4 h-4" /></button>
            <button type="button" disabled={i === links.length - 1} onClick={() => move(i, 1)} className="p-1 text-muted-foreground disabled:opacity-30" aria-label="Bajar" data-testid={`link-down-${i}`}><ChevronDown className="w-4 h-4" /></button>
            <button type="button" onClick={() => onChange(links.filter((_, j) => j !== i))} className="p-1 text-destructive" aria-label="Eliminar" data-testid={`link-remove-${i}`}><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ver portafolio" className="h-9 text-xs rounded-lg" data-testid="link-new-title" />
        <Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="https://" className="h-9 text-xs rounded-lg" onKeyDown={(e) => e.key === "Enter" && add()} data-testid="link-new-url" />
        <Button type="button" size="sm" className="rounded-full h-9" onClick={add} disabled={!draft.title.trim() || !draft.url.trim()} data-testid="link-add-btn"><Plus className="w-4 h-4" /></Button>
      </div>
    </div>
  );
};

export default LinksEditor;
