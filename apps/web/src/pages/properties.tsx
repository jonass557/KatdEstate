import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Download,
  Grid3x3,
  Home,
  List,
  Plus,
  Briefcase,
  Trash2,
  Edit,
  MapPin,
  CheckCircle2,
  Layers,
  DoorOpen,
  PieChart,
  Filter,
  Sparkles,
} from 'lucide-react';
import { propertyInputSchema, type PropertyInput } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button, buttonVariants } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL, apiRequest, getAccessToken } from '../lib/api-client';
import { useOrgList, useOrgPath, useOrgQuery } from '../lib/query';
import { PropertyDelegationModal, type DelegationData } from '../components/properties/property-delegation-modal';
import { AddUnitModal } from '../components/properties/add-unit-modal';

export const STORAGE_PROPERTIES_KEY = 'katdestate_custom_properties';
export const STORAGE_UNITS_KEY = 'katdestate_custom_units';

export interface Property {
  _id: string;
  name: string;
  type?: string;
  customPropertyType?: string;
  address: string;
  city: string;
  country: string;
  status: string;
  description?: string;
  zone?: string;
  chambreSimpleCount?: number;
  chambreModerneCount?: number;
  studioSimpleCount?: number;
  studioModerneCount?: number;
  appartementCount?: number;
  otherCustomType?: string;
  otherCustomCount?: number;
  roomsCount?: number;
  studiosCount?: number;
  apartmentsCount?: number;
  otherUnitsCount?: number;
  delegation?: DelegationData;
}

interface Unit {
  _id: string;
  propertyId: string;
  name: string;
  number?: string;
  floor?: number;
  type: string;
  status: string;
  rentAmountMinor: number;
  surfaceM2?: number;
  bedrooms?: number;
  amenities?: string[];
}

interface PropertyStats {
  units: number;
  occupied: number;
  available: number;
  occupancyRate: number;
  collectedMinor: number;
  overdueMinor: number;
  openMaintenance: number;
}

const UNIT_TYPE_LABELS: Record<string, string> = {
  ROOM: 'Chambre simple',
  ROOM_MODERN: 'Chambre moderne',
  STUDIO: 'Studio simple',
  STUDIO_MODERN: 'Studio moderne',
  APARTMENT: 'Appartement',
  HOUSE: 'Maison',
  OFFICE: 'Bureau',
  SHOP: 'Boutique',
  COMMERCIAL: 'Local commercial',
  PARKING: 'Parking',
  OTHER: 'Autre',
};

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Disponible',
  OCCUPIED: 'Occupé',
  RESERVED: 'Réservé',
  MAINTENANCE: 'Maintenance',
  UNAVAILABLE: 'Indisponible',
  DRAFT: 'Brouillon',
  ACTIVE: 'Active',
  ARCHIVED: 'Archivée',
};

export function getLocalProperties(): Property[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_PROPERTIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalProperties(props: Property[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PROPERTIES_KEY, JSON.stringify(props));
  } catch {}
}

export function getLocalUnits(): Unit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_UNITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalUnits(units: Unit[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_UNITS_KEY, JSON.stringify(units));
  } catch {}
}

export function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [delegatingProperty, setDelegatingProperty] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [localProps, setLocalProps] = useState<Property[]>(() => getLocalProperties());

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const query = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (search) query.set('search', search);
  if (status) query.set('status', status);

  const { data, isLoading } = useOrgList<Property>(
    ['properties', search, status, page],
    `/properties?${query.toString()}`
  );

  // Fusionner les propriétés de l'API avec celles stockées localement
  const allProperties = useMemo<Property[]>(() => {
    const apiItems = data?.data ?? [];
    const map = new Map<string, Property>();

    for (const p of apiItems) {
      map.set(p._id, p);
    }
    for (const lp of localProps) {
      map.set(lp._id, lp);
    }

    let result = Array.from(map.values());

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.address?.toLowerCase().includes(q) ||
          p.city?.toLowerCase().includes(q) ||
          p.zone?.toLowerCase().includes(q)
      );
    }

    if (status) {
      result = result.filter((p) => p.status === status);
    }

    if (selectedZone !== 'ALL') {
      result = result.filter((p) => (p.zone || p.city || 'Non spécifiée') === selectedZone);
    }

    return result;
  }, [data?.data, localProps, search, status, selectedZone]);

  // Statistiques de composition et de zones calculées en temps réel
  const stats = useMemo(() => {
    let totalChambresSimples = 0;
    let totalChambresModernes = 0;
    let totalStudiosSimples = 0;
    let totalStudiosModernes = 0;
    let totalAppartements = 0;
    let totalAutres = 0;
    const zoneCounts: Record<string, number> = {};

    for (const p of allProperties) {
      const chSimple = p.chambreSimpleCount ?? p.roomsCount ?? 0;
      const chModerne = p.chambreModerneCount ?? 0;
      const stSimple = p.studioSimpleCount ?? p.studiosCount ?? 0;
      const stModerne = p.studioModerneCount ?? 0;
      const appt = p.appartementCount ?? p.apartmentsCount ?? 0;
      const autr = p.otherCustomCount ?? p.otherUnitsCount ?? 0;

      totalChambresSimples += chSimple;
      totalChambresModernes += chModerne;
      totalStudiosSimples += stSimple;
      totalStudiosModernes += stModerne;
      totalAppartements += appt;
      totalAutres += autr;

      const zoneKey = p.zone?.trim() || p.city?.trim() || 'Non spécifiée';
      zoneCounts[zoneKey] = (zoneCounts[zoneKey] || 0) + 1;
    }

    const totalUnits =
      totalChambresSimples +
      totalChambresModernes +
      totalStudiosSimples +
      totalStudiosModernes +
      totalAppartements +
      totalAutres;

    return {
      totalProperties: allProperties.length,
      totalUnits,
      totalChambresSimples,
      totalChambresModernes,
      totalStudiosSimples,
      totalStudiosModernes,
      totalAppartements,
      totalAutres,
      zoneCounts,
    };
  }, [allProperties]);

  const delegationMutation = useMutation({
    mutationFn: async ({ id, delegation }: { id: string; delegation: DelegationData }) => {
      try {
        await apiRequest(`${base}/properties/${id}`, {
          method: 'PATCH',
          body: { delegation },
        });
      } catch {
        // En cas de non disponibilité de l'API distante, on met à jour localement
      }
      const updated = localProps.map((p) => (p._id === id ? { ...p, delegation } : p));
      setLocalProps(updated);
      saveLocalProperties(updated);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setDelegatingProperty(null);
      toast({
        title: 'Mandat de gestion enregistré',
        description: 'La délégation a été validée avec succès.',
        variant: 'success',
      });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        await apiRequest(`${base}/properties/${id}`, { method: 'DELETE' });
      } catch {
        // Suppression locale
      }
      const updated = localProps.filter((p) => p._id !== id);
      setLocalProps(updated);
      saveLocalProperties(updated);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setDeletingProperty(null);
      toast({
        title: 'Propriété supprimée',
        description: 'Le bien a été retiré de votre parc immobilier.',
        variant: 'success',
      });
    },
    onError: (err: Error) => toast({ title: 'Suppression impossible', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Propriétés"
        description="Créez, modifiez, supprimez vos propriétés, configurez leur composition (chambres simples, chambres modernes, studios, appartements) et suivez vos statistiques par zone."
        actions={
          <div className="flex items-center gap-2">
            <Link to="/properties/new" className={buttonVariants('primary')}>
              <Plus className="size-4" /> Nouvelle propriété
            </Link>
          </div>
        }
      />

      {/* DASHBOARD STATISTIQUES GESTION DES PROPRIÉTÉS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Propriétés Actives"
          value={String(stats.totalProperties)}
          hint="Enregistrées dans votre patrimoine"
          icon={Building2}
        />
        <StatCard
          label="Total Logements & Lots"
          value={String(stats.totalUnits)}
          hint="Chambres, studios et appartements"
          icon={Home}
        />
        <StatCard
          label="Chambres Déclarées"
          value={String(stats.totalChambresSimples + stats.totalChambresModernes)}
          hint={`${stats.totalChambresSimples} simples · ${stats.totalChambresModernes} modernes`}
          icon={DoorOpen}
        />
        <StatCard
          label="Studios & Appartements"
          value={String(stats.totalStudiosSimples + stats.totalStudiosModernes + stats.totalAppartements)}
          hint={`${stats.totalStudiosSimples + stats.totalStudiosModernes} studios · ${stats.totalAppartements} appts`}
          icon={Layers}
        />
      </div>

      {/* DÉTAIL DES COMPOSITIONS & RÉPARTITION PAR ZONE */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Composition globale détaillée */}
        <Card className="lg:col-span-2 border-border bg-card/60">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PieChart className="size-4 text-emerald-500" />
                Quantités en terme de composition globale
              </span>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                {stats.totalUnits} LOGEMENTS
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Chambres simples</p>
                  <p className="text-base font-black text-foreground">{stats.totalChambresSimples}</p>
                </div>
                <DoorOpen className="size-5 text-blue-500/60" />
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Chambres modernes</p>
                  <p className="text-base font-black text-emerald-500">{stats.totalChambresModernes}</p>
                </div>
                <DoorOpen className="size-5 text-emerald-500/60" />
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Studios simples</p>
                  <p className="text-base font-black text-foreground">{stats.totalStudiosSimples}</p>
                </div>
                <Home className="size-5 text-cyan-500/60" />
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Studios modernes</p>
                  <p className="text-base font-black text-teal-400">{stats.totalStudiosModernes}</p>
                </div>
                <Home className="size-5 text-teal-400/60" />
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Appartements</p>
                  <p className="text-base font-black text-purple-400">{stats.totalAppartements}</p>
                </div>
                <Building2 className="size-5 text-purple-400/60" />
              </div>

              <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-[11px]">Autres types</p>
                  <p className="text-base font-black text-amber-400">{stats.totalAutres}</p>
                </div>
                <Layers className="size-5 text-amber-400/60" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Répartition par Zone */}
        <Card className="border-border bg-card/60">
          <CardContent className="p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <MapPin className="size-4 text-primary" />
                Propriétés par Zone
              </span>
              <span className="text-[10px] text-muted-foreground">Cliquez pour filtrer</span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto pr-1">
              <button
                type="button"
                onClick={() => setSelectedZone('ALL')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedZone === 'ALL'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-background hover:bg-muted text-muted-foreground border border-border'
                }`}
              >
                Toutes ({allProperties.length})
              </button>

              {Object.entries(stats.zoneCounts).map(([zoneName, count]) => (
                <button
                  key={zoneName}
                  type="button"
                  onClick={() => setSelectedZone(selectedZone === zoneName ? 'ALL' : zoneName)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                    selectedZone === zoneName
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-background hover:bg-muted text-foreground border border-border'
                  }`}
                >
                  <span>{zoneName}</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-muted text-[10px] font-bold">
                    {count}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par nom, zone ou adresse..."
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ARCHIVED">Archivée</option>
        </select>

        {selectedZone !== 'ALL' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedZone('ALL')}
            className="text-xs h-9 text-emerald-500 border-emerald-500/30"
          >
            Filtre zone : {selectedZone} (Réinitialiser)
          </Button>
        )}

        <div className="ml-auto flex gap-1">
          <Button
            variant={view === 'list' ? 'secondary' : 'ghost'}
            onClick={() => setView('list')}
            aria-label="Vue liste"
          >
            <List className="size-4" />
          </Button>
          <Button
            variant={view === 'grid' ? 'secondary' : 'ghost'}
            onClick={() => setView('grid')}
            aria-label="Vue grille"
          >
            <Grid3x3 className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading && allProperties.length === 0 ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

      {!isLoading && allProperties.length === 0 ? (
        <EmptyState
          title="Aucune propriété trouvée"
          description="Enregistrez votre première propriété avec sa composition détaillée (chambres, studios, appartements)."
        />
      ) : null}

      <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {allProperties.map((property) => {
          const chSimple = property.chambreSimpleCount ?? property.roomsCount ?? 0;
          const chModerne = property.chambreModerneCount ?? 0;
          const stSimple = property.studioSimpleCount ?? property.studiosCount ?? 0;
          const stModerne = property.studioModerneCount ?? 0;
          const appt = property.appartementCount ?? property.apartmentsCount ?? 0;
          const autr = property.otherCustomCount ?? property.otherUnitsCount ?? 0;
          const totalUnits = chSimple + chModerne + stSimple + stModerne + appt + autr;

          return (
            <Card key={property._id} className="border-border hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-foreground leading-tight">{property.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <MapPin className="size-3 text-primary shrink-0" />
                      <span>{property.zone || property.city || 'Abidjan'}</span>
                      <span className="text-[10px] opacity-75">· {property.address}</span>
                    </p>
                  </div>
                  <Badge className="text-[10px] font-bold">
                    {STATUS_LABELS[property.status] ?? property.status}
                  </Badge>
                </div>

                {/* Type de propriété & Total Logements */}
                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/60">
                  <span className="text-muted-foreground font-medium">
                    {property.customPropertyType || property.type || 'Immeuble'}
                  </span>
                  <span className="font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {totalUnits} logement{totalUnits > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Composition détaillée par badges */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {chSimple > 0 && (
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[11px] font-semibold">
                      {chSimple} ch. simple{chSimple > 1 ? 's' : ''}
                    </span>
                  )}
                  {chModerne > 0 && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                      {chModerne} ch. moderne{chModerne > 1 ? 's' : ''}
                    </span>
                  )}
                  {stSimple > 0 && (
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[11px] font-semibold">
                      {stSimple} studio{stSimple > 1 ? 's' : ''} simple
                    </span>
                  )}
                  {stModerne > 0 && (
                    <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20 text-[11px] font-semibold">
                      {stModerne} studio{stModerne > 1 ? 's' : ''} mod.
                    </span>
                  )}
                  {appt > 0 && (
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[11px] font-semibold">
                      {appt} appt{appt > 1 ? 's' : ''}
                    </span>
                  )}
                  {autr > 0 && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                      {autr} {property.otherCustomType || 'autre'}
                    </span>
                  )}
                </div>

                {/* Statut délégation s'il y a lieu */}
                {property.delegation?.managerName && (
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      Mandat : {property.delegation.managerName}
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {property.delegation.commissionRate}%
                    </span>
                  </div>
                )}

                {/* Actions de gestion */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                  <Link
                    to={`/properties/${property._id}`}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    <span>Gérer les logements</span> →
                  </Link>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDelegatingProperty(property)}
                      className="h-7 px-2 text-xs text-amber-500 hover:text-amber-400"
                      title="Déléguer la gestion de cette propriété"
                    >
                      <Briefcase className="size-3.5" />
                    </Button>
                    <Link
                      to={`/properties/${property._id}/edit`}
                      className={buttonVariants('ghost') + ' h-7 px-2 text-xs'}
                      title="Modifier cette propriété"
                    >
                      <Edit className="size-3.5" />
                    </Link>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingProperty(property)}
                      className="h-7 px-2 text-xs text-rose-500 hover:text-rose-400"
                      title="Supprimer la propriété"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Délégation */}
      {delegatingProperty && (
        <PropertyDelegationModal
          propertyName={delegatingProperty.name}
          propertyId={delegatingProperty._id}
          initial={delegatingProperty.delegation}
          isSubmitting={delegationMutation.isPending}
          onClose={() => setDelegatingProperty(null)}
          onSave={(delegation) => delegationMutation.mutate({ id: delegatingProperty._id, delegation })}
        />
      )}

      {/* Modal Confirmation de Suppression */}
      {deletingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-foreground border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-red-600">Supprimer cette propriété ?</h3>
            <p className="text-xs text-muted-foreground">
              Cette action retirera <strong>{deletingProperty.name}</strong> de votre patrimoine immobilier.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingProperty(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingProperty._id)}
              >
                {deleteMutation.isPending ? 'Suppression…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PropertyFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const [localInitial, setLocalInitial] = useState<Property | undefined>(() => {
    if (mode === 'edit' && id) {
      const list = getLocalProperties();
      return list.find((p) => p._id === id);
    }
    return undefined;
  });

  const existing = useOrgQuery<Property>(['property', id], `/properties/${id}`, mode === 'edit' && Boolean(id));

  const effectiveInitial = existing.data || localInitial;

  const mutation = useMutation({
    mutationFn: async (input: PropertyInput & { customPropertyType?: string }) => {
      let createdProp: Property | null = null;
      try {
        const res = await apiRequest<Property>(
          mode === 'create' ? `${base}/properties` : `${base}/properties/${id}`,
          {
            method: mode === 'create' ? 'POST' : 'PATCH',
            body: input,
          }
        );
        createdProp = res;
      } catch (networkError) {
        // En cas de panne d'API ou d'absence de backend connecté,
        // on sauvegarde de manière 100% autonome dans le stockage local !
      }

      // Sauvegarde et mise à jour locale
      const list = getLocalProperties();
      const propId = createdProp?._id || id || `prop_${Date.now()}`;
      const savedProperty: Property = {
        _id: propId,
        name: input.name,
        type: input.type,
        customPropertyType: input.customPropertyType,
        address: input.address,
        city: input.city,
        country: input.country,
        zone: input.zone,
        status: input.status,
        description: input.description,
        chambreSimpleCount: input.chambreSimpleCount || 0,
        chambreModerneCount: input.chambreModerneCount || 0,
        studioSimpleCount: input.studioSimpleCount || 0,
        studioModerneCount: input.studioModerneCount || 0,
        appartementCount: input.appartementCount || 0,
        otherCustomType: input.otherCustomType,
        otherCustomCount: input.otherCustomCount || 0,
        roomsCount: (input.chambreSimpleCount || 0) + (input.chambreModerneCount || 0),
        studiosCount: (input.studioSimpleCount || 0) + (input.studioModerneCount || 0),
        apartmentsCount: input.appartementCount || 0,
        otherUnitsCount: input.otherCustomCount || 0,
      };

      const existingIndex = list.findIndex((p) => p._id === propId);
      if (existingIndex >= 0) {
        list[existingIndex] = savedProperty;
      } else {
        list.unshift(savedProperty);
      }
      saveLocalProperties(list);

      // Génération automatique des unités pour la composition si nouvelle création
      if (mode === 'create') {
        const currentUnits = getLocalUnits();
        const newUnits: Unit[] = [];

        // Chambres simples
        for (let i = 1; i <= (input.chambreSimpleCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_cs_${i}`,
            propertyId: propId,
            name: `Chambre Simple N°${i}`,
            number: `CS-${i}`,
            floor: 0,
            type: 'ROOM',
            status: 'AVAILABLE',
            rentAmountMinor: 40000,
          });
        }
        // Chambres modernes
        for (let i = 1; i <= (input.chambreModerneCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_cm_${i}`,
            propertyId: propId,
            name: `Chambre Moderne N°${i}`,
            number: `CM-${i}`,
            floor: 0,
            type: 'ROOM_MODERN',
            status: 'AVAILABLE',
            rentAmountMinor: 65000,
          });
        }
        // Studios simples
        for (let i = 1; i <= (input.studioSimpleCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_ss_${i}`,
            propertyId: propId,
            name: `Studio Simple N°${i}`,
            number: `SS-${i}`,
            floor: 0,
            type: 'STUDIO',
            status: 'AVAILABLE',
            rentAmountMinor: 80000,
          });
        }
        // Studios modernes
        for (let i = 1; i <= (input.studioModerneCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_sm_${i}`,
            propertyId: propId,
            name: `Studio Moderne N°${i}`,
            number: `SM-${i}`,
            floor: 1,
            type: 'STUDIO_MODERN',
            status: 'AVAILABLE',
            rentAmountMinor: 120000,
          });
        }
        // Appartements
        for (let i = 1; i <= (input.appartementCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_app_${i}`,
            propertyId: propId,
            name: `Appartement N°${i}`,
            number: `A-${i}`,
            floor: 1,
            type: 'APARTMENT',
            status: 'AVAILABLE',
            rentAmountMinor: 200000,
          });
        }
        // Autres types
        for (let i = 1; i <= (input.otherCustomCount || 0); i++) {
          newUnits.push({
            _id: `unit_${propId}_oth_${i}`,
            propertyId: propId,
            name: `${input.otherCustomType || 'Lot'} N°${i}`,
            number: `X-${i}`,
            floor: 0,
            type: 'OTHER',
            status: 'AVAILABLE',
            rentAmountMinor: 150000,
          });
        }

        saveLocalUnits([...newUnits, ...currentUnits]);

        // Tenter de créer les unités sur l'API en arrière-plan sans bloquer
        for (const u of newUnits) {
          apiRequest(`${base}/units`, { method: 'POST', body: u }).catch(() => {});
        }
      }

      return savedProperty;
    },
    onSuccess: (saved) => {
      void client.invalidateQueries();
      toast({
        title: mode === 'create' ? 'Propriété enregistrée avec succès !' : 'Propriété mise à jour',
        description: `${saved.name} fait maintenant partie de votre gestion des propriétés.`,
        variant: 'success',
      });
      navigate('/properties');
    },
    onError: (error: Error) => {
      toast({ title: 'Notification', description: error.message, variant: 'error' });
    },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={mode === 'create' ? 'Enregistrer une nouvelle propriété' : 'Modifier la propriété'}
        description="Renseignez la localisation, la zone géographique, le type de propriété et la composition détaillée en logements (chambres simples, modernes, studios, appartements, etc.)."
      />
      <PropertyForm
        initial={effectiveInitial}
        submitting={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </div>
  );
}

function PropertyForm({
  initial,
  submitting,
  onSubmit,
}: {
  initial?: Property | undefined;
  submitting: boolean;
  onSubmit: (values: PropertyInput & { customPropertyType?: string }) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedType, setSelectedType] = useState<string>(initial?.type ?? 'BUILDING');
  const [isCustomType, setIsCustomType] = useState<boolean>(Boolean(initial?.customPropertyType));
  const [customTypeInput, setCustomTypeInput] = useState<string>(initial?.customPropertyType ?? '');

  const [chambreSimple, setChambreSimple] = useState<number>(initial?.chambreSimpleCount ?? 0);
  const [chambreModerne, setChambreModerne] = useState<number>(initial?.chambreModerneCount ?? 0);
  const [studioSimple, setStudioSimple] = useState<number>(initial?.studioSimpleCount ?? 0);
  const [studioModerne, setStudioModerne] = useState<number>(initial?.studioModerneCount ?? 0);
  const [appartement, setAppartement] = useState<number>(initial?.appartementCount ?? 0);
  const [otherName, setOtherName] = useState<string>(initial?.otherCustomType ?? '');
  const [otherCount, setOtherCount] = useState<number>(initial?.otherCustomCount ?? 0);

  const totalCalculated =
    Number(chambreSimple || 0) +
    Number(chambreModerne || 0) +
    Number(studioSimple || 0) +
    Number(studioModerne || 0) +
    Number(appartement || 0) +
    Number(otherCount || 0);

  const handleSubmit = (formData: FormData) => {
    const rawName = String(formData.get('name') || '').trim();
    const rawAddress = String(formData.get('address') || '').trim();
    const rawCity = String(formData.get('city') || 'Abidjan').trim();
    const rawCountry = String(formData.get('country') || 'CI').trim().toUpperCase().slice(0, 2);
    const rawZone = String(formData.get('zone') || '').trim();
    const rawDesc = String(formData.get('description') || '').trim();
    const rawStatus = (formData.get('status') as 'ACTIVE' | 'DRAFT' | 'ARCHIVED') || 'ACTIVE';

    if (!rawName) {
      setErrors({ name: 'Le nom de la propriété est obligatoire' });
      return;
    }
    if (!rawAddress) {
      setErrors({ address: 'L’adresse géographique est obligatoire' });
      return;
    }

    setErrors({});

    const submissionData = {
      name: rawName,
      type: isCustomType ? 'OTHER' : selectedType,
      customPropertyType: isCustomType ? customTypeInput.trim() : undefined,
      zone: rawZone || undefined,
      address: rawAddress,
      city: rawCity,
      country: rawCountry,
      chambreSimpleCount: Number(chambreSimple) || 0,
      chambreModerneCount: Number(chambreModerne) || 0,
      studioSimpleCount: Number(studioSimple) || 0,
      studioModerneCount: Number(studioModerne) || 0,
      appartementCount: Number(appartement) || 0,
      otherCustomType: otherName.trim() || undefined,
      otherCustomCount: Number(otherCount) || 0,
      roomsCount: Number(chambreSimple || 0) + Number(chambreModerne || 0),
      studiosCount: Number(studioSimple || 0) + Number(studioModerne || 0),
      apartmentsCount: Number(appartement || 0),
      otherUnitsCount: Number(otherCount || 0),
      description: rawDesc || undefined,
      status: rawStatus,
    };

    onSubmit(submissionData as PropertyInput & { customPropertyType?: string });
  };

  return (
    <form
      className="space-y-6 bg-card p-6 sm:p-7 rounded-3xl border border-border shadow-sm text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
    >
      {/* IDENTIFICATION DE LA PROPRIÉTÉ */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground border-b border-border pb-2 flex items-center gap-2">
          <Building2 className="size-4 text-primary" />
          Informations Générales
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            name="name"
            label="Nom de la propriété *"
            defaultValue={initial?.name}
            error={errors.name}
            placeholder="Ex: Résidence Katd Les Palmiers"
          />

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Type de propriété</span>
            <select
              value={isCustomType ? 'CUSTOM' : selectedType}
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustomType(true);
                } else {
                  setIsCustomType(false);
                  setSelectedType(e.target.value);
                }
              }}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="BUILDING">Immeuble de rapport</option>
              <option value="VILLA">Villa / Résidence</option>
              <option value="HOUSE">Maison d’habitation</option>
              <option value="APARTMENT">Complexe d’appartements</option>
              <option value="COUR_COMMUNE">Cour commune</option>
              <option value="COMMERCIAL">Bâtiment commercial</option>
              <option value="CUSTOM">+ Créer un type personnalisé…</option>
            </select>
          </label>
        </div>

        {/* Champ conditionnel pour type personnalisé */}
        {isCustomType && (
          <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 animate-in fade-in space-y-1.5">
            <span className="text-xs font-bold text-emerald-400 block flex items-center gap-1">
              <Sparkles className="size-3.5" /> Définissez votre type de propriété personnalisé
            </span>
            <Input
              value={customTypeInput}
              onChange={(e) => setCustomTypeInput(e.target.value)}
              placeholder="Ex: Cité Universitaire, Cité Dortoir, Résidence Hôtelière, Entrepôt…"
              className="bg-background text-sm"
              required
            />
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            name="zone"
            label="Zone / Quartier géographique *"
            defaultValue={initial?.zone}
            error={errors.zone}
            placeholder="Ex: Cocody Angré 8ème Tranche, Marcory Zone 4, Riviera…"
          />
          <Field
            name="address"
            label="Adresse précise *"
            defaultValue={initial?.address}
            error={errors.address}
            placeholder="Ex: Rue L82, Lot 145"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            name="city"
            label="Ville *"
            defaultValue={initial?.city ?? 'Abidjan'}
            error={errors.city}
            placeholder="Abidjan, Yamoussoukro, Bouaké…"
          />
          <Field
            name="country"
            label="Pays (Code ISO) *"
            defaultValue={initial?.country ?? 'CI'}
            error={errors.country}
            placeholder="CI, SN, BF, CM…"
          />
        </div>
      </div>

      {/* COMPOSITION DE LA PROPRIÉTÉ */}
      <div className="p-5 rounded-3xl bg-muted/30 border border-border space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-2.5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Layers className="size-4 text-emerald-500" />
              Composition de la propriété
            </span>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Indiquez les quantités de chaque type de logement composant votre propriété.
            </p>
          </div>
          <Badge className="bg-emerald-500 text-slate-950 font-black text-xs">
            {totalCalculated} logement{totalCalculated > 1 ? 's' : ''} au total
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Chambre simple */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Chambre simple</span>
            <Input
              type="number"
              min="0"
              value={chambreSimple}
              onChange={(e) => setChambreSimple(Number(e.target.value) || 0)}
              placeholder="0"
              className="text-sm font-semibold"
            />
            <span className="text-[10px] text-muted-foreground">Chambre standard / sanitaires partagés</span>
          </div>

          {/* Chambre moderne */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Chambre moderne</span>
            <Input
              type="number"
              min="0"
              value={chambreModerne}
              onChange={(e) => setChambreModerne(Number(e.target.value) || 0)}
              placeholder="0"
              className="text-sm font-semibold"
            />
            <span className="text-[10px] text-muted-foreground">Chambre avec salle d’eau autonome</span>
          </div>

          {/* Studio simple */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Studio simple</span>
            <Input
              type="number"
              min="0"
              value={studioSimple}
              onChange={(e) => setStudioSimple(Number(e.target.value) || 0)}
              placeholder="0"
              className="text-sm font-semibold"
            />
            <span className="text-[10px] text-muted-foreground">Pièce unique avec coin cuisine</span>
          </div>

          {/* Studio moderne */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Studio moderne</span>
            <Input
              type="number"
              min="0"
              value={studioModerne}
              onChange={(e) => setStudioModerne(Number(e.target.value) || 0)}
              placeholder="0"
              className="text-sm font-semibold"
            />
            <span className="text-[10px] text-muted-foreground">Studio haut standing avec balcon</span>
          </div>

          {/* Appartement */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Appartement (2, 3, 4+ pièces)</span>
            <Input
              type="number"
              min="0"
              value={appartement}
              onChange={(e) => setAppartement(Number(e.target.value) || 0)}
              placeholder="0"
              className="text-sm font-semibold"
            />
            <span className="text-[10px] text-muted-foreground">Logement familial complet</span>
          </div>

          {/* Autre type personnalisé */}
          <div className="p-3 rounded-2xl bg-card border border-border space-y-1.5">
            <span className="text-xs font-bold text-foreground block">Autre (Personnalisé)</span>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                type="text"
                value={otherName}
                onChange={(e) => setOtherName(e.target.value)}
                placeholder="Ex: Duplex, Boutique…"
                className="text-xs"
              />
              <Input
                type="number"
                min="0"
                value={otherCount}
                onChange={(e) => setOtherCount(Number(e.target.value) || 0)}
                placeholder="Qté"
                className="text-xs font-semibold"
              />
            </div>
            <span className="text-[10px] text-muted-foreground">Nom et quantité personnalisés</span>
          </div>
        </div>
      </div>

      {/* DESCRIPTION & STATUT */}
      <div className="space-y-4">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Description & Commodités</span>
          <textarea
            name="description"
            defaultValue={initial?.description}
            rows={3}
            placeholder="Détails de la propriété, commodités (forage, groupe électrogène, parking, gardiennage 24/7)..."
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Statut d’exploitation</span>
          <select
            name="status"
            defaultValue={initial?.status ?? 'ACTIVE'}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            <option value="ACTIVE">Active (En exploitation locative)</option>
            <option value="DRAFT">Brouillon</option>
            <option value="ARCHIVED">Archivée</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-3 border-t border-border">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-7"
        >
          {submitting ? 'Enregistrement en cours…' : 'Enregistrer la propriété'}
        </Button>
        <Link to="/properties" className={buttonVariants('outline')}>
          Annuler
        </Link>
      </div>
    </form>
  );
}

export function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const [addUnitOpen, setAddUnitOpen] = useState(false);
  const [delegationOpen, setDelegationOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Recherche sur API avec fallback local
  const propertyQuery = useOrgQuery<Property>(['property', id], `/properties/${id}`);
  const statsQuery = useOrgQuery<PropertyStats>(['property-stats', id], `/properties/${id}/stats`);
  const unitsQuery = useOrgList<Unit>(['units', id], `/units?propertyId=${id}&pageSize=100`);

  const localProps = getLocalProperties();
  const localUnits = getLocalUnits();

  const p: Property | undefined = propertyQuery.data || localProps.find((item) => item._id === id);

  const mergedUnits = useMemo<Unit[]>(() => {
    const apiUnits = unitsQuery.data?.data ?? [];
    const localMatches = localUnits.filter((u) => u.propertyId === id);
    const map = new Map<string, Unit>();
    for (const u of apiUnits) map.set(u._id, u);
    for (const u of localMatches) map.set(u._id, u);
    return Array.from(map.values());
  }, [unitsQuery.data?.data, localUnits, id]);

  const remove = useMutation({
    mutationFn: async () => {
      try {
        await apiRequest(`${base}/properties/${id}`, { method: 'DELETE' });
      } catch {}
      const updated = localProps.filter((item) => item._id !== id);
      saveLocalProperties(updated);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Propriété supprimée', variant: 'success' });
      navigate('/properties');
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: async (unitData: Record<string, unknown>) => {
      try {
        await apiRequest(`${base}/units`, { method: 'POST', body: unitData });
      } catch {}
      const newUnit: Unit = {
        _id: `unit_${id}_${Date.now()}`,
        propertyId: String(id),
        name: String(unitData.name || 'Nouveau logement'),
        number: String(unitData.number || ''),
        floor: Number(unitData.floor) || 0,
        type: String(unitData.type || 'ROOM'),
        status: String(unitData.status || 'AVAILABLE'),
        rentAmountMinor: Number(unitData.rentAmountMinor) || 50000,
      };
      saveLocalUnits([newUnit, ...localUnits]);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setAddUnitOpen(false);
      toast({
        title: 'Logement créé avec succès',
        description: 'Le logement a été ajouté à la propriété.',
        variant: 'success',
      });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const delegationMutation = useMutation({
    mutationFn: async (delegation: DelegationData) => {
      try {
        await apiRequest(`${base}/properties/${id}`, {
          method: 'PATCH',
          body: { delegation },
        });
      } catch {}
      const updated = localProps.map((item) => (item._id === id ? { ...item, delegation } : item));
      saveLocalProperties(updated);
    },
    onSuccess: () => {
      void client.invalidateQueries();
      setDelegationOpen(false);
      toast({ title: 'Délégation enregistrée', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  if (propertyQuery.isLoading && !p) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!p) {
    return (
      <EmptyState
        title="Propriété introuvable"
        description="Cette propriété n’existe pas ou a été supprimée."
      />
    );
  }

  const totalDeclared =
    (p.chambreSimpleCount ?? p.roomsCount ?? 0) +
    (p.chambreModerneCount ?? 0) +
    (p.studioSimpleCount ?? p.studiosCount ?? 0) +
    (p.studioModerneCount ?? 0) +
    (p.appartementCount ?? p.apartmentsCount ?? 0) +
    (p.otherCustomCount ?? p.otherUnitsCount ?? 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`Zone : ${p.zone || p.city} · ${p.address}`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDelegatingProperty(p)}
              className="text-xs text-amber-500 border-amber-500/30"
            >
              <Briefcase className="size-4 mr-1.5" />
              Déléguer la gestion
            </Button>
            <Link to={`/properties/${id}/edit`} className={buttonVariants('secondary')}>
              Modifier
            </Link>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Supprimer
            </Button>
          </div>
        }
      />

      {/* Bandeau d'information & Délégation */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Zone & Localisation</span>
          <p className="font-bold text-sm text-foreground">{p.zone || p.city}</p>
          <p className="text-xs text-muted-foreground">
            {p.address}, {p.city} ({p.country})
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Composition déclarée</span>
          <p className="font-bold text-sm text-foreground">{totalDeclared} logement(s) déclarés</p>
          <p className="text-xs text-muted-foreground">
            {p.chambreSimpleCount ?? p.roomsCount ?? 0} ch. simples · {p.chambreModerneCount ?? 0} ch. mod. ·{' '}
            {p.studioSimpleCount ?? p.studiosCount ?? 0} st. simples · {p.studioModerneCount ?? 0} st. mod. ·{' '}
            {p.appartementCount ?? p.apartmentsCount ?? 0} appts
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Gestionnaire / Mandat</span>
          {p.delegation?.managerName ? (
            <div>
              <p className="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <CheckCircle2 className="size-4" />
                {p.delegation.managerName}
              </p>
              <p className="text-xs text-muted-foreground">
                Tél : {p.delegation.managerPhone || 'N/A'} · Com : {p.delegation.commissionRate}%
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Gestion directe par le propriétaire</p>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DoorOpen className="size-5 text-emerald-500" />
            <span>Chambres, Studios & Appartements ({mergedUnits.length})</span>
          </h2>
          <Button
            size="sm"
            onClick={() => setAddUnitOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
          >
            + Ajouter un logement
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {mergedUnits.map((unit) => (
            <Card key={unit._id} className="border-border hover:shadow-sm transition">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{unit.name}</p>
                  <Badge>{STATUS_LABELS[unit.status] ?? unit.status}</Badge>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center justify-between">
                    <span>Type :</span>
                    <strong className="text-foreground">{UNIT_TYPE_LABELS[unit.type] ?? unit.type}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>N° Porte / Chambre :</span>
                    <strong className="text-foreground">{unit.number || 'N/A'}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Loyer mensuel :</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {unit.rentAmountMinor.toLocaleString('fr-FR')} FCFA
                    </strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {mergedUnits.length === 0 ? (
          <EmptyState
            title="Aucun logement configuré"
            description="Ajoutez les chambres, studios ou appartements avec leur numéro de porte."
          />
        ) : null}
      </section>

      {/* Modal Ajouter un Logement */}
      {addUnitOpen && (
        <AddUnitModal
          propertyId={p._id}
          propertyName={p.name}
          isSubmitting={createUnitMutation.isPending}
          onClose={() => setAddUnitOpen(false)}
          onSave={(unitData) => createUnitMutation.mutate(unitData)}
        />
      )}

      {/* Modal Délégation */}
      {delegationOpen && (
        <PropertyDelegationModal
          propertyName={p.name}
          propertyId={p._id}
          initial={p.delegation}
          isSubmitting={delegationMutation.isPending}
          onClose={() => setDelegationOpen(false)}
          onSave={(delegation) => delegationMutation.mutate(delegation)}
        />
      )}

      {/* Modal Confirmation Suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-foreground border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-red-600">Supprimer cette propriété ?</h3>
            <p className="text-xs text-muted-foreground">
              Cette action retirera <strong>{p.name}</strong> de votre gestion des propriétés.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                Annuler
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                {remove.isPending ? 'Suppression…' : 'Confirmer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function UnitsPage() {
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = new URLSearchParams({ page: String(page), pageSize: '50' });
  if (type) query.set('type', type);
  if (status) query.set('status', status);

  const { data, isLoading } = useOrgList<Unit>(['units', type, status, page], `/units?${query.toString()}`);
  const localUnits = getLocalUnits();

  const allUnits = useMemo(() => {
    const apiUnits = data?.data ?? [];
    const map = new Map<string, Unit>();
    for (const u of apiUnits) map.set(u._id, u);
    for (const u of localUnits) map.set(u._id, u);
    return Array.from(map.values());
  }, [data?.data, localUnits]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chambres, Studios & Logements"
        description="Vue globale de tous les lots et chambres configurés dans vos propriétés."
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les types</option>
          {Object.entries(UNIT_TYPE_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && allUnits.length === 0 ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {allUnits.map((unit) => (
          <Card key={unit._id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm">{unit.name}</p>
                <Badge>{STATUS_LABELS[unit.status] ?? unit.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {UNIT_TYPE_LABELS[unit.type] ?? unit.type} · Porte {unit.number || 'N/A'} ·{' '}
                {unit.rentAmountMinor.toLocaleString('fr-FR')} FCFA / mois
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  error,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | undefined;
  error?: string | undefined;
  placeholder?: string | undefined;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} />
      {error ? <p className="text-xs text-red-500 font-medium">{error}</p> : null}
    </label>
  );
}
