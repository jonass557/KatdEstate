import type { GeocodeResult } from './map-provider';

interface NominatimPlace {
  place_id: number;
  licence: string;
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    quarter?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    region?: string;
    country?: string;
    postcode?: string;
  };
}

const cache = new Map<string, GeocodeResult[]>();
const reverseCache = new Map<string, GeocodeResult>();

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
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DOMORA-KatdEstate-Geo/1.0 (contact@domora.immo)',
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = (await res.json()) as NominatimPlace[];
    const results: GeocodeResult[] = data.map((place) => {
      const addr = place.address || {};
      const neighborhood =
        addr.quarter || addr.neighbourhood || addr.suburb || undefined;
      const city =
        addr.city || addr.town || addr.village || addr.municipality || undefined;
      const region = addr.state || addr.region || addr.county || undefined;
      const country = addr.country || undefined;

      return {
        address: place.display_name,
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        neighborhood,
        city,
        region,
        department: addr.county,
        country,
      };
    });

    cache.set(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

/**
 * Géocodage inverse : retrouve l'adresse, quartier, ville et pays à partir de coordonnées GPS.
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
    url.searchParams.set('addressdetails', '1');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'DOMORA-KatdEstate-Geo/1.0 (contact@domora.immo)',
      },
    });

    if (!res.ok) return null;

    const data = (await res.json()) as NominatimPlace;
    const addr = data.address || {};

    const neighborhood =
      addr.quarter || addr.neighbourhood || addr.suburb || undefined;
    const city =
      addr.city || addr.town || addr.village || addr.municipality || undefined;
    const region = addr.state || addr.region || addr.county || undefined;

    const result: GeocodeResult = {
      address: data.display_name,
      lat,
      lng,
      neighborhood,
      city,
      region,
      department: addr.county,
      country: addr.country,
    };

    reverseCache.set(key, result);
    return result;
  } catch {
    return null;
  }
}
