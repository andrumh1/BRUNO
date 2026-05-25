/**
 * MapStyleSocial — BRUNO-branded Google Maps JSON styling.
 *
 *  Palette philosophy (per user request):
 *    - PREDOMINANTLY ORANGE (#FF6B35 family) and BEIGE (#FFF1DF / #FBE4C2)
 *    - All BRUNO PIUP pins are pure orange → the rest of the map is muted
 *      cream/beige so they ALWAYS win attention
 *    - Public POIs (hospitals, government, transit) remain readable but
 *      tinted with the brand palette
 *    - Roads use peach/orange tones instead of generic gray/white
 *
 *  Lives as a child of <Map> so it has access to useMap().
 */
import { useEffect } from "react";
import { useMap } from "@vis.gl/react-google-maps";

const SOCIAL_STYLE = [
  // Global base: warm beige
  { elementType: "geometry", stylers: [{ color: "#FFF1DF" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#4B3321" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#FFF7EE" }, { weight: 2.5 }] },

  // Land + parks (slightly darker beige; parks keep green for legibility)
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#FFE6C7" }] },
  { featureType: "landscape.natural.terrain", elementType: "geometry", stylers: [{ color: "#F5D6A2" }] },
  { featureType: "landscape.man_made", elementType: "geometry", stylers: [{ color: "#FFEBD2" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#D2E4B2" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#3E7B36" }] },

  // Water: muted teal so it doesn't compete with orange
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#A6D8E8" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#1F6F8B" }] },

  // ROADS — peach/orange tones (BRUNO brand)
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#FFE2C2" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#E89B5C" }, { weight: 0.8 }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#FFB37A" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#E06A1A" }, { weight: 1.5 }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.fill", stylers: [{ color: "#FF8C42" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#C24E00" }, { weight: 1.5 }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#FFCFA0" }] },
  { featureType: "road.arterial", elementType: "geometry.stroke", stylers: [{ color: "#D88243" }, { weight: 0.6 }] },
  { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#FFE9CC" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#7A3F11" }] },
  { featureType: "road", elementType: "labels.text.stroke", stylers: [{ color: "#FFF7EE" }, { weight: 2.5 }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },

  // Administrative — bold orange typography
  { featureType: "administrative.neighborhood", elementType: "labels.text.fill", stylers: [{ color: "#B45309" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#9A3412" }, { weight: 700 }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#4B3321" }] },
  { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.province", elementType: "labels.text.fill", stylers: [{ color: "#7C2D12" }] },

  // Public POIs — KEEP visible but tinted to brand palette
  { featureType: "poi.medical", elementType: "geometry", stylers: [{ color: "#FFD3D3" }] },
  { featureType: "poi.medical", elementType: "labels.text.fill", stylers: [{ color: "#B22222" }] },
  { featureType: "poi.medical", elementType: "labels.icon", stylers: [{ saturation: 15 }] },
  { featureType: "poi.government", elementType: "geometry", stylers: [{ color: "#FFCFA0" }] },
  { featureType: "poi.government", elementType: "labels.text.fill", stylers: [{ color: "#7C2D12" }] },
  { featureType: "poi.school", elementType: "geometry", stylers: [{ color: "#F8E1B2" }] },
  { featureType: "poi.school", elementType: "labels.text.fill", stylers: [{ color: "#7C5400" }] },
  { featureType: "poi.place_of_worship", elementType: "labels.text.fill", stylers: [{ color: "#7C2D12" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#7A3F11" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#E89B5C" }] },
  { featureType: "transit.station", elementType: "labels.icon", stylers: [{ saturation: 10 }] },

  // Commercial POIs — muted so BRUNO PIUP pins win attention
  { featureType: "poi.business", elementType: "labels", stylers: [{ visibility: "simplified" }] },
  { featureType: "poi.business", elementType: "labels.icon", stylers: [{ saturation: -65 }, { lightness: 8 }] },
  { featureType: "poi.attraction", elementType: "labels.icon", stylers: [{ saturation: -40 }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#6B4226" }] },
];

export default function MapStyleSocial() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    try {
      map.setOptions({ styles: SOCIAL_STYLE });
    } catch (_) { /* ignore */ }
  }, [map]);

  return null;
}
