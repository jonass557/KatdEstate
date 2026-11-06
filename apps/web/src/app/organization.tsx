import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from './session';

/**
 * Organisation active.
 *
 * Ce provider ne détient **aucune** autorité de sécurité : il mémorise le tenant
 * sélectionné dans l'interface. L'isolation réelle est appliquée par l'API, qui
 * vérifie la membership à chaque requête et refuse tout identifiant d'une autre
 * organisation.
 */

export interface OrganizationSummary {
  id: string;
  name: string;
  location: string;
  /** Code ISO 4217 utilisé pour le formatage monétaire. */
  currency: string;
  /** Fuseau IANA utilisé pour le rendu des dates. */
  timezone: string;
}

interface OrganizationContextValue {
  organizations: readonly OrganizationSummary[];
  /** Toujours défini : le provider affiche un état dédié si la liste est vide. */
  activeOrganization: OrganizationSummary;
  activeOrganizationId: string;
  setActiveOrganization: (id: string) => void;
}

const DEFAULT_ORGANIZATION: OrganizationSummary = {
  id: 'org-katdestate-default',
  name: 'KatdEstate Espace Principal',
  location: 'Côte d’Ivoire',
  currency: 'XOF',
  timezone: 'Africa/Abidjan',
};

const STORAGE_KEY = 'rentflow-active-organization';

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { memberships } = useSession();

  const organizations = useMemo<readonly OrganizationSummary[]>(() => {
    if (memberships && memberships.length > 0) {
      return memberships.map((membership) => ({
        id: membership.organization.id,
        name: membership.organization.name,
        location: membership.organization.country,
        currency: membership.organization.currency,
        timezone: membership.organization.timezone,
      }));
    }
    return [DEFAULT_ORGANIZATION];
  }, [memberships]);

  const [activeId, setActiveId] = useState<string>(() => readStoredId() ?? '');

  const activeOrganization =
    organizations.find((organization) => organization.id === activeId) ??
    organizations[0] ??
    DEFAULT_ORGANIZATION;

  useEffect(() => {
    if (activeOrganization && activeOrganization.id !== activeId) {
      setActiveId(activeOrganization.id);
    }
  }, [activeOrganization, activeId]);

  const handleChange = (id: string) => {
    setActiveId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<OrganizationContextValue>(() => {
    return {
      organizations,
      activeOrganization,
      activeOrganizationId: activeOrganization.id,
      setActiveOrganization: handleChange,
    };
  }, [organizations, activeOrganization]);

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization doit être utilisé à l’intérieur d’un OrganizationProvider.');
  }
  return context;
}
