export interface ResolvedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'GPS_HIGH_ACCURACY' | 'NETWORK_LOW_ACCURACY' | 'IP_FALLBACK';
}

/**
 * Récupération GPS ultra-robuste avec triple niveau de fallback :
 * 1. GPS Haute Précision (satellite / mobile)
 * 2. Précision Réseau / WiFi (fonctionne immédiatement sur PC portables et ordinateurs de bureau sans puce GPS)
 * 3. Géolocalisation IP mondiale (si le navigateur bloque le GPS)
 */
export async function getPreciseUserLocation(): Promise<ResolvedLocation> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return getIpLocationFallback();
  }

  // Étape 1 : Essai Haute Précision (délai 6s)
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 6000,
        maximumAge: 0,
      });
    });
    return {
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
      accuracy: Math.round(pos.coords.accuracy || 10),
      source: 'GPS_HIGH_ACCURACY',
    };
  } catch {
    // Étape 2 : Fallback Basse Précision (WiFi / Réseau IP Windows - délai 8s)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 8000,
          maximumAge: 60000,
        });
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy || 50),
        source: 'NETWORK_LOW_ACCURACY',
      };
    } catch {
      // Étape 3 : Fallback Géolocalisation IP
      return getIpLocationFallback();
    }
  }
}

async function getIpLocationFallback(): Promise<ResolvedLocation> {
  try {
    const res = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        return {
          lat: Number(data.latitude.toFixed(6)),
          lng: Number(data.longitude.toFixed(6)),
          accuracy: 5000,
          source: 'IP_FALLBACK',
        };
      }
    }
  } catch {
    // Si offline ou bloqué
  }

  // Coordonnées par défaut (Abidjan Plateau / centre opérationnel Afrique de l'Ouest)
  return {
    lat: 5.3364,
    lng: -4.0267,
    accuracy: 10000,
    source: 'IP_FALLBACK',
  };
}
