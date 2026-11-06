import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import multer from 'multer';
import mongoose, { Schema, model, type InferSchemaType, type Model, type Types } from 'mongoose';
const models = mongoose.models;
import { AppError } from '../../common/errors.js';
import { sendSuccess } from '../../common/http.js';

/**
 * Fichiers privés.
 *
 * Rien n'est servi depuis un dossier public : le fichier reçoit un nom aléatoire,
 * son type MIME est contrôlé, et son téléchargement passe par une route
 * authentifiée et scopée à l'organisation. Le contenu sensible (numéro de pièce)
 * n'est jamais dans le nom de fichier.
 */

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const MAX_BYTES = 8 * 1024 * 1024;

const fileSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    storedName: { type: String, required: true },
    originalName: { type: String, required: true, maxlength: 240 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
fileSchema.index({ organizationId: 1, createdAt: -1 }, { name: 'files_org_date' });

export type StoredFileDocument = InferSchemaType<typeof fileSchema> & { _id: Types.ObjectId };
export const StoredFile =
  (models.StoredFile as Model<StoredFileDocument>) ??
  model<StoredFileDocument>('StoredFile', fileSchema);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 10 },
  fileFilter: (_req, file, callback) => {
    callback(null, ALLOWED_MIME_TYPES.has(file.mimetype));
  },
});

function storageRoot(): string {
  return path.resolve(process.cwd(), 'storage');
}

export async function persistFiles(
  organizationId: string,
  files: readonly Express.Multer.File[],
  uploadedBy?: string,
): Promise<StoredFileDocument[]> {
  const directory = path.join(storageRoot(), organizationId);
  await mkdir(directory, { recursive: true });

  const stored: StoredFileDocument[] = [];
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new AppError('VALIDATION_ERROR', 'Type de fichier non autorisé.', 422);
    }
    const storedName = `${randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 8)}`;
    await writeFile(path.join(directory, storedName), file.buffer);
    const document = await StoredFile.create({
      organizationId,
      storedName,
      originalName: path.basename(file.originalname).slice(0, 240),
      mimeType: file.mimetype,
      size: file.size,
      ...(uploadedBy ? { uploadedBy } : {}),
    });
    stored.push(document);
  }
  return stored;
}

/** N'envoie un fichier que s'il appartient à l'organisation de la requête. */
export async function sendStoredFile(
  res: Response,
  organizationId: string,
  fileId: string,
): Promise<void> {
  const file = await StoredFile.findOne({ _id: fileId, organizationId });
  if (!file) throw new AppError('NOT_FOUND', 'Fichier introuvable.', 404);

  const filePath = path.join(storageRoot(), organizationId, file.storedName);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${file.originalName.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  createReadStream(filePath).pipe(res);
}

export const uploadFiles: RequestHandler = (req, res, next) => {
  void (async () => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'Aucun fichier reçu.', 422);
    }
    const stored = await persistFiles(req.organizationContext!.organizationId, files, req.user?.id);
    sendSuccess(
      res,
      stored.map((file) => ({
        id: String(file._id),
        name: file.originalName,
        mimeType: file.mimeType,
      })),
      { statusCode: 201 },
    );
  })().catch(next);
};
