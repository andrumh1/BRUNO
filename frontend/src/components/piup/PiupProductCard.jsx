import React from "react";
import { motion } from "framer-motion";
import { Tag } from "lucide-react";

export default function PiupProductCard({ product, onOpen }) {
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors p-4 text-left"
      data-testid={`piup-product-${product.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Tag className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            {product.category_label}
          </p>
          <h3 className="text-sm font-semibold truncate">{product.name}</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {product.style_count} estilo{product.style_count > 1 ? "s" : ""} disponibles
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-primary">${product.base_price}</p>
          <p className="text-[10px] text-muted-foreground">desde</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1" data-testid={`piup-product-styles-${product.id}`}>
        {product.styles.slice(0, 6).map((s) => (
          <span key={s} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
            {s}
          </span>
        ))}
        {product.styles.length > 6 && (
          <span className="text-[10px] text-muted-foreground">+{product.styles.length - 6}</span>
        )}
      </div>
    </motion.button>
  );
}
