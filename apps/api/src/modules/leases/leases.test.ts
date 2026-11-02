import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';
import { Tenant } from '../../models/lease.js';

useTestDatabase();

async function context() {
  const manager = await createActor('PROPERTY_MANAGER');
  const base = `/api/v1/organizations/${manager.organizationId}`;
  const property = await api()
    .post(`${base}/properties`)
    .set(authed(manager))
    .send({ name: 'Immeuble', address: '1 rue', city: 'Dakar', country: 'SN' });
  const unit = await api().post(`${base}/units`).set(authed(manager)).send({
    propertyId: property.body.data._id,
    name: 'Studio 1',
    type: 'STUDIO',
    rentAmountMinor: 100_000,
  });
  return { manager, base, unitId: unit.body.data._id as string };
}

describe('locataires et contrats', () => {
  it('protège le numéro de pièce : masqué par défaut, visible avec permission', async () => {
    const { manager, base } = await context();
    const created = await api().post(`${base}/tenants`).set(authed(manager)).send({
      fullName: 'Awa Diop',
      phone: '+221770000000',
      email: 'awa@example.com',
      identityDocumentType: 'NATIONAL_ID',
      identityDocumentNumber: '1 234 567 890 12',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.identityDocumentNumber).toBe('•••••••••••••012');
    expect(JSON.stringify(created.body)).not.toContain('567');

    const accountant = await createActor('ACCOUNTANT', manager.organizationId);
    const revealed = await api().get(`${base}/tenants/${created.body.data._id}`).set(authed(accountant));
    expect(revealed.body.data.identityDocumentNumber).toBe('1 234 567 890 12');
  });

  it('active un contrat, génère l’échéancier et occupe le logement', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Awa Diop' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
      rentAmountMinor: 100_000,
      chargesAmountMinor: 0,
      dueDay: 1,
    });
    expect(lease.status).toBe(201);
    expect(lease.body.data.status).toBe('DRAFT');

    const activated = await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));
    expect(activated.body.data.status).toBe('ACTIVE');

    const schedules = await api().get(`${base}/rent-schedules`).set(authed(manager));
    expect(schedules.body.data).toHaveLength(3);
    expect(schedules.body.data[0].amountDueMinor).toBe(100_000);

    const unit = await api().get(`${base}/units/${unitId}`).set(authed(manager));
    expect(unit.body.data.status).toBe('OCCUPIED');
  });

  it('refuse d’activer deux fois et construit la timeline', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Moussa Ndiaye' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId,
      startDate: '2026-01-01',
      endDate: '2026-02-28',
      rentAmountMinor: 80_000,
      dueDay: 1,
    });
    await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));
    const second = await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));
    expect(second.status).toBe(409);

    const timeline = await api().get(`${base}/leases/${lease.body.data._id}/timeline`).set(authed(manager));
    expect(timeline.status).toBe(200);
    const dates = timeline.body.data.map((event: { date: string }) => event.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it('résilie un contrat et libère le logement', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Fatou Sall' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      rentAmountMinor: 90_000,
      dueDay: 5,
    });
    await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));

    const terminated = await api()
      .post(`${base}/leases/${lease.body.data._id}/terminate`)
      .set(authed(manager))
      .send({ terminationDate: '2026-02-15', reason: 'Départ anticipé' });
    expect(terminated.body.data.status).toBe('TERMINATED');

    const unit = await api().get(`${base}/units/${unitId}`).set(authed(manager));
    expect(unit.body.data.status).toBe('AVAILABLE');
  });

  it('empêche un locataire de lire le contrat d’un autre', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Ibrahima Ba' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId,
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      rentAmountMinor: 90_000,
      dueDay: 1,
    });

    const other = await createActor('TENANT');
    await Tenant.updateOne({ _id: tenant.body.data._id }, { userId: other.userId });
    const response = await api().get(`/api/v1/organizations/${other.organizationId}/leases/${lease.body.data._id}`).set(authed(other));
    expect(response.status).toBe(404);
  });

  it('prépare la signature sans prétendre l’avoir envoyée', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Awa Diop' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmountMinor: 100_000,
      dueDay: 1,
    });
    const signature = await api().post(`${base}/leases/${lease.body.data._id}/signature`).set(authed(manager));
    expect(signature.body.data.status).toBe('PENDING');
    expect(signature.body.data.note).toContain('Aucun fournisseur');
  });

  it('génère la chronologie complète du locataire (arrivée, contrat, paiements)', async () => {
    const { manager, base, unitId } = await context();
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({
      firstName: 'Fatou',
      lastName: 'Sow',
      phone: '+221772223344',
      email: 'fatou.sow@example.com',
      profession: 'Ingénieure',
    });
    expect(tenant.status).toBe(201);
    expect(tenant.body.data.fullName).toBe('Fatou Sow');

    const tenantId = tenant.body.data._id;
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId,
      unitId,
      startDate: '2026-02-01',
      endDate: '2026-12-31',
      rentAmountMinor: 150_000,
      dueDay: 5,
    });
    expect(lease.status).toBe(201);

    const timeline = await api().get(`${base}/tenants/${tenantId}/timeline`).set(authed(manager));
    expect(timeline.status).toBe(200);
    expect(Array.isArray(timeline.body.data)).toBe(true);
    expect(timeline.body.data.length).toBeGreaterThanOrEqual(2);
    expect(timeline.body.data.some((e: { kind: string }) => e.kind === 'ARRIVAL')).toBe(true);
    expect(timeline.body.data.some((e: { kind: string }) => e.kind === 'LEASE')).toBe(true);
  });
});
