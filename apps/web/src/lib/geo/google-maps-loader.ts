import { apiRequest } from '../api-client';
import type { GeocodeResult } from './map-provider';

export type GoogleMapsLoadStatus =
  | 'IDLE'
  | 'LOADING'
  | 'READY'
  | 'MISSING_API_KEY'
  | 'AUTH_FAILURE'
  | 'NETWORK_ERROR';

export interface GoogleMapsLoadState {
  status: GoogleMapsLoadStatus;
  errorMessage?: string | undefined;
}

const RUNTIME_KEY_STORAGE = 'domora_google_maps_browser_key';

export function getGoogleMapsApiKey(): string {
  const envKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim();
  if (envKey) return envKey;
  if (typeof window !== 'undefined') {
    try {
      const localKey = localStorage.getItem(RUNTIME_KEY_STORAGE)?.trim();
      if (localKey) return localKey;
    } catch {
      // ignore storage errors
    }
  }
  return '';
}

export function saveGoogleMapsBrowserKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (key.trim()) {
      localStorage.setItem(RUNTIME_KEY_STORAGE, key.trim());
    } else {
      localStorage.removeItem(RUNTIME_KEY_STORAGE);
    }
  } catch {
    // ignore storage errors
  }
}

let loadPromise: Promise<GoogleMapsLoadState> | null = null;
let cachedKeyUsed = '';
let remoteConfigPromise: Promise<string> | null = null;
let cachedRemoteKey = '';

export function resetGoogleMapsLoader(): void {
  loadPromise = null;
  cachedKeyUsed = '';
  remoteConfigPromise = null;
  cachedRemoteKey = '';
}

export async function ensureGoogleMapsApiKey(): Promise<string> {
  if (cachedRemoteKey) return cachedRemoteKey;
  if (!remoteConfigPromise && typeof window !== 'undefined') {
    remoteConfigPromise = apiRequest<{ googleMapsBrowserApiKey?: string }>('/quartier/geo/config')
      .then((res) => {
        const key = res?.googleMapsBrowserApiKey?.trim() ?? '';
        cachedRemoteKey = key;
        if (key) saveGoogleMapsBrowserKey(key);
        return key;
      })
      .catch(() => '');
  }
  const remoteKey = remoteConfigPromise ? await remoteConfigPromise : '';
  return remoteKey || getGoogleMapsApiKey();
}

declare global {
  interface Window {
    google?: any;
    gm_authFailure?: () => void;
  }
}

export async function loadGoogleMapsSdk(): Promise<GoogleMapsLoadState> {
  if (typeof window === 'undefined') {
    return { status: 'NETWORK_ERROR', errorMessage: 'Environnement navigateur requis.' };
  }

  const apiKey = await ensureGoogleMapsApiKey();
  if (!apiKey) {
    return {
      status: 'MISSING_API_KEY',
      errorMessage:
        'Clé API Google Maps absente. Configurez-la depuis le Dashboard Administrateur (onglet API Google Maps) ou via VITE_GOOGLE_MAPS_API_KEY.',
    };
  }

  if (window.google?.maps?.Map && cachedKeyUsed === apiKey) {
    return { status: 'READY' };
  }

  if (loadPromise && cachedKeyUsed === apiKey) {
    return loadPromise;
  }

  cachedKeyUsed = apiKey;
  loadPromise = new Promise<GoogleMapsLoadState>((resolve) => {
    let settled = false;
    const finish = (state: GoogleMapsLoadState) => {
      if (settled) return;
      settled = true;
      resolve(state);
    };

    window.gm_authFailure = () => {
      finish({
        status: 'AUTH_FAILURE',
        errorMessage:
          'Authentification Google Maps refusée : vérifiez la validité de VITE_GOOGLE_MAPS_API_KEY, la facturation Google Cloud et les restrictions de domaine.',
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>('script[data-domora-gmaps="true"]');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.dataset.domoraGmaps = 'true';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places,geometry&language=fr`;

    const timer = window.setTimeout(() => {
      finish({
        status: 'NETWORK_ERROR',
        errorMessage:
          'Délai dépassé lors de la connexion à Google Maps Platform. Vérifiez votre connexion Internet.',
      });
    }, 15_000);

    script.onload = () => {
      window.clearTimeout(timer);
      if (window.google?.maps?.Map) {
        finish({ status: 'READY' });
      } else {
        finish({
          status: 'NETWORK_ERROR',
          errorMessage: 'Le SDK Google Maps ne s’est pas initialisé correctement.',
        });
      }
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      finish({
        status: 'NETWORK_ERROR',
        errorMessage:
          'Impossible de charger Google Maps Platform (erreur réseau ou bloqueur de script).',
      });
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

function parseAddressComponents(components: any[]): Partial<GeocodeResult> {
  const out: Partial<GeocodeResult> = {};
  for (const c of components ?? []) {
    const types: string[] = c.types ?? [];
    if (types.includes('administrative_area_level_1')) out.region = c.long_name;
    if (types.includes('administrative_area_level_2')) out.department = c.long_name;
    if (types.includes('sublocality_level_1') || types.includes('administrative_area_level_3')) {
      out.arrondissement = c.long_name;
    }
    if (types.includes('neighborhood') || types.includes('sublocality_level_2')) {
      out.neighborhood = c.long_name;
    }
    if (types.includes('locality')) out.city = c.long_name;
  }
  return out;
}

export async function geocodeAddressWithGoogle(query: string): Promise<GeocodeResult> {
  if (!window.google?.maps?.Geocoder) {
    throw new Error('Google Geocoding API indisponible.');
  }
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve, reject) => {
    geocoder.geocode({ address: query }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]) {
        const top = results[0];
        const loc = top.geometry.location;
        resolve({
          address: top.formatted_address,
          lat: loc.lat(),
          lng: loc.lng(),
          ...parseAddressComponents(top.address_components),
        });
      } else {
        reject(new Error(`Adresse introuvable via Google Geocoding (${status}).`));
      }
    });
  });
}

export async function reverseGeocodeWithGoogle(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (!window.google?.maps?.Geocoder) return null;
  const geocoder = new window.google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
      if (status === 'OK' && results?.[0]) {
        const top = results[0];
        resolve({
          address: top.formatted_address,
          lat,
          lng,
          ...parseAddressComponents(top.address_components),
        });
      } else {
        resolve(null);
      }
    });
  });
}

export async function getBrowserGpsPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('La géolocalisation GPS n’est pas supportée sur cet appareil.');
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(
              new Error(
                'Autorisation GPS refusée. Veuillez autoriser la localisation dans votre navigateur.',
              ),
            );
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Signal GPS indisponible pour le moment.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Délai dépassé lors de la récupération de votre position GPS.'));
            break;
          default:
            reject(new Error('Impossible de déterminer votre position GPS.'));
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 0 },
    );
  });
}
