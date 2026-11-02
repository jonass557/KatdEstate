import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Download, Grid3x3, Home, List, Plus } from 'lucide-react';
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

interface Property {
  _id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  status: string;
  description?: string;
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
  const base = useOrgPath();

  const query = new URLSearchParams({ page: String(page), pageSize: '12' });
  if (search) query.set('search', search);
  if (status) query.set('status', status);

  const { data, isLoading } = useOrgList<Property>(['properties', search, status, page], `/properties?${query.toString()}`);
  const properties = data?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Propriétés"
        description="Parc immobilier de l’organisation."
        actions={
          <>
            <a className={buttonVariants('secondary')} href={`${API_BASE_URL}${base}/properties/export`} onClick={(event) => downloadWithAuth(event, `${base}/properties/export`)}>
              <Download className="size-4" /> CSV
            </a>
            <Link to="/properties/new" className={buttonVariants('primary')}>
              <Plus className="size-4" /> Nouvelle propriété
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => { setSearch(event.target.value); setPage(1); }}
          placeholder="Rechercher par nom"
          className="max-w-xs"
        />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
          <option value="">Tous les statuts</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ARCHIVED">Archivée</option>
        </select>
        <div className="ml-auto flex gap-1">
          <Button variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')} aria-label="Vue liste"><List className="size-4" /></Button>
          <Button variant={view === 'grid' ? 'secondary' : 'ghost'} onClick={() => setView('grid')} aria-label="Vue grille"><Grid3x3 className="size-4" /></Button>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {!isLoading && properties.length === 0 ? (
        <EmptyState title="Aucune propriété" description="Créez la première propriété de votre parc." />
      ) : null}

      <div className={view === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'space-y-3'}>
        {properties.map((property) => (
          <Link key={property._id} to={`/properties/${property._id}`}>
            <Card className="h-full transition hover:border-primary/40">
              <CardContent className="space-y-2 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{property.name}</p>
                    <p className="text-sm text-muted-foreground">{property.address}, {property.city}</p>
                  </div>
                  <Badge>{STATUS_LABELS[property.status] ?? property.status}</Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Pager page={page} hasNext={data?.meta?.hasNextPage ?? false} total={data?.meta?.total ?? 0} onChange={setPage} />
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
      toast({ title: mode === 'create' ? 'Propriété créée' : 'Propriété mise à jour', variant: 'success' });
      navigate('/properties');
    },
    onError: (error: Error) => toast({ title: 'Enregistrement impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={mode === 'create' ? 'Nouvelle propriété' : 'Modifier la propriété'} />
      <PropertyForm
        initial={existing.data}
        submitting={mutation.isPending}
        onSubmit={(values) => mutation.mutate(values)}
      />
    </div>
  );
}

function PropertyForm({ initial, submitting, onSubmit }: { initial?: Property | undefined; submitting: boolean; onSubmit: (values: PropertyInput) => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (formData: FormData) => {
    const parsed = propertyInputSchema.safeParse({
      name: formData.get('name'),
      address: formData.get('address'),
      city: formData.get('city'),
      country: formData.get('country'),
      description: formData.get('description') || undefined,
      status: formData.get('status'),
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
      className="max-w-xl space-y-4"
      onSubmit={(event) => { event.preventDefault(); handleSubmit(new FormData(event.currentTarget)); }}
    >
      <Field name="name" label="Nom" defaultValue={initial?.name} error={errors.name} />
      <Field name="address" label="Adresse" defaultValue={initial?.address} error={errors.address} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="city" label="Ville" defaultValue={initial?.city} error={errors.city} />
        <Field name="country" label="Pays (code ISO)" defaultValue={initial?.country ?? 'SN'} error={errors.country} />
      </div>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Description</span>
        <textarea name="description" defaultValue={initial?.description} rows={3} className="w-full rounded-lg border border-input bg-background px-3 py-2" />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">Statut</span>
        <select name="status" defaultValue={initial?.status ?? 'ACTIVE'} className="h-10 w-full rounded-lg border border-input bg-background px-3">
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Brouillon</option>
          <option value="ARCHIVED">Archivée</option>
        </select>
      </label>
      <Button type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : 'Enregistrer'}</Button>
    </form>
  );
}

export function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const property = useOrgQuery<Property>(['property', id], `/properties/${id}`);
  const stats = useOrgQuery<PropertyStats>(['property-stats', id], `/properties/${id}/stats`);
  const units = useOrgList<Unit>(['units', id], `/units?propertyId=${id}&pageSize=100`);

  const remove = useMutation({
    mutationFn: () => apiRequest(`${base}/properties/${id}`, { method: 'DELETE' }),
    onSuccess: () => { void client.invalidateQueries(); toast({ title: 'Propriété archivée', variant: 'success' }); navigate('/properties'); },
  });

  if (property.isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;
  if (!property.data) return <EmptyState title="Propriété introuvable" description="Elle n’existe pas ou n’appartient pas à cette organisation." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.data.name}
        description={`${property.data.address}, ${property.data.city}`}
        actions={
          <>
            <Link to={`/properties/${id}/edit`} className={buttonVariants('secondary')}>Modifier</Link>
            <Button variant="danger" onClick={() => remove.mutate()}>Supprimer</Button>
          </>
        }
      />

      {stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Logements" value={String(stats.data.units)} hint={`${stats.data.available} disponibles`} icon={Home} />
          <StatCard label="Occupés" value={String(stats.data.occupied)} hint={`${stats.data.occupancyRate} % d’occupation`} icon={Building2} />
          <StatCard label="Encaissé" value={stats.data.collectedMinor.toLocaleString('fr-FR')} hint="Montant cumulé" icon={Download} />
          <StatCard label="Impayés" value={stats.data.overdueMinor.toLocaleString('fr-FR')} hint={`${stats.data.openMaintenance} tickets ouverts`} icon={List} />
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Logements</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(units.data?.data ?? []).map((unit) => (
            <Card key={unit._id}>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{unit.name}</p>
                  <Badge>{STATUS_LABELS[unit.status] ?? unit.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {UNIT_TYPE_LABELS[unit.type] ?? unit.type}
                  {unit.surfaceM2 ? ` · ${unit.surfaceM2} m²` : ''}
                  {unit.bedrooms ? ` · ${unit.bedrooms} ch.` : ''}
                </p>
                <p className="text-sm font-medium">{unit.rentAmountMinor.toLocaleString('fr-FR')} FCFA</p>
              </CardContent>
            </Card>
          ))}
        </div>
        {(units.data?.data ?? []).length === 0 ? <EmptyState title="Aucun logement" description="Ajoutez les logements de cette propriété." /> : null}
      </section>
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
                <td className="px-4 py-3">{unit.rentAmountMinor.toLocaleString('fr-FR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ name, label, defaultValue, error }: { name: string; label: string; defaultValue?: string | undefined; error?: string | undefined }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <Input name={name} defaultValue={defaultValue} aria-invalid={Boolean(error)} />
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

/** Télécharge un export en portant le jeton, puisque un lien simple ne l’envoie pas. */
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
