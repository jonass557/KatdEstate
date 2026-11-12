import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building, Map, Sparkles, UserCheck } from 'lucide-react';
import { AdminGoogleMapsSettingsCard } from '../../components/geo/AdminGoogleMapsSettingsCard';
import { Button } from '../../components/ui/button';
import { Card, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { apiRequest } from '../../lib/api-client';
import { useOrgPath, useOrgQuery } from '../../lib/query';

export function AdminQuartierPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'territory' | 'assignments' | 'plans' | 'stats' | 'api'>('territory');

  // Queries
  const { data: stats } = useOrgQuery<any>(
    ['admin-quartier-stats'],
    '/quartier/dashboard/super-admin',
  );

  const { data: cities } = useQuery<any[]>({
    queryKey: ['quartier-cities'],
    queryFn: () => apiRequest('/quartier/cities'),
  });

  const [selectedCityId, setSelectedCityId] = useState('');
  const { data: neighborhoods } = useQuery<any[]>({
    queryKey: ['quartier-neighborhoods', selectedCityId],
    queryFn: () => apiRequest(`/quartier/neighborhoods?cityId=${selectedCityId}`),
    enabled: Boolean(selectedCityId),
  });

  const { data: assignments } = useOrgQuery<any[]>(
    ['quartier-assignments'],
    '/quartier/sectors/assignments',
  );

  // Mutations
  const createCityMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/cities`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Ville ajoutée avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['quartier-cities'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const createNeighborhoodMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/quartier/neighborhoods`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Quartier créé', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['quartier-neighborhoods'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const createBlockMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/blocks`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Bloc créé avec token de QR code généré !', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-quartier-stats'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const assignLeaderMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/quartier/sectors/assign`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Responsabilité de secteur attribuée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['quartier-assignments'] });
      void client.invalidateQueries({ queryKey: ['admin-quartier-stats'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Administration KatdEstate Quartier & Chefferie
          </h1>
          <p className="text-xs text-muted-foreground">
            Découpage territorial, nomination des chefs de secteur, abonnements et supervision
            nationale.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setTab('territory')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'territory'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" /> Territoires & Villes
        </button>
        <button
          type="button"
          onClick={() => setTab('assignments')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'assignments'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <UserCheck className="h-4 w-4" /> Chefs & Affectations ({assignments?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('stats')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'stats'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Sparkles className="h-4 w-4" /> Statistiques Générales
        </button>
        <button
          type="button"
          onClick={() => setTab('api')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'api'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Map className="h-4 w-4" /> API Google Maps
        </button>
      </div>

      {/* TAB 1: TERRITOIRES */}
      {tab === 'territory' && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Add City */}
          <Card className="p-4 space-y-3 text-xs">
            <h3 className="font-bold text-sm">Ajouter une Ville</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createCityMutation.mutate({
                  name: form.get('name'),
                  region: form.get('region'),
                  country: form.get('country') || 'SN',
                });
              }}
            >
              <Input name="name" placeholder="Nom de la ville (ex: Dakar, Thiès)" required />
              <Input name="region" placeholder="Région" />
              <Input name="country" placeholder="Pays (SN, CI, CM...)" defaultValue="SN" required />
              <Button type="submit" disabled={createCityMutation.isPending} className="w-full">
                Ajouter la ville
              </Button>
            </form>
          </Card>

          {/* Add Neighborhood */}
          <Card className="p-4 space-y-3 text-xs">
            <h3 className="font-bold text-sm">Ajouter un Quartier</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createNeighborhoodMutation.mutate({
                  cityId: selectedCityId,
                  name: form.get('name'),
                  code: form.get('code'),
                });
              }}
            >
              <select
                className="w-full rounded border border-input p-2 bg-background"
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                required
              >
                <option value="">Sélectionnez la ville...</option>
                {cities?.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Nom du quartier (ex: Médina, Cocody)" required />
              <Input name="code" placeholder="Code court (ex: MED, ALM)" />
              <Button
                type="submit"
                disabled={createNeighborhoodMutation.isPending || !selectedCityId}
                className="w-full"
              >
                Créer le quartier
              </Button>
            </form>
          </Card>

          {/* Add Block */}
          <Card className="p-4 space-y-3 text-xs">
            <h3 className="font-bold text-sm">Ajouter un Bloc / Carré</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createBlockMutation.mutate({
                  neighborhoodId: form.get('neighborhoodId'),
                  name: form.get('name'),
                  code: form.get('code'),
                });
              }}
            >
              <select
                name="neighborhoodId"
                className="w-full rounded border border-input p-2 bg-background"
                required
              >
                <option value="">Sélectionnez le quartier...</option>
                {neighborhoods?.map((n) => (
                  <option key={n._id} value={n._id}>
                    {n.name}
                  </option>
                ))}
              </select>
              <Input name="name" placeholder="Nom du bloc (ex: Carré 4, Bloc B)" required />
              <Input name="code" placeholder="Code unique (ex: B04)" required />
              <Button type="submit" disabled={createBlockMutation.isPending} className="w-full">
                Créer le bloc & générer QR Code
              </Button>
            </form>
          </Card>
        </div>
      )}

      {/* TAB 2: AFFECTATIONS */}
      {tab === 'assignments' && (
        <div className="space-y-4">
          <Card className="p-4 max-w-xl mx-auto text-xs">
            <h3 className="font-bold text-sm mb-3">Attribuer un secteur à un responsable</h3>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                assignLeaderMutation.mutate({
                  userId: form.get('userId'),
                  role: form.get('role'),
                  cityId: selectedCityId,
                  neighborhoodId: form.get('neighborhoodId'),
                  blockId: form.get('blockId') || undefined,
                  notes: form.get('notes'),
                });
              }}
            >
              <div>
                <label className="font-semibold block mb-1">ID Utilisateur du responsable *</label>
                <Input
                  name="userId"
                  placeholder="Identifiant Mongo du compte utilisateur"
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Rôle attribué *</label>
                  <select
                    name="role"
                    className="w-full rounded border border-input p-2 bg-background"
                  >
                    <option value="BLOCK_LEADER">Chef de Bloc</option>
                    <option value="NEIGHBORHOOD_LEADER">Chef de Quartier</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Quartier *</label>
                  <select
                    name="neighborhoodId"
                    className="w-full rounded border border-input p-2 bg-background"
                    required
                  >
                    <option value="">Sélectionnez...</option>
                    {neighborhoods?.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                type="submit"
                disabled={assignLeaderMutation.isPending}
                className="w-full font-bold"
              >
                Attribuer la responsabilité
              </Button>
            </form>
          </Card>

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Responsable</th>
                  <th className="p-3">Rôle</th>
                  <th className="p-3">Secteur</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {assignments?.map((a) => (
                  <tr key={a._id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      {a.userId?.name}{' '}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {a.userId?.phone}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {a.role === 'BLOCK_LEADER' ? 'Chef de Bloc' : 'Chef de Quartier'}
                      </span>
                    </td>
                    <td className="p-3">
                      {a.neighborhoodId?.name} {a.blockId?.name ? `— ${a.blockId.name}` : ''}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        {a.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(a.startDate).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STATS NATIONALES */}
      {tab === 'stats' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <CardTitle className="text-xs text-muted-foreground">Villes & Blocs</CardTitle>
            <div className="text-2xl font-bold mt-2">
              {stats?.territory?.totalCities || 0} villes / {stats?.territory?.totalBlocks || 0}{' '}
              blocs
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.territory?.totalNeighborhoods || 0} quartiers répertoriés
            </p>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-xs text-muted-foreground">Chefs en exercice</CardTitle>
            <div className="text-2xl font-bold text-primary mt-2">
              {stats?.territory?.totalAssignments || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Responsables nommés</p>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-xs text-muted-foreground">
              Total Résidences Recensées
            </CardTitle>
            <div className="text-2xl font-bold text-emerald-600 mt-2">
              {stats?.census?.totalResidences || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.census?.totalHouseholds || 0} foyers ({stats?.census?.totalResidents || 0}{' '}
              hab.)
            </p>
          </Card>

          <Card className="p-4">
            <CardTitle className="text-xs text-muted-foreground">Incidents & Sécurité</CardTitle>
            <div className="text-2xl font-bold text-red-600 mt-2">
              {stats?.security?.activeIncidents || 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {stats?.security?.totalIncidents || 0} signalements traités
            </p>
          </Card>
        </div>
      )}

      {/* TAB 4: API GOOGLE MAPS */}
      {tab === 'api' && <AdminGoogleMapsSettingsCard endpoint={`${base}/quartier/geo/settings`} />}
    </div>
  );
}
