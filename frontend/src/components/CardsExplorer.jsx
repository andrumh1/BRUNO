/**
 * CardsExplorer — public cards directory (search + type filters + compact/grid/list).
 * Extracted from the old Inicio "Explorar" tab; used inside the Map section and Profile.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import CardPreviewModal from "@/components/CardPreviewModal";
import BeaconsStyleCard from "@/components/BeaconsStyleCard";
import SocialLinkButton from "@/components/SocialLinkButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { Search, Eye, MapPin, Grid3X3, List, LayoutGrid, Briefcase, Users, HandHelping } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const JOB_TYPES = ["oferta_trabajo", "busqueda_personal", "solicitud_servicio"];

export default function CardsExplorer({ compact = false }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("compact");
  const [preview, setPreview] = useState(null);
  const press = useRef({ timer: null, at: 0 });

  useEffect(() => {
    axios.get(`${API}/public/cards`).then((r) => setCards(Array.isArray(r.data) ? r.data : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return cards.filter((c) => (c.title || "").toLowerCase().includes(q) || (c.subtitle || "").toLowerCase().includes(q))
      .filter((c) => filter === "all" || c.card_type === filter)
      .filter((c) => c.show_in_feed !== false);
  }, [cards, query, filter]);

  const typeLabel = (type) => ({
    personal: t("cards.types.personal"), empresarial: t("cards.types.empresarial"), negocio: t("cards.types.negocio"),
    lugares: t("cards.types.lugares"), guardian: t("cards.types.guardian"), curriculum: t("cards.types.curriculum"),
    oferta_trabajo: "Oferta de Trabajo", busqueda_personal: "Búsqueda de Personal", solicitud_servicio: "Solicitud de Servicio",
  }[type] || type);

  const onDown = (card) => { press.current.at = Date.now(); press.current.timer = setTimeout(() => setPreview(card), 500); };
  const onUp = (card) => { clearTimeout(press.current.timer); if (Date.now() - press.current.at < 500 && !preview) navigate(`/c/${card.id}`); };
  const pressProps = (card) => ({ onPointerDown: () => onDown(card), onPointerUp: () => onUp(card), onPointerLeave: () => clearTimeout(press.current.timer) });

  const FILTERS = [
    ["all", t("feed.allTypes")], ["personal", t("cards.types.personal")], ["empresarial", t("cards.types.empresarial")],
    ["negocio", t("cards.types.negocio")], ["lugares", t("cards.types.lugares")], ["guardian", t("cards.types.guardian")],
    ["curriculum", t("cards.types.curriculum")], ["oferta_trabajo", "Empleos", Briefcase], ["busqueda_personal", "Personal", Users], ["solicitud_servicio", "Servicios", HandHelping],
  ];

  return (
    <div className="space-y-3" data-testid="cards-explorer">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t("feed.searchPlaceholder")} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 h-10 rounded-full" data-testid="cards-search-input" />
      </div>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
        {FILTERS.map(([id, label, Icon]) => (
          <Button key={id} size="sm" variant={filter === id ? "default" : "outline"} onClick={() => setFilter(id)} className="rounded-full h-8 text-xs shrink-0 gap-1" data-testid={`cards-filter-${id}`}>
            {Icon && <Icon className="w-3 h-3" />}{label}
          </Button>
        ))}
      </div>
      {!compact && (
        <div className="flex justify-end">
          <div className="view-toggle">
            <button className={view === "compact" ? "active" : ""} onClick={() => setView("compact")} data-testid="view-compact"><LayoutGrid className="w-4 h-4" />Compacto</button>
            <button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} data-testid="view-grid"><Grid3X3 className="w-4 h-4" />{t("feed.gridView")}</button>
            <button className={view === "list" ? "active" : ""} onClick={() => setView("list")} data-testid="view-list"><List className="w-4 h-4" />{t("feed.listView")}</button>
          </div>
        </div>
      )}

      {loading && <div className="py-12 text-center"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" /></div>}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground" data-testid="cards-empty">{query ? `No hay resultados para "${query}"` : t("feed.noResults")}</div>
      )}
      {!loading && filtered.length > 0 && (
        view === "compact" ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-8 bubble-stagger">
            {filtered.map((card) => JOB_TYPES.includes(card.card_type) ? <BeaconsStyleCard key={card.id} card={card} /> : (
              <div key={card.id} className="rounded-xl overflow-hidden bg-card ring-1 ring-border/40 shadow-sm cursor-pointer active:scale-[0.97] transition-all" {...pressProps(card)} data-testid={`compact-card-${card.id}`}>
                <div className="h-20 relative" style={{ background: card.banner_url ? undefined : `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)` }}>
                  {card.banner_url && <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  {card.avatar_url && <img src={card.avatar_url} alt="" className="absolute -bottom-5 left-2.5 w-10 h-10 rounded-full border-2 border-card object-cover shadow" />}
                </div>
                <div className="pt-6 pb-2.5 px-2.5">
                  <h4 className="text-xs font-bold truncate">{card.title}</h4>
                  {card.subtitle && <p className="text-[10px] text-muted-foreground truncate">{card.subtitle}</p>}
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground"><Eye className="w-2.5 h-2.5" /> {card.views || 0}<span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary/10 text-[8px] font-medium capitalize">{card.card_type}</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-8 bubble-stagger">
            {filtered.map((card) => JOB_TYPES.includes(card.card_type) ? <BeaconsStyleCard key={card.id} card={card} /> : (
              <Card key={card.id} className="overflow-hidden backdrop-blur-xl bg-card/80 ring-1 ring-white/40 rounded-2xl cursor-pointer active:scale-[0.97] transition-all" {...pressProps(card)} data-testid={`grid-card-${card.id}`}>
                <div className="h-28 relative" style={{ background: card.banner_url ? undefined : `linear-gradient(135deg, ${card.background_color}, ${card.background_color}dd)` }}>
                  {card.banner_url && <img src={card.banner_url} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-white/90 text-[10px] font-medium">{typeLabel(card.card_type)}</div>
                </div>
                <CardContent className="pt-5 pb-3 relative">
                  <div className="absolute -top-8 left-4">
                    {card.avatar_url ? <img src={card.avatar_url} alt="" className="w-16 h-16 rounded-full border-3 border-background object-cover shadow-lg" />
                      : <div className="w-16 h-16 rounded-full border-3 border-background grid place-items-center text-xl font-bold shadow-lg" style={{ backgroundColor: card.background_color, color: card.text_color }}>{(card.title || "?").charAt(0)}</div>}
                  </div>
                  <div className="mt-9 space-y-1.5">
                    <h3 className="text-sm font-bold truncate">{card.title}</h3>
                    {card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}
                    {card.description && <p className="text-xs text-muted-foreground line-clamp-2">{card.description}</p>}
                    {card.social_links?.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{card.social_links.slice(0, 4).map((l) => <SocialLinkButton key={`${l.platform}-${l.url}`} link={l} size="sm" onlyIcon />)}</div>}
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground pt-2 border-t border-border/60">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {card.views || 0}</span>
                      {card.user_id && <Link to={`/profile/${card.user_id}`} className="ml-auto text-primary hover:underline" onClick={(e) => e.stopPropagation()}>Perfil</Link>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {filtered.map((card) => (
              <div key={card.id} className="list-view-card cursor-pointer active:bg-muted/50 transition-colors" {...pressProps(card)} data-testid={`list-card-${card.id}`}>
                {card.avatar_url ? <img src={card.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                  : <div className="w-12 h-12 rounded-full grid place-items-center text-lg font-bold flex-shrink-0" style={{ backgroundColor: card.background_color, color: card.text_color }}>{(card.title || "?").charAt(0)}</div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><h3 className="text-sm font-bold truncate">{card.title}</h3>{card.subtitle && <p className="text-xs text-muted-foreground truncate">{card.subtitle}</p>}</div>
                    <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[10px] font-medium flex-shrink-0 capitalize">{card.card_type}</span>
                  </div>
                  {card.description && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{card.description}</p>}
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {card.views || 0}</span>
                    {card.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {card.location.city || card.location.address}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
      <CardPreviewModal card={preview} isOpen={!!preview} onClose={() => setPreview(null)} />
    </div>
  );
}
