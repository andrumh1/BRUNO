import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CreditCard, Languages, Mail, Map, Menu, Nfc, QrCode, Radio, Search, ShoppingBag, Sparkles, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { ServicePromoBubble } from "@/components/bruno/ServicePromoBubble";
import { OvcAttribution } from "@/components/brand/OvcAttribution";

const LANG_KEY = "bruno-service-language";
const readLang = () => { try { const v = localStorage.getItem(LANG_KEY); if (v === "en" || v === "es") return v; } catch { /* ignore */ } return (navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es"; };

const COPY = {
  es: {
    nav: ["Tarjetas", "Marketplace", "Reels", "En vivo", "Mapa"], service: "Creamos tu tarjeta", login: "Entrar", signup: "Crear cuenta gratis", profile: "Ir a mi perfil", back: "Volver a la app",
    heroEyebrow: "Una nueva forma de conectar", heroTitle: "Tu mundo, en un solo enlace.", heroText: "BRUNO reúne tu tarjeta digital, lo que vendes, lo que creas y dónde estás. Base gratuita, con servicios opcionales si quieres que lo hagamos por ti.",
    heroCta: "Empezar gratis", heroAlt: "Ver ejemplos de tarjetas", free: "Experiencia base gratuita · Servicios opcionales de pago",
    focusTitle: "Cinco formas de presentarte", focusText: "Todo vive en la misma cuenta y se comparte con un enlace o un QR.",
    f: [
      { t: "Tarjetas digitales", d: "Presenta tu identidad, tu negocio y tus redes con un enlace y un QR. Compatible con NFC en productos compatibles.", cta: "Ver ejemplos", bullets: ["Enlace y QR propios", "Personal, negocio, currículum, guardián o mascota", "NFC con productos compatibles"] },
      { t: "Marketplace", d: "Muestra productos y servicios y conecta con compradores desde tu propio espacio en BRUNO.", cta: "Explorar Marketplace", bullets: ["Publica productos y servicios", "Compradores te contactan en BRUNO", "Pedidos y compras en un solo lugar"] },
      { t: "Reels y comunidad", d: "Comparte videos, talento y proyectos. Organiza tus series propias o autorizadas y deja que la comunidad te siga.", cta: "Ver Reels", bullets: ["Videos y publicaciones", "Series por capítulos", "Historias y comunidad"] },
      { t: "En vivos", d: "Conecta con tu audiencia en tiempo real desde la app y conserva el resumen de cada transmisión.", cta: "Ver en vivos", bullets: ["Transmite desde tu celular", "Audiencia en tiempo real", "Resumen al terminar"] },
      { t: "Mapa y búsqueda", d: "Descubre personas, negocios y contenido según tus intereses y la ubicación que decidas compartir.", cta: "Abrir el mapa", bullets: ["Ubicación solo si la autorizas", "Lugares populares y cercanos", "Búsqueda por intereses"] },
    ],
    serviceEyebrow: "BRUNO × OVC", serviceTitle: "Tu mundo, en una tarjeta. La creamos por ti.", serviceText: "Diseñamos y configuramos tu tarjeta BRUNO, su enlace y su QR digital, con una ronda de ajustes. Un solo pago: COP $30.000 en Colombia o US$30 en Estados Unidos.",
    priceTitle: "Gratis en su base. Opcional cuando quieras más.", priceText: "Crear tu cuenta, tu tarjeta, publicar, vender y transmitir no tiene costo. Pagas solo por servicios opcionales:",
    priceItems: [["Creamos tu tarjeta", "COP $30.000 (Colombia) · US$30 (Estados Unidos). Pago único, una ronda de ajustes."], ["Productos NFC compatibles", "Disponibles en la tienda BRUNO según existencias."]],
    store: "Ver tienda", contactTitle: "¿Hablamos?", contactText: "Escríbenos para pedidos, alianzas o soporte.", legal: ["Términos", "Privacidad", "Cookies", "Centro legal", "Ayuda", "Contacto"], owner: "BRUNO pertenece a Octopus Vision Company.",
  },
  en: {
    nav: ["Cards", "Marketplace", "Reels", "Live", "Map"], service: "We create your card", login: "Sign in", signup: "Create free account", profile: "Go to my profile", back: "Back to the app",
    heroEyebrow: "A new way to connect", heroTitle: "Your world, in a single link.", heroText: "BRUNO brings together your digital card, what you sell, what you create and where you are. Free at its core, with optional services if you want us to do it for you.",
    heroCta: "Start for free", heroAlt: "See card examples", free: "Free base experience · Optional paid services",
    focusTitle: "Five ways to present yourself", focusText: "Everything lives in the same account and is shared with a link or a QR.",
    f: [
      { t: "Digital cards", d: "Present your identity, business and social links with a link and a QR. NFC-ready with compatible products.", cta: "See examples", bullets: ["Your own link and QR", "Personal, business, résumé, guardian or pet", "NFC with compatible products"] },
      { t: "Marketplace", d: "Show products and services and connect with buyers from your own space in BRUNO.", cta: "Explore Marketplace", bullets: ["Publish products and services", "Buyers reach you inside BRUNO", "Orders and purchases in one place"] },
      { t: "Reels & community", d: "Share videos, talent and projects. Organize your own or authorized series and let the community follow you.", cta: "Watch Reels", bullets: ["Videos and posts", "Series by chapters", "Stories and community"] },
      { t: "Live", d: "Connect with your audience in real time from the app and keep a summary of every broadcast.", cta: "See live streams", bullets: ["Stream from your phone", "Real-time audience", "Summary when you finish"] },
      { t: "Map & search", d: "Discover people, businesses and content by interests and the location you choose to share.", cta: "Open the map", bullets: ["Location only if you authorize it", "Popular and nearby places", "Search by interests"] },
    ],
    serviceEyebrow: "BRUNO × OVC", serviceTitle: "Your world, in one card. We create it for you.", serviceText: "We design and set up your BRUNO card, its link and its digital QR, with one round of adjustments. One payment: COP $30.000 in Colombia or US$30 in the United States.",
    priceTitle: "Free at its core. Optional when you want more.", priceText: "Creating your account, your card, publishing, selling and streaming is free. You only pay for optional services:",
    priceItems: [["We create your card", "COP $30.000 (Colombia) · US$30 (United States). One-time payment, one round of adjustments."], ["Compatible NFC products", "Available in the BRUNO store while stocks last."]],
    store: "Visit store", contactTitle: "Let's talk", contactText: "Write to us for orders, partnerships or support.", legal: ["Terms", "Privacy", "Cookies", "Legal center", "Help", "Contact"], owner: "BRUNO belongs to Octopus Vision Company.",
  },
};
const FOCUS = [
  { id: "tarjetas", icon: CreditCard, to: "/cards/examples", img: "/servicios/tarjeta-bruno/assets/personas.jpeg", extra: [QrCode, Nfc] },
  { id: "marketplace", icon: ShoppingBag, to: "/marketplace", img: "/brand/mascot-laptop.webp" },
  { id: "reels", icon: Video, to: "/reels", img: "/servicios/tarjeta-bruno/assets/curriculum.jpeg" },
  { id: "envivo", icon: Radio, to: "/lives", img: "/brand/mascot-wave.webp" },
  { id: "mapa", icon: Map, to: "/map", img: "/servicios/tarjeta-bruno/assets/guardian.jpeg", extra: [Search] },
];
const LEGAL = ["/terms", "/privacy", "/cookies", "/legal", "/help", "/contact"];
const glass = "rounded-[32px] border border-white/70 bg-white/55 backdrop-blur-2xl shadow-[inset_0_1px_0_#fff,0_18px_50px_rgba(52,59,50,0.10)]";
const reveal = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } };

export default function BrunoWebsite() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState(readLang);
  const [menu, setMenu] = useState(false);
  const c = COPY[lang];
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const toggle = () => { const v = lang === "es" ? "en" : "es"; setLang(v); try { localStorage.setItem(LANG_KEY, v); } catch { /* ignore */ } };
  const go = (to) => { setMenu(false); navigate(to); };
  const primaryCta = () => go(isAuthenticated ? "/my-profile" : "/register");

  return (
    <div className="min-h-screen text-[#1c1c1a] bg-[radial-gradient(1200px_600px_at_80%_-10%,#ffd9bf_0%,transparent_60%),radial-gradient(900px_500px_at_-10%_30%,#ffe9d9_0%,transparent_55%),linear-gradient(180deg,#fffaf6,#ffffff_40%,#fff6ee)]" data-testid="bruno-website">
      {/* Nav */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 pt-3" data-testid="website-nav">
        <div className={`${glass} rounded-full flex items-center gap-2 px-3 sm:px-5 h-14 max-w-6xl mx-auto`}>
          <button type="button" onClick={() => (isAuthenticated ? go("/settings") : window.history.length > 1 ? navigate(-1) : go("/"))} className="inline-flex w-9 h-9 rounded-full items-center justify-center hover:bg-white/70 shrink-0" aria-label={c.back} data-testid="website-back"><ArrowLeft className="w-4 h-4" /></button>
          <Link to="/website" className="flex items-center gap-2 shrink-0" data-testid="website-logo"><img src="/brand/logo-h-orange.png" alt="BRUNO" className="h-7 sm:h-8 object-contain" /></Link>
          <nav className="hidden lg:flex items-center gap-1 ml-4 text-sm font-medium">
            {FOCUS.map((f, i) => <a key={f.id} href={`#${f.id}`} className="px-3 py-1.5 rounded-full hover:bg-white/80 transition-colors">{c.nav[i]}</a>)}
            <a href="#servicio-tarjeta" className="px-3 py-1.5 rounded-full text-[#c84a17] font-semibold hover:bg-white/80 transition-colors inline-flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" />{c.service}</a>
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <button type="button" onClick={toggle} className="h-9 px-3 rounded-full border border-white/80 bg-white/70 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-white transition-colors" aria-label={lang === "es" ? "Switch to English" : "Cambiar a español"} data-testid="website-lang-toggle"><Languages className="w-3.5 h-3.5" />{lang === "es" ? "EN" : "ES"}</button>
            {isAuthenticated ? <Button size="sm" className="rounded-full hidden sm:inline-flex" onClick={() => go("/my-profile")} data-testid="website-profile-btn">{c.profile}</Button>
              : <><Button size="sm" variant="ghost" className="rounded-full hidden sm:inline-flex" onClick={() => go("/login")} data-testid="website-login-btn">{c.login}</Button><Button size="sm" className="rounded-full hidden sm:inline-flex" onClick={() => go("/register")} data-testid="website-signup-btn">{c.signup}</Button></>}
            <button type="button" className="lg:hidden w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-white/70" onClick={() => setMenu(!menu)} aria-label="Menu" data-testid="website-menu-btn">{menu ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
          </div>
        </div>
        {menu && <div className={`${glass} lg:hidden max-w-6xl mx-auto mt-2 p-4 flex flex-col gap-1 text-sm font-medium`} data-testid="website-mobile-menu">
          {FOCUS.map((f, i) => <a key={f.id} href={`#${f.id}`} onClick={() => setMenu(false)} className="px-3 py-2.5 rounded-2xl hover:bg-white/80">{c.nav[i]}</a>)}
          <a href="#servicio-tarjeta" onClick={() => setMenu(false)} className="px-3 py-2.5 rounded-2xl text-[#c84a17] font-semibold">✨ {c.service}</a>
          <div className="flex gap-2 pt-2">{isAuthenticated ? <><Button className="rounded-full flex-1" onClick={() => go("/my-profile")}>{c.profile}</Button><Button variant="outline" className="rounded-full" onClick={() => go("/settings")}>{c.back}</Button></> : <><Button variant="outline" className="rounded-full flex-1" onClick={() => go("/login")}>{c.login}</Button><Button className="rounded-full flex-1" onClick={() => go("/register")}>{c.signup}</Button></>}</div>
        </div>}
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-14 pb-20 sm:pt-20 sm:pb-28" data-testid="website-hero">
        <div className="absolute -top-20 right-[8%] w-72 h-72 rounded-full bg-white/50 blur-3xl animate-pulse" aria-hidden="true" />
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <p className="text-[11px] tracking-[2.5px] uppercase font-bold text-[#fa632e] mb-4">{c.heroEyebrow}</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02] mb-5">{c.heroTitle}</h1>
            <p className="text-base md:text-lg text-[#4a4b45] max-w-xl mb-8">{c.heroText}</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="rounded-full h-12 px-6" onClick={primaryCta} data-testid="website-hero-cta">{isAuthenticated ? c.profile : c.heroCta}<ArrowRight className="w-4 h-4 ml-2" /></Button>
              <Button size="lg" variant="outline" className="rounded-full h-12 px-6 bg-white/60" onClick={() => go("/cards/examples")} data-testid="website-hero-examples">{c.heroAlt}</Button>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-[#c84a17] bg-white/70 border border-white rounded-full px-3 py-1.5" data-testid="website-free-note"><Sparkles className="w-3.5 h-3.5" />{c.free}</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.15 }} className="relative flex justify-center">
            <div className={`${glass} p-6 w-full max-w-sm rounded-[48px_48px_32px_32px] relative`}>
              <img src="/brand/mascot-wave.webp" alt="" className="w-56 h-56 mx-auto object-contain drop-shadow-xl" loading="eager" />
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="absolute -left-4 top-10 rounded-full bg-white/80 backdrop-blur-xl border border-white px-4 py-2 text-xs font-semibold shadow-lg inline-flex items-center gap-2"><QrCode className="w-4 h-4 text-[#fa632e]" />{lang === "es" ? "Enlace + QR" : "Link + QR"}</motion.div>
              <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="absolute -right-3 bottom-16 rounded-full bg-white/80 backdrop-blur-xl border border-white px-4 py-2 text-xs font-semibold shadow-lg inline-flex items-center gap-2"><Nfc className="w-4 h-4 text-[#fa632e]" />NFC</motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Five focus areas */}
      <section className="px-4 pb-10" data-testid="website-focus">
        <div className="max-w-6xl mx-auto">
          <motion.div {...reveal} className="mb-10 max-w-2xl"><h2 className="text-base md:text-lg font-bold text-[#fa632e] uppercase tracking-[2px]">{c.focusTitle}</h2><p className="text-2xl sm:text-3xl font-semibold tracking-tight mt-2">{c.focusText}</p></motion.div>
          <div className="space-y-6">
            {FOCUS.map((f, i) => {
              const Icon = f.icon; const copy = c.f[i]; const flip = i % 2 === 1;
              return (
                <motion.article key={f.id} id={f.id} {...reveal} className={`${glass} p-6 sm:p-10 grid md:grid-cols-[1fr_280px] gap-8 items-center scroll-mt-24 ${flip ? "md:[&>*:first-child]:order-2" : ""}`} data-testid={`website-focus-${f.id}`}>
                  <div>
                    <div className="flex items-center gap-3 mb-4"><span className="w-12 h-12 rounded-2xl bg-[#fa632e] text-white grid place-items-center shadow-lg shadow-orange-500/30"><Icon className="w-6 h-6" /></span>{f.extra?.map((E, k) => <span key={k} className="w-9 h-9 rounded-xl bg-white/80 border border-white grid place-items-center"><E className="w-4 h-4 text-[#c84a17]" /></span>)}</div>
                    <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">{copy.t}</h3>
                    <p className="text-[#4a4b45] mb-5 max-w-xl">{copy.d}</p>
                    <ul className="flex flex-wrap gap-2 mb-6">{copy.bullets.map((b) => <li key={b} className="text-xs font-semibold bg-white/80 border border-white rounded-full px-3 py-1.5">{b}</li>)}</ul>
                    <Button className="rounded-full" onClick={() => go(f.to)} data-testid={`website-focus-cta-${f.id}`}>{copy.cta}<ArrowRight className="w-4 h-4 ml-2" /></Button>
                  </div>
                  <div className="justify-self-center"><img src={f.img} alt="" loading="lazy" className="w-56 h-64 object-cover rounded-[90px_90px_28px_28px] border-4 border-white shadow-xl bg-white" /></div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Creamos tu tarjeta (misma plantilla, mismo destino) */}
      <section id="servicio-tarjeta" className="px-4 py-12 scroll-mt-24" data-testid="website-service-section">
        <motion.div {...reveal} className="max-w-5xl mx-auto rounded-[32px] p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8" style={{ background: "linear-gradient(120deg,#ffffff88,#ffb36c55)", border: "1px solid #ffffffb3", boxShadow: "inset 0 1px 0 #fff,0 15px 40px #343b3210", backdropFilter: "blur(20px)" }}>
          <img src="/servicios/tarjeta-bruno/assets/bruno-mascota.webp" alt="" className="w-36 h-44 object-cover rounded-[70px_70px_24px_24px] border-4 border-white shadow-lg shrink-0" loading="lazy" />
          <div className="text-center sm:text-left">
            <p className="text-[11px] tracking-[2px] uppercase font-bold text-[#fa632e] mb-3">{c.serviceEyebrow}</p>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">{c.serviceTitle}</h2>
            <p className="text-[#4a4b45] mb-6 max-w-xl">{c.serviceText}</p>
            <ServicePromoBubble variant="banner" from="/website#servicio-tarjeta" />
          </div>
        </motion.div>
      </section>

      {/* Free base + optional services */}
      <section className="px-4 py-12" data-testid="website-pricing">
        <motion.div {...reveal} className={`${glass} max-w-5xl mx-auto p-8 sm:p-12`}>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">{c.priceTitle}</h2>
          <p className="text-[#4a4b45] mb-6 max-w-2xl">{c.priceText}</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {c.priceItems.map(([t1, d1], i) => <div key={t1} className="rounded-3xl bg-white/80 border border-white p-5" data-testid={`website-price-item-${i}`}><p className="font-semibold mb-1">{t1}</p><p className="text-sm text-[#4a4b45]">{d1}</p></div>)}
          </div>
          <div className="flex flex-wrap gap-3 mt-6"><Button variant="outline" className="rounded-full bg-white/60" onClick={() => go("/store")} data-testid="website-store-btn"><ShoppingBag className="w-4 h-4 mr-2" />{c.store}</Button><Button className="rounded-full" onClick={primaryCta} data-testid="website-pricing-cta">{isAuthenticated ? c.profile : c.heroCta}</Button></div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-4 pt-10 pb-28 lg:pb-14" data-testid="website-footer">
        <div className={`${glass} max-w-6xl mx-auto p-8 sm:p-10 grid md:grid-cols-[1fr_auto] gap-8`}>
          <div>
            <img src="/brand/logo-h-orange.png" alt="BRUNO" className="h-8 object-contain mb-4" />
            <h2 className="text-xl font-semibold mb-1">{c.contactTitle}</h2>
            <p className="text-sm text-[#4a4b45] mb-3">{c.contactText}</p>
            <a href="mailto:bruno@brunocard.com" className="inline-flex items-center gap-2 font-semibold text-[#c84a17] hover:underline" data-testid="website-contact-email"><Mail className="w-4 h-4" />bruno@brunocard.com</a>
          </div>
          <nav className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm" aria-label="Legal">{LEGAL.map((to, i) => <Link key={to} to={to} className="hover:text-[#c84a17]" data-testid={`website-legal-${i}`}>{c.legal[i]}</Link>)}</nav>
          <div className="md:col-span-2 border-t border-white/80 pt-4 flex flex-col sm:flex-row sm:items-center gap-2 text-xs text-[#6c6d64]">
            <span data-testid="website-owner">{c.owner}</span><span className="sm:ml-auto"><OvcAttribution /></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
