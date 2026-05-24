/**
 * MapPage — Hybrid Google Maps + PIUP pins.
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
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { APIProvider, Map, AdvancedMarker, useMap, InfoWindow } from "@vis.gl/react-google-maps";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import MapProfilesBar from "@/components/bruno/MapProfilesBar";
import MapPinClaimModal from "@/components/bruno/MapPinClaimModal";
import MapStyleSocial from "@/components/bruno/MapStyleSocial";
import { Button } from "@/components/ui/button";
import { brunoToast } from "@/components/bruno/BrunoToast";
import { ArrowLeft, MapPin as MapPinIcon, Plus, Layers, Crosshair, ExternalLink, KeyRound } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const GOOGLE_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
const MAP_ID = process.env.REACT_APP_GOOGLE_MAPS_ID || "DEMO_MAP_ID";

const BOGOTA = { lat: 4.6097, lng: -74.0817 };

export default function MapPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [center, setCenter] = useState(BOGOTA);
  const [showClaim, setShowClaim] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [showPiupLayer, setShowPiupLayer] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { /* keep default */ },
      { timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  if (!GOOGLE_KEY) {
    return <NoApiKeyFallback />;
  }

  return (
    <APIProvider apiKey={GOOGLE_KEY} libraries={["places"]}>
      <div className="fixed inset-0 z-0 bg-background" data-testid="map-page-google">
        <div className="absolute top-0 inset-x-0 z-20 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 px-3 pt-3">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full bg-background/90 backdrop-blur-md shadow flex items-center justify-center"
              data-testid="map-back-btn"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 h-10 rounded-full bg-background/90 backdrop-blur-md shadow flex items-center px-4 gap-2">
              <MapPinIcon className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold truncate">Mapa social BRUNO</span>
              <span className="ml-auto text-[10px] text-muted-foreground hidden sm:block">
                Google Maps + PIUP
              </span>
            </div>
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

        <Map
          mapId={MAP_ID}
          style={{ width: "100%", height: "100vh" }}
          defaultCenter={center}
          center={center}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          clickableIcons
          colorScheme="LIGHT"
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
        >
          {showPiupLayer && <PiupPinsLayer onSelect={(p) => setSelectedPin(p)} />}

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

        <div className="absolute right-3 bottom-32 flex flex-col gap-2 z-20">
          <button
            onClick={() => {
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(
                (pos) => setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
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

        <MapProfilesBar />

        {showClaim && (
          <MapPinClaimModal
            initialCenter={center}
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

function PiupPinsLayer({ onSelect }) {
  const map = useMap();
  const [pins, setPins] = useState([]);
  const lastFetchRef = useRef(0);

  const fetchPins = useCallback(async () => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const now = Date.now();
    if (now - lastFetchRef.current < 500) return;
    lastFetchRef.current = now;
    try {
      const res = await axios.get(`${API}/map-pins`, {
        params: {
          min_lat: sw.lat(), max_lat: ne.lat(),
          min_lng: sw.lng(), max_lng: ne.lng(),
          limit: 200,
        },
      });
      setPins(res.data?.pins || []);
    } catch (_) { /* swallow */ }
  }, [map]);

  useEffect(() => {
    if (!map) return;
    const listener = map.addListener("idle", fetchPins);
    fetchPins();
    return () => window.google?.maps?.event?.removeListener(listener);
  }, [map, fetchPins]);

  return (
    <>
      {pins.map((p) => (
        <AdvancedMarker
          key={p.id}
          position={{ lat: p.lat, lng: p.lng }}
          onClick={() => onSelect(p)}
          title={p.title}
        >
          <BrunoPin pin={p} />
        </AdvancedMarker>
      ))}
    </>
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
        style={{ backgroundColor: pin.category_color || "#FF5A00" }}
      >
        <span className="leading-none">{pin.category_icon || "📍"}</span>
      </div>
      <div
        className="w-0 h-0 -mt-1"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderTop: `8px solid ${pin.category_color || "#FF5A00"}`,
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
          className="w-8 h-8 rounded-full grid place-items-center text-sm shrink-0"
          style={{ backgroundColor: pin.category_color }}
        >
          {pin.category_icon}
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-sm truncate">{pin.title}</h3>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {pin.category_label}
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
            navigate(`/c/${pin.card_id}`);
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
