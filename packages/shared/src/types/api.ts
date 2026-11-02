/**
 * Contrats de transport HTTP partagés entre l'API et le client.
 *
 * Toutes les réponses — succès comme erreur — partagent la même forme de base :
 * un booléen `success` discriminant, un `requestId` pour la corrélation avec les
 * journaux, puis soit `data`, soit `error`. Un client peut donc décider quoi
 * faire sans inspecter le code HTTP.
 */

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

/** Réponse de succès : `{ success: true, data, meta?, requestId }`. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
  requestId: string;
}

/**
 * Détail d'une erreur de validation, rattaché à un champ précis afin que le
 * formulaire puisse afficher le message au bon endroit.
 */
export interface ApiErrorDetail {
  /** Chemin du champ concerné (ex. `email`, `units.0.rentAmountMinor`). */
  path: string;
  message: string;
  /** Code machine optionnel, utile pour une traduction côté client. */
  code?: string;
}

/** Corps d'erreur complet : `{ success: false, error: {...} }`. */
export interface ApiErrorBody {
  success: false;
  error: {
    /** Code stable et lisible par une machine (ex. `VALIDATION_ERROR`). */
    code: string;
    /** Message destiné à l'utilisateur final. */
    message: string;
    details?: ApiErrorDetail[];
    /** Identifiant de corrélation, également renvoyé dans l'en-tête `X-Request-Id`. */
    requestId: string;
  };
}

/** Toute réponse de l'API. */
export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

/** Code d'erreur générique renvoyé quand aucune classification n'est possible. */
export const API_ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];
