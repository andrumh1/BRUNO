/* Sección exclusiva PIUP (Octopus Vision Company) dentro del Marketplace. Catálogo, inventario y pedidos los administra OVC. */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, BadgeCheck, Loader2, Package, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import PiupProductCard from "@/components/piup/PiupProductCard";
import PiupProductConfigurator from "@/components/piup/PiupProductConfigurator";
import { OvcMark } from "@/components/brand/OvcAttribution";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const PiupOfficialBadge = ({ className = "" }) => (
  <span className={`inline-flex items-center gap-1 rounded-full bg-orange-500 text-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${className}`} data-testid="piup-official-badge">
    <BadgeCheck className="w-3 h-3" /> Oficial PIUP · OVC
  </span>
);

export default function MarketplacePiupPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [catalog, setCatalog] = useState(null);
  const [cards, setCards] = useState([]);
  const [openProduct, setOpenProduct] = useState(null);
  const category = params.get("cat") || "all";
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    axios.get(`${API}/piup/catalog`).then((r) => setCatalog(r.data)).catch(() => setCatalog({ products: [], categories: [], colors: [] }));
    if (token) axios.get(`${API}/piup/my-tags`, auth).then((r) => setCards(r.data?.tags || [])).catch(() => setCards([]));
  }, [token, auth]);

  useEffect(() => {
    const pid = params.get("product");
    if (pid && catalog?.products?.length) {
      const p = catalog.products.find((x) => x.id === pid);
      if (p) setOpenProduct(p);
    }
  }, [params, catalog]);

  const items = useMemo(() => (catalog?.products || []).filter((p) => category === "all" || p.category === category), [catalog, category]);

  const open = (p) => {
    if (!user) { navigate(`/login?next=/marketplace/piup?product=${p.id}`); return; }
    setOpenProduct(p);
    setParams({ ...(category !== "all" ? { cat: category } : {}), product: p.id });
  };
  const close = () => { setOpenProduct(null); setParams(category !== "all" ? { cat: category } : {}); };

  return (
    <div className="min-h-screen bg-background" data-testid="marketplace-piup-page">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b" style={{ paddingTop: "var(--safe-top, 0px)" }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/marketplace"><Button variant="ghost" size="icon" className="rounded-full" data-testid="piup-back"><ArrowLeft className="w-5 h-5" /></Button></Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold flex items-center gap-2">PIUP <PiupOfficialBadge /></h1>
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5"><OvcMark size={14} /> Productos NFC fabricados y enviados por Octopus Vision Company</p>
          </div>
          {user && <Button variant="outline" size="sm" className="rounded-full" onClick={() => navigate("/purchases?tab=piup")} data-testid="piup-my-orders">Mis pedidos</Button>}
        </div>
        <div className="overflow-x-auto px-4 pb-2">
          <div className="flex gap-2 min-w-max">
            {[{ id: "all", label: "Todos" }, ...(catalog?.categories || [])].map((c) => (
              <button key={c.id} onClick={() => setParams(c.id === "all" ? {} : { cat: c.id })} className={`px-4 h-8 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${category === c.id ? "bg-orange-500 text-white" : "bg-muted hover:bg-muted/80"}`} data-testid={`piup-cat-${c.id}`}>{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <div className="rounded-2xl border border-orange-300/50 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/10 p-4 flex items-start gap-3" data-testid="piup-ovc-banner">
          <ShieldCheck className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Sección oficial, separada de las tiendas de usuarios</p>
            <p className="text-muted-foreground text-xs mt-0.5">Los PIUP son productos de OVC: su catálogo, inventario, pedidos y soporte los gestiona OVC directamente. El pago se procesa de forma segura con Stripe y se confirma en el servidor antes de preparar tu pedido.</p>
          </div>
        </div>

        {catalog === null ? <div className="grid place-items-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          : items.length === 0 ? <div className="text-center py-20 text-muted-foreground"><Package className="w-12 h-12 mx-auto mb-3" />No hay productos PIUP en esta categoría.</div>
          : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" data-testid="piup-grid">
              {items.map((p) => (
                <div key={p.id} className="relative">
                  <PiupProductCard product={p} onOpen={() => open(p)} />
                  {p.stock != null && p.stock <= 0 && <span className="absolute top-2 left-2 rounded-full bg-zinc-800 text-white text-[10px] px-2 py-0.5">Agotado</span>}
                </div>
              ))}
            </div>
          )}
      </div>

      <AnimatePresence>
        {openProduct && user && <PiupProductConfigurator product={openProduct} cards={cards} colors={catalog?.colors || []} auth={auth} onClose={close} />}
      </AnimatePresence>
      <div style={{ height: "var(--content-bottom, 80px)" }} />
    </div>
  );
}
