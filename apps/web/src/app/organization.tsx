import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
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

/** Organisations de démonstration, utilisées uniquement en mode aperçu. */
const PREVIEW_ORGANIZATIONS: readonly OrganizationSummary[] = [
  {
    id: 'preview-dakar',
    name: 'Kora Immobilier',
    location: 'Sénégal',
    currency: 'XOF',
    timezone: 'Africa/Dakar',
  },
  {
    id: 'preview-abidjan',
    name: 'Baobab Gestion',
    location: 'Côte d’Ivoire',
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
  },
];

const STORAGE_KEY = 'rentflow-active-organization';

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

function readStoredId(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

/** Écran affiché lorsqu'un utilisateur authentifié n'a aucune organisation. */
function NoOrganizationState() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-8 text-center">
        <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Building2 className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold tracking-tight">Aucune organisation</h1>
        <p className="text-sm text-muted-foreground">
          Votre compte n’est rattaché à aucune organisation. Demandez une invitation à un
          administrateur, ou créez votre première organisation.
        </p>
      </div>
    </div>
  );
}

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { memberships, isPreview } = useSession();

  const organizations = useMemo<readonly OrganizationSummary[]>(() => {
    if (isPreview) return PREVIEW_ORGANIZATIONS;

    return memberships.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      location: membership.organization.country,
      currency: membership.organization.currency,
      timezone: membership.organization.timezone,
    }));
  }, [memberships, isPreview]);

  const [activeId, setActiveId] = useState<string>(() => readStoredId() ?? '');

  // L'organisation mémorisée peut ne plus exister (membership révoquée) : on
  // retombe alors sur la première disponible.
  const activeOrganization =
    organizations.find((organization) => organization.id === activeId) ?? organizations[0];

  useEffect(() => {
    if (activeOrganization && activeOrganization.id !== activeId) {
      setActiveId(activeOrganization.id);
    }
  }, [activeOrganization, activeId]);

  const handleChange = (id: string) => {
    setActiveId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  };

  const value = useMemo<OrganizationContextValue | null>(() => {
    if (!activeOrganization) return null;
    return {
      organizations,
      activeOrganization,
      activeOrganizationId: activeOrganization.id,
      setActiveOrganization: handleChange,
    };
  }, [organizations, activeOrganization]);

  if (!value) return <NoOrganizationState />;

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization doit être utilisé à l’intérieur d’un OrganizationProvider.');
  }
  return context;
}
