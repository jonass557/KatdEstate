export interface ResolvedLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  source: 'GPS_HIGH_ACCURACY' | 'NETWORK_LOW_ACCURACY' | 'IP_FALLBACK';
  isApproximate?: boolean;
}

export interface GeolocationOptions {
  /**
   * Si true, refuse le repli IP (qui renvoie souvent le nœud FAI comme Douala au lieu de la ville réelle ex: Mbanga)
   * et lève une erreur explicite si le GPS/navigateur ne peut pas fournir la position réelle.
   */
  requireRealGps?: boolean;
}

/**
 * Récupère le meilleur fix GPS haute précision en utilisant `watchPosition` sur une fenêtre de quelques secondes
 * afin de laisser le temps à la puce GPS du téléphone/appareil de converger vers une précision optimale (< 80 m).
 */
function acquireHighAccuracyFix(maxWaitMs = 12000): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    let bestPos: GeolocationPosition | null = null;
    let settled = false;

    const finish = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      resolve(pos);
    };

    const fail = (err: GeolocationPositionError | Error) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (bestPos) {
        resolve(bestPos);
      } else {
        reject(err);
      }
    };

    const timer = setTimeout(() => {
      if (bestPos) {
        finish(bestPos);
      } else {
        fail(new Error('Délai GPS dépassé (12s). Assurez-vous d’avoir activé la localisation sur votre appareil.'));
      }
    }, maxWaitMs);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // Si la précision est bonne (<= 150 mètres), on valide immédiatement
        if (pos.coords.accuracy <= 150) {
          finish(pos);
        }
      },
      (err) => {
        // Si l'utilisateur refuse la permission, échouer immédiatement
        if (err.code === err.PERMISSION_DENIED) {
          settled = true;
          navigator.geolocation.clearWatch(watchId);
          clearTimeout(timer);
          reject(
            new Error(
              'Autorisation de localisation refusée. Activez le GPS et autorisez l’accès à votre position dans le navigateur.',
            ),
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 15000,
      },
    );
  });
}

/**
 * Récupération GPS réelle :
 * 1. GPS Haute Précision (watchPosition satellite / mobile jusqu'à 12s pour fix exact)
 * 2. Précision Réseau / WiFi (si puce GPS absente, sans cache périmé)
 * 3. Repli IP uniquement si `requireRealGps` n'est pas activé
 */
export async function getPreciseUserLocation(
  options?: GeolocationOptions,
): Promise<ResolvedLocation> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    if (options?.requireRealGps) {
      throw new Error('Votre navigateur ne supporte pas la géolocalisation GPS.');
    }
    return getIpLocationFallback();
  }

  // Étape 1 : Essai GPS Haute Précision réel (satellite / mobile)
  try {
    const pos = await acquireHighAccuracyFix(12000);
    return {
      lat: Number(pos.coords.latitude.toFixed(6)),
      lng: Number(pos.coords.longitude.toFixed(6)),
      accuracy: Math.round(pos.coords.accuracy || 15),
      source: 'GPS_HIGH_ACCURACY',
      isApproximate: false,
    };
  } catch (err: any) {
    // Si l'utilisateur a explicitement refusé la permission, ne pas masquer avec une fausse position IP
    if (
      err?.message?.includes('refusée') ||
      err?.code === 1
    ) {
      throw err instanceof Error
        ? err
        : new Error('Permission GPS refusée. Veuillez autoriser la géolocalisation.');
    }

    // Étape 2 : Essai Réseau / WiFi du navigateur (accepte un fix récent jusqu'à 60s)
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 12000,
          maximumAge: 60000,
        });
      });
      return {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        accuracy: Math.round(pos.coords.accuracy || 100),
        source: 'NETWORK_LOW_ACCURACY',
        isApproximate: (pos.coords.accuracy || 100) > 1500,
      };
    } catch {
      if (options?.requireRealGps) {
        throw new Error(
          'Impossible d’obtenir un signal GPS réel sur cet appareil. Vérifiez que la localisation (GPS) de votre téléphone est activée ou utilisez les champs Pays → Ville → Quartier.',
        );
      }
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
          accuracy: 15000,
          source: 'IP_FALLBACK',
          isApproximate: true,
        };
      }
    }
  } catch {
    // Si offline ou bloqué
  }

  return {
    lat: 5.3364,
    lng: -4.0267,
    accuracy: 20000,
    source: 'IP_FALLBACK',
    isApproximate: true,
  };
}
