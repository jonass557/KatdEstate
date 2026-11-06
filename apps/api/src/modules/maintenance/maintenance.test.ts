import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';
import { Tenant } from '../../models/lease.js';

useTestDatabase();

async function setup() {
  const manager = await createActor('PROPERTY_MANAGER');
  const base = `/api/v1/organizations/${manager.organizationId}`;
  const property = await api()
    .post(`${base}/properties`)
    .set(authed(manager))
    .send({ name: 'Immeuble', address: '1 rue', city: 'Dakar', country: 'SN' });
  const unit = await api().post(`${base}/units`).set(authed(manager)).send({
    propertyId: property.body.data._id,
    name: 'Studio',
    type: 'STUDIO',
    rentAmountMinor: 100_000,
  });
  const tenant = await api()
    .post(`${base}/tenants`)
    .set(authed(manager))
    .send({ fullName: 'Awa Diop' });
  const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
    tenantId: tenant.body.data._id,
    unitId: unit.body.data._id,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    rentAmountMinor: 100_000,
    dueDay: 1,
  });
  await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));
  return {
    manager,
    base,
    unitId: unit.body.data._id as string,
    tenantId: tenant.body.data._id as string,
  };
}

describe('maintenance', () => {
  it('ouvre un ticket, l’attribue et le résout', async () => {
    const { manager, base, unitId } = await setup();
    const vendor = await api()
      .post(`${base}/vendors`)
      .set(authed(manager))
      .send({ name: 'Plomberie Diop', trade: 'PLUMBER', phone: '+221770000001' });
    const ticket = await api().post(`${base}/maintenance`).set(authed(manager)).send({
      category: 'Plomberie',
      title: 'Fuite sous évier',
      priority: 'HIGH',
      unitId,
    });
    expect(ticket.status).toBe(201);
    expect(ticket.body.data.status).toBe('OPEN');

    const assigned = await api()
      .patch(`${base}/maintenance/${ticket.body.data._id}`)
      .set(authed(manager))
      .send({ vendorId: vendor.body.data._id });
    expect(assigned.body.data.status).toBe('ASSIGNED');

    const resolved = await api()
      .patch(`${base}/maintenance/${ticket.body.data._id}`)
      .set(authed(manager))
      .send({ status: 'RESOLVED', actualCostMinor: 25_000 });
    expect(resolved.body.data.status).toBe('RESOLVED');
    expect(resolved.body.data.completedAt).toBeTruthy();

    const history = await api()
      .get(`${base}/maintenance/${ticket.body.data._id}/history`)
      .set(authed(manager));
    expect(history.body.data.length).toBeGreaterThanOrEqual(3);

    const stats = await api().get(`${base}/maintenance/stats`).set(authed(manager));
    expect(stats.body.data.costMinor).toBe(25_000);
  });

  it('permet à un locataire de signaler un problème sur son logement uniquement', async () => {
    const { manager, base, unitId, tenantId } = await setup();
    const tenant = await createActor('TENANT', manager.organizationId);
    await Tenant.updateOne({ _id: tenantId }, { userId: tenant.userId });

    const own = await api()
      .post(`${base}/maintenance`)
      .set(authed(tenant))
      .send({ category: 'Électricité', title: 'Prise cassée', unitId });
    expect(own.status).toBe(201);

    const otherUnit = await api()
      .post(`${base}/units`)
      .set(authed(manager))
      .send({
        propertyId: (await api().get(`${base}/units/${unitId}`).set(authed(manager))).body.data
          .propertyId,
        name: 'Autre',
        type: 'ROOM',
        rentAmountMinor: 50_000,
      });
    const forbidden = await api()
      .post(`${base}/maintenance`)
      .set(authed(tenant))
      .send({ category: 'Autre', title: 'Test', unitId: otherUnit.body.data._id });
    expect(forbidden.status).toBe(403);

    const edit = await api()
      .patch(`${base}/maintenance/${own.body.data._id}`)
      .set(authed(tenant))
      .send({ status: 'CLOSED' });
    expect(edit.status).toBe(403);
  });
});
