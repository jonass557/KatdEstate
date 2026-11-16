import type { LatLngPoint } from '@rentflow/shared';

export type TransportMode = 'driving' | 'walking' | 'cycling';

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  location: LatLngPoint;
  maneuverType: string;
  modifier?: string;
  name: string;
}

export interface RouteResult {
  coordinates: LatLngPoint[];
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
  mode: TransportMode;
  engineName: string;
}

/**
 * Traduit et formate les manœuvres OSRM en instructions vocales naturelles en français.
 */
function formatInstruction(
  type: string,
  modifier: string | undefined,
  name: string,
): string {
  const street = name && name.trim() ? ` sur ${name}` : '';

  switch (type) {
    case 'depart':
      return `Démarrez votre trajet${street}`;
    case 'arrive':
      return `Vous êtes arrivé à votre propriété DOMORA`;
    case 'turn':
      if (modifier === 'left') return `Tournez à gauche${street}`;
      if (modifier === 'right') return `Tournez à droite${street}`;
      if (modifier === 'sharp left') return `Tournez franchement à gauche${street}`;
      if (modifier === 'sharp right') return `Tournez franchement à droite${street}`;
      if (modifier === 'slight left') return `Serrez légèrement à gauche${street}`;
      if (modifier === 'slight right') return `Serrez légèrement à droite${street}`;
      if (modifier === 'uturn') return `Faites demi-tour${street}`;
      return `Tournez${street}`;
    case 'new name':
      return `Continuez${street}`;
    case 'continue':
      return `Continuez tout droit${street}`;
    case 'roundabout':
    case 'rotary':
      return `Au rond-point, prenez la sortie${street}`;
    case 'fork':
      if (modifier === 'left') return `À la bifurcation, serrez à gauche`;
      if (modifier === 'right') return `À la bifurcation, serrez à droite`;
      return `À la bifurcation, continuez${street}`;
    case 'end of road':
      if (modifier === 'left') return `Au bout de la route, tournez à gauche`;
      if (modifier === 'right') return `Au bout de la route, tournez à droite`;
      return `Au bout de la route, tournez${street}`;
    case 'merge':
      return `Rejoignez la voie${street}`;
    case 'on ramp':
      return `Prenez la bretelle d’accès${street}`;
    case 'off ramp':
      return `Prenez la sortie${street}`;
    default:
      return modifier
        ? `Prenez vers la direction ${modifier}${street}`
        : `Continuez${street}`;
  }
}

/**
 * Moteur de calcul d'itinéraire GPS Open Source.
 * Utilise OSRM (Open Source Routing Machine) pour les calculs de routes réelles.
 * Évolutif : permet de basculer vers un serveur OSRM ou Valhalla auto-hébergé sans changer l'UI.
 */
export async function calculateRoute(
  start: LatLngPoint,
  destination: LatLngPoint,
  mode: TransportMode = 'driving',
  customServerUrl?: string,
): Promise<RouteResult> {
  // Mapping du profil OSRM
  const osrmProfile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';
  const baseUrl =
    customServerUrl?.replace(/\/$/, '') ||
    'https://router.project-osrm.org';

  const url = `${baseUrl}/route/v1/${osrmProfile}/${start.lng},${start.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Erreur lors du calcul d’itinéraire (${res.status})`);
  }

  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(
      data.message || 'Aucun itinéraire routier trouvé entre ces deux positions.',
    );
  }

  const route = data.routes[0];
  const geojsonCoords: [number, number][] = route.geometry.coordinates;
  const coordinates: LatLngPoint[] = geojsonCoords.map(([lng, lat]) => ({ lat, lng }));

  const rawSteps: any[] = route.legs?.[0]?.steps || [];
  const steps: RouteStep[] = rawSteps.map((s) => {
    const maneuver = s.maneuver || {};
    const loc: LatLngPoint = {
      lat: maneuver.location ? maneuver.location[1] : 0,
      lng: maneuver.location ? maneuver.location[0] : 0,
    };
    const instruction = formatInstruction(maneuver.type, maneuver.modifier, s.name);

    return {
      instruction,
      distanceMeters: s.distance,
      durationSeconds: s.duration,
      location: loc,
      maneuverType: maneuver.type || 'turn',
      modifier: maneuver.modifier,
      name: s.name || '',
    };
  });

  return {
    coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    steps,
    mode,
    engineName: baseUrl.includes('project-osrm.org') ? 'OSRM Public' : 'OSRM Self-Hosted',
  };
}
