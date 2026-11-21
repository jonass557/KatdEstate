import { beforeEach, describe, expect, it } from 'vitest';
import { toGeoJsonPolygon } from '@rentflow/shared';
import {
  createAdminSupportTicket,
  createMeubleClientStay,
  createScheduledVisit,
  createSubscriptionPlan,
  createUserPropertyOrder,
  creditOwnerQuittanceFromDirectPayment,
  deleteCustomMarketplaceListing,
  deleteSubscriptionPlan,
  deleteUserSubscription,
  depositToTenantWallet,
  dispatchExpirationNotifications,
  estimatePropertyPriceAI,
  getAdminNotificationApiConfig,
  getAdminSupportTickets,
  getCustomMarketplaceListings,
  getListingMetrics,
  getLocalIkeepayConfig,
  getMeubleClientStays,
  getNotificationDispatchLogs,
  getOwnerQuittanceWallet,
  getOwnerRentWallet,
  getRegisteredMeubles,
  getScheduledVisits,
  getStoredNeighborhoods,
  getSubscriptionPlans,
  getTenantWallet,
  getUserPropertyOrders,
  getUserSubscriptions,
  incrementListingMetric,
  markMeubleStayCompleted,
  replyToAdminSupportTicket,
  saveAdminNotificationApiConfig,
  saveCustomMarketplaceListings,
  saveLocalIkeepayConfig,
  saveNeighborhoodGeo,
  saveRegisteredMeuble,
  toggleUserSubscriptionStatus,
  transferFromTenantWalletToOwner,
  updateCustomMarketplaceListing,
  updateScheduledVisitStatus,
  updateSubscriptionPlan,
  upsertUserSubscription,
} from './katdestate-store';

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true });
  Object.defineProperty(globalThis, 'localStorage', { value: mockStorage, configurable: true });
}

describe('Audit complet KatdEstate — Parcours de bout en bout', () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  it('1. Gestion des abonnements Super Admin & souscriptions utilisateurs', () => {
    const defaultPlans = getSubscriptionPlans();
    expect(defaultPlans.length).toBe(3);
    expect(defaultPlans.map((p) => p.roleKey)).toEqual([
      'AGENT',
      'INDEPENDENT_OWNER',
      'NEIGHBORHOOD_LEADER',
    ]);

    const created = createSubscriptionPlan({
      roleKey: 'BLOCK_LEADER',
      roleLabel: 'Chef de Bloc',
      name: 'Plan Chef de Bloc Test',
      priceMinor: 10000,
      currency: 'FCFA',
      periodLabel: 'par mois',
      features: ['Gestion des propriétaires'],
      isActive: true,
    });
    expect(getSubscriptionPlans().some((p) => p._id === created._id)).toBe(true);

    updateSubscriptionPlan(created._id, { priceMinor: 12000 });
    expect(getSubscriptionPlans().find((p) => p._id === created._id)?.priceMinor).toBe(12000);

    const sub = upsertUserSubscription({
      email: 'indep@katdestate.immo',
      fullName: 'Propriétaire Indépendant Test',
      role: 'INDEPENDENT_OWNER',
      planId: defaultPlans[1]!._id,
      planName: defaultPlans[1]!.name,
      amountPaid: 15000,
      paymentRef: 'REF_TEST_1',
      status: 'ACTIVE',
    });
    expect(getUserSubscriptions().length).toBe(1);

    toggleUserSubscriptionStatus(sub._id, 'DISABLED');
    expect(getUserSubscriptions()[0]?.status).toBe('DISABLED');

    deleteUserSubscription(sub._id);
    expect(getUserSubscriptions().length).toBe(0);

    deleteSubscriptionPlan(created._id);
    expect(getSubscriptionPlans().length).toBe(3);
  });

  it('2. Publication Marketplace multi-images (upload base64), statut Occupé et suppression', () => {
    saveCustomMarketplaceListings([
      {
        _id: 'lst-1',
        title: 'Villa Duplex Cocody',
        description: 'Belle villa',
        category: 'VILLA',
        propertyType: 'VILLA',
        transactionType: 'SALE',
        priceMinor: 85000000,
        currency: 'FCFA',
        billingFrequency: 'TOTAL',
        location: { city: 'Abidjan', district: 'Cocody', address: 'Rue 1', latitude: 5.36, longitude: -3.99 },
        photos: [
          { url: 'data:image/jpeg;base64,AAA', isPrimary: true },
          { url: 'data:image/jpeg;base64,BBB', isPrimary: false },
        ],
        workflowStatus: 'PUBLIE',
        availabilityStatus: 'AVAILABLE',
      },
    ]);

    expect(getCustomMarketplaceListings()[0]?.photos.length).toBe(2);

    updateCustomMarketplaceListing('lst-1', { availabilityStatus: 'OCCUPIED' });
    expect(getCustomMarketplaceListings()[0]?.availabilityStatus).toBe('OCCUPIED');

    deleteCustomMarketplaceListing('lst-1');
    expect(getCustomMarketplaceListings().length).toBe(0);
  });

  it('3. Gestion des meublés, clients occupants, notifications (Email/SMS/Appel) & APIs Admin', async () => {
    const meuble = saveRegisteredMeuble({
      ownerEmail: 'indep@katdestate.immo',
      title: 'Studio Meublé Riviera',
      meubleType: 'STUDIO_MEUBLE',
      dailyRate: 25000,
      city: 'Abidjan',
      district: 'Riviera',
      address: 'Carrefour 2',
    });
    expect(getRegisteredMeubles().length).toBe(1);

    saveAdminNotificationApiConfig({
      sms: { enabled: true, provider: 'Orange SMS', apiUrl: '', apiKey: 'k1', apiSecret: 's1', senderId: 'Katd' },
      call: {
        enabled: true,
        provider: 'Twilio Voice',
        apiUrl: '',
        apiKey: 'k2',
        apiSecret: 's2',
        callerNumber: '+22507000000',
        voiceMessageTemplate: 'Expiration {clientName}',
      },
      email: {
        enabled: true,
        provider: 'Resend',
        apiUrl: '',
        apiKey: 'k3',
        fromEmail: 'noreply@katdestate.immo',
        fromName: 'KatdEstate',
      },
      updatedAt: new Date().toISOString(),
    });
    expect(getAdminNotificationApiConfig().sms.senderId).toBe('Katd');

    const stay = createMeubleClientStay({
      ownerEmail: 'indep@katdestate.immo',
      ownerPhone: '+22507000001',
      meubleId: meuble._id,
      meubleTitle: meuble.title,
      meubleType: 'STUDIO_MEUBLE',
      clientName: 'Client Test',
      clientPhone: '+22505050505',
      durationValue: 2,
      durationUnit: 'DAYS',
      durationLabel: '2 jour(s)',
      checkInDate: '2026-11-20',
      checkInTime: '14:00',
      checkOutDate: '2026-11-22',
      checkOutTime: '12:00',
      checkInIso: new Date(Date.now() - 3600 * 1000).toISOString(),
      checkOutIso: new Date(Date.now() + 3600 * 1000).toISOString(),
      amountPaid: 50000,
      notifyChannels: ['EMAIL', 'SMS', 'CALL'],
    });
    expect(getMeubleClientStays().length).toBe(1);

    const logs = await dispatchExpirationNotifications(stay);
    expect(logs.length).toBe(3);
    expect(getNotificationDispatchLogs().length).toBe(3);

    markMeubleStayCompleted(stay._id);
    expect(getMeubleClientStays()[0]?.status).toBe('COMPLETED');
  });

  it('4. Visites programmées, commandes utilisateur, métriques & support bidirectionnel', () => {
    incrementListingMetric('lst-9', 'views');
    incrementListingMetric('lst-9', 'inquiries');

    const visit = createScheduledVisit({
      listingId: 'lst-9',
      listingTitle: 'Appartement Marcory',
      listingCategory: 'APPARTEMENT',
      ownerEmail: 'agent@katdestate.immo',
      ownerName: 'Agent Pro',
      visitorName: 'Visiteur A',
      visitorEmail: 'visiteur@katdestate.immo',
      visitorPhone: '+22501020304',
      scheduledDate: '2026-11-25',
      scheduledTime: '10:30',
    });
    expect(getScheduledVisits().length).toBe(1);
    expect(getListingMetrics()['lst-9']?.visits).toBe(1);

    updateScheduledVisitStatus(visit._id, 'CONFIRMED');
    expect(getScheduledVisits()[0]?.status).toBe('CONFIRMED');

    createUserPropertyOrder({
      userEmail: 'visiteur@katdestate.immo',
      userName: 'Visiteur A',
      listingId: 'lst-9',
      listingTitle: 'Appartement Marcory',
      listingCategory: 'APPARTEMENT',
      ownerName: 'Agent Pro',
      priceMinor: 250000,
      currency: 'FCFA',
      orderType: 'VISITE',
      latitude: 5.3,
      longitude: -3.98,
    });
    expect(getUserPropertyOrders().length).toBe(1);

    const ticket = createAdminSupportTicket({
      senderEmail: 'agent@katdestate.immo',
      senderName: 'Agent Pro',
      senderRole: 'AGENT',
      subject: 'Problème GPS',
      category: 'TECHNIQUE',
      message: 'Besoin aide',
    });
    replyToAdminSupportTicket(ticket._id, {
      senderRole: 'ADMIN',
      senderName: 'Super Admin',
      message: 'Problème résolu !',
    });
    expect(getAdminSupportTickets()[0]?.status).toBe('REPLIED');
    expect(getAdminSupportTickets()[0]?.replies.length).toBe(2);
  });

  it('5. Estimation du prix IA, Portefeuilles Locataire/Propriétaire, Carto Quartier & Ikeepay', () => {
    const est = estimatePropertyPriceAI({
      city: 'Abidjan',
      district: 'Cocody Riviera',
      category: 'STUDIO_MEUBLE_JOURNALIER',
      transactionType: 'DAILY_MEUBLE',
      surfaceM2: 40,
      bedrooms: 1,
      bathrooms: 1,
      standing: 'HAUT_STANDING',
      amenities: ['Climatisation', 'Wifi Fibre'],
    });
    expect(est.estimatedPrice).toBeGreaterThan(0);
    expect(est.maxPrice).toBeGreaterThanOrEqual(est.estimatedPrice);

    depositToTenantWallet('ten@katdestate.immo', 150000, 'Wave');
    transferFromTenantWalletToOwner({
      tenantKey: 'ten@katdestate.immo',
      tenantId: 'ten-1',
      tenantName: 'Locataire Test',
      propertyName: 'Résidence Test',
      unitName: 'Porte 1',
      amount: 100000,
      category: 'RENT',
      nature: 'Loyer Novembre 2026',
    });
    expect(getOwnerRentWallet().balance).toBeGreaterThanOrEqual(100000);
    expect(getTenantWallet('ten@katdestate.immo').balance).toBe(250000);

    const beforeQuit = getOwnerQuittanceWallet().balance;
    creditOwnerQuittanceFromDirectPayment({
      tenantKey: 'ten@katdestate.immo',
      tenantId: 'ten-1',
      tenantName: 'Locataire Test',
      propertyName: 'Résidence Test',
      unitName: 'Porte 1',
      amount: 18500,
      nature: 'Facture Eau SODECI',
      method: 'Orange Money',
      quittanceId: 'q-1',
    });
    expect(getOwnerQuittanceWallet().balance).toBe(beforeQuit + 18500);

    const poly = toGeoJsonPolygon([
      { lat: 4.58, lng: 9.56 },
      { lat: 4.59, lng: 9.56 },
      { lat: 4.59, lng: 9.57 },
      { lat: 4.58, lng: 9.57 },
    ]);
    saveNeighborhoodGeo({
      id: 'neigh-mbanga',
      name: 'Mbanga Centre',
      city: 'Mbanga',
      country: 'Cameroun',
      boundary: poly,
      updatedAt: new Date().toISOString(),
    });
    expect(getStoredNeighborhoods().some((n) => n.id === 'neigh-mbanga')).toBe(true);

    saveLocalIkeepayConfig({
      publicKey: 'pk_test',
      secretKey: 'sk_test',
      webhookSecret: 'wh_test',
      environment: 'LIVE',
      isActive: true,
    });
    expect(getLocalIkeepayConfig().secretKey).toBe('sk_test');
  });
});
