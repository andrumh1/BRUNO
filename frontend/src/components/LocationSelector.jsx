import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Search, X } from "lucide-react";

const LocationSelector = ({ location, onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [searchAddress, setSearchAddress] = useState("");
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización");
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        
        // Reverse geocoding para obtener la dirección
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
          );
          const data = await response.json();
          
          const locationData = {
            lat,
            lng,
            address: data.display_name || `${lat}, ${lng}`,
            place_name: data.display_name?.split(',')[0] || "Ubicación Actual"
          };
          
          setCurrentLocation(locationData);
          onChange(locationData);
          setShowModal(false);
        } catch (error) {
          console.error("Error getting address:", error);
          onChange({ lat, lng, address: `${lat}, ${lng}`, place_name: "Ubicación Actual" });
          setShowModal(false);
        }
        setLoading(false);
      },
      (error) => {
        alert("No se pudo obtener tu ubicación. Por favor permite el acceso a la ubicación.");
        setLoading(false);
      }
    );
  };

  const handleSearchAddress = async () => {
    if (!searchAddress.trim()) return;
    
    setLoading(true);
    try {
      // Geocoding para buscar la dirección
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}`
      );
      const data = await response.json();
      
      if (data && data.length > 0) {
        const result = data[0];
        const locationData = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          address: result.display_name,
          place_name: result.display_name.split(',')[0]
        };
        
        onChange(locationData);
        setShowModal(false);
      } else {
        alert("No se encontró la dirección. Intenta con otra búsqueda.");
      }
    } catch (error) {
      console.error("Error searching address:", error);
      alert("Error al buscar la dirección");
    }
    setLoading(false);
  };

  const openInMaps = () => {
    if (!location) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?q=${location.lat},${location.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
    
    window.open(url, '_blank');
  };

  const handleRemoveLocation = () => {
    onChange(null);
    setCurrentLocation(null);
  };

  return (
    <div className="space-y-3">
      {location ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium mb-1">{location.place_name}</h4>
                <p className="text-sm text-muted-foreground line-clamp-2">{location.address}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={openInMaps}
                  >
                    Ver en Mapa
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveLocation}
                  >
                    <X className="w-4 h-4 mr-1" />
                    Quitar
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowModal(true)}
          className="w-full"
        >
          <MapPin className="w-4 h-4 mr-2" />
          Agregar Ubicación
        </Button>
      )}

      {/* Modal de selección */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Agregar Ubicación</h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Ubicación actual */}
              <Button
                type="button"
                onClick={handleGetCurrentLocation}
                disabled={loading}
                className="w-full"
              >
                <Navigation className="w-4 h-4 mr-2" />
                {loading ? "Obteniendo ubicación..." : "Usar Mi Ubicación Actual"}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">O buscar dirección</span>
                </div>
              </div>

              {/* Búsqueda de dirección */}
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Ej: Calle Principal 123, Ciudad"
                    value={searchAddress}
                    onChange={(e) => setSearchAddress(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearchAddress()}
                    className="pl-10"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearchAddress}
                  disabled={loading || !searchAddress.trim()}
                  className="w-full"
                >
                  {loading ? "Buscando..." : "Buscar Dirección"}
                </Button>
              </div>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowModal(false)}
                className="w-full"
              >
                Cancelar
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
