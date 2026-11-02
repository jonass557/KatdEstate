import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Building,
  Flame,
  Home,
  Send,
  Sparkles,
  Users,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { apiRequest } from '../../lib/api-client';
import { useOrgPath, useOrgQuery } from '../../lib/query';

export function NeighborhoodLeaderDashboard() {
  const base = useOrgPath();
  const { toast } = useToast();
  const [tab, setTab] = useState<'overview' | 'blocks' | 'broadcast' | 'alerts'>('overview');

  const { data: dashboard } = useOrgQuery<any>(
    ['neighborhood-leader-dashboard'],
    '/quartier/dashboard/neighborhood-leader'
  );

  const broadcastMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/quartier/announcements`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Communication diffusée à l’ensemble du quartier', variant: 'success' });
      setTab('overview');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const neighborhood = dashboard?.neighborhood;
  const kpis = dashboard?.kpis;
  const blocks = dashboard?.blocksComparison || [];
  const alerts = dashboard?.recentAlerts || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Chef de Quartier : {neighborhood?.name || 'Mon Quartier'}
            </h1>
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
              Ville : {neighborhood?.cityName || 'Sénégal'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Supervision du recensement, coordination des chefs de bloc et sécurité communautaire.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'overview' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Home className="h-4 w-4" /> Synthèse & Couverture
        </button>
        <button
          type="button"
          onClick={() => setTab('blocks')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'blocks' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" /> Comparatif des Blocs ({blocks.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('broadcast')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'broadcast' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Send className="h-4 w-4" /> Message au Quartier
        </button>
        <button
          type="button"
          onClick={() => setTab('alerts')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'alerts' ? 'bg-primary text-primary-foreground font-semibold shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Flame className="h-4 w-4" /> Alertes Sécurité ({alerts.length})
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Blocs du Quartier</CardTitle>
                <Building className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalBlocks || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis?.activeLeadersCount || 0} chefs de bloc actifs</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Résidences Recensées</CardTitle>
                <Home className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">{kpis?.totalResidences || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis?.totalHouseholds || 0} foyers déclarés</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Population Estimée</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalResidents || 0} hab.</div>
                <p className="text-xs text-muted-foreground mt-1">Données démographiques agrégées</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Couverture Globale</CardTitle>
                <Sparkles className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{kpis?.coverageRate || 0}%</div>
                <p className="text-xs text-muted-foreground mt-1">{kpis?.unstartedBlocksCount || 0} bloc(s) sans recensement</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: COMPARATIF DES BLOCS */}
      {tab === 'blocks' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Avancement du recensement par bloc</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Bloc</th>
                  <th className="p-3">Chef de bloc</th>
                  <th className="p-3">Maisons recensées</th>
                  <th className="p-3">Habitants déclarés</th>
                  <th className="p-3">Taux de couverture</th>
                  <th className="p-3">En attente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {blocks.map((b: any) => (
                  <tr key={b._id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      {b.name} <span className="text-[11px] font-mono text-muted-foreground">({b.code})</span>
                    </td>
                    <td className="p-3">{b.leaderName}</td>
                    <td className="p-3 font-bold text-primary">{b.totalResidences}</td>
                    <td className="p-3">{b.totalResidents} hab.</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, b.coverageRate)}%` }} />
                        </div>
                        <span className="font-bold">{b.coverageRate}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      {b.pendingValidations > 0 ? (
                        <span className="rounded bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                          {b.pendingValidations} en attente
                        </span>
                      ) : (
                        <span className="text-muted-foreground">À jour</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DIFFUSION QUARTIER */}
      {tab === 'broadcast' && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">Diffuser une annonce à l'ensemble du quartier</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                broadcastMutation.mutate({
                  scope: 'NEIGHBORHOOD',
                  type: form.get('type'),
                  title: form.get('title'),
                  message: form.get('message'),
                  neighborhoodId: neighborhood?._id,
                  eventDate: form.get('eventDate') || undefined,
                });
              }}
            >
              <div>
                <label className="font-semibold block mb-1">Type de communication *</label>
                <select name="type" className="w-full rounded-md border border-input bg-background p-2 text-xs" defaultValue="INFO">
                  <option value="INFO">Information générale</option>
                  <option value="MEETING">Assemblée générale de quartier</option>
                  <option value="WORKS">Travaux communaux</option>
                  <option value="URGENT_ALERT">Alerte communautaire d'urgence</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Titre de l'annonce *</label>
                <Input name="title" placeholder="Ex: Campagne de salubrité et sécurisation des axes principaux" required />
              </div>

              <div>
                <label className="font-semibold block mb-1">Message à la population du quartier *</label>
                <textarea
                  name="message"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs"
                  placeholder="Écrivez le communiqué officiel du chef de quartier..."
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Date de l'événement (optionnel)</label>
                <Input name="eventDate" type="datetime-local" />
              </div>

              <Button type="submit" disabled={broadcastMutation.isPending} className="w-full font-bold">
                {broadcastMutation.isPending ? 'Diffusion en cours...' : 'Diffuser à tout le quartier'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: ALERTES SÉCURITÉ */}
      {tab === 'alerts' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Incidents et alertes signalés dans le quartier</h2>
          <div className="space-y-3">
            {alerts.map((al: any) => (
              <Card key={al._id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs border-border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-primary">{al.incidentNumber}</span>
                    <span className="rounded bg-red-600 text-white px-2 py-0.5 text-[10px] font-bold">
                      {al.category}
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {al.status}
                    </span>
                  </div>
                  <p className="text-foreground mt-1 font-medium">{al.description}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Lieu : {al.locationText || 'Quartier'} • Gravité : <strong>{al.severity}</strong>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
