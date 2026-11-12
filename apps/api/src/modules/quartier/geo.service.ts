import type { Request, Response } from 'express';
import type { HydratedDocument } from 'mongoose';
import { randomBytes } from 'node:crypto';
import {
  fromGeoJsonBoundary,
  isPolygonInsidePolygon,
  doPolygonsOverlap,
  validatePolygonGeometry,
  type GeoJsonBoundary,
} from '@rentflow/shared';
import { HttpError } from '../../common/errors.js';
import { User } from '../../models/identity.js';
import { PlatformSettings } from '../../models/platform.js';
import { Property } from '../../models/property.js';
import {
  GeoAuditLog,
  GeoBlock,
  type GeoBlockDocument,
  GeoCity,
  GeoDistrict,
  GeoNeighborhood,
  GeoOwner,
  SectorAssignment,
} from '../../models/quartier.js';

function isAdminActor(req: Request): boolean {
  return (
    Boolean(req.user?.roles?.includes('SUPER_ADMIN')) ||
    req.organizationContext?.role === 'ADMIN'
  );
}

function getActorRole(req: Request): string {
  if (req.user?.roles?.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
  return req.organizationContext?.role ?? req.user?.roles?.[0] ?? 'RESIDENT';
}

function assertValidGeoBoundary(boundary: GeoJsonBoundary): void {
  const result = validatePolygonGeometry(boundary);
  if (!result.valid) {
    throw new HttpError(422, result.error ?? 'Polygone géographique invalide.');
  }
}

async function resolveActorDisplayName(req: Request): Promise<string> {
  if (!req.user?.id) return 'Système';
  const u = await User.findById(req.user.id).select('displayName emailNormalized').lean();
  return u?.displayName ?? u?.emailNormalized ?? String(req.user.id);
}

async function logGeoAudit(
  req: Request,
  entry: {
    entityType: 'NEIGHBORHOOD' | 'BLOCK' | 'OWNER' | 'PROPERTY';
    entityId: string;
    neighborhoodId?: unknown;
    blockId?: unknown;
    ownerId?: unknown;
    action:
      | 'CREATE_BOUNDARY'
      | 'UPDATE_BOUNDARY'
      | 'REASSIGN_ZONE'
      | 'DEROGATION_GRANTED'
      | 'DEACTIVATE';
    previousBoundary?: unknown;
    newBoundary?: unknown;
    justification?: string | undefined;
  },
): Promise<void> {
  if (!req.user?.id) return;
  const actorName = await resolveActorDisplayName(req);
  await GeoAuditLog.create({
    ...entry,
    organizationId: req.organizationContext?.organizationId,
    performedBy: req.user.id,
    performedByName: actorName,
    performedByRole: getActorRole(req),
  });
}

async function assertNeighborhoodScopeAccess(req: Request, neighborhoodId: string): Promise<void> {
  if (isAdminActor(req)) return;
  const role = getActorRole(req);
  if (role !== 'NEIGHBORHOOD_LEADER') {
    throw new HttpError(
      403,
      'Accès refusé : seul le Chef de Quartier ou un Administrateur peut modifier les limites du quartier ou des blocs.',
    );
  }
  const userId = req.user!.id;
  const assigned = await SectorAssignment.exists({
    userId,
    role: 'NEIGHBORHOOD_LEADER',
    neighborhoodId,
    status: 'ACTIVE',
  });
  const directLeader = await GeoNeighborhood.exists({ _id: neighborhoodId, leaderId: userId });
  if (!assigned && !directLeader) {
    throw new HttpError(403, 'Accès interdit : vous n’êtes pas le Chef de Quartier affecté à cette zone.');
  }
}

async function getBlockLeaderBlockIds(userId: string): Promise<string[]> {
  const [assignments, directBlocks] = await Promise.all([
    SectorAssignment.find({ userId, role: 'BLOCK_LEADER', status: 'ACTIVE' }).select('blockId').lean(),
    GeoBlock.find({ blockLeaderId: userId }).select('_id').lean(),
  ]);
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.blockId) ids.add(String(a.blockId));
  }
  for (const b of directBlocks) {
    ids.add(String(b._id));
  }
  return [...ids];
}

async function getNeighborhoodLeaderIds(userId: string): Promise<string[]> {
  const [assignments, directNeighborhoods] = await Promise.all([
    SectorAssignment.find({ userId, role: 'NEIGHBORHOOD_LEADER', status: 'ACTIVE' })
      .select('neighborhoodId')
      .lean(),
    GeoNeighborhood.find({ leaderId: userId }).select('_id').lean(),
  ]);
  const ids = new Set<string>();
  for (const a of assignments) {
    if (a.neighborhoodId) ids.add(String(a.neighborhoodId));
  }
  for (const n of directNeighborhoods) {
    ids.add(String(n._id));
  }
  return [...ids];
}

// --- Territoires (Villes, Arrondissements, Quartiers, Blocs) ---

export async function listCities(_req: Request, res: Response): Promise<void> {
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
    .populate('leaderId', 'displayName emailNormalized phone')
    .lean();
  res.locals.data = neighborhoods;
}

export async function createNeighborhood(req: Request, res: Response): Promise<void> {
  if (req.body.boundary) {
    assertValidGeoBoundary(req.body.boundary as GeoJsonBoundary);
  }
  const neighborhood = await GeoNeighborhood.create(req.body);
  if (req.body.boundary && req.user?.id) {
    await logGeoAudit(req, {
      entityType: 'NEIGHBORHOOD',
      entityId: String(neighborhood._id),
      neighborhoodId: neighborhood._id,
      action: 'CREATE_BOUNDARY',
      newBoundary: req.body.boundary,
      justification: req.body.justification,
    });
  }
  res.locals.data = neighborhood;
}

export async function updateNeighborhoodBoundary(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id ?? '');
  const neighborhood = await GeoNeighborhood.findById(id);
  if (!neighborhood) {
    throw new HttpError(404, 'Quartier introuvable.');
  }

  await assertNeighborhoodScopeAccess(req, id);

  const { boundary, administrativeAddress, region, department, arrondissement, justification } =
    req.body as {
      boundary: GeoJsonBoundary;
      administrativeAddress?: string;
      region?: string;
      department?: string;
      arrondissement?: string;
      justification?: string;
    };

  assertValidGeoBoundary(boundary);

  const previousBoundary = neighborhood.boundary;
  neighborhood.boundary = boundary as never;
  if (administrativeAddress !== undefined) neighborhood.administrativeAddress = administrativeAddress;
  if (region !== undefined) neighborhood.region = region;
  if (department !== undefined) neighborhood.department = department;
  if (arrondissement !== undefined) neighborhood.arrondissement = arrondissement;
  await neighborhood.save();

  await logGeoAudit(req, {
    entityType: 'NEIGHBORHOOD',
    entityId: String(neighborhood._id),
    neighborhoodId: neighborhood._id,
    action: previousBoundary ? 'UPDATE_BOUNDARY' : 'CREATE_BOUNDARY',
    previousBoundary,
    newBoundary: boundary,
    justification,
  });

  res.locals.data = neighborhood;
}

export async function listBlocks(req: Request, res: Response): Promise<void> {
  const { neighborhoodId } = req.query;
  const filter: Record<string, unknown> = {};
  if (neighborhoodId) filter.neighborhoodId = neighborhoodId;

  const blocks = await GeoBlock.find(filter)
    .sort({ name: 1 })
    .populate('blockLeaderId', 'displayName emailNormalized phone')
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
    .populate('blockLeaderId', 'displayName phone')
    .lean();

  if (!block) {
    throw new HttpError(404, 'Lien ou QR code de bloc invalide ou expiré.');
  }

  res.locals.data = block;
}

async function validateBlockBoundaryRules(
  req: Request,
  options: {
    neighborhoodId: string;
    boundary: GeoJsonBoundary;
    excludeBlockId?: string;
    overrideOverlap?: boolean;
    overrideReason?: string;
  },
): Promise<{ derogationUsed: boolean }> {
  assertValidGeoBoundary(options.boundary);

  const neighborhood = await GeoNeighborhood.findById(options.neighborhoodId).lean();
  if (!neighborhood) {
    throw new HttpError(404, 'Quartier parent introuvable.');
  }

  if (neighborhood.boundary?.coordinates) {
    const insideNeighborhood = isPolygonInsidePolygon(
      options.boundary,
      neighborhood.boundary as GeoJsonBoundary,
    );
    if (!insideNeighborhood) {
      throw new HttpError(
        422,
        `Zone invalide : la zone du chef de bloc dépasse les limites du quartier « ${neighborhood.name} ».`,
      );
    }
  }

  const siblingFilter: Record<string, unknown> = {
    neighborhoodId: options.neighborhoodId,
    isActive: { $ne: false },
    'boundary.coordinates': { $exists: true },
  };
  if (options.excludeBlockId) {
    siblingFilter._id = { $ne: options.excludeBlockId };
  }

  const siblingBlocks = await GeoBlock.find(siblingFilter).select('name code boundary').lean();
  const overlappingNames: string[] = [];

  for (const sibling of siblingBlocks) {
    if (!sibling.boundary) continue;
    if (doPolygonsOverlap(options.boundary, sibling.boundary as GeoJsonBoundary)) {
      overlappingNames.push(sibling.name);
    }
  }

  if (overlappingNames.length > 0) {
    const canOverride =
      options.overrideOverlap === true &&
      isAdminActor(req) &&
      typeof options.overrideReason === 'string' &&
      options.overrideReason.trim().length > 0;

    if (!canOverride) {
      throw new HttpError(
        422,
        `Chevauchement interdit : la zone empiète sur celle de « ${overlappingNames.join(', ')} ». Deux blocs peuvent partager une frontière commune mais ne doivent pas se superposer (sauf dérogation administrateur justifiée).`,
      );
    }
    return { derogationUsed: true };
  }

  return { derogationUsed: false };
}

export async function createBlock(req: Request, res: Response): Promise<void> {
  if (req.user) {
    await assertNeighborhoodScopeAccess(req, String(req.body.neighborhoodId));
  }

  let derogationUsed = false;
  const bodyBoundary = req.body.boundary as GeoJsonBoundary | undefined;

  if (bodyBoundary) {
    const check = await validateBlockBoundaryRules(req, {
      neighborhoodId: String(req.body.neighborhoodId),
      boundary: bodyBoundary,
      overrideOverlap: Boolean(req.body.overrideOverlap),
      overrideReason: req.body.overrideReason,
    });
    derogationUsed = check.derogationUsed;
  }

  const registrationToken = randomBytes(12).toString('hex');
  const code =
    req.body.code?.trim().toUpperCase() ||
    `BLOC-${Date.now().toString(36).toUpperCase().slice(-5)}`;

  const block = await GeoBlock.create({
    ...req.body,
    code,
    registrationToken,
    ...(bodyBoundary
      ? {
          boundary: bodyBoundary,
          boundaryCoordinates: fromGeoJsonBoundary(bodyBoundary),
        }
      : {}),
  });

  if (bodyBoundary && req.user?.id) {
    await logGeoAudit(req, {
      entityType: 'BLOCK',
      entityId: String(block._id),
      neighborhoodId: block.neighborhoodId,
      blockId: block._id,
      action: derogationUsed ? 'DEROGATION_GRANTED' : 'CREATE_BOUNDARY',
      newBoundary: bodyBoundary,
      justification: derogationUsed ? req.body.overrideReason : req.body.description,
    });
  }

  res.status(201);
  res.locals.data = block;
}

export async function updateBlockBoundary(req: Request, res: Response): Promise<void> {
  const blockId = String(req.params.id ?? '');
  const block = await GeoBlock.findById(blockId);
  if (!block) {
    throw new HttpError(404, 'Bloc introuvable.');
  }

  await assertNeighborhoodScopeAccess(req, String(block.neighborhoodId));

  const { boundary, name, color, overrideOverlap, overrideReason, justification } = req.body as {
    boundary: GeoJsonBoundary;
    name?: string;
    color?: string;
    overrideOverlap?: boolean;
    overrideReason?: string;
    justification?: string;
  };

  const { derogationUsed } = await validateBlockBoundaryRules(req, {
    neighborhoodId: String(block.neighborhoodId),
    boundary,
    excludeBlockId: blockId,
    ...(overrideOverlap !== undefined ? { overrideOverlap } : {}),
    ...(overrideReason !== undefined ? { overrideReason } : {}),
  });

  const previousBoundary = block.boundary;
  block.boundary = boundary as never;
  block.boundaryCoordinates = fromGeoJsonBoundary(boundary) as never;
  if (name) block.name = name;
  if (color) block.color = color;
  await block.save();

  await logGeoAudit(req, {
    entityType: 'BLOCK',
    entityId: String(block._id),
    neighborhoodId: block.neighborhoodId,
    blockId: block._id,
    action: derogationUsed ? 'DEROGATION_GRANTED' : 'UPDATE_BOUNDARY',
    previousBoundary,
    newBoundary: boundary,
    justification: derogationUsed ? overrideReason : justification,
  });

  res.locals.data = block;
}

export async function updateBlockStatus(req: Request, res: Response): Promise<void> {
  const blockId = String(req.params.id ?? '');
  const block = await GeoBlock.findById(blockId);
  if (!block) throw new HttpError(404, 'Bloc introuvable.');

  await assertNeighborhoodScopeAccess(req, String(block.neighborhoodId));

  const { isActive, blockLeaderId, justification } = req.body as {
    isActive?: boolean;
    blockLeaderId?: string;
    justification?: string;
  };

  if (typeof isActive === 'boolean') block.isActive = isActive;
  if (blockLeaderId) block.blockLeaderId = blockLeaderId as never;
  await block.save();

  await logGeoAudit(req, {
    entityType: 'BLOCK',
    entityId: String(block._id),
    neighborhoodId: block.neighborhoodId,
    blockId: block._id,
    action: isActive === false ? 'DEACTIVATE' : 'REASSIGN_ZONE',
    justification,
  });

  res.locals.data = block;
}

// --- Niveau 2 : Zones géographiques des Propriétaires gérées par le Chef de Bloc ---

export async function listGeoOwners(req: Request, res: Response): Promise<void> {
  const role = getActorRole(req);
  const userId = req.user!.id;
  const requestedBlockId = req.query.blockId ? String(req.query.blockId) : undefined;
  const requestedNeighborhoodId = req.query.neighborhoodId
    ? String(req.query.neighborhoodId)
    : undefined;

  const filter: Record<string, unknown> = {};

  if (isAdminActor(req)) {
    if (requestedBlockId) filter.blockId = requestedBlockId;
    if (requestedNeighborhoodId) filter.neighborhoodId = requestedNeighborhoodId;
  } else if (role === 'NEIGHBORHOOD_LEADER') {
    const allowedNeighborhoods = await getNeighborhoodLeaderIds(userId);
    if (requestedNeighborhoodId && !allowedNeighborhoods.includes(requestedNeighborhoodId)) {
      throw new HttpError(403, 'Accès interdit à un autre quartier.');
    }
    filter.neighborhoodId = requestedNeighborhoodId ?? { $in: allowedNeighborhoods };
    if (requestedBlockId) filter.blockId = requestedBlockId;
  } else if (role === 'BLOCK_LEADER') {
    const allowedBlocks = await getBlockLeaderBlockIds(userId);
    if (requestedBlockId && !allowedBlocks.includes(requestedBlockId)) {
      throw new HttpError(403, 'Accès interdit : vous ne pouvez consulter que les propriétaires de votre bloc.');
    }
    filter.blockId = requestedBlockId ?? { $in: allowedBlocks };
  } else {
    // Propriétaire / gestionnaire / résident : uniquement sa propre fiche si présente
    const userDoc = await User.findById(userId).select('emailNormalized').lean();
    filter.$or = [
      { userId },
      ...(userDoc?.emailNormalized ? [{ email: userDoc.emailNormalized }] : []),
    ];
  }

  const owners = await GeoOwner.find(filter)
    .sort({ createdAt: -1 })
    .populate('blockId', 'name code boundary')
    .populate('neighborhoodId', 'name boundary')
    .lean();

  const ownerIds = owners.map((o) => o._id);
  const counts = await Property.aggregate([
    { $match: { geoOwnerId: { $in: ownerIds }, deletedAt: null } },
    { $group: { _id: '$geoOwnerId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map<string, number>();
  for (const row of counts) {
    countMap.set(String(row._id), row.count as number);
  }

  const enriched = owners.map((owner) => ({
    ...owner,
    propertiesCount: countMap.get(String(owner._id)) ?? 0,
  }));

  res.locals.data = enriched;
}

async function assertCanManageBlockOwners(req: Request, blockId: string): Promise<{
  block: HydratedDocument<GeoBlockDocument>;
}> {
  const block = await GeoBlock.findById(blockId);
  if (!block) throw new HttpError(404, 'Bloc cible introuvable.');

  if (isAdminActor(req)) return { block };

  const role = getActorRole(req);
  const userId = req.user!.id;

  if (role === 'BLOCK_LEADER') {
    const allowedBlocks = await getBlockLeaderBlockIds(userId);
    if (!allowedBlocks.includes(String(block._id))) {
      throw new HttpError(
        403,
        'Accès interdit : un chef de bloc ne peut pas créer ou modifier un propriétaire hors de son propre bloc.',
      );
    }
    return { block };
  }

  if (role === 'NEIGHBORHOOD_LEADER') {
    const allowedNeighborhoods = await getNeighborhoodLeaderIds(userId);
    if (!allowedNeighborhoods.includes(String(block.neighborhoodId))) {
      throw new HttpError(403, 'Accès interdit : ce bloc ne fait pas partie de votre quartier.');
    }
    return { block };
  }

  throw new HttpError(403, 'Permission insuffisante pour attribuer une zone propriétaire.');
}

async function validateOwnerBoundaryInBlock(
  assignedBoundary: GeoJsonBoundary,
  blockId: string,
): Promise<{ neighborhoodId: string }> {
  assertValidGeoBoundary(assignedBoundary);

  const block = await GeoBlock.findById(blockId).lean();
  if (!block) throw new HttpError(404, 'Bloc introuvable.');

  if (block.boundary?.coordinates) {
    const insideBlock = isPolygonInsidePolygon(assignedBoundary, block.boundary as GeoJsonBoundary);
    if (!insideBlock) {
      throw new HttpError(
        422,
        `Zone refusée : la zone attribuée au propriétaire sort des limites du bloc « ${block.name} ».`,
      );
    }
  }

  const neighborhood = await GeoNeighborhood.findById(block.neighborhoodId).lean();
  if (neighborhood?.boundary?.coordinates) {
    const insideNeighborhood = isPolygonInsidePolygon(
      assignedBoundary,
      neighborhood.boundary as GeoJsonBoundary,
    );
    if (!insideNeighborhood) {
      throw new HttpError(
        422,
        `Zone refusée : la zone attribuée sort des limites du quartier « ${neighborhood.name} ».`,
      );
    }
  }

  return { neighborhoodId: String(block.neighborhoodId) };
}

export async function createGeoOwner(req: Request, res: Response): Promise<void> {
  const { blockId, assignedBoundary, fullName, phone, email, userId, justification } = req.body as {
    blockId: string;
    assignedBoundary: GeoJsonBoundary;
    fullName: string;
    phone: string;
    email?: string;
    userId?: string;
    justification?: string;
  };

  const { block } = await assertCanManageBlockOwners(req, blockId);
  const { neighborhoodId } = await validateOwnerBoundaryInBlock(assignedBoundary, blockId);

  if (req.body.neighborhoodId && String(req.body.neighborhoodId) !== neighborhoodId) {
    throw new HttpError(
      403,
      'Incohérence territoriale : le bloc sélectionné n’appartient pas au quartier indiqué.',
    );
  }

  const owner = await GeoOwner.create({
    organizationId: req.organizationContext?.organizationId,
    userId,
    fullName,
    phone,
    email: email?.trim().toLowerCase() || undefined,
    blockId: block._id,
    neighborhoodId,
    assignedBoundary,
    createdBy: req.user?.id,
  });

  await logGeoAudit(req, {
    entityType: 'OWNER',
    entityId: String(owner._id),
    neighborhoodId,
    blockId: block._id,
    ownerId: owner._id,
    action: 'CREATE_BOUNDARY',
    newBoundary: assignedBoundary,
    justification,
  });

  res.status(201);
  res.locals.data = owner;
}

export async function updateGeoOwnerBoundary(req: Request, res: Response): Promise<void> {
  const ownerId = String(req.params.id ?? '');
  const owner = await GeoOwner.findById(ownerId);
  if (!owner) throw new HttpError(404, 'Zone propriétaire introuvable.');

  await assertCanManageBlockOwners(req, String(owner.blockId));

  const { assignedBoundary, justification } = req.body as {
    assignedBoundary: GeoJsonBoundary;
    justification?: string;
  };

  await validateOwnerBoundaryInBlock(assignedBoundary, String(owner.blockId));

  const previousBoundary = owner.assignedBoundary;
  owner.assignedBoundary = assignedBoundary as never;
  await owner.save();

  await logGeoAudit(req, {
    entityType: 'OWNER',
    entityId: String(owner._id),
    neighborhoodId: owner.neighborhoodId,
    blockId: owner.blockId,
    ownerId: owner._id,
    action: 'UPDATE_BOUNDARY',
    previousBoundary,
    newBoundary: assignedBoundary,
    justification,
  });

  res.locals.data = owner;
}

// --- Carte Géographique Générale (4 couches) & Historique ---

export async function getGeoLayers(req: Request, res: Response): Promise<void> {
  const role = getActorRole(req);
  const userId = req.user!.id;
  const orgId = req.organizationContext?.organizationId;
  const { neighborhoodId, blockId, ownerId, geoUniqueId, q } = req.query as Record<string, string | undefined>;

  let neighborhoodFilter: Record<string, unknown> = {};
  let blockFilter: Record<string, unknown> = {};
  let ownerFilter: Record<string, unknown> = {};
  let propertyFilter: Record<string, unknown> = { deletedAt: null };
  if (orgId && !isAdminActor(req)) {
    propertyFilter.organizationId = orgId;
  }

  if (isAdminActor(req)) {
    if (neighborhoodId) {
      neighborhoodFilter._id = neighborhoodId;
      blockFilter.neighborhoodId = neighborhoodId;
      ownerFilter.neighborhoodId = neighborhoodId;
      propertyFilter.neighborhoodId = neighborhoodId;
    }
    if (blockId) {
      blockFilter._id = blockId;
      ownerFilter.blockId = blockId;
      propertyFilter.blockId = blockId;
    }
    if (ownerId) {
      ownerFilter._id = ownerId;
      propertyFilter.geoOwnerId = ownerId;
    }
  } else if (role === 'NEIGHBORHOOD_LEADER') {
    const allowedNeighborhoods = await getNeighborhoodLeaderIds(userId);
    const scopeIds = neighborhoodId && allowedNeighborhoods.includes(neighborhoodId)
      ? [neighborhoodId]
      : allowedNeighborhoods;
    neighborhoodFilter._id = { $in: scopeIds };
    blockFilter.neighborhoodId = { $in: scopeIds };
    ownerFilter.neighborhoodId = { $in: scopeIds };
    propertyFilter.neighborhoodId = { $in: scopeIds };
    if (blockId) {
      blockFilter._id = blockId;
      ownerFilter.blockId = blockId;
      propertyFilter.blockId = blockId;
    }
  } else if (role === 'BLOCK_LEADER') {
    const allowedBlocks = await getBlockLeaderBlockIds(userId);
    const blocksMeta = await GeoBlock.find({ _id: { $in: allowedBlocks } }).select('neighborhoodId').lean();
    const parentNeighborhoodIds = [...new Set(blocksMeta.map((b) => String(b.neighborhoodId)))];
    neighborhoodFilter._id = { $in: parentNeighborhoodIds };
    blockFilter._id = { $in: allowedBlocks };
    ownerFilter.blockId = { $in: allowedBlocks };
    propertyFilter.blockId = { $in: allowedBlocks };
  } else {
    // OWNER / RESIDENT : cloisonné à sa zone, son bloc, son quartier et ses biens
    const userDoc = await User.findById(userId).select('emailNormalized').lean();
    ownerFilter.$or = [
      { userId },
      ...(userDoc?.emailNormalized ? [{ email: userDoc.emailNormalized }] : []),
    ];
    const myOwnerZones = await GeoOwner.find(ownerFilter).select('_id blockId neighborhoodId').lean();
    const myBlockIds = [...new Set(myOwnerZones.map((o) => String(o.blockId)))];
    const myNeighborhoodIds = [...new Set(myOwnerZones.map((o) => String(o.neighborhoodId)))];
    neighborhoodFilter._id = { $in: myNeighborhoodIds };
    blockFilter._id = { $in: myBlockIds };
    propertyFilter = {
      deletedAt: null,
      ...(orgId ? { organizationId: orgId } : {}),
    };
  }

  if (geoUniqueId) {
    propertyFilter.geoUniqueId = geoUniqueId.trim().toUpperCase();
  }
  if (q && q.trim()) {
    const regex = { $regex: q.trim(), $options: 'i' };
    propertyFilter.$or = [
      { name: regex },
      { address: regex },
      { geoUniqueId: regex },
      { neighborhoodName: regex },
    ];
  }

  const [neighborhoods, blocks, owners, properties] = await Promise.all([
    GeoNeighborhood.find(neighborhoodFilter)
      .populate('leaderId', 'displayName phone')
      .lean(),
    GeoBlock.find(blockFilter)
      .populate('blockLeaderId', 'displayName phone')
      .lean(),
    GeoOwner.find(ownerFilter).lean(),
    Property.find(propertyFilter)
      .select(
        'name type address city zone neighborhoodId blockId geoOwnerId geoUniqueId region department arrondissement neighborhoodName sectorName neighborhoodLeaderName blockLeaderName latitude longitude location boundary geoDerogation createdAt updatedAt',
      )
      .lean(),
  ]);

  const hideSensitiveOwnerContact = role === 'RESIDENT' || role === 'TENANT';
  const sanitizedOwners = owners.map((o) => ({
    _id: o._id,
    fullName: hideSensitiveOwnerContact ? 'Propriétaire enregistré' : o.fullName,
    phone: hideSensitiveOwnerContact ? undefined : o.phone,
    email: hideSensitiveOwnerContact ? undefined : o.email,
    blockId: o.blockId,
    neighborhoodId: o.neighborhoodId,
    assignedBoundary: o.assignedBoundary,
    status: o.status,
  }));

  res.locals.data = {
    layers: {
      neighborhoods,
      blocks,
      owners: sanitizedOwners,
      properties,
    },
    stats: {
      neighborhoodsCount: neighborhoods.length,
      delimitedNeighborhoodsCount: neighborhoods.filter((n) => Boolean(n.boundary?.coordinates)).length,
      blocksCount: blocks.length,
      delimitedBlocksCount: blocks.filter((b) => Boolean(b.boundary?.coordinates)).length,
      ownersCount: sanitizedOwners.length,
      propertiesCount: properties.length,
      geolocatedPropertiesCount: properties.filter(
        (p) => Boolean(p.location?.coordinates) || (p.latitude !== undefined && p.longitude !== undefined),
      ).length,
    },
  };
}

export async function listGeoAuditLogs(req: Request, res: Response): Promise<void> {
  const role = getActorRole(req);
  const userId = req.user!.id;
  const filter: Record<string, unknown> = {};

  if (!isAdminActor(req)) {
    if (role === 'NEIGHBORHOOD_LEADER') {
      const ids = await getNeighborhoodLeaderIds(userId);
      filter.neighborhoodId = { $in: ids };
    } else if (role === 'BLOCK_LEADER') {
      const ids = await getBlockLeaderBlockIds(userId);
      filter.blockId = { $in: ids };
    } else {
      filter.performedBy = userId;
    }
  }

  const logs = await GeoAuditLog.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  res.locals.data = logs;
}

// --- Affectation des Chefs de Quartier et Chefs de Bloc (Compatibilité conservée) ---

export async function assignSectorLeader(req: Request, res: Response): Promise<void> {
  const assignedBy = req.user!.id;
  const { userId, role, cityId, districtId, neighborhoodId, blockId, notes, startDate, endDate } =
    req.body;

  if (role === 'BLOCK_LEADER' && blockId) {
    await SectorAssignment.updateMany(
      { blockId, status: 'ACTIVE' },
      { $set: { status: 'TRANSFERRED', endDate: new Date() } },
    );
    await GeoBlock.findByIdAndUpdate(blockId, { blockLeaderId: userId });
  } else if (role === 'NEIGHBORHOOD_LEADER') {
    await SectorAssignment.updateMany(
      { neighborhoodId, role: 'NEIGHBORHOOD_LEADER', status: 'ACTIVE' },
      { $set: { status: 'TRANSFERRED', endDate: new Date() } },
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
        note: `Affectation du rôle ${role} pour le secteur.`,
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
    .populate('userId', 'displayName emailNormalized phone')
    .populate('neighborhoodId', 'name')
    .populate('blockId', 'name code')
    .lean();

  res.locals.data = assignments;
}

// Contrôle strict de frontière de secteur
export async function assertLeaderSectorAccess(
  userId: string,
  userRole: string,
  target: { neighborhoodId?: string; blockId?: string },
): Promise<void> {
  if (userRole === 'SUPER_ADMIN' || userRole === 'ADMIN') return;

  if (userRole === 'BLOCK_LEADER' && target.blockId) {
    const isAssigned = await SectorAssignment.exists({
      userId,
      role: 'BLOCK_LEADER',
      blockId: target.blockId,
      status: 'ACTIVE',
    });
    const isDirect = await GeoBlock.exists({ _id: target.blockId, blockLeaderId: userId });
    if (!isAssigned && !isDirect) {
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
    const isDirect = await GeoNeighborhood.exists({ _id: target.neighborhoodId, leaderId: userId });
    if (!isAssigned && !isDirect) {
      throw new HttpError(403, 'Accès interdit : vous n’êtes pas le chef affecté à ce quartier.');
    }
  }
}

// --- Configuration Google Maps Platform (gérée par l'Administrateur) ---

function maskApiKey(value?: string | null): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 6)}••••${trimmed.slice(-4)}`;
}

export async function getPublicGeoConfig(_req: Request, res: Response): Promise<void> {
  const settings = await PlatformSettings.findOne({ key: 'default' }).lean();
  const dbBrowserKey = settings?.googleMapsBrowserApiKey?.trim() ?? '';
  const envBrowserKey = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const googleMapsBrowserApiKey = dbBrowserKey || envBrowserKey;
  const hasServerKey = Boolean(
    settings?.googleMapsServerApiKey?.trim() || process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim(),
  );

  res.locals.data = {
    googleMapsBrowserApiKey,
    hasServerKey,
    source: dbBrowserKey ? 'database' : envBrowserKey ? 'env' : 'none',
  };
}

export async function getAdminGeoSettings(req: Request, res: Response): Promise<void> {
  if (!isAdminActor(req)) {
    throw new HttpError(
      403,
      'Accès refusé : seul un administrateur peut consulter les paramètres API Google Maps.',
    );
  }
  const settings = await PlatformSettings.findOne({ key: 'default' }).lean();
  const dbBrowserKey = settings?.googleMapsBrowserApiKey?.trim() ?? '';
  const dbServerKey = settings?.googleMapsServerApiKey?.trim() ?? '';
  const envBrowserKey = process.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';
  const envServerKey = process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ?? '';

  res.locals.data = {
    googleMapsBrowserApiKey: dbBrowserKey || envBrowserKey,
    browserKeyConfiguredInDb: Boolean(dbBrowserKey),
    hasServerKey: Boolean(dbServerKey || envServerKey),
    serverKeyConfiguredInDb: Boolean(dbServerKey),
    serverKeyMasked: maskApiKey(dbServerKey || envServerKey),
    hasEnvBrowserKey: Boolean(envBrowserKey),
    hasEnvServerKey: Boolean(envServerKey),
    updatedAt: settings?.updatedAt ?? null,
  };
}

export async function updateAdminGeoSettings(req: Request, res: Response): Promise<void> {
  if (!isAdminActor(req)) {
    throw new HttpError(
      403,
      'Accès refusé : seul un administrateur peut modifier les clés API Google Maps.',
    );
  }

  const body = req.body as {
    googleMapsBrowserApiKey?: string;
    googleMapsServerApiKey?: string;
  };

  const updateFields: Record<string, unknown> = {
    key: 'default',
    updatedBy: req.user?.id,
  };
  if (typeof body.googleMapsBrowserApiKey === 'string') {
    updateFields.googleMapsBrowserApiKey = body.googleMapsBrowserApiKey.trim();
  }
  if (typeof body.googleMapsServerApiKey === 'string') {
    updateFields.googleMapsServerApiKey = body.googleMapsServerApiKey.trim();
  }

  const updated = await PlatformSettings.findOneAndUpdate(
    { key: 'default' },
    { $set: updateFields },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).lean();

  const dbBrowserKey = updated?.googleMapsBrowserApiKey?.trim() ?? '';
  const dbServerKey = updated?.googleMapsServerApiKey?.trim() ?? '';

  res.locals.data = {
    googleMapsBrowserApiKey: dbBrowserKey,
    browserKeyConfiguredInDb: Boolean(dbBrowserKey),
    hasServerKey: Boolean(dbServerKey || process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim()),
    serverKeyConfiguredInDb: Boolean(dbServerKey),
    serverKeyMasked: maskApiKey(dbServerKey || process.env.GOOGLE_MAPS_SERVER_API_KEY),
    updatedAt: updated?.updatedAt ?? new Date(),
  };
}
