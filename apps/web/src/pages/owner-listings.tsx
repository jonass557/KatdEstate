import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Home,
  UserCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';

export function OwnerListingsPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'listings' | 'mandates' | 'offers' | 'new-mandate'>('listings');

  // Queries
  const { data: listings } = useOrgQuery<any[]>(['owner-listings'], '/owner/listings');
  const { data: mandates } = useOrgQuery<any[]>(['owner-mandates'], '/owner/mandates');
  const { data: offers } = useOrgQuery<any[]>(['owner-offers'], '/owner/offers');
  const { data: properties } = useOrgQuery<any[]>(['properties-brief'], '/properties?pageSize=50');

  // Mutation: Revoke mandate
  const revokeMandateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiRequest(`${base}/owner/mandates/${id}/revoke`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast({
        title: 'Mandat révoqué avec succès',
        description: 'Les droits et annonces associées de l’agent ont été immédiatement suspendus.',
        variant: 'success',
      });
      void client.invalidateQueries({ queryKey: ['owner-mandates'] });
      void client.invalidateQueries({ queryKey: ['owner-listings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Create Mandate
  const createMandateMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/owner/mandates`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Mandat proposé à l’agent', description: 'En attente de son acceptation.', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['owner-mandates'] });
      setActiveTab('mandates');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Decide on Offer
  const decideOfferMutation = useMutation({
    mutationFn: ({ id, status, counterOfferAmountMinor, ownerDecisionNote }: any) =>
      apiRequest(`${base}/owner/offers/${id}`, { method: 'PATCH', body: { status, counterOfferAmountMinor, ownerDecisionNote } }),
    onSuccess: () => {
      toast({ title: 'Décision enregistrée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['owner-offers'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Commercialisation & Marketplace</h1>
          <p className="text-xs text-muted-foreground">
            Gérez vos annonces directes, mandatez des agents immobiliers partenaires et négociez les offres.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setActiveTab('new-mandate')}>
            <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Mandater un agent
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2 text-xs">
        {[
          { key: 'listings', label: `Mes annonces (${listings?.length || 0})` },
          { key: 'mandates', label: `Mandats agents (${mandates?.length || 0})` },
          { key: 'offers', label: `Offres reçues (${offers?.length || 0})` },
          { key: 'new-mandate', label: '+ Nouveau mandat' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {(!listings || listings.length === 0) ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune annonce publiée pour l'instant. Vous pouvez créer une annonce ou confier la commercialisation à un agent certifié.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <Card key={l._id} className="overflow-hidden border-border text-xs">
                  <div className="h-32 bg-muted relative">
                    {l.photos?.[0]?.url ? (
                      <img src={l.photos[0].url} alt={l.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Home className="h-8 w-8 opacity-30" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      {l.status}
                    </span>
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <h3 className="font-bold text-sm line-clamp-1">{l.title}</h3>
                    <p className="font-black text-primary text-sm">
                      {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                    </p>
                    <p className="text-muted-foreground">{l.location?.city}</p>
                    <div className="flex justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span>{l.viewsCount || 0} vues</span>
                      <span>{l.inquiriesCount || 0} contacts</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANDATES */}
      {activeTab === 'mandates' && (
        <div className="space-y-4">
          {(!mandates || mandates.length === 0) ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Vous n'avez pas encore confié de mandat à un agent immobilier.
            </Card>
          ) : (
            <div className="space-y-3">
              {mandates.map((m) => (
                <Card key={m._id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Mandat : {m.mandateType}</span>
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        m.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : m.status === 'REVOKED'
                          ? 'bg-red-500/20 text-red-600'
                          : 'bg-amber-500/20 text-amber-600'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Bien rattaché : <strong>{m.propertyId?.name || 'Bien non rattaché'}</strong> • Commission convenue : <strong>{m.commissionRate}%</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Agent mandaté : {m.agentProfileId?.firstName} {m.agentProfileId?.lastName} ({m.agentProfileId?.agencyName || 'Indépendant'})
                    </p>
                  </div>

                  {m.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                      onClick={() => {
                        const reason = prompt('Motif de la révocation du mandat :');
                        if (reason) revokeMandateMutation.mutate({ id: m._id, reason });
                      }}
                    >
                      Révoquer le mandat
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFERS */}
      {activeTab === 'offers' && (
        <div className="space-y-3">
          {(!offers || offers.length === 0) ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune offre d'achat ou proposition de location reçue pour vos biens.
            </Card>
          ) : (
            offers.map((o) => (
              <Card key={o._id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{o.prospectName}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">{o.status}</span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Annonce : <strong>{o.listingId?.title}</strong>
                  </p>
                  <p className="text-base font-black text-primary mt-1">
                    Proposition : {o.offeredAmountMinor?.toLocaleString('fr-FR')} {o.currency}
                  </p>
                  {o.message && <p className="text-muted-foreground italic mt-0.5">"{o.message}"</p>}
                </div>

                {o.status === 'SUBMITTED' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                      onClick={() => decideOfferMutation.mutate({ id: o._id, status: 'ACCEPTED' })}
                    >
                      Accepter l'offre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600"
                      onClick={() => decideOfferMutation.mutate({ id: o._id, status: 'REJECTED' })}
                    >
                      Décliner
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 4: NEW MANDATE FORM */}
      {activeTab === 'new-mandate' && (
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">Confier un mandat à un agent immobilier</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                createMandateMutation.mutate({
                  agentId: form.get('agentId'),
                  propertyId: form.get('propertyId') || undefined,
                  mandateType: form.get('mandateType'),
                  commissionType: 'PERCENTAGE',
                  commissionRate: Number(form.get('commissionRate')),
                  startDate: form.get('startDate'),
                  endDate: form.get('endDate'),
                  terms: form.get('terms'),
                });
              }}
            >
              <div>
                <label className="font-semibold block mb-1">ID Utilisateur de l'agent *</label>
                <Input name="agentId" placeholder="Identifiant de l'agent certifié DOMORA" required />
              </div>

              <div>
                <label className="font-semibold block mb-1">Propriété DOMORA à commercialiser</label>
                <select name="propertyId" className="w-full rounded-md border border-input p-2 bg-background">
                  <option value="">Sélectionnez un bien de votre parc...</option>
                  {properties?.map((p) => (
                    <option key={p._id} value={p._id}>{p.name} ({p.address?.city || 'Afrique'})</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Type de mandat *</label>
                  <select name="mandateType" className="w-full rounded-md border border-input p-2 bg-background">
                    <option value="SALE">Vente</option>
                    <option value="RENT">Location</option>
                    <option value="EXCLUSIVE">Exclusif</option>
                    <option value="NON_EXCLUSIVE">Simple (Non-exclusif)</option>
                    <option value="MANAGEMENT">Gestion locative complète</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Taux de commission convenu (%) *</label>
                  <Input name="commissionRate" type="number" min="0" max="100" defaultValue="5" required />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Date de début *</label>
                  <Input name="startDate" type="date" required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Date d'échéance *</label>
                  <Input name="endDate" type="date" required />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">Clauses et conditions particulières</label>
                <textarea
                  name="terms"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2"
                  placeholder="Conditions de commercialisation, horaires de visite autorisés..."
                />
              </div>

              <Button type="submit" disabled={createMandateMutation.isPending} className="w-full">
                {createMandateMutation.isPending ? 'Enregistrement...' : 'Proposer le mandat'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
