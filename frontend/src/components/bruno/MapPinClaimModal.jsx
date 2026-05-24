/**
 * MapPinClaimModal — bottom-sheet modal for businesses or users to claim a pin
 * on the map for one of their Bruno cards.
 *
 * UX flow:
 *  1) Pick a card (drop-down of the user's cards).
 *  2) Pick a category (9 presets with icon + color).
 *  3) Confirm the location (defaults to current map center, can be edited).
 *  4) POST /api/map-pins/claim → pin appears immediately on the map.
 */
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { X, MapPin, Loader2, CheckCircle2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MapPinClaimModal({ initialCenter, onClose, onClaimed }) {
  const { token } = useAuth();
  const [cards, setCards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [cardId, setCardId] = useState("");
  const [category, setCategory] = useState("personal");
  const [lat, setLat] = useState(initialCenter?.lat || 0);
  const [lng, setLng] = useState(initialCenter?.lng || 0);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [address, setAddress] = useState("");

  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [c, cat] = await Promise.all([
          axios.get(`${API}/cards`, auth),
          axios.get(`${API}/map-pins/categories`),
        ]);
        if (!alive) return;
        setCards(c.data || []);
        setCategories(cat.data?.categories || []);
        if (c.data?.[0]) {
          setCardId(c.data[0].id);
          setTitle(c.data[0].title || "");
          setSubtitle(c.data[0].subtitle || "");
        }
      } catch (_) {
        brunoToast.error("No pudimos cargar tus tarjetas");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [auth]);

  const submit = async () => {
    if (!cardId) {
      brunoToast.error("Elige una tarjeta para vincular");
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API}/map-pins/claim`,
        {
          card_id: cardId,
          lat: Number(lat),
          lng: Number(lng),
          title: title || null,
          subtitle: subtitle || null,
          category,
          address: address || null,
          is_public: true,
        },
        auth
      );
      brunoToast.success("Pin publicado en el mapa");
      onClaimed?.(res.data?.pin);
    } catch (e) {
      brunoToast.error(e?.response?.data?.detail || "No se pudo publicar el pin");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
      data-testid="map-claim-modal-overlay"
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-background rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto"
        data-testid="map-claim-modal"
      >
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nueva PIUP en el mapa</p>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                Reclamar punto
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 grid place-items-center"
              data-testid="map-claim-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="py-10 grid place-items-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Card selector */}
              <div className="mb-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                  Tarjeta a vincular
                </label>
                {cards.length === 0 ? (
                  <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-3 text-center">
                    Crea primero una tarjeta Bruno
                  </p>
                ) : (
                  <select
                    value={cardId}
                    onChange={(e) => {
                      const c = cards.find((x) => x.id === e.target.value);
                      setCardId(e.target.value);
                      if (c) {
                        setTitle((t) => t || c.title || "");
                        setSubtitle((s) => s || c.subtitle || "");
                      }
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm"
                    data-testid="map-claim-card-select"
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title || "Tarjeta sin titulo"}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Category */}
              <div className="mb-4">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2 block">
                  Categoria
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5" data-testid="map-claim-cat-picker">
                  {categories.map((c) => {
                    const active = category === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategory(c.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl text-[10px] border transition-colors ${
                          active ? "border-primary bg-primary/10 text-foreground" : "border-border hover:border-primary/40"
                        }`}
                        data-testid={`map-claim-cat-${c.id}`}
                      >
                        <span
                          className="w-8 h-8 rounded-full grid place-items-center text-sm"
                          style={{ backgroundColor: c.color, color: "#fff" }}
                        >
                          {c.icon}
                        </span>
                        <span className="font-medium leading-tight">{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Coords (auto-filled, but editable) */}
              <div className="mb-4 grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Latitud</label>
                  <Input
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    className="h-9 font-mono text-xs"
                    data-testid="map-claim-lat"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Longitud</label>
                  <Input
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    className="h-9 font-mono text-xs"
                    data-testid="map-claim-lng"
                  />
                </div>
              </div>

              {/* Title / subtitle / address */}
              <div className="mb-3">
                <label className="text-xs text-muted-foreground">Titulo</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nombre del negocio o lugar"
                  className="h-9 text-sm"
                  data-testid="map-claim-title"
                />
              </div>
              <div className="mb-3">
                <label className="text-xs text-muted-foreground">Subtitulo (opcional)</label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="h-9 text-sm"
                  data-testid="map-claim-subtitle"
                />
              </div>
              <div className="mb-4">
                <label className="text-xs text-muted-foreground">Direccion (opcional)</label>
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  className="text-sm"
                  data-testid="map-claim-address"
                />
              </div>

              <Button
                onClick={submit}
                disabled={submitting || !cardId}
                className="w-full bg-primary h-11"
                data-testid="map-claim-submit"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publicando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Publicar pin en el mapa
                  </>
                )}
              </Button>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Tu pin aparecera al instante con el icono de la categoria y los colores BRUNO.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
