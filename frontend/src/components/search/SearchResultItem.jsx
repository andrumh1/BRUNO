import React from "react";
import { useNavigate } from "react-router-dom";
import { Play, Hash, Store, MessageSquare, Sparkles, Building2, BadgeCheck, Lock, CreditCard, Clock } from "lucide-react";

const fmtDuration = (s) => { if (!s) return null; const m = Math.floor(s / 60); const r = Math.round(s % 60); return `${m}:${String(r).padStart(2, "0")}`; };
const fmtDate = (iso) => { try { return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }); } catch { return ""; } };
const Avatar = ({ src, size = "w-10 h-10", fallback }) => (
  <div className={`${size} rounded-full bg-foreground/[0.08] overflow-hidden shrink-0 grid place-items-center text-xs font-bold text-muted-foreground`}>{src ? <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" /> : (fallback || "").slice(0, 1).toUpperCase()}</div>
);
const Row = ({ onClick, testid, children }) => (
  <button onClick={onClick} className="w-full text-left flex items-center gap-3 rounded-2xl px-3 py-2.5 bg-card/55 border border-border/40 hover:bg-card/80 active:scale-[0.99] transition-[background-color,transform]" data-testid={testid}>{children}</button>
);

/** Un resultado de búsqueda, con la vista adecuada a su categoría. `onOpen` navega conservando el estado del buscador. */
export function SearchResultItem({ item, onOpen, onFollow }) {
  const navigate = useNavigate();
  const open = () => {
    if (item.kind === "ai_private") { window.dispatchEvent(new CustomEvent("bruno:open-ai", { detail: { session_id: item.session_id, message_id: item.id } })); return; }
    onOpen?.(); navigate(item.url);
  };
  const tid = `search-result-${item.kind}-${item.id}`;
  switch (item.kind) {
    case "video":
      return (
        <Row onClick={open} testid={tid}>
          <div className="relative w-16 h-24 rounded-xl overflow-hidden bg-black/60 shrink-0">{item.thumb && <img src={item.thumb} alt="" className="w-full h-full object-cover" loading="lazy" />}<Play className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow" />{item.duration && <span className="absolute bottom-1 right-1 text-[10px] bg-black/70 text-white rounded px-1">{fmtDuration(item.duration)}</span>}</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium line-clamp-2">{item.snippet || item.title || "Video"}</p><p className="text-xs text-muted-foreground mt-1 truncate">{item.author?.name || "Creador"} · {fmtDate(item.created_at)}</p><p className="text-[11px] text-muted-foreground">{item.likes} me gusta · {item.comments} comentarios</p>{item.is_long && <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-foreground/[0.08] px-2 py-0.5 text-[10px] font-semibold" data-testid={`search-watch-full-${item.id}`}><Play className="w-3 h-3" />Ver completo</span>}</div>
        </Row>
      );
    case "post":
    case "ai_public":
      return (
        <Row onClick={open} testid={tid}>
          <Avatar src={item.author?.avatar} fallback={item.author?.name} />
          <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground truncate">{item.author?.name || "Autor"} · {fmtDate(item.created_at)}{item.kind === "ai_public" && <span className="ml-1 text-primary inline-flex items-center gap-0.5"><Sparkles className="w-3 h-3" />BRUNO IA</span>}</p><p className="text-sm line-clamp-2 mt-0.5">{item.snippet || item.title}</p></div>
          {item.thumb && <img src={item.thumb} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" loading="lazy" />}
        </Row>
      );
    case "user":
    case "business":
      return (
        <Row onClick={open} testid={tid}>
          <Avatar src={item.kind === "business" ? (item.image || item.avatar) : item.avatar} fallback={item.name} size="w-11 h-11" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate flex items-center gap-1">{item.kind === "business" ? (item.business_name || item.name) : item.name}{item.is_verified && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}{item.is_private && <Lock className="w-3 h-3 text-muted-foreground" />}{item.kind === "business" && <Building2 className="w-3.5 h-3.5 text-muted-foreground" />}</p>
            <p className="text-xs text-muted-foreground truncate">{item.kind === "business" ? [item.category, item.location].filter(Boolean).join(" · ") || `@${item.handle}` : `@${item.handle}`}</p>
          </div>
          {!item.is_me && onFollow && <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); onFollow(item); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onFollow(item); } }} className={`text-xs font-semibold rounded-full px-3 py-1.5 ${item.is_following ? "bg-foreground/[0.08]" : "bg-primary text-white"}`} data-testid={`search-follow-${item.id}`}>{item.is_following ? "Siguiendo" : "Seguir"}</span>}
        </Row>
      );
    case "card":
      return (
        <Row onClick={open} testid={tid}>
          <div className="w-16 h-10 rounded-lg shrink-0 grid place-items-center text-[10px] font-bold overflow-hidden" style={{ background: item.bg || "#FF6B35", color: item.fg || "#fff" }}>{item.avatar ? <img src={item.avatar} alt="" className="w-full h-full object-cover" loading="lazy" /> : <CreditCard className="w-4 h-4" />}</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.title}</p><p className="text-xs text-muted-foreground truncate">{[item.subtitle, item.owner?.name].filter(Boolean).join(" · ")}</p></div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{item.card_type}</span>
        </Row>
      );
    case "series":
      return (
        <Row onClick={open} testid={tid}>
          <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-black/70 shrink-0">{item.cover && <img src={item.cover} alt="" className="w-full h-full object-cover" loading="lazy" />}<span className="absolute bottom-0.5 right-0.5 text-[9px] bg-black/70 text-white rounded px-1">{item.count} videos</span></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.title}</p><p className="text-xs text-muted-foreground truncate">Serie · {item.author?.name}{item.snippet ? ` · ${item.snippet}` : ""}</p></div>
        </Row>
      );
    case "hashtag":
      return (
        <Row onClick={open} testid={tid}>
          <div className="w-10 h-10 rounded-full bg-primary/10 grid place-items-center shrink-0"><Hash className="w-5 h-5 text-primary" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">#{item.tag}</p><p className="text-xs text-muted-foreground">{item.count} publicaciones</p></div>
        </Row>
      );
    case "product":
      return (
        <Row onClick={open} testid={tid}>
          <div className="w-14 h-14 rounded-xl bg-foreground/[0.06] overflow-hidden shrink-0 grid place-items-center">{item.image ? <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" /> : <Store className="w-5 h-5 text-muted-foreground" />}</div>
          <div className="min-w-0 flex-1"><p className="text-sm font-semibold truncate">{item.title}</p><p className="text-xs text-muted-foreground truncate">{item.seller || "Vendedor"}</p></div>
          <span className="text-sm font-bold text-primary shrink-0">{Number(item.price || 0).toLocaleString("es", { style: "currency", currency: item.currency || "USD" })}</span>
        </Row>
      );
    case "comment":
      return (
        <Row onClick={open} testid={tid}>
          <Avatar src={item.author?.avatar} fallback={item.author?.name} size="w-9 h-9" />
          <div className="min-w-0 flex-1"><p className="text-sm line-clamp-2">“{item.snippet}”</p><p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1"><MessageSquare className="w-3 h-3" />{item.author?.name} en {item.post?.is_video ? "un reel" : "una publicación"}: {item.post?.preview || "(sin texto)"}</p></div>
        </Row>
      );
    case "ai_private":
      return (
        <Row onClick={open} testid={tid}>
          <div className="w-10 h-10 rounded-full bg-primary/10 grid place-items-center shrink-0"><Sparkles className="w-5 h-5 text-primary" /></div>
          <div className="min-w-0 flex-1"><p className="text-sm font-medium truncate">{item.question}</p><p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.snippet}</p><p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(item.created_at)} · solo tú lo ves</p></div>
        </Row>
      );
    default:
      return null;
  }
}
