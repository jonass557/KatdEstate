import { Building2, KeyRound, Receipt, TrendingDown, Wrench } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOrganization } from '../app/organization';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { useOrgQuery } from '../lib/query';

interface Overview {
  incomeMinor: number;
  arrearsMinor: number;
  occupancyRate: number;
  availableUnits: number;
  expiringLeases: number;
  openMaintenance: number;
  expenseMinor: number;
  cashflowMinor: number;
  note?: string;
}

const ACTIONS = [
  { to: '/tenants', label: 'Ajouter un locataire' },
  { to: '/units', label: 'Ajouter un logement' },
  { to: '/payments', label: 'Enregistrer un paiement' },
  { to: '/expenses', label: 'Créer une dépense' },
  { to: '/leases', label: 'Créer un contrat' },
  { to: '/maintenance', label: 'Ajouter une maintenance' },
] as const;

function money(value: number): string {
  return value.toLocaleString('fr-FR');
}

/** Tableau de bord propriétaire. Les cartes viennent de l'API ; zéro signifie vraiment zéro. */
export function DashboardPage() {
  const { activeOrganization } = useOrganization();
  const { data } = useOrgQuery<Overview>(['dashboard'], '/dashboard');

  return (
    <div className="space-y-6">
      <PageHeader title="Tableau de bord" description={activeOrganization.name} />

      {data?.note ? <EmptyState title="Pas encore de données" description={data.note} /> : null}

      {data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenus du mois" value={money(data.incomeMinor)} hint="Encaissements enregistrés" icon={Receipt} />
          <StatCard label="Impayés" value={money(data.arrearsMinor)} hint="Échéances en retard" icon={TrendingDown} />
          <StatCard label="Occupation" value={`${data.occupancyRate} %`} hint="Logements occupés" icon={KeyRound} />
          <StatCard label="Disponibles" value={String(data.availableUnits)} hint="Logements libres" icon={Building2} />
          <StatCard label="Contrats expirants" value={String(data.expiringLeases)} hint="Sous 60 jours" icon={KeyRound} />
          <StatCard label="Maintenance" value={String(data.openMaintenance)} hint="Tickets ouverts" icon={Wrench} />
          <StatCard label="Dépenses" value={money(data.expenseMinor)} hint="Ce mois-ci" icon={TrendingDown} />
          <StatCard label="Cashflow" value={money(data.cashflowMinor)} hint="Revenus moins dépenses" icon={Receipt} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Link key={action.to} to={action.to}><Button variant="secondary">{action.label}</Button></Link>
        ))}
      </div>
    </div>
  );
}
