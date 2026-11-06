import type { Request, Response } from 'express';
import { HttpError } from '../../common/errors.js';
import {
  GeoCity,
  GeoDistrict,
  GeoNeighborhood,
  GeoBlock,
  QuartierResidence,
  ResidentHousehold,
  CensusSubmission,
  IncidentReport,
  SectorAssignment,
} from '../../models/quartier.js';
import { getLeaderSubscription } from './quartier.quota.js';

// --- Dashboard Chef de Bloc ---

export async function getBlockLeaderDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { blockId: queryBlockId } = req.query;

  let block = null;
  if (queryBlockId) {
    block = await GeoBlock.findById(queryBlockId).populate('neighborhoodId');
  } else {
    block = await GeoBlock.findOne({ blockLeaderId: userId }).populate('neighborhoodId');
  }

  if (!block) {
    throw new HttpError(404, 'Aucun bloc attribué trouvé pour ce responsable.');
  }

  const blockId = block._id;

  const [
    totalResidences,
    totalDwellings,
    occupiedResidences,
    vacantResidences,
    pendingValidations,
    totalHouseholds,
    householdsAgg,
    recentSubmissions,
    recentIncidents,
    subscriptionInfo,
  ] = await Promise.all([
    QuartierResidence.countDocuments({ blockId, deletedAt: null }),
    QuartierResidence.aggregate([
      { $match: { blockId, deletedAt: null } },
      { $group: { _id: null, sum: { $sum: '$dwellingsCount' } } },
    ]),
    QuartierResidence.countDocuments({ blockId, occupancyStatus: 'OCCUPIED', deletedAt: null }),
    QuartierResidence.countDocuments({ blockId, occupancyStatus: 'VACANT', deletedAt: null }),
    CensusSubmission.countDocuments({ blockId, status: 'PENDING' }),
    ResidentHousehold.countDocuments({ blockId, isMovedOut: false }),
    ResidentHousehold.aggregate([
      { $match: { blockId, isMovedOut: false } },
      {
        $group: {
          _id: null,
          totalResidents: { $sum: '$householdSize' },
          totalMinors: { $sum: '$minorsCount' },
        },
      },
    ]),
    CensusSubmission.find({ blockId, status: 'PENDING' })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('residenceId')
      .populate('submittedBy', 'name phone')
      .lean(),
    IncidentReport.find({ blockId }).sort({ createdAt: -1 }).limit(5).lean(),
    getLeaderSubscription(userId),
  ]);

  const dwellingsCount = totalDwellings[0]?.sum || totalResidences;
  const residentsCount = householdsAgg[0]?.totalResidents || 0;
  const minorsCount = householdsAgg[0]?.totalMinors || 0;

  // Taux de recensement estimé (base moyenne 80-100 résidences par bloc)
  const estimatedTarget = 100;
  const censusCompletionRate = Math.min(100, Math.round((totalResidences / estimatedTarget) * 100));

  res.locals.data = {
    block: {
      _id: block._id,
      name: block.name,
      code: block.code,
      registrationToken: block.registrationToken,
      qrCodeUrl: `https://domora.immo/quartier/join/${block.registrationToken}`,
      neighborhoodName: (block.neighborhoodId as any)?.name,
    },
    kpis: {
      totalResidences,
      totalDwellings: dwellingsCount,
      occupiedResidences,
      vacantResidences,
      pendingValidations,
      totalHouseholds,
      totalResidents: residentsCount,
      totalMinors: minorsCount,
      censusCompletionRate,
    },
    recentSubmissions,
    recentIncidents,
    subscription: subscriptionInfo,
  };
}

// --- Dashboard Chef de Quartier ---

export async function getNeighborhoodLeaderDashboard(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { neighborhoodId: queryNeighId } = req.query;

  let neighborhood = null;
  if (queryNeighId) {
    neighborhood = await GeoNeighborhood.findById(queryNeighId).populate('cityId');
  } else {
    neighborhood = await GeoNeighborhood.findOne({ leaderId: userId }).populate('cityId');
  }

  if (!neighborhood) {
    throw new HttpError(404, 'Aucun quartier attribué trouvé pour ce responsable.');
  }

  const neighborhoodId = neighborhood._id;

  const [
    blocks,
    totalResidences,
    totalHouseholds,
    householdsAgg,
    pendingValidations,
    recentAlerts,
    subscriptionInfo,
  ] = await Promise.all([
    GeoBlock.find({ neighborhoodId }).populate('blockLeaderId', 'name phone').lean(),
    QuartierResidence.countDocuments({ neighborhoodId, deletedAt: null }),
    ResidentHousehold.countDocuments({ neighborhoodId, isMovedOut: false }),
    ResidentHousehold.aggregate([
      { $match: { neighborhoodId, isMovedOut: false } },
      { $group: { _id: null, totalResidents: { $sum: '$householdSize' } } },
    ]),
    CensusSubmission.countDocuments({
      blockId: { $in: (await GeoBlock.find({ neighborhoodId }, { _id: 1 })).map((b) => b._id) },
      status: 'PENDING',
    }),
    IncidentReport.find({ neighborhoodId }).sort({ createdAt: -1 }).limit(5).lean(),
    getLeaderSubscription(userId),
  ]);

  const activeLeadersCount = blocks.filter((b) => b.blockLeaderId).length;
  const unstartedBlocks = blocks.filter((b) => (b.stats?.totalResidences || 0) === 0);

  // Comparatif des blocs sans exposer les données privées des résidents
  const blocksComparison = blocks.map((b) => ({
    _id: b._id,
    name: b.name,
    code: b.code,
    leaderName: (b.blockLeaderId as any)?.name || 'Non attribué',
    totalResidences: b.stats?.totalResidences || 0,
    totalResidents: b.stats?.totalResidentsDeclared || 0,
    pendingValidations: b.stats?.pendingValidations || 0,
    coverageRate: Math.min(100, Math.round(((b.stats?.totalResidences || 0) / 100) * 100)),
  }));

  res.locals.data = {
    neighborhood: {
      _id: neighborhood._id,
      name: neighborhood.name,
      code: neighborhood.code,
      cityName: (neighborhood.cityId as any)?.name,
    },
    kpis: {
      totalBlocks: blocks.length,
      activeLeadersCount,
      unstartedBlocksCount: unstartedBlocks.length,
      totalResidences,
      totalHouseholds,
      totalResidents: householdsAgg[0]?.totalResidents || 0,
      pendingValidations,
      coverageRate:
        blocks.length > 0 ? Math.round((totalResidences / (blocks.length * 100)) * 100) : 0,
    },
    blocksComparison,
    recentAlerts,
    subscription: subscriptionInfo,
  };
}

// --- Super Admin DOMORA QUARTIER ---

export async function getSuperAdminQuartierStats(req: Request, res: Response): Promise<void> {
  const [
    totalCities,
    totalDistricts,
    totalNeighborhoods,
    totalBlocks,
    totalAssignments,
    totalResidences,
    totalHouseholds,
    householdsAgg,
    totalIncidents,
    activeIncidents,
  ] = await Promise.all([
    GeoCity.countDocuments({ isActive: true }),
    GeoDistrict.countDocuments(),
    GeoNeighborhood.countDocuments(),
    GeoBlock.countDocuments(),
    SectorAssignment.countDocuments({ status: 'ACTIVE' }),
    QuartierResidence.countDocuments({ deletedAt: null }),
    ResidentHousehold.countDocuments({ isMovedOut: false }),
    ResidentHousehold.aggregate([
      { $match: { isMovedOut: false } },
      { $group: { _id: null, totalResidents: { $sum: '$householdSize' } } },
    ]),
    IncidentReport.countDocuments(),
    IncidentReport.countDocuments({ status: { $in: ['NEW', 'VERIFYING', 'DISPATCHED'] } }),
  ]);

  res.locals.data = {
    territory: {
      totalCities,
      totalDistricts,
      totalNeighborhoods,
      totalBlocks,
      totalAssignments,
    },
    census: {
      totalResidences,
      totalHouseholds,
      totalResidents: householdsAgg[0]?.totalResidents || 0,
    },
    security: {
      totalIncidents,
      activeIncidents,
    },
  };
}
