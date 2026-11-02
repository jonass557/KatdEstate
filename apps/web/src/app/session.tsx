import type { MembershipWithOrganization, Permission, UserSummary } from '@rentflow/shared';
import { PERMISSIONS } from '@rentflow/shared';
import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, setUnauthorizedHandler } from '../lib/api-client';
import { fetchSession, signInRequest, signOutRequest, type SignInPayload } from '../lib/auth-api';

/**
 * État de session de l'application.
 *
 * `unavailable` mérite une explication : il signale que l'API d'identité n'est
 * pas joignable *ou* pas encore livrée (404). Dans ce cas seulement, l'interface
 * bascule en **mode aperçu** clairement signalé, ce qui permet d'explorer la
 * coquille applicative sans faire croire à une session authentifiée. Dès que les
 * routes `/auth/*` existent, ce mode disparaît de lui-même — aucun code à changer.
 */
export type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'unavailable';

interface SessionContextValue {
  status: SessionStatus;
  /** Vrai tant que la session initiale n'a pas été résolue. */
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Vrai uniquement quand l'API d'identité est indisponible. */
  isPreview: boolean;
  user: UserSummary | null;
  memberships: readonly MembershipWithOrganization[];
  /** Recharge la session depuis l'API. */
  reload: () => Promise<void>;
  signIn: (payload: SignInPayload) => Promise<MembershipWithOrganization[]>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function classifyFailure(error: unknown): SessionStatus {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'unauthenticated';
    // 404 : les routes d'identité ne sont pas encore déployées.
    // 0 : l'API est injoignable (serveur arrêté, hors ligne).
    if (error.status === 404 || error.isNetworkError) return 'unavailable';
  }
  // Toute autre erreur (500, réponse illisible) laisse l'utilisateur dehors
  // plutôt que de lui accorder un accès par défaut.
  return 'unauthenticated';
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('loading');
  const [user, setUser] = useState<UserSummary | null>(null);
  const [memberships, setMemberships] = useState<readonly MembershipWithOrganization[]>([]);

  const applySession = useCallback(
    (session: { user: UserSummary; memberships: MembershipWithOrganization[] }) => {
      setUser(session.user);
      setMemberships(session.memberships);
      setStatus('authenticated');
    },
    [],
  );

  const clearSession = useCallback(() => {
    setUser(null);
    setMemberships([]);
  }, []);

  const reload = useCallback(async () => {
    try {
      const session = await fetchSession();
      applySession(session);
    } catch (error) {
      clearSession();
      setStatus(classifyFailure(error));
    }
  }, [applySession, clearSession]);

  // Résolution de la session au premier rendu.
  useEffect(() => {
    void reload();
  }, [reload]);

  // Quand le rafraîchissement d'un token échoue définitivement, la session est
  // close : l'utilisateur est renvoyé à l'écran de connexion.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setStatus('unauthenticated');
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  const signIn = useCallback(
    async (payload: SignInPayload) => {
      const { session } = await signInRequest(payload);
      applySession(session);
      return session.memberships;
    },
    [applySession],
  );

  const signOut = useCallback(async () => {
    await signOutRequest();
    clearSession();
    setStatus('unauthenticated');
  }, [clearSession]);

  const value = useMemo<SessionContextValue>(
    () => ({
      status,
      isLoading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      isPreview: status === 'unavailable',
      user,
      memberships,
      reload,
      signIn,
      signOut,
    }),
    [status, user, memberships, reload, signIn, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession doit être utilisé à l’intérieur d’un SessionProvider.');
  }
  return context;
}

/**
 * Catalogue de permissions applicable en mode aperçu.
 *
 * Volontairement complet : sans API, il n'existe aucune source d'autorité. Il
 * n'est utilisé que pour rendre l'interface explorable, jamais pour autoriser
 * une opération serveur — l'API revalide chaque requête de toute façon.
 */
export const PREVIEW_PERMISSIONS: readonly Permission[] = PERMISSIONS;
