import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { Loader2, Filter, Package } from "lucide-react";
import { brunoToast } from "@/components/bruno/BrunoToast";
import PiupProductCard from "@/components/piup/PiupProductCard";
import PiupProductConfigurator from "@/components/piup/PiupProductConfigurator";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SHAPES = [
  { id: "all", label: "Todas" },
  { id: "C", label: "Circulo" },
  { id: "U", label: "Cuadrado" },
  { id: "R", label: "Rectangulo" },
];

export default function TiendaPiupTab({ auth, cards }) {
  const [catalog, setCatalog] = useState({ products: [], categories: [], colors: [] });
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [shapeFilter, setShapeFilter] = useState("all");
  const [openProduct, setOpenProduct] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/piup/catalog`);
        if (alive) setCatalog(res.data);
      } catch {
        brunoToast.error("No pudimos cargar la tienda");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    return catalog.products.filter((p) => {
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (shapeFilter !== "all") {
        const hasShape = p.styles.some((s) => s.startsWith(shapeFilter));
        if (!hasShape) return false;
      }
      return true;
    });
  }, [catalog.products, categoryFilter, shapeFilter]);

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground" data-testid="piup-store-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Cargando tienda PIUP...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="piup-store-tab">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" data-testid="piup-store-category-filter">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors ${
            categoryFilter === "all" ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/40"
          }`}
          data-testid="piup-cat-all"
        >
          Todas ({catalog.products.length})
        </button>
        {catalog.categories.map((c) => {
          const count = catalog.products.filter((p) => p.category === c.id).length;
          const active = categoryFilter === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={`whitespace-nowrap text-xs px-3 py-1.5 rounded-full border transition-colors ${
                active ? "bg-primary text-white border-primary" : "bg-card border-border hover:border-primary/40"
              }`}
              data-testid={`piup-cat-${c.id}`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      <div className="flex gap-2 items-center text-xs text-muted-foreground" data-testid="piup-store-shape-filter">
        <Filter className="w-3.5 h-3.5" />
        <span>Forma:</span>
        {SHAPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setShapeFilter(s.id)}
            className={`px-2 py-1 rounded-md transition-colors ${
              shapeFilter === s.id ? "bg-primary text-white" : "bg-muted/40 hover:bg-muted"
            }`}
            data-testid={`piup-shape-${s.id}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground" data-testid="piup-store-empty">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No hay productos con esos filtros</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="piup-product-grid">
          {filtered.map((p) => (
            <PiupProductCard key={p.id} product={p} onOpen={() => setOpenProduct(p)} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {openProduct && (
          <PiupProductConfigurator
            product={openProduct}
            cards={cards}
            colors={catalog.colors}
            auth={auth}
            onClose={() => setOpenProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
