import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';
import { Tenant } from '../../models/lease.js';

useTestDatabase();

describe('portail locataire', () => {
  it('ne montre au locataire que son propre dossier', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const tenantUser = await createActor('TENANT', manager.organizationId);
    const other = await createActor('TENANT', manager.organizationId);
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
    const created = await api()
      .post(`${base}/tenants`)
      .set(authed(manager))
      .send({ fullName: 'Awa Diop', phone: '+221770000000' });
    await Tenant.updateOne({ _id: created.body.data._id }, { userId: tenantUser.userId });
    await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Autre locataire' });

    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: created.body.data._id,
      unitId: unit.body.data._id,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      rentAmountMinor: 100_000,
      dueDay: 1,
    });
    await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));

    const home = await api().get(`${base}/portal`).set(authed(tenantUser));
    expect(home.status).toBe(200);
    expect(home.body.data.tenant.fullName).toBe('Awa Diop');
    expect(home.body.data.unit.name).toBe('Studio');
    expect(home.body.data.nextRent.amountDueMinor).toBe(100_000);

    const rents = await api().get(`${base}/portal/rents`).set(authed(tenantUser));
    expect(rents.body.data.length).toBeGreaterThan(0);
    expect(
      rents.body.data.every((row: { tenantId: string }) => row.tenantId === created.body.data._id),
    ).toBe(true);

    const stranger = await api().get(`${base}/portal`).set(authed(other));
    expect(stranger.status).toBe(404);
  });

  it('laisse le locataire modifier ses coordonnées, pas son nom', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const tenantUser = await createActor('TENANT', manager.organizationId);
    const base = `/api/v1/organizations/${manager.organizationId}`;
    const created = await api()
      .post(`${base}/tenants`)
      .set(authed(manager))
      .send({ fullName: 'Awa Diop' });
    await Tenant.updateOne({ _id: created.body.data._id }, { userId: tenantUser.userId });

    const updated = await api()
      .patch(`${base}/portal/profile`)
      .set(authed(tenantUser))
      .send({ phone: '+221770000099', fullName: 'Piraté' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.phone).toBe('+221770000099');
    expect(updated.body.data.fullName).toBe('Awa Diop');
  });
});
