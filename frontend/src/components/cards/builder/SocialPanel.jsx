import React from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SocialLinkSelector from "@/components/SocialLinkSelector";
import LocationSelector from "@/components/LocationSelector";
import LinksEditor from "./LinksEditor";
import { Section } from "./controls";

const SocialPanel = ({ card, update }) => (
  <div className="space-y-3" data-testid="panel-social">
    <Section title="Enlaces destacados" testId="section-links">
      <p className="text-xs text-muted-foreground -mt-1">Botones grandes con título y destino. Arrástralos con las flechas para ordenarlos.</p>
      <LinksEditor links={card.links || []} onChange={(links) => update({ links })} />
    </Section>
    <Section title="Redes sociales y enlaces" testId="section-social">
      <SocialLinkSelector links={card.social_links || []} onChange={(links) => update({ social_links: links })} />
    </Section>
    <Section title="Ubicación" defaultOpen={!!card.location} testId="section-location">
      <LocationSelector location={card.location} onChange={(location) => update({ location })} />
      {(card.locations || []).map((loc, idx) => (
        <div key={`loc-${idx}`} className="flex items-start gap-2 p-3 rounded-xl border bg-muted/30">
          <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-1">
            <Input value={loc.label || ""} onChange={(e) => update((p) => { const l = [...p.locations]; l[idx] = { ...l[idx], label: e.target.value }; return { ...p, locations: l }; })} placeholder="Etiqueta (ej: Oficina Central)" className="h-7 text-xs" />
            <Input value={loc.address || ""} onChange={(e) => update((p) => { const l = [...p.locations]; l[idx] = { ...l[idx], address: e.target.value }; return { ...p, locations: l }; })} placeholder="Dirección" className="h-7 text-xs" />
          </div>
          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => update((p) => ({ ...p, locations: p.locations.filter((_, i) => i !== idx) }))}><Trash2 className="w-3 h-3 text-destructive" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-full rounded-full" onClick={() => update((p) => ({ ...p, locations: [...(p.locations || []), { lat: 0, lng: 0, address: "", label: "" }] }))} data-testid="add-location-btn"><Plus className="w-3.5 h-3.5 mr-1.5" />Agregar otra ubicación</Button>
    </Section>
  </div>
);

export default SocialPanel;
