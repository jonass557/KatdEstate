import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

describe('authentification et gestion de compte', () => {
  it('permet à un utilisateur connecté de modifier son mot de passe', async () => {
    const actor = await createActor('ADMIN');

    // Mot de passe initial dans les fixtures est 'CorrectHorseBattery1!'
    const res = await api().post('/api/v1/auth/change-password').set(authed(actor)).send({
      currentPassword: 'CorrectHorseBattery1!',
      newPassword: 'NouveauMotDePasse2026!',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Reconnexion avec le nouveau mot de passe
    const loginRes = await api().post('/api/v1/auth/login').send({
      email: actor.email,
      password: 'NouveauMotDePasse2026!',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.accessToken).toBeDefined();

    // L'ancien mot de passe est rejeté
    const failRes = await api().post('/api/v1/auth/login').send({
      email: actor.email,
      password: 'CorrectHorseBattery1!',
    });
    expect(failRes.status).toBe(401);
  });

  it('rejette la modification si le mot de passe actuel est faux', async () => {
    const actor = await createActor('ADMIN');

    const res = await api().post('/api/v1/auth/change-password').set(authed(actor)).send({
      currentPassword: 'MauvaisMotDePasse!',
      newPassword: 'NouveauMotDePasse2026!',
    });

    expect(res.status).toBe(401);
  });
});
