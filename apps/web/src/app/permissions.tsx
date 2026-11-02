import type { Permission } from '@rentflow/shared';
import { hasAnyPermission, hasPermission, resolvePermissions } from '@rentflow/shared';
import { useCallback, useMemo } from 'react';
import { useOrganization } from './organization';
import { PREVIEW_PERMISSIONS, useSession } from './session';

/**
 * Permissions effectives pour l'organisation active.
 *
 * Elles proviennent de la membership renvoyée par l'API. Si le serveur a déjà
 * résolu la liste, elle est utilisée telle quelle ; sinon elle est dérivée du
 * rôle via le catalogue partagé — la même fonction que celle employée côté API,
 * ce qui évite toute divergence entre les deux.
 *
 * Rappel : ces permissions pilotent l'**affichage**. Elles ne constituent jamais
 * une frontière de sécurité, l'API revalidant chaque requête.
 */
export function usePermissions(): readonly Permission[] {
  const { memberships, isPreview } = useSession();
  const { activeOrganizationId } = useOrganization();

  return useMemo(() => {
    if (isPreview) return PREVIEW_PERMISSIONS;

    const membership = memberships.find((entry) => entry.organizationId === activeOrganizationId);
    if (!membership) return [];

    return membership.permissions.length > 0
      ? membership.permissions
      : resolvePermissions(membership.role);
  }, [memberships, activeOrganizationId, isPreview]);
}

/** Test d'une permission unique. */
export function useCan(): (permission: Permission) => boolean {
  const permissions = usePermissions();
  return useCallback(
    (permission: Permission) => hasPermission(permissions, permission),
    [permissions],
  );
}

/** Test « au moins une de ces permissions ». */
export function useCanAny(): (permissions: readonly Permission[]) => boolean {
  const granted = usePermissions();
  return useCallback(
    (required: readonly Permission[]) => hasAnyPermission(granted, required),
    [granted],
  );
}
