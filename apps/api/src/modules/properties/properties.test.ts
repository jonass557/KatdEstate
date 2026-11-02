import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

const propertyPayload = {
  name: 'Résidence Les Almadies',
  address: '12 route de Ngor',
  city: 'Dakar',
  country: 'sn',
  description: 'Immeuble de rapport',
};

async function seed() {
  const manager = await createActor('PROPERTY_MANAGER');
  const base = `/api/v1/organizations/${manager.organizationId}`;
  const created = await api().post(`${base}/properties`).set(authed(manager)).send(propertyPayload);
  return { manager, base, propertyId: created.body.data._id as string };
}

describe('immobilier', () => {
  it('crée, liste, modifie et supprime une propriété', async () => {
    const { manager, base } = await seed();

    const list = await api().get(`${base}/properties`).set(authed(manager));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].country).toBe('SN');
    expect(list.body.meta.total).toBe(1);

    const id = list.body.data[0]._id as string;
    const updated = await api().patch(`${base}/properties/${id}`).set(authed(manager)).send({ city: 'Thiès' });
    expect(updated.body.data.city).toBe('Thiès');

    const removed = await api().delete(`${base}/properties/${id}`).set(authed(manager));
    expect(removed.body.data.deleted).toBe(true);

    const after = await api().get(`${base}/properties/${id}`).set(authed(manager));
    expect(after.status).toBe(404);
  });

  it('refuse une propriété invalide', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const response = await api()
      .post(`/api/v1/organizations/${manager.organizationId}/properties`)
      .set(authed(manager))
      .send({ name: '' });
    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
  });

  it('isole les organisations : une propriété n’est pas lisible depuis une autre', async () => {
    const { propertyId } = await seed();
    const intruder = await createActor('PROPERTY_MANAGER');
    const response = await api()
      .get(`/api/v1/organizations/${intruder.organizationId}/properties/${propertyId}`)
      .set(authed(intruder));
    expect(response.status).toBe(404);
  });

  it('crée un bâtiment puis un logement rattaché', async () => {
    const { manager, base, propertyId } = await seed();

    const building = await api()
      .post(`${base}/buildings`)
      .set(authed(manager))
      .send({ propertyId, name: 'Bâtiment A', floors: 4 });
    expect(building.status).toBe(201);

    const unit = await api().post(`${base}/units`).set(authed(manager)).send({
      propertyId,
      buildingId: building.body.data._id,
      name: 'Appartement 12',
      number: 'A12',
      floor: 2,
      type: 'APARTMENT',
      surfaceM2: 65,
      bedrooms: 2,
      bathrooms: 1,
      rentAmountMinor: 250_000,
      chargesAmountMinor: 15_000,
      depositAmountMinor: 500_000,
      amenities: ['climatisation', 'balcon'],
    });
    expect(unit.status).toBe(201);
    expect(unit.body.data.status).toBe('AVAILABLE');

    const filtered = await api().get(`${base}/units?propertyId=${propertyId}&type=APARTMENT`).set(authed(manager));
    expect(filtered.body.data).toHaveLength(1);

    const stats = await api().get(`${base}/properties/${propertyId}/stats`).set(authed(manager));
    expect(stats.body.data).toMatchObject({ units: 1, available: 1, occupied: 0, occupancyRate: 0 });
  });

  it('refuse un logement rattaché au bâtiment d’une autre propriété', async () => {
    const { manager, base, propertyId } = await seed();
    const other = await api().post(`${base}/properties`).set(authed(manager)).send({ ...propertyPayload, name: 'Autre' });
    const building = await api()
      .post(`${base}/buildings`)
      .set(authed(manager))
      .send({ propertyId: other.body.data._id, name: 'Bâtiment B' });

    const response = await api()
      .post(`${base}/units`)
      .set(authed(manager))
      .send({ propertyId, buildingId: building.body.data._id, name: 'Studio', type: 'STUDIO', rentAmountMinor: 100_000 });
    expect(response.status).toBe(422);
  });

  it('interdit la création à un rôle sans permission', async () => {
    const owner = await createActor('OWNER');
    const response = await api()
      .post(`/api/v1/organizations/${owner.organizationId}/properties`)
      .set(authed(owner))
      .send(propertyPayload);
    expect(response.status).toBe(403);
  });

  it('exporte le parc en CSV', async () => {
    const { manager, base } = await seed();
    const response = await api().get(`${base}/properties/export`).set(authed(manager));
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('Résidence Les Almadies');
  });
});
