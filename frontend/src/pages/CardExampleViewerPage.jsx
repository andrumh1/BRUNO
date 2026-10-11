import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Share2, Copy, Check, QrCode, Loader2, Wand2, X, Languages } from "lucide-react";
import CardRenderer from "@/components/cards/CardRenderer";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { PRESETS } from "@/lib/cardDesign";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const T = {
  es: { use: "Usar esta plantilla", share: "Compartir", copied: "Enlace copiado", qr: "Código QR", qrHint: "Escanéalo desde otro dispositivo: abre esta tarjeta de ejemplo sin iniciar sesión.", demo: "Esta es una tarjeta de ejemplo", demoBody: "En una tarjeta real, esta acción", close: "Cerrar", create: "Crear mi tarjeta", back: "Volver", loadErr: "No se pudo cargar el ejemplo", retry: "Reintentar", templates: "Plantillas", acts: { "tel:": "llamaría al número del titular.", "mailto:": "abriría tu correo para escribirle.", "sms:": "enviaría un SMS al titular.", "wa.me": "abriría un chat de WhatsApp con el titular.", maps: "abriría la ubicación en el mapa.", default: "abriría el enlace o perfil real del titular." } },
  en: { use: "Use this template", share: "Share", copied: "Link copied", qr: "QR code", qrHint: "Scan it from another device: it opens this sample card without signing in.", demo: "This is a sample card", demoBody: "On a real card, this action", close: "Close", create: "Create my card", back: "Back", loadErr: "The example could not be loaded", retry: "Retry", templates: "Templates", acts: { "tel:": "would call the owner's number.", "mailto:": "would open your email to write to them.", "sms:": "would send an SMS to the owner.", "wa.me": "would open a WhatsApp chat with the owner.", maps: "would open the location on the map.", default: "would open the owner's real link or profile." } },
};

const Swatch = ({ id }) => { const p = PRESETS.find((x) => x.id === id)?.patch || {}; const bg = p.background?.type === "gradient" || p.background?.type === "animated" ? `linear-gradient(135deg, ${p.background.color}, ${p.background.color2})` : p.background?.color || "#F9F1EA"; const txt = p.colors?.text || "#474747"; const center = (p.layout?.align || "left") === "center"; return (<span className="block w-14 h-20 rounded-lg overflow-hidden border border-border/50 relative" style={{ background: bg }} aria-hidden="true">{p.banner?.enabled !== false && !p.layout?.header && <span className="absolute inset-x-0 top-0 h-5" style={{ background: p.colors?.accent || "#FF6A00", opacity: 0.6 }} />}{p.layout?.header && <span className="absolute inset-x-0 top-0 h-10" style={{ background: p.colors?.accent || "#999", opacity: 0.5 }} />}<span className="absolute w-5 h-5" style={{ top: p.layout?.header ? 24 : 12, left: center ? "calc(50% - 10px)" : 6, background: txt, opacity: 0.85, borderRadius: p.avatar?.shape === "rounded" ? 5 : 999 }} /><span className="absolute left-2 right-2 h-1 rounded" style={{ top: 42, background: txt, opacity: 0.6 }} /><span className="absolute left-2 right-5 h-1 rounded" style={{ top: 47, background: txt, opacity: 0.35 }} /><span className="absolute left-2 right-2 h-4" style={{ bottom: 6, background: p.colors?.accent || "#FF6A00", opacity: 0.8, borderRadius: p.buttons?.radius === 999 ? 999 : 4 }} /></span>); };

export default function CardExampleViewerPage() {
  const { type } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { token } = useAuth();
  const t = T[language] || T.es;
  const template = params.get("template");
  const [card, setCard] = useState(null);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qr, setQr] = useState(null);
  const [demo, setDemo] = useState(null);

  const load = () => { setErr(false); axios.get(`${API}/card-examples/${type}`, { params: { template, lang: language } }).then((r) => { setCard(r.data); if (!template) setParams({ template: r.data.example_preset }, { replace: true }); }).catch(() => setErr(true)); };
  useEffect(load, [type, template, language]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const on = (e) => setDemo(e.detail); window.addEventListener("bruno:example-action", on); return () => window.removeEventListener("bruno:example-action", on); }, []);

  const publicUrl = useMemo(() => `${window.location.origin}/c/example-${type}?template=${card?.example_preset || template || ""}&lang=${language}`, [type, card, template, language]);
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: card?.title, url: publicUrl }); return; } catch { /* cancelled */ } }
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); brunoToast.success(t.copied); setTimeout(() => setCopied(false), 2000); } catch { brunoToast.error("No se pudo copiar"); }
  };
  const showQr = () => { setQr("loading"); axios.get(`${API}/cards/example-${type}/qr`, { params: { template: card?.example_preset, lang: language } }).then((r) => setQr(r.data.qr_code)).catch(() => setQr(null)); };
  const applyTemplate = () => {
    const sel = { type, template: card?.example_preset, lang: language };
    try { localStorage.setItem("bruno_pending_template", JSON.stringify(sel)); } catch { /* ignore */ }
    navigate(token ? `/cards/new?type=${type}&template=${card?.example_preset}` : `/login`);
  };
  const actText = (href = "") => { const k = Object.keys(t.acts).find((k) => k !== "default" && href.includes(k)) || "default"; return t.acts[k]; };

  if (err) return <div className="min-h-screen grid place-items-center text-center p-6" data-testid="example-error"><div><p className="text-sm text-muted-foreground">{t.loadErr}</p><button onClick={load} className="mt-3 rounded-full bg-primary text-white px-4 py-2 text-sm font-semibold">{t.retry}</button></div></div>;
  return (
    <div className="min-h-screen bg-background" data-testid="card-example-viewer" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 140px)" }}>
      <header className="sticky top-0 z-30 bruno-glass border-b border-border/40">
        <div className="max-w-3xl mx-auto h-14 px-3 flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-foreground/[0.06]" aria-label={t.back} data-testid="example-back"><ArrowLeft className="w-5 h-5" /></button>
          <div className="min-w-0 flex-1"><p className="text-sm font-bold truncate" data-testid="example-type-name">{card?.type_name || "…"}</p><p className="text-[11px] text-muted-foreground truncate" data-testid="example-preset-name">{card?.preset_name}</p></div>
          <button onClick={() => setLanguage(language === "es" ? "en" : "es")} className="h-9 px-2.5 rounded-full bg-foreground/[0.06] text-xs font-semibold inline-flex items-center gap-1" aria-label="Idioma / Language" data-testid="example-lang-toggle"><Languages className="w-3.5 h-3.5" />{language.toUpperCase()}</button>
          <button onClick={showQr} className="w-9 h-9 rounded-full bg-foreground/[0.06] grid place-items-center" aria-label={t.qr} data-testid="example-qr-btn"><QrCode className="w-4 h-4" /></button>
          <button onClick={share} className="w-9 h-9 rounded-full bg-foreground/[0.06] grid place-items-center" aria-label={t.share} data-testid="example-share-btn">{copied ? <Check className="w-4 h-4 text-emerald-500" /> : navigator.share ? <Share2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}</button>
          <button onClick={() => navigate("/cards/examples")} className="w-9 h-9 rounded-full bg-foreground/[0.06] grid place-items-center" aria-label={t.close} data-testid="example-close"><X className="w-4 h-4" /></button>
        </div>
      </header>
      <main className="max-w-[560px] mx-auto px-3 pt-4">
        {!card ? <div className="py-20 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : <div className="transition-opacity duration-200" key={`${card.example_preset}-${language}`} data-testid="example-card-wrap"><CardRenderer data={card} design={card.card_design} cardId={card.id} onChat={() => setDemo({ label: "Chat", href: "chat" })} /></div>}
      </main>

      <div className="fixed inset-x-0 z-30 bruno-glass border-t border-border/40" style={{ bottom: "calc(var(--nav-reserve, 64px) + 8px)" }} data-testid="example-template-bar">
        <div className="max-w-3xl mx-auto px-3 pt-2 pb-2 space-y-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide" role="tablist" aria-label={t.templates}>
            {(card?.example_presets || []).map((p) => (
              <button key={p} role="tab" aria-selected={p === card?.example_preset} onClick={() => setParams({ template: p })} className={`shrink-0 flex flex-col items-center gap-1 rounded-xl p-1 transition-colors ${p === card?.example_preset ? "bg-primary/15 ring-2 ring-primary" : "hover:bg-foreground/[0.05]"}`} data-testid={`example-template-${p}`}><Swatch id={p} /><span className="text-[10px] font-medium">{(T[language] && (PRESETS.find((x) => x.id === p)?.name)) || p}</span></button>
            ))}
          </div>
          <button onClick={applyTemplate} className="w-full h-11 rounded-full bg-primary text-white font-semibold inline-flex items-center justify-center gap-2 active:scale-[0.98] transition-transform" data-testid="example-use-template"><Wand2 className="w-4 h-4" />{t.use}</button>
        </div>
      </div>

      {demo && (
        <div className="fixed inset-0 z-[120] bg-black/60 grid place-items-center p-6" onClick={() => setDemo(null)} role="dialog" aria-modal="true" data-testid="example-demo-modal">
          <div className="w-full max-w-sm rounded-2xl bg-background p-5 space-y-3 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{t.demo}</p>
            <p className="text-sm text-muted-foreground">{t.demoBody} «{demo.label || "—"}» {actText(demo.href)}</p>
            <div className="flex gap-2 pt-1"><button onClick={() => setDemo(null)} className="flex-1 h-10 rounded-full bg-foreground/[0.06] text-sm font-semibold" data-testid="example-demo-close">{t.close}</button><button onClick={() => { setDemo(null); applyTemplate(); }} className="flex-1 h-10 rounded-full bg-primary text-white text-sm font-semibold" data-testid="example-demo-create">{t.create}</button></div>
          </div>
        </div>
      )}
      {qr && (
        <div className="fixed inset-0 z-[120] bg-black/60 grid place-items-center p-6" onClick={() => setQr(null)} role="dialog" aria-modal="true" data-testid="example-qr-modal">
          <div className="w-full max-w-xs rounded-2xl bg-background p-5 space-y-3 text-center shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <p className="font-bold">{t.qr}</p>
            {qr === "loading" ? <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /> : <img src={qr} alt="QR" className="w-56 h-56 mx-auto rounded-xl" data-testid="example-qr-img" />}
            <p className="text-xs text-muted-foreground">{t.qrHint}</p>
            <p className="text-[10px] text-muted-foreground break-all" data-testid="example-public-url">{publicUrl}</p>
            <button onClick={() => setQr(null)} className="h-10 px-5 rounded-full bg-foreground/[0.06] text-sm font-semibold">{t.close}</button>
          </div>
        </div>
      )}
    </div>
  );
}
