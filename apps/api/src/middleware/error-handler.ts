import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import type { ApiErrorDetail } from '@rentflow/shared';
import { AppError } from '../common/errors.js';
import { sendError } from '../common/http.js';

/**
 * Middleware d'erreur terminal.
 *
 * Il traduit chaque famille d'erreur connue en enveloppe stable
 * `{ success: false, error: { code, message, details?, requestId } }`.
 * Les détails internes (stack, message Mongo brut) ne sortent **jamais** en
 * production : ils sont journalisés côté serveur et remplacés par un message
 * générique côté client.
 */

interface MongoServerError extends Error {
  code?: number;
  keyValue?: Record<string, unknown>;
}

function isMongoDuplicateKeyError(error: unknown): error is MongoServerError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as MongoServerError).code === 11_000 &&
    'keyValue' in error
  );
}

/** `express.json()` rejette un corps mal formé avec un `SyntaxError` typé. */
function isJsonParseError(error: unknown): error is SyntaxError & { status: number } {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: unknown }).status === 400 &&
    'body' in error
  );
}

function formatDuplicateKeyMessage(keyValue: Record<string, unknown>): string {
  const fields = Object.keys(keyValue);
  if (fields.length === 0) return 'Cette ressource existe déjà.';
  const labels: Record<string, string> = {
    email: 'cette adresse e-mail',
    slug: 'cette référence',
    organizationId: 'cette organisation',
  };
  const readable = fields.map((field) => labels[field] ?? `ce champ « ${field} »`).join(' et ');
  return `Un enregistrement utilise déjà ${readable}.`;
}

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const requestId = req.requestId;
  const log = req.log ?? console;

  // --- Validation de la requête (Zod, à la frontière HTTP) -----------------
  if (error instanceof ZodError) {
    const details: ApiErrorDetail[] = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    sendError(res, {
      code: 'VALIDATION_ERROR',
      message: 'La requête est invalide.',
      statusCode: 400,
      details,
    });
    return;
  }

  // --- JSON mal formé ------------------------------------------------------
  if (isJsonParseError(error)) {
    sendError(res, {
      code: 'VALIDATION_ERROR',
      message: 'Le corps de la requête n’est pas un JSON valide.',
      statusCode: 400,
    });
    return;
  }

  // --- Validation du modèle Mongoose --------------------------------------
  if (error instanceof mongoose.Error.ValidationError) {
    const details: ApiErrorDetail[] = Object.entries(error.errors).map(([path, issue]) => ({
      path,
      message: issue.message,
    }));

    sendError(res, {
      code: 'VALIDATION_ERROR',
      message: 'Les données fournies sont invalides.',
      statusCode: 400,
      details,
    });
    return;
  }

  // --- Identifiant mal formé (CastError ObjectId) --------------------------
  if (error instanceof mongoose.Error.CastError) {
    sendError(res, {
      code: 'VALIDATION_ERROR',
      message: `Valeur invalide pour « ${error.path} ».`,
      statusCode: 400,
      details: [{ path: error.path, message: 'Format attendu invalide.' }],
    });
    return;
  }

  // --- Contrainte d'unicité MongoDB ---------------------------------------
  if (isMongoDuplicateKeyError(error)) {
    sendError(res, {
      code: 'CONFLICT',
      message: formatDuplicateKeyMessage(error.keyValue ?? {}),
      statusCode: 409,
    });
    return;
  }

  // --- Erreur applicative volontaire --------------------------------------
  if (error instanceof AppError) {
    // Une 5xx signale un défaut de notre côté : on la trace systématiquement.
    if (error.statusCode >= 500) {
      log.error({ err: error, requestId }, 'Application error');
    }

    sendError(res, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      ...(error.details ? { details: error.details as ApiErrorDetail[] } : {}),
    });
    return;
  }

  // --- Inconnu : jamais de fuite d'information ----------------------------
  log.error({ err: error, requestId }, 'Unhandled request error');
  sendError(res, {
    code: 'INTERNAL_ERROR',
    message: 'Une erreur interne est survenue.',
    statusCode: 500,
  });
};
