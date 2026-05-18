/**
 * PiupManagerPage — Reestructuracion completa del modulo NFC PIUP.
 *
 * 3 tabs:
 *   - "Mis Tags"      : listado de tarjetas digitales + estado fisico/digital
 *   - "Activar PIUP"  : escaner QR → seleccionar tarjeta → activar
 *   - "Tienda PIUP"   : catalogo 19 productos con filtros forma/tamano/color
 *
 * Estado real-time via RealtimeNotificationContext (evento `piup_activated`).
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import {
  ArrowLeft, Nfc, QrCode, ShoppingBag, CheckCircle2, Loader2,
  Camera, Sparkles, Package, ChevronRight, Search, Layers,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRealtimeNotifications } from "@/contexts/RealtimeNotificationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { brunoToast } from "@/components/bruno/BrunoToast";
import MisTagsTab from "@/components/piup/MisTagsTab";
import ActivarPiupTab from "@/components/piup/ActivarPiupTab";
import TiendaPiupTab from "@/components/piup/TiendaPiupTab";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TABS = [
  { id: "my-tags",  label: "Mis Tags",     icon: Layers,      testid: "piup-tab-my-tags" },
  { id: "activate", label: "Activar PIUP", icon: QrCode,      testid: "piup-tab-activate" },
  { id: "store",    label: "Tienda PIUP",  icon: ShoppingBag, testid: "piup-tab-store" },
];

export default function PiupManagerPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const { subscribe } = useRealtimeNotifications();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialTab = TABS.find((t) => t.id === searchParams.get("tab"))?.id || "my-tags";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [tagsData, setTagsData] = useState({ tags: [], summary: { total_cards: 0, physical: 0, digital_only: 0 } });
  const [loadingTags, setLoadingTags] = useState(true);

  const auth = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchTags = useCallback(async () => {
    setLoadingTags(true);
    try {
      const res = await axios.get(`${API}/piup/my-tags`, auth);
      setTagsData(res.data || { tags: [], summary: {} });
    } catch (e) {
      brunoToast.error("No pudimos cargar tus tags");
    } finally {
      setLoadingTags(false);
    }
  }, [auth]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  // Real-time: refresh tags when a PIUP is activated
  useEffect(() => {
    const unsub = subscribe((evt) => {
      if (!evt) return;
      if (evt.type === "piup_activated" || evt.kind === "piup_activated") {
        brunoToast.success("PIUP activado en tiempo real");
        fetchTags();
      }
    });
    return unsub;
  }, [subscribe, fetchTags]);

  const switchTab = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id }, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background pb-32" data-testid="piup-manager-page">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            data-testid="piup-back-btn"
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Nfc className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-base sm:text-lg truncate">PIUP Manager</h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">Tags fisicos, activacion y tienda</p>
            </div>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              {tagsData.summary.physical} fisicos
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
              {tagsData.summary.digital_only} digitales
            </span>
          </div>
        </div>

        {/* Pill Tabs */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3">
          <div
            className="flex gap-1 p-1 rounded-2xl bg-muted/60 backdrop-blur-sm overflow-x-auto"
            role="tablist"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={tab.testid}
                  onClick={() => switchTab(tab.id)}
                  className={`relative flex-1 min-w-[120px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive ? "text-white" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="piup-tab-bg"
                      className="absolute inset-0 rounded-xl bg-primary"
                      transition={{ type: "spring", stiffness: 360, damping: 30 }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span className="whitespace-nowrap">{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === "my-tags" && (
              <MisTagsTab
                tagsData={tagsData}
                loading={loadingTags}
                onGoToStore={(productHint) => switchTab("store")}
                onGoToActivate={() => switchTab("activate")}
                onRefresh={fetchTags}
              />
            )}
            {activeTab === "activate" && (
              <ActivarPiupTab
                tagsData={tagsData}
                auth={auth}
                onActivated={() => {
                  fetchTags();
                  switchTab("my-tags");
                }}
              />
            )}
            {activeTab === "store" && (
              <TiendaPiupTab
                auth={auth}
                cards={tagsData.tags}
                onOrdered={() => {
                  brunoToast.success("Pedido PIUP recibido");
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
