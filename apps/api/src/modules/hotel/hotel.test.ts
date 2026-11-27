import { describe, expect, it } from 'vitest';
import { authed, api, createActor, useTestDatabase } from '../../test/fixtures.js';

useTestDatabase();

const establishmentPayload = {
  name: 'Hôtel Kadt Luxury',
  type: 'HOTEL',
  stars: 5,
  description: 'Établissement hôtelier 5 étoiles avec piscine et spa.',
  address: 'Boulevard Lagunaire, Cocody',
  city: 'Abidjan',
  country: 'Côte d’Ivoire',
  phone: '+225 07 00 00 00 00',
  email: 'contact@kadtluxury.com',
  latitude: 5.3489,
  longitude: -3.9921,
  amenities: ['Wi-Fi Fibre', 'Piscine', 'Parking', 'Climatisation', 'Restaurant'],
  totalRooms: 42,
  occupiedRooms: 28,
  estimatedMonthlyRevenue: 12500,
  currency: 'USD',
  photos: [
    { url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg', isPrimary: true },
  ],
};

describe('Gestion des établissements hôteliers', () => {
  it('crée, liste avec statistiques, modifie, change le statut et supprime un établissement', async () => {
    const owner = await createActor('OWNER');
    const base = `/api/v1/organizations/${owner.organizationId}`;

    // 1. Création
    const created = await api()
      .post(`${base}/establishments`)
      .set(authed(owner))
      .send(establishmentPayload);
    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('Hôtel Kadt Luxury');
    expect(created.body.data.status).toBe('ACTIVE');
    expect(created.body.data.amenities).toContain('Piscine');
    const id = created.body.data._id as string;

    // 2. Liste + statistiques
    const list = await api().get(`${base}/establishments`).set(authed(owner));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.stats.total).toBe(1);
    expect(list.body.meta.stats.active).toBe(1);
    expect(list.body.meta.stats.totalRooms).toBe(42);
    expect(list.body.meta.stats.estimatedMonthlyRevenue).toBe(12500);

    // 3. Modification
    const updated = await api()
      .patch(`${base}/establishments/${id}`)
      .set(authed(owner))
      .send({ city: 'Dakar', country: 'Sénégal', totalRooms: 50 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.city).toBe('Dakar');
    expect(updated.body.data.totalRooms).toBe(50);

    // 4. Changement de statut (Maintenance -> Désactivé -> Archivé -> Actif)
    for (const nextStatus of ['MAINTENANCE', 'INACTIVE', 'ARCHIVED', 'ACTIVE']) {
      const statusRes = await api()
        .patch(`${base}/establishments/${id}/status`)
        .set(authed(owner))
        .send({ status: nextStatus });
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.status).toBe(nextStatus);
    }

    // 5. Suppression
    const removed = await api().delete(`${base}/establishments/${id}`).set(authed(owner));
    expect(removed.status).toBe(200);
    expect(removed.body.data.deleted).toBe(true);

    const after = await api().get(`${base}/establishments/${id}`).set(authed(owner));
    expect(after.status).toBe(404);
  });

  it('supporte les différents types (motel, auberge, résidence, appartement meublé) et les photos Cloudinary', async () => {
    const owner = await createActor('OWNER');
    const base = `/api/v1/organizations/${owner.organizationId}`;

    const photoUpload = await api()
      .post(`${base}/establishments/upload-photos`)
      .set(authed(owner))
      .send({ photos: ['data:image/png;base64,iVBORw0KGgo='] });
    expect(photoUpload.status).toBe(201);
    expect(photoUpload.body.data).toHaveLength(1);

    for (const type of ['MOTEL', 'HOSTEL', 'RESIDENCE', 'FURNISHED_APARTMENT'] as const) {
      const res = await api()
        .post(`${base}/establishments`)
        .set(authed(owner))
        .send({
          ...establishmentPayload,
          name: `Établissement ${type}`,
          type,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.type).toBe(type);
    }

    const list = await api().get(`${base}/establishments`).set(authed(owner));
    expect(list.body.meta.stats.total).toBe(4);
  });

  it('rejette un établissement invalide (422)', async () => {
    const owner = await createActor('OWNER');
    const res = await api()
      .post(`/api/v1/organizations/${owner.organizationId}/establishments`)
      .set(authed(owner))
      .send({ name: '' });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('respecte l’isolation multi-tenant entre organisations', async () => {
    const owner = await createActor('OWNER');
    const intruder = await createActor('OWNER');

    const created = await api()
      .post(`/api/v1/organizations/${owner.organizationId}/establishments`)
      .set(authed(owner))
      .send(establishmentPayload);
    const id = created.body.data._id as string;

    const readAttempt = await api()
      .get(`/api/v1/organizations/${intruder.organizationId}/establishments/${id}`)
      .set(authed(intruder));
    expect(readAttempt.status).toBe(404);

    const deleteAttempt = await api()
      .delete(`/api/v1/organizations/${intruder.organizationId}/establishments/${id}`)
      .set(authed(intruder));
    expect(deleteAttempt.status).toBe(404);
  });

  it('calcule les statistiques réelles du dashboard hôtelier depuis MongoDB', async () => {
    const owner = await createActor('OWNER');
    const base = `/api/v1/organizations/${owner.organizationId}`;

    const created = await api()
      .post(`${base}/establishments`)
      .set(authed(owner))
      .send({ ...establishmentPayload, totalRooms: 10, occupiedRooms: 4 });
    expect(created.status).toBe(201);
    const estId = created.body.data._id as string;

    const dash = await api()
      .get(`${base}/hotel-dashboard?establishmentId=${estId}&period=30D`)
      .set(authed(owner));
    expect(dash.status).toBe(200);
    expect(dash.body.data.kpis.totalRooms).toBe(10);
    expect(dash.body.data.kpis.occupiedRooms).toBe(4);
    expect(dash.body.data.kpis.occupancyRate).toBe(40);
    expect(Array.isArray(dash.body.data.charts.revenueSeries)).toBe(true);
    expect(Array.isArray(dash.body.data.charts.bookingBreakdown)).toBe(true);
    expect(Array.isArray(dash.body.data.charts.monthlyComparison)).toBe(true);
  });

  it('gère les catégories et chambres, empêche le chevauchement et protège la suppression', async () => {
    const owner = await createActor('OWNER');
    const base = `/api/v1/organizations/${owner.organizationId}`;

    const est = await api()
      .post(`${base}/establishments`)
      .set(authed(owner))
      .send(establishmentPayload);
    const estId = est.body.data._id as string;

    // 1. Catégorie
    const cat = await api()
      .post(`${base}/room-categories`)
      .set(authed(owner))
      .send({
        establishmentId: estId,
        name: 'Suite Royale',
        basePrice: 85000,
        defaultBedsCount: 2,
        defaultMaxCapacity: 4,
      });
    expect(cat.status).toBe(201);

    // 2. Chambre
    const room = await api()
      .post(`${base}/rooms`)
      .set(authed(owner))
      .send({
        establishmentId: estId,
        roomNumber: '101',
        categoryId: cat.body.data._id,
        categoryName: 'Suite Royale',
        floor: 1,
        bedsCount: 2,
        maxCapacity: 4,
        pricePerNight: 85000,
      });
    expect(room.status).toBe(201);
    const roomId = room.body.data._id as string;

    // 3. Réservation future
    const checkIn1 = new Date(Date.now() + 86400000 * 2).toISOString();
    const checkOut1 = new Date(Date.now() + 86400000 * 5).toISOString();
    const res1 = await api()
      .post(`${base}/reservations`)
      .set(authed(owner))
      .send({
        establishmentId: estId,
        roomId,
        guestName: 'M. Kouassi',
        checkInDate: checkIn1,
        checkOutDate: checkOut1,
      });
    expect(res1.status).toBe(201);

    // 4. Chevauchement refusé (409)
    const overlapCheckIn = new Date(Date.now() + 86400000 * 3).toISOString();
    const overlapCheckOut = new Date(Date.now() + 86400000 * 6).toISOString();
    const resOverlap = await api()
      .post(`${base}/reservations`)
      .set(authed(owner))
      .send({
        establishmentId: estId,
        roomId,
        guestName: 'Mme Traoré',
        checkInDate: overlapCheckIn,
        checkOutDate: overlapCheckOut,
      });
    expect(resOverlap.status).toBe(409);

    // 5. Suppression bloquée tant qu'une réservation est active (409)
    const deleteBlocked = await api().delete(`${base}/rooms/${roomId}`).set(authed(owner));
    expect(deleteBlocked.status).toBe(409);
  });
});
