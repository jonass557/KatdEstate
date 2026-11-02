import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

describe('finance avancée', () => {
  it('calcule revenus, dépenses, bénéfice et taux', async () => {
    const accountant = await createActor('ACCOUNTANT');
    const base = `/api/v1/organizations/${accountant.organizationId}`;

    await api().post(`${base}/transactions`).set(authed(accountant)).send({ direction: 'INCOME', category: 'OTHER', amountMinor: 300_000, date: '2026-01-15', label: 'Loyer encaissé' });
    await api().post(`${base}/transactions`).set(authed(accountant)).send({ direction: 'EXPENSE', category: 'ELECTRICITY', amountMinor: 40_000, date: '2026-01-20', label: 'Facture Senelec' });
    await api().post(`${base}/transactions`).set(authed(accountant)).send({ direction: 'EXPENSE', category: 'MAINTENANCE', amountMinor: 25_000, date: '2026-02-02', label: 'Réparation' });

    const report = await api().get(`${base}/reports/finance?from=2026-01-01&to=2026-03-31`).set(authed(accountant));
    expect(report.body.data.incomeMinor).toBe(300_000);
    expect(report.body.data.expenseMinor).toBe(65_000);
    expect(report.body.data.netMinor).toBe(235_000);
    expect(report.body.data.expenseByCategory).toHaveLength(2);

    const january = await api().get(`${base}/reports/finance?from=2026-01-01&to=2026-01-31`).set(authed(accountant));
    expect(january.body.data.expenseMinor).toBe(40_000);
  });

  it('présente la prévision comme une estimation, jamais comme une garantie', async () => {
    const accountant = await createActor('ACCOUNTANT');
    const response = await api().get(`/api/v1/organizations/${accountant.organizationId}/reports/forecast`).set(authed(accountant));
    expect(response.status).toBe(200);
    expect(response.body.data.disclaimer).toContain('Estimation calculée');
    expect(response.body.data.disclaimer).toContain('pas une garantie');
  });

  it('exporte les transactions en CSV', async () => {
    const accountant = await createActor('ACCOUNTANT');
    const base = `/api/v1/organizations/${accountant.organizationId}`;
    await api().post(`${base}/transactions`).set(authed(accountant)).send({ direction: 'EXPENSE', category: 'WATER', amountMinor: 12_000, date: '2026-03-01', label: 'Eau' });
    const response = await api().get(`${base}/transactions/export`).set(authed(accountant));
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('WATER');
  });

  it('gère le cycle complet d’approbation, rejet et paiement d’une dépense', async () => {
    const accountant = await createActor('ACCOUNTANT');
    const base = `/api/v1/organizations/${accountant.organizationId}`;

    const created = await api().post(`${base}/transactions`).set(authed(accountant)).send({
      direction: 'EXPENSE',
      category: 'REPAIR',
      amountMinor: 85_000,
      date: '2026-03-10',
      label: 'Réparation toiture',
      payee: 'Artisan Couvreur',
      status: 'PENDING',
    });
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('PENDING');

    const approved = await api()
      .post(`${base}/transactions/${created.body.data._id}/approve`)
      .set(authed(accountant));
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.approvedBy).toBeDefined();

    const paid = await api()
      .post(`${base}/transactions/${created.body.data._id}/pay`)
      .set(authed(accountant));
    expect(paid.status).toBe(200);
    expect(paid.body.data.status).toBe('PAID');

    // Test du rejet
    const toReject = await api().post(`${base}/transactions`).set(authed(accountant)).send({
      direction: 'EXPENSE',
      category: 'OTHER',
      amountMinor: 15_000,
      date: '2026-03-12',
      label: 'Dépense injustifiée',
      status: 'PENDING',
    });
    const rejected = await api()
      .post(`${base}/transactions/${toReject.body.data._id}/reject`)
      .set(authed(accountant))
      .send({ reason: 'Absence de devis préalable' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    expect(rejected.body.data.rejectionReason).toBe('Absence de devis préalable');
  });
});
