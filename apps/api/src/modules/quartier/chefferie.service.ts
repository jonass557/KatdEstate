import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import {
  ChefferieCommissionSettings,
  HouseSaleTransaction,
  HouseRentalRecord,
  LandSaleTransaction,
  ChefferieCertificate,
} from '../../models/chefferie.js';
import { GeoNeighborhood } from '../../models/quartier.js';
import { AppError } from '../../common/errors.js';
import {
  chefferieCommissionSettingsSchema,
  houseSaleTransactionInputSchema,
  houseRentalRecordInputSchema,
  landSaleTransactionInputSchema,
  issueCertificateInputSchema,
} from '@rentflow/shared';

/**
 * Vérifie si le service de gestion locative de la chefferie est actuellement dans sa plage horaire
 * Plage officielle : 05h00 - 22h00
 */
export function getRentalServiceHoursStatus(): {
  isOpen: boolean;
  openingTime: string;
  closingTime: string;
  currentServerTime: string;
  statusMessage: string;
} {
  const now = new Date();
  const currentHour = now.getHours();
  // Ouvert de 05h00 à 21h59 (fermeture à 22h00)
  const isOpen = currentHour >= 5 && currentHour < 22;

  const currentServerTime = `${String(currentHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    isOpen,
    openingTime: '05:00',
    closingTime: '22:00',
    currentServerTime,
    statusMessage: isOpen
      ? 'Service de gestion locative de la chefferie : OUVERT (05h00 - 22h00)'
      : 'Service de gestion locative de la chefferie : FERMÉ (Réouverture à 05h00)',
  };
}

/**
 * Récupère les taux de commission configurés pour un quartier (ou les valeurs par défaut)
 */
async function getEffectiveCommissionRates(organizationId: string, neighborhoodId: string) {
  const settings = await ChefferieCommissionSettings.findOne({ organizationId, neighborhoodId }).lean();
  return {
    houseSalePercent: settings?.houseSalePercent ?? 3,
    houseRentPercent: settings?.houseRentPercent ?? 10,
    landSalePercent: settings?.landSalePercent ?? 5,
  };
}

// ============================================================================
// 1. PARAMÈTRES DE COMMISSION DE LA CHEFFERIE
// ============================================================================

export async function getCommissionSettings(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const neighborhoodId = req.query.neighborhoodId as string;

  if (!neighborhoodId) {
    throw new AppError('VALIDATION_ERROR', 'Le paramètre neighborhoodId est requis.', 400);
  }

  const rates = await getEffectiveCommissionRates(organizationId, neighborhoodId);
  const settings = await ChefferieCommissionSettings.findOne({ organizationId, neighborhoodId }).lean();

  res.locals.data = {
    settings: settings ?? { neighborhoodId, ...rates },
    effectiveRates: rates,
    serviceHours: getRentalServiceHoursStatus(),
  };
}

export async function updateCommissionSettings(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const userId = res.locals.auth?.userId;
  const parsed = chefferieCommissionSettingsSchema.parse(req.body);

  const updated = await ChefferieCommissionSettings.findOneAndUpdate(
    { organizationId, neighborhoodId: parsed.neighborhoodId },
    {
      $set: {
        ...parsed,
        organizationId,
        updatedBy: userId,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  res.locals.data = {
    message: 'Pourcentages de commission de la chefferie mis à jour avec succès.',
    settings: updated,
  };
}

// ============================================================================
// 2. VENTES DE MAISONS
// ============================================================================

export async function recordHouseSale(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const userId = res.locals.auth?.userId;
  const parsed = houseSaleTransactionInputSchema.parse(req.body);

  const rates = await getEffectiveCommissionRates(organizationId, parsed.neighborhoodId);
  const commissionPercent = parsed.customCommissionPercent ?? rates.houseSalePercent;
  const commissionDueMinor = Math.round((parsed.salePriceMinor * commissionPercent) / 100);

  const paymentStatus =
    parsed.commissionPaidMinor >= commissionDueMinor
      ? 'PAID'
      : parsed.commissionPaidMinor > 0
        ? 'PARTIAL'
        : 'PENDING';

  const count = await HouseSaleTransaction.countDocuments({ organizationId });
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  const transactionNumber = `VST-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

  const transaction = await HouseSaleTransaction.create({
    ...parsed,
    organizationId,
    transactionNumber,
    formerOwner: {
      fullName: parsed.formerOwnerFullName,
      phone: parsed.formerOwnerPhone,
      nationalIdNumber: parsed.formerOwnerNationalId,
      address: parsed.formerOwnerAddress,
    },
    newBuyer: {
      fullName: parsed.newBuyerFullName,
      phone: parsed.newBuyerPhone,
      nationalIdNumber: parsed.newBuyerNationalId,
      address: parsed.newBuyerAddress,
    },
    commissionPercent,
    commissionDueMinor,
    commissionPaidMinor: parsed.commissionPaidMinor,
    paymentStatus,
    transactionDate: parsed.transactionDate ? new Date(parsed.transactionDate) : new Date(),
    recordedBy: userId,
    history: [
      {
        action: 'CREATION',
        performedBy: userId,
        date: new Date(),
        note: `Enregistrement officiel de la vente de maison ${transactionNumber}`,
      },
    ],
  });

  res.locals.data = {
    message: 'Vente de maison enregistrée avec succès auprès de la chefferie.',
    transaction,
  };
}

export async function listHouseSales(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const { neighborhoodId, blockId, paymentStatus } = req.query;

  const filter: Record<string, unknown> = { organizationId };
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (blockId) filter.blockId = blockId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const transactions = await HouseSaleTransaction.find(filter)
    .sort({ createdAt: -1 })
    .populate('recordedBy', 'name phone')
    .lean();

  res.locals.data = transactions;
}

// ============================================================================
// 3. LOCATIONS DE MAISONS (GESTION LOCATIVE CHEFFERIE)
// ============================================================================

export async function recordHouseRental(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const userId = res.locals.auth?.userId;
  const parsed = houseRentalRecordInputSchema.parse(req.body);

  const rates = await getEffectiveCommissionRates(organizationId, parsed.neighborhoodId);
  const commissionPercent = parsed.customCommissionPercent ?? rates.houseRentPercent;
  const commissionDueMinor = Math.round((parsed.rentAmountMinor * commissionPercent) / 100);

  const paymentStatus =
    parsed.commissionPaidMinor >= commissionDueMinor
      ? 'PAID'
      : parsed.commissionPaidMinor > 0
        ? 'PARTIAL'
        : 'PENDING';

  const count = await HouseRentalRecord.countDocuments({ organizationId });
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  const rentalNumber = `LOC-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

  const rental = await HouseRentalRecord.create({
    ...parsed,
    organizationId,
    rentalNumber,
    owner: {
      fullName: parsed.ownerFullName,
      phone: parsed.ownerPhone,
      nationalIdNumber: parsed.ownerNationalId,
    },
    tenant: {
      fullName: parsed.tenantFullName,
      phone: parsed.tenantPhone,
      profession: parsed.tenantProfession,
    },
    commissionPercent,
    commissionDueMinor,
    commissionPaidMinor: parsed.commissionPaidMinor,
    paymentStatus,
    startDate: new Date(parsed.startDate),
    endDate: parsed.endDate ? new Date(parsed.endDate) : undefined,
    recordedBy: userId,
    history: [
      {
        action: 'CREATION',
        performedBy: userId,
        date: new Date(),
        note: `Enregistrement du contrat de location ${rentalNumber}`,
      },
    ],
  });

  res.locals.data = {
    message: 'Location enregistrée avec succès auprès du service locatif de la chefferie.',
    rental,
    serviceStatus: getRentalServiceHoursStatus(),
  };
}

export async function listHouseRentals(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const { neighborhoodId, blockId, paymentStatus } = req.query;

  const filter: Record<string, unknown> = { organizationId };
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (blockId) filter.blockId = blockId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const rentals = await HouseRentalRecord.find(filter)
    .sort({ createdAt: -1 })
    .populate('recordedBy', 'name phone')
    .lean();

  res.locals.data = {
    rentals,
    serviceHours: getRentalServiceHoursStatus(),
  };
}

// ============================================================================
// 4. VENTES DE TERRAINS (TRANSACTIONS FONCIÈRES)
// ============================================================================

export async function recordLandSale(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const userId = res.locals.auth?.userId;
  const parsed = landSaleTransactionInputSchema.parse(req.body);

  const rates = await getEffectiveCommissionRates(organizationId, parsed.neighborhoodId);
  const commissionPercent = parsed.customCommissionPercent ?? rates.landSalePercent;
  const commissionDueMinor = Math.round((parsed.salePriceMinor * commissionPercent) / 100);

  const paymentStatus =
    parsed.commissionPaidMinor >= commissionDueMinor
      ? 'PAID'
      : parsed.commissionPaidMinor > 0
        ? 'PARTIAL'
        : 'PENDING';

  const count = await LandSaleTransaction.countDocuments({ organizationId });
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  const transactionNumber = `FON-${yearMonth}-${String(count + 1).padStart(4, '0')}`;

  const landSale = await LandSaleTransaction.create({
    ...parsed,
    organizationId,
    transactionNumber,
    initialOwner: {
      fullName: parsed.initialOwnerFullName,
      phone: parsed.initialOwnerPhone,
      nationalIdNumber: parsed.initialOwnerNationalId,
    },
    newBuyer: {
      fullName: parsed.newBuyerFullName,
      phone: parsed.newBuyerPhone,
      nationalIdNumber: parsed.newBuyerNationalId,
    },
    commissionPercent,
    commissionDueMinor,
    commissionPaidMinor: parsed.commissionPaidMinor,
    paymentStatus,
    transactionDate: parsed.transactionDate ? new Date(parsed.transactionDate) : new Date(),
    recordedBy: userId,
    history: [
      {
        action: 'CREATION',
        performedBy: userId,
        date: new Date(),
        note: `Enregistrement officiel de la transaction foncière ${transactionNumber}`,
      },
    ],
  });

  res.locals.data = {
    message: 'Vente de terrain enregistrée avec succès dans le registre foncier de la chefferie.',
    landSale,
  };
}

export async function listLandSales(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const { neighborhoodId, blockId, paymentStatus } = req.query;

  const filter: Record<string, unknown> = { organizationId };
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (blockId) filter.blockId = blockId;
  if (paymentStatus) filter.paymentStatus = paymentStatus;

  const landSales = await LandSaleTransaction.find(filter)
    .sort({ createdAt: -1 })
    .populate('recordedBy', 'name phone')
    .lean();

  res.locals.data = landSales;
}

// ============================================================================
// 5. SYSTÈME DE CERTIFICATION OFFICIELLE DE LA CHEFFERIE
// ============================================================================

export async function issueChefferieCertificate(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const userId = res.locals.auth?.userId;
  const parsed = issueCertificateInputSchema.parse(req.body);

  let transactionRecord: any = null;
  let transactionNumber = '';
  let cityId: any = null;
  let neighborhoodId: any = null;
  let blockId: any = null;
  let parties: any = null;
  let propertyDetails: any = null;
  let financialDetails: any = null;
  let operationDate = new Date();

  if (parsed.operationType === 'HOUSE_SALE') {
    transactionRecord = await HouseSaleTransaction.findOne({ _id: parsed.transactionId, organizationId });
    if (!transactionRecord) throw new AppError('NOT_FOUND', 'Transaction de vente de maison introuvable.', 404);
    transactionNumber = transactionRecord.transactionNumber;
    cityId = transactionRecord.cityId;
    neighborhoodId = transactionRecord.neighborhoodId;
    blockId = transactionRecord.blockId;
    parties = {
      partyA: transactionRecord.formerOwner.fullName,
      partyARole: 'Vendeur (Ancien propriétaire)',
      partyAPhone: transactionRecord.formerOwner.phone,
      partyB: transactionRecord.newBuyer.fullName,
      partyBRole: 'Acquéreur (Nouveau propriétaire)',
      partyBPhone: transactionRecord.newBuyer.phone,
    };
    propertyDetails = {
      description: transactionRecord.houseDescription,
      address: transactionRecord.address,
    };
    financialDetails = {
      transactionAmountMinor: transactionRecord.salePriceMinor,
      commissionPaidMinor: transactionRecord.commissionPaidMinor,
      currency: transactionRecord.currency,
    };
    operationDate = transactionRecord.transactionDate;
  } else if (parsed.operationType === 'HOUSE_RENTAL') {
    transactionRecord = await HouseRentalRecord.findOne({ _id: parsed.transactionId, organizationId });
    if (!transactionRecord) throw new AppError('NOT_FOUND', 'Dossier de location introuvable.', 404);
    transactionNumber = transactionRecord.rentalNumber;
    cityId = transactionRecord.cityId;
    neighborhoodId = transactionRecord.neighborhoodId;
    blockId = transactionRecord.blockId;
    parties = {
      partyA: transactionRecord.owner.fullName,
      partyARole: 'Bailleur (Propriétaire)',
      partyAPhone: transactionRecord.owner.phone,
      partyB: transactionRecord.tenant.fullName,
      partyBRole: 'Locataire',
      partyBPhone: transactionRecord.tenant.phone,
    };
    propertyDetails = {
      description: transactionRecord.houseDescription,
      address: transactionRecord.address,
    };
    financialDetails = {
      transactionAmountMinor: transactionRecord.rentAmountMinor,
      commissionPaidMinor: transactionRecord.commissionPaidMinor,
      currency: transactionRecord.currency,
    };
    operationDate = transactionRecord.startDate;
  } else if (parsed.operationType === 'LAND_SALE') {
    transactionRecord = await LandSaleTransaction.findOne({ _id: parsed.transactionId, organizationId });
    if (!transactionRecord) throw new AppError('NOT_FOUND', 'Transaction foncière introuvable.', 404);
    transactionNumber = transactionRecord.transactionNumber;
    cityId = transactionRecord.cityId;
    neighborhoodId = transactionRecord.neighborhoodId;
    blockId = transactionRecord.blockId;
    parties = {
      partyA: transactionRecord.initialOwner.fullName,
      partyARole: 'Vendeur (Cédant foncier)',
      partyAPhone: transactionRecord.initialOwner.phone,
      partyB: transactionRecord.newBuyer.fullName,
      partyBRole: 'Acquéreur (Bénéficiaire foncier)',
      partyBPhone: transactionRecord.newBuyer.phone,
    };
    propertyDetails = {
      description: `Parcelle de terrain (${transactionRecord.surfaceM2} m²)`,
      address: transactionRecord.locationText,
      surfaceM2: transactionRecord.surfaceM2,
      plotNumber: transactionRecord.plotNumber,
    };
    financialDetails = {
      transactionAmountMinor: transactionRecord.salePriceMinor,
      commissionPaidMinor: transactionRecord.commissionPaidMinor,
      currency: transactionRecord.currency,
    };
    operationDate = transactionRecord.transactionDate;
  }

  const count = await ChefferieCertificate.countDocuments({ organizationId });
  const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
  const certificateNumber = `CERT-KE-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
  const verificationCode = `KE-VFR-${randomBytes(6).toString('hex').toUpperCase()}`;

  const certificate = await ChefferieCertificate.create({
    organizationId,
    certificateNumber,
    operationType: parsed.operationType,
    transactionId: parsed.transactionId,
    transactionNumber,
    chefferieName: parsed.chefferieName,
    cityId,
    neighborhoodId,
    blockId,
    parties,
    propertyDetails,
    financialDetails,
    operationDate,
    issuedDate: new Date(),
    signatoryName: parsed.signatoryName,
    signatoryTitle: parsed.signatoryTitle,
    isSigned: true,
    signatureImageUrl: parsed.signatureImageUrl,
    isStamped: true,
    stampImageUrl: parsed.stampImageUrl,
    verificationCode,
    status: 'ISSUED',
    issuedBy: userId,
  });

  // Associer le certificat à la transaction d'origine
  transactionRecord.certificateId = certificate._id;
  transactionRecord.certificateNumber = certificateNumber;
  transactionRecord.history.push({
    action: 'CERTIFICATE_ISSUED',
    performedBy: userId,
    date: new Date(),
    note: `Délivrance officielle du certificat ${certificateNumber} (Code: ${verificationCode})`,
  });
  await transactionRecord.save();

  res.locals.data = {
    message: 'Certificat officiel de la chefferie délivré avec succès.',
    certificate,
  };
}

export async function listChefferieCertificates(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const { neighborhoodId, operationType } = req.query;

  const filter: Record<string, unknown> = { organizationId };
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (operationType) filter.operationType = operationType;

  const certificates = await ChefferieCertificate.find(filter)
    .sort({ createdAt: -1 })
    .populate('issuedBy', 'name phone')
    .lean();

  res.locals.data = certificates;
}

export async function verifyCertificatePublic(req: Request, res: Response): Promise<void> {
  const { code } = req.params;
  const certificate = await ChefferieCertificate.findOne({ verificationCode: code })
    .populate('neighborhoodId', 'name code')
    .populate('cityId', 'name country')
    .lean();

  if (!certificate) {
    throw new AppError('NOT_FOUND', 'Certificat introuvable ou code de vérification invalide.', 404);
  }

  res.locals.data = {
    verified: true,
    certificate,
  };
}

// ============================================================================
// 6. TABLEAU DE BORD DE SUIVI DE LA CHEFFERIE (KPIS & STATISTIQUES)
// ============================================================================

export async function getChefferieDashboardStats(req: Request, res: Response): Promise<void> {
  const organizationId = req.params.orgId;
  const neighborhoodId = req.query.neighborhoodId as string;

  const filter: Record<string, unknown> = { organizationId };
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;

  // 1. Maisons vendues
  const houseSales = await HouseSaleTransaction.find(filter).lean();
  const totalHousesSold = houseSales.length;
  const totalHousesSoldVolumeMinor = houseSales.reduce((acc, h) => acc + (h.salePriceMinor || 0), 0);
  const houseSalesCommissionsDueMinor = houseSales.reduce((acc, h) => acc + (h.commissionDueMinor || 0), 0);
  const houseSalesCommissionsPaidMinor = houseSales.reduce((acc, h) => acc + (h.commissionPaidMinor || 0), 0);

  // 2. Maisons en location
  const rentals = await HouseRentalRecord.find(filter).lean();
  const totalHousesRented = rentals.length;
  const totalRentalsVolumeMinor = rentals.reduce((acc, r) => acc + (r.rentAmountMinor || 0), 0);
  const rentalsCommissionsDueMinor = rentals.reduce((acc, r) => acc + (r.commissionDueMinor || 0), 0);
  const rentalsCommissionsPaidMinor = rentals.reduce((acc, r) => acc + (r.commissionPaidMinor || 0), 0);

  // 3. Terrains vendus
  const landSales = await LandSaleTransaction.find(filter).lean();
  const totalLandsSold = landSales.length;
  const totalLandsSoldVolumeMinor = landSales.reduce((acc, l) => acc + (l.salePriceMinor || 0), 0);
  const landSalesCommissionsDueMinor = landSales.reduce((acc, l) => acc + (l.commissionDueMinor || 0), 0);
  const landSalesCommissionsPaidMinor = landSales.reduce((acc, l) => acc + (l.commissionPaidMinor || 0), 0);

  // 4. Totaux consolidés
  const totalTransactionsCount = totalHousesSold + totalHousesRented + totalLandsSold;
  const totalTransactionsVolumeMinor =
    totalHousesSoldVolumeMinor + totalRentalsVolumeMinor + totalLandsSoldVolumeMinor;
  const totalCommissionsDueMinor =
    houseSalesCommissionsDueMinor + rentalsCommissionsDueMinor + landSalesCommissionsDueMinor;
  const totalCommissionsPaidMinor =
    houseSalesCommissionsPaidMinor + rentalsCommissionsPaidMinor + landSalesCommissionsPaidMinor;
  const totalCommissionsPendingMinor = totalCommissionsDueMinor - totalCommissionsPaidMinor;

  // 5. Certificats délivrés
  const totalCertificatesIssued = await ChefferieCertificate.countDocuments(filter);

  // 6. Historique récent
  const recentHouseSales = houseSales.slice(0, 5);
  const recentRentals = rentals.slice(0, 5);
  const recentLandSales = landSales.slice(0, 5);

  res.locals.data = {
    serviceHours: getRentalServiceHoursStatus(),
    kpis: {
      totalHousesSold,
      totalHousesSoldVolumeMinor,
      totalHousesRented,
      totalRentalsVolumeMinor,
      totalLandsSold,
      totalLandsSoldVolumeMinor,
      totalTransactionsCount,
      totalTransactionsVolumeMinor,
      totalCommissionsDueMinor,
      totalCommissionsPaidMinor,
      totalCommissionsPendingMinor,
      totalCertificatesIssued,
    },
    recentOperations: {
      houseSales: recentHouseSales,
      rentals: recentRentals,
      landSales: recentLandSales,
    },
  };
}
