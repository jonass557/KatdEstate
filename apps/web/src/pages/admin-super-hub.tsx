import { useMemo, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Crown,
  Edit3,
  Layers,
  Plus,
  ShieldCheck,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { BackButton } from '../components/ui/back-button';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { useSession } from '../app/session';
import { Link } from 'react-router-dom';
import { MapPin, Navigation } from 'lucide-react';
import {
  createSubscriptionPlan,
  deleteSubscriptionPlan,
  deleteUserSubscription,
  getBlockLeaders,
  getBlockOwners,
  getCustomMarketplaceListings,
  getRegisteredUsers,
  getRentValidations,
  getStoredBlocks,
  getStoredNeighborhoods,
  getSubscriptionPlans,
  getUserPropertyOrders,
  getUserSubscriptions,
  toggleUserSubscriptionStatus,
  updateSubscriptionPlan,
  type SubscriptionPlan,
} from '../lib/katdestate-store';

// ============================================================================
// 1. GESTION DES CHEFFERIES (Super Admin)
// ============================================================================
export function AdminChefferiesPage() {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);

  const neighborhoods = useMemo(() => {
    void tick;
    return getStoredNeighborhoods();
  }, [tick]);
  const blocks = useMemo(() => getStoredBlocks(), [tick]);
  const rentValidations = useMemo(() => Object.values(getRentValidations()), [tick]);
  const subscriptions = useMemo(() => {
    void tick;
    return getUserSubscriptions().filter((s) => s.role === 'NEIGHBORHOOD_LEADER');
  }, [tick]);
  const registeredLeaders = useMemo(
    () => getRegisteredUsers().filter((u) => u.role === 'NEIGHBORHOOD_LEADER'),
    [tick],
  );

  const totalRentRevenue = rentValidations.reduce((s, r) => s + (r.paidAmount || 0), 0);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des Chefferies & Chefs de Quartier"
        description="Statistiques des chefferies, chefs de blocs rattachés, revenus des loyers par chefferie et gestion des abonnements."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Chefferies / Quartiers"
          value={String(neighborhoods.length)}
          hint="Zones territoriales"
          icon={Crown}
        />
        <StatCard
          label="Blocs rattachés"
          value={String(blocks.length)}
          hint="Secteurs actifs"
          icon={Layers}
        />
        <StatCard
          label="Revenus loyers (Chefferies)"
          value={`${totalRentRevenue.toLocaleString('fr-FR')} FCFA`}
          hint="Loyers payés par les locataires"
          icon={Wallet}
        />
        <StatCard
          label="Chefs de Quartier inscrits"
          value={String(Math.max(subscriptions.length, registeredLeaders.length))}
          hint="Souscriptions & comptes"
          icon={Users}
        />
      </div>

      {/* Détails par chefferie */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="size-4 text-purple-500" />
            Chefferies, Blocs associés & Revenus locatifs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {neighborhoods.map((n) => {
            const nBlocks = blocks.filter((b) => b.neighborhoodId === n.id);
            const nRent =
              nBlocks.reduce((s, b) => s + (b.monthlyRevenueMinor || 0), 0) || totalRentRevenue;
            return (
              <div
                key={n.id}
                className="rounded-2xl border border-border p-4 bg-muted/20 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{n.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Chef de Quartier : <strong>{n.leaderName || 'Non renseigné'}</strong> ·{' '}
                      {[n.neighborhoodLabel, n.city, n.country].filter(Boolean).join(', ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge className="bg-cyan-500/15 text-cyan-500 border border-cyan-500/30">
                      {nBlocks.length} bloc(s)
                    </Badge>
                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-black">
                      Revenus : {nRent.toLocaleString('fr-FR')} FCFA
                    </Badge>
                  </div>
                </div>
                {nBlocks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {nBlocks.map((b) => (
                      <Badge key={b.id} className="bg-background border border-border text-[11px]">
                        {b.name} {b.leaderName ? `(${b.leaderName})` : ''}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Historique des Chefs de Quartier ayant souscrit */}
      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">
            Souscriptions & Plans des Chefs de Quartier
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.length === 0 ? (
            <EmptyState
              title="Aucune souscription Chef de Quartier"
              description="Les chefs de quartier qui choisissent un plan et paient à l'inscription apparaîtront ici."
            />
          ) : (
            subscriptions.map((sub) => (
              <div
                key={sub._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border p-3 text-xs"
              >
                <div>
                  <p className="font-bold text-foreground">
                    {sub.fullName} ({sub.email})
                  </p>
                  <p className="text-muted-foreground">
                    Plan : <strong>{sub.planName}</strong> · Payé :{' '}
                    <strong className="text-emerald-500">
                      {sub.amountPaid.toLocaleString('fr-FR')} FCFA
                    </strong>{' '}
                    · Souscrit le {sub.subscribedAt.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    className={
                      sub.status === 'ACTIVE'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }
                  >
                    {sub.status === 'ACTIVE' ? 'ACTIF' : 'DÉSACTIVÉ'}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      toggleUserSubscriptionStatus(
                        sub._id,
                        sub.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                      );
                      setTick((t) => t + 1);
                      toast({ title: 'Statut du plan mis à jour', variant: 'success' });
                    }}
                  >
                    {sub.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-rose-500"
                    onClick={() => {
                      deleteUserSubscription(sub._id);
                      setTick((t) => t + 1);
                      toast({ title: 'Souscription supprimée', variant: 'success' });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. GESTION DES BLOCS (Super Admin)
// ============================================================================
export function AdminBlocksPage() {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);

  const neighborhoods = useMemo(() => getStoredNeighborhoods(), [tick]);
  const blocks = useMemo(() => {
    void tick;
    return getStoredBlocks();
  }, [tick]);
  const leaders = useMemo(() => getBlockLeaders(), [tick]);
  const owners = useMemo(() => getBlockOwners(), [tick]);
  const subscriptions = useMemo(() => {
    void tick;
    return getUserSubscriptions().filter((s) => s.role === 'BLOCK_LEADER');
  }, [tick]);

  const totalBlockRevenue = blocks.reduce((s, b) => s + (b.monthlyRevenueMinor || 0), 0);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des Blocs & Chefs de Bloc"
        description="Tous les chefs de blocs par quartier, nombre de propriétaires créés, revenus locatifs par bloc et gestion des souscriptions."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Blocs enregistrés" value={String(blocks.length)} hint="Tous quartiers" icon={Layers} />
        <StatCard label="Chefs de Bloc" value={String(leaders.length)} hint="Responsables actifs" icon={ShieldCheck} />
        <StatCard label="Propriétaires créés" value={String(owners.length)} hint="Rattachés aux blocs" icon={Building2} />
        <StatCard
          label="Revenus location blocs"
          value={`${totalBlockRevenue.toLocaleString('fr-FR')} FCFA`}
          hint="Cumul mensuel"
          icon={Wallet}
        />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Détails des Blocs par Quartier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {blocks.map((blk) => {
            const neigh = neighborhoods.find((n) => n.id === blk.neighborhoodId);
            const blkOwners = owners.filter((o) => o.blockId === blk.id);
            return (
              <div
                key={blk.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border p-4 bg-muted/20"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: blk.color || '#06b6d4' }}
                    />
                    <h4 className="font-bold text-sm text-foreground">{blk.name}</h4>
                    <Badge className="bg-muted text-foreground text-[10px]">
                      Quartier : {neigh?.name || blk.neighborhoodName}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Chef de Bloc : <strong>{blk.leaderName || 'Non assigné'}</strong> ·{' '}
                    {blk.leaderEmail || '—'} · {blk.leaderPhone || '—'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-sky-500/15 text-sky-500 border border-sky-500/30">
                    {blkOwners.length} propriétaire(s) créé(s)
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold">
                    Revenus : {(blk.monthlyRevenueMinor || 0).toLocaleString('fr-FR')} FCFA
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base">Chefs de Bloc ayant souscrit (Plans)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {subscriptions.length === 0 ? (
            <EmptyState
              title="Aucune souscription Chef de Bloc"
              description="Les souscriptions des chefs de bloc apparaîtront ici."
            />
          ) : (
            subscriptions.map((sub) => (
              <div
                key={sub._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
              >
                <div>
                  <p className="font-bold">
                    {sub.fullName} ({sub.email})
                  </p>
                  <p className="text-muted-foreground">
                    {sub.planName} · {sub.amountPaid.toLocaleString('fr-FR')} FCFA
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={sub.status === 'ACTIVE' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}>
                    {sub.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    onClick={() => {
                      toggleUserSubscriptionStatus(
                        sub._id,
                        sub.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                      );
                      setTick((t) => t + 1);
                      toast({ title: 'Plan mis à jour', variant: 'success' });
                    }}
                  >
                    {sub.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-rose-500"
                    onClick={() => {
                      deleteUserSubscription(sub._id);
                      setTick((t) => t + 1);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. GESTION DES PROPRIÉTAIRES INDÉPENDANTS (Super Admin)
// ============================================================================
export function AdminIndependentOwnersPage() {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);

  const subscriptions = useMemo(() => {
    void tick;
    return getUserSubscriptions().filter((s) => s.role === 'INDEPENDENT_OWNER');
  }, [tick]);
  const listings = useMemo(() => getCustomMarketplaceListings(), [tick]);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des Propriétaires Indépendants"
        description="Consultez les propriétaires indépendants ayant payé leur souscription, leurs publications sur la Marketplace et gérez l'activation de leur plan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Souscriptions payées"
          value={String(subscriptions.length)}
          hint="Propriétaires indépendants"
          icon={Users}
        />
        <StatCard
          label="Plans actifs"
          value={String(subscriptions.filter((s) => s.status === 'ACTIVE').length)}
          hint="Accès autorisé"
          icon={CheckCircle2}
        />
        <StatCard
          label="Publications totales"
          value={String(
            listings.filter((l) => l.publisherRole === 'INDEPENDENT_OWNER').length,
          )}
          hint="Annonces & Meublés"
          icon={Building2}
        />
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          title="Aucun propriétaire indépendant souscrit"
          description="Les propriétaires indépendants qui s'inscrivent et paient leur plan apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const ownerListings = listings.filter(
              (l) => l.ownerEmail?.trim().toLowerCase() === sub.email.trim().toLowerCase(),
            );
            return (
              <Card key={sub._id} className="border-border">
                <CardContent className="p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground">{sub.fullName}</h4>
                        <Badge
                          className={
                            sub.status === 'ACTIVE'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-rose-600 text-white'
                          }
                        >
                          {sub.status === 'ACTIVE' ? 'ACTIF' : 'DÉSACTIVÉ'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sub.email} · Plan : <strong>{sub.planName}</strong> · Payé :{' '}
                        <strong className="text-emerald-500">
                          {sub.amountPaid.toLocaleString('fr-FR')} FCFA
                        </strong>
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs"
                        onClick={() => {
                          toggleUserSubscriptionStatus(
                            sub._id,
                            sub.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                          );
                          setTick((t) => t + 1);
                          toast({ title: 'Plan mis à jour', variant: 'success' });
                        }}
                      >
                        {sub.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs text-rose-500"
                        onClick={() => {
                          deleteUserSubscription(sub._id);
                          setTick((t) => t + 1);
                          toast({ title: 'Compte / plan supprimé', variant: 'success' });
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-muted/30 p-3 text-xs space-y-1">
                    <p className="font-bold text-foreground">
                      Publications ({ownerListings.length}) :
                    </p>
                    {ownerListings.length === 0 ? (
                      <p className="text-muted-foreground">Aucune publication pour le moment.</p>
                    ) : (
                      ownerListings.map((ol) => (
                        <div key={ol._id} className="flex justify-between border-b border-border/40 py-1">
                          <span>{ol.title}</span>
                          <Badge className="bg-background border border-border text-[10px]">
                            {ol.category}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. GESTION DES AGENTS IMMOBILIERS (Super Admin)
// ============================================================================
export function AdminAgentsPage() {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);

  const subscriptions = useMemo(() => {
    void tick;
    return getUserSubscriptions().filter((s) => s.role === 'AGENT');
  }, [tick]);
  const listings = useMemo(() => getCustomMarketplaceListings(), [tick]);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des Agents Immobiliers"
        description="Liste des agents immobiliers ayant souscrit, nombre et types de publications de chacun, activation/désactivation et suppression de plan."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Agents souscrits" value={String(subscriptions.length)} hint="Comptes enregistrés" icon={Users} />
        <StatCard
          label="Plans actifs"
          value={String(subscriptions.filter((s) => s.status === 'ACTIVE').length)}
          hint="En règle"
          icon={CheckCircle2}
        />
        <StatCard
          label="Annonces Agents"
          value={String(listings.filter((l) => l.publisherRole === 'AGENT').length)}
          hint="Marketplace"
          icon={Building2}
        />
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          title="Aucun agent immobilier souscrit"
          description="Les agents immobiliers qui s'inscrivent et paient leur souscription apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {subscriptions.map((sub) => {
            const agentListings = listings.filter(
              (l) => l.ownerEmail?.trim().toLowerCase() === sub.email.trim().toLowerCase(),
            );
            const types = Array.from(new Set(agentListings.map((l) => l.category)));
            return (
              <Card key={sub._id} className="border-border">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">{sub.fullName}</h4>
                      <Badge
                        className={
                          sub.status === 'ACTIVE'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-rose-600 text-white'
                        }
                      >
                        {sub.status === 'ACTIVE' ? 'ACTIF' : 'DÉSACTIVÉ'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {sub.email} · {sub.planName} ({sub.amountPaid.toLocaleString('fr-FR')} FCFA)
                    </p>
                    <p className="text-xs text-foreground">
                      <strong>{agentListings.length}</strong> publication(s) · Types :{' '}
                      {types.length > 0 ? types.join(', ') : 'Aucune pour le moment'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        toggleUserSubscriptionStatus(
                          sub._id,
                          sub.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE',
                        );
                        setTick((t) => t + 1);
                        toast({ title: 'Statut agent mis à jour', variant: 'success' });
                      }}
                    >
                      {sub.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-500"
                      onClick={() => {
                        deleteUserSubscription(sub._id);
                        setTick((t) => t + 1);
                        toast({ title: 'Souscription agent supprimée', variant: 'success' });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 5. GESTION DES ABONNEMENTS (Créer, Modifier, Supprimer Plans & Prix)
// ============================================================================
export function AdminSubscriptionsPage() {
  const { toast } = useToast();
  const [tick, setTick] = useState(0);
  const plans = useMemo(() => {
    void tick;
    return getSubscriptionPlans();
  }, [tick]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleKey, setRoleKey] = useState<SubscriptionPlan['roleKey']>('AGENT');
  const [name, setName] = useState('');
  const [priceMinor, setPriceMinor] = useState(25000);
  const [periodLabel, setPeriodLabel] = useState('par mois');
  const [featuresText, setFeaturesText] = useState('');

  const ROLE_LABELS: Record<SubscriptionPlan['roleKey'], string> = {
    AGENT: 'Agent Immobilier',
    INDEPENDENT_OWNER: 'Propriétaire Indépendant',
    NEIGHBORHOOD_LEADER: 'Chef de Quartier',
    BLOCK_LEADER: 'Chef de Bloc',
    OWNER: 'Propriétaire Bailleur',
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setPriceMinor(25000);
    setPeriodLabel('par mois');
    setFeaturesText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const features = featuresText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    if (editingId) {
      updateSubscriptionPlan(editingId, {
        roleKey,
        roleLabel: ROLE_LABELS[roleKey],
        name: name.trim(),
        priceMinor: Number(priceMinor) || 0,
        periodLabel: periodLabel.trim() || 'par mois',
        features: features.length > 0 ? features : ['Accès complet plateforme KatdEstate'],
      });
      toast({ title: 'Plan d’abonnement modifié !', variant: 'success' });
    } else {
      createSubscriptionPlan({
        roleKey,
        roleLabel: ROLE_LABELS[roleKey],
        name: name.trim(),
        priceMinor: Number(priceMinor) || 0,
        currency: 'FCFA',
        periodLabel: periodLabel.trim() || 'par mois',
        features: features.length > 0 ? features : ['Accès complet plateforme KatdEstate'],
        isActive: true,
      });
      toast({ title: 'Nouveau plan d’abonnement créé !', variant: 'success' });
    }
    resetForm();
    setTick((t) => t + 1);
  };

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des Abonnements & Tarifs"
        description="Créez, modifiez et supprimez les plans d'abonnement pour chaque profil utilisateur. Les plans actifs sont affichés sur la page d'accueil et à l'inscription."
      />

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="size-4 text-emerald-500" />
            {editingId ? 'Modifier le plan d’abonnement' : 'Créer un nouveau plan d’abonnement'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <select
                value={roleKey}
                onChange={(e) => setRoleKey(e.target.value as SubscriptionPlan['roleKey'])}
                className="h-10 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="AGENT">Agent Immobilier</option>
                <option value="INDEPENDENT_OWNER">Propriétaire Indépendant</option>
                <option value="NEIGHBORHOOD_LEADER">Chef de Quartier</option>
                <option value="BLOCK_LEADER">Chef de Bloc</option>
                <option value="OWNER">Propriétaire Bailleur</option>
              </select>
              <Input
                placeholder="Nom du plan (ex: Plan Agent Pro)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                type="number"
                placeholder="Prix (FCFA)"
                value={priceMinor}
                onChange={(e) => setPriceMinor(Number(e.target.value))}
                required
              />
              <Input
                placeholder="Période (ex: par mois)"
                value={periodLabel}
                onChange={(e) => setPeriodLabel(e.target.value)}
              />
            </div>
            <textarea
              rows={3}
              value={featuresText}
              onChange={(e) => setFeaturesText(e.target.value)}
              placeholder="Fonctionnalités incluses (une par ligne)..."
              className="w-full rounded-xl border border-input bg-background p-3 text-xs"
            />
            <div className="flex gap-2">
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5">
                <Plus className="size-4" />
                {editingId ? 'Enregistrer les modifications' : 'Créer le plan'}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                  Annuler
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((p) => (
          <Card key={p._id} className="border-border flex flex-col justify-between">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                  {p.roleLabel}
                </Badge>
                <Badge className={p.isActive ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}>
                  {p.isActive ? 'ACTIF' : 'INACTIF'}
                </Badge>
              </div>
              <h3 className="font-bold text-base text-foreground">{p.name}</h3>
              <div className="text-2xl font-black text-emerald-500">
                {p.priceMinor.toLocaleString('fr-FR')} {p.currency}{' '}
                <span className="text-xs font-normal text-muted-foreground">{p.periodLabel}</span>
              </div>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {p.features.map((f, idx) => (
                  <li key={idx}>✓ {f}</li>
                ))}
              </ul>
              <div className="flex gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs flex-1 gap-1"
                  onClick={() => {
                    setEditingId(p._id);
                    setRoleKey(p.roleKey);
                    setName(p.name);
                    setPriceMinor(p.priceMinor);
                    setPeriodLabel(p.periodLabel);
                    setFeaturesText(p.features.join('\n'));
                  }}
                >
                  <Edit3 className="size-3.5" />
                  Modifier
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => {
                    updateSubscriptionPlan(p._id, { isActive: !p.isActive });
                    setTick((t) => t + 1);
                  }}
                >
                  {p.isActive ? <XCircle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs text-rose-500"
                  onClick={() => {
                    deleteSubscriptionPlan(p._id);
                    setTick((t) => t + 1);
                    toast({ title: 'Plan supprimé', variant: 'success' });
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// 6. HISTORIQUE DES COMMANDES UTILISATEUR (Client / Visiteur sans souscription)
// ============================================================================
export function UserOrdersPage() {
  const { user } = useSession();
  const normEmail = user?.email?.trim().toLowerCase();

  const orders = useMemo(() => {
    const all = getUserPropertyOrders();
    if (!normEmail) return all;
    const mine = all.filter((o) => o.userEmail.trim().toLowerCase() === normEmail);
    return mine.length > 0 ? mine : all;
  }, [normEmail]);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Historique de mes commandes & visites"
        description="Retrouvez toutes vos demandes, réservations et visites programmées par propriété, avec itinéraire GPS en temps réel vers le bien."
        actions={
          <Link to="/marketplace">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
              Explorer la Marketplace
            </Button>
          </Link>
        }
      />

      {orders.length === 0 ? (
        <EmptyState
          title="Aucune commande ou visite enregistrée"
          description="Explorez la Marketplace pour programmer une visite ou contacter un propriétaire."
        />
      ) : (
        <div className="space-y-3">
          {orders.map((ord) => (
            <Card key={ord._id} className="border-border">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px]">
                      {ord.orderType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {ord.createdAt.slice(0, 10)}
                    </span>
                  </div>
                  <h4 className="font-bold text-sm text-foreground">{ord.listingTitle}</h4>
                  <p className="text-xs text-muted-foreground">
                    Propriétaire / Agent : <strong>{ord.ownerName}</strong>
                    {ord.address ? (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <MapPin className="size-3 text-emerald-500" />
                        {ord.address}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs font-bold text-emerald-500">
                    {ord.priceMinor.toLocaleString('fr-FR')} {ord.currency}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {typeof ord.latitude === 'number' && typeof ord.longitude === 'number' && (
                    <Link
                      to={`/geo-map?navToLat=${ord.latitude}&navToLng=${ord.longitude}&navName=${encodeURIComponent(ord.listingTitle)}`}
                    >
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5">
                        <Navigation className="size-3.5" />
                        S’y rendre (GPS temps réel)
                      </Button>
                    </Link>
                  )}
                  <Link
                    to={`/messages?target=${encodeURIComponent(ord.ownerName)}&title=${encodeURIComponent(ord.listingTitle)}`}
                  >
                    <Button size="sm" variant="outline" className="text-xs">
                      Discuter
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
