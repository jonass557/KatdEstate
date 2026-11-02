import { describe, expect, it } from 'vitest';
import { renderTemplate } from './notifications.service.js';
import { SmsProvider, WhatsAppProvider } from './providers.js';

describe('templates de notification', () => {
  it('remplace les variables connues', () => {
    const rendered = renderTemplate('Bonjour {{tenantName}}, loyer {{rentAmount}} dû le {{dueDate}}.', {
      tenantName: 'Awa Diop',
      rentAmount: '100000',
      dueDate: '2026-02-01',
    });
    expect(rendered).toBe('Bonjour Awa Diop, loyer 100000 dû le 2026-02-01.');
  });

  it('neutralise une variable inconnue au lieu de l’évaluer', () => {
    expect(renderTemplate('{{tenantName}} {{inconnu}}', { tenantName: 'Awa' })).toBe('Awa ');
  });
});

describe('canaux non configurés', () => {
  it('ne prétend jamais avoir envoyé un SMS', async () => {
    const result = await new SmsProvider().send({ to: '+221770000000', subject: 'Test', body: 'Test' });
    expect(result.status).toBe('SKIPPED_UNCONFIGURED');
  });

  it('ne prétend jamais avoir envoyé un WhatsApp', async () => {
    const result = await new WhatsAppProvider().send({ to: '+221770000000', subject: 'Test', body: 'Test' });
    expect(result.status).toBe('SKIPPED_UNCONFIGURED');
    expect(result.detail).toContain('Aucun fournisseur');
  });
});
