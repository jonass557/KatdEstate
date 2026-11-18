import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  Edit3,
  Eye,
  Flame,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
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
import { PublishListingModal } from '../components/marketplace/publish-listing-modal';
import {
  createAdminSupportTicket,
  deleteCustomMarketplaceListing,
  getAdminSupportTickets,
  getCustomMarketplaceListings,
  getListingMetrics,
  getScheduledVisits,
  replyToAdminSupportTicket,
  updateCustomMarketplaceListing,
  updateScheduledVisitStatus,
  type AdminSupportTicket,
  type CustomMarketplaceListing,
  type ScheduledVisit,
} from '../lib/katdestate-store';

function usePublisherListings(userEmail?: string, role?: string) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const listings = useMemo(() => {
    void tick;
    const all = getCustomMarketplaceListings();
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return all;
    const norm = userEmail?.trim().toLowerCase();
    if (!norm) return all;
    const mine = all.filter(
      (l) =>
        !l.ownerEmail ||
        l.ownerEmail.trim().toLowerCase() === norm ||
        l.contact?.email?.trim().toLowerCase() === norm,
    );
    return mine.length > 0 ? mine : all;
  }, [tick, userEmail, role]);

  return { listings, refresh };
}

function formatPrice(item: CustomMarketplaceListing) {
  const suffix =
    item.billingFrequency === 'DAILY'
      ? ' / jour'
      : item.billingFrequency === 'MONTHLY'
        ? ' / mois'
        : '';
  return `${(item.priceMinor || 0).toLocaleString('fr-FR')} ${item.currency || 'FCFA'}${suffix}`;
}

// ============================================================================
// 1. GESTION DES IMMOBILIERS (Voir, Modifier, Supprimer, Rendre Occupé)
// ============================================================================
export function PublisherListingsPage() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const { listings, refresh } = usePublisherListings(user?.email, role);

  const [publishOpen, setPublishOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<CustomMarketplaceListing | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'OCCUPIED'>('ALL');

  const filtered = useMemo(() => {
    return listings.filter((item) => {
      if (filterStatus === 'AVAILABLE' && item.availabilityStatus === 'OCCUPIED') return false;
      if (filterStatus === 'OCCUPIED' && item.availabilityStatus !== 'OCCUPIED') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.location?.city?.toLowerCase().includes(q) ||
          item.location?.district?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [listings, filterStatus, search]);

  const occupiedCount = listings.filter((l) => l.availabilityStatus === 'OCCUPIED').length;

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des immobiliers"
        description="Consultez, modifiez, supprimez vos biens publiés sur la Marketplace et basculez leur statut en « Occupé » dès qu'ils sont pris."
        actions={
          <Button
            onClick={() => {
              setEditingListing(null);
              setPublishOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
          >
            <Plus className="size-4" />
            Publier une annonce
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Biens publiés"
          value={String(listings.length)}
          hint="Total sur la Marketplace"
          icon={Building2}
        />
        <StatCard
          label="Disponibles"
          value={String(listings.length - occupiedCount)}
          hint="Prêts à la visite"
          icon={CheckCircle2}
        />
        <StatCard
          label="Déjà occupés"
          value={String(occupiedCount)}
          hint="Marqués occupés"
          icon={UserCheck}
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <Input
          placeholder="Rechercher un bien, une ville ou un quartier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-sm"
        />
        <div className="flex gap-2">
          {(['ALL', 'AVAILABLE', 'OCCUPIED'] as const).map((st) => (
            <Button
              key={st}
              size="sm"
              variant={filterStatus === st ? 'primary' : 'outline'}
              onClick={() => setFilterStatus(st)}
              className="text-xs"
            >
              {st === 'ALL' ? 'Tous' : st === 'AVAILABLE' ? 'Disponibles' : 'Occupés'}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun bien publié"
          description="Publiez votre premier bien immobilier avec sa position exacte sur la carte pour le rendre visible sur la Marketplace."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const isOccupied = item.availabilityStatus === 'OCCUPIED';
            const cover = item.photos?.[0]?.url;
            return (
              <Card key={item._id} className="overflow-hidden border-border flex flex-col justify-between">
                <div>
                  <div className="relative h-40 bg-slate-900">
                    {cover ? (
                      <img src={cover} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        <Building2 className="size-8 opacity-40" />
                      </div>
                    )}
                    <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                      <Badge className={isOccupied ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}>
                        {isOccupied ? 'OCCUPÉ' : 'DISPONIBLE'}
                      </Badge>
                      {item.isMeuble && (
                        <Badge className="bg-amber-400 text-slate-950 font-bold">MEUBLÉ</Badge>
                      )}
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{item.title}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                      <span className="truncate">
                        {item.location?.district}, {item.location?.city}
                      </span>
                    </p>
                    <p className="text-sm font-black text-emerald-500">{formatPrice(item)}</p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{item.description}</p>
                  </CardContent>
                </div>

                <div className="px-4 pb-4 pt-2 border-t border-border/60 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs flex-1 gap-1"
                    onClick={() => {
                      setEditingListing(item);
                      setPublishOpen(true);
                    }}
                  >
                    <Edit3 className="size-3.5" />
                    Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant={isOccupied ? 'secondary' : 'outline'}
                    className={`text-xs flex-1 gap-1 ${
                      isOccupied
                        ? 'bg-emerald-600/15 text-emerald-500 border-emerald-500/30'
                        : 'text-amber-500 border-amber-500/30'
                    }`}
                    onClick={() => {
                      updateCustomMarketplaceListing(item._id, {
                        availabilityStatus: isOccupied ? 'AVAILABLE' : 'OCCUPIED',
                      });
                      refresh();
                      toast({
                        title: isOccupied ? 'Bien remis disponible' : 'Bien marqué comme occupé',
                        description: item.title,
                        variant: 'success',
                      });
                    }}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {isOccupied ? 'Rendre libre' : 'Rendre occupé'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-rose-500 border-rose-500/30 hover:bg-rose-500/10"
                    onClick={() => {
                      deleteCustomMarketplaceListing(item._id);
                      refresh();
                      toast({
                        title: 'Bien supprimé',
                        description: `"${item.title}" a été retiré de la Marketplace.`,
                        variant: 'success',
                      });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <PublishListingModal
        isOpen={publishOpen}
        onClose={() => {
          setPublishOpen(false);
          setEditingListing(null);
          refresh();
        }}
        editingListing={editingListing}
        onPublished={() => refresh()}
      />
    </div>
  );
}

// ============================================================================
// 2. GESTION DES MEUBLÉS (Chambres, Studios & Appartements en Location Journalière)
// ============================================================================
export function PublisherMeublesPage() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const { listings, refresh } = usePublisherListings(user?.email, role);

  const [publishOpen, setPublishOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<CustomMarketplaceListing | null>(null);

  const meubles = useMemo(
    () =>
      listings.filter(
        (l) =>
          l.isMeuble ||
          l.billingFrequency === 'DAILY' ||
          l.category === 'CHAMBRE_MEUBLEE' ||
          l.category === 'STUDIO_MEUBLE_JOURNALIER' ||
          l.category === 'APPARTEMENT_MEUBLE',
      ),
    [listings],
  );

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des meublés (Location journalière)"
        description="Publiez et gérez vos chambres meublées, studios meublés et appartements meublés à la journée / nuitée dans la catégorie Meublé de la Marketplace."
        actions={
          <div className="flex gap-2">
            <Link to="/marketplace">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Eye className="size-3.5" />
                Voir dans la Marketplace
              </Button>
            </Link>
            <Button
              onClick={() => {
                setEditingListing(null);
                setPublishOpen(true);
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5"
            >
              <Plus className="size-4" />
              Publier un Meublé (Jour)
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Meublés publiés"
          value={String(meubles.length)}
          hint="Catégorie Meublé"
          icon={BedDouble}
        />
        <StatCard
          label="Disponibles aujourd'hui"
          value={String(meubles.filter((m) => m.availabilityStatus !== 'OCCUPIED').length)}
          hint="Ouverts à la nuitée"
          icon={CheckCircle2}
        />
        <StatCard
          label="Tarif moyen / jour"
          value={
            meubles.length > 0
              ? `${Math.round(
                  meubles.reduce((s, m) => s + (m.priceMinor || 0), 0) / meubles.length,
                ).toLocaleString('fr-FR')} FCFA`
              : '—'
          }
          hint="Location journalière"
          icon={BarChart3}
        />
      </div>

      {meubles.length === 0 ? (
        <EmptyState
          title="Aucun meublé publié"
          description="Cliquez sur « Publier un Meublé (Jour) » pour ajouter une chambre meublée, un studio ou un appartement meublé en location journalière."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meubles.map((item) => {
            const isOccupied = item.availabilityStatus === 'OCCUPIED';
            return (
              <Card key={item._id} className="overflow-hidden border-border">
                <div className="relative h-36 bg-slate-900">
                  {item.photos?.[0]?.url ? (
                    <img
                      src={item.photos[0].url}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <BedDouble className="size-8 opacity-40" />
                    </div>
                  )}
                  <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                    <Badge className="bg-amber-400 text-slate-950 font-black">LOCATION / JOUR</Badge>
                    <Badge className={isOccupied ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}>
                      {isOccupied ? 'OCCUPÉ' : 'LIBRE'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 space-y-2">
                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{item.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {item.location?.district}, {item.location?.city}
                  </p>
                  <p className="text-base font-black text-amber-500">{formatPrice(item)}</p>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1"
                      onClick={() => {
                        setEditingListing(item);
                        setPublishOpen(true);
                      }}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs flex-1"
                      onClick={() => {
                        updateCustomMarketplaceListing(item._id, {
                          availabilityStatus: isOccupied ? 'AVAILABLE' : 'OCCUPIED',
                        });
                        refresh();
                        toast({
                          title: isOccupied ? 'Meublé disponible' : 'Meublé marqué occupé',
                          variant: 'success',
                        });
                      }}
                    >
                      {isOccupied ? 'Libérer' : 'Occuper'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-500"
                      onClick={() => {
                        deleteCustomMarketplaceListing(item._id);
                        refresh();
                        toast({ title: 'Meublé supprimé', variant: 'success' });
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

      <PublishListingModal
        isOpen={publishOpen}
        meubleOnly={!editingListing}
        editingListing={editingListing}
        onClose={() => {
          setPublishOpen(false);
          setEditingListing(null);
          refresh();
        }}
        onPublished={() => refresh()}
      />
    </div>
  );
}

// ============================================================================
// 3. GESTION DES UTILISATEURS (Statistiques & Visites Programmées)
// ============================================================================
export function PublisherUsersPage() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const [tick, setTick] = useState(0);

  const visits = useMemo(() => {
    void tick;
    const all = getScheduledVisits();
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return all;
    const norm = user?.email?.trim().toLowerCase();
    if (!norm) return all;
    const mine = all.filter((v) => !v.ownerEmail || v.ownerEmail.trim().toLowerCase() === norm);
    return mine.length > 0 ? mine : all;
  }, [tick, user?.email, role]);

  const uniqueVisitors = new Set(visits.map((v) => v.visitorEmail || v.visitorPhone)).size;
  const pendingCount = visits.filter((v) => v.status === 'PENDING').length;
  const confirmedCount = visits.filter((v) => v.status === 'CONFIRMED').length;
  const completedCount = visits.filter((v) => v.status === 'COMPLETED').length;

  const handleStatus = (id: string, status: ScheduledVisit['status']) => {
    updateScheduledVisitStatus(id, status);
    setTick((t) => t + 1);
    toast({ title: 'Statut de la visite mis à jour', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des utilisateurs & visites"
        description="Suivez les statistiques des utilisateurs intéressés et gérez toutes les demandes de visite programmées sur vos biens."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Utilisateurs uniques"
          value={String(uniqueVisitors)}
          hint="Visiteurs intéressés"
          icon={Users}
        />
        <StatCard
          label="Visites en attente"
          value={String(pendingCount)}
          hint="À confirmer"
          icon={Calendar}
        />
        <StatCard
          label="Visites confirmées"
          value={String(confirmedCount)}
          hint="Rendez-vous validés"
          icon={UserCheck}
        />
        <StatCard
          label="Visites effectuées"
          value={String(completedCount)}
          hint="Visites terminées"
          icon={CheckCircle2}
        />
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="Aucune visite programmée"
          description="Lorsqu'un utilisateur réserve une visite depuis la Marketplace sur l'un de vos biens, ses coordonnées et le créneau choisi apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {visits.map((v) => (
            <Card key={v._id} className="border-border">
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      className={
                        v.status === 'CONFIRMED'
                          ? 'bg-emerald-600 text-white'
                          : v.status === 'COMPLETED'
                            ? 'bg-sky-600 text-white'
                            : v.status === 'CANCELLED'
                              ? 'bg-rose-600 text-white'
                              : 'bg-amber-500 text-slate-950 font-bold'
                      }
                    >
                      {v.status === 'PENDING'
                        ? 'EN ATTENTE'
                        : v.status === 'CONFIRMED'
                          ? 'CONFIRMÉE'
                          : v.status === 'COMPLETED'
                            ? 'EFFECTUÉE'
                            : 'ANNULÉE'}
                    </Badge>
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Calendar className="size-3.5 text-emerald-500" />
                      {v.scheduledDate} à {v.scheduledTime}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground">
                    {v.visitorName} · <span className="text-emerald-500">{v.visitorPhone}</span>
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Bien concerné : <strong className="text-foreground">{v.listingTitle}</strong>
                    {v.visitorEmail ? ` · ${v.visitorEmail}` : ''}
                  </p>
                  {v.notes && <p className="text-xs italic text-muted-foreground">« {v.notes} »</p>}
                </div>

                <div className="flex flex-wrap gap-2 shrink-0">
                  {v.status === 'PENDING' && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                      onClick={() => handleStatus(v._id, 'CONFIRMED')}
                    >
                      <UserCheck className="size-3.5" />
                      Confirmer
                    </Button>
                  )}
                  {(v.status === 'PENDING' || v.status === 'CONFIRMED') && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs gap-1"
                      onClick={() => handleStatus(v._id, 'COMPLETED')}
                    >
                      <CheckCircle2 className="size-3.5" />
                      Visite effectuée
                    </Button>
                  )}
                  {v.status !== 'CANCELLED' && v.status !== 'COMPLETED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs text-rose-500"
                      onClick={() => handleStatus(v._id, 'CANCELLED')}
                    >
                      <XCircle className="size-3.5" />
                      Annuler
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 4. PERFORMANCE & STATISTIQUES (Biens les plus demandés et les plus visités)
// ============================================================================
export function PublisherStatsPage() {
  const { user, memberships } = useSession();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const { listings } = usePublisherListings(user?.email, role);
  const metrics = useMemo(() => getListingMetrics(), []);
  const visits = useMemo(() => getScheduledVisits(), []);

  const ranked = useMemo(() => {
    return listings
      .map((item) => {
        const m = metrics[item._id] ?? { views: 0, visits: 0, inquiries: 0 };
        const visitCount = visits.filter((v) => v.listingId === item._id).length;
        const totalVisits = Math.max(m.visits || 0, visitCount);
        const demandScore = (m.inquiries || 0) * 3 + totalVisits * 5 + (m.views || 0);
        return {
          item,
          views: m.views || 0,
          visits: totalVisits,
          inquiries: m.inquiries || 0,
          demandScore,
        };
      })
      .sort((a, b) => b.demandScore - a.demandScore);
  }, [listings, metrics, visits]);

  const totalViews = ranked.reduce((s, r) => s + r.views, 0);
  const totalVisits = ranked.reduce((s, r) => s + r.visits, 0);
  const totalInquiries = ranked.reduce((s, r) => s + r.inquiries, 0);
  const maxScore = Math.max(1, ...ranked.map((r) => r.demandScore));

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Performance & statistiques"
        description="Classement des biens immobiliers les plus demandés et les plus visités sur la Marketplace."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Biens suivis"
          value={String(ranked.length)}
          hint="Catalogue actif"
          icon={Building2}
        />
        <StatCard
          label="Consultations totales"
          value={String(totalViews)}
          hint="Vues Marketplace"
          icon={Eye}
        />
        <StatCard
          label="Visites programmées"
          value={String(totalVisits)}
          hint="Demandes de visite"
          icon={Calendar}
        />
        <StatCard
          label="Demandes de contact"
          value={String(totalInquiries)}
          hint="Messages clients"
          icon={MessageSquare}
        />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="size-4 text-amber-500" />
            Classement des biens les plus demandés & visités
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ranked.length === 0 ? (
            <EmptyState
              title="Aucune statistique disponible"
              description="Publiez des biens sur la Marketplace pour suivre leurs consultations, demandes et visites."
            />
          ) : (
            ranked.map((row, idx) => (
              <div
                key={row.item._id}
                className="p-4 rounded-2xl border border-border bg-muted/20 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="size-6 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-black flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="font-bold text-sm text-foreground">{row.item.title}</span>
                  </div>
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[11px]">
                    Score demande : {row.demandScore}
                  </Badge>
                </div>

                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    style={{ width: `${Math.max(8, Math.round((row.demandScore / maxScore) * 100))}%` }}
                  />
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Eye className="size-3.5 text-sky-500" />
                    <strong className="text-foreground">{row.views}</strong> vues
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-emerald-500" />
                    <strong className="text-foreground">{row.visits}</strong> visite(s) programmée(s)
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3.5 text-purple-500" />
                    <strong className="text-foreground">{row.inquiries}</strong> demande(s) client
                  </span>
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
// 5. SIGNALER UN PROBLÈME À L'ADMINISTRATEUR (Bidirectionnel avec réponse Admin)
// ============================================================================
export function PublisherSupportPage() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const [tick, setTick] = useState(0);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('TECHNIQUE');
  const [message, setMessage] = useState('');
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  const tickets = useMemo<AdminSupportTicket[]>(() => {
    void tick;
    const all = getAdminSupportTickets();
    if (isAdmin) return all;
    const norm = user?.email?.trim().toLowerCase();
    return norm ? all.filter((t) => t.senderEmail.trim().toLowerCase() === norm) : all;
  }, [tick, isAdmin, user?.email]);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;
    createAdminSupportTicket({
      senderEmail: user?.email || 'publieur@katdestate.immo',
      senderName: user?.displayName || 'Publieur KatdEstate',
      senderRole: role,
      subject: subject.trim(),
      category,
      message: message.trim(),
    });
    setSubject('');
    setMessage('');
    setTick((t) => t + 1);
    toast({
      title: 'Signalement envoyé à l’Administrateur',
      description: 'Vous recevrez sa réponse directement dans ce fil de discussion.',
      variant: 'success',
    });
  };

  const handleReply = (ticketId: string) => {
    const text = (replyMap[ticketId] || '').trim();
    if (!text) return;
    replyToAdminSupportTicket(ticketId, {
      senderRole: isAdmin ? 'ADMIN' : 'PUBLISHER',
      senderName: user?.displayName || (isAdmin ? 'Administrateur KatdEstate' : 'Publieur'),
      message: text,
    });
    setReplyMap((prev) => ({ ...prev, [ticketId]: '' }));
    setTick((t) => t + 1);
    toast({
      title: isAdmin ? 'Réponse envoyée au publieur' : 'Message envoyé à l’Administrateur',
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title={
          isAdmin
            ? 'Support & Signalements des Publieurs (Admin)'
            : 'Signaler un problème à l’Administrateur'
        }
        description={
          isAdmin
            ? 'Consultez les problèmes signalés par les agents, propriétaires, chefs de quartier/bloc et répondez-leur en direct.'
            : 'Envoyez un message ou signalez un problème à l’Administrateur de la plateforme et suivez ses réponses.'
        }
      />

      {!isAdmin && (
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-4 text-rose-500" />
              Nouveau signalement à l’Administrateur
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <Input
                  placeholder="Objet du problème (ex: Annonce, Carte GPS, Paiement...)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="sm:col-span-2"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="TECHNIQUE">Problème technique</option>
                  <option value="MARKETPLACE">Marketplace / Annonce</option>
                  <option value="PAIEMENT">Paiement / Portefeuille</option>
                  <option value="AUTRE">Autre demande</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                placeholder="Décrivez votre problème ou posez votre question à l’Administrateur..."
                className="w-full rounded-xl border border-input bg-background p-3 text-sm"
              />
              <Button type="submit" className="bg-rose-600 hover:bg-rose-500 text-white gap-2">
                <Send className="size-4" />
                Envoyer à l’Administrateur
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {tickets.length === 0 ? (
          <EmptyState
            title="Aucun signalement"
            description="Aucun échange avec l’Administrateur pour le moment."
          />
        ) : (
          tickets.map((t) => (
            <Card key={t._id} className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge
                        className={
                          t.status === 'REPLIED'
                            ? 'bg-emerald-600 text-white'
                            : t.status === 'RESOLVED'
                              ? 'bg-sky-600 text-white'
                              : 'bg-amber-500 text-slate-950 font-bold'
                        }
                      >
                        {t.status === 'REPLIED'
                          ? 'RÉPONDU PAR ADMIN'
                          : t.status === 'RESOLVED'
                            ? 'RÉSOLU'
                            : 'EN ATTENTE ADMIN'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{t.category}</span>
                    </div>
                    <h4 className="text-sm font-bold text-foreground mt-1">{t.subject}</h4>
                    <p className="text-xs text-muted-foreground">
                      De : {t.senderName} ({t.senderRole}) · {t.senderEmail}
                    </p>
                  </div>
                  {isAdmin && t.status !== 'RESOLVED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => {
                        replyToAdminSupportTicket(
                          t._id,
                          {
                            senderRole: 'ADMIN',
                            senderName: user?.displayName || 'Administrateur',
                            message: 'Ticket marqué comme résolu.',
                          },
                          'RESOLVED',
                        );
                        setTick((x) => x + 1);
                      }}
                    >
                      Marquer résolu
                    </Button>
                  )}
                </div>

                <div className="space-y-2 rounded-xl bg-muted/30 p-3 border border-border/60">
                  {t.replies.map((r) => (
                    <div
                      key={r._id}
                      className={`p-2.5 rounded-xl text-xs ${
                        r.senderRole === 'ADMIN'
                          ? 'bg-emerald-500/15 border border-emerald-500/30 text-foreground ml-4'
                          : 'bg-background border border-border text-foreground mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold mb-1">
                        <span className="flex items-center gap-1">
                          {r.senderRole === 'ADMIN' && (
                            <ShieldCheck className="size-3.5 text-emerald-500" />
                          )}
                          {r.senderName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {r.createdAt.slice(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <p>{r.message}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder={
                      isAdmin
                        ? 'Répondre à ce publieur...'
                        : 'Ajouter une précision pour l’Administrateur...'
                    }
                    value={replyMap[t._id] || ''}
                    onChange={(e) =>
                      setReplyMap((prev) => ({ ...prev, [t._id]: e.target.value }))
                    }
                    className="flex-1 text-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() => handleReply(t._id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1"
                  >
                    <Send className="size-3.5" />
                    Répondre
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
