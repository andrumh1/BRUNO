/**
 * MisTagsTab — Listado de tarjetas del usuario marcadas como físico/digital.
 */
import React from "react";
import { motion } from "framer-motion";
import {
  Loader2, ShoppingBag, RefreshCw, Nfc, CheckCircle2, Circle, ExternalLink, QrCode, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PHYSICAL_BADGE = "bg-primary/15 text-primary border-primary/30";
const DIGITAL_BADGE = "bg-muted text-muted-foreground border-border";

export default function MisTagsTab({ tagsData, loading, onGoToStore, onGoToActivate, onRefresh }) {
  const navigate = useNavigate();
  const { tags, summary } = tagsData;

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center gap-3 text-muted-foreground" data-testid="piup-tags-loading">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm">Cargando tus tarjetas...</p>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-16" data-testid="piup-tags-empty">
        <div className="w-20 h-20 rounded-2xl bg-muted mx-auto flex items-center justify-center mb-4">
          <Nfc className="w-9 h-9 text-muted-foreground/60" />
        </div>
        <h3 className="text-lg font-semibold mb-1">Aun no tienes tarjetas</h3>
        <p className="text-sm text-muted-foreground mb-5">Crea tu primera tarjeta Bruno para poder vincularle un PIUP.</p>
        <Button onClick={() => navigate("/cards/new")} data-testid="piup-create-card-btn">
          Crear tarjeta
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary chips */}
      <div className="flex flex-wrap gap-2 items-center" data-testid="piup-tags-summary">
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {summary.physical} fisicos
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground border border-border">
          <Circle className="w-3.5 h-3.5" />
          {summary.digital_only} solo digital
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="ml-auto h-8 text-xs"
          data-testid="piup-refresh-tags"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Refrescar
        </Button>
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="piup-tag-list">
        {tags.map((tag, i) => (
          <motion.div
            key={tag.card_id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="rounded-2xl border border-border bg-card hover:border-primary/40 transition-colors overflow-hidden"
            data-testid={`piup-tag-card-${tag.card_id}`}
          >
            <div
              className="h-20 relative"
              style={{
                background: tag.banner_url
                  ? `linear-gradient(180deg, transparent, rgba(0,0,0,.35)), url(${tag.banner_url}) center/cover`
                  : `linear-gradient(135deg, ${tag.background_color}, ${tag.background_color}cc)`,
              }}
            >
              <div className="absolute top-2 right-2">
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border font-medium ${
                    tag.is_physical ? PHYSICAL_BADGE : DIGITAL_BADGE
                  }`}
                >
                  {tag.is_physical ? (
                    <>
                      <Nfc className="w-3 h-3" />
                      PIUP fisico
                    </>
                  ) : (
                    <>
                      <Circle className="w-3 h-3" />
                      Solo digital
                    </>
                  )}
                </span>
              </div>
              {tag.avatar_url && (
                <img
                  src={tag.avatar_url}
                  alt=""
                  className="absolute -bottom-5 left-3 w-12 h-12 rounded-xl object-cover ring-2 ring-card"
                />
              )}
            </div>

            <div className="p-4 pt-7">
              <h3 className="font-semibold text-sm truncate">{tag.title || "Sin titulo"}</h3>
              {tag.subtitle && (
                <p className="text-xs text-muted-foreground truncate">{tag.subtitle}</p>
              )}

              {tag.is_physical && tag.physical_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1" data-testid={`piup-physical-list-${tag.card_id}`}>
                  {tag.physical_tags.slice(0, 3).map((pt) => (
                    <span
                      key={pt.nfc_id}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-mono truncate max-w-[120px]"
                      title={pt.nfc_id}
                    >
                      {pt.nfc_id?.slice(0, 12)}...
                    </span>
                  ))}
                  {tag.physical_tags.length > 3 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                      +{tag.physical_tags.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                {tag.is_physical ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8"
                    onClick={onGoToStore}
                    data-testid={`piup-renew-${tag.card_id}`}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" />
                    Renovar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="text-xs h-8 bg-primary"
                    onClick={onGoToStore}
                    data-testid={`piup-request-${tag.card_id}`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1" />
                    Solicitar PIUP
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8"
                  onClick={() => navigate(`/c/${tag.card_id}`)}
                  data-testid={`piup-view-${tag.card_id}`}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Ver
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="pt-4">
        <button
          type="button"
          onClick={onGoToActivate}
          className="w-full p-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors text-left flex items-center gap-3"
          data-testid="piup-go-to-activate"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold">Tienes un PIUP fisico nuevo?</h4>
            <p className="text-xs text-muted-foreground">Activalo escaneando su QR</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
