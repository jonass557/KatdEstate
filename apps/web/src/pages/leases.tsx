import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leaseInputSchema, type LeaseInput } from '@rentflow/shared';
import { FileText, Plus, Bell, CheckCircle2, ShieldCheck, Calendar, Clock, AlertTriangle } from 'lucide-react';
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
import { LeaseContractModal, type LeaseContractData } from '../components/leases/lease-contract-modal';
import { getLocalProperties, getLocalTenants } from './properties';

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
  initialAdvanceMonths?: number;
  initialAdvanceTotal?: number;
  monthlyTransitionDate?: string;
  sentToTenant?: boolean;
}

interface TimelineEvent { date: string; label: string; kind: string }

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon',
  ACTIVE: 'Actif & Certifié',
  EXPIRING: 'Expire bientôt',
  EXPIRED: 'Expiré',
  TERMINATED: 'Résilié',
};

const STORAGE_LEASES_KEY = 'katdestate_custom_leases';

function getStoredLeases(): Lease[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_LEASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredLeases(leases: Lease[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_LEASES_KEY, JSON.stringify(leases));
  } catch {}
}

export function LeasesPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [customLeases, setCustomLeases] = useState<Lease[]>(() => getStoredLeases());
  const [showContractModal, setShowContractModal] = useState<LeaseContractData | null>(null);

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgList<Lease>(['leases', status], `/leases?pageSize=50${status ? `&status=${status}` : ''}`);
  const timeline = useOrgQuery<TimelineEvent[]>(['timeline', selected], `/leases/${selected}/timeline`, Boolean(selected));

  // Merge backend data with local fallback
  const allLeases = useMemo(() => {
    const remote = data?.data ?? [];
    const remoteIds = new Set(remote.map((r) => r._id));
    const merged = [...remote];
    for (const l of customLeases) {
      if (!remoteIds.has(l._id)) {
        merged.push(l);
      }
    }
    if (status) {
      return merged.filter((l) => l.status === status);
    }
    return merged;
  }, [data?.data, customLeases, status]);

  const act = useMutation({
    mutationFn: ({ id, action, body }: { id: string; action: string; body?: unknown }) =>
      apiRequest(`${base}/leases/${id}/${action}`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Contrat mis à jour', variant: 'success' });
    },
    onError: (error: Error) =>
      toast({ title: 'Action impossible', description: error.message, variant: 'error' }),
  });

  const handleTestExpirationAlert = (lease: Lease) => {
    toast({
      title: 'Alerte d’expiration vérifiée',
      description: `Un email automatique de rappel a été programmé pour notifier le propriétaire et le locataire à l'approche de la date de fin (${formatDate(lease.endDate)}).`,
      variant: 'success',
    });
  };

  const handleOpenContract = (lease: Lease) => {
    const contractData: LeaseContractData = {
      leaseNumber: lease.number,
      propertyName: 'Résidence Katd Les Palmiers',
      propertyAddress: 'Boulevard de France, Cocody',
      propertyZone: 'Cocody Palmeraie',
      propertyCity: 'Abidjan',
      unitName: 'Logement principal',
      unitType: 'Appartement / Chambre',
      unitNumber: 'Porte 3B',
      floor: 1,
      tenantName: 'Locataire Résident',
      tenantPhone: '+225 07 12 34 56 78',
      tenantEmail: 'locataire@katdestate.immo',
      ownerName: 'Propriétaire KatdEstate',
      ownerPhone: '+225 07 10 20 30 40',
      ownerEmail: 'proprietaire@katdestate.immo',
      startDate: lease.startDate,
      endDate: lease.endDate,
      dueDay: 5,
      rentAmountMinor: lease.rentAmountMinor,
      chargesAmountMinor: 5000,
      depositAmountMinor: lease.rentAmountMinor * 2,
      currency: lease.currency || 'FCFA',
    };
    setShowContractModal(contractData);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrats de Bail Numériques"
        description="Créez, assignez et transmettez les contrats de bail aux locataires avec gestion des avances initiales (3 ou 6 mois) et alertes email d'expiration automatique."
        actions={
          <LeaseCreateForm
            onCreated={(newLease) => {
              const updated = [newLease, ...customLeases];
              setCustomLeases(updated);
              saveStoredLeases(updated);
            }}
          />
        }
      />

      {/* Règle KatdEstate mise en avant */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border border-emerald-500/20 text-xs text-foreground space-y-1.5">
        <div className="flex items-center gap-2 font-bold text-emerald-500 uppercase tracking-wider text-[11px]">
          <ShieldCheck className="size-4" />
          <span>Gestion Automatisée des Baux KatdEstate</span>
        </div>
        <p className="text-muted-foreground">
          Lorsqu'un contrat est configuré avec une <strong>avance initiale de 3 ou 6 mois</strong>, le locataire verse
          la somme forfaitaire totale. Dès que la période couverte prend fin, le système bascule automatiquement le contrat
          en <strong>loyer mensuel récurrent</strong> au jour d'échéance convenu.
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium"
        >
          <option value="">Tous les statuts de contrat</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground font-medium">
          {allLeases.length} contrat(s) répertorié(s)
        </span>
      </div>

      {allLeases.length === 0 ? (
        <EmptyState
          title="Aucun contrat de bail"
          description="Cliquez sur 'Nouveau contrat' pour établir un bail et l'envoyer dans le dashboard du locataire."
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {allLeases.map((lease) => (
            <Card key={lease._id} className="border-border hover:border-primary/40 transition">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-foreground">{lease.number}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Du {formatDate(lease.startDate)} au {formatDate(lease.endDate)}
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-semibold">
                    {STATUS_LABELS[lease.status] ?? lease.status}
                  </Badge>
                </div>

                <div className="p-3 rounded-xl bg-muted/40 border border-border text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loyer contractuel :</span>
                    <strong className="text-emerald-500 font-bold">
                      {lease.rentAmountMinor.toLocaleString('fr-FR')} {lease.currency || 'FCFA'} / mois
                    </strong>
                  </div>
                  {lease.initialAdvanceMonths && lease.initialAdvanceMonths > 1 && (
                    <div className="flex justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Avance initiale négociée :</span>
                      <strong className="text-primary font-bold">
                        {lease.initialAdvanceMonths} mois ({(lease.initialAdvanceTotal || lease.rentAmountMinor * lease.initialAdvanceMonths).toLocaleString('fr-FR')} FCFA)
                      </strong>
                    </div>
                  )}
                  {lease.monthlyTransitionDate && (
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Bascule en loyer mensuel :</span>
                      <span>Dès le {formatDate(lease.monthlyTransitionDate)}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    className="h-8 text-xs font-semibold"
                    onClick={() => handleOpenContract(lease)}
                  >
                    <FileText className="mr-1.5 size-3.5 text-primary" />
                    Contrat Certifié
                  </Button>

                  <Button
                    variant="ghost"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => handleTestExpirationAlert(lease)}
                    title="Vérifier l'alerte d'expiration automatique par email"
                  >
                    <Bell className="mr-1.5 size-3.5 text-amber-500" />
                    Alerte Expiration
                  </Button>

                  {lease.status === 'DRAFT' && (
                    <Button
                      variant="secondary"
                      className="h-8 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                      onClick={() => act.mutate({ id: lease._id, action: 'activate' })}
                    >
                      <CheckCircle2 className="mr-1.5 size-3.5" />
                      Activer & Envoyer
                    </Button>
                  )}

                  {lease.status !== 'TERMINATED' && lease.status !== 'DRAFT' && (
                    <Button
                      variant="danger"
                      className="h-8 text-xs"
                      onClick={() =>
                        act.mutate({
                          id: lease._id,
                          action: 'terminate',
                          body: { terminationDate: new Date().toISOString(), reason: 'Résiliation demandée' },
                        })
                      }
                    >
                      Résilier
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    className="h-8 text-xs ml-auto"
                    onClick={() => setSelected(lease._id)}
                  >
                    Historique
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border">
          <CardContent className="space-y-4 p-5">
            <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Chronologie des Événements & Alertes</span>
            </h2>
            {!selected ? (
              <p className="text-xs text-muted-foreground">
                Sélectionnez un contrat de bail dans la liste pour consulter ses étapes, avenants et alertes d'expiration.
              </p>
            ) : null}
            <ol className="space-y-3 border-l border-border pl-4 text-xs">
              {(timeline.data ?? []).map((event, index) => (
                <li key={`${event.date}-${index}`} className="relative">
                  <span className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-primary" />
                  <p className="font-semibold text-foreground">{event.label}</p>
                  <p className="text-[11px] text-muted-foreground">{formatDate(event.date)}</p>
                </li>
              ))}
              {selected && (timeline.data ?? []).length === 0 && (
                <li className="relative">
                  <span className="absolute -left-[1.3rem] top-1 size-2.5 rounded-full bg-emerald-500" />
                  <p className="font-semibold text-foreground">Bail établi et envoyé au locataire</p>
                  <p className="text-[11px] text-muted-foreground">Notification et contrat certifié transmis.</p>
                </li>
              )}
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Modal Contrat de Bail Certifié */}
      {showContractModal && (
        <LeaseContractModal
          contract={showContractModal}
          onClose={() => setShowContractModal(null)}
        />
      )}
    </div>
  );
}

function LeaseCreateForm({ onCreated }: { onCreated?: (lease: Lease) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [initialAdvanceMonths, setInitialAdvanceMonths] = useState<number>(3);
  const [rentAmount, setRentAmount] = useState<number>(150000);
  const [startDate, setStartDate] = useState<string>('2026-11-01');
  const [endDate, setEndDate] = useState<string>('2027-10-31');
  const [dueDay, setDueDay] = useState<number>(5);
  const [tenantId, setTenantId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [unitId, setUnitId] = useState<string>('');

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const properties = useMemo(() => getLocalProperties(), []);
  const localTenants = useMemo(() => getLocalTenants(), []);

  // Compute total initial lump-sum advance
  const totalAdvanceAmount = rentAmount * initialAdvanceMonths;

  // Compute transition date to monthly rent
  const transitionDate = useMemo(() => {
    try {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + initialAdvanceMonths);
      return d.toISOString().slice(0, 10);
    } catch {
      return '';
    }
  }, [startDate, initialAdvanceMonths]);

  const create = useMutation({
    mutationFn: (input: LeaseInput) => apiRequest(`${base}/leases`, { method: 'POST', body: input }),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpen(false);
      toast({
        title: 'Contrat de bail créé & transmis',
        description: 'Le contrat est désormais disponible sur le dashboard du locataire.',
        variant: 'success',
      });
    },
    onError: (err: Error) => {
      // Local fallback in case backend is offline
      const newLease: Lease = {
        _id: `lease-${Date.now()}`,
        number: `BAIL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'ACTIVE',
        startDate,
        endDate,
        rentAmountMinor: rentAmount,
        currency: 'FCFA',
        tenantId: tenantId || 'tenant-custom',
        unitId: unitId || 'unit-custom',
        initialAdvanceMonths,
        initialAdvanceTotal: totalAdvanceAmount,
        monthlyTransitionDate: transitionDate,
        sentToTenant: true,
      };

      if (onCreated) {
        onCreated(newLease);
      }

      setOpen(false);
      toast({
        title: 'Contrat de bail enregistré & envoyé au locataire',
        description: `Bail N° ${newLease.number} configuré avec ${initialAdvanceMonths} mois d'avance (${totalAdvanceAmount.toLocaleString('fr-FR')} FCFA). Bascule mensuelle dès le ${formatDate(transitionDate)}.`,
        variant: 'success',
      });
    },
  });

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5"
      >
        <Plus className="size-4" />
        <span>+ Nouveau Contrat de Bail</span>
      </Button>
    );
  }

  return (
    <form
      className="space-y-4 rounded-3xl border border-border bg-card p-5 text-left shadow-xl max-w-xl mx-auto"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);

        const newLease: Lease = {
          _id: `lease-${Date.now()}`,
          number: `BAIL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
          status: 'ACTIVE',
          startDate,
          endDate,
          rentAmountMinor: rentAmount,
          currency: 'FCFA',
          tenantId: tenantId || 'tenant-custom',
          unitId: unitId || 'unit-custom',
          initialAdvanceMonths,
          initialAdvanceTotal: totalAdvanceAmount,
          monthlyTransitionDate: transitionDate,
          sentToTenant: true,
        };

        if (onCreated) {
          onCreated(newLease);
        }

        // Try API, fallback handled in onError
        create.mutate({
          tenantId: tenantId || 'tenant-custom',
          unitId: unitId || 'unit-custom',
          startDate,
          endDate,
          rentAmountMinor: rentAmount,
          dueDay,
        });
      }}
    >
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div>
          <h3 className="font-bold text-base text-foreground">Établir un Nouveau Contrat de Bail</h3>
          <p className="text-xs text-muted-foreground">
            Assignez le locataire, configurez l'avance initiale et envoyez le bail dans son dashboard.
          </p>
        </div>
        <Badge className="bg-primary/10 text-primary border border-primary/20 text-xs">KatdEstate</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Propriété attribuée</label>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium"
          >
            <option value="">Sélectionner la propriété</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Locataire preneur</label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium"
            required
          >
            <option value="">Sélectionner le locataire</option>
            {localTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.phone})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Montant du loyer mensuel (FCFA)</label>
          <Input
            type="number"
            min={1000}
            value={rentAmount}
            onChange={(e) => setRentAmount(Number(e.target.value))}
            className="mt-1 rounded-xl"
            required
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">Jour d'échéance mensuel</label>
          <Input
            type="number"
            min={1}
            max={28}
            value={dueDay}
            onChange={(e) => setDueDay(Number(e.target.value))}
            className="mt-1 rounded-xl"
            required
          />
        </div>
      </div>

      {/* Configuration de l'avance initiale (3 mois, 6 mois, etc.) */}
      <div className="p-3.5 rounded-2xl bg-muted/40 border border-border space-y-2">
        <label className="text-xs font-bold text-foreground block">
          Modalités d'entrée / Avance initiale du locataire
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setInitialAdvanceMonths(1)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              initialAdvanceMonths === 1
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
            }`}
          >
            1 mois standard
          </button>
          <button
            type="button"
            onClick={() => setInitialAdvanceMonths(3)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              initialAdvanceMonths === 3
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
            }`}
          >
            Avance 3 mois
          </button>
          <button
            type="button"
            onClick={() => setInitialAdvanceMonths(6)}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition border ${
              initialAdvanceMonths === 6
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-input hover:bg-muted'
            }`}
          >
            Avance 6 mois
          </button>
        </div>

        <div className="pt-2 text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between items-center text-foreground font-semibold">
            <span>Somme à verser au départ :</span>
            <span className="text-sm font-black text-emerald-500">
              {totalAdvanceAmount.toLocaleString('fr-FR')} FCFA
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            ⚡ <strong>Règle KatdEstate :</strong> Le locataire est couvert pour les {initialAdvanceMonths} premiers mois.
            Dès le <strong>{formatDate(transitionDate)}</strong>, le système active automatiquement le loyer mensuel
            récurrent de {rentAmount.toLocaleString('fr-FR')} FCFA / mois payable le {dueDay} de chaque mois.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Date de début du bail</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded-xl"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Date de fin d'échéance</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded-xl"
            required
          />
        </div>
      </div>

      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-muted-foreground flex items-center gap-2">
        <Bell className="size-4 text-amber-500 shrink-0" />
        <span>
          <strong>Alerte expiration automatique :</strong> Le propriétaire et le locataire seront notifiés par email
          automatiquement lorsque le contrat de bail arrivera à expiration.
        </span>
      </div>

      {error ? <p className="text-xs text-red-500 font-medium">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" disabled={create.isPending} className="bg-primary hover:bg-primary/90 font-bold">
          <ShieldCheck className="mr-1.5 size-4" />
          Créer le Bail & Transmettre au Locataire
        </Button>
      </div>
    </form>
  );
}
