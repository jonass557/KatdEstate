import { useQuery } from '@tanstack/react-query';
import type { PaginationMeta } from '@rentflow/shared';
import { apiRequest, apiRequestWithMeta } from './api-client';
import { useOrganization } from '../app/organization';

/** Préfixe scopé à l'organisation active. L'API revérifie l'accès à chaque appel. */
export function useOrgPath(): string {
  const { activeOrganizationId } = useOrganization();
  return `/organizations/${activeOrganizationId}`;
}

export function useOrgQuery<T>(key: readonly unknown[], path: string, enabled = true) {
  const base = useOrgPath();
  return useQuery({
    queryKey: [base, ...key],
    queryFn: () => apiRequest<T>(`${base}${path}`),
    enabled,
  });
}

export function useOrgList<T>(key: readonly unknown[], path: string) {
  const base = useOrgPath();
  return useQuery({
    queryKey: [base, ...key],
    queryFn: () => apiRequestWithMeta<T[]>(`${base}${path}`),
  });
}

export type { PaginationMeta };
