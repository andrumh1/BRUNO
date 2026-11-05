import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { api, errText } from "@/pages/events/eventsApi";

const MB = 1024 ** 2, GB = 1024 ** 3;
const Row = ({ label, children }) => <label className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs"><span className="text-muted-foreground">{label}</span>{children}</label>;
const Num = ({ value, onChange, step = 1, testId, w = "w-28" }) => <Input type="number" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className={`h-8 ${w} text-right text-xs`} data-testid={testId} />;
const Prices = ({ value = {}, onChange, prefix }) => <div className="flex gap-1"><Num value={value.US} step={0.01} onChange={(v) => onChange({ ...value, US: v })} testId={`${prefix}-us`} w="w-20" /><Num value={value.CO} onChange={(v) => onChange({ ...value, CO: v })} testId={`${prefix}-co`} w="w-24" /></div>;

/** Panel comercial de tarjetas inteligentes (solo admin): activación por país, almacenamiento, ampliaciones, plantillas premium y productos futuros. */
export default function CommerceAdminPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (token) api.adminSettings(token).then(setS).catch((e) => brunoToast.error(errText(e, "Sin acceso"))); }, [token]);
  if (!s) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  const save = async () => { setSaving(true); try { const r = await api.saveSettings(token, { activation: s.activation, storage: s.storage, templates: s.templates, future_products: s.future_products }); setS(r); brunoToast.success("Configuración guardada"); } catch (e) { brunoToast.error(errText(e, "No se pudo guardar")); } finally { setSaving(false); } };
  const upd = (path, v) => setS((prev) => { const n = structuredClone(prev); let o = n; const ks = path.split("."); ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks[ks.length - 1]] = v; return n; });
  const st = s.storage;
  return (
    <div className="min-h-screen bg-background px-4" style={{ paddingTop: "calc(var(--safe-top, 0px) + 12px)", paddingBottom: "calc(var(--content-bottom, 96px) + 24px)" }} data-testid="commerce-admin-page">
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center gap-2"><Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Volver" data-testid="commerce-back-btn"><ArrowLeft className="w-5 h-5" /></Button><h1 className="text-xl font-black flex-1">Comercio · Tarjetas inteligentes</h1><Button onClick={save} disabled={saving} className="rounded-full" data-testid="commerce-save-btn">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />} Guardar</Button></div>
        <p className="text-xs text-muted-foreground">Precios en USD (EE. UU., Stripe) y COP (Colombia, Wompi); no son conversiones. Ver tarjetas, conexiones e interacciones básicas siguen siendo gratis; las tarjetas gratuitas existentes no cambian.</p>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="admin-activation">
          <h2 className="font-bold text-sm">Activación única de tarjeta de evento</h2>
          <Row label="Cobros habilitados (si está apagado nadie puede pagar; tú puedes activar manualmente)"><Switch checked={!!s.activation.payments_enabled} onCheckedChange={(v) => upd("activation.payments_enabled", v)} data-testid="activation-enabled" /></Row>
          <Row label="Precio US$ / COP $"><Prices value={s.activation.prices} onChange={(v) => upd("activation.prices", v)} prefix="activation-price" /></Row>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="admin-storage">
          <h2 className="font-bold text-sm">Álbum incluido en cada evento</h2>
          <Row label="Capacidad incluida (GB)"><Num value={+(st.included_bytes / GB).toFixed(2)} step={0.1} onChange={(v) => upd("storage.included_bytes", Math.round(v * GB))} testId="storage-included" /></Row>
          <Row label="Máximo de fotografías"><Num value={st.max_photos} onChange={(v) => upd("storage.max_photos", v)} testId="storage-max-photos" /></Row>
          <Row label="Tamaño máximo por archivo (MB)"><Num value={Math.round(st.max_file_bytes / MB)} onChange={(v) => upd("storage.max_file_bytes", v * MB)} testId="storage-max-file" /></Row>
          <Row label="Tiempo de conservación (días)"><Num value={st.retention_days} onChange={(v) => upd("storage.retention_days", v)} testId="storage-retention" /></Row>
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground pt-2">Paquetes de ampliación</h3>
          {st.packs.map((p, i) => (
            <div key={p.id} className="rounded-xl border border-border p-2 space-y-2" data-testid={`pack-${p.id}`}>
              <div className="flex items-center gap-2"><Input value={p.label} onChange={(e) => upd(`storage.packs.${i}.label`, e.target.value)} className="h-8 text-xs" data-testid={`pack-label-${p.id}`} /><Switch checked={!!p.active} onCheckedChange={(v) => upd(`storage.packs.${i}.active`, v)} data-testid={`pack-active-${p.id}`} /><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => upd("storage.packs", st.packs.filter((_, j) => j !== i))} aria-label="Quitar" data-testid={`pack-remove-${p.id}`}><Trash2 className="w-4 h-4" /></Button></div>
              <div className="grid grid-cols-2 gap-2"><Row label="GB"><Num value={+(p.bytes / GB).toFixed(2)} step={0.1} onChange={(v) => upd(`storage.packs.${i}.bytes`, Math.round(v * GB))} testId={`pack-gb-${p.id}`} w="w-20" /></Row><Row label="Fotos"><Num value={p.photos} onChange={(v) => upd(`storage.packs.${i}.photos`, v)} testId={`pack-photos-${p.id}`} w="w-20" /></Row></div>
              <Row label="Precio US$ / COP $"><Prices value={p.prices} onChange={(v) => upd(`storage.packs.${i}.prices`, v)} prefix={`pack-price-${p.id}`} /></Row>
            </div>
          ))}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => upd("storage.packs", [...st.packs, { id: `pack_${Date.now().toString(36)}`, label: "Nuevo paquete", bytes: GB, photos: 500, prices: { US: 4.99, CO: 19900 }, active: false }])} data-testid="pack-add-btn"><Plus className="w-4 h-4 mr-1" /> Añadir paquete</Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-3" data-testid="admin-templates">
          <h2 className="font-bold text-sm">Plantillas premium (dinámicas)</h2>
          <Row label="Precio por defecto US$ / COP $"><Prices value={s.templates.default_price} onChange={(v) => upd("templates.default_price", v)} prefix="tpl-default" /></Row>
          {s.templates.items.length === 0 && <p className="text-xs text-muted-foreground" data-testid="templates-empty">Aún no hay plantillas premium. El área queda lista: añade cada una cuando esté creada.</p>}
          {s.templates.items.map((t, i) => (
            <div key={t.id} className="rounded-xl border border-border p-2 space-y-2" data-testid={`tpl-${t.id}`}>
              <div className="flex items-center gap-2"><Input value={t.name || ""} placeholder="Nombre" onChange={(e) => upd(`templates.items.${i}.name`, e.target.value)} className="h-8 text-xs" data-testid={`tpl-name-${t.id}`} /><Switch checked={!!t.active} onCheckedChange={(v) => upd(`templates.items.${i}.active`, v)} data-testid={`tpl-active-${t.id}`} /><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => upd("templates.items", s.templates.items.filter((_, j) => j !== i))} aria-label="Quitar" data-testid={`tpl-remove-${t.id}`}><Trash2 className="w-4 h-4" /></Button></div>
              <Input value={t.preview_url || ""} placeholder="URL de vista previa" onChange={(e) => upd(`templates.items.${i}.preview_url`, e.target.value)} className="h-8 text-xs" data-testid={`tpl-preview-${t.id}`} />
              <Row label="Precio US$ / COP $"><Prices value={t.prices} onChange={(v) => upd(`templates.items.${i}.prices`, v)} prefix={`tpl-price-${t.id}`} /></Row>
            </div>
          ))}
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => upd("templates.items", [...s.templates.items, { id: `tpl_${Date.now().toString(36)}`, name: "", preview_url: "", prices: { ...s.templates.default_price }, active: false, exclusive: false }])} data-testid="tpl-add-btn"><Plus className="w-4 h-4 mr-1" /> Añadir plantilla</Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 space-y-2" data-testid="admin-future">
          <h2 className="font-bold text-sm">Productos futuros (preparados, apagados)</h2>
          <p className="text-[11px] text-muted-foreground">Ninguno cobra ni se activa sin precio en USD y COP y sin encenderlo aquí.</p>
          {s.future_products.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2 text-xs" data-testid={`future-${f.id}`}><span className="flex-1">{f.label}</span><Prices value={f.prices || {}} onChange={(v) => upd(`future_products.${i}.prices`, v)} prefix={`future-price-${f.id}`} /><Switch checked={!!f.enabled} onCheckedChange={(v) => upd(`future_products.${i}.enabled`, v)} data-testid={`future-enabled-${f.id}`} /></div>
          ))}
        </section>
      </div>
    </div>
  );
}
