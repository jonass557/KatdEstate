import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

async function activatedLease(rentAmountMinor = 100_000) {
  const manager = await createActor('PROPERTY_MANAGER');
  const accountant = await createActor('ACCOUNTANT', manager.organizationId);
  const base = `/api/v1/organizations/${manager.organizationId}`;

  const property = await api().post(`${base}/properties`).set(authed(manager)).send({ name: 'Immeuble', address: '1 rue', city: 'Dakar', country: 'SN' });
  const unit = await api().post(`${base}/units`).set(authed(manager)).send({ propertyId: property.body.data._id, name: 'Studio', type: 'STUDIO', rentAmountMinor });
  const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Awa Diop' });
  const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
    tenantId: tenant.body.data._id,
    unitId: unit.body.data._id,
    startDate: '2026-01-01',
    endDate: '2026-02-28',
    rentAmountMinor,
    dueDay: 1,
    penalty: { type: 'FIXED', value: 5_000, graceDays: 0 },
  });
  await api().post(`${base}/leases/${lease.body.data._id}/activate`).set(authed(manager));

  const schedules = await api().get(`${base}/rent-schedules?sort=dueDate&order=asc`).set(authed(accountant));
  return { accountant, base, scheduleId: schedules.body.data[0]._id as string };
}

function pay(amountMinor: number, key: string) {
  return { amountMinor, method: 'CASH' as const, idempotencyKey: key };
}

describe('finance', () => {
  it('encaisse un paiement complet et émet facture et quittance', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const response = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(100_000, 'paiement-complet-001') });

    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('PAID');
    expect(response.body.data.remainingMinor).toBe(0);
    expect(response.body.data.invoice.number).toMatch(/^FAC-/);
    expect(response.body.data.receipt.number).toMatch(/^QUI-/);
  });

  it('gère un paiement partiel : 40 000 versés laissent 60 000', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const response = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(40_000, 'paiement-partiel-001') });

    expect(response.body.data.status).toBe('PARTIAL');
    expect(response.body.data.remainingMinor).toBe(60_000);

    const rest = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(60_000, 'paiement-partiel-002') });
    expect(rest.body.data.status).toBe('PAID');
    expect(rest.body.data.remainingMinor).toBe(0);
  });

  it('refuse un double paiement portant la même clé d’idempotence', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const first = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(100_000, 'doublon-0001') });
    const second = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(100_000, 'doublon-0001') });

    expect(second.status).toBe(200);
    expect(second.body.data.duplicate).toBe(true);
    expect(second.body.data.payment._id).toBe(first.body.data.payment._id);
  });

  it('refuse un trop-perçu', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const response = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(150_000, 'trop-percu-0001') });
    expect(response.status).toBe(422);
  });

  it('rembourse un paiement et recalcule le reste dû', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const payment = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(100_000, 'remboursement-001') });
    const refund = await api()
      .post(`${base}/payments/${payment.body.data.payment._id}/refund`)
      .set(authed(accountant))
      .send({ reason: 'Erreur de saisie' });

    expect(refund.body.data.payment.status).toBe('REFUNDED');
    expect(refund.body.data.remainingMinor).toBe(100_000);
  });

  it('annule une échéance impayée et refuse d’annuler une échéance partiellement payée', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const cancelled = await api().post(`${base}/rent-schedules/${scheduleId}/cancel`).set(authed(accountant)).send({ reason: 'Logement inutilisable' });
    expect(cancelled.body.data.status).toBe('CANCELLED');

    const { base: base2, scheduleId: scheduleId2, accountant: accountant2 } = await activatedLease();
    await api().post(`${base2}/payments`).set(authed(accountant2)).send({ rentScheduleId: scheduleId2, ...pay(10_000, 'annulation-0001') });
    const refused = await api().post(`${base2}/rent-schedules/${scheduleId2}/cancel`).set(authed(accountant2)).send({ reason: 'Test' });
    expect(refused.status).toBe(409);
  });

  it('calcule les totaux attendu, encaissé, restant et en retard', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(40_000, 'totaux-0001') });

    const summary = await api().get(`${base}/finance/summary`).set(authed(accountant));
    expect(summary.body.data.expectedMinor).toBe(200_000);
    expect(summary.body.data.collectedMinor).toBe(40_000);
    expect(summary.body.data.remainingMinor).toBe(160_000);
  });

  it('rapproche un paiement une seule fois', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const payment = await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(100_000, 'rapprochement-001') });
    const reconciled = await api().post(`${base}/payments/${payment.body.data.payment._id}/reconcile`).set(authed(accountant));
    expect(reconciled.body.data.reconciledAt).toBeTruthy();
    const second = await api().post(`${base}/payments/${payment.body.data.payment._id}/reconcile`).set(authed(accountant));
    expect(second.status).toBe(404);
  });

  it('modifie une échéance avec traçabilité d’audit', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    const updated = await api()
      .patch(`${base}/rent-schedules/${scheduleId}`)
      .set(authed(accountant))
      .send({ amountDueMinor: 110_000, penaltyMinor: 5_000, reason: 'Ajustement contractuel' });

    expect(updated.status).toBe(200);
    expect(updated.body.data.amountDueMinor).toBe(110_000);
    expect(updated.body.data.penaltyMinor).toBe(5_000);
  });

  it('calcule et retourne le dashboard financier complet', async () => {
    const { accountant, base, scheduleId } = await activatedLease();
    await api().post(`${base}/payments`).set(authed(accountant)).send({ rentScheduleId: scheduleId, ...pay(50_000, 'dash-001') });

    const dash = await api().get(`${base}/finance/dashboard`).set(authed(accountant));
    expect(dash.status).toBe(200);
    expect(dash.body.data.totals).toBeDefined();
    expect(dash.body.data.totals.rentCollectedMinor).toBe(50_000);
    expect(dash.body.data.monthlyTrend).toBeInstanceOf(Array);
    expect(dash.body.data.expensesByCategory).toBeInstanceOf(Array);
  });

  it('enregistre une caution et permet une déduction sur impayé', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const accountant = await createActor('ACCOUNTANT', manager.organizationId);
    const base = `/api/v1/organizations/${manager.organizationId}`;
    const property = await api().post(`${base}/properties`).set(authed(manager)).send({ name: 'Villa', address: '2 rue', city: 'Abidjan', country: 'CI' });
    const unit = await api().post(`${base}/units`).set(authed(manager)).send({ propertyId: property.body.data._id, name: 'Villa', type: 'VILLA', rentAmountMinor: 200_000 });
    const tenant = await api().post(`${base}/tenants`).set(authed(manager)).send({ fullName: 'Kofi Mensah' });
    const lease = await api().post(`${base}/leases`).set(authed(manager)).send({
      tenantId: tenant.body.data._id,
      unitId: unit.body.data._id,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmountMinor: 200_000,
      dueDay: 5,
    });

    const deposit = await api().post(`${base}/deposits`).set(authed(accountant)).send({
      leaseId: lease.body.data._id,
      type: 'RECEIVED',
      amountMinor: 400_000,
      note: 'Caution 2 mois',
    });
    expect(deposit.status).toBe(201);
    expect(deposit.body.data.type).toBe('RECEIVED');
    expect(deposit.body.data.amountMinor).toBe(400_000);

    const deduction = await api().post(`${base}/deposits`).set(authed(accountant)).send({
      leaseId: lease.body.data._id,
      type: 'DEDUCTION',
      amountMinor: 50_000,
      note: 'Retenue impayé',
    });
    expect(deduction.status).toBe(201);
    expect(deduction.body.data.type).toBe('DEDUCTION');
  });
});
