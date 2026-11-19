import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BedDouble,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Flame,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  UserCheck,
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
import { PublishListingModal } from '../components/marketplace/publish-listing-modal';
import {
  createAdminSupportTicket,
  createMeubleClientStay,
  deleteCustomMarketplaceListing,
  deleteRegisteredMeuble,
  dispatchExpirationNotifications,
  getAdminSupportTickets,
  getCustomMarketplaceListings,
  getListingMetrics,
  getMeubleClientStays,
  getNotificationDispatchLogs,
  getRegisteredMeubles,
  getScheduledVisits,
  markMeubleStayCompleted,
  replyToAdminSupportTicket,
  saveRegisteredMeuble,
  updateCustomMarketplaceListing,
  updateScheduledVisitStatus,
  type AdminSupportTicket,
  type CustomMarketplaceListing,
  type MeubleClientStay,
  type MeubleTypeOption,
  type NotifyChannel,
  type RegisteredMeubleProperty,
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
function formatCountdownRemaining(targetIso: string, nowMs: number): {
  expired: boolean;
  label: string;
} {
  const diff = new Date(targetIso).getTime() - nowMs;
  if (Number.isNaN(diff) || diff <= 0) {
    return { expired: true, label: 'TEMPS EXPIRÉ' };
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}j`);
  parts.push(`${String(hours).padStart(2, '0')}h`);
  parts.push(`${String(mins).padStart(2, '0')}m`);
  parts.push(`${String(secs).padStart(2, '0')}s`);
  return { expired: false, label: parts.join(' ') };
}

const MEUBLE_TYPE_LABELS: Record<MeubleTypeOption, string> = {
  CHAMBRE_MEUBLEE: 'Chambre meublée',
  STUDIO_MEUBLE: 'Studio meublé',
  APPARTEMENT_MEUBLE: 'Appartement meublé',
};

export function PublisherMeublesPage() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const role = memberships?.[0]?.role || (user as any)?.platformRole || 'AGENT';
  const ownerEmail = user?.email || 'proprietaire@katdestate.immo';
  const { listings, refresh } = usePublisherListings(user?.email, role);

  const [subTab, setSubTab] = useState<'meubles' | 'clients' | 'stats'>('meubles');
  const [publishOpen, setPublishOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<CustomMarketplaceListing | null>(null);
  const [tick, setTick] = useState(0);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Enregistrer un meublé dans son parc
  const [regTitle, setRegTitle] = useState('');
  const [regType, setRegType] = useState<MeubleTypeOption>('STUDIO_MEUBLE');
  const [regRate, setRegRate] = useState(25000);
  const [regCity] = useState('Abidjan');
  const [regDistrict, setRegDistrict] = useState('Cocody');
  const [regAddress, setRegAddress] = useState('');

  // Enregistrer un client occupant
  const [stayMeubleId, setStayMeubleId] = useState('');
  const [stayType, setStayType] = useState<MeubleTypeOption>('STUDIO_MEUBLE');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<'DAYS' | 'HOURS'>('DAYS');
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkInTime, setCheckInTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [checkOutDate, setCheckOutDate] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  const [checkOutTime, setCheckOutTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [amountPaid, setAmountPaid] = useState(25000);
  const [ownerNotifyPhone, setOwnerNotifyPhone] = useState('');
  const [notifyChannels, setNotifyChannels] = useState<NotifyChannel[]>(['EMAIL', 'SMS']);

  // Filtres historique / stats par meublé et par période
  const [filterMeubleId, setFilterMeubleId] = useState('ALL');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  const registeredMeubles = useMemo<RegisteredMeubleProperty[]>(() => {
    void tick;
    const all = getRegisteredMeubles();
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return all;
    const norm = ownerEmail.trim().toLowerCase();
    const mine = all.filter((m) => m.ownerEmail.trim().toLowerCase() === norm);
    return mine.length > 0 ? mine : all;
  }, [tick, ownerEmail, role]);

  const marketplaceMeubles = useMemo(
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

  // Parc unifié (meublés publiés + meublés enregistrés)
  const allMeublesUnified = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      type: MeubleTypeOption;
      dailyRate: number;
      city: string;
      district: string;
      source: 'MARKETPLACE' | 'REGISTERED';
      rawListing?: CustomMarketplaceListing;
    }> = [];
    for (const m of marketplaceMeubles) {
      const t: MeubleTypeOption =
        m.category === 'CHAMBRE_MEUBLEE'
          ? 'CHAMBRE_MEUBLEE'
          : m.category === 'APPARTEMENT_MEUBLE'
            ? 'APPARTEMENT_MEUBLE'
            : 'STUDIO_MEUBLE';
      items.push({
        id: m._id,
        title: m.title,
        type: t,
        dailyRate: m.priceMinor || 25000,
        city: m.location?.city || '',
        district: m.location?.district || '',
        source: 'MARKETPLACE',
        rawListing: m,
      });
    }
    for (const r of registeredMeubles) {
      items.push({
        id: r._id,
        title: r.title,
        type: r.meubleType,
        dailyRate: r.dailyRate,
        city: r.city,
        district: r.district,
        source: 'REGISTERED',
      });
    }
    return items;
  }, [marketplaceMeubles, registeredMeubles]);

  const stays = useMemo<MeubleClientStay[]>(() => {
    void tick;
    const all = getMeubleClientStays();
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') return all;
    const norm = ownerEmail.trim().toLowerCase();
    const mine = all.filter((s) => s.ownerEmail.trim().toLowerCase() === norm);
    return mine.length > 0 ? mine : all;
  }, [tick, ownerEmail, role]);

  const notifLogs = useMemo(() => {
    void tick;
    return getNotificationDispatchLogs();
  }, [tick]);

  // Compte à rebours temps réel (chaque seconde) + notification automatique à expiration
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      const currentStays = getMeubleClientStays();
      for (const s of currentStays) {
        if (
          s.status === 'ACTIVE' &&
          !s.notificationSentAt &&
          new Date(s.checkOutIso).getTime() <= now
        ) {
          void dispatchExpirationNotifications(s).then(() => {
            setTick((t) => t + 1);
            toast({
              title: `Temps expiré : ${s.clientName}`,
              description: `Le séjour dans « ${s.meubleTitle} » est arrivé à expiration. Alerte envoyée (${s.notifyChannels.join(', ')}).`,
              variant: 'info',
            });
          });
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [toast]);

  // Recalculer automatiquement date/heure de sortie quand entrée ou durée change
  const syncCheckoutFromDuration = (
    inDate: string,
    inTime: string,
    val: number,
    unit: 'DAYS' | 'HOURS',
  ) => {
    const start = new Date(`${inDate}T${inTime || '00:00'}:00`);
    if (Number.isNaN(start.getTime())) return;
    const addMs = (unit === 'DAYS' ? val * 24 : val) * 3600 * 1000;
    const end = new Date(start.getTime() + addMs);
    setCheckOutDate(end.toISOString().slice(0, 10));
    setCheckOutTime(end.toTimeString().slice(0, 5));
  };

  const toggleNotifyChannel = (ch: NotifyChannel) => {
    setNotifyChannels((prev) =>
      prev.includes(ch) ? (prev.length > 1 ? prev.filter((c) => c !== ch) : prev) : [...prev, ch],
    );
  };

  const handleRegisterMeuble = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regTitle.trim()) return;
    saveRegisteredMeuble({
      ownerEmail,
      title: regTitle.trim(),
      meubleType: regType,
      dailyRate: Number(regRate) || 25000,
      city: regCity.trim(),
      district: regDistrict.trim(),
      address: regAddress.trim(),
    });
    setRegTitle('');
    setRegAddress('');
    setTick((t) => t + 1);
    toast({
      title: 'Meublé enregistré !',
      description: 'Vous pouvez maintenant y enregistrer des clients occupants.',
      variant: 'success',
    });
  };

  const handleRegisterClientStay = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) return;
    const chosenMeuble = allMeublesUnified.find((m) => m.id === stayMeubleId) || allMeublesUnified[0];
    const finalMeubleId = chosenMeuble?.id || `manual-${stayType}`;
    const finalMeubleTitle = chosenMeuble?.title || MEUBLE_TYPE_LABELS[stayType];
    const finalType = chosenMeuble?.type || stayType;

    const checkInIso = new Date(`${checkInDate}T${checkInTime || '00:00'}:00`).toISOString();
    const checkOutIso = new Date(`${checkOutDate}T${checkOutTime || '00:00'}:00`).toISOString();

    createMeubleClientStay({
      ownerEmail,
      ownerPhone: ownerNotifyPhone.trim() || undefined,
      meubleId: finalMeubleId,
      meubleTitle: finalMeubleTitle,
      meubleType: finalType,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim() || undefined,
      durationValue,
      durationUnit,
      durationLabel: `${durationValue} ${durationUnit === 'DAYS' ? 'jour(s)' : 'heure(s)'}`,
      checkInDate,
      checkInTime,
      checkOutDate,
      checkOutTime,
      checkInIso,
      checkOutIso,
      amountPaid: Number(amountPaid) || 0,
      notifyChannels,
    });

    setClientName('');
    setClientPhone('');
    setClientEmail('');
    setTick((t) => t + 1);
    setSubTab('clients');
    toast({
      title: 'Client enregistré dans le meublé !',
      description: `Compte à rebours démarré jusqu’au ${checkOutDate} à ${checkOutTime}. Notification programmée (${notifyChannels.join(', ')}).`,
      variant: 'success',
    });
  };

  // Statistiques par meublé
  const statsByMeuble = useMemo(() => {
    const map = new Map<
      string,
      { title: string; type: MeubleTypeOption; totalClients: number; totalRevenue: number; activeCount: number }
    >();
    for (const m of allMeublesUnified) {
      map.set(m.id, {
        title: m.title,
        type: m.type,
        totalClients: 0,
        totalRevenue: 0,
        activeCount: 0,
      });
    }
    for (const s of stays) {
      const entry = map.get(s.meubleId) ?? {
        title: s.meubleTitle,
        type: s.meubleType,
        totalClients: 0,
        totalRevenue: 0,
        activeCount: 0,
      };
      entry.totalClients += 1;
      entry.totalRevenue += s.amountPaid || 0;
      if (s.status === 'ACTIVE' && new Date(s.checkOutIso).getTime() > nowMs) {
        entry.activeCount += 1;
      }
      map.set(s.meubleId, entry);
    }
    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [allMeublesUnified, stays, nowMs]);

  // Historique filtré par meublé et par période
  const filteredHistory = useMemo(() => {
    return stays.filter((s) => {
      if (filterMeubleId !== 'ALL' && s.meubleId !== filterMeubleId) return false;
      if (filterFromDate && s.checkInDate < filterFromDate) return false;
      if (filterToDate && s.checkInDate > filterToDate) return false;
      return true;
    });
  }, [stays, filterMeubleId, filterFromDate, filterToDate]);

  const activeStays = stays.filter((s) => s.status !== 'COMPLETED');
  const totalRevenueAll = stays.reduce((sum, s) => sum + (s.amountPaid || 0), 0);

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="Gestion des meublés (Location journalière & Clients)"
        description="Publiez et enregistrez vos chambres, studios et appartements meublés, enregistrez vos clients avec compte à rebours en direct et alertes automatiques (Email, SMS, Appel)."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/marketplace">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                <Eye className="size-3.5" />
                Catégorie Meublé Marketplace
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
              Publier un Meublé (Marketplace)
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Meublés enregistrés"
          value={String(allMeublesUnified.length)}
          hint="Marketplace + Parc"
          icon={BedDouble}
        />
        <StatCard
          label="Clients actifs / en cours"
          value={String(activeStays.length)}
          hint="Avec compte à rebours"
          icon={Clock}
        />
        <StatCard
          label="Total clients accueillis"
          value={String(stays.length)}
          hint="Tous meublés confondus"
          icon={Users}
        />
        <StatCard
          label="Recettes meublés"
          value={`${totalRevenueAll.toLocaleString('fr-FR')} FCFA`}
          hint="Paiements enregistrés"
          icon={Wallet}
        />
      </div>

      {/* Onglets de gestion des meublés */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Button
          size="sm"
          variant={subTab === 'meubles' ? 'primary' : 'outline'}
          onClick={() => setSubTab('meubles')}
          className="text-xs gap-1.5"
        >
          <BedDouble className="size-3.5" />
          Mes Meublés ({allMeublesUnified.length})
        </Button>
        <Button
          size="sm"
          variant={subTab === 'clients' ? 'primary' : 'outline'}
          onClick={() => setSubTab('clients')}
          className="text-xs gap-1.5"
        >
          <Clock className="size-3.5" />
          Clients & Compte à rebours ({activeStays.length})
        </Button>
        <Button
          size="sm"
          variant={subTab === 'stats' ? 'primary' : 'outline'}
          onClick={() => setSubTab('stats')}
          className="text-xs gap-1.5"
        >
          <BarChart3 className="size-3.5" />
          Statistiques par meublé & Historique ({stays.length})
        </Button>
      </div>

      {/* ONGLET 1 : MES MEUBLÉS */}
      {subTab === 'meubles' && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Plus className="size-4 text-emerald-500" />
                Enregistrer un Meublé dans mon parc
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterMeuble} className="grid gap-3 sm:grid-cols-6">
                <Input
                  placeholder="Nom / Libellé (ex: Studio Meublé A1)"
                  value={regTitle}
                  onChange={(e) => setRegTitle(e.target.value)}
                  required
                  className="sm:col-span-2"
                />
                <select
                  value={regType}
                  onChange={(e) => setRegType(e.target.value as MeubleTypeOption)}
                  className="h-10 rounded-md border border-input bg-background px-2 text-xs"
                >
                  <option value="CHAMBRE_MEUBLEE">Chambre meublée</option>
                  <option value="STUDIO_MEUBLE">Studio meublé</option>
                  <option value="APPARTEMENT_MEUBLE">Appartement meublé</option>
                </select>
                <Input
                  type="number"
                  placeholder="Prix / jour (FCFA)"
                  value={regRate}
                  onChange={(e) => setRegRate(Number(e.target.value))}
                  required
                />
                <Input
                  placeholder="Ville / Quartier"
                  value={regDistrict}
                  onChange={(e) => setRegDistrict(e.target.value)}
                />
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold">
                  Enregistrer
                </Button>
              </form>
            </CardContent>
          </Card>

          {allMeublesUnified.length === 0 ? (
            <EmptyState
              title="Aucun meublé enregistré"
              description="Enregistrez vos meublés ci-dessus ou publiez un meublé sur la Marketplace pour commencer."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {allMeublesUnified.map((item) => {
                const stat = statsByMeuble.find((s) => s.id === item.id);
                const isOccupied = item.rawListing?.availabilityStatus === 'OCCUPIED';
                return (
                  <Card key={item.id} className="overflow-hidden border-border">
                    {item.rawListing?.photos?.[0]?.url && (
                      <div className="relative h-32 bg-slate-900">
                        <img
                          src={item.rawListing.photos[0].url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-2 left-2 flex gap-1">
                          <Badge className="bg-amber-400 text-slate-950 font-black text-[10px]">
                            LOCATION / JOUR
                          </Badge>
                          <Badge className={isOccupied ? 'bg-rose-600 text-white text-[10px]' : 'bg-emerald-600 text-white text-[10px]'}>
                            {isOccupied ? 'OCCUPÉ' : 'LIBRE'}
                          </Badge>
                        </div>
                      </div>
                    )}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge className="bg-muted text-foreground text-[10px]">
                          {MEUBLE_TYPE_LABELS[item.type]}
                        </Badge>
                        <span className="text-[11px] font-bold text-emerald-500">
                          {stat?.totalClients || 0} client(s) accueilli(s)
                        </span>
                      </div>
                      <h3 className="font-bold text-sm text-foreground line-clamp-1">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.district} {item.city ? `· ${item.city}` : ''}
                      </p>
                      <p className="text-base font-black text-amber-500">
                        {item.dailyRate.toLocaleString('fr-FR')} FCFA / jour
                      </p>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex-1"
                          onClick={() => {
                            setStayMeubleId(item.id);
                            setStayType(item.type);
                            setAmountPaid(item.dailyRate);
                            setSubTab('clients');
                          }}
                        >
                          + Enregistrer client
                        </Button>
                        {item.rawListing ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => {
                                setEditingListing(item.rawListing!);
                                setPublishOpen(true);
                              }}
                            >
                              <Edit3 className="size-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-rose-500"
                              onClick={() => {
                                deleteCustomMarketplaceListing(item.id);
                                refresh();
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-rose-500"
                            onClick={() => {
                              deleteRegisteredMeuble(item.id);
                              setTick((t) => t + 1);
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONGLET 2 : CLIENTS OCCUPANTS & COMPTE À REBOURS */}
      {subTab === 'clients' && (
        <div className="space-y-6">
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="size-4 text-emerald-500" />
                Enregistrer un client occupant un meublé
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegisterClientStay} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Meublé concerné</label>
                    <select
                      value={stayMeubleId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStayMeubleId(val);
                        const found = allMeublesUnified.find((m) => m.id === val);
                        if (found) {
                          setStayType(found.type);
                          setAmountPaid(found.dailyRate * Math.max(1, durationUnit === 'DAYS' ? durationValue : 1));
                        }
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="">— Sélectionner un meublé ou type ci-contre —</option>
                      {allMeublesUnified.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.title} ({m.dailyRate.toLocaleString('fr-FR')} FCFA/j)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Type de meublé</label>
                    <select
                      value={stayType}
                      onChange={(e) => setStayType(e.target.value as MeubleTypeOption)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-xs"
                    >
                      <option value="CHAMBRE_MEUBLEE">Chambre meublée</option>
                      <option value="STUDIO_MEUBLE">Studio meublé</option>
                      <option value="APPARTEMENT_MEUBLE">Appartement meublé</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Prix payé par le client (FCFA) *</label>
                    <Input
                      type="number"
                      min={0}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Nom complet du client *</label>
                    <Input
                      placeholder="Ex: M. Konan Kouassi"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Téléphone du client *</label>
                    <Input
                      placeholder="Ex: +225 07 00 00 00"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Email du client (optionnel)</label>
                    <Input
                      type="email"
                      placeholder="client@email.com"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-6">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Durée</label>
                    <Input
                      type="number"
                      min={1}
                      value={durationValue}
                      onChange={(e) => {
                        const v = Math.max(1, Number(e.target.value));
                        setDurationValue(v);
                        syncCheckoutFromDuration(checkInDate, checkInTime, v, durationUnit);
                      }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Unité</label>
                    <select
                      value={durationUnit}
                      onChange={(e) => {
                        const u = e.target.value as 'DAYS' | 'HOURS';
                        setDurationUnit(u);
                        syncCheckoutFromDuration(checkInDate, checkInTime, durationValue, u);
                      }}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="DAYS">Jour(s)</option>
                      <option value="HOURS">Heure(s)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Jour d’entrée</label>
                    <Input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => {
                        setCheckInDate(e.target.value);
                        syncCheckoutFromDuration(e.target.value, checkInTime, durationValue, durationUnit);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Heure d’entrée</label>
                    <Input
                      type="time"
                      value={checkInTime}
                      onChange={(e) => {
                        setCheckInTime(e.target.value);
                        syncCheckoutFromDuration(checkInDate, e.target.value, durationValue, durationUnit);
                      }}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Jour de sortie</label>
                    <Input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Heure de sortie</label>
                    <Input
                      type="time"
                      value={checkOutTime}
                      onChange={(e) => setCheckOutTime(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Bell className="size-4 text-amber-500" />
                      Comment souhaitez-vous être notifié à l’expiration du séjour ?
                    </span>
                    <Input
                      placeholder="Votre N° pour SMS/Appel (optionnel)"
                      value={ownerNotifyPhone}
                      onChange={(e) => setOwnerNotifyPhone(e.target.value)}
                      className="sm:w-64 h-8 text-xs"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'EMAIL', label: 'Par Email', icon: Mail },
                        { id: 'SMS', label: 'Par SMS', icon: MessageSquare },
                        { id: 'CALL', label: 'Par Appel Vocal', icon: PhoneCall },
                      ] as const
                    ).map((ch) => {
                      const active = notifyChannels.includes(ch.id);
                      const ChIcon = ch.icon;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggleNotifyChannel(ch.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border transition ${
                            active
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-background text-muted-foreground border-border'
                          }`}
                        >
                          <ChIcon className="size-3.5" />
                          {ch.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2">
                  <Plus className="size-4" />
                  Enregistrer le client & Démarrer le compte à rebours
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Liste des clients en cours avec compte à rebours temps réel */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Clients occupants actifs & Compte à rebours en direct
            </h3>
            {activeStays.length === 0 ? (
              <EmptyState
                title="Aucun client actuellement enregistré"
                description="Enregistrez un client dans le formulaire ci-dessus pour suivre le temps restant en direct."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {activeStays.map((s) => {
                  const cd = formatCountdownRemaining(s.checkOutIso, nowMs);
                  return (
                    <Card
                      key={s._id}
                      className={`border ${
                        cd.expired ? 'border-rose-500/60 bg-rose-500/5' : 'border-emerald-500/30'
                      }`}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={cd.expired ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'}>
                                {cd.expired ? 'EXPIRÉ' : 'EN COURS'}
                              </Badge>
                              <span className="text-xs font-semibold text-muted-foreground">
                                {MEUBLE_TYPE_LABELS[s.meubleType]}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-foreground mt-1">{s.meubleTitle}</h4>
                          </div>
                          <div
                            className={`px-3 py-1.5 rounded-xl font-mono text-xs font-black ${
                              cd.expired
                                ? 'bg-rose-600 text-white animate-pulse'
                                : 'bg-slate-900 text-emerald-400 border border-emerald-500/40'
                            }`}
                          >
                            ⏱ {cd.label}
                          </div>
                        </div>

                        <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Client :</span>
                            <strong className="text-foreground">{s.clientName}</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Téléphone :</span>
                            <strong className="text-foreground flex items-center gap-1">
                              <Phone className="size-3 text-emerald-500" />
                              {s.clientPhone}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Entrée :</span>
                            <strong>
                              {s.checkInDate} à {s.checkInTime}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Sortie prévue :</span>
                            <strong>
                              {s.checkOutDate} à {s.checkOutTime} ({s.durationLabel})
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Prix payé :</span>
                            <strong className="text-emerald-500">
                              {s.amountPaid.toLocaleString('fr-FR')} FCFA
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Alertes expiration :</span>
                            <strong>{s.notifyChannels.join(' + ')}</strong>
                          </div>
                          {s.notificationSentAt && (
                            <div className="text-[11px] text-amber-500 font-semibold pt-1">
                              ✓ Notification d’expiration déclenchée à{' '}
                              {s.notificationSentAt.slice(11, 19)}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs flex-1"
                            onClick={() => {
                              void dispatchExpirationNotifications(s).then(() => {
                                setTick((t) => t + 1);
                                toast({
                                  title: 'Notification envoyée !',
                                  description: `Canaux déclenchés : ${s.notifyChannels.join(', ')}`,
                                  variant: 'success',
                                });
                              });
                            }}
                          >
                            <Bell className="size-3.5 mr-1" />
                            Notifier maintenant
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs flex-1"
                            onClick={() => {
                              markMeubleStayCompleted(s._id);
                              setTick((t) => t + 1);
                              toast({ title: 'Séjour clôturé et archivé', variant: 'success' });
                            }}
                          >
                            <CheckCircle2 className="size-3.5 mr-1" />
                            Clôturer / Libérer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONGLET 3 : STATISTIQUES PAR MEUBLÉ & HISTORIQUE PAR PÉRIODE */}
      {subTab === 'stats' && (
        <div className="space-y-6">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="size-4 text-emerald-500" />
                Statistiques d’occupation par meublé enregistré
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {statsByMeuble.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucune donnée disponible.</p>
              ) : (
                statsByMeuble.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border p-3 bg-muted/20"
                  >
                    <div>
                      <p className="font-bold text-sm text-foreground">{row.title}</p>
                      <p className="text-xs text-muted-foreground">{MEUBLE_TYPE_LABELS[row.type]}</p>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs">
                      <Badge className="bg-sky-500/15 text-sky-500 border border-sky-500/30">
                        {row.totalClients} client(s) total
                      </Badge>
                      <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                        {row.activeCount} en cours
                      </Badge>
                      <strong className="text-amber-500">
                        {row.totalRevenue.toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="size-4 text-sky-500" />
                Historique des clients par meublé et par période
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  value={filterMeubleId}
                  onChange={(e) => setFilterMeubleId(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-xs"
                >
                  <option value="ALL">Tous les meublés</option>
                  {allMeublesUnified.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <Input
                  type="date"
                  value={filterFromDate}
                  onChange={(e) => setFilterFromDate(e.target.value)}
                  placeholder="Date début"
                />
                <Input
                  type="date"
                  value={filterToDate}
                  onChange={(e) => setFilterToDate(e.target.value)}
                  placeholder="Date fin"
                />
              </div>

              {filteredHistory.length === 0 ? (
                <EmptyState
                  title="Aucun séjour sur cette période"
                  description="Modifiez les filtres ou enregistrez un premier client occupant."
                />
              ) : (
                <div className="space-y-2">
                  {filteredHistory.map((h) => (
                    <div
                      key={h._id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                    >
                      <div className="space-y-0.5">
                        <p className="font-bold text-foreground">
                          {h.clientName} ({h.clientPhone}) —{' '}
                          <span className="text-emerald-500">{h.meubleTitle}</span>
                        </p>
                        <p className="text-muted-foreground">
                          Du {h.checkInDate} {h.checkInTime} au {h.checkOutDate} {h.checkOutTime} (
                          {h.durationLabel}) · Alertes : {h.notifyChannels.join(', ')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <strong className="text-amber-500">
                          {h.amountPaid.toLocaleString('fr-FR')} FCFA
                        </strong>
                        <Badge className="bg-muted text-foreground">{h.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {notifLogs.length > 0 && (
                <div className="pt-4 border-t border-border space-y-2">
                  <h4 className="text-xs font-bold uppercase text-muted-foreground">
                    Journal des notifications d’expiration (Email / SMS / Appel)
                  </h4>
                  {notifLogs.slice(0, 10).map((nl) => (
                    <div
                      key={nl._id}
                      className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-[11px] flex flex-wrap justify-between gap-2"
                    >
                      <span>
                        <strong>[{nl.channel}]</strong> {nl.clientName} ({nl.meubleTitle}) →{' '}
                        {nl.recipient}
                      </span>
                      <span className="text-muted-foreground">
                        {nl.status} · {nl.createdAt.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
