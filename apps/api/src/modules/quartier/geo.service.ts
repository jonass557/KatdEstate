import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import { HttpError } from '../../common/errors.js';
import {
  GeoCity,
  GeoDistrict,
  GeoNeighborhood,
  GeoBlock,
  SectorAssignment,
} from '../../models/quartier.js';

// --- Territoires (Villes, Arrondissements, Quartiers, Blocs) ---

export async function listCities(req: Request, res: Response): Promise<void> {
  const cities = await GeoCity.find({ isActive: true }).sort({ name: 1 }).lean();
  res.locals.data = cities;
}

export async function createCity(req: Request, res: Response): Promise<void> {
  const city = await GeoCity.create(req.body);
  res.locals.data = city;
}

export async function listDistricts(req: Request, res: Response): Promise<void> {
  const { cityId } = req.query;
  const filter: Record<string, unknown> = {};
  if (cityId) filter.cityId = cityId;

  const districts = await GeoDistrict.find(filter).sort({ name: 1 }).lean();
  res.locals.data = districts;
}

export async function createDistrict(req: Request, res: Response): Promise<void> {
  const district = await GeoDistrict.create(req.body);
  res.locals.data = district;
}

export async function listNeighborhoods(req: Request, res: Response): Promise<void> {
  const { cityId, districtId } = req.query;
  const filter: Record<string, unknown> = {};
  if (cityId) filter.cityId = cityId;
  if (districtId) filter.districtId = districtId;

  const neighborhoods = await GeoNeighborhood.find(filter)
    .sort({ name: 1 })
    .populate('leaderId', 'name email phone')
    .lean();
  res.locals.data = neighborhoods;
}

export async function createNeighborhood(req: Request, res: Response): Promise<void> {
  const neighborhood = await GeoNeighborhood.create(req.body);
  res.locals.data = neighborhood;
}

export async function listBlocks(req: Request, res: Response): Promise<void> {
  const { neighborhoodId } = req.query;
  const filter: Record<string, unknown> = {};
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;

  const blocks = await GeoBlock.find(filter)
    .sort({ name: 1 })
    .populate('blockLeaderId', 'name email phone')
    .lean();
  res.locals.data = blocks;
}

export async function getBlockByToken(req: Request, res: Response): Promise<void> {
  const { token } = req.params;

  const block = await GeoBlock.findOne({ registrationToken: token })
    .populate({
      path: 'neighborhoodId',
      populate: { path: 'cityId' },
    })
    .populate('blockLeaderId', 'name phone')
    .lean();

  if (!block) {
    throw new HttpError(404, 'Lien ou QR code de bloc invalide ou expiré.');
  }

  res.locals.data = block;
}

export async function createBlock(req: Request, res: Response): Promise<void> {
  const registrationToken = randomBytes(12).toString('hex');
  const block = await GeoBlock.create({
    ...req.body,
    registrationToken,
  });
  res.locals.data = block;
}

// --- Affectation des Chefs de Quartier et Chefs de Bloc ---

export async function assignSectorLeader(req: Request, res: Response): Promise<void> {
  const assignedBy = req.user!.id;
  const { userId, role, cityId, districtId, neighborhoodId, blockId, notes, startDate, endDate } = req.body;

  // Clôture ou suspension des précédentes affectations actives pour ce secteur ou cet utilisateur
  if (role === 'BLOCK_LEADER' && blockId) {
    await SectorAssignment.updateMany(
      { blockId, status: 'ACTIVE' },
      { $set: { status: 'TRANSFERRED', endDate: new Date() } }
    );
    // Met à jour la référence sur le bloc
    await GeoBlock.findByIdAndUpdate(blockId, { blockLeaderId: userId });
  } else if (role === 'NEIGHBORHOOD_LEADER') {
    await SectorAssignment.updateMany(
      { neighborhoodId, role: 'NEIGHBORHOOD_LEADER', status: 'ACTIVE' },
      { $set: { status: 'TRANSFERRED', endDate: new Date() } }
    );
    await GeoNeighborhood.findByIdAndUpdate(neighborhoodId, { leaderId: userId });
  }

  const assignment = await SectorAssignment.create({
    userId,
    role,
    cityId,
    districtId,
    neighborhoodId,
    blockId,
    assignedBy,
    status: 'ACTIVE',
    startDate: startDate ? new Date(startDate) : new Date(),
    endDate: endDate ? new Date(endDate) : undefined,
    notes,
    history: [
      {
        action: 'ASSIGNED',
        performedBy: assignedBy,
        date: new Date(),
        note: `Affectation du rôle ${role} pour le secteur par le Super Admin.`,
      },
    ],
  });

  res.locals.data = assignment;
}

export async function listSectorAssignments(req: Request, res: Response): Promise<void> {
  const { neighborhoodId, blockId, status } = req.query;
  const filter: Record<string, unknown> = {};
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;
  if (blockId) filter.blockId = blockId;
  if (status) filter.status = status;

  const assignments = await SectorAssignment.find(filter)
    .sort({ createdAt: -1 })
    .populate('userId', 'name email phone role')
    .populate('neighborhoodId', 'name')
    .populate('blockId', 'name code')
    .lean();

  res.locals.data = assignments;
}

// Contrôle strict de frontière de secteur
export async function assertLeaderSectorAccess(
  userId: string,
  userRole: string,
  target: { neighborhoodId?: string; blockId?: string }
): Promise<void> {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return;

  if (userRole === 'BLOCK_LEADER' && target.blockId) {
    const isAssigned = await SectorAssignment.exists({
      userId,
      role: 'BLOCK_LEADER',
      blockId: target.blockId,
      status: 'ACTIVE',
    });
    if (!isAssigned) {
      throw new HttpError(403, 'Accès interdit : vous n’êtes pas le chef affecté à ce bloc.');
    }
  }

  if (userRole === 'NEIGHBORHOOD_LEADER' && target.neighborhoodId) {
    const isAssigned = await SectorAssignment.exists({
      userId,
      role: 'NEIGHBORHOOD_LEADER',
      neighborhoodId: target.neighborhoodId,
      status: 'ACTIVE',
    });
    if (!isAssigned) {
      throw new HttpError(403, 'Accès interdit : vous n’êtes pas le chef affecté à ce quartier.');
    }
  }
}
