/**
 * MapStyleSocial — injects a Snapchat-inspired custom JSON style on the
 * current Google Map. Lives as a child of <Map> so it has access to useMap().
 *
 * Style philosophy:
 *   - Muted cream/sand background → highlights orange Bruno pins
 *   - Soft pastel roads with strong typography for street names
 *   - Public POIs (hospitals, government, transit) are KEPT visible
 *   - Commercial business POIs are slightly muted so BRUNO PIUP pins win the eye
 */
import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

const SOCIAL_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#FFF7EE" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#3A2E22" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFF7EE" }, { weight: 2.5 }] },

  // Land + parks
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#FFF1DF" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#FBE4C2" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#CDE9C5" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3E7B36" }] },

  // Water
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#A6D8E8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1F6F8B" }] },

  // Roads — pastel orange highways, white streets, strong type
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFFFFF" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#F2C9A0" }, { weight: 0.8 }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#FFD7AE" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#FF9F4C" }, { weight: 1.2 }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#FFE8C9" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#5B4633" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // Administrative — neighborhood / locality labels prominent
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#B45309" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#92400E" }, { weight: 700 }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#4B3321" }] },
  { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },

  // Public POIs — KEEP and emphasize (hospitals, government, transit, schools)
  { featureType: "poi.medical", elementType: "geometry", stylers: [{ color: "#FFD3D3" }] },
  { featureType: "poi.medical", elementType: "labels.text.fill", stylers: [{ color: "#B22222" }] },
  { featureType: "poi.medical", elementType: "labels.icon", stylers: [{ saturation: 15 }] },
  { featureType: "poi.government", elementType: "geometry", stylers: [{ color: "#D7E3FF" }] },
  { featureType: "poi.government", elementType: "labels.text.fill", stylers: [{ color: "#1E3A8A" }] },
  { featureType: "poi.school", elementType: "labels.text.fill", stylers: [{ color: "#1F6F8B" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#5B4633" }] },
  { featureType: "transit.station", elementType: "labels.icon", stylers: [{ saturation: 10 }] },

  // Commercial POIs — muted so BRUNO PIUP pins win attention
  { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi.business", elementType: "labels.icon", stylers: [{ saturation: -50 }] },
  { featureType: "poi.attraction", elementType: "labels.icon", stylers: [{ saturation: -30 }] },
];

export default function MapStyleSocial() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    // Applying a styles array to a vector map with a non-null mapId can be
    // a no-op, but Google's docs say setOptions({styles}) still works on
    // legacy maps. We try both for compatibility.
    try {
      map.setOptions({ styles: SOCIAL_STYLE });
    } catch (_) { /* ignore */ }
  }, [map]);

  return null;
}
