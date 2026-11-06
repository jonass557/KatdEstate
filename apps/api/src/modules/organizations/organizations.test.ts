import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

describe('organisations et multi-tenancy', () => {
  it('liste les organisations de l’utilisateur connecté', async () => {
    const owner = await createActor('OWNER');
    const res = await api().get('/api/v1/organizations').set(authed(owner));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].id).toBe(owner.organizationId);
  });

  it('crée une nouvelle organisation avec paramètres complets', async () => {
    const owner = await createActor('OWNER');
    const payload = {
      name: 'DOMORA Immo Dakar',
      country: 'SN',
      currency: 'XOF',
      timezone: 'Africa/Dakar',
      locale: 'fr',
      logo: 'https://domora.sn/logo.png',
      address: 'Route des Almadies, Immeuble Horizon',
      phone: '+221338000000',
      email: 'contact@domora.sn',
      notificationSettings: {
        emailRentReminder: true,
        smsRentReminder: true,
        reminderDaysBeforeDue: 3,
      },
      billingSettings: {
        invoicePrefix: 'DOM-FAC-',
        receiptPrefix: 'DOM-REC-',
        lateFeePercentage: 5,
      },
    };

    const res = await api().post('/api/v1/organizations').set(authed(owner)).send(payload);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('DOMORA Immo Dakar');
    expect(res.body.data.currency).toBe('XOF');
    expect(res.body.data.phone).toBe('+221338000000');
    expect(res.body.data.role).toBe('OWNER');
    expect(res.body.data.notificationSettings.reminderDaysBeforeDue).toBe(3);
  });

  it('consulte et met à jour les paramètres d’une organisation', async () => {
    const owner = await createActor('OWNER');
    const base = `/api/v1/organizations/${owner.organizationId}`;

    const getRes = await api().get(base).set(authed(owner));
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.id).toBe(owner.organizationId);

    const updateRes = await api()
      .patch(base)
      .set(authed(owner))
      .send({
        address: 'Point E, Rue 5',
        phone: '+221771112233',
        billingSettings: { lateFeePercentage: 10 },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.address).toBe('Point E, Rue 5');
    expect(updateRes.body.data.phone).toBe('+221771112233');
    expect(updateRes.body.data.billingSettings.lateFeePercentage).toBe(10);
  });

  it('gère les membres de l’organisation (invitation, modification, suppression)', async () => {
    const admin = await createActor('ADMIN');
    const base = `/api/v1/organizations/${admin.organizationId}`;

    // 1. Inviter un membre
    const inviteRes = await api()
      .post(`${base}/members`)
      .set(authed(admin))
      .send({ email: 'nouveau.gestionnaire@domora.sn', role: 'PROPERTY_MANAGER' });

    expect(inviteRes.status).toBe(201);
    expect(inviteRes.body.data.role).toBe('PROPERTY_MANAGER');
    expect(inviteRes.body.data.status).toBe('INVITED');
    const memberId = inviteRes.body.data.id;

    // 2. Lister les membres
    const listRes = await api().get(`${base}/members`).set(authed(admin));
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((m: { id: string }) => m.id === memberId)).toBe(true);

    // 3. Modifier le rôle
    const patchRes = await api()
      .patch(`${base}/members/${memberId}`)
      .set(authed(admin))
      .send({ role: 'ACCOUNTANT' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.role).toBe('ACCOUNTANT');

    // 4. Supprimer le membre
    const deleteRes = await api().delete(`${base}/members/${memberId}`).set(authed(admin));
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.data.removed).toBe(true);
  });

  it('garantit l’isolation stricte entre organisations', async () => {
    const orgA = await createActor('OWNER');
    const orgB = await createActor('OWNER');

    // orgB ne peut pas accéder aux paramètres de orgA
    const intruderRes = await api()
      .get(`/api/v1/organizations/${orgA.organizationId}`)
      .set(authed(orgB));

    expect(intruderRes.status).toBe(403);
  });
});
