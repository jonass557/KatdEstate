import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../app/session';
import { GlobalLoading } from './global-loading';

/**
 * Protection des routes privées.
 *
 * Trois cas distincts :
 *  - la session n'est pas encore résolue → écran de chargement, jamais de
 *    redirection prématurée (sinon un rechargement de page éjecterait un
 *    utilisateur pourtant connecté) ;
 *  - aucune session valide → redirection vers la connexion, en mémorisant la
 *    page demandée pour y revenir après authentification ;
 *  - mode aperçu (API d'identité indisponible) → accès autorisé, signalé
 *    explicitement dans l'interface.
 *
 * Ce garde-fou améliore l'expérience : il ne remplace pas le contrôle serveur.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, isAuthenticated, isPreview } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return <GlobalLoading label="Vérification de la session…" />;
  }

  if (!isAuthenticated && !isPreview) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}

/** Inverse : une page publique (connexion) redirige un utilisateur déjà connecté. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status, isAuthenticated, memberships } = useSession();
  const location = useLocation();

  if (status === 'loading') {
    return <GlobalLoading label="Vérification de la session…" />;
  }

  if (isAuthenticated) {
    const state = location.state as { from?: string } | null;
    const isTenant = memberships.some((membership) => membership.role === 'TENANT');
    return <Navigate to={state?.from ?? (isTenant ? '/portal' : '/dashboard')} replace />;
  }

  return <>{children}</>;
}
