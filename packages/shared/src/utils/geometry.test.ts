import { describe, expect, it } from 'vitest';
import {
  computeBearing,
  computeDistanceMeters,
  computePolygonAreaM2,
  computePolygonCentroid,
  doPolygonsOverlap,
  isOffRoute,
  isPointInsideBoundary,
  isPolygonInsidePolygon,
  toGeoJsonPolygon,
  validatePolygonGeometry,
} from './geometry.js';

describe('géométrie GeoJSON', () => {
  const quartier = toGeoJsonPolygon([
    { lat: 5.360, lng: -3.990 },
    { lat: 5.360, lng: -3.970 },
    { lat: 5.375, lng: -3.970 },
    { lat: 5.375, lng: -3.990 },
  ]);

  const blocNordOuest = toGeoJsonPolygon([
    { lat: 5.368, lng: -3.988 },
    { lat: 5.368, lng: -3.980 },
    { lat: 5.374, lng: -3.980 },
    { lat: 5.374, lng: -3.988 },
  ]);

  // Partage exactement la frontière Est (-3.980) avec blocNordOuest
  const blocNordEstAdjacent = toGeoJsonPolygon([
    { lat: 5.368, lng: -3.980 },
    { lat: 5.368, lng: -3.972 },
    { lat: 5.374, lng: -3.972 },
    { lat: 5.374, lng: -3.980 },
  ]);

  const blocChevauchant = toGeoJsonPolygon([
    { lat: 5.369, lng: -3.984 },
    { lat: 5.369, lng: -3.975 },
    { lat: 5.373, lng: -3.975 },
    { lat: 5.373, lng: -3.984 },
  ]);

  const blocHorsQuartier = toGeoJsonPolygon([
    { lat: 5.370, lng: -3.975 },
    { lat: 5.370, lng: -3.960 }, // dépasse -3.970
    { lat: 5.374, lng: -3.960 },
    { lat: 5.374, lng: -3.975 },
  ]);

  it('valide un polygone correct et rejette un polygone croisé ou trop petit', () => {
    expect(validatePolygonGeometry(quartier).valid).toBe(true);

    const bowTie = toGeoJsonPolygon([
      { lat: 5.36, lng: -3.99 },
      { lat: 5.37, lng: -3.98 },
      { lat: 5.37, lng: -3.99 },
      { lat: 5.36, lng: -3.98 },
    ]);
    expect(validatePolygonGeometry(bowTie).valid).toBe(false);

    const twoPoints = toGeoJsonPolygon([
      { lat: 5.36, lng: -3.99 },
      { lat: 5.37, lng: -3.98 },
    ]);
    expect(validatePolygonGeometry(twoPoints).valid).toBe(false);
  });

  it('vérifie la présence d’un point dans ou sur la frontière du polygone', () => {
    expect(isPointInsideBoundary([-3.984, 5.371], blocNordOuest)).toBe(true);
    expect(isPointInsideBoundary([-3.980, 5.371], blocNordOuest)).toBe(true); // sur frontière
    expect(isPointInsideBoundary([-3.975, 5.371], blocNordOuest)).toBe(false);
  });

  it('vérifie l’inclusion stricte d’une zone enfant dans une zone parente', () => {
    expect(isPolygonInsidePolygon(blocNordOuest, quartier)).toBe(true);
    expect(isPolygonInsidePolygon(blocNordEstAdjacent, quartier)).toBe(true);
    expect(isPolygonInsidePolygon(blocHorsQuartier, quartier)).toBe(false);
  });

  it('accepte deux zones qui partagent une frontière mais détecte tout chevauchement interne', () => {
    expect(doPolygonsOverlap(blocNordOuest, blocNordEstAdjacent)).toBe(false);
    expect(doPolygonsOverlap(blocNordOuest, blocChevauchant)).toBe(true);
    expect(doPolygonsOverlap(blocNordOuest, blocNordOuest)).toBe(true);
  });

  it('calcule centroïde et superficie approximative', () => {
    const centroid = computePolygonCentroid(quartier);
    expect(centroid?.lat).toBeCloseTo(5.3675, 4);
    expect(centroid?.lng).toBeCloseTo(-3.98, 4);
    expect(computePolygonAreaM2(quartier)).toBeGreaterThan(1_000_000);
  });

  it('calcule la distance GPS, le cap (bearing) et détecte la sortie d’itinéraire (off-route)', () => {
    // Distance entre Douala (Logpom) et Douala (Bonamoussadi)
    const logpom = { lat: 4.075, lng: 9.755 };
    const bonamoussadi = { lat: 4.085, lng: 9.735 };

    const distance = computeDistanceMeters(logpom, bonamoussadi);
    expect(distance).toBeGreaterThan(2000);
    expect(distance).toBeLessThan(3500);

    const bearing = computeBearing(logpom, bonamoussadi);
    expect(bearing).toBeGreaterThan(270); // vers le Nord-Ouest (~296°)
    expect(bearing).toBeLessThan(360);

    // Itinéraire droit entre Logpom et Bonamoussadi
    const route = [logpom, { lat: 4.080, lng: 9.745 }, bonamoussadi];

    // Un point à 5 mètres de l'itinéraire
    const onRoutePt = { lat: 4.08003, lng: 9.74502 };
    expect(isOffRoute(onRoutePt, route, 45)).toBe(false);

    // Un point à 200 mètres de l'itinéraire
    const farPt = { lat: 4.090, lng: 9.760 };
    expect(isOffRoute(farPt, route, 45)).toBe(true);
  });
});
