import { useState } from 'react';
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

export interface Property {
  _id: string;
  name: string;
  type?: string;
  address: string;
  city: string;
  country: string;
  status: string;
  description?: string;
  zone?: string;
  roomsCount?: number;
  studiosCount?: number;
  apartmentsCount?: number;
  otherUnitsCount?: number;
  delegation?: DelegationData;
}

interface Unit {
  _id: string;
  name: string;
  number?: string;
  floor?: number;
  type: string;
  status: string;
  rentAmountMinor: number;
  surfaceM2?: number;
  bedrooms?: number;
  amenities: string[];
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
  ROOM: 'Chambre',
  STUDIO: 'Studio',
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

export function PropertiesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [delegatingProperty, setDelegatingProperty] = useState<Property | null>(null);
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const query = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (search) query.set('search', search);
  if (status) query.set('status', status);

  const { data, isLoading } = useOrgList<Property>(
    ['properties', search, status, page],
    `/properties?${query.toString()}`
  );
  const properties = data?.data ?? [];

  const delegationMutation = useMutation({
    mutationFn: ({ id, delegation }: { id: string; delegation: DelegationData }) =>
      apiRequest(`${base}/properties/${id}`, {
        method: 'PATCH',
        body: { delegation },
      }),
    onSuccess: () => {
      void client.invalidateQueries();
      setDelegatingProperty(null);
      toast({ title: 'Mandat de gestion enregistré', description: 'La délégation a été validée avec succès.', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries();
      setDeletingProperty(null);
      toast({ title: 'Propriété supprimée', description: 'Le bien a été retiré de votre parc.', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Suppression impossible', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du Parc Immobilier"
        description="Créez, modifiez, supprimez vos propriétés, configurez leur composition (chambres, studios, appartements) et déléguez la gestion de vos patrimoines."
        actions={
          <div className="flex items-center gap-2">
            <a
              className={buttonVariants('secondary')}
              href={`${API_BASE_URL}${base}/properties/export`}
              onClick={(event) => downloadWithAuth(event, `${base}/properties/export`)}
            >
              <Download className="size-4" /> CSV
            </a>
            <Link to="/properties/new" className={buttonVariants('primary')}>
              <Plus className="size-4" /> Nouvelle propriété
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Rechercher par nom ou adresse..."
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
        <div className="ml-auto flex gap-1">
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')} aria-label="Vue liste">
            <List className="size-4" />
          </Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} onClick={() => setView('grid')} aria-label="Vue grille">
            <Grid3x3 className="size-4" />
          </Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {!isLoading && properties.length === 0 ? (
        <EmptyState title="Aucune propriété" description="Créez la première propriété de votre parc immobilier." />
      ) : null}

      <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {properties.map((property) => {
          const totalUnits = (property.roomsCount || 0) + (property.studiosCount || 0) + (property.apartmentsCount || 0) + (property.otherUnitsCount || 0);

          return (
            <Card key={property._id} className="border-border hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-foreground">{property.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span>{property.address}, {property.city}</span>
                    </p>
                    {property.zone && (
                      <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-primary/10 text-primary border border-primary/20">
                        Zone : {property.zone}
                      </span>
                    )}
                  </div>
                  <Badge>{STATUS_LABELS[property.status] ?? property.status}</Badge>
                </div>

                {/* Composition de la propriété */}
                <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-semibold text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5" />
                      Composition du bien :
                    </span>
                    <span className="text-foreground font-bold">{totalUnits > 0 ? `${totalUnits} lot(s)` : 'Non renseigné'}</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {(property.roomsCount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background border border-border font-medium">
                        🛏️ {property.roomsCount} Chambre(s)
                      </span>
                    )}
                    {(property.studiosCount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background border border-border font-medium">
                        🛋️ {property.studiosCount} Studio(s)
                      </span>
                    )}
                    {(property.apartmentsCount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background border border-border font-medium">
                        🏢 {property.apartmentsCount} Appartement(s)
                      </span>
                    )}
                    {(property.otherUnitsCount || 0) > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-background border border-border font-medium">
                        🏪 {property.otherUnitsCount} Autre(s)
                      </span>
                    )}
                  </div>
                </div>

                {/* Mandat de gestion / Délégation */}
                {property.delegation?.managerName ? (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <Briefcase className="size-3.5 shrink-0" />
                      <span className="truncate">
                        <strong>Délégué à :</strong> {property.delegation.managerName}
                      </span>
                    </div>
                    <span className="font-bold text-[10px] bg-amber-500/20 px-1.5 py-0.5 rounded">
                      {property.delegation.commissionRate}%
                    </span>
                  </div>
                ) : null}

                {/* Actions sur la propriété */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-1">
                  <Link
                    to={`/properties/${property._id}`}
                    className="flex-1 text-center py-1.5 px-2 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/20 text-xs font-bold transition"
                  >
                    Voir & Logements
                  </Link>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
                    title="Déléguer la gestion"
                    onClick={(e) => {
                      e.preventDefault();
                      setDelegatingProperty(property);
                    }}
                  >
                    <Briefcase className="size-3.5 mr-1" />
                    Déléguer
                  </Button>

                  <Link
                    to={`/properties/${property._id}/edit`}
                    className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="Modifier la propriété"
                  >
                    <Edit className="size-3.5" />
                  </Link>

                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      setDeletingProperty(property);
                    }}
                    className="p-1.5 rounded-lg border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10"
                    title="Supprimer la propriété"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Pager page={page} hasNext={data?.meta?.hasNextPage ?? false} total={data?.meta?.total ?? 0} onChange={setPage} />

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

      {/* Modal Confirmation Suppression */}
      {deletingProperty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-foreground border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-red-600">Confirmer la suppression</h3>
            <p className="text-xs text-muted-foreground">
              Êtes-vous sûr de vouloir supprimer la propriété <strong>{deletingProperty.name}</strong> ? Tous les logements associés seront archivés.
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
                {deleteMutation.isPending ? 'Suppression…' : 'Confirmer la suppression'}
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
  const existing = useOrgQuery<Property>(['property', id], `/properties/${id}`, mode === 'edit' && Boolean(id));

  const mutation = useMutation({
    mutationFn: (input: PropertyInput) =>
      apiRequest(mode === 'create' ? `${base}/properties` : `${base}/properties/${id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        body: input,
      }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: mode === 'create' ? 'Propriété créée avec succès' : 'Propriété mise à jour', variant: 'success' });
      navigate('/properties');
    },
    onError: (error: Error) => toast({ title: 'Enregistrement impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title={mode === 'create' ? 'Enregistrer une nouvelle propriété' : 'Modifier la propriété'}
        description="Renseignez la localisation, la zone, et la composition détaillée de votre bien (nombre de chambres, studios, appartements)."
      />
      <PropertyForm
        initial={existing.data}
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
  onSubmit: (values: PropertyInput) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (formData: FormData) => {
    const parsed = propertyInputSchema.safeParse({
      name: formData.get('name'),
      type: formData.get('type') || 'BUILDING',
      zone: formData.get('zone') || undefined,
      address: formData.get('address'),
      city: formData.get('city'),
      country: formData.get('country') || 'CI',
      roomsCount: Number(formData.get('roomsCount')) || 0,
      studiosCount: Number(formData.get('studiosCount')) || 0,
      apartmentsCount: Number(formData.get('apartmentsCount')) || 0,
      otherUnitsCount: Number(formData.get('otherUnitsCount')) || 0,
      description: formData.get('description') || undefined,
      status: formData.get('status') || 'ACTIVE',
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <form
      className="space-y-5 bg-card p-6 sm:p-7 rounded-3xl border border-border shadow-sm text-foreground"
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="name" label="Nom de la propriété *" defaultValue={initial?.name} error={errors.name} placeholder="Ex: Résidence Katd Les Palmiers" />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Type de propriété</span>
          <select name="type" defaultValue={initial?.type ?? 'BUILDING'} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
            <option value="BUILDING">Immeuble à appartements</option>
            <option value="VILLA">Villa / Résidence</option>
            <option value="HOUSE">Maison</option>
            <option value="APARTMENT">Appartement seul</option>
            <option value="STUDIO">Studio indépendant</option>
            <option value="COMMERCIAL">Local commercial / Bureaux</option>
            <option value="OTHER">Autre</option>
          </select>
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field
          name="zone"
          label="Zone / Quartier *"
          defaultValue={initial?.zone}
          error={errors.zone}
          placeholder="Ex: Cocody Palmeraie, Marcory Zone 4, Riviera..."
        />
        <Field name="address" label="Adresse géographique *" defaultValue={initial?.address} error={errors.address} placeholder="Ex: Rue des Jardins, Lot 402" />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field name="city" label="Ville *" defaultValue={initial?.city ?? 'Abidjan'} error={errors.city} placeholder="Abidjan, Yamoussoukro, Dakar..." />
        <Field name="country" label="Pays (Code ISO à 2 lettres) *" defaultValue={initial?.country ?? 'CI'} error={errors.country} placeholder="CI, SN, BF..." />
      </div>

      {/* Composition détaillée du bien */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
          Composition de la propriété (Nombre de logements)
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground font-semibold">Chambres</span>
            <Input type="number" min="0" name="roomsCount" defaultValue={initial?.roomsCount ?? 0} />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground font-semibold">Studios</span>
            <Input type="number" min="0" name="studiosCount" defaultValue={initial?.studiosCount ?? 0} />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground font-semibold">Appartements</span>
            <Input type="number" min="0" name="apartmentsCount" defaultValue={initial?.apartmentsCount ?? 0} />
          </label>
          <label className="block space-y-1 text-xs">
            <span className="text-muted-foreground font-semibold">Autres (Boutiques, etc.)</span>
            <Input type="number" min="0" name="otherUnitsCount" defaultValue={initial?.otherUnitsCount ?? 0} />
          </label>
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Description & Commodités</span>
        <textarea
          name="description"
          defaultValue={initial?.description}
          rows={3}
          placeholder="Détails, commodités (parking, gardiennage, forage, groupe électrogène)..."
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Statut</span>
        <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
          <option value="ACTIVE">Active (En exploitation)</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ARCHIVED">Archivée</option>
        </select>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6">
          {submitting ? 'Enregistrement…' : 'Enregistrer la propriété'}
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

  const property = useOrgQuery<Property>(['property', id], `/properties/${id}`);
  const stats = useOrgQuery<PropertyStats>(['property-stats', id], `/properties/${id}/stats`);
  const units = useOrgList<Unit>(['units', id], `/units?propertyId=${id}&pageSize=100`);

  const remove = useMutation({
    mutationFn: () => apiRequest(`${base}/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Propriété supprimée', variant: 'success' });
      navigate('/properties');
    },
  });

  const createUnitMutation = useMutation({
    mutationFn: (unitData: Record<string, unknown>) =>
      apiRequest(`${base}/units`, { method: 'POST', body: unitData }),
    onSuccess: () => {
      void client.invalidateQueries();
      setAddUnitOpen(false);
      toast({ title: 'Logement créé', description: 'Le logement a été ajouté à la propriété.', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const delegationMutation = useMutation({
    mutationFn: (delegation: DelegationData) =>
      apiRequest(`${base}/properties/${id}`, {
        method: 'PATCH',
        body: { delegation },
      }),
    onSuccess: () => {
      void client.invalidateQueries();
      setDelegationOpen(false);
      toast({ title: 'Délégation enregistrée', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  if (property.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!property.data) return <EmptyState title="Propriété introuvable" description="Elle n’existe pas ou n’appartient pas à cette organisation." />;

  const p = property.data;
  const totalUnits = (p.roomsCount || 0) + (p.studiosCount || 0) + (p.apartmentsCount || 0) + (p.otherUnitsCount || 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`${p.address}, ${p.city} ${p.zone ? `(Zone : ${p.zone})` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setDelegationOpen(true)}
              className="text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            >
              <Briefcase className="size-4 mr-1.5" />
              {p.delegation?.managerName ? 'Modifier la délégation' : 'Déléguer la gestion'}
            </Button>
            <Button onClick={() => setAddUnitOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
              <Plus className="size-4 mr-1.5" /> Ajouter un logement
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
          <p className="text-xs text-muted-foreground">{p.address}, {p.city} ({p.country})</p>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase">Composition du bien</span>
          <p className="font-bold text-sm text-foreground">{totalUnits} logement(s) déclarés</p>
          <p className="text-xs text-muted-foreground">
            {p.roomsCount || 0} ch. · {p.studiosCount || 0} studios · {p.apartmentsCount || 0} appts
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

      {stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Logements" value={String(stats.data.units)} hint={`${stats.data.available} disponibles`} icon={Home} />
          <StatCard label="Occupés" value={String(stats.data.occupied)} hint={`${stats.data.occupancyRate} % d’occupation`} icon={Building2} />
          <StatCard label="Encaissé" value={stats.data.collectedMinor.toLocaleString('fr-FR')} hint="Montant cumulé" icon={Download} />
          <StatCard label="Impayés" value={stats.data.overdueMinor.toLocaleString('fr-FR')} hint={`${stats.data.openMaintenance} tickets ouverts`} icon={List} />
        </div>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <DoorOpen className="size-5 text-emerald-500" />
            <span>Chambres, Studios & Appartements ({units.data?.data?.length ?? 0})</span>
          </h2>
          <Button size="sm" onClick={() => setAddUnitOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">
            + Ajouter un logement
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(units.data?.data ?? []).map((unit) => (
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
                    <strong className="text-emerald-600 dark:text-emerald-400">{unit.rentAmountMinor.toLocaleString('fr-FR')} FCFA</strong>
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        {(units.data?.data ?? []).length === 0 ? (
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
              Cette action retirera <strong>{p.name}</strong> de votre parc immobilier actif.
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
  const query = new URLSearchParams({ pageSize: '50' });
  if (type) query.set('type', type);
  if (status) query.set('status', status);
  const { data, isLoading } = useOrgList<Unit>(['units', type, status], `/units?${query.toString()}`);

  return (
    <div className="space-y-6">
      <PageHeader title="Logements" description="Toutes les unités du parc, tous bâtiments confondus." />
      <div className="flex gap-2">
        <select value={type} onChange={(event) => setType(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Tous les types</option>
          {Object.entries(UNIT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS_LABELS).slice(0, 5).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>{['Nom', 'Type', 'Statut', 'Loyer'].map((heading) => <th key={heading} className="px-4 py-3 font-medium">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((unit) => (
              <tr key={unit._id} className="border-t border-border">
                <td className="px-4 py-3">{unit.name}</td>
                <td className="px-4 py-3">{UNIT_TYPE_LABELS[unit.type] ?? unit.type}</td>
                <td className="px-4 py-3"><Badge>{STATUS_LABELS[unit.status] ?? unit.status}</Badge></td>
                <td className="px-4 py-3">{unit.rentAmountMinor.toLocaleString('fr-FR')} FCFA</td>
              </tr>
            ))}
          </tbody>
        </table>
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
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <Input name={name} defaultValue={defaultValue} placeholder={placeholder} aria-invalid={Boolean(error)} />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function Pager({ page, hasNext, total, onChange }: { page: number; hasNext: boolean; total: number; onChange: (page: number) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{total} résultat{total > 1 ? 's' : ''}</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page === 1} onClick={() => onChange(page - 1)}>Précédent</Button>
        <Button variant="secondary" disabled={!hasNext} onClick={() => onChange(page + 1)}>Suivant</Button>
      </div>
    </div>
  );
}

async function downloadWithAuth(event: { preventDefault: () => void }, path: string): Promise<void> {
  event.preventDefault();
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` } });
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'export';
  link.click();
  URL.revokeObjectURL(url);
}
