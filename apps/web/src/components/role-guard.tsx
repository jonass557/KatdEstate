import type { Permission } from '@rentflow/shared';
import { ShieldAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useCan, useCanAny } from '../app/permissions';
import { useSession } from '../app/session';
import { buttonVariants } from './ui/button';

/**
 * Garde d'affichage par permission.
 *
 * Deux usages, à ne pas confondre :
 *  - `<Can>` masque une action ponctuelle (un bouton, une colonne) sans casser
 *    la page ;
 *  - `<RequirePermission>` protège une route entière et affiche un refus clair.
 *
 * Dans les deux cas il s'agit de confort et de clarté : la décision
 * d'autorisation appartient au serveur, qui revalide chaque requête.
 */

interface CanProps {
  permission: Permission;
  children: ReactNode;
  /** Contenu de remplacement quand la permission manque (rien par défaut). */
  fallback?: ReactNode;
}

export function Can({ permission, children, fallback = null }: CanProps) {
  const can = useCan();
  return <>{can(permission) ? children : fallback}</>;
}

interface CanAnyProps {
  permissions: readonly Permission[];
  children: ReactNode;
  fallback?: ReactNode;
}

export function CanAny({ permissions, children, fallback = null }: CanAnyProps) {
  const canAny = useCanAny();
  return <>{canAny(permissions) ? children : fallback}</>;
}

/** Écran de refus, cohérent avec le reste de l'application. */
function ForbiddenState({ permission }: { permission?: Permission }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
          <ShieldAlert className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Accès non autorisé</h1>
        <p className="text-sm text-muted-foreground">
          Votre rôle dans cette organisation ne permet pas d’accéder à cette section.
        </p>
        {permission ? (
          <p className="text-xs text-muted-foreground">
            Permission requise : <code className="font-mono">{permission}</code>
          </p>
        ) : null}
        <Link to="/" className={buttonVariants('secondary', 'mt-2')}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}

interface RequirePermissionProps {
  permission: Permission;
  children: ReactNode;
}

export function RequirePermission({ permission, children }: RequirePermissionProps) {
  const can = useCan();
  const { user, memberships } = useSession();
  const role =
    (user as unknown as { role?: string; platformRole?: string })?.role ||
    (user as unknown as { role?: string; platformRole?: string })?.platformRole ||
    memberships[0]?.role;

  // Le propriétaire, le super administrateur et l'administrateur ont un accès total sans restriction
  if (role === 'OWNER' || role === 'SUPER_ADMIN' || role === 'ADMIN') {
    return <>{children}</>;
  }

  if (!can(permission)) return <ForbiddenState permission={permission} />;
  return <>{children}</>;
}

export { ForbiddenState };
