import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

describe('utilities', () => {
  it('calcule la consommation et émet une facture', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const base = `/api/v1/organizations/${manager.organizationId}`;
    const meter = await api().post(`${base}/meters`).set(authed(manager)).send({ type: 'ELECTRICITY', label: 'Compteur général', unitPriceMinor: 100 });

    const reading = await api().post(`${base}/meter-readings`).set(authed(manager)).send({
      meterId: meter.body.data._id,
      previousIndex: 1_000,
      currentIndex: 1_250,
      readAt: '2026-02-01',
    });
    expect(reading.status).toBe(201);
    expect(reading.body.data.reading.consumption).toBe(250);
    expect(reading.body.data.bill.amountMinor).toBe(25_000);
    expect(reading.body.data.bill.number).toMatch(/^UTIL-/);
  });

  it('rejette un index inférieur au précédent', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const base = `/api/v1/organizations/${manager.organizationId}`;
    const meter = await api().post(`${base}/meters`).set(authed(manager)).send({ type: 'WATER', label: 'Compteur eau', unitPriceMinor: 50 });
    const response = await api().post(`${base}/meter-readings`).set(authed(manager)).send({
      meterId: meter.body.data._id,
      previousIndex: 500,
      currentIndex: 490,
      readAt: '2026-02-01',
    });
    expect(response.status).toBe(422);
  });

  it('signale une consommation anormale après un historique stable', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const base = `/api/v1/organizations/${manager.organizationId}`;
    const meter = await api().post(`${base}/meters`).set(authed(manager)).send({ type: 'WATER', label: 'Compteur eau', unitPriceMinor: 50, anomalyMultiplier: 2 });

    for (const [index, day] of [['01', 100], ['02', 110], ['03', 105]] as const) {
      const response = await api().post(`${base}/meter-readings`).set(authed(manager)).send({
        meterId: meter.body.data._id,
        previousIndex: 0,
        currentIndex: day,
        readAt: `2026-0${index}-01`,
      });
      expect(response.body.data.abnormal).toBe(false);
    }

    const spike = await api().post(`${base}/meter-readings`).set(authed(manager)).send({
      meterId: meter.body.data._id,
      previousIndex: 0,
      currentIndex: 1_000,
      readAt: '2026-04-01',
    });
    expect(spike.body.data.abnormal).toBe(true);
  });

  it('refuse l’OCR tant qu’aucun fournisseur n’est branché', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const response = await api().post(`/api/v1/organizations/${manager.organizationId}/meter-readings/ocr`).set(authed(manager)).send({});
    expect(response.status).toBe(501);
    expect(response.body.error.message).toContain('OCR');
  });
});
