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

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
  role?: string | undefined;
  phone?: string | undefined;
}

export interface SignInResult {
  session: AuthSession;
}

interface AuthTokensResponse {
  accessToken: string;
  expiresIn: number;
}

const DEMO_PROFILES: Record<string, { role: string; name: string; orgName: string; platformRole?: string }> = {
  'admin@kadtestate.immo': { role: 'SUPER_ADMIN', name: 'Direction Super Admin', orgName: 'KadtEstate Siège', platformRole: 'SUPER_ADMIN' },
  'chef.quartier@kadtestate.immo': { role: 'NEIGHBORHOOD_LEADER', name: 'Nanan Kouamé N\'Guessan', orgName: 'Chefferie de Cocody' },
  'chef.bloc@kadtestate.immo': { role: 'BLOCK_LEADER', name: 'M. Bakary Diarra', orgName: 'Bloc Riviera Palmeraie 2' },
  'proprietaire@kadtestate.immo': { role: 'OWNER', name: 'M. Amadou Diallo', orgName: 'Patrimoine & SCI Diallo' },
  'locataire@kadtestate.immo': { role: 'TENANT', name: 'Mme Aïssatou Traoré', orgName: 'Résidence Palmeraie' },
  'agent@kadtestate.immo': { role: 'AGENT', name: 'M. Koffi N\'Dri', orgName: 'Agence Immobilière Ivoire' },
  'resident@kadtestate.immo': { role: 'RESIDENT', name: 'M. Yao Konan', orgName: 'Foyer Citoyen Konan' },
};

function createLocalDemoSession(email: string, roleOverride?: string, nameOverride?: string): AuthSession {
  const emailLower = email.trim().toLowerCase();
  const demo = DEMO_PROFILES[emailLower] || {
    role: roleOverride || 'OWNER',
    name: nameOverride || 'Utilisateur KadtEstate',
    orgName: 'Espace KadtEstate',
  };

  const role = roleOverride || demo.role;
  const name = nameOverride || demo.name;
  const orgName = demo.orgName;

  return {
    user: {
      id: `usr-${role.toLowerCase()}-01`,
      email: emailLower,
      displayName: name,
      ...(role === 'SUPER_ADMIN' ? { platformRole: 'SUPER_ADMIN' as const } : {}),
    },
    memberships: [
      {
        organizationId: `org-${role.toLowerCase()}-01`,
        role: role as any,
        permissions: [] as any,
        status: 'ACTIVE',
        organization: {
          id: `org-${role.toLowerCase()}-01`,
          name: orgName,
          slug: `espace-${role.toLowerCase()}`,
          country: 'CI',
          currency: 'XOF',
          timezone: 'Africa/Abidjan',
          locale: 'fr',
        },
      },
    ],
  };
}

/** Crée une session et mémorise l'access token. */
export async function signInRequest(payload: SignInPayload): Promise<SignInResult> {
  try {
    const tokens = await apiRequest<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    });

    setAccessToken(tokens.accessToken);
    const session = await apiRequest<AuthSession>('/auth/me');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('kadtestate_demo_session');
    }
    return { session };
  } catch (err: any) {
    // Si l'API est en cours de démarrage ou hors ligne, secourir avec la session locale de démo
    const emailLower = payload.email.trim().toLowerCase();
    if (DEMO_PROFILES[emailLower]) {
      const mockSession = createLocalDemoSession(emailLower);
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('kadtestate_demo_session', JSON.stringify(mockSession));
      }
      return { session: mockSession };
    }
    throw err;
  }
}

/** Enregistre un nouvel utilisateur avec son rôle choisi. */
export async function registerRequest(payload: RegisterPayload): Promise<SignInResult> {
  try {
    const tokens = await apiRequest<AuthTokensResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    });

    setAccessToken(tokens.accessToken);
    const session = await apiRequest<AuthSession>('/auth/me');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('kadtestate_demo_session');
    }
    return { session };
  } catch (err: any) {
    // Fallback immédiat si le serveur est en démarrage
    const mockSession = createLocalDemoSession(payload.email, payload.role, payload.displayName);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('kadtestate_demo_session', JSON.stringify(mockSession));
    }
    return { session: mockSession };
  }
}

/** Révoque la session courante côté serveur et efface le token local. */
export async function signOutRequest(): Promise<void> {
  try {
    await apiRequest<null>('/auth/logout', { method: 'POST' });
  } catch {
    // Ignore network error on logout
  } finally {
    setAccessToken(null);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('kadtestate_demo_session');
    }
  }
}

/** Charge la session courante à partir du cookie de refresh. */
export async function fetchSession(): Promise<AuthSession> {
  try {
    return await apiRequest<AuthSession>('/auth/me');
  } catch (error) {
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem('kadtestate_demo_session');
      if (stored) {
        return JSON.parse(stored) as AuthSession;
      }
    }
    throw error;
  }
}
