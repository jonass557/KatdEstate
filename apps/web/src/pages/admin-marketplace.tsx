import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ShieldCheck, Sliders, UserCheck } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';

export function AdminMarketplacePage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<'listings' | 'agents' | 'plans'>('listings');
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');

  // Queries
  const { data: listingsData } = useOrgQuery<{ items: any[] }>(
    ['admin-marketplace-listings', statusFilter],
    `/admin/marketplace/listings?status=${statusFilter}`,
  );

  const { data: agents } = useOrgQuery<any[]>(
    ['admin-marketplace-agents'],
    '/admin/marketplace/agents',
  );
  const { data: plans } = useOrgQuery<any[]>(
    ['admin-marketplace-plans'],
    '/admin/marketplace/plans',
  );

  // Listing moderation mutations
  const approveListingMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`${base}/admin/marketplace/listings/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Annonce validée et publiée !', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-listings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const rejectListingMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`${base}/admin/marketplace/listings/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      toast({ title: 'Annonce rejetée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-listings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const toggleVerifiedMutation = useMutation({
    mutationFn: ({ id, isVerified }: { id: string; isVerified: boolean }) =>
      apiRequest(`${base}/admin/marketplace/listings/${id}/verify`, {
        method: 'POST',
        body: { isVerified },
      }),
    onSuccess: () => {
      toast({ title: 'Statut de certification mis à jour', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-listings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Agent verification mutations
  const verifyAgentMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`${base}/admin/marketplace/agents/${id}/verify`, { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Agent vérifié avec succès', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-agents'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const rejectAgentMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiRequest(`${base}/admin/marketplace/agents/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),
    onSuccess: () => {
      toast({ title: 'Vérification refusée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-agents'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Plan update mutation
  const updatePlanMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: unknown }) =>
      apiRequest(`${base}/admin/marketplace/plans/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      toast({ title: 'Formule mise à jour', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['admin-marketplace-plans'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const listings = listingsData?.items || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Modération & Administration Marketplace
          </h1>
          <p className="text-xs text-muted-foreground">
            Validation des annonces, vérification des profils d'agents et configuration centralisée
            des formules d'abonnement.
          </p>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setTab('listings')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'listings'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building2 className="h-4 w-4" /> Modération des annonces
        </button>
        <button
          type="button"
          onClick={() => setTab('agents')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'agents'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <UserCheck className="h-4 w-4" /> Vérification des Agents ({agents?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setTab('plans')}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
            tab === 'plans'
              ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Sliders className="h-4 w-4" /> Grilles tarifaires Agents ({plans?.length || 0})
        </button>
      </div>

      {/* TAB 1: MODÉRATION ANNONCES */}
      {tab === 'listings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {['PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'SUSPENDED'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'PENDING_REVIEW'
                  ? 'En attente'
                  : st === 'PUBLISHED'
                    ? 'Publiées'
                    : st === 'REJECTED'
                      ? 'Rejetées'
                      : 'Suspendues'}
              </button>
            ))}
          </div>

          {listings.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune annonce trouvée pour le filtre "{statusFilter}".
            </Card>
          ) : (
            <div className="space-y-3">
              {listings.map((item) => (
                <Card
                  key={item._id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{item.title}</span>
                      <span className="rounded bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                        {item.transactionType === 'SALE' ? 'Vente' : 'Location'}
                      </span>
                      {item.isVerified && (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-600 font-bold">
                          <ShieldCheck className="h-3 w-3" /> Bien vérifié
                        </span>
                      )}
                      {item.isTitled && (
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-amber-700 font-bold">
                          TF {item.landTitleNumber || ''}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-primary text-sm">
                      {item.priceMinor?.toLocaleString('fr-FR')} {item.currency}
                    </p>
                    <p className="text-muted-foreground line-clamp-2">{item.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Publié par : {item.publisherId?.name} ({item.publisherRole}) • Ville :{' '}
                      {item.location?.city}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.status === 'PENDING_REVIEW' && (
                      <>
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-8"
                          onClick={() => approveListingMutation.mutate(item._id)}
                        >
                          Valider & Publier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-red-600"
                          onClick={() => {
                            const reason = prompt('Motif du rejet (obligatoire) :');
                            if (reason) rejectListingMutation.mutate({ id: item._id, reason });
                          }}
                        >
                          Rejeter
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() =>
                        toggleVerifiedMutation.mutate({
                          id: item._id,
                          isVerified: !item.isVerified,
                        })
                      }
                    >
                      {item.isVerified ? 'Retirer badge vérifié' : 'Attribuer badge vérifié'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: VÉRIFICATION DES AGENTS */}
      {tab === 'agents' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Agence</th>
                  <th className="p-3">Zone</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Formule</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents?.map((a) => (
                  <tr key={a._id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      {a.firstName} {a.lastName}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {a.phone} • {a.email}
                      </span>
                    </td>
                    <td className="p-3">{a.agencyName || 'Indépendant'}</td>
                    <td className="p-3">{a.city}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          a.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : a.verificationStatus === 'REJECTED'
                              ? 'bg-red-500/20 text-red-600'
                              : 'bg-amber-500/20 text-amber-600'
                        }`}
                      >
                        {a.verificationStatus}
                      </span>
                    </td>
                    <td className="p-3 font-medium">{a.activeSubscriptionPlan}</td>
                    <td className="p-3 text-right space-x-2">
                      {a.verificationStatus !== 'VERIFIED' && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 h-7 text-[11px]"
                          onClick={() => verifyAgentMutation.mutate(a._id)}
                        >
                          Vérifier
                        </Button>
                      )}
                      {a.verificationStatus !== 'REJECTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] text-red-600"
                          onClick={() => {
                            const reason = prompt('Motif du rejet :');
                            if (reason) rejectAgentMutation.mutate({ id: a._id, reason });
                          }}
                        >
                          Rejeter
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: GESTION DES FORMULES D'ABONNEMENT */}
      {tab === 'plans' && (
        <div className="grid gap-4 md:grid-cols-2">
          {plans?.map((p) => (
            <Card key={p._id} className="p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-foreground">{p.name}</h3>
                  <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                </div>
                <span className="text-base font-black text-primary">
                  {p.priceMinor?.toLocaleString('fr-FR')} {p.currency}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-lg text-muted-foreground">
                <div>
                  Max annonces actives :{' '}
                  <strong className="text-foreground">{p.maxActiveListings}</strong>
                </div>
                <div>
                  Photos / annonce :{' '}
                  <strong className="text-foreground">{p.maxPhotosPerListing}</strong>
                </div>
                <div>
                  Vidéos autorisées :{' '}
                  <strong className="text-foreground">{p.maxVideosPerListing}</strong>
                </div>
                <div>
                  Biens mis en avant :{' '}
                  <strong className="text-foreground">{p.featuredListingsQuota}</strong>
                </div>
                <div>
                  Accès CRM :{' '}
                  <strong className="text-foreground">{p.leadManagement ? 'Oui' : 'Non'}</strong>
                </div>
                <div>
                  Statistiques avancées :{' '}
                  <strong className="text-foreground">{p.advancedAnalytics ? 'Oui' : 'Non'}</strong>
                </div>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="w-full text-xs"
                onClick={() => {
                  const newPrice = prompt(
                    `Nouveau prix (en ${p.currency}) pour ${p.name} :`,
                    String(p.priceMinor),
                  );
                  const newMax = prompt(
                    `Nouveau quota d'annonces actives :`,
                    String(p.maxActiveListings),
                  );
                  if (newPrice !== null && newMax !== null) {
                    updatePlanMutation.mutate({
                      id: p._id,
                      body: { priceMinor: Number(newPrice), maxActiveListings: Number(newMax) },
                    });
                  }
                }}
              >
                Modifier les quotas et tarifs
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
