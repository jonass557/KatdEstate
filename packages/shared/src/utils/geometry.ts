export interface LatLngPoint {
  lat: number;
  lng: number;
}

export type GeoJsonCoordinate = [number, number]; // [lng, lat]

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: GeoJsonCoordinate;
}

export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: GeoJsonCoordinate[][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: GeoJsonCoordinate[][][];
}

export type GeoJsonBoundary = GeoJsonPolygon | GeoJsonMultiPolygon;

const EPSILON = 1e-9;

function almostEqual(a: number, b: number, eps = EPSILON): boolean {
  return Math.abs(a - b) <= eps;
}

function sameCoord(a: GeoJsonCoordinate, b: GeoJsonCoordinate, eps = EPSILON): boolean {
  return almostEqual(a[0], b[0], eps) && almostEqual(a[1], b[1], eps);
}

/**
 * Normalise un polygone de points { lat, lng } en GeoJSON Polygon fermé.
 */
export function toGeoJsonPolygon(points: LatLngPoint[]): GeoJsonPolygon {
  const cleaned = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180,
  );
  const ring: GeoJsonCoordinate[] = cleaned.map((p) => [p.lng, p.lat]);
  if (ring.length > 0 && !sameCoord(ring[0]!, ring[ring.length - 1]!)) {
    ring.push([ring[0]![0], ring[0]![1]]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

/**
 * Extrait les sommets ouverts { lat, lng } depuis un GeoJSON Polygon ou MultiPolygon.
 */
export function fromGeoJsonBoundary(boundary?: GeoJsonBoundary | null): LatLngPoint[] {
  if (!boundary) return [];
  const ring =
    boundary.type === 'Polygon'
      ? boundary.coordinates[0]
      : boundary.coordinates[0]?.[0];
  if (!ring || ring.length === 0) return [];
  const pts = ring.map(([lng, lat]) => ({ lat, lng }));
  if (
    pts.length > 1 &&
    almostEqual(pts[0]!.lat, pts[pts.length - 1]!.lat) &&
    almostEqual(pts[0]!.lng, pts[pts.length - 1]!.lng)
  ) {
    pts.pop();
  }
  return pts;
}

function extractOuterRings(boundary: GeoJsonBoundary): GeoJsonCoordinate[][] {
  if (boundary.type === 'Polygon') {
    return boundary.coordinates[0] ? [boundary.coordinates[0]] : [];
  }
  return boundary.coordinates.map((poly) => poly[0]).filter((r): r is GeoJsonCoordinate[] => Boolean(r));
}

function stripClosingVertex(ring: GeoJsonCoordinate[]): GeoJsonCoordinate[] {
  if (ring.length > 1 && sameCoord(ring[0]!, ring[ring.length - 1]!)) {
    return ring.slice(0, -1);
  }
  return ring;
}

function cross(o: GeoJsonCoordinate, a: GeoJsonCoordinate, b: GeoJsonCoordinate): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function isPointOnSegment(
  p: GeoJsonCoordinate,
  a: GeoJsonCoordinate,
  b: GeoJsonCoordinate,
  eps = 1e-8,
): boolean {
  const minX = Math.min(a[0], b[0]) - eps;
  const maxX = Math.max(a[0], b[0]) + eps;
  const minY = Math.min(a[1], b[1]) - eps;
  const maxY = Math.max(a[1], b[1]) + eps;
  if (p[0] < minX || p[0] > maxX || p[1] < minY || p[1] > maxY) return false;
  const lenSq = (b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2;
  if (lenSq <= eps * eps) return sameCoord(p, a, eps);
  const dist = Math.abs(cross(a, b, p)) / Math.sqrt(lenSq);
  return dist <= eps;
}

function segmentsProperlyIntersect(
  a: GeoJsonCoordinate,
  b: GeoJsonCoordinate,
  c: GeoJsonCoordinate,
  d: GeoJsonCoordinate,
): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  if (((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
      ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))) {
    return true;
  }
  return false;
}

function ringSelfIntersects(openRing: GeoJsonCoordinate[]): boolean {
  const n = openRing.length;
  if (n < 4) return false;
  for (let i = 0; i < n; i++) {
    const a = openRing[i]!;
    const b = openRing[(i + 1) % n]!;
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // arêtes adjacentes
      const c = openRing[j]!;
      const d = openRing[(j + 1) % n]!;
      if (segmentsProperlyIntersect(a, b, c, d)) {
        return true;
      }
    }
  }
  return false;
}

function computeSignedAreaDeg(openRing: GeoJsonCoordinate[]): number {
  let area = 0;
  for (let i = 0; i < openRing.length; i++) {
    const [x1, y1] = openRing[i]!;
    const [x2, y2] = openRing[(i + 1) % openRing.length]!;
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

/**
 * Valide un GeoJSON Polygon / MultiPolygon (sommets, fermeture, aire non nulle, auto-intersection).
 */
export function validatePolygonGeometry(boundary: GeoJsonBoundary): {
  valid: boolean;
  error?: string;
} {
  const rings = extractOuterRings(boundary);
  if (rings.length === 0) {
    return { valid: false, error: 'Le polygone géographique est vide.' };
  }

  for (const ring of rings) {
    if (ring.length < 4) {
      return { valid: false, error: 'Un polygone doit contenir au moins 3 sommets fermés.' };
    }
    for (const [lng, lat] of ring) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return { valid: false, error: 'Coordonnées GPS invalides dans le polygone.' };
      }
    }
    if (!sameCoord(ring[0]!, ring[ring.length - 1]!)) {
      return { valid: false, error: 'Le contour GeoJSON doit être fermé (premier point = dernier point).' };
    }
    const open = stripClosingVertex(ring);
    if (open.length < 3) {
      return { valid: false, error: 'Au moins 3 sommets distincts sont requis.' };
    }
    const area = Math.abs(computeSignedAreaDeg(open));
    if (area < 1e-12) {
      return { valid: false, error: 'La surface du polygone est nulle ou dégénérée.' };
    }
    if (ringSelfIntersects(open)) {
      return { valid: false, error: 'Le polygone est invalide car ses frontières se croisent.' };
    }
  }

  return { valid: true };
}

/**
 * Indique si un point [lng, lat] est strictement à l'intérieur ou sur la frontière d'un anneau.
 */
export function classifyPointInRing(
  point: GeoJsonCoordinate,
  ring: GeoJsonCoordinate[],
): 'INSIDE' | 'BOUNDARY' | 'OUTSIDE' {
  const open = stripClosingVertex(ring);
  const n = open.length;
  if (n < 3) return 'OUTSIDE';

  for (let i = 0; i < n; i++) {
    if (isPointOnSegment(point, open[i]!, open[(i + 1) % n]!)) {
      return 'BOUNDARY';
    }
  }

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = open[i]![0];
    const yi = open[i]![1];
    const xj = open[j]![0];
    const yj = open[j]![1];

    const intersect =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside ? 'INSIDE' : 'OUTSIDE';
}

export function isPointInsideBoundary(
  point: GeoJsonCoordinate,
  boundary: GeoJsonBoundary,
  allowBoundary = true,
): boolean {
  const rings = extractOuterRings(boundary);
  for (const ring of rings) {
    const cls = classifyPointInRing(point, ring);
    if (cls === 'INSIDE' || (allowBoundary && cls === 'BOUNDARY')) {
      return true;
    }
  }
  return false;
}

/**
 * Vérifie si le polygone `inner` est entièrement contenu dans `outer` (frontières partagées acceptées).
 */
export function isPolygonInsidePolygon(inner: GeoJsonBoundary, outer: GeoJsonBoundary): boolean {
  const innerRings = extractOuterRings(inner);
  const outerRings = extractOuterRings(outer);
  if (innerRings.length === 0 || outerRings.length === 0) return false;

  for (const inRing of innerRings) {
    const openIn = stripClosingVertex(inRing);
    const fitsOneOuter = outerRings.some((outRing) => {
      const openOut = stripClosingVertex(outRing);

      // 1. Tous les sommets + milieux des arêtes de inner doivent être dans ou sur outer
      for (let i = 0; i < openIn.length; i++) {
        const p1 = openIn[i]!;
        const p2 = openIn[(i + 1) % openIn.length]!;
        const mid: GeoJsonCoordinate = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];

        if (classifyPointInRing(p1, outRing) === 'OUTSIDE') return false;
        if (classifyPointInRing(mid, outRing) === 'OUTSIDE') return false;

        // 2. Aucune arête de inner ne doit croiser strictement une arête de outer
        for (let j = 0; j < openOut.length; j++) {
          const q1 = openOut[j]!;
          const q2 = openOut[(j + 1) % openOut.length]!;
          if (segmentsProperlyIntersect(p1, p2, q1, q2)) {
            return false;
          }
        }
      }
      return true;
    });

    if (!fitsOneOuter) return false;
  }

  return true;
}

/**
 * Vérifie si deux polygones se chevauchent à l'intérieur.
 * Règle métier : deux zones peuvent partager une frontière commune (touching) sans être considérées comme superposées.
 */
export function doPolygonsOverlap(polyA: GeoJsonBoundary, polyB: GeoJsonBoundary): boolean {
  const ringsA = extractOuterRings(polyA);
  const ringsB = extractOuterRings(polyB);

  for (const ringA of ringsA) {
    const openA = stripClosingVertex(ringA);
    for (const ringB of ringsB) {
      const openB = stripClosingVertex(ringB);

      // 1. Croisement strict d'arêtes => chevauchement réel
      for (let i = 0; i < openA.length; i++) {
        const a1 = openA[i]!;
        const a2 = openA[(i + 1) % openA.length]!;
        for (let j = 0; j < openB.length; j++) {
          const b1 = openB[j]!;
          const b2 = openB[(j + 1) % openB.length]!;
          if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
            return true;
          }
        }
      }

      // 2. Un sommet ou milieu d'arête de A strictement À L'INTÉRIEUR de B
      for (let i = 0; i < openA.length; i++) {
        const a1 = openA[i]!;
        const a2 = openA[(i + 1) % openA.length]!;
        const midA: GeoJsonCoordinate = [(a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2];
        if (classifyPointInRing(a1, ringB) === 'INSIDE') return true;
        if (classifyPointInRing(midA, ringB) === 'INSIDE') return true;
      }

      // 3. Un sommet ou milieu d'arête de B strictement À L'INTÉRIEUR de A
      for (let j = 0; j < openB.length; j++) {
        const b1 = openB[j]!;
        const b2 = openB[(j + 1) % openB.length]!;
        const midB: GeoJsonCoordinate = [(b1[0] + b2[0]) / 2, (b1[1] + b2[1]) / 2];
        if (classifyPointInRing(b1, ringA) === 'INSIDE') return true;
        if (classifyPointInRing(midB, ringA) === 'INSIDE') return true;
      }

      // 4. Centroïde de A à l'intérieur de B (couvre polygones identiques partageant 100% des sommets)
      const centroidA = computePolygonCentroid({ type: 'Polygon', coordinates: [ringA] });
      if (centroidA && classifyPointInRing([centroidA.lng, centroidA.lat], ringB) === 'INSIDE') {
        return true;
      }
      const centroidB = computePolygonCentroid({ type: 'Polygon', coordinates: [ringB] });
      if (centroidB && classifyPointInRing([centroidB.lng, centroidB.lat], ringA) === 'INSIDE') {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calcule le centroïde approximatif { lat, lng } d'un polygone.
 */
export function computePolygonCentroid(boundary?: GeoJsonBoundary | null): LatLngPoint | null {
  const pts = fromGeoJsonBoundary(boundary);
  if (pts.length === 0) return null;
  const sum = pts.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
  return {
    lat: sum.lat / pts.length,
    lng: sum.lng / pts.length,
  };
}

/**
 * Estime la superficie en m² via projection équirectangulaire locale.
 */
export function computePolygonAreaM2(boundary?: GeoJsonBoundary | null): number {
  const pts = fromGeoJsonBoundary(boundary);
  if (pts.length < 3) return 0;
  const R = 6371000;
  const refLat = (pts[0]!.lat * Math.PI) / 180;
  const cosRef = Math.cos(refLat);
  const projected = pts.map((p) => ({
    x: ((p.lng * Math.PI) / 180) * R * cosRef,
    y: ((p.lat * Math.PI) / 180) * R,
  }));
  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const p1 = projected[i]!;
    const p2 = projected[(i + 1) % projected.length]!;
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2);
}
