import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { maintenanceTicketInputSchema, transactionInputSchema } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgList, useOrgPath, useOrgQuery } from '../lib/query';
import { AlertTriangle, Bell, Clock, Droplets, Wrench, Zap } from 'lucide-react';

interface Ticket { _id: string; title: string; category: string; priority: string; status: string }
interface MaintenanceStats { open: number; urgent: number; costMinor: number; averageResolutionDays: number }

const PRIORITY_LABELS: Record<string, string> = { LOW: 'Basse', MEDIUM: 'Moyenne', HIGH: 'Haute', URGENT: 'Urgente' };
const TICKET_STATUS: Record<string, string> = {
  OPEN: 'Ouvert', ASSIGNED: 'Attribué', IN_PROGRESS: 'En cours', WAITING: 'En attente', RESOLVED: 'Résolu', CLOSED: 'Clos',
};

export function MaintenancePage() {
  const [open, setOpen] = useState(false);
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgList<Ticket>(['maintenance'], '/maintenance?pageSize=50');
  const stats = useOrgQuery<MaintenanceStats>(['maintenance-stats'], '/maintenance/stats');

  const create = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/maintenance`, { method: 'POST', body }),
    onSuccess: () => { void client.invalidateQueries(); setOpen(false); toast({ title: 'Ticket ouvert', variant: 'success' }); },
    onError: (error: Error) => toast({ title: 'Création impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Maintenance" description="Signalements, interventions et coûts." actions={<Button onClick={() => setOpen((value) => !value)}>Signaler un problème</Button>} />

      {stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Ouverts" value={String(stats.data.open)} hint="Tickets non clos" icon={Wrench} />
          <StatCard label="Urgents" value={String(stats.data.urgent)} hint="Priorité urgente" icon={AlertTriangle} />
          <StatCard label="Coût réel" value={stats.data.costMinor.toLocaleString('fr-FR')} hint="Interventions terminées" icon={Wrench} />
          <StatCard label="Délai moyen" value={`${stats.data.averageResolutionDays} j`} hint="Jusqu’à résolution" icon={Clock} />
        </div>
      ) : null}

      {open ? (
        <form
          className="max-w-xl space-y-3 rounded-2xl border border-border p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const parsed = maintenanceTicketInputSchema.safeParse({
              category: form.get('category'),
              title: form.get('title'),
              description: form.get('description') || undefined,
              priority: form.get('priority'),
            });
            if (!parsed.success) { toast({ title: 'Formulaire invalide', description: parsed.error.issues[0]?.message, variant: 'error' }); return; }
            create.mutate(parsed.data);
          }}
        >
          <Input name="title" placeholder="Titre" required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input name="category" placeholder="Catégorie (plomberie, électricité…)" required />
            <select name="priority" className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <textarea name="description" rows={3} placeholder="Description" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit" disabled={create.isPending}>Créer le ticket</Button>
        </form>
      ) : null}

      <div className="space-y-2">
        {(data?.data ?? []).map((ticket) => (
          <div key={ticket._id} className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="font-medium">{ticket.title}</p>
              <p className="text-xs text-muted-foreground">{ticket.category} · {PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</p>
            </div>
            <Badge>{TICKET_STATUS[ticket.status] ?? ticket.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

interface Report {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
  incomeByMonth: { month: string; total: number }[];
  expenseByCategory: { category: string; total: number }[];
  occupancyRate: number;
  arrearsRate: number;
}

const CATEGORIES = [
  ['MAINTENANCE', 'Entretien & Réparations'],
  ['REPAIR', 'Grosses réparations'],
  ['RENOVATION', 'Travaux de rénovation'],
  ['WATER', 'Factures d’eau'],
  ['ELECTRICITY', 'Électricité'],
  ['SALARIES', 'Salaires du personnel'],
  ['ADMINISTRATIVE', 'Frais administratifs & gestion'],
  ['TAXES', 'Impôts & Taxes foncières'],
  ['INSURANCE', 'Assurances'],
  ['INTERNET', 'Internet & Télécoms'],
  ['SECURITY', 'Sécurité & Gardiennage'],
  ['CLEANING', 'Nettoyage & Propreté'],
  ['OTHER', 'Dépenses diverses'],
] as const;

const EXPENSE_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente de validation',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
  PAID: 'Payée',
};

export function ExpensesPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [openCreate, setOpenCreate] = useState(false);

  const now = new Date();
  const from = `${now.getFullYear()}-01-01`;
  const to = `${now.getFullYear()}-12-31`;
  const report = useOrgQuery<Report>(['report', from, to], `/reports/finance?from=${from}&to=${to}`);

  const queryParams = new URLSearchParams({ pageSize: '50' });
  if (statusFilter) queryParams.set('status', statusFilter);
  if (categoryFilter) queryParams.set('category', categoryFilter);

  const { data } = useOrgList<{
    _id: string;
    label: string;
    direction: string;
    category: string;
    amountMinor: number;
    date: string;
    payee?: string;
    status: string;
    rejectionReason?: string;
  }>(['transactions', statusFilter, categoryFilter], `/transactions?${queryParams.toString()}`);

  const create = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/transactions`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpenCreate(false);
      toast({ title: 'Dépense enregistrée', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Enregistrement impossible', description: error.message, variant: 'error' }),
  });

  const approve = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/transactions/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Dépense approuvée', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`${base}/transactions/${id}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      void client.invalidateQueries();
      setRejectId(null);
      setRejectReason('');
      toast({ title: 'Dépense rejetée', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const pay = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/transactions/${id}/pay`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Dépense marquée comme payée', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des dépenses & charges"
        description="Circuit de validation des dépenses, prestataires, et suivi budgétaire."
        actions={<Button onClick={() => setOpenCreate((v) => !v)}>{openCreate ? 'Fermer le formulaire' : 'Nouvelle dépense'}</Button>}
      />

      {report.data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Revenus" value={`${report.data.incomeMinor.toLocaleString('fr-FR')} FCFA`} hint="Encaissements de l'année" icon={Zap} />
          <StatCard label="Total Dépenses" value={`${report.data.expenseMinor.toLocaleString('fr-FR')} FCFA`} hint="Dépenses engagées" icon={Wrench} />
          <StatCard
            label="Bénéfice net"
            value={`${report.data.netMinor.toLocaleString('fr-FR')} FCFA`}
            hint={`Taux d'occupation ${report.data.occupancyRate} % · Impayés ${report.data.arrearsRate} %`}
            icon={Droplets}
          />
        </div>
      ) : null}

      {openCreate ? (
        <form
          className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const parsed = transactionInputSchema.safeParse({
              direction: form.get('direction'),
              category: form.get('category'),
              amountMinor: Number(form.get('amountMinor')),
              date: form.get('date'),
              label: form.get('label'),
              payee: form.get('payee') || undefined,
              note: form.get('note') || undefined,
              status: form.get('direction') === 'EXPENSE' ? 'PENDING' : 'APPROVED',
            });
            if (!parsed.success) {
              toast({ title: 'Formulaire invalide', description: parsed.error.issues[0]?.message, variant: 'error' });
              return;
            }
            create.mutate(parsed.data);
          }}
        >
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type d'opération</label>
            <select name="direction" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              <option value="EXPENSE">Dépense / Décaissement</option>
              <option value="INCOME">Autre recette / Encaissement</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
            <select name="category" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
              {CATEGORIES.map(([cat, label]) => (
                <option key={cat} value={cat}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Montant (FCFA)</label>
            <Input name="amountMinor" type="number" min={1} placeholder="Ex: 50000" required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Date de l'opération</label>
            <Input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Bénéficiaire / Fournisseur</label>
            <Input name="payee" placeholder="Ex: SONEB, Électricien Alpha..." />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Libellé</label>
            <Input name="label" placeholder="Description de la dépense" required />
          </div>
          <div className="sm:col-span-3">
            <label className="text-xs font-medium text-muted-foreground">Note / Justificatif</label>
            <Input name="note" placeholder="Détails complémentaires, numéro de facture fournisseur..." />
          </div>
          <div className="sm:col-span-3 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>Annuler</Button>
            <Button type="submit" disabled={create.isPending}>Soumettre la dépense</Button>
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Toutes les catégories</option>
          {CATEGORIES.map(([cat, label]) => (
            <option key={cat} value={cat}>{label}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(EXPENSE_STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Libellé</th>
              <th className="px-4 py-3 font-medium">Bénéficiaire</th>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((transaction) => (
              <tr key={transaction._id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{transaction.date.slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium">{transaction.label}</p>
                    {transaction.rejectionReason ? (
                      <p className="text-xs text-rose-600">Rejet : {transaction.rejectionReason}</p>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{transaction.payee || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {CATEGORIES.find(([c]) => c === transaction.category)?.[1] ?? transaction.category}
                </td>
                <td className="px-4 py-3 font-semibold">
                  <span className={transaction.direction === 'EXPENSE' ? 'text-rose-600' : 'text-emerald-600'}>
                    {transaction.direction === 'EXPENSE' ? '−' : '+'}{transaction.amountMinor.toLocaleString('fr-FR')} FCFA
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge>{EXPENSE_STATUS_LABELS[transaction.status] ?? transaction.status}</Badge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    {transaction.status === 'PENDING' ? (
                      <>
                        <Button
                          variant="secondary"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => approve.mutate(transaction._id)}
                          disabled={approve.isPending}
                        >
                          Approuver
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => setRejectId(transaction._id)}
                        >
                          Rejeter
                        </Button>
                      </>
                    ) : null}
                    {transaction.status === 'APPROVED' ? (
                      <Button
                        variant="secondary"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => pay.mutate(transaction._id)}
                        disabled={pay.isPending}
                      >
                        Payer
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {(data?.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Aucune transaction enregistrée.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl">
            <h3 className="text-base font-semibold">Rejeter la dépense</h3>
            <p className="mt-1 text-sm text-muted-foreground">Indiquez le motif de rejet pour la traçabilité d'audit.</p>
            <div className="mt-4">
              <Input
                placeholder="Ex: Justificatif manquant, montant non conforme..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectId(null)}>Annuler</Button>
              <Button
                variant="secondary"
                className="text-rose-600 hover:text-rose-700"
                disabled={!rejectReason.trim() || reject.isPending}
                onClick={() => reject.mutate({ id: rejectId, reason: rejectReason.trim() })}
              >
                Confirmer le rejet
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface FinancialDashboardData {
  totals: {
    totalRevenueMinor: number;
    monthlyRevenueMinor: number;
    annualRevenueMinor: number;
    totalExpensesMinor: number;
    netProfitMinor: number;
    rentCollectedMinor: number;
    rentOverdueMinor: number;
    recoveryRate: number;
    totalTenantDebtsMinor: number;
  };
  monthlyTrend: {
    month: string;
    billedMinor: number;
    collectedMinor: number;
    expensesMinor: number;
  }[];
  expensesByCategory: {
    category: string;
    totalMinor: number;
  }[];
  profitabilityByProperty: {
    propertyId: string;
    propertyName: string;
    incomeMinor: number;
    expensesMinor: number;
    netProfitMinor: number;
  }[];
  debtors: {
    tenantId: string;
    debtMinor: number;
    oldestOverdueDays: number;
  }[];
}

export function AnalyticsPage() {
  const dashboard = useOrgQuery<FinancialDashboardData>(['finance-dashboard'], '/finance/dashboard');

  const totals = dashboard.data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord financier & Trésorerie"
        description="Indicateurs de performance financière, rentabilité par bien, recouvrement et évolution."
      />

      {totals ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Revenus encaissés"
            value={`${totals.totalRevenueMinor.toLocaleString('fr-FR')} FCFA`}
            hint={`Mois en cours : ${totals.monthlyRevenueMinor.toLocaleString('fr-FR')} FCFA`}
            icon={Zap}
          />
          <StatCard
            label="Dépenses totales"
            value={`${totals.totalExpensesMinor.toLocaleString('fr-FR')} FCFA`}
            hint="Charges et opérations payées"
            icon={Wrench}
          />
          <StatCard
            label="Bénéfice net"
            value={`${totals.netProfitMinor.toLocaleString('fr-FR')} FCFA`}
            hint={`Recouvrement : ${totals.recoveryRate} %`}
            icon={Droplets}
          />
          <StatCard
            label="Dettes locataires"
            value={`${totals.totalTenantDebtsMinor.toLocaleString('fr-FR')} FCFA`}
            hint={`Impayés échus : ${totals.rentOverdueMinor.toLocaleString('fr-FR')} FCFA`}
            icon={AlertTriangle}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Évolution sur 12 mois (Loyers attendus vs Encaissés vs Dépenses)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.data?.monthlyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="collectedMinor" name="Encaissé" fill="#10b981" />
                <Bar dataKey="expensesMinor" name="Dépenses" fill="#ef4444" />
                <Bar dataKey="billedMinor" name="Attendu" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Répartition des dépenses par catégorie</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.data?.expensesByCategory ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalMinor" name="Montant (FCFA)" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Rentabilité par propriété</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboard.data?.profitabilityByProperty ?? []).map((prop) => (
                <div key={prop.propertyId} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <div>
                    <p className="font-semibold">{prop.propertyName}</p>
                    <p className="text-xs text-muted-foreground">
                      Recettes : {prop.incomeMinor.toLocaleString('fr-FR')} FCFA · Dépenses : {prop.expensesMinor.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                  <span className={`font-bold ${prop.netProfitMinor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {prop.netProfitMinor >= 0 ? '+' : ''}{prop.netProfitMinor.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
              {(dashboard.data?.profitabilityByProperty ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune donnée de rentabilité.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Locataires débiteurs (Top impayés)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(dashboard.data?.debtors ?? []).map((debtor) => (
                <div key={debtor.tenantId} className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">
                  <div>
                    <p className="font-semibold">Locataire {debtor.tenantId.slice(-6)}</p>
                    <p className="text-xs text-rose-600">
                      Retard max : {debtor.oldestOverdueDays} jour(s)
                    </p>
                  </div>
                  <span className="font-bold text-rose-600">
                    {debtor.debtMinor.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
              {(dashboard.data?.debtors ?? []).length === 0 ? (
                <p className="text-sm text-emerald-600">Aucun locataire en retard de paiement.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface Meter { _id: string; label: string; type: string; unitPriceMinor: number }
interface ConsumptionPoint { month: string; consumption: number }

export function UtilitiesPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgList<Meter>(['meters'], '/meters?pageSize=50');
  const consumption = useOrgQuery<ConsumptionPoint[]>(['consumption'], '/meters/consumption');

  const create = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/meters`, { method: 'POST', body }),
    onSuccess: () => { void client.invalidateQueries(); toast({ title: 'Compteur ajouté', variant: 'success' }); },
  });
  const read = useMutation({
    mutationFn: (body: unknown) => apiRequest<{ abnormal: boolean }>(`${base}/meter-readings`, { method: 'POST', body }),
    onSuccess: (result) => {
      void client.invalidateQueries();
      toast(result.abnormal
        ? { title: 'Consommation anormale', description: 'Ce relevé dépasse nettement la moyenne habituelle.', variant: 'warning' }
        : { title: 'Relevé enregistré', description: 'La facture a été générée.', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Relevé refusé', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Compteurs" description="Relevés manuels. La lecture automatique (OCR) n’est pas disponible." />

      <Card>
        <CardHeader><CardTitle>Consommation mensuelle</CardTitle></CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={consumption.data ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="consumption" fill="currentColor" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          create.mutate({ type: form.get('type'), label: form.get('label'), unitPriceMinor: Number(form.get('unitPriceMinor')) });
          event.currentTarget.reset();
        }}
      >
        <select name="type" className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="ELECTRICITY">Électricité</option>
          <option value="WATER">Eau</option>
          <option value="GAS">Gaz</option>
          <option value="OTHER">Autre</option>
        </select>
        <Input name="label" placeholder="Libellé du compteur" required className="max-w-xs" />
        <Input name="unitPriceMinor" type="number" min={0} placeholder="Prix unitaire" required className="w-36" />
        <Button type="submit">Ajouter</Button>
      </form>

      <div className="space-y-3">
        {(data?.data ?? []).map((meter) => (
          <form
            key={meter._id}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              read.mutate({
                meterId: meter._id,
                previousIndex: Number(form.get('previousIndex')),
                currentIndex: Number(form.get('currentIndex')),
                readAt: form.get('readAt'),
              });
            }}
          >
            <div className="min-w-40 flex-1">
              <p className="font-medium">{meter.label}</p>
              <p className="text-xs text-muted-foreground">{meter.type} · {meter.unitPriceMinor.toLocaleString('fr-FR')} / unité</p>
            </div>
            <Input name="previousIndex" type="number" min={0} step="0.01" placeholder="Ancien index" required className="w-32" />
            <Input name="currentIndex" type="number" min={0} step="0.01" placeholder="Nouvel index" required className="w-32" />
            <Input name="readAt" type="date" required className="w-40" />
            <Button type="submit" variant="secondary">Relever</Button>
          </form>
        ))}
      </div>
    </div>
  );
}

interface NotificationRecord { _id: string; subject: string; body: string; channel: string; status: string; createdAt: string; readAt?: string }

const CHANNEL_NOTES: Record<string, string> = {
  SENT: 'Envoyée',
  FAILED: 'Échec',
  SKIPPED_UNCONFIGURED: 'Non envoyée : canal non configuré',
};

export function NotificationsPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { data } = useOrgList<NotificationRecord>(['notifications'], '/notifications?pageSize=50');
  const mark = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => void client.invalidateQueries(),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" description="Les canaux SMS et WhatsApp ne sont pas configurés : ils apparaissent explicitement comme non envoyés." />
      <div className="space-y-2">
        {(data?.data ?? []).map((notification) => (
          <div key={notification._id} className="flex items-start justify-between gap-3 rounded-xl border border-border p-4">
            <div>
              <p className="flex items-center gap-2 font-medium"><Bell className="size-4" /> {notification.subject}</p>
              <p className="text-sm text-muted-foreground">{notification.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{notification.channel} · {CHANNEL_NOTES[notification.status] ?? notification.status}</p>
            </div>
            {!notification.readAt ? <Button variant="ghost" onClick={() => mark.mutate(notification._id)}>Marquer lu</Button> : null}
          </div>
        ))}
        {(data?.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Aucune notification.</p> : null}
      </div>
    </div>
  );
}
