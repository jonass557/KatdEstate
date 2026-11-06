import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import {
  QuartierResidence,
  QuartierDwelling,
  ResidentHousehold,
  CensusSubmission,
  GeoBlock,
  GeoNeighborhood,
  GeoCity,
} from '../../models/quartier.js';
import { assertLeaderSectorAccess } from './geo.service.js';
import { checkResidenceQuota } from './quartier.quota.js';

// Générateur d'identifiant DOMORA unique pour chaque résidence
async function generateUniqueResidenceDomoraId(blockId: string): Promise<string> {
  const block = await GeoBlock.findById(blockId).populate('neighborhoodId');
  const neighCode = (block?.neighborhoodId as any)?.code || 'QTR';
  const blockCode = block?.code || 'B01';
  const count = await QuartierResidence.countDocuments({ blockId });
  const serial = String(count + 1).padStart(4, '0');
  return `DOM-${neighCode}-${blockCode}-${serial}`.toUpperCase();
}

// Détection prédictive de doublons
export async function checkDuplicateResidence(blockId: string, address: string): Promise<boolean> {
  const cleanAddress = address.trim();
  const existing = await QuartierResidence.findOne({
    blockId,
    deletedAt: null,
    address: new RegExp(`^${cleanAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
  });
  return Boolean(existing);
}

// 1. Enregistrement direct par un habitant / résident (Self-registration)
export async function registerHouseholdResident(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  const {
    cityId,
    districtId,
    neighborhoodId,
    blockId,
    residenceId,
    dwellingId,
    address,
    landmark,
    buildingType = 'INDIVIDUAL_HOUSE',
    fullName,
    phone,
    email,
    householdSize = 1,
    minorsCount = 0,
    arrivalDate,
    emergencyContactName,
    emergencyContactPhone,
    consentAccepted,
  } = req.body;

  if (!consentAccepted) {
    throw new HttpError(400, 'Le consentement à la politique de confidentialité est obligatoire.');
  }

  let finalResidenceId = residenceId;

  // Si l'habitant déclare une nouvelle résidence non encore recensée
  if (!finalResidenceId) {
    if (!address) {
      throw new HttpError(400, 'L’adresse ou l’indication de localisation est requise.');
    }

    const isDuplicate = await checkDuplicateResidence(blockId, address);
    if (isDuplicate) {
      throw new HttpError(
        409,
        'Une résidence similaire existe déjà dans ce bloc avec cette adresse. Veuillez sélectionner la résidence existante ou contacter votre chef de bloc.',
      );
    }

    const residenceDomoraId = await generateUniqueResidenceDomoraId(blockId);
    const newResidence = await QuartierResidence.create({
      residenceDomoraId,
      cityId,
      districtId,
      neighborhoodId,
      blockId,
      buildingType,
      address,
      landmark,
      dwellingsCount: 1,
      occupancyStatus: 'OCCUPIED',
      censusStatus: 'PENDING',
      registeredBy: userId,
      registeredRole: 'RESIDENT',
    });
    finalResidenceId = newResidence._id;
  }

  // Création du foyer (données agrégées, aucun profil individuel pour les mineurs)
  const household = await ResidentHousehold.create({
    residenceId: finalResidenceId,
    dwellingId,
    blockId,
    neighborhoodId,
    headOfHouseholdId: userId,
    fullName,
    phone,
    email,
    householdSize,
    minorsCount,
    arrivalDate: arrivalDate ? new Date(arrivalDate) : new Date(),
    emergencyContact: emergencyContactName
      ? { name: emergencyContactName, phone: emergencyContactPhone }
      : undefined,
    consentAccepted: true,
  });

  // Soumission pour validation par le chef de bloc
  const submission = await CensusSubmission.create({
    residenceId: finalResidenceId,
    householdId: household._id,
    blockId,
    submittedBy: userId,
    submissionType: 'SELF_REGISTRATION',
    status: 'PENDING',
  });

  // Mise à jour des compteurs du bloc
  await GeoBlock.findByIdAndUpdate(blockId, {
    $inc: { 'stats.pendingValidations': 1 },
  });

  res.locals.data = {
    submission,
    household,
    message:
      'Votre résidence et votre foyer ont été enregistrés avec succès. Ils sont en attente de validation par votre chef de bloc.',
  };
}

// 2. Validation / Rejet d'un recensement par le Chef de Bloc
export async function validateCensusSubmission(req: Request, res: Response): Promise<void> {
  const leaderId = req.user!.id;
  const leaderRole = req.user!.role;
  const { id } = req.params;
  const { status, decisionReason } = req.body;

  const submission = await CensusSubmission.findById(id);
  if (!submission) {
    throw new HttpError(404, 'Demande de recensement introuvable.');
  }

  // Contrôle strict de frontière de bloc
  await assertLeaderSectorAccess(leaderId, leaderRole, { blockId: String(submission.blockId) });

  if (status === 'REJECTED' && (!decisionReason || !decisionReason.trim())) {
    throw new HttpError(400, 'Un motif est obligatoire en cas de rejet.');
  }

  submission.status = status;
  submission.decisionNote = decisionReason;
  submission.reviewedBy = leaderId;
  submission.reviewedAt = new Date();
  await submission.save();

  // Mise à jour de la résidence
  const newCensusStatus =
    status === 'VALIDATED' ? 'VALIDATED' : status === 'REJECTED' ? 'REJECTED' : 'TO_UPDATE';
  await QuartierResidence.findByIdAndUpdate(submission.residenceId, {
    censusStatus: newCensusStatus,
    validatedBy: leaderId,
    validatedAt: new Date(),
    rejectionReason: status === 'REJECTED' ? decisionReason : undefined,
  });

  // Mise à jour des stats du bloc
  if (status === 'VALIDATED') {
    const household = await ResidentHousehold.findById(submission.householdId);
    await GeoBlock.findByIdAndUpdate(submission.blockId, {
      $inc: {
        'stats.pendingValidations': -1,
        'stats.totalResidences': 1,
        'stats.occupiedResidences': 1,
        'stats.totalResidentsDeclared': household?.householdSize || 1,
      },
    });
  } else {
    await GeoBlock.findByIdAndUpdate(submission.blockId, {
      $inc: { 'stats.pendingValidations': -1 },
    });
  }

  res.locals.data = {
    submission,
    message: status === 'VALIDATED' ? 'Recensement validé avec succès.' : 'Demande mise à jour.',
  };
}

// 3. Enregistrement direct d'une résidence par le Chef de Bloc
export async function createResidenceByChef(req: Request, res: Response): Promise<void> {
  const leaderId = req.user!.id;
  const leaderRole = req.user!.role;
  const body = req.body;

  // Contrôle des quotas d'abonnement
  await checkResidenceQuota(leaderId);

  // Contrôle d'affectation
  await assertLeaderSectorAccess(leaderId, leaderRole, { blockId: body.blockId });

  // Détection des doublons
  const isDuplicate = await checkDuplicateResidence(body.blockId, body.address);
  if (isDuplicate) {
    throw new HttpError(409, 'Une résidence portant la même adresse existe déjà dans votre bloc.');
  }

  const residenceDomoraId = await generateUniqueResidenceDomoraId(body.blockId);

  const residence = await QuartierResidence.create({
    ...body,
    residenceDomoraId,
    censusStatus: 'VALIDATED', // Directement validé par le chef
    registeredBy: leaderId,
    registeredRole: 'BLOCK_LEADER',
    validatedBy: leaderId,
    validatedAt: new Date(),
  });

  await GeoBlock.findByIdAndUpdate(body.blockId, {
    $inc: {
      'stats.totalResidences': 1,
      'stats.occupiedResidences': body.occupancyStatus === 'OCCUPIED' ? 1 : 0,
      'stats.vacantResidences': body.occupancyStatus === 'VACANT' ? 1 : 0,
      'stats.totalDwellings': body.dwellingsCount || 1,
    },
  });

  res.locals.data = residence;
}

// 4. Liste des résidences d'un secteur
export async function listResidences(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { blockId, neighborhoodId, buildingType, occupancyStatus, censusStatus, q } = req.query;

  const filter: Record<string, unknown> = { deletedAt: null };

  if (blockId) filter.blockId = blockId;
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (buildingType) filter.buildingType = buildingType;
  if (occupancyStatus) filter.occupancyStatus = occupancyStatus;
  if (censusStatus) filter.censusStatus = censusStatus;

  if (q && typeof q === 'string') {
    const regex = new RegExp(q.trim(), 'i');
    filter.$or = [{ residenceDomoraId: regex }, { address: regex }, { landmark: regex }];
  }

  // Si chef de bloc, restreindre automatiquement à son secteur
  if (userRole === 'BLOCK_LEADER' && !blockId) {
    const myBlocks = await GeoBlock.find({ blockLeaderId: userId }, { _id: 1 });
    filter.blockId = { $in: myBlocks.map((b) => b._id) };
  }

  const residences = await QuartierResidence.find(filter)
    .sort({ createdAt: -1 })
    .populate('blockId', 'name code')
    .populate('neighborhoodId', 'name')
    .lean();

  res.locals.data = residences;
}

// 5. Liste des demandes de validation en attente pour un chef de bloc
export async function listPendingSubmissions(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const userRole = req.user!.role;
  const { blockId } = req.query;

  const filter: Record<string, unknown> = { status: 'PENDING' };

  if (blockId) {
    filter.blockId = blockId;
  } else if (userRole === 'BLOCK_LEADER') {
    const myBlocks = await GeoBlock.find({ blockLeaderId: userId }, { _id: 1 });
    filter.blockId = { $in: myBlocks.map((b) => b._id) };
  }

  const submissions = await CensusSubmission.find(filter)
    .sort({ createdAt: -1 })
    .populate('residenceId')
    .populate('householdId')
    .populate('blockId', 'name code')
    .populate('submittedBy', 'name email phone')
    .lean();

  res.locals.data = submissions;
}

// 6. Signalement de déménagement par un habitant
export async function declareMoveOut(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { householdId } = req.body;

  const household = await ResidentHousehold.findOne({
    _id: householdId,
    headOfHouseholdId: userId,
  });
  if (!household) {
    throw new HttpError(404, 'Foyer introuvable ou non autorisé.');
  }

  household.isMovedOut = true;
  household.movedOutDate = new Date();
  await household.save();

  // Décrémente les statistiques du bloc
  await GeoBlock.findByIdAndUpdate(household.blockId, {
    $inc: { 'stats.totalResidentsDeclared': -household.householdSize },
  });

  res.locals.data = {
    message: 'Votre déménagement a bien été enregistré. Merci de votre civisme.',
  };
}
