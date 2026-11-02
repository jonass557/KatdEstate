import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaseInputSchema, type LeaseInput } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { formatDate } from '../lib/format';
import { useOrgList, useOrgPath, useOrgQuery } from '../lib/query';

interface Lease {
  _id: string;
  number: string;
  status: string;
  startDate: string;
  endDate: string;
  rentAmountMinor: number;
  currency: string;
  tenantId: string;
  unitId: string;
}

interface TimelineEvent { date: string; label: string; kind: string }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', ACTIVE: 'Actif', EXPIRING: 'Expire bientôt', EXPIRED: 'Expiré', TERMINATED: 'Résilié',
};

export function LeasesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgList<Lease>(['leases', status], `/leases?pageSize=50${status ? `&status=${status}` : ''}`);
  const timeline = useOrgQuery<TimelineEvent[]>(['timeline', selected], `/leases/${selected}/timeline`, Boolean(selected));

  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
      apiRequest(`${base}/leases/${id}/${action}`, { method: 'POST', body }),
    onSuccess: () => { void client.invalidateQueries(); toast({ title: 'Contrat mis à jour', variant: 'success' }); },
    onError: (error: Error) => toast({ title: 'Action impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Contrats" description="Baux, échéances et historique." actions={<LeaseCreateForm />} />

      <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
        <option value="">Tous les statuts</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>

      {(data?.data ?? []).length === 0 ? <EmptyState title="Aucun contrat" description="Créez un contrat entre un locataire et un logement." /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {(data?.data ?? []).map((lease) => (
            <Card key={lease._id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{lease.number}</p>
                  <Badge>{STATUS_LABELS[lease.status] ?? lease.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {formatDate(lease.startDate)} → {formatDate(lease.endDate)} · {lease.rentAmountMinor.toLocaleString('fr-FR')} {lease.currency}
                </p>
                <div className="flex flex-wrap gap-2">
                  {lease.status === 'DRAFT' ? <Button onClick={() => act.mutate({ id: lease._id, action: 'activate' })}>Activer</Button> : null}
                  {lease.status !== 'TERMINATED' && lease.status !== 'DRAFT' ? (
                    <Button variant="danger" onClick={() => act.mutate({ id: lease._id, action: 'terminate', body: { terminationDate: new Date().toISOString(), reason: 'Résiliation demandée' } })}>Résilier</Button>
                  ) : null}
                  <Button variant="ghost" onClick={() => setSelected(lease._id)}>Historique</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-3 p-5">
            <h2 className="font-semibold">Chronologie</h2>
            {!selected ? <p className="text-sm text-muted-foreground">Sélectionnez un contrat pour voir son historique.</p> : null}
            <ol className="space-y-3 border-l border-border pl-4">
              {(timeline.data ?? []).map((event, index) => (
                <li key={`${event.date}-${index}`} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-primary" />
                  <p className="text-sm font-medium">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(event.date)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function LeaseCreateForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const tenants = useOrgList<{ _id: string; fullName: string }>(['tenants'], '/tenants?pageSize=100');
  const units = useOrgList<{ _id: string; name: string }>(['units'], '/units?pageSize=100');

  const create = useMutation({
    mutationFn: (input: LeaseInput) => apiRequest(`${base}/leases`, { method: 'POST', body: input }),
    onSuccess: () => { void client.invalidateQueries(); setOpen(false); toast({ title: 'Contrat créé en brouillon', variant: 'success' }); },
    onError: (err: Error) => toast({ title: 'Création impossible', description: err.message, variant: 'error' }),
  });

  if (!open) return <Button onClick={() => setOpen(true)}>Nouveau contrat</Button>;

  return (
    <form
      className="space-y-2 rounded-xl border border-border bg-card p-4 text-left"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = leaseInputSchema.safeParse({
          tenantId: form.get('tenantId'),
          unitId: form.get('unitId'),
          startDate: form.get('startDate'),
          endDate: form.get('endDate'),
          rentAmountMinor: Number(form.get('rentAmountMinor')),
          dueDay: Number(form.get('dueDay')),
        });
        if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? 'Formulaire invalide'); return; }
        setError(null);
        create.mutate(parsed.data);
      }}
    >
      <select name="tenantId" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" required>
        <option value="">Locataire</option>
        {(tenants.data?.data ?? []).map((tenant) => <option key={tenant._id} value={tenant._id}>{tenant.fullName}</option>)}
      </select>
      <select name="unitId" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" required>
        <option value="">Logement</option>
        {(units.data?.data ?? []).map((unit) => <option key={unit._id} value={unit._id}>{unit.name}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <Input name="startDate" type="date" required aria-label="Date de début" />
        <Input name="endDate" type="date" required aria-label="Date de fin" />
        <Input name="rentAmountMinor" type="number" min={0} placeholder="Loyer" required />
        <Input name="dueDay" type="number" min={1} max={28} defaultValue={1} aria-label="Jour d'échéance" />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={create.isPending}>Créer</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
      </div>
    </form>
  );
}
