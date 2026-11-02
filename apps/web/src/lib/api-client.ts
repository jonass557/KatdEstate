import axios, {
  AxiosError,
  AxiosHeaders,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';
import type { ApiErrorBody, ApiErrorDetail, ApiSuccess, PaginationMeta } from '@rentflow/shared';

/**
 * Client HTTP unique de l'application.
 *
 * Tous les appels réseau passent par ici : aucun composant ne connaît d'URL
 * d'API, ne construit d'en-tête d'authentification, ni ne découpe une réponse.
 *
 * Trois responsabilités :
 *  1. porter l'access token (en mémoire uniquement, jamais dans `localStorage`) ;
 *  2. rafraîchir la session une seule fois en cas de 401, puis rejouer la requête ;
 *  3. normaliser toute erreur en `ApiError` typée, y compris une panne réseau.
 */

export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' &&
  window.location.hostname !== 'localhost' &&
  window.location.hostname !== '127.0.0.1'
    ? 'https://kadtestate-api.onrender.com/api/v1'
    : 'http://localhost:4000/api/v1');

/** Délai au-delà duquel une requête est considérée comme perdue. */
const REQUEST_TIMEOUT_MS = 20_000;

// --- État de session ---------------------------------------------------------

/**
 * Access token conservé en mémoire vive uniquement.
 *
 * Il n'est volontairement **pas** persisté : un token dans `localStorage` est
 * lisible par n'importe quel script injecté (XSS). La persistance de session
 * repose sur le cookie `HttpOnly` de refresh, inaccessible au JavaScript.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

// --- Erreur normalisée -------------------------------------------------------

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId: string;
  readonly details: readonly ApiErrorDetail[] | undefined;

  constructor(
    message: string,
    code: string,
    status: number,
    requestId: string,
    details?: readonly ApiErrorDetail[],
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.details = details;
  }

  /** Vrai quand l'API n'a pas pu être jointe (hors ligne, serveur arrêté). */
  get isNetworkError(): boolean {
    return this.code === 'NETWORK_ERROR';
  }

  /** Vrai quand la session n'est plus valide et qu'une reconnexion est requise. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Message associé à un champ précis, à afficher sous l'input concerné. */
  detailFor(path: string): string | undefined {
    return this.details?.find((detail) => detail.path === path)?.message;
  }
}

// --- Gestion de l'expiration de session --------------------------------------

/** Callback déclenché lorsque la session ne peut plus être rafraîchie. */
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler;
}

/** Requête en cours de rafraîchissement, partagée pour éviter les appels en rafale. */
let refreshInFlight: Promise<string | null> | null = null;

/**
 * Rafraîchit l'access token via le cookie `HttpOnly`.
 *
 * Si dix requêtes échouent simultanément en 401, une seule demande de
 * rafraîchissement part : les autres attendent la même promesse. Sans cela, un
 * rechargement de page déclencherait autant de rotations de token que d'appels.
 */
function refreshAccessToken(): Promise<string | null> {
  refreshInFlight ??= axiosInstance
    .post<ApiSuccess<{ accessToken: string }>>(
      '/auth/refresh',
      {},
      { headers: { 'X-Skip-Auth-Retry': '1' } },
    )
    .then((response) => {
      const token = response.data.data.accessToken;
      setAccessToken(token);
      return token;
    })
    .catch(() => {
      setAccessToken(null);
      return null;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

// --- Instance Axios ----------------------------------------------------------

export const axiosInstance: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  // Indispensable : le cookie de refresh doit voyager avec chaque requête.
  withCredentials: true,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { Accept: 'application/json' },
});

axiosInstance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    config.headers = headers;
  }
  return config;
});

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;

    // 401 sur une route protégée : tenter un rafraîchissement unique, puis
    // rejouer la requête d'origine. L'en-tête X-Skip-Auth-Retry empêche toute
    // boucle infinie si le rafraîchissement lui-même échoue.
    const isRetryable =
      error.response?.status === 401 &&
      config !== undefined &&
      config.headers?.get?.('X-Skip-Auth-Retry') !== '1';

    if (isRetryable && config) {
      const token = await refreshAccessToken();

      if (token) {
        const headers = AxiosHeaders.from(config.headers);
        headers.set('Authorization', `Bearer ${token}`);
        config.headers = headers;
        return axiosInstance.request(config);
      }

      onUnauthorized?.();
    }

    return Promise.reject(toApiError(error));
  },
);

/** Transforme toute erreur Axios en `ApiError` exploitable par l'interface. */
function toApiError(error: AxiosError): ApiError {
  const body = error.response?.data as ApiErrorBody | undefined;

  if (body?.error) {
    return new ApiError(
      body.error.message,
      body.error.code,
      error.response?.status ?? 500,
      body.error.requestId ?? 'unknown',
      body.error.details,
    );
  }

  // Pas de réponse : serveur arrêté, hors ligne, DNS, CORS ou délai dépassé.
  if (!error.response) {
    const timedOut = error.code === 'ECONNABORTED';
    return new ApiError(
      timedOut
        ? 'Le serveur met trop de temps à répondre.'
        : 'Impossible de joindre le serveur. Vérifiez votre connexion et que l’API est démarrée.',
      'NETWORK_ERROR',
      0,
      'unknown',
    );
  }

  return new ApiError(
    'Une erreur inattendue est survenue.',
    'INTERNAL_ERROR',
    error.response.status,
    'unknown',
  );
}

// --- API publique ------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  /** Corps JSON, sérialisé par Axios. */
  body?: unknown;
  /** Paramètres de requête (`?page=2`). */
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Clé d'idempotence, obligatoire pour les mutations financières. */
  idempotencyKey?: string;
}

/** Exécute une requête et renvoie uniquement la charge utile `data`. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await axiosInstance.request<ApiSuccess<T>>(buildConfig(path, options));
  return response.data.data;
}

/** Variante paginée : renvoie `data` et les métadonnées de pagination. */
export async function apiRequestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; meta: PaginationMeta | undefined }> {
  const response = await axiosInstance.request<ApiSuccess<T>>(buildConfig(path, options));
  return { data: response.data.data, meta: response.data.meta };
}

/** Télécharge un fichier binaire (PDF, Excel, CSV) via un Blob. */
export async function downloadFile(path: string, defaultFilename: string): Promise<void> {
  const response = await axiosInstance.get(path, { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function buildConfig(path: string, options: RequestOptions): AxiosRequestConfig {
  const { method = 'GET', body, query, signal, idempotencyKey } = options;

  const headers = new AxiosHeaders();
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (idempotencyKey) headers.set('Idempotency-Key', idempotencyKey);

  return {
    url: path,
    method,
    headers,
    ...(body !== undefined ? { data: body } : {}),
    ...(query !== undefined ? { params: query } : {}),
    ...(signal !== undefined ? { signal } : {}),
  };
}
