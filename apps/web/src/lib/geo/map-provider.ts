import type { GeoJsonBoundary, LatLngPoint } from '@rentflow/shared';

export type MapProviderId = 'leaflet_osm' | 'google_maps';

export type MapViewMode = 'ROADMAP' | 'SATELLITE' | 'HYBRID' | 'DARK';

export type GeoLayerLevel = 'NEIGHBORHOOD' | 'BLOCK' | 'OWNER' | 'PROPERTY';

export interface PropertyMarkerDetails {
  propertyId: string;
  name: string;
  type: string;
  customPropertyType?: string | undefined;
  priceMinor?: number | undefined;
  currency?: string | undefined;
  status?: string | undefined;
  address: string;
  city: string;
  neighborhood?: string | undefined;
  country?: string | undefined;
  roomsCount?: number | undefined;
  bedroomsCount?: number | undefined;
  photoUrl?: string | undefined;
  available?: boolean | undefined;
}

export interface GeoPolygonOverlay {
  id: string;
  level: GeoLayerLevel;
  label: string;
  sublabel?: string | undefined;
  boundary: GeoJsonBoundary;
  color: string;
  fillOpacity?: number | undefined;
  strokeWeight?: number | undefined;
  locked?: boolean | undefined;
  metadata?: Record<string, string | number | boolean | undefined> | undefined;
}

export interface GeoMarkerOverlay {
  id: string;
  level: GeoLayerLevel;
  title: string;
  subtitle?: string | undefined;
  position: LatLngPoint;
  color?: string | undefined;
  metadata?: Record<string, string | number | boolean | undefined> | undefined;
  propertyDetails?: PropertyMarkerDetails | undefined;
}

export interface GeocodeResult {
  address: string;
  lat: number;
  lng: number;
  region?: string | undefined;
  department?: string | undefined;
  arrondissement?: string | undefined;
  neighborhood?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
}

export interface MapProviderConfig {
  provider: MapProviderId;
  defaultCenter: LatLngPoint;
  defaultZoom: number;
}

/**
 * Centre par défaut DOMORA (monde / Afrique de l'Ouest et Centrale).
 * Utilisé uniquement avant recherche, position GPS ou focus sur une propriété.
 */
export const DEFAULT_MAP_PROVIDER_CONFIG: MapProviderConfig = {
  provider: 'leaflet_osm',
  defaultCenter: { lat: 4.051, lng: 9.767 }, // Douala / Yaoundé / Afrique Centrale & Ouest
  defaultZoom: 13,
};


export const GEO_LAYER_COLORS: Record<GeoLayerLevel, { stroke: string; fill: string; label: string }> = {
  NEIGHBORHOOD: {
    stroke: '#7c3aed',
    fill: '#7c3aed',
    label: 'Niveau 1 · Quartiers',
  },
  BLOCK: {
    stroke: '#0891b2',
    fill: '#06b6d4',
    label: 'Niveau 2 · Zones Chefs de Bloc',
  },
  OWNER: {
    stroke: '#d97706',
    fill: '#f59e0b',
    label: 'Niveau 3 · Secteurs Propriétaires',
  },
  PROPERTY: {
    stroke: '#059669',
    fill: '#10b981',
    label: 'Niveau 4 · Propriétés Immobilières',
  },
};
