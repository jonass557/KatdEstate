import type { Response } from 'express';
import type { ApiErrorBody, ApiErrorDetail, ApiSuccess, PaginationMeta } from '@rentflow/shared';

/**
 * Helpers d'émission des réponses HTTP.
 *
 * Ils garantissent qu'une réponse — succès ou erreur — respecte toujours la même
 * enveloppe. Les contrôleurs ne construisent jamais un `res.json(...)` à la main :
 * c'est ce qui évite la dérive du format au fil des modules.
 */

/** Identifiant de corrélation posé par `middleware/request-id.ts`. */
export function getRequestId(res: Response): string {
  const header = res.getHeader('X-Request-Id');
  if (typeof header === 'string') return header;
  if (Array.isArray(header) && header.length > 0) return String(header[0]);
  if (typeof header === 'number') return String(header);
  return 'unknown';
}

export interface SuccessOptions {
  statusCode?: number;
  meta?: PaginationMeta;
}

/** Réponse de succès : `{ success: true, data, meta?, requestId }`. */
export function sendSuccess<T>(res: Response, data: T, options: SuccessOptions = {}): void {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    requestId: getRequestId(res),
    ...(options.meta ? { meta: options.meta } : {}),
  };

  res.status(options.statusCode ?? 200).json(body);
}

export interface ErrorPayload {
  code: string;
  message: string;
  statusCode?: number;
  details?: readonly ApiErrorDetail[];
}

/** Réponse d'erreur : `{ success: false, error: { code, message, details?, requestId } }`. */
export function sendError(res: Response, payload: ErrorPayload): void {
  const body: ApiErrorBody = {
    success: false,
    error: {
      code: payload.code,
      message: payload.message,
      requestId: getRequestId(res),
      ...(payload.details && payload.details.length > 0 ? { details: [...payload.details] } : {}),
    },
  };

  res.status(payload.statusCode ?? 500).json(body);
}
