import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { toGeoJsonPolygon } from '@rentflow/shared';
import { authed, api, createActor } from '../../test/fixtures.js';
import { GeoCity, GeoDistrict, GeoNeighborhood, SectorAssignment } from '../../models/quartier.js';
import { runGeo2dsphereMigration } from '../../scripts/migrate-geo-2dsphere.js';

let mongodServer: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongodServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 30000 },
  });
  await mongoose.connect(mongodServer.getUri());
}, 60000);

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const collection of Object.values(collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongodServer?.stop({ force: true });
}, 60000);

const quartierBoundary = toGeoJsonPolygon([
  { lat: 5.360, lng: -3.990 },
  { lat: 5.360, lng: -3.970 },
  { lat: 5.375, lng: -3.970 },
  { lat: 5.375, lng: -3.990 },
]);

const blocABoundary = toGeoJsonPolygon([
  { lat: 5.362, lng: -3.988 },
  { lat: 5.362, lng: -3.980 },
  { lat: 5.373, lng: -3.980 },
  { lat: 5.373, lng: -3.988 },
]);

// Partage la frontière Est (-3.980) avec blocABoundary sans se chevaucher
const blocBBoundary = toGeoJsonPolygon([
  { lat: 5.362, lng: -3.980 },
  { lat: 5.362, lng: -3.972 },
  { lat: 5.373, lng: -3.972 },
  { lat: 5.373, lng: -3.980 },
]);

const blocChevauchant = toGeoJsonPolygon([
  { lat: 5.364, lng: -3.984 },
  { lat: 5.364, lng: -3.976 },
  { lat: 5.371, lng: -3.976 },
  { lat: 5.371, lng: -3.984 },
]);

const blocHorsQuartier = toGeoJsonPolygon([
  { lat: 5.365, lng: -3.975 },
  { lat: 5.365, lng: -3.962 }, // sort de -3.970
  { lat: 5.372, lng: -3.962 },
  { lat: 5.372, lng: -3.975 },
]);

const ownerZoneInBlocA = toGeoJsonPolygon([
  { lat: 5.364, lng: -3.987 },
  { lat: 5.364, lng: -3.982 },
  { lat: 5.370, lng: -3.982 },
  { lat: 5.370, lng: -3.987 },
]);

const ownerZoneOutsideBlocA = toGeoJsonPolygon([
  { lat: 5.364, lng: -3.978 }, // est dans Bloc B, hors Bloc A
  { lat: 5.364, lng: -3.973 },
  { lat: 5.370, lng: -3.973 },
  { lat: 5.370, lng: -3.978 },
]);

const propertyPolyInOwnerZone = toGeoJsonPolygon([
  { lat: 5.365, lng: -3.986 },
  { lat: 5.365, lng: -3.984 },
  { lat: 5.367, lng: -3.984 },
  { lat: 5.367, lng: -3.986 },
]);

describe('Système cartographique géographique à 3 niveaux', () => {
  async function setupHierarchy() {
    const admin = await createActor('ADMIN');
    const orgId = admin.organizationId;
    const chief = await createActor('NEIGHBORHOOD_LEADER', orgId);
    const blockLeaderA = await createActor('BLOCK_LEADER', orgId);
    const blockLeaderB = await createActor('BLOCK_LEADER', orgId);
    const owner = await createActor('OWNER', orgId);

    const city = await GeoCity.create({ name: `Abidjan-${Date.now()}`, region: 'Lagunes', country: 'CI' });
    const district = await GeoDistrict.create({ cityId: city._id, name: `Cocody-${Date.now()}` });
    const neighborhood = await GeoNeighborhood.create({
      cityId: city._id,
      districtId: district._id,
      name: 'Riviera Palmeraie',
      leaderId: chief.userId,
      region: 'Lagunes',
      department: 'Abidjan',
      arrondissement: 'Cocody',
    });

    await SectorAssignment.create({
      userId: chief.userId,
      role: 'NEIGHBORHOOD_LEADER',
      cityId: city._id,
      districtId: district._id,
      neighborhoodId: neighborhood._id,
      assignedBy: admin.userId,
      status: 'ACTIVE',
    });

    return {
      admin,
      chief,
      blockLeaderA,
      blockLeaderB,
      owner,
      city,
      district,
      neighborhood,
      base: `/api/v1/organizations/${orgId}`,
    };
  }

  it('applique la hiérarchie complète à 3 niveaux, les rejets géographiques et l’historique d’audit', async () => {
    const { admin, chief, blockLeaderA, blockLeaderB, owner, city, neighborhood, base } =
      await setupHierarchy();

    // 1. Chef de quartier délimite son quartier
    const nbRes = await api()
      .patch(`${base}/neighborhoods/${neighborhood._id}/boundary`)
      .set(authed(chief))
      .send({
        boundary: quartierBoundary,
        administrativeAddress: 'Carrefour Duncan, Cocody',
        region: 'Lagunes',
        department: 'Abidjan',
        arrondissement: 'Cocody',
      });
    expect(nbRes.status).toBe(200);
    expect(nbRes.body.data.boundary.type).toBe('Polygon');

    // 2. Chef de quartier crée Bloc A et Bloc B (frontière commune acceptée)
    const blocARes = await api()
      .post(`${base}/blocks`)
      .set(authed(chief))
      .send({
        neighborhoodId: String(neighborhood._id),
        name: 'Bloc Nord-Ouest',
        code: 'BLOC-NO',
        blockLeaderId: blockLeaderA.userId,
        boundary: blocABoundary,
      });
    expect(blocARes.status).toBe(201);
    const blockAId = blocARes.body.data._id as string;

    const blocBRes = await api()
      .post(`${base}/blocks`)
      .set(authed(chief))
      .send({
        neighborhoodId: String(neighborhood._id),
        name: 'Bloc Nord-Est',
        code: 'BLOC-NE',
        blockLeaderId: blockLeaderB.userId,
        boundary: blocBBoundary,
      });
    expect(blocBRes.status).toBe(201);
    const blockBId = blocBRes.body.data._id as string;

    // 3. Refuse une zone de bloc dépassant les limites du quartier
    const outOfNeighborhoodRes = await api()
      .post(`${base}/blocks`)
      .set(authed(chief))
      .send({
        neighborhoodId: String(neighborhood._id),
        name: 'Bloc Hors Quartier',
        code: 'BLOC-OUT',
        boundary: blocHorsQuartier,
      });
    expect(outOfNeighborhoodRes.status).toBe(422);

    // 4. Refuse un chevauchement entre deux blocs (et même avec overrideOverlap si non admin)
    const overlapRes = await api()
      .post(`${base}/blocks`)
      .set(authed(chief))
      .send({
        neighborhoodId: String(neighborhood._id),
        name: 'Bloc Chevauchant',
        code: 'BLOC-OVL',
        boundary: blocChevauchant,
        overrideOverlap: true,
        overrideReason: 'Tentative par chef de quartier',
      });
    expect(overlapRes.status).toBe(422);

    // 5. Chef de bloc NE PEUT PAS modifier les frontières de son propre bloc
    const blockLeaderEditRes = await api()
      .patch(`${base}/blocks/${blockAId}/boundary`)
      .set(authed(blockLeaderA))
      .send({ boundary: blocABoundary });
    expect(blockLeaderEditRes.status).toBe(403);

    // 6. Chef de bloc A attribue une zone à un propriétaire dans Bloc A (OK)
    const ownerZoneRes = await api()
      .post(`${base}/owners`)
      .set(authed(blockLeaderA))
      .send({
        fullName: 'Kouassi Yao',
        phone: '+2250701020304',
        blockId: blockAId,
        userId: owner.userId,
        assignedBoundary: ownerZoneInBlocA,
      });
    expect(ownerZoneRes.status).toBe(201);
    const geoOwnerId = ownerZoneRes.body.data._id as string;

    // 7. Refuse une zone propriétaire située hors du territoire du chef de bloc A
    const ownerOutsideRes = await api()
      .post(`${base}/owners`)
      .set(authed(blockLeaderA))
      .send({
        fullName: 'Hors Limite',
        phone: '+2250701020399',
        blockId: blockAId,
        assignedBoundary: ownerZoneOutsideBlocA,
      });
    expect(ownerOutsideRes.status).toBe(422);

    // 8. Chef de bloc A ne peut pas créer un propriétaire dans Bloc B
    const wrongBlockRes = await api()
      .post(`${base}/owners`)
      .set(authed(blockLeaderA))
      .send({
        fullName: 'Intrusion Bloc B',
        phone: '+2250701020388',
        blockId: blockBId,
        assignedBoundary: ownerZoneOutsideBlocA,
      });
    expect(wrongBlockRes.status).toBe(403);

    // 9. Cloisonnement : Chef de bloc B ne voit pas les propriétaires du Bloc A
    const listB = await api().get(`${base}/owners`).set(authed(blockLeaderB));
    expect(listB.status).toBe(200);
    expect(listB.body.data).toHaveLength(0);

    // 10. Propriétaire enregistre une propriété valide dans sa zone
    const validProp = await api()
      .post(`${base}/properties`)
      .set(authed(owner))
      .send({
        name: 'Immeuble Palm',
        type: 'BUILDING',
        address: 'Lot 12 Palmeraie',
        city: 'Abidjan',
        country: 'CI',
        geoOwnerId,
        blockId: blockAId,
        neighborhoodId: String(neighborhood._id),
        latitude: 5.366,
        longitude: -3.985,
        boundary: propertyPolyInOwnerZone,
      });
    expect(validProp.status).toBe(201);
    expect(validProp.body.data.geoUniqueId).toMatch(/^DOM-GEO-/);

    // 11. Propriétaire refuse d'enregistrer un bien hors de sa zone (même s'il tente une dérogation lui-même)
    const outProp = await api()
      .post(`${base}/properties`)
      .set(authed(owner))
      .send({
        name: 'Immeuble Hors Zone',
        type: 'BUILDING',
        address: 'Zone Interdite',
        city: 'Abidjan',
        country: 'CI',
        geoOwnerId,
        blockId: blockAId,
        neighborhoodId: String(neighborhood._id),
        latitude: 5.366,
        longitude: -3.975, // dans Bloc B, hors zone propriétaire
        geoDerogation: { granted: true, justification: 'Auto-dérogation illicite' },
      });
    expect(outProp.status).toBe(422);

    // 12. Administrateur autorisé accorde une dérogation justifiée
    const adminOverrideProp = await api()
      .post(`${base}/properties`)
      .set(authed(admin))
      .send({
        name: 'Immeuble Dérogation Officielle',
        type: 'BUILDING',
        address: 'Zone Limitrophe',
        city: 'Abidjan',
        country: 'CI',
        geoOwnerId,
        blockId: blockAId,
        neighborhoodId: String(neighborhood._id),
        latitude: 5.366,
        longitude: -3.975,
        geoDerogation: {
          granted: true,
          justification: 'Lot mitoyen validé par arrêté municipal #2026-14',
        },
      });
    expect(adminOverrideProp.status).toBe(201);
    expect(adminOverrideProp.body.data.geoDerogation.granted).toBe(true);

    // 13. Carte générale admin retourne les 4 couches et l'historique d'audit
    const layersRes = await api().get(`${base}/geo/layers`).set(authed(admin));
    expect(layersRes.status).toBe(200);
    expect(layersRes.body.data.layers.neighborhoods).toHaveLength(1);
    expect(layersRes.body.data.layers.blocks).toHaveLength(2);
    expect(layersRes.body.data.layers.owners).toHaveLength(1);
    expect(layersRes.body.data.layers.properties).toHaveLength(2);

    const auditRes = await api().get(`${base}/geo/audit`).set(authed(admin));
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.length).toBeGreaterThanOrEqual(5);

    // 14. Polygone croisé rejeté
    const invalidPolyRes = await api()
      .post(`${base}/owners`)
      .set(authed(blockLeaderA))
      .send({
        fullName: 'Polygone Croisé',
        phone: '+2250701020311',
        blockId: blockAId,
        assignedBoundary: toGeoJsonPolygon([
          { lat: 5.364, lng: -3.987 },
          { lat: 5.370, lng: -3.982 },
          { lat: 5.370, lng: -3.987 },
          { lat: 5.364, lng: -3.982 },
        ]),
      });
    expect(invalidPolyRes.status).toBe(422);

    // 15. Test migration 2dsphere
    const migration = await runGeo2dsphereMigration();
    expect(migration.indexesSynced).toContain('Property');
    expect(city._id).toBeDefined();
  });
});
