export type TileLayerId = 'osm' | 'satellite' | 'hybrid' | 'dark' | 'voyager';

export interface TileLayerConfig {
  id: TileLayerId;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
  overlayUrl?: string; // Calque additionnel (ex: routes au-dessus du satellite)
  overlayAttribution?: string;
}

/**
 * Fournisseurs mondiaux de tuiles Open Source & libres de droits (sans clé Google Maps requise).
 * Couvre 100% des pays du monde (Afrique, Europe, Amériques, Asie...).
 */
export const TILE_LAYERS: Record<TileLayerId, TileLayerConfig> = {
  osm: {
    id: 'osm',
    name: 'Plan Rues (OpenStreetMap)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    id: 'satellite',
    name: 'Vue Satellite (Esri Imagery)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 19,
  },
  hybrid: {
    id: 'hybrid',
    name: 'Hybride (Satellite + Rues)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Imagery & Labels',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    name: 'Mode Sombre (CartoDB Dark)',
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
  voyager: {
    id: 'voyager',
    name: 'Moderne (CartoDB Voyager)',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
  },
};
