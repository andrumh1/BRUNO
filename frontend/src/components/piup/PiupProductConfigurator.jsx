import React, { useState } from "react";
import { motion } from "framer-motion";
import { X, Check, Loader2, ShoppingBag } from "lucide-react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SHAPE_CLASS = { C: "rounded-full", U: "rounded-md", R: "rounded-md" };
const SHAPE_SIZE = { C: "w-10 h-10", U: "w-10 h-10", R: "w-12 h-8" };

function StylePill({ code, selected, onClick }) {
  const shape = code[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
        selected ? "border-primary bg-primary text-white" : "border-border bg-muted/30 hover:border-primary/40"
      }`}
      data-testid={`piup-style-${code}`}
    >
      <span className={`${SHAPE_SIZE[shape]} ${SHAPE_CLASS[shape]} border-2 ${selected ? "border-white" : "border-current"}`} />
      <span className="font-mono">{code}</span>
    </button>
  );
}

export default function PiupProductConfigurator({ product, cards, colors, auth, onClose }) {
  const [style, setStyle] = useState(product.styles[0]);
  const [color, setColor] = useState(colors[0]?.id || "black");
  const [quantity, setQuantity] = useState(1);
  const [cardId, setCardId] = useState(cards[0]?.card_id || "");
  const [submitting, setSubmitting] = useState(false);

  const total = (product.base_price * quantity).toFixed(2);

  const submit = async () => {
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/piup/request-physical`,
        { product_id: product.id, style, color_id: color, card_id: cardId || null, quantity },
        auth
      );
      brunoToast.success(`Pedido de ${product.name} (${style}) creado`);
      onClose();
    } catch (e) {
      brunoToast.error(e?.response?.data?.detail || "No pudimos crear el pedido");
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStyle = product.styles_detail.find((s) => s.code === style);

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      data-testid="piup-configurator-overlay"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        data-testid="piup-configurator"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{product.category_label}</p>
              <h2 className="text-xl font-bold">{product.name}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 flex items-center justify-center"
              data-testid="piup-configurator-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              Forma y tamano
            </label>
            <div className="flex flex-wrap gap-2" data-testid="piup-style-picker">
              {product.styles_detail.map((s) => (
                <StylePill key={s.code} code={s.code} selected={style === s.code} onClick={() => setStyle(s.code)} />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedStyle?.shape_label} — {selectedStyle?.size_label}
            </p>
          </div>

          <div className="mb-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              Color
            </label>
            <div className="flex flex-wrap gap-2" data-testid="piup-color-picker">
              {colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`w-9 h-9 rounded-full border-2 transition-transform ${
                    color === c.id ? "border-primary scale-110" : "border-border"
                  }`}
                  style={{ background: c.hex }}
                  title={c.name}
                  data-testid={`piup-color-${c.id}`}
                >
                  {color === c.id && (
                    <Check className="w-4 h-4 mx-auto" style={{ color: c.id === "white" ? "#000" : "#fff" }} />
                  )}
                </button>
              ))}
            </div>
          </div>

          {cards.length > 0 && (
            <div className="mb-4">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                Vincular a tarjeta (opcional)
              </label>
              <select
                value={cardId}
                onChange={(e) => setCardId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                data-testid="piup-config-card-select"
              >
                <option value="">Sin vincular (la asigno despues)</option>
                {cards.map((c) => (
                  <option key={c.card_id} value={c.card_id}>
                    {c.title} {c.is_physical ? `· (${c.physical_tag_count} fisicos)` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mb-4">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
              Cantidad
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-9 h-9 rounded-lg border border-border hover:bg-muted"
                data-testid="piup-qty-minus"
              >
                −
              </button>
              <span className="text-lg font-semibold w-8 text-center" data-testid="piup-qty-value">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(Math.min(20, quantity + 1))}
                className="w-9 h-9 rounded-lg border border-border hover:bg-muted"
                data-testid="piup-qty-plus"
              >
                +
              </button>
              <span className="ml-auto text-sm text-muted-foreground">${product.base_price} c/u</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-primary" data-testid="piup-config-total">${total}</p>
            </div>
            <Button onClick={submit} disabled={submitting} className="bg-primary h-11 px-6" data-testid="piup-config-confirm">
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Pedido...
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Solicitar PIUP
                </>
              )}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
