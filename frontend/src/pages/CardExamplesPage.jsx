import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const T = {
  es: { title: "Inspírate con ejemplos", desc: "Explora tarjetas completas y elige cómo quieres presentarte.", see: "Ver ejemplos", fict: "Ejemplo ficticio", templates: "plantillas", back: "Volver", error: "No se pudieron cargar los ejemplos", retry: "Reintentar" },
  en: { title: "Get inspired by examples", desc: "Explore complete cards and choose how you want to present yourself.", see: "See examples", fict: "Fictional example", templates: "templates", back: "Back", error: "Examples could not be loaded", retry: "Retry" },
};
export const exT = (lang) => T[lang] || T.es;

/** Cuadrícula de tipos con su ejemplo (reutilizable en «Crear tarjetas» y en /cards/examples). */
export function ExamplesGrid({ compact = false }) {
  const { language } = useLanguage();
  const t = exT(language);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  const load = () => { setErr(false); axios.get(`${API}/card-examples`, { params: { lang: language } }).then((r) => setData(r.data)).catch(() => setErr(true)); };
  useEffect(load, [language]); // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="text-center py-8 text-sm text-muted-foreground" data-testid="examples-error">{t.error} · <button onClick={load} className="text-primary font-semibold">{t.retry}</button></div>;
  if (!data) return <div className="py-10 grid place-items-center" data-testid="examples-loading"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  return (
    <div className={`grid gap-3 ${compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"}`} data-testid="examples-grid">
      {data.items.map((it) => (
        <Link key={it.type} to={`/cards/examples/${it.type}`} onClick={() => { try { sessionStorage.setItem("bruno_examples_last", it.type); } catch { /* ignore */ } }} className="group relative rounded-2xl overflow-hidden border border-border/40 bg-card/55 backdrop-blur-md hover:-translate-y-0.5 transition-transform focus-visible:ring-2 focus-visible:ring-primary outline-none" data-testid={`example-tile-${it.type}`} aria-label={`${t.see}: ${it.name}`}>
          <div className="relative aspect-[16/10] bg-black/50"><img src={it.cover} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" /><img src={it.avatar} alt="" className="absolute -bottom-4 left-3 w-11 h-11 rounded-xl object-cover ring-2 ring-background shadow" loading="lazy" /><span className="absolute top-2 right-2 rounded-full bg-black/55 text-white text-[9px] font-semibold px-2 py-0.5">{t.fict}</span></div>
          <div className="pt-6 px-3 pb-3"><p className="text-sm font-bold leading-tight">{it.name}</p>{!compact && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{it.description}</p>}<p className="text-[11px] text-primary font-semibold mt-1.5 inline-flex items-center gap-0.5">{t.see} · {it.presets.length} {t.templates}<ChevronRight className="w-3 h-3" /></p></div>
        </Link>
      ))}
    </div>
  );
}

export default function CardExamplesPage() {
  const { language } = useLanguage();
  const t = exT(language);
  const navigate = useNavigate();
  useEffect(() => { const last = sessionStorage.getItem("bruno_examples_last"); if (last) setTimeout(() => document.querySelector(`[data-testid="example-tile-${last}"]`)?.scrollIntoView({ block: "center" }), 150); }, []);
  return (
    <div className="min-h-screen bg-background" data-testid="card-examples-page" style={{ paddingBottom: "calc(var(--content-bottom, 96px) + 16px)" }}>
      <header className="sticky top-0 z-30 bruno-glass border-b border-border/40"><div className="max-w-5xl mx-auto h-14 px-3 flex items-center gap-2"><button onClick={() => navigate(-1)} className="w-10 h-10 rounded-full grid place-items-center hover:bg-foreground/[0.06]" aria-label={t.back} data-testid="examples-back"><ArrowLeft className="w-5 h-5" /></button><h1 className="text-base font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-primary" />{t.title}</h1></div></header>
      <main className="max-w-5xl mx-auto px-4 pt-4 space-y-4"><p className="text-sm text-muted-foreground">{t.desc}</p><ExamplesGrid /></main>
    </div>
  );
}
