import type { AuthSession } from '@rentflow/shared';
import { apiRequest, setAccessToken } from './api-client';
import {
  getBlockLeaders,
  getBlockOwners,
  getMandateCredentials,
  getRegisteredUsers,
  saveRegisteredUser,
  STORAGE_TENANT_CREDENTIALS_KEY,
  STORAGE_TENANTS_LIST_KEY,
} from './katdestate-store';

/**
 * Appels du domaine identité.
 *
 * Authentification sécurisée :
 * - Seuls les comptes inscrits via `/register`, les comptes démo officiels,
 *   et les identifiants créés par un propriétaire (Locataires & Mandataires)
 *   peuvent se connecter sans inscription préalable.
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

export const DEMO_PROFILES: Record<
  string,
  { role: string; name: string; orgName: string; platformRole?: string }
> = {
  'admin@katdestate.immo': {
    role: 'SUPER_ADMIN',
    name: 'Direction Super Admin',
    orgName: 'KatdEstate Siège',
    platformRole: 'SUPER_ADMIN',
  },
  'chef.quartier@katdestate.immo': {
    role: 'NEIGHBORHOOD_LEADER',
    name: "Nanan Kouamé N'Guessan",
    orgName: 'Chefferie de Cocody',
  },
  'chef.bloc@katdestate.immo': {
    role: 'BLOCK_LEADER',
    name: 'M. Bakary Diarra',
    orgName: 'Bloc Riviera Palmeraie 2',
  },
  'proprietaire@katdestate.immo': {
    role: 'OWNER',
    name: 'M. Amadou Diallo',
    orgName: 'Patrimoine & SCI Diallo',
  },
  'locataire@katdestate.immo': {
    role: 'TENANT',
    name: 'Mme Aïssatou Traoré',
    orgName: 'Résidence Palmeraie',
  },
  'agent@katdestate.immo': {
    role: 'AGENT',
    name: "M. Koffi N'Dri",
    orgName: 'Agence Immobilière Ivoire',
  },
  'resident@katdestate.immo': {
    role: 'RESIDENT',
    name: 'M. Yao Konan',
    orgName: 'Foyer Citoyen Konan',
  },
  'admin@kadtestate.immo': {
    role: 'SUPER_ADMIN',
    name: 'Direction Super Admin',
    orgName: 'KatdEstate Siège',
    platformRole: 'SUPER_ADMIN',
  },
  'chef.quartier@kadtestate.immo': {
    role: 'NEIGHBORHOOD_LEADER',
    name: "Nanan Kouamé N'Guessan",
    orgName: 'Chefferie de Cocody',
  },
  'chef.bloc@kadtestate.immo': {
    role: 'BLOCK_LEADER',
    name: 'M. Bakary Diarra',
    orgName: 'Bloc Riviera Palmeraie 2',
  },
  'proprietaire@kadtestate.immo': {
    role: 'OWNER',
    name: 'M. Amadou Diallo',
    orgName: 'Patrimoine & SCI Diallo',
  },
  'locataire@kadtestate.immo': {
    role: 'TENANT',
    name: 'Mme Aïssatou Traoré',
    orgName: 'Résidence Palmeraie',
  },
  'agent@kadtestate.immo': {
    role: 'AGENT',
    name: "M. Koffi N'Dri",
    orgName: 'Agence Immobilière Ivoire',
  },
  'resident@kadtestate.immo': {
    role: 'RESIDENT',
    name: 'M. Yao Konan',
    orgName: 'Foyer Citoyen Konan',
  },
};

const STORAGE_SESSION_KEY = 'katdestate_active_session';
export const STORAGE_ACTIVE_TENANT_PROFILE_KEY = 'katdestate_active_tenant_profile';

function createSessionForRole(
  email: string,
  role: string,
  displayName: string,
  orgName: string = 'Espace KatdEstate',
): AuthSession {
  const emailLower = email.trim().toLowerCase();
  return {
    user: {
      id: `usr-${role.toLowerCase()}-${Date.now().toString(36)}`,
      email: emailLower,
      displayName,
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

export function saveLocalSession(session: AuthSession) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getSavedLocalSession(): AuthSession | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) return JSON.parse(stored) as AuthSession;
    }
    if (typeof sessionStorage !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_SESSION_KEY);
      if (stored) return JSON.parse(stored) as AuthSession;
    }
  } catch {
    // Ignore JSON parse errors
  }
  return null;
}

export function clearSavedLocalSession() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_SESSION_KEY);
      localStorage.removeItem(STORAGE_ACTIVE_TENANT_PROFILE_KEY);
    }
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(STORAGE_SESSION_KEY);
    }
  } catch {}
}

/**
 * Vérifie si les identifiants correspondent à :
 * 1. Un locataire créé par un propriétaire
 * 2. Un mandataire / gestionnaire délégué créé par un propriétaire
 * 3. Un utilisateur inscrit via /register
 * 4. Un compte démo officiel
 */
function checkAuthorizedLocalAccount(
  emailRaw: string,
  passwordRaw: string,
): AuthSession | null {
  const emailLower = emailRaw.trim().toLowerCase();
  const pwd = passwordRaw.trim();

  if (typeof window !== 'undefined') {
    // 1. Vérifier les locataires créés par le propriétaire
    try {
      const credsMap: Record<string, string> = JSON.parse(
        localStorage.getItem(STORAGE_TENANT_CREDENTIALS_KEY) || '{}',
      );
      const customTenants: any[] = JSON.parse(
        localStorage.getItem(STORAGE_TENANTS_LIST_KEY) || '[]',
      );

      // Chercher le locataire par email (insensible à la casse)
      const matchedTenant = customTenants.find(
        (t) => t.email && String(t.email).trim().toLowerCase() === emailLower,
      );

      // Chercher le mot de passe enregistré dans credsMap (clé exacte ou minuscule)
      let expectedTenantPassword: string | undefined =
        credsMap[emailLower] || credsMap[emailRaw.trim()];
      if (!expectedTenantPassword) {
        const matchingKey = Object.keys(credsMap).find(
          (k) => k.trim().toLowerCase() === emailLower,
        );
        if (matchingKey) expectedTenantPassword = credsMap[matchingKey];
      }
      if (!expectedTenantPassword && matchedTenant?.loginPassword) {
        expectedTenantPassword = String(matchedTenant.loginPassword);
      }

      if (matchedTenant || expectedTenantPassword) {
        if (expectedTenantPassword && pwd !== expectedTenantPassword.trim()) {
          throw new Error(
            'Mot de passe locataire incorrect. Veuillez vérifier les identifiants transmis par votre propriétaire.',
          );
        }
        const tenantName = matchedTenant?.fullName || emailLower.split('@')[0] || 'Locataire';
        const orgName = matchedTenant?.propertyName || 'Résidence KatdEstate';
        if (matchedTenant) {
          localStorage.setItem(
            STORAGE_ACTIVE_TENANT_PROFILE_KEY,
            JSON.stringify(matchedTenant),
          );
        }
        return createSessionForRole(emailLower, 'TENANT', tenantName, orgName);
      }
    } catch (e: any) {
      if (e instanceof Error && e.message.includes('Mot de passe locataire incorrect')) {
        throw e;
      }
    }

    // 2. Vérifier les mandataires créés par le propriétaire
    const mandates = getMandateCredentials();
    const matchedMandate = mandates.find(
      (m) => m.managerEmail.trim().toLowerCase() === emailLower,
    );
    if (matchedMandate) {
      if (matchedMandate.status === 'REVOKED') {
        throw new Error('Ce mandat de gestion a été révoqué par le propriétaire.');
      }
      if (matchedMandate.password && pwd !== matchedMandate.password.trim()) {
        throw new Error(
          'Mot de passe mandataire incorrect. Veuillez vérifier les identifiants fournis par le propriétaire.',
        );
      }
      return createSessionForRole(
        emailLower,
        'OWNER',
        `${matchedMandate.managerName} (Mandataire)`,
        matchedMandate.propertyName || 'Patrimoine Sous Mandat',
      );
    }

    // 3. Vérifier les chefs de bloc créés par le chef de quartier
    const blockLeaders = getBlockLeaders();
    const matchedBlockLeader = blockLeaders.find(
      (l) => l.email.trim().toLowerCase() === emailLower,
    );
    if (matchedBlockLeader) {
      if (matchedBlockLeader.password && pwd !== matchedBlockLeader.password.trim()) {
        throw new Error(
          'Mot de passe Chef de Bloc incorrect. Veuillez vérifier les identifiants transmis par le Chef de Quartier.',
        );
      }
      return createSessionForRole(
        emailLower,
        'BLOCK_LEADER',
        `${matchedBlockLeader.name} (Chef de Bloc)`,
        `${matchedBlockLeader.blockName} • ${matchedBlockLeader.neighborhoodName}`,
      );
    }

    // 4. Vérifier les propriétaires créés par le chef de bloc
    const blockOwners = getBlockOwners();
    const matchedBlockOwner = blockOwners.find(
      (o) => o.email.trim().toLowerCase() === emailLower,
    );
    if (matchedBlockOwner) {
      if (matchedBlockOwner.password && pwd !== matchedBlockOwner.password.trim()) {
        throw new Error(
          'Mot de passe Propriétaire incorrect. Veuillez vérifier les identifiants transmis par le Chef de Bloc.',
        );
      }
      return createSessionForRole(
        emailLower,
        'OWNER',
        `${matchedBlockOwner.fullName} (Propriétaire)`,
        `${matchedBlockOwner.propertyName} (${matchedBlockOwner.blockName})`,
      );
    }

    // 5. Vérifier les utilisateurs inscrits sur la plateforme
    const registeredUsers = getRegisteredUsers();
    const matchedUser = registeredUsers.find(
      (u) => u.email.trim().toLowerCase() === emailLower,
    );
    if (matchedUser) {
      if (matchedUser.password && pwd !== matchedUser.password.trim()) {
        throw new Error('Mot de passe incorrect pour ce compte.');
      }
      return createSessionForRole(
        emailLower,
        matchedUser.role || 'OWNER',
        matchedUser.displayName || emailLower,
        'Espace KatdEstate',
      );
    }
  }

  // 4. Vérifier les comptes démo officiels
  const demo = DEMO_PROFILES[emailLower];
  if (demo) {
    return createSessionForRole(emailLower, demo.role, demo.name, demo.orgName);
  }

  return null;
}

/** Crée une session et mémorise l'access token. */
export async function signInRequest(payload: SignInPayload): Promise<SignInResult> {
  // 1. Vérifier d'abord si c'est un compte locataire, mandataire, inscrit localement ou démo
  const localAuthorizedSession = checkAuthorizedLocalAccount(payload.email, payload.password);

  try {
    const tokens = await apiRequest<AuthTokensResponse>('/auth/login', {
      method: 'POST',
      body: payload,
    });

    setAccessToken(tokens.accessToken);
    const session = await apiRequest<AuthSession>('/auth/me');

    // Si c'est un locataire créé par le propriétaire, s'assurer que son rôle TENANT est respecté
    if (
      localAuthorizedSession &&
      localAuthorizedSession.memberships[0]?.role === 'TENANT' &&
      session.memberships[0]?.role !== 'TENANT'
    ) {
      saveLocalSession(localAuthorizedSession);
      return { session: localAuthorizedSession };
    }

    saveLocalSession(session);
    return { session };
  } catch (err: any) {
    // Si le compte est autorisé (Locataire créé par propriétaire, Mandataire, Utilisateur inscrit ou Démo officielle)
    if (localAuthorizedSession) {
      setAccessToken(`token-${localAuthorizedSession.user.id}`);
      saveLocalSession(localAuthorizedSession);
      return { session: localAuthorizedSession };
    }

    // Sinon : REFUSER la connexion aux comptes non inscrits !
    throw new Error(
      "Accès refusé : Ce compte n'est pas inscrit ou vos identifiants sont incorrects. Veuillez d'abord créer un compte ou utiliser les identifiants fournis par votre propriétaire.",
    );
  }
}

/** Enregistre un nouvel utilisateur avec son rôle choisi. */
export async function registerRequest(payload: RegisterPayload): Promise<SignInResult> {
  // Mémoriser systématiquement l'utilisateur inscrit dans le registre local
  saveRegisteredUser({
    email: payload.email.trim().toLowerCase(),
    password: payload.password.trim(),
    displayName: payload.displayName.trim(),
    role: payload.role || 'OWNER',
    phone: payload.phone,
    createdAt: new Date().toISOString(),
  });

  try {
    const tokens = await apiRequest<AuthTokensResponse>('/auth/register', {
      method: 'POST',
      body: payload,
    });

    setAccessToken(tokens.accessToken);
    const session = await apiRequest<AuthSession>('/auth/me');
    saveLocalSession(session);
    return { session };
  } catch (err: any) {
    const session = createSessionForRole(
      payload.email,
      payload.role || 'OWNER',
      payload.displayName,
      'Espace KatdEstate',
    );
    setAccessToken(`token-${session.user.id}`);
    saveLocalSession(session);
    return { session };
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
    clearSavedLocalSession();
  }
}

/** Charge la session courante à partir du cookie de refresh ou du cache local. */
export async function fetchSession(): Promise<AuthSession> {
  try {
    const session = await apiRequest<AuthSession>('/auth/me');
    saveLocalSession(session);
    return session;
  } catch (error) {
    const local = getSavedLocalSession();
    if (local) {
      return local;
    }
    throw error;
  }
}
