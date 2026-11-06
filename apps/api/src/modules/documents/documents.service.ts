import { createHash } from 'node:crypto';
import type { Request, Response } from 'express';
import { recordAudit } from '../../common/audit.js';
import { notFound } from '../../common/pagination.js';
import { sendStoredFile } from '../files/files.service.js';
import { DocumentFolder, DocumentVersion, PlatformDocumentModel } from '../../models/platform.js';

function org(req: Request): string {
  return req.organizationContext!.organizationId;
}

async function audit(req: Request, action: string, resourceId: string): Promise<void> {
  await recordAudit({
    organizationId: org(req),
    ...(req.user?.id ? { actorId: req.user.id } : {}),
    action,
    resourceType: 'Document',
    resourceId,
    requestId: req.requestId,
  });
}

export async function createFolder(req: Request, res: Response): Promise<void> {
  const folder = await DocumentFolder.create({ ...req.body, organizationId: org(req) });
  res.status(201);
  res.locals.data = folder;
}

export async function listFolders(req: Request, res: Response): Promise<void> {
  res.locals.data = await DocumentFolder.find({ organizationId: org(req), deletedAt: null }).sort({
    name: 1,
  });
}

export async function createDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.create({
    ...req.body,
    organizationId: org(req),
    version: 1,
  });
  await DocumentVersion.create({
    organizationId: org(req),
    documentId: document._id,
    fileId: document.fileId,
    version: 1,
    ...(req.user?.id ? { uploadedBy: req.user.id } : {}),
  });
  await audit(req, 'document.upload', String(document._id));
  res.status(201);
  res.locals.data = document;
}

export async function listDocuments(req: Request, res: Response): Promise<void> {
  const query = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = { organizationId: org(req), deletedAt: null };

  if (query.isArchived === 'true') {
    filter.isArchived = true;
  } else {
    filter.isArchived = { $ne: true };
  }

  if (query.category) {
    filter.category = query.category;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.propertyId) {
    filter.propertyId = query.propertyId;
  }
  if (query.search) {
    filter.title = { $regex: query.search.trim(), $options: 'i' };
  }

  if (req.organizationContext!.role === 'TENANT') {
    const { Tenant } = await import('../../models/lease.js');
    const tenant = await Tenant.findOne({
      organizationId: org(req),
      userId: req.user?.id,
      deletedAt: null,
    });
    filter.tenantId = tenant?._id ?? null;
  }
  res.locals.data = await PlatformDocumentModel.find(filter).sort({ createdAt: -1 }).limit(200);
}

export async function archiveDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), deletedAt: null },
    { isArchived: true },
    { new: true },
  );
  if (!document) throw notFound('Document');
  await audit(req, 'document.archive', String(document._id));
  res.locals.data = document;
}

export async function restoreDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), deletedAt: null },
    { isArchived: false },
    { new: true },
  );
  if (!document) throw notFound('Document');
  await audit(req, 'document.restore', String(document._id));
  res.locals.data = document;
}

export async function storageUsage(req: Request, res: Response): Promise<void> {
  const fileCount = await PlatformDocumentModel.countDocuments({
    organizationId: org(req),
    deletedAt: null,
  });
  const [sizeAgg] = await PlatformDocumentModel.aggregate<{ total: number }>([
    { $match: { organizationId: org(req), deletedAt: null } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);

  const usedBytes = sizeAgg?.total ?? fileCount * 1_500_000; // Estimation moyenne si non renseignée
  const usedMB = Math.round((usedBytes / (1024 * 1024)) * 10) / 10;
  const quotaLimitMB = 5_120; // 5 Go par défaut

  res.locals.data = {
    usedBytes,
    usedMB,
    fileCount,
    quotaLimitMB,
    quotaPercentage: Math.min(100, Math.round((usedMB / quotaLimitMB) * 100)),
  };
}

/** Nouvelle version : l'ancienne reste consultable, elle n'est pas écrasée. */
export async function addVersion(req: Request, res: Response): Promise<void> {
  const current = await PlatformDocumentModel.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!current) throw notFound('Document');
  const version = current.version + 1;
  current.fileId = req.body.fileId;
  current.version = version;
  await current.save();
  await DocumentVersion.create({
    organizationId: org(req),
    documentId: current._id,
    fileId: req.body.fileId,
    version,
    ...(req.user?.id ? { uploadedBy: req.user.id } : {}),
  });
  await audit(req, 'document.upload', String(current._id));
  res.locals.data = current;
}

export async function listVersions(req: Request, res: Response): Promise<void> {
  res.locals.data = await DocumentVersion.find({
    organizationId: org(req),
    documentId: req.params.id,
  }).sort({ version: -1 });
}

export async function downloadDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!document) throw notFound('Document');
  await audit(req, 'document.download', String(document._id));
  await sendStoredFile(res, org(req), String(document.fileId));
}

export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOneAndUpdate(
    { _id: req.params.id, organizationId: org(req), deletedAt: null },
    { deletedAt: new Date() },
  );
  if (!document) throw notFound('Document');
  await audit(req, 'document.delete', String(document._id));
  res.locals.data = { id: String(document._id), deleted: true };
}

/** Partage interne : un jeton dérivé du document, valable 24 h, jamais une URL publique. */
export async function shareDocument(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOne({
    _id: req.params.id,
    organizationId: org(req),
    deletedAt: null,
  });
  if (!document) throw notFound('Document');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  const token = createHash('sha256')
    .update(`${document._id}:${expiresAt}`)
    .digest('hex')
    .slice(0, 32);
  await audit(req, 'document.share', String(document._id));
  res.locals.data = {
    token,
    expiresAt: new Date(expiresAt).toISOString(),
    note: 'Lien interne à l’organisation, valable 24 h.',
  };
}

/** Prépare la signature. Aucun fournisseur n'est appelé. */
export async function requestSignature(req: Request, res: Response): Promise<void> {
  const document = await PlatformDocumentModel.findOne({
    _id: req.params.id,
    organizationId: org(req),
    type: 'LEASE_CONTRACT',
    deletedAt: null,
  });
  if (!document) throw notFound('Contrat à signer');
  document.signature = {
    status: 'PENDING',
    requestedAt: new Date(),
    documentHash: createHash('sha256').update(String(document.fileId)).digest('hex'),
  };
  await document.save();
  res.locals.data = {
    status: 'PENDING',
    note: 'Demande enregistrée. Aucun fournisseur de signature n’est configuré.',
  };
}

export async function expiringDocuments(req: Request, res: Response): Promise<void> {
  const horizon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  res.locals.data = await PlatformDocumentModel.find({
    organizationId: org(req),
    deletedAt: null,
    expiresAt: { $gte: new Date(), $lte: horizon },
  }).sort({ expiresAt: 1 });
}
