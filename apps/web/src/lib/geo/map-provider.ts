import type { GeoJsonBoundary, LatLngPoint } from '@rentflow/shared';

export type MapProviderId = 'google_maps';

export type MapViewMode = 'ROADMAP' | 'SATELLITE' | 'HYBRID';

export type GeoLayerLevel = 'NEIGHBORHOOD' | 'BLOCK' | 'OWNER' | 'PROPERTY';

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
}

export interface MapProviderConfig {
  provider: MapProviderId;
  defaultCenter: LatLngPoint;
  defaultZoom: number;
}

/**
 * Centre par défaut DOMORA / KatdEstate (Abidjan, Côte d'Ivoire — Cocody)
 * Utilisé uniquement comme point de centrage initial de la caméra avant recherche ou GPS.
 */
export const DEFAULT_MAP_PROVIDER_CONFIG: MapProviderConfig = {
  provider: 'google_maps',
  defaultCenter: { lat: 5.360, lng: -3.980 },
  defaultZoom: 14,
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
