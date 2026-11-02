import { Building2, Download, FileText, Home, ShieldAlert, TrendingUp, Users, Wallet, Wrench } from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL, getAccessToken } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';
import { useOrganization } from '../app/organization';

interface PropertyBreakdown {
  propertyId: string;
  propertyName: string;
  type: string;
  city: string;
  unitsCount: number;
  occupiedCount: number;
  occupancyRate: number;
  monthlyRentPotentialMinor: number;
  monthlyCollectedMinor: number;
  arrearsMinor: number;
}

interface ManagerActivity {
  action: string;
  entityType: string;
  entityId: string;
  performedBy: string;
  createdAt: string;
}

interface OwnerOverviewData {
  portfolio: {
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number;
    totalProperties: number;
    activeLeases: number;
    expiringLeases: number;
    openMaintenanceCount: number;
  };
  financials: {
    collectedMonthlyMinor: number;
    expensesMonthlyMinor: number;
    netCashflowMinor: number;
    totalArrearsMinor: number;
    collectionRate: number;
  };
  propertiesBreakdown: PropertyBreakdown[];
  recentActivities: ManagerActivity[];
}

function money(amount: number | undefined, currency: string): string {
  if (amount === undefined) return '0 ' + currency;
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

async function openPdf(path: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Rapport propriétaire indisponible pour le moment.');
  const blob = await response.blob();
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

export function OwnerPortalPage() {
  const base = useOrgPath();
  const { activeOrganization } = useOrganization();
  const currency = activeOrganization.currency;
  const { toast } = useToast();

  const { data, isLoading, error } = useOrgQuery<OwnerOverviewData>(
    ['owner-overview'],
    '/owner/overview',
  );

  const handleDownloadReport = async () => {
    try {
      await openPdf(`${base}/owner/report/pdf`);
    } catch (err) {
      toast({
        title: 'Erreur',
        description: (err as Error).message,
        variant: 'error',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Espace Propriétaire"
          description="Synthèse de gestion, rendements et suivi opérationnel de votre patrimoine."
        />
        <div className="py-12 text-center text-sm text-muted-foreground">
          Chargement des données du portefeuille…
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Espace Propriétaire"
          description="Synthèse de gestion, rendements et suivi opérationnel de votre patrimoine."
        />
        <EmptyState
          title="Données indisponibles"
          description="Impossible de charger la vue propriétaire. Veuillez vérifier vos autorisations."
        />
      </div>
    );
  }

  const { portfolio, financials, propertiesBreakdown, recentActivities } = data;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Espace Propriétaire"
        description="Vue consolidée de l’ensemble de vos immeubles, revenus locatifs et activités de gestion."
        actions={
          <Button onClick={handleDownloadReport} className="inline-flex items-center gap-2">
            <Download className="size-4" aria-hidden />
            Télécharger le rapport exécutif (PDF)
          </Button>
        }
      />

      {/* Cartes KPI Patrimoine */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Indicateurs Clés de Rendement
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Loyers perçus ce mois"
            value={money(financials.collectedMonthlyMinor, currency)}
            hint={`Taux de recouvrement : ${financials.collectionRate}%`}
            icon={Wallet}
          />
          <StatCard
            label="Bénéfice net (Cashflow)"
            value={money(financials.netCashflowMinor, currency)}
            hint={`Dépenses : ${money(financials.expensesMonthlyMinor, currency)}`}
            icon={TrendingUp}
          />
          <StatCard
            label="Taux d’occupation"
            value={`${portfolio.occupancyRate}%`}
            hint={`${portfolio.occupiedUnits} occupés · ${portfolio.vacantUnits} vacants`}
            icon={Home}
          />
          <StatCard
            label="Impayés totaux"
            value={money(financials.totalArrearsMinor, currency)}
            hint={`${portfolio.expiringLeases} bail(s) expirant bientôt`}
            icon={ShieldAlert}
          />
        </div>
      </section>

      {/* Aperçu du parc par propriété */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Répartition par Propriété</h2>
            <p className="text-xs text-muted-foreground">
              Performances et occupation détaillée pour chacun de vos biens ({propertiesBreakdown.length} propriétés).
            </p>
          </div>
        </div>

        {propertiesBreakdown.length === 0 ? (
          <EmptyState
            title="Aucune propriété rattachée"
            description="Aucun bien immobilier n’est pour le moment configuré dans votre portefeuille."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {propertiesBreakdown.map((prop) => (
              <Card key={prop.propertyId} className="flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base font-semibold">{prop.propertyName}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {prop.type} · {prop.city}
                      </p>
                    </div>
                    <Badge className={prop.occupancyRate >= 80 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}>
                      {prop.occupancyRate}% occupé
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 text-sm">
                  <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                    <div>
                      <p className="text-muted-foreground">Lots</p>
                      <p className="font-semibold text-foreground">
                        {prop.occupiedCount} / {prop.unitsCount} occupés
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Potentiel</p>
                      <p className="font-semibold text-foreground">
                        {money(prop.monthlyRentPotentialMinor, currency)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Encaissé ce mois :</span>
                      <span className="font-medium text-emerald-600 dark:text-emerald-400">
                        {money(prop.monthlyCollectedMinor, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arriérés :</span>
                      <span className={prop.arrearsMinor > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}>
                        {money(prop.arrearsMinor, currency)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Opérations & Maintenance */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Synthèse des baux et opérations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Statut des Baux & Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-sm">Baux actifs en cours</span>
              </div>
              <span className="font-semibold">{portfolio.activeLeases}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <FileText className="size-4 text-amber-500" />
                <span className="text-sm">Baux arrivant à expiration (60 jours)</span>
              </div>
              <Badge className={portfolio.expiringLeases > 0 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' : 'bg-muted text-muted-foreground'}>
                {portfolio.expiringLeases}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wrench className="size-4 text-muted-foreground" />
                <span className="text-sm">Interventions de maintenance ouvertes</span>
              </div>
              <Badge className={portfolio.openMaintenanceCount > 0 ? 'bg-amber-500/10 text-amber-600 border border-amber-500/30' : 'bg-muted text-muted-foreground'}>
                {portfolio.openMaintenanceCount}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Audit des actions gestionnaire */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldAlert className="size-4 text-primary" />
              Activités Récentes des Gestionnaires
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivities.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aucune action récente enregistrée dans le journal d’audit.
              </p>
            ) : (
              <div className="max-h-60 space-y-3 overflow-y-auto pr-1">
                {recentActivities.map((act, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 border-b border-border/50 pb-2 text-xs last:border-0"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {act.action} · <span className="text-muted-foreground">{act.entityType}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">Par {act.performedBy}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatDate(act.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
