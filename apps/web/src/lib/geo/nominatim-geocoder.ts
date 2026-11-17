import { toGeoJsonPolygon, type GeoJsonBoundary } from '@rentflow/shared';
import type { GeocodeResult } from './map-provider';

interface NominatimPlace {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  boundingbox?: [string, string, string, string];
  geojson?: {
    type: string;
    coordinates: any;
  };
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    hamlet?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state_district?: string;
    state?: string;
    region?: string;
    country?: string;
    postcode?: string;
  };
}

const cache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, GeocodeResult>();

function parseAddressFields(addr: NominatimPlace['address'] = {}) {
  const neighborhood =
    addr.quarter ||
    addr.neighbourhood ||
    addr.suburb ||
    addr.hamlet ||
    addr.city_district ||
    undefined;
  const city =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    undefined;
  const department = addr.county || addr.state_district || undefined;
  const region = addr.state || addr.region || department || undefined;
  const country = addr.country || undefined;

  return { neighborhood, city, department, region, country };
}

/**
 * Recherche géographique internationale via Nominatim (OpenStreetMap).
 * Fonctionne dans tous les pays du monde sans aucune clé API requise.
 */
export async function searchAddressWithNominatim(
  query: string,
  limit = 6,
): Promise<GeocodeResult[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 2) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${limit}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'fr');
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as NominatimPlace[];
    const results: GeocodeResult[] = data.map((place) => {
      const parsed = parseAddressFields(place.address);
      return {
        address: place.display_name,
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        neighborhood: parsed.neighborhood,
        city: parsed.city,
        region: parsed.region,
        department: parsed.department,
        country: parsed.country,
      };
    });

    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

/**
 * Géocodage inverse haute précision (zoom=16) : retrouve la ville réelle (ex: Mbanga),
 * le département (ex: Moungo), le quartier, la région et le pays à partir de coordonnées GPS.
 */
export async function reverseGeocodeWithNominatim(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  if (reverseCache.has(key)) {
    return reverseCache.get(key)!;
  }

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('zoom', '16');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'fr');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as NominatimPlace;
    const parsed = parseAddressFields(data.address);

    const result: GeocodeResult = {
      address: data.display_name,
      lat,
      lng,
      neighborhood: parsed.neighborhood || parsed.city,
      city: parsed.city,
      region: parsed.region,
      department: parsed.department,
      country: parsed.country,
    };

    reverseCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}

function downsampleRing(ring: number[][], maxPts = 80): Array<{ lat: number; lng: number }> {
  const step = Math.max(1, Math.ceil(ring.length / maxPts));
  const pts: Array<{ lat: number; lng: number }> = [];
  for (let i = 0; i < ring.length; i += step) {
    const coord = ring[i];
    if (coord && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      pts.push({ lat: Number(coord[1].toFixed(6)), lng: Number(coord[0].toFixed(6)) });
    }
  }
  return pts;
}

/**
 * Récupère les limites géographiques réelles (polygone OSM ou boundingbox réel) d'une ville ou d'un quartier.
 */
export async function fetchRealPlaceBoundary(query: string): Promise<{
  boundary: GeoJsonBoundary;
  center: { lat: number; lng: number };
  geocode: GeocodeResult;
} | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', trimmed);
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('polygon_geojson', '1');
    url.searchParams.set('accept-language', 'fr');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as NominatimPlace[];
    const place = data[0];
    if (!place) return null;

    const center = { lat: parseFloat(place.lat), lng: parseFloat(place.lon) };
    const parsed = parseAddressFields(place.address);
    const geocode: GeocodeResult = {
      address: place.display_name,
      lat: center.lat,
      lng: center.lng,
      neighborhood: parsed.neighborhood,
      city: parsed.city,
      region: parsed.region,
      department: parsed.department,
      country: parsed.country,
    };

    let boundary: GeoJsonBoundary | null = null;
    if (place.geojson?.type === 'Polygon' && Array.isArray(place.geojson.coordinates?.[0])) {
      const pts = downsampleRing(place.geojson.coordinates[0]);
      if (pts.length >= 3) boundary = toGeoJsonPolygon(pts);
    } else if (
      place.geojson?.type === 'MultiPolygon' &&
      Array.isArray(place.geojson.coordinates)
    ) {
      let largestRing: number[][] = [];
      for (const poly of place.geojson.coordinates) {
        if (Array.isArray(poly?.[0]) && poly[0].length > largestRing.length) {
          largestRing = poly[0];
        }
      }
      const pts = downsampleRing(largestRing);
      if (pts.length >= 3) boundary = toGeoJsonPolygon(pts);
    }

    if (!boundary && place.boundingbox && place.boundingbox.length === 4) {
      const [south, north, west, east] = place.boundingbox.map(parseFloat);
      if (
        south !== undefined &&
        north !== undefined &&
        west !== undefined &&
        east !== undefined &&
        Number.isFinite(south) &&
        Number.isFinite(north) &&
        Number.isFinite(west) &&
        Number.isFinite(east)
      ) {
        boundary = toGeoJsonPolygon([
          { lat: south, lng: west },
          { lat: south, lng: east },
          { lat: north, lng: east },
          { lat: north, lng: west },
        ]);
      }
    }

    if (!boundary) return null;
    return { boundary, center, geocode };
  } catch {
    return null;
  }
}
