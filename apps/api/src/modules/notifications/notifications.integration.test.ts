import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';
import { notify } from './notifications.service.js';
import { testConfig } from '../../test/fixtures.js';
import { Notification } from '../../models/operations.js';

useTestDatabase();

describe('notifications', () => {
  it('n’envoie rien deux fois pour la même clé', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    const input = {
      organizationId: manager.organizationId,
      event: 'RENT_DUE_SOON' as const,
      recipientUserId: manager.userId,
      variables: { tenantName: 'Awa', rentAmount: '100000', dueDate: '2026-02-01', propertyName: 'Immeuble', unitName: 'Studio', paymentLink: '' },
      idempotencyKey: 'rappel-unique-001',
    };
    await notify(testConfig, input);
    await notify(testConfig, input);

    const count = await Notification.countDocuments({ idempotencyKey: 'rappel-unique-001' });
    expect(count).toBe(1);
  });

  it('marque SMS et WhatsApp comme non configurés, sans prétendre les avoir envoyés', async () => {
    const manager = await createActor('PROPERTY_MANAGER');
    await notify(testConfig, {
      organizationId: manager.organizationId,
      event: 'PAYMENT_RECEIVED',
      variables: { tenantName: 'Awa', rentAmount: '100000', dueDate: '', propertyName: '', unitName: '', paymentLink: '' },
      idempotencyKey: 'canaux-externes-001',
      channels: ['SMS', 'WHATSAPP'],
    });

    const records = await Notification.find({ idempotencyKey: 'canaux-externes-001' });
    expect(records).toHaveLength(2);
    expect(records.every((record) => record.status === 'SKIPPED_UNCONFIGURED')).toBe(true);
  });

  it('permet à l’administrateur de modifier un template et rejette une variable inconnue', async () => {
    const admin = await createActor('ADMIN');
    const base = `/api/v1/organizations/${admin.organizationId}`;
    const saved = await api().put(`${base}/notification-templates`).set(authed(admin)).send({
      event: 'RENT_DUE_SOON',
      channel: 'IN_APP',
      subject: 'Rappel {{tenantName}}',
      body: 'Montant {{rentAmount}} dû le {{dueDate}}.',
    });
    expect(saved.status).toBe(200);

    const invalid = await api().put(`${base}/notification-templates`).set(authed(admin)).send({
      event: 'RENT_DUE_SOON',
      channel: 'EMAIL',
      subject: 'Test',
      body: 'Bonjour {{motDePasse}}',
    });
    expect(invalid.status).toBe(422);
  });
});
