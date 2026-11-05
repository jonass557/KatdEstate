import { connectDatabase, disconnectDatabase } from '../db/connection.js';
import { loadConfig } from '../config/index.js';
import { loadDotEnvFiles } from '../config/dotenv.js';
import { hashPassword } from '../common/password.js';
import { User, Organization, Membership } from '../models/identity.js';
import { Property, Unit } from '../models/property.js';
import { Listing, AgentProfile } from '../models/marketplace.js';
import { GeoCity, GeoDistrict, GeoNeighborhood, GeoBlock, SectorAssignment } from '../models/quartier.js';
import { ChefferieCommissionSettings } from '../models/chefferie.js';
import { MarketingSettings } from '../models/marketing.js';
import { IkeepayConfig } from '../models/payment-gateway.js';

async function seed() {
  loadDotEnvFiles();
  const config = loadConfig();

  console.log('Connecting to MongoDB Atlas...');
  await connectDatabase({
    uri: config.database.uri,
    serverSelectionTimeoutMs: 10000,
  });
  console.log('✅ Connected to MongoDB Atlas');

  // 1. Organisation principale
  let org = await Organization.findOne({ slug: 'katdestate-global' });
  if (!org) {
    org = await Organization.create({
      name: 'KatdEstate Global',
      slug: 'katdestate-global',
      country: 'CI',
      currency: 'XOF',
      status: 'ACTIVE',
    });
    console.log('Created Organization: KatdEstate Global');
  }

  const defaultPassword = 'Password123!';
  const passwordHash = await hashPassword(defaultPassword);

  // 2. Utilisateurs de test pour CHAQUE rôle
  const testUsers = [
    {
      emailNormalized: 'admin@katdestate.immo',
      displayName: 'Valdès Administrateur',
      platformRole: 'SUPER_ADMIN',
      orgRole: 'ADMIN',
    },
    {
      emailNormalized: 'proprietaire@katdestate.immo',
      displayName: 'Koffi Propriétaire',
      orgRole: 'OWNER',
    },
    {
      emailNormalized: 'locataire@katdestate.immo',
      displayName: 'Amadou Locataire',
      orgRole: 'TENANT',
    },
    {
      emailNormalized: 'agent@katdestate.immo',
      displayName: 'Marc Agent Immobilier',
      orgRole: 'AGENT',
    },
    {
      emailNormalized: 'chef.quartier@katdestate.immo',
      displayName: 'Nanan Kouassi (Chef de Quartier & Chefferie)',
      orgRole: 'ADMIN', // Ou accès quartier
    },
    {
      emailNormalized: 'chef.bloc@katdestate.immo',
      displayName: 'Ibrahim Chef de Bloc',
      orgRole: 'ADMIN',
    },
    {
      emailNormalized: 'resident@katdestate.immo',
      displayName: 'Fatou Résidente',
      orgRole: 'TENANT',
    },
  ];

  const createdUserMap: Record<string, any> = {};

  for (const u of testUsers) {
    let user = await User.findOne({ emailNormalized: u.emailNormalized });
    if (!user) {
      user = await User.create({
        emailNormalized: u.emailNormalized,
        displayName: u.displayName,
        passwordHash,
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
        platformRole: u.platformRole,
      });
      console.log(`Created user: ${u.emailNormalized} (${u.orgRole || u.platformRole})`);
    } else {
      user.passwordHash = passwordHash;
      user.status = 'ACTIVE';
      if (u.platformRole) user.platformRole = u.platformRole as any;
      await user.save();
    }
    createdUserMap[u.emailNormalized] = user;

    // Membership dans KatdEstate Global
    await Membership.findOneAndUpdate(
      { organizationId: org._id, userId: user._id },
      {
        $set: {
          role: u.orgRole || 'TENANT',
          status: 'ACTIVE',
        },
      },
      { upsert: true },
    );
  }

  // 3. Profil Agent Immobilier
  const agentUser = createdUserMap['agent@katdestate.immo'];
  if (agentUser) {
    await AgentProfile.findOneAndUpdate(
      { userId: agentUser._id },
      {
        $set: {
          organizationId: org._id,
          firstName: 'Marc',
          lastName: 'Yao',
          phone: '+225 07 11 22 33 44',
          email: 'agent@katdestate.immo',
          city: 'Abidjan',
          country: 'CI',
          activityZone: 'Cocody, Marcory, Plateau',
          bio: 'Agent immobilier agréé KatdEstate avec plus de 8 ans d’expérience dans l’immobilier résidentiel et commercial de prestige.',
          experienceYears: 8,
          specialties: ['Villas de luxe', 'Terrains titrés', 'Appartements haut standing'],
          agencyName: 'Kadt Prestige Immobilier',
          agentType: 'INDEPENDENT',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
          rating: 4.9,
          reviewCount: 38,
          activeSubscriptionPlan: 'AGENT_PRO',
        },
      },
      { upsert: true },
    );
  }

  // 4. Hiérarchie Quartier & Chefferie
  let city = await GeoCity.findOne({ name: 'Abidjan' });
  if (!city) {
    city = await GeoCity.create({
      name: 'Abidjan',
      region: 'Lagunes',
      country: 'CI',
      coordinates: { latitude: 5.36, longitude: -4.0083 },
      isActive: true,
    });
  }

  let district = await GeoDistrict.findOne({ cityId: city._id, name: 'Cocody' });
  if (!district) {
    district = await GeoDistrict.create({
      cityId: city._id,
      name: 'Cocody',
      code: 'COC',
    });
  }

  let neighborhood = await GeoNeighborhood.findOne({ cityId: city._id, name: 'Riviera Palmeraie' });
  if (!neighborhood) {
    neighborhood = await GeoNeighborhood.create({
      cityId: city._id,
      districtId: district._id,
      name: 'Riviera Palmeraie',
      code: 'RIV-PALM',
      isActive: true,
    });
  }

  let block = await GeoBlock.findOne({ neighborhoodId: neighborhood._id, code: 'BLOC-A' });
  if (!block) {
    block = await GeoBlock.create({
      neighborhoodId: neighborhood._id,
      name: 'Bloc A - Les Jardins de la Palmeraie',
      code: 'BLOC-A',
      description: 'Zone résidentielle principale avec accès sécurisé',
      registrationToken: 'PALM-BLOC-A-ENROLL-2026',
    });
  }

  // Commissions Chefferie
  await ChefferieCommissionSettings.findOneAndUpdate(
    { neighborhoodId: neighborhood._id },
    {
      $set: {
        organizationId: org._id,
        houseSaleRatePercent: 5,
        houseRentalRatePercent: 10,
        landSaleRatePercent: 5,
        openingTime: '05:00',
        closingTime: '22:00',
        notes: 'Barème officiel fixé par la Chefferie Traditionnelle de Riviera Palmeraie',
      },
    },
    { upsert: true },
  );

  // Affectation des chefs de secteur
  const chefQuartier = createdUserMap['chef.quartier@katdestate.immo'];
  if (chefQuartier) {
    await SectorAssignment.findOneAndUpdate(
      { userId: chefQuartier._id, neighborhoodId: neighborhood._id },
      {
        $set: {
          organizationId: org._id,
          role: 'NEIGHBORHOOD_LEADER',
          cityId: city._id,
          status: 'ACTIVE',
          startDate: new Date(),
        },
      },
      { upsert: true },
    );
  }

  const chefBloc = createdUserMap['chef.bloc@katdestate.immo'];
  if (chefBloc) {
    await SectorAssignment.findOneAndUpdate(
      { userId: chefBloc._id, blockId: block._id },
      {
        $set: {
          organizationId: org._id,
          role: 'BLOCK_LEADER',
          cityId: city._id,
          neighborhoodId: neighborhood._id,
          status: 'ACTIVE',
          startDate: new Date(),
        },
      },
      { upsert: true },
    );
  }

  // 5. Propriétés et Listings Marketplace
  const proprietaire = createdUserMap['proprietaire@katdestate.immo'];

  const seedListings = [
    {
      title: 'Superbe Villa Duplex 6 Pièces avec Piscine',
      description: 'Magnifique villa contemporaine située au cœur de la Riviera Golf. Finitions italiennes, grand séjour lumineux, cuisine équipée, piscine privée, groupe électrogène et sécurité 24/7.',
      category: 'RESIDENTIAL',
      propertyType: 'VILLA',
      transactionType: 'SALE',
      priceMinor: 285000000,
      currency: 'XOF',
      location: { country: 'CI', city: 'Abidjan', district: 'Cocody Riviera Golf', address: 'Rue des Ambassades' },
      surfaceM2: 450,
      bedrooms: 5,
      bathrooms: 6,
      roomsCount: 7,
      floorsCount: 2,
      condition: 'NEW',
      isTitled: true,
      landTitleNumber: 'TF N° 45892 / BINGERVILLE',
      amenities: ['Piscine', 'Jardin', 'Garage 3 Véhicules', 'Climatisation', 'Groupe électrogène', 'Sécurité 24/7'],
      photos: [
        { url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80', isPrimary: true },
        { url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80', isPrimary: false },
      ],
      status: 'PUBLISHED',
      isVerified: true,
      isFeatured: true,
    },
    {
      title: 'Terrain Viabilisé & Titré 600m² avec ACD',
      description: 'Parcelle d’angle idéalement située à Bingerville Nouvelle Ville. Zone résidentielle en plein essor, terrain plat, prêt à bâtir. Document officiel : Arrêté de Concession Définitive (ACD).',
      category: 'LAND',
      propertyType: 'LAND_RESIDENTIAL',
      transactionType: 'SALE',
      priceMinor: 42000000,
      currency: 'XOF',
      location: { country: 'CI', city: 'Abidjan', district: 'Bingerville', address: 'Zone Résidentielle Akouai' },
      surfaceM2: 600,
      condition: 'NEW',
      isTitled: true,
      landTitleNumber: 'ACD N° 2026-0814-MINUH',
      amenities: ['Accès bitumé', 'Réseau Eau CIE/SODECI', 'Borne OGE', 'Terrain clôturé'],
      photos: [
        { url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80', isPrimary: true },
      ],
      status: 'PUBLISHED',
      isVerified: true,
      isFeatured: true,
    },
    {
      title: 'Appartement Haut Standing 4 Pièces Meublé',
      description: 'Appartement spacieux avec vue panoramique sur la lagune. Salon cathédrale, 3 suites parentales, ascenseur, salle de sport au sous-sol et parking sous-terrain.',
      category: 'RESIDENTIAL',
      propertyType: 'APARTMENT',
      transactionType: 'RENT',
      priceMinor: 1400000,
      currency: 'XOF',
      location: { country: 'CI', city: 'Abidjan', district: 'Marcory Zone 4', address: 'Boulevard de Marseille' },
      surfaceM2: 180,
      bedrooms: 3,
      bathrooms: 3,
      roomsCount: 4,
      condition: 'EXCELLENT',
      isTitled: true,
      amenities: ['Vue lagune', 'Ascenseur', 'Salle de fitness', 'Fibre optique', 'Gardiennage'],
      photos: [
        { url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', isPrimary: true },
      ],
      status: 'PUBLISHED',
      isVerified: true,
      isFeatured: true,
    },
    {
      title: 'Immeuble R+3 de Rapport — 8 Logements',
      description: 'Excellent investissement locatif avec rendement immédiat de 11% annuel. 8 appartements de type F3 occupés à 100% avec baux en règle et compteurs divisionnaires.',
      category: 'COMMERCIAL',
      propertyType: 'BUILDING',
      transactionType: 'SALE',
      priceMinor: 490000000,
      currency: 'XOF',
      location: { country: 'SN', city: 'Dakar', district: 'Almadies', address: 'Route des Almadies' },
      surfaceM2: 720,
      roomsCount: 24,
      floorsCount: 4,
      condition: 'EXCELLENT',
      isTitled: true,
      landTitleNumber: 'TF N° 18920 / DAKAR',
      amenities: ['100% Occupé', 'Compteurs individuels', 'Citerne de réserve 5000L', 'Revenus garantis'],
      photos: [
        { url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', isPrimary: true },
      ],
      status: 'PUBLISHED',
      isVerified: true,
      isFeatured: true,
    },
  ];

  for (const item of seedListings) {
    await Listing.findOneAndUpdate(
      { title: item.title },
      {
        $set: {
          ...item,
          organizationId: org._id,
          publisherId: proprietaire?._id,
          publisherRole: 'OWNER',
        },
      },
      { upsert: true },
    );
  }
  console.log('✅ Seeded 4 premium Marketplace listings');

  // 6. Paramètres Marketing (Bannières défilantes & Contacts)
  await MarketingSettings.findOneAndUpdate(
    {},
    {
      $set: {
        organizationId: org._id,
        tickerBanners: [
          { text: '👑 Chefferie : Service de gestion locative ouvert tous les jours de 05h00 à 22h00', tag: 'OFFICIEL', isActive: true },
          { text: '✨ Terrains titrés avec ACD garantis et vérifiés disponibles à Cocody, Bingerville et Almadies', tag: 'FONCIER', isActive: true },
          { text: '💳 Encaissement Mobile Money 100% automatisé via Orange Money, MTN, Wave & Moov avec Ikeepay', tag: 'PAIEMENT', isActive: true },
          { text: '🛡️ Sécurité de Quartier : Enrôlement par QR code et signalements d’incidents confidentiels actifs', tag: 'COMMUNAUTÉ', isActive: true },
        ],
        contactInfo: {
          email: 'contact@katdestate.immo',
          phone: '+225 07 00 00 00 00',
          whatsapp: '+225 07 00 00 00 00',
          address: 'Siège KatdEstate : Abidjan Cocody Riviera Palmeraie & Dakar Plateau',
          openingHours: 'Lundi - Samedi : 08h00 - 19h00 (Urgences 24/7)',
          supportNote: 'Support téléphonique et assistance chefferie disponible sans interruption.',
        },
      },
    },
    { upsert: true },
  );

  // 7. Passerelle Ikeepay par défaut
  await IkeepayConfig.findOneAndUpdate(
    { organizationId: org._id },
    {
      $set: {
        publicKey: 'ikp_pub_live_katdestate_001',
        secretKey: 'ikp_sec_live_9a8b7c6d5e4f3a2b1c',
        environment: 'LIVE',
        isActive: true,
        webhookSecret: 'ikp_whsec_secret_signature_katdestate',
      },
    },
    { upsert: true },
  );

  console.log('\n======================================================');
  console.log('🎉 SEED KATDESTATE RÉUSSI AVEC SUCCÈS SUR ATLAS !');
  console.log('======================================================');
  console.log('Mot de passe universel de test : Password123!\n');
  console.log('LISTE DES IDENTIFIANTS PAR RÔLE :');
  testUsers.forEach((u) => {
    console.log(`- [${u.orgRole || u.platformRole}] : ${u.emailNormalized} / ${defaultPassword}`);
  });
  console.log('======================================================\n');

  await disconnectDatabase();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
