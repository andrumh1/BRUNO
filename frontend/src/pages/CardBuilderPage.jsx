import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Undo2, Redo2, Smartphone, Tablet, Monitor, Eye, Rocket, Check, Loader2, AlertCircle, Type, Image as ImageIcon, Share2, Palette, LayoutGrid, Sparkles, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useCardBuilder } from "@/hooks/useCardBuilder";
import BrunoLoader from "@/components/bruno/BrunoLoader";
import CardRenderer from "@/components/cards/CardRenderer";
import PresetPicker from "@/components/cards/builder/PresetPicker";
import ContentPanel from "@/components/cards/builder/ContentPanel";
import MediaPanel from "@/components/cards/builder/MediaPanel";
import SocialPanel from "@/components/cards/builder/SocialPanel";
import DesignPanel from "@/components/cards/builder/DesignPanel";
import ComponentsPanel, { EffectsPanel } from "@/components/cards/builder/ComponentsPanel";
import TypeFieldsPanel from "@/components/cards/builder/TypeFieldsPanel";
import { brunoToast } from "@/components/bruno/BrunoToast";

const TABS = [
  { id: "content", label: "Contenido", Icon: Type }, { id: "media", label: "Multimedia", Icon: ImageIcon }, { id: "social", label: "Redes", Icon: Share2 },
  { id: "design", label: "Diseño", Icon: Palette }, { id: "components", label: "Componentes", Icon: LayoutGrid }, { id: "effects", label: "Efectos", Icon: Sparkles }, { id: "type", label: "Campos del tipo", Icon: ListChecks },
];
const DEVICES = [{ id: "mobile", w: 390, Icon: Smartphone }, { id: "tablet", w: 720, Icon: Tablet }, { id: "desktop", w: 1080, Icon: Monitor }];

const SaveStatus = ({ status }) => {
  const map = { saving: ["Guardando…", Loader2, "animate-spin"], saved: ["Guardado", Check, "text-emerald-500"], dirty: ["Cambios sin guardar", null, ""], error: ["Error al guardar", AlertCircle, "text-destructive"], idle: ["Guardado automático", null, ""] };
  const [label, Icon, cls] = map[status] || map.idle;
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="save-status" data-status={status}>{Icon && <Icon className={`w-3.5 h-3.5 ${cls}`} />}{label}</span>;
};

const Preview = ({ card, device, setDevice, isNew, showDevices = true }) => (
  <div className="flex flex-col items-center gap-4 w-full" data-testid="live-preview">
    {showDevices && <div className="inline-flex rounded-full border border-border bg-background/70 p-1" data-testid="device-toggle">
      {DEVICES.map(({ id, Icon }) => <button key={id} type="button" onClick={() => setDevice(id)} className={`w-9 h-8 rounded-full flex items-center justify-center transition-colors ${device === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} data-testid={`device-${id}`}><Icon className="w-4 h-4" /></button>)}
    </div>}
    <div className="w-full transition-[max-width] duration-300" style={{ maxWidth: DEVICES.find((d) => d.id === device).w }}>
      <CardRenderer data={card} design={card.card_design} cardId={isNew ? null : card.id} onChat={() => {}} />
    </div>
  </div>
);

export default function CardBuilderPage() {
  const { cardId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const b = useCardBuilder({ cardId, token, onCreated: (id) => navigate(`/cards/${id}/edit`, { replace: true }) });
  const [tab, setTab] = useState("content");
  const [device, setDevice] = useState("mobile");
  const [mobilePreview, setMobilePreview] = useState(false);
  const [styleStep, setStyleStep] = useState(!cardId);

  if (b.status === "loading" || !b.card) return b.error ? <div className="min-h-screen flex items-center justify-center text-center p-6"><div><AlertCircle className="w-10 h-10 mx-auto text-destructive mb-3" /><p className="font-semibold">{b.error}</p><Button className="mt-4" onClick={() => navigate("/my-profile")}>Volver</Button></div></div> : <BrunoLoader />;
  const { card } = b;
  const canPublish = !!card.title?.trim();

  const publish = async () => {
    if (!canPublish) { brunoToast.error("Escribe un nombre o título antes de publicar"); setTab("content"); return; }
    const id = await b.publish();
    if (id) { brunoToast.success(card.is_draft ? "¡Tarjeta publicada!" : "Cambios guardados"); navigate(`/c/${id}`); }
  };

  const panel = {
    content: <ContentPanel card={card} update={b.update} design={card.card_design} />, media: <MediaPanel card={card} update={b.update} token={token} design={card.card_design} updateDesign={b.updateDesign} />, social: <SocialPanel card={card} update={b.update} />,
    design: <DesignPanel card={card} design={card.card_design} setPreset={b.setPreset} updateDesign={b.updateDesign} resetDesign={b.resetDesign} />,
    components: <ComponentsPanel design={card.card_design} updateDesign={b.updateDesign} />, effects: <EffectsPanel design={card.card_design} updateDesign={b.updateDesign} />,
    type: <TypeFieldsPanel card={card} update={b.update} />,
  }[tab];

  return (
    <div className="min-h-screen bg-background pb-28 lg:pb-0" data-testid="card-builder-page">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="px-3 sm:px-5 h-14 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} data-testid="builder-back-btn"><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold leading-tight tracking-tight">BRUNO Card Builder</div>
            <SaveStatus status={b.status} />
          </div>
          <div className="hidden sm:flex items-center gap-1 mr-1">
            <Button variant="ghost" size="icon" onClick={b.undo} disabled={!b.canUndo} title="Deshacer" data-testid="undo-btn"><Undo2 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={b.redo} disabled={!b.canRedo} title="Rehacer" data-testid="redo-btn"><Redo2 className="w-4 h-4" /></Button>
          </div>
          <Button onClick={publish} className="rounded-full" disabled={b.status === "saving"} data-testid="publish-btn"><Rocket className="w-4 h-4 mr-1.5" />{card.is_draft ? "Publicar" : "Guardar y ver"}</Button>
        </div>
      </header>

      {styleStep ? (
        <div className="max-w-5xl mx-auto px-4 py-6 lg:py-10 grid lg:grid-cols-[1fr_380px] gap-8 items-start" data-testid="style-step">
          <div>
            <PresetPicker value={card.card_design.preset} onPick={b.setPreset} data={card} />
            <div className="mt-6 flex items-center gap-3">
              <Button size="lg" className="rounded-full" onClick={() => setStyleStep(false)} data-testid="use-style-btn"><Check className="w-4 h-4 mr-1.5" />Usar este estilo</Button>
              <span className="text-xs text-muted-foreground">Podrás cambiarlo todo después.</span>
            </div>
          </div>
          <div className="hidden lg:block lg:sticky lg:top-20"><CardRenderer data={card} design={card.card_design} /></div>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[minmax(380px,460px)_1fr] lg:h-[calc(100vh-56px)]">
          {/* Editor */}
          <div className="lg:overflow-y-auto lg:border-r border-border/60">
            <div className="sticky top-14 lg:top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/60">
              <div className="flex gap-1 px-3 py-2 overflow-x-auto no-scrollbar" data-testid="builder-tabs">
                {TABS.map(({ id, label, Icon }) => (
                  <button key={id} type="button" onClick={() => setTab(id)} className={`shrink-0 inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-xs font-semibold transition-colors ${tab === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}`} data-testid={`tab-${id}`}><Icon className="w-3.5 h-3.5" />{label}</button>
                ))}
              </div>
            </div>
            <div className="p-3 sm:p-4">{panel}</div>
          </div>
          {/* Live preview (desktop) */}
          <div className="hidden lg:flex lg:overflow-y-auto p-8 justify-center bg-[radial-gradient(ellipse_at_top,rgba(255,106,0,0.08),transparent_60%)]">
            <Preview card={card} device={device} setDevice={setDevice} isNew={b.isNew} />
          </div>
        </div>
      )}

      {/* Mobile: floating preview + undo/redo */}
      {!styleStep && (
        <div className="lg:hidden fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
          <div className="flex gap-1 rounded-full border border-border bg-background/90 backdrop-blur p-1 shadow-lg">
            <button type="button" onClick={b.undo} disabled={!b.canUndo} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30" data-testid="undo-btn-mobile"><Undo2 className="w-4 h-4" /></button>
            <button type="button" onClick={b.redo} disabled={!b.canRedo} className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-30" data-testid="redo-btn-mobile"><Redo2 className="w-4 h-4" /></button>
          </div>
          <Button onClick={() => setMobilePreview(true)} className="rounded-full shadow-xl h-12 px-5" data-testid="mobile-preview-btn"><Eye className="w-4 h-4 mr-2" />Vista previa</Button>
        </div>
      )}
      <Sheet open={mobilePreview} onOpenChange={setMobilePreview}>
        <SheetContent side="bottom" className="h-[92vh] overflow-y-auto rounded-t-3xl p-4 pt-8" data-testid="mobile-preview-sheet">
          <Preview card={card} device="mobile" setDevice={() => {}} isNew={b.isNew} showDevices={false} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
