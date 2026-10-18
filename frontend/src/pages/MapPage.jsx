/**
 * MapPage — Mapa social BRUNO: marcadores = tarjetas guardadas (pines PIUP + tarjetas con dirección),
 * exactamente las mismas que muestra la barra de tarjetas. Recomendaciones cercanas en panel aparte.
 *
 *  Bottom layer: Google Maps JS (calles, barrios, POIs publicos como hospitales,
 *  policia, alcaldias — la base "completa de Google").
 *  Top layer: PIUP business pins owned by Bruno users (claimable), each
 *  styled with the BRUNO identity (orange ring + emoji por categoria) so
 *  they se destacan sobre los iconos genericos de Google.
 *
 *  Without REACT_APP_GOOGLE_MAPS_API_KEY → renders an informative fallback
 *  card so the user knows what to configure.
 */
/* eslint-disable */
import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, useMap, InfoWindow } from "@vis.gl/react-google-maps";
import axios from "axios";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import MapProfilesBar from "@/components/bruno/MapProfilesBar";
import MapPinClaimModal from "@/components/bruno/MapPinClaimModal";
import MapStyleSocial from "@/components/bruno/MapStyleSocial";
import SharedLocationsLayer from "@/components/bruno/SharedLocationsLayer";
import OsmFallbackMap from "@/components/bruno/OsmFallbackMap";
import NearbyPlacesPanel from "@/components/bruno/NearbyPlacesPanel";
import { useMapCardItems } from "@/hooks/useMapCardItems";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { ArrowLeft, MapPin as MapPinIcon, Plus, Layers, Crosshair, ExternalLink, KeyRound, Search, User as UserIcon } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_ID || "DEMO_MAP_ID";

const BOGOTA = { lat: 4.6097, lng: -74.0817 };

export default function MapPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const nearbyOpen = searchParams.get("nearby") === "1";
  const setNearby = (open) => setSearchParams(open ? { nearby: "1" } : {}, { replace: true });
  // Marcadores del mapa == tarjetas de la barra (misma fuente de datos)
  const mapCards = useMapCardItems();

  const [initialCenter] = useState(BOGOTA);   // used only as the map's default center
  const [showClaim, setShowClaim] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPiupLayer, setShowPiupLayer] = useState(true);
  const mapRef = useRef(null);
  const pendingUserCenterRef = useRef(null);
  // Google failed (billing / key / network) → switch to free OSM layer automatically
  const [googleFailed, setGoogleFailed] = useState(() => sessionStorage.getItem("bruno-map-osm") === "1");
  const tilesOkRef = useRef(false);

  useEffect(() => {
    if (!GOOGLE_KEY || googleFailed) return;
    const fail = () => { sessionStorage.setItem("bruno-map-osm", "1"); setGoogleFailed(true); };
    window.gm_authFailure = fail;
    const origErr = console.error;
    console.error = (...args) => {
      const msg = args.map((a) => (typeof a === "string" ? a : a?.message || "")).join(" ");
      if (/Google Maps JavaScript API error|BillingNotEnabled|InvalidKey|RefererNotAllowed|ApiNotActivated/i.test(msg)) fail();
      origErr(...args);
    };
    const t = setTimeout(() => { if (!tilesOkRef.current) fail(); }, 9000);
    return () => { console.error = origErr; clearTimeout(t); delete window.gm_authFailure; };
  }, [googleFailed]);

  // ?lat=&lng= (desde un lugar en una publicación/historia/chat): centrar ahí y no saltar al GPS
  const focusLat = parseFloat(searchParams.get("lat")), focusLng = parseFloat(searchParams.get("lng"));
  const hasFocus = Number.isFinite(focusLat) && Number.isFinite(focusLng);
  useEffect(() => {
    if (!hasFocus) return;
    const c = { lat: focusLat, lng: focusLng };
    if (mapRef.current) mapRef.current.panTo(c); else pendingUserCenterRef.current = c;
  }, [hasFocus, focusLat, focusLng]);

  useEffect(() => {
    if (!navigator.geolocation || hasFocus) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Pan to user location ONCE — without controlling `center` (which would
        // freeze the map). If the map isn't ready yet, queue it.
        const userCenter = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (mapRef.current) mapRef.current.panTo(userCenter);
        else pendingUserCenterRef.current = userCenter;
      },
      () => { /* keep default */ },
      { timeout: 5000, maximumAge: 60000, enableHighAccuracy: false }
    );
  }, []);

  if (!GOOGLE_KEY) {
    return <NoApiKeyFallback />;
  }

  const useOsm = googleFailed;

  return (
    <APIProvider apiKey={GOOGLE_KEY} libraries={["places"]}>
      <div className="fixed inset-0 z-0 bg-background" data-testid="map-page-google">
        <div className="absolute top-0 inset-x-0 z-20 pointer-events-none" style={{ paddingTop: "calc(var(--safe-top) + 8px)" }}>
          <div className="pointer-events-auto flex items-center gap-2 px-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-background/90 backdrop-blur-md shadow flex items-center justify-center"
              data-testid="map-back-btn"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setNearby(!nearbyOpen)} className={`flex-1 h-10 rounded-full backdrop-blur-md shadow flex items-center px-4 gap-2 text-xs font-semibold transition-colors ${nearbyOpen ? "bg-primary text-white" : "bg-background/90 text-muted-foreground"}`} data-testid="map-nearby-btn">
              <Search className="w-4 h-4 shrink-0" />
              <span className="truncate">{nearbyOpen ? "Recomendaciones cerca de ti" : "Buscar restaurantes, negocios y servicios cerca"}</span>
            </button>
            <button
              onClick={() => setShowPiupLayer((v) => !v)}
              className={`w-10 h-10 rounded-full backdrop-blur-md shadow flex items-center justify-center ${
                showPiupLayer ? "bg-primary text-white" : "bg-background/90 text-foreground"
              }`}
              data-testid="map-toggle-piup-layer"
              aria-label="Toggle PIUP layer"
              title={showPiupLayer ? "Ocultar PIUP" : "Mostrar PIUP"}
            >
              <Layers className="w-5 h-5" />
            </button>
          </div>
        </div>

        {useOsm ? (
          <OsmFallbackMap center={initialCenter} mapRef={mapRef} pendingRef={pendingUserCenterRef} showPins={showPiupLayer} navigate={navigate} items={mapCards.items} />
        ) : (
        <Map
          mapId={MAP_ID}
          style={{ width: "100%", height: "100vh" }}
          defaultCenter={initialCenter}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons={false}
          colorScheme="LIGHT"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          onTilesLoaded={() => { tilesOkRef.current = true; }}
        >
          <MapInstanceCapture mapRef={mapRef} pendingUserCenterRef={pendingUserCenterRef} />
          {showPiupLayer && <CardMarkersLayer items={mapCards.items} onSelect={(p) => setSelectedPin(p)} />}
          <SharedLocationsLayer onSelect={(s) => mapRef.current?.panTo({ lat: s.last_lat, lng: s.last_lng })} />

          {selectedPin && (
            <InfoWindow
              position={{ lat: selectedPin.lat, lng: selectedPin.lng }}
              onCloseClick={() => setSelectedPin(null)}
            >
              <PinDetailCard pin={selectedPin} onClose={() => setSelectedPin(null)} navigate={navigate} />
            </InfoWindow>
          )}

          <MapStyleSocial />
        </Map>
        )}

        <div className="absolute right-3 flex flex-col gap-2 z-[60]" style={{ bottom: "calc(var(--nav-reserve, 96px) + 200px)" }}>
          <button
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  if (mapRef.current) mapRef.current.panTo(c);
                },
                () => brunoToast.error("No pudimos obtener tu ubicacion")
              );
            }}
            className="w-12 h-12 rounded-full bg-background/95 backdrop-blur-md shadow-lg flex items-center justify-center hover:bg-muted"
            data-testid="map-recenter-btn"
            aria-label="Recenter"
          >
            <Crosshair className="w-5 h-5" />
          </button>
          {token && (
            <button
              onClick={() => setShowClaim(true)}
              className="w-14 h-14 rounded-full bg-primary text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
              data-testid="map-claim-pin-btn"
              aria-label="Crear PIUP en el mapa"
            >
              <Plus className="w-7 h-7" />
            </button>
          )}
        </div>

        <MapProfilesBar cardItems={mapCards.items} onSelect={(it) => { if (it?.lat != null && it?.lng != null) mapRef.current?.panTo({ lat: it.lat, lng: it.lng }); }} />

        <AnimatePresence>
          {nearbyOpen && (
            <NearbyPlacesPanel
              onClose={() => setNearby(false)}
              onPick={(p) => { if (p?.lat != null && p?.lng != null) mapRef.current?.panTo({ lat: p.lat, lng: p.lng }); }}
              mapCenter={() => { const c = mapRef.current?.getCenter?.(); return c ? { lat: c.lat(), lng: c.lng() } : initialCenter; }}
            />
          )}
        </AnimatePresence>

        {showClaim && (
          <MapPinClaimModal
            initialCenter={mapRef.current ? { lat: mapRef.current.getCenter()?.lat(), lng: mapRef.current.getCenter()?.lng() } : initialCenter}
            onClose={() => setShowClaim(false)}
            onClaimed={() => {
              setShowClaim(false);
              brunoToast.success("Pin PIUP publicado en el mapa");
            }}
          />
        )}
      </div>
    </APIProvider>
  );
}

// Captures the Google Map instance via useMap() and exposes it through a ref
// so parent components can call panTo()/getCenter() without forcing a controlled
// `center` prop (which would freeze the map and break panning).
function MapInstanceCapture({ mapRef, pendingUserCenterRef }) {
  const map = useMap();
  useEffect(() => {
    if (map && mapRef) {
      mapRef.current = map;
      if (pendingUserCenterRef?.current) {
        try { map.panTo(pendingUserCenterRef.current); } catch (_e) { /* ignore */ }
        pendingUserCenterRef.current = null;
      }
    }
  }, [map, mapRef, pendingUserCenterRef]);
  return null;
}

function CardMarkersLayer({ items, onSelect }) {
  return (
    <>
      {items.map((p) => (
        <AdvancedMarker key={`${p.kind}-${p.id}`} position={{ lat: p.lat, lng: p.lng }} onClick={() => onSelect(p)} title={p.title || p.name}>
          {p.kind === "piup" ? <BrunoPin pin={p} /> : <CardBubble card={p} />}
        </AdvancedMarker>
      ))}
    </>
  );
}

function CardBubble({ card }) {
  const avatar = card.avatar_url || card.banner_url;
  return (
    <div data-testid={`map-card-marker-${card.id}`} className="relative flex flex-col items-center cursor-pointer group">
      <div className="w-11 h-11 rounded-full border-[3px] border-white shadow-xl overflow-hidden grid place-items-center group-hover:scale-110 transition-transform" style={{ backgroundColor: card.background_color || "#FF5A00" }}>
        {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-white" />}
      </div>
      <div className="w-0 h-0 -mt-1" style={{ borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `8px solid ${card.background_color || "#FF5A00"}`, filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }} />
    </div>
  );
}

function BrunoPin({ pin }) {
  return (
    <div
      data-testid={`map-piup-pin-${pin.id}`}
      className="relative flex flex-col items-center group cursor-pointer"
    >
      <div
        className="w-11 h-11 rounded-full border-[3px] border-white shadow-xl grid place-items-center text-base group-hover:scale-110 transition-transform"
        style={{ backgroundColor: pin.category_color || "#FF6A00" }}
      >
        <span className="leading-none">{pin.category_icon || "📍"}</span>
      </div>
      <div
        className="w-0 h-0 -mt-1"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `8px solid ${pin.category_color || "#FF6A00"}`,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
        }}
      />
    </div>
  );
}

function PinDetailCard({ pin, navigate, onClose }) {
  return (
    <div className="w-[260px]" data-testid={`map-piup-detail-${pin.id}`}>
      {pin.banner_url && (
        <div
          className="h-20 -mx-3 -mt-3 mb-2 rounded-t-md"
          style={{
            background: `linear-gradient(180deg, transparent, rgba(0,0,0,.4)), url(${pin.banner_url}) center/cover`,
          }}
        />
      )}
      <div className="flex items-center gap-2">
        <span
          className="w-8 h-8 rounded-full grid place-items-center text-sm shrink-0 overflow-hidden"
          style={{ backgroundColor: pin.category_color || pin.background_color || "#FF5A00" }}
        >
          {pin.kind === "card" && pin.avatar_url ? <img src={pin.avatar_url} alt="" className="w-full h-full object-cover" /> : (pin.category_icon || "📍")}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{pin.title || pin.name}</h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {pin.category_label || (pin.kind === "card" ? "Tarjeta BRUNO" : "")}
          </p>
        </div>
      </div>
      {pin.subtitle && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{pin.subtitle}</p>}
      {pin.address && (
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-start gap-1">
          <MapPinIcon className="w-3 h-3 mt-0.5 shrink-0" />
          <span className="truncate">{pin.address}</span>
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button
          size="sm"
          className="h-8 text-xs bg-primary"
          onClick={() => {
            onClose();
            navigate(`/c/${pin.card_id || pin.id}`);
          }}
          data-testid={`map-piup-view-card-${pin.id}`}
        >
          <ExternalLink className="w-3 h-3 mr-1" />
          Ver tarjeta
        </Button>
        {pin.lat && pin.lng && (
          <a
            className="inline-flex items-center justify-center h-8 text-xs rounded-md border border-border hover:bg-muted gap-1"
            href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`map-piup-directions-${pin.id}`}
          >
            Como llegar
          </a>
        )}
      </div>
    </div>
  );
}

function NoApiKeyFallback() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background p-6 pb-32" data-testid="map-no-api-key">
      <div className="max-w-md mx-auto rounded-3xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-muted hover:bg-muted/70 grid place-items-center"
            data-testid="map-no-key-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-lg">Mapa social BRUNO</h2>
        </div>

        <div className="rounded-2xl bg-primary/10 p-4 flex items-start gap-3">
          <KeyRound className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Falta tu Google Maps API key</p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Para activar el mapa hibrido con calles, hospitales y POIs reales,
              configura tu API key en{" "}
              <code className="px-1 py-0.5 rounded bg-background">
                REACT_APP_GOOGLE_MAPS_API_KEY
              </code>
              . Habilita Maps JavaScript API + Places API en Google Cloud Console.
            </p>
          </div>
        </div>

        <div className="mt-4 text-xs text-muted-foreground leading-relaxed">
          Mientras tanto, la barra de burbujas PIUP/Stories que veras abajo ya
          esta operativa — lista para tu nuevo mapa cuando agregues la key.
        </div>
      </div>

      {/* Pill bar works without the map — useful for verification & UX preview */}
      <MapProfilesBar />
    </div>
  );
}
