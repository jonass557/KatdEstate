import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  CreditCard,
  Trash2,
  X,
  Search,
  DollarSign,
  Lock,
  Unlock,
} from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';

export interface OwnerSubscription {
  isPaid: boolean;
  status: 'PAID' | 'TRIAL' | 'PENDING' | 'EXPIRED';
  planCode: string;
  planName: string;
  priceMinor: number;
  currency: string;
  expiresAt: string;
  paymentMethod?: string;
}

export interface OwnerData {
  _id: string;
  displayName: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  organization: {
    _id: string;
    name: string;
    slug: string;
    status: string;
  };
  propertiesCount: number;
  unitsCount: number;
  leasesCount: number;
  subscription: OwnerSubscription;
}

interface OwnersResponse {
  items: OwnerData[];
  stats: {
    totalOwners: number;
    activeOwners: number;
    suspendedOwners: number;
    paidOwners: number;
    unpaidOwners: number;
  };
}

export function AdminOwnersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] = useState('');

  const [editingSubscriptionOwner, setEditingSubscriptionOwner] = useState<OwnerData | null>(null);
  const [deletingOwner, setDeletingOwner] = useState<OwnerData | null>(null);

  const client = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<OwnersResponse>({
    queryKey: ['admin-owners'],
    queryFn: () => apiRequest<OwnersResponse>('/platform/owners'),
  });

  const suspendMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/platform/owners/${id}/suspend`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-owners'] });
      toast({ title: 'Compte propriétaire désactivé', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Action impossible', description: err.message, variant: 'error' }),
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/platform/owners/${id}/reactivate`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-owners'] });
      toast({ title: 'Compte propriétaire réactivé avec succès', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Action impossible', description: err.message, variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/platform/owners/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-owners'] });
      setDeletingOwner(null);
      toast({ title: 'Propriétaire supprimé', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Suppression impossible', description: err.message, variant: 'error' }),
  });

  const updateSubMutation = useMutation({
    mutationFn: ({ id, isPaid, planCode }: { id: string; isPaid: boolean; planCode: string }) =>
      apiRequest(`/platform/owners/${id}/subscription`, {
        method: 'PATCH',
        body: { isPaid, planCode },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['admin-owners'] });
      setEditingSubscriptionOwner(null);
      toast({ title: 'Abonnement mis à jour avec succès', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Mise à jour impossible', description: err.message, variant: 'error' }),
  });

  const owners = data?.items ?? [];
  const stats = data?.stats ?? {
    totalOwners: owners.length,
    activeOwners: owners.filter((o) => o.status === 'ACTIVE').length,
    suspendedOwners: owners.filter((o) => o.status === 'SUSPENDED').length,
    paidOwners: owners.filter((o) => o.subscription.isPaid).length,
    unpaidOwners: owners.filter((o) => !o.subscription.isPaid).length,
  };

  const filteredOwners = owners.filter((owner) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = owner.displayName.toLowerCase().includes(q);
      const matchEmail = owner.email.toLowerCase().includes(q);
      const matchOrg = owner.organization.name.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchOrg) return false;
    }
    if (statusFilter && owner.status !== statusFilter) return false;
    if (subscriptionFilter) {
      if (subscriptionFilter === 'PAID' && !owner.subscription.isPaid) return false;
      if (subscriptionFilter === 'UNPAID' && owner.subscription.isPaid) return false;
    }
    return true;
  });

  const handleWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      toast({ title: 'Numéro de téléphone non renseigné', variant: 'error' });
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(`Bonjour ${name || 'Propriétaire'},\nMessage de la Direction Super Administrateur KatdEstate concernant votre compte bailleur.`);
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supervision des Propriétaires & Bailleurs"
        description="Espace Super Administrateur : consultez le nombre total de propriétaires, suspendez ou supprimez des comptes, gérez les formules et suivez l'état des abonnements payés via iKeepay."
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
              Contrôle Super Admin Actif
            </span>
          </div>
        }
      />

      {/* Statistiques globales */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Propriétaires"
          value={String(stats.totalOwners)}
          hint="Bailleurs enregistrés"
          icon={Users}
        />
        <StatCard
          label="Comptes Actifs"
          value={String(stats.activeOwners)}
          hint={`${stats.suspendedOwners} compte(s) suspendu(s)`}
          icon={ShieldCheck}
        />
        <StatCard
          label="Abonnements Payés"
          value={String(stats.paidOwners)}
          hint={`${stats.unpaidOwners} en attente / essai`}
          icon={DollarSign}
        />
        <StatCard
          label="Taux de Cotisation"
          value={`${stats.totalOwners > 0 ? Math.round((stats.paidOwners / stats.totalOwners) * 100) : 100} %`}
          hint="Abonnements à jour"
          icon={CreditCard}
        />
      </div>

      {/* Filtres & Recherche */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, email, société..."
              className="pl-9 h-10 text-xs rounded-xl"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-xs"
          >
            <option value="">Tous les statuts de compte</option>
            <option value="ACTIVE">Actif uniquement</option>
            <option value="SUSPENDED">Suspendu / Désactivé</option>
          </select>

          <select
            value={subscriptionFilter}
            onChange={(e) => setSubscriptionFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-xs"
          >
            <option value="">Tous les abonnements</option>
            <option value="PAID">Abonnement Payé (À jour)</option>
            <option value="UNPAID">En attente / Impayé</option>
          </select>
        </div>

        <div className="text-xs text-muted-foreground font-medium">
          {filteredOwners.length} propriétaire(s) affiché(s)
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement des propriétaires…</p> : null}
      {error ? <p className="text-sm text-red-500">Erreur lors du chargement des données.</p> : null}

      {!isLoading && filteredOwners.length === 0 ? (
        <EmptyState
          title="Aucun propriétaire trouvé"
          description="Aucun compte ne correspond à vos critères de recherche."
        />
      ) : null}

      {/* Liste des propriétaires */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredOwners.map((owner) => (
          <Card key={owner._id} className="border-border hover:shadow-md transition-all flex flex-col justify-between">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0">
                    {owner.displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      <span>{owner.displayName}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">{owner.organization.name}</p>
                  </div>
                </div>

                <Badge
                  className={`text-[10px] ${
                    owner.status === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                  }`}
                >
                  {owner.status === 'ACTIVE' ? 'Compte Actif' : 'Désactivé'}
                </Badge>
              </div>

              {/* Statut Abonnement & Finances */}
              <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground text-[11px] uppercase">Abonnement Propriétaire</span>
                  {owner.subscription.isPaid ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[11px] border border-emerald-500/20">
                      <CheckCircle2 className="size-3" /> Payé
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md text-[11px] border border-amber-500/20">
                      <AlertCircle className="size-3" /> En attente
                    </span>
                  )}
                </div>

                <div className="space-y-1 pt-1 text-[11px]">
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">Formule :</span>
                    <strong className="text-foreground">{owner.subscription.planName}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">Tarif :</span>
                    <strong className="text-foreground">
                      {owner.subscription.priceMinor.toLocaleString('fr-FR')} {owner.subscription.currency} / mois
                    </strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span className="text-muted-foreground">Échéance :</span>
                    <strong className="text-foreground">
                      {new Date(owner.subscription.expiresAt).toLocaleDateString('fr-FR')}
                    </strong>
                  </p>
                </div>
              </div>

              {/* Portefeuille géré */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Propriétés</span>
                  <strong className="text-foreground text-sm font-black">{owner.propertiesCount}</strong>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Logements</span>
                  <strong className="text-foreground text-sm font-black">{owner.unitsCount}</strong>
                </div>
                <div className="p-2 rounded-xl bg-background border border-border">
                  <span className="text-[10px] text-muted-foreground uppercase block font-semibold">Baux Actifs</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-black">{owner.leasesCount}</strong>
                </div>
              </div>

              {/* Coordonnées */}
              <div className="space-y-1 text-xs text-muted-foreground px-1">
                <p className="truncate">Email : <strong className="text-foreground">{owner.email}</strong></p>
                <p>Téléphone : <strong className="text-foreground">{owner.phone || 'Non renseigné'}</strong></p>
              </div>

              {/* Actions Super Administrateur */}
              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditingSubscriptionOwner(owner)}
                  className="h-8 text-xs font-semibold flex items-center gap-1 border-border"
                >
                  <CreditCard className="size-3.5 text-primary" />
                  <span>Abonnement</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleWhatsApp(owner.phone, owner.displayName)}
                  className="h-8 text-xs font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <Smartphone className="size-3.5" />
                  <span>WhatsApp</span>
                </Button>

                {owner.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => suspendMutation.mutate(owner._id)}
                    className="h-8 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 px-2"
                    title="Désactiver ce compte propriétaire"
                  >
                    <Lock className="size-3.5 mr-1" />
                    Désactiver
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reactivateMutation.mutate(owner._id)}
                    className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 px-2 font-bold"
                    title="Réactiver ce compte propriétaire"
                  >
                    <Unlock className="size-3.5 mr-1" />
                    Réactiver
                  </Button>
                )}

                <button
                  onClick={() => setDeletingOwner(owner)}
                  className="p-1.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                  title="Supprimer définitivement le compte propriétaire"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Modification d'Abonnement Propriétaire */}
      {editingSubscriptionOwner && (
        <EditOwnerSubscriptionModal
          owner={editingSubscriptionOwner}
          onClose={() => setEditingSubscriptionOwner(null)}
          onSave={(isPaid, planCode) =>
            updateSubMutation.mutate({
              id: editingSubscriptionOwner._id,
              isPaid,
              planCode,
            })
          }
          isSubmitting={updateSubMutation.isPending}
        />
      )}

      {/* Modal Confirmation de Suppression */}
      {deletingOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-foreground border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-red-600">Supprimer ce propriétaire ?</h3>
            <p className="text-xs text-muted-foreground">
              Êtes-vous certain de vouloir supprimer le compte de <strong>{deletingOwner.displayName}</strong> ({deletingOwner.email}) ?
              Cette action retirera ses accès à la plateforme KatdEstate.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingOwner(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingOwner._id)}
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Confirmer la suppression'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditOwnerSubscriptionModal({
  owner,
  onClose,
  onSave,
  isSubmitting,
}: {
  owner: OwnerData;
  onClose: () => void;
  onSave: (isPaid: boolean, planCode: string) => void;
  isSubmitting: boolean;
}) {
  const [isPaid, setIsPaid] = useState(owner.subscription.isPaid);
  const [planCode, setPlanCode] = useState(owner.subscription.planCode || 'PRO');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Gérer l'Abonnement Propriétaire</h3>
              <p className="text-xs text-muted-foreground">{owner.displayName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="space-y-1">
            <span className="font-semibold text-muted-foreground">Formule / Pack d'abonnement</span>
            <select
              value={planCode}
              onChange={(e) => setPlanCode(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="STARTER">Pack Starter (1 à 3 logements) — 15 000 FCFA/mois</option>
              <option value="PRO">Pack Pro Bailleur (Jusqu'à 15 logements) — 35 000 FCFA/mois</option>
              <option value="BUSINESS">Pack Patrimoine SCI (Illimité) — 95 000 FCFA/mois</option>
            </select>
          </div>

          <div className="space-y-2 p-3.5 rounded-2xl bg-muted/30 border border-border">
            <span className="font-bold text-foreground block">Statut du paiement de l'abonnement</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsPaid(true)}
                className={`p-3 rounded-xl border text-center transition font-bold ${
                  isPaid
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                ✓ Payé (À jour)
              </button>
              <button
                type="button"
                onClick={() => setIsPaid(false)}
                className={`p-3 rounded-xl border text-center transition font-bold ${
                  !isPaid
                    ? 'border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'border-border bg-background text-muted-foreground'
                }`}
              >
                ⏳ En attente / Échu
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border border-border text-[11px] text-muted-foreground">
            Le paiement peut être effectué directement par le propriétaire via la passerelle iKeepay Mobile Money (Wave, Orange, MTN, Moov).
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => onSave(isPaid, planCode)}
              className="bg-primary hover:bg-primary/90 text-white font-bold"
            >
              {isSubmitting ? 'Enregistrement…' : 'Valider les modifications'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
