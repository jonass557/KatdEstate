import '../config/dotenv.js';
import { randomBytes } from 'node:crypto';
import { toGeoJsonPolygon, validatePolygonGeometry } from '@rentflow/shared';
import { createConfig, loadEnv } from '../config/index.js';
import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { Property } from '../models/property.js';
import { GeoAuditLog, GeoBlock, GeoNeighborhood, GeoOwner } from '../models/quartier.js';

export async function runGeo2dsphereMigration(): Promise<{
  blocksMigrated: number;
  propertiesBackfilled: number;
  indexesSynced: string[];
}> {
  let blocksMigrated = 0;
  let propertiesBackfilled = 0;

  // 1. Migrer GeoBlock.boundaryCoordinates -> GeoJSON boundary Polygon
  const legacyBlocks = await GeoBlock.find({
    $or: [{ boundary: { $exists: false } }, { 'boundary.coordinates': { $exists: false } }],
    'boundaryCoordinates.2': { $exists: true },
  });

  for (const block of legacyBlocks) {
    const pts = (block.boundaryCoordinates ?? [])
      .filter((c) => typeof c.lat === 'number' && typeof c.lng === 'number')
      .map((c) => ({ lat: c.lat!, lng: c.lng! }));
    if (pts.length >= 3) {
      const poly = toGeoJsonPolygon(pts);
      if (validatePolygonGeometry(poly).valid) {
        block.boundary = poly as never;
        await block.save();
        blocksMigrated += 1;
      }
    }
  }

  // 2. Générer geoUniqueId sur les propriétés géolocalisées existantes sans identifiant
  const properties = await Property.find({
    deletedAt: null,
    geoUniqueId: { $exists: false },
    $or: [
      { 'location.coordinates': { $exists: true } },
      { latitude: { $exists: true }, longitude: { $exists: true } },
    ],
  });

  for (const prop of properties) {
    prop.geoUniqueId = `DOM-GEO-${Date.now().toString(36).toUpperCase()}-${randomBytes(2)
      .toString('hex')
      .toUpperCase()}`;
    if (!prop.location?.coordinates?.length && prop.latitude !== undefined && prop.longitude !== undefined) {
      prop.location = { type: 'Point', coordinates: [prop.longitude, prop.latitude] } as never;
    }
    await prop.save();
    propertiesBackfilled += 1;
  }

  // 3. Synchroniser les index 2dsphere
  await Promise.all([
    GeoNeighborhood.syncIndexes(),
    GeoBlock.syncIndexes(),
    GeoOwner.syncIndexes(),
    Property.syncIndexes(),
    GeoAuditLog.syncIndexes(),
  ]);

  return {
    blocksMigrated,
    propertiesBackfilled,
    indexesSynced: ['GeoNeighborhood', 'GeoBlock', 'GeoOwner', 'Property', 'GeoAuditLog'],
  };
}

// Exécution CLI directe si appelé via `tsx src/scripts/migrate-geo-2dsphere.ts`
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].replace(/\\/g, '/').endsWith('migrate-geo-2dsphere.ts');

if (isDirectRun) {
  const config = createConfig(loadEnv());
  connectDatabase(config.database)
    .then(() => runGeo2dsphereMigration())
    .then((summary) => {
      console.log('[DOMORA GEO MIGRATION]', JSON.stringify(summary, null, 2));
      return disconnectDatabase();
    })
    .catch(async (err) => {
      console.error('[DOMORA GEO MIGRATION ERROR]', err);
      await disconnectDatabase().catch(() => {});
      process.exit(1);
    });
}
