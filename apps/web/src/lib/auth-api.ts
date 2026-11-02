import type { AuthSession } from '@rentflow/shared';
import { apiRequest, setAccessToken } from './api-client';

/**
 * Appels du domaine identité.
 *
 * Ce module est la seule porte d'entrée vers `/auth/*` : les composants ne
 * manipulent jamais d'URL ni de token. Chaque réponse met à jour l'access token
 * en mémoire, de sorte que l'appelant n'a pas à s'en préoccuper.
 */

export interface SignInPayload {
  email: string;
  password: string;
}

export interface SignInResult {
  session: AuthSession;
}

interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
}

/** Crée une session et mémorise l'access token. */
export async function signInRequest(payload: SignInPayload): Promise<SignInResult> {
  const tokens = await apiRequest<AuthTokensResponse>('/auth/login', {
    method: 'POST',
    body: payload,
  });

  setAccessToken(tokens.accessToken);

  // La session complète (utilisateur + memberships) est récupérée dans la
  // foulée : la réponse de login ne porte que les jetons.
  const session = await apiRequest<AuthSession>('/auth/me');
  return { session };
}

/** Révoque la session courante côté serveur et efface le token local. */
export async function signOutRequest(): Promise<void> {
  try {
    await apiRequest<null>('/auth/logout', { method: 'POST' });
  } finally {
    // Même si l'appel échoue (réseau coupé), l'état local doit être purgé :
    // conserver un token après une déconnexion serait un défaut de sécurité.
    setAccessToken(null);
  }
}

/** Charge la session courante à partir du cookie de refresh. */
export async function fetchSession(): Promise<AuthSession> {
  return apiRequest<AuthSession>('/auth/me');
}
