import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Building2 } from 'lucide-react';
import { apiRequest } from '../lib/api-client';

interface PlatformOverview {
  users: number;
  organizations: number;
  subscriptions: number;
  trialing: number;
  mrrMinor: number;
}

/**
 * Panneau super admin. Il interroge /platform, qui refuse tout autre rôle.
 * Les chiffres sont des comptages réels ; un déploiement vide affiche zéro.
 */
export function PlatformPage() {
  const { data, error } = useQuery({
    queryKey: ['platform-overview'],
    queryFn: () => apiRequest<PlatformOverview>('/platform/overview'),
    retry: false,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Plateforme"
        description="Organisations, abonnements et activité. Réservé au super administrateur."
      />
      {error ? (
        <p className="text-sm text-destructive">Accès refusé ou plateforme indisponible.</p>
      ) : null}
      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Utilisateurs"
            value={String(data.users)}
            hint="Comptes"
            icon={Building2}
          />
          <StatCard
            label="Organisations"
            value={String(data.organizations)}
            hint="Tous statuts"
            icon={Building2}
          />
          <StatCard
            label="Essais en cours"
            value={String(data.trialing)}
            hint={`${data.subscriptions} abonnements`}
            icon={Building2}
          />
          <StatCard
            label="MRR"
            value={data.mrrMinor.toLocaleString('fr-FR')}
            hint="Somme des plans actifs"
            icon={Building2}
          />
        </div>
      ) : null}
    </div>
  );
}
