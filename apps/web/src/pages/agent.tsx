import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  Building,
  Calendar,
  Check,
  CheckCircle,
  DollarSign,
  FileCheck,
  Flame,
  Home,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Users,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';

interface AgentDashboardData {
  kpis: {
    activeListings: number;
    pendingListings: number;
    soldListings: number;
    rentedListings: number;
    totalLeads: number;
    newLeads: number;
    upcomingViewingsCount: number;
    activeMandates: number;
    estimatedCommissionsMinor: number;
    earnedCommissionsMinor: number;
    currency: string;
  };
  upcomingViewings: any[];
  recentLeads: any[];
  subscription: {
    profile: any;
    plan: any;
    usage: {
      activeListingsCount: number;
      maxActiveListings: number;
      canCreateListing: boolean;
      featuredListingsCount: number;
      maxFeaturedListings: number;
      canFeatureListing: boolean;
      maxPhotosPerListing: number;
      maxVideosPerListing: number;
      advancedAnalytics: boolean;
      leadManagement: boolean;
    };
  };
}

export function AgentPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<
    | 'dashboard'
    | 'listings'
    | 'new-listing'
    | 'mandates'
    | 'crm'
    | 'viewings'
    | 'offers'
    | 'commissions'
    | 'profile'
    | 'subscription'
  >('dashboard');

  // Load dashboard overview
  const { data: dashboard } = useOrgQuery<AgentDashboardData>(
    ['agent-dashboard'],
    '/agent/dashboard',
  );

  // Load listings
  const { data: listings } = useOrgQuery<any[]>(['agent-listings'], '/agent/listings');
  // Load CRM leads
  const { data: leads } = useOrgQuery<any[]>(['agent-leads'], '/agent/leads');
  // Load Viewings
  const { data: viewings } = useOrgQuery<any[]>(['agent-viewings'], '/agent/viewings');
  // Load Offers
  const { data: offers } = useOrgQuery<any[]>(['agent-offers'], '/agent/offers');
  // Load Commissions
  const { data: commissions } = useOrgQuery<any[]>(['agent-commissions'], '/agent/commissions');
  // Load Mandates
  const { data: mandates } = useOrgQuery<any[]>(['agent-mandates'], '/agent/mandates');
  // Load Subscription plans
  const { data: subscriptionData } = useOrgQuery<any>(
    ['agent-subscription'],
    '/agent/subscription',
  );

  // Form states for dynamic listing creation
  const [category, setCategory] = useState('RESIDENTIAL');
  const [propertyType, setPropertyType] = useState('APARTMENT');
  const [transactionType, setTransactionType] = useState('SALE');
  const [isTitled, setIsTitled] = useState(false);
  const [photosInput, setPhotosInput] = useState('');
  const [videosInput, setVideosInput] = useState('');

  // Mutation: Create listing
  const createListingMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/agent/listings`, { method: 'POST', body }),
    onSuccess: () => {
      toast({
        title: 'Annonce soumise !',
        description: 'Votre annonce a été transmise pour modération.',
        variant: 'success',
      });
      void client.invalidateQueries({ queryKey: ['agent-listings'] });
      void client.invalidateQueries({ queryKey: ['agent-dashboard'] });
      setTab('listings');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Mandate Accept / Reject
  const mandateDecisionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'accept' | 'reject';
      reason?: string;
    }) =>
      apiRequest(`${base}/agent/mandates/${id}/${action}`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast({ title: 'Mandat mis à jour', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['agent-mandates'] });
      void client.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Viewing status update
  const viewingUpdateMutation = useMutation({
    mutationFn: ({ id, status, feedback }: { id: string; status: string; feedback?: string }) =>
      apiRequest(`${base}/agent/viewings/${id}`, { method: 'PATCH', body: { status, feedback } }),
    onSuccess: () => {
      toast({ title: 'Visite mise à jour', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['agent-viewings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Lead creation
  const [newLeadOpen, setNewLeadOpen] = useState(false);
  const createLeadMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/agent/leads`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Prospect ajouté au CRM', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['agent-leads'] });
      setNewLeadOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Offer Decision
  const offerDecisionMutation = useMutation({
    mutationFn: ({ id, status, counterOfferAmountMinor, ownerDecisionNote }: any) =>
      apiRequest(`${base}/agent/offers/${id}`, {
        method: 'PATCH',
        body: { status, counterOfferAmountMinor, ownerDecisionNote },
      }),
    onSuccess: () => {
      toast({ title: 'Négociation enregistrée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['agent-offers'] });
      void client.invalidateQueries({ queryKey: ['agent-commissions'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Change Subscription Plan
  const changePlanMutation = useMutation({
    mutationFn: (planCode: string) =>
      apiRequest(`${base}/agent/subscription/change`, { method: 'POST', body: { planCode } }),
    onSuccess: (res: any) => {
      toast({ title: 'Formule mise à jour', description: res?.message, variant: 'success' });
      void client.invalidateQueries({ queryKey: ['agent-subscription'] });
      void client.invalidateQueries({ queryKey: ['agent-dashboard'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const kpis = dashboard?.kpis;
  const usage = dashboard?.subscription?.usage;
  const plan = dashboard?.subscription?.plan;
  const profile = dashboard?.subscription?.profile;

  return (
    <div className="space-y-6">
      {/* Top Banner: Verification & Quota info */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Espace Agent Immobilier
            </h1>
            {profile?.verificationStatus === 'VERIFIED' ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" /> Agent Vérifié
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <ShieldAlert className="h-3.5 w-3.5" /> Vérification en attente
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {profile?.agencyName ? `${profile.agencyName} • ` : ''}
            {profile?.city || 'Afrique de l’Ouest'} • Formule :{' '}
            <strong className="text-foreground">{plan?.name || 'Agent Gratuit'}</strong>
          </p>
        </div>

        {/* Quota Progress */}
        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-muted-foreground block">Quota annonces actives</span>
            <span className="font-bold text-foreground">
              {usage?.activeListingsCount || 0} / {usage?.maxActiveListings || 3}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setTab('subscription')}>
            Gérer mon abonnement
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs sm:text-sm">
        {[
          { key: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
          { key: 'listings', label: 'Mes annonces', icon: Building },
          { key: 'new-listing', label: '+ Publier une annonce', icon: Plus },
          { key: 'mandates', label: 'Mandats reçus', icon: FileCheck },
          { key: 'crm', label: 'CRM Prospects', icon: Users },
          { key: 'viewings', label: 'Visites', icon: Calendar },
          { key: 'offers', label: 'Offres & Négociations', icon: Flame },
          { key: 'commissions', label: 'Commissions', icon: DollarSign },
          { key: 'profile', label: 'Profil professionnel', icon: UserCheck },
          { key: 'subscription', label: 'Formules d’abonnement', icon: Sparkles },
        ].map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as any)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: DASHBOARD OVERVIEW */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Annonces actives
                </CardTitle>
                <Building className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.activeListings || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.pendingListings || 0} en attente de modération
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Biens Conclus (Vente / Loc.)
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600">
                  {(kpis?.soldListings || 0) + (kpis?.rentedListings || 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.soldListings || 0} vendus • {kpis?.rentedListings || 0} loués
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Prospects Actifs
                </CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpis?.totalLeads || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {kpis?.newLeads || 0} nouveaux prospects
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Commissions Encaissées
                </CardTitle>
                <DollarSign className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {(kpis?.earnedCommissionsMinor || 0).toLocaleString('fr-FR')}{' '}
                  {kpis?.currency || 'XOF'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(kpis?.estimatedCommissionsMinor || 0).toLocaleString('fr-FR')} XOF en cours
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Quick Sections: Upcoming Viewings & Recent Leads */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Prochaines visites programmées
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setTab('viewings')}
                >
                  Voir tout
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!dashboard?.upcomingViewings || dashboard.upcomingViewings.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Aucune visite programmée pour l'instant.
                  </p>
                ) : (
                  dashboard.upcomingViewings.map((v) => (
                    <div
                      key={v._id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">
                          {v.prospectName} ({v.prospectPhone})
                        </p>
                        <p className="text-muted-foreground truncate max-w-[200px]">
                          {v.listingId?.title}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-primary block">
                          {new Date(v.date).toLocaleDateString('fr-FR')}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(v.date).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Derniers prospects captés
                </CardTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setTab('crm')}
                >
                  Pipeline CRM
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {!dashboard?.recentLeads || dashboard.recentLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">
                    Aucun prospect enregistré.
                  </p>
                ) : (
                  dashboard.recentLeads.map((l) => (
                    <div
                      key={l._id}
                      className="flex items-center justify-between rounded-lg border border-border p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold">{l.fullName}</p>
                        <p className="text-muted-foreground">
                          {l.phone} • {l.targetCity || 'Ville non spécifiée'}
                        </p>
                      </div>
                      <span className="rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        {l.status}
                      </span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: MES ANNONCES */}
      {tab === 'listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Mes annonces immobilières</h2>
            <Button size="sm" onClick={() => setTab('new-listing')}>
              <Plus className="mr-1.5 h-4 w-4" /> Créer une annonce
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings?.map((item) => (
              <Card key={item._id} className="overflow-hidden border-border">
                <div className="h-36 bg-muted relative">
                  {item.photos?.[0]?.url ? (
                    <img
                      src={item.photos[0].url}
                      alt={item.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <Home className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  <div className="absolute left-2 top-2 flex gap-1">
                    <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {item.transactionType === 'SALE' ? 'Vente' : 'Location'}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold text-white ${
                        item.status === 'PUBLISHED'
                          ? 'bg-emerald-600'
                          : item.status === 'PENDING_REVIEW'
                            ? 'bg-amber-600'
                            : 'bg-red-600'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                </div>
                <CardContent className="p-3 space-y-1.5 text-xs">
                  <h3 className="font-bold text-sm line-clamp-1">{item.title}</h3>
                  <p className="font-bold text-primary">
                    {item.priceMinor?.toLocaleString('fr-FR')} {item.currency}
                  </p>
                  <p className="text-muted-foreground truncate">
                    {item.location?.city}{' '}
                    {item.location?.district ? `(${item.location.district})` : ''}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                    <span>{item.viewsCount || 0} vues</span>
                    <span>{item.inquiriesCount || 0} demandes</span>
                    {item.isTitled ? (
                      <span className="font-medium text-amber-600">TF Titré</span>
                    ) : (
                      <span>Non titré</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: PUBLIER UNE ANNONCE (FORMULAIRE DYNAMIQUE) */}
      {tab === 'new-listing' && (
        <Card className="max-w-3xl mx-auto">
          <CardHeader>
            <CardTitle className="text-lg">Nouvelle annonce immobilière</CardTitle>
            <p className="text-xs text-muted-foreground">
              Formulaire dynamique adapté aux spécificités foncières ou bâtis (Sénégal, Côte
              d’Ivoire, Cameroun...).
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const photosArray = photosInput
                  .split('\n')
                  .map((u) => u.trim())
                  .filter(Boolean)
                  .map((url, idx) => ({ url, isPrimary: idx === 0 }));
                const videosArray = videosInput
                  .split('\n')
                  .map((u) => u.trim())
                  .filter(Boolean);

                createListingMutation.mutate({
                  title: form.get('title'),
                  description: form.get('description'),
                  category,
                  propertyType,
                  transactionType,
                  priceMinor: Number(form.get('priceMinor')),
                  currency: form.get('currency') || 'XOF',
                  location: {
                    city: form.get('city'),
                    district: form.get('district') || undefined,
                    address: form.get('address') || undefined,
                    hideExactAddress: form.get('hideExactAddress') === 'on',
                  },
                  surfaceM2: form.get('surfaceM2') ? Number(form.get('surfaceM2')) : undefined,
                  bedrooms: form.get('bedrooms') ? Number(form.get('bedrooms')) : undefined,
                  bathrooms: form.get('bathrooms') ? Number(form.get('bathrooms')) : undefined,
                  isTitled,
                  landTitleNumber: form.get('landTitleNumber') || undefined,
                  photos: photosArray,
                  videos: videosArray,
                });
              }}
            >
              {/* Transaction & Category */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Type de transaction *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={transactionType}
                    onChange={(e) => setTransactionType(e.target.value)}
                  >
                    <option value="SALE">Vente</option>
                    <option value="RENT">Location</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Catégorie *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="RESIDENTIAL">Résidentiel</option>
                    <option value="COMMERCIAL">Commercial</option>
                    <option value="LAND">Terrain foncier</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1">Sous-type de bien *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                  >
                    {category === 'RESIDENTIAL' && (
                      <>
                        <option value="APARTMENT">Appartement</option>
                        <option value="VILLA">Villa</option>
                        <option value="STUDIO">Studio</option>
                        <option value="BUILDING">Immeuble entier</option>
                        <option value="ROOM">Chambre</option>
                      </>
                    )}
                    {category === 'COMMERCIAL' && (
                      <>
                        <option value="OFFICE">Bureau / Plateau</option>
                        <option value="RETAIL">Boutique / Local commercial</option>
                        <option value="WAREHOUSE">Entrepôt / Dépôt</option>
                      </>
                    )}
                    {category === 'LAND' && (
                      <>
                        <option value="LAND_RESIDENTIAL">Terrain résidentiel</option>
                        <option value="LAND_COMMERCIAL">Terrain commercial</option>
                        <option value="LAND_AGRICULTURAL">Terrain agricole</option>
                      </>
                    )}
                    {category === 'OTHER' && <option value="OTHER">Autre bien</option>}
                  </select>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block">Titre de l'annonce *</label>
                <Input
                  name="title"
                  placeholder="Ex: Superbe Villa 5 pièces avec piscine aux Almadies"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold block">Description détaillée *</label>
                <textarea
                  name="description"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm"
                  placeholder="Détails du bien, standing, sécurité, accessibilité..."
                  required
                />
              </div>

              {/* Price & Currency */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    Prix ({transactionType === 'RENT' ? 'Loyer mensuel' : 'Prix de vente'}) *
                  </label>
                  <Input
                    name="priceMinor"
                    type="number"
                    min="1"
                    placeholder="Ex: 850000"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Devise</label>
                  <select
                    name="currency"
                    className="w-full rounded-md border border-input bg-background p-2 text-sm"
                    defaultValue="XOF"
                  >
                    <option value="XOF">XOF (Franc CFA UEMOA)</option>
                    <option value="XAF">XAF (Franc CFA CEMAC)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              {/* Location */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Ville *</label>
                  <Input name="city" placeholder="Ex: Dakar, Abidjan..." required />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Quartier / Commune</label>
                  <Input name="district" placeholder="Ex: Almadies, Cocody..." />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Adresse précise</label>
                  <Input name="address" placeholder="Rue ou repère..." />
                </div>
              </div>

              {/* Specific features according to Category */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-semibold block mb-1">Superficie (m²)</label>
                  <Input name="surfaceM2" type="number" min="0" placeholder="Ex: 350" />
                </div>
                {category !== 'LAND' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Chambres</label>
                      <Input name="bedrooms" type="number" min="0" placeholder="Ex: 4" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Salles de bain</label>
                      <Input name="bathrooms" type="number" min="0" placeholder="Ex: 3" />
                    </div>
                  </>
                )}
              </div>

              {/* Legal & Title Deed Status */}
              <div className="rounded-xl border border-border p-3 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold block">Statut Foncier & Juridique</span>
                    <span className="text-[11px] text-muted-foreground">
                      Le bien dispose-t-il d'un Titre Foncier (TF) individuel et vérifiable ?
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={isTitled}
                    onChange={(e) => setIsTitled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </div>

                {isTitled && (
                  <div>
                    <label className="text-xs font-semibold block mb-1">
                      Numéro du Titre Foncier (TF)
                    </label>
                    <Input name="landTitleNumber" placeholder="Ex: TF 14.521 / GRD" />
                  </div>
                )}
              </div>

              {/* Photos & Videos URLs */}
              <div className="space-y-2">
                <label className="text-xs font-semibold block">
                  Photos du bien (URLs directes, une par ligne — max{' '}
                  {plan?.maxPhotosPerListing || 5})
                </label>
                <textarea
                  value={photosInput}
                  onChange={(e) => setPhotosInput(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
                  placeholder="https://images.unsplash.com/photo-1&#10;https://images.unsplash.com/photo-2"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold block">
                  Vidéo de visite (URL YouTube ou MP4 — max {plan?.maxVideosPerListing || 0})
                </label>
                <Input
                  value={videosInput}
                  onChange={(e) => setVideosInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={plan?.maxVideosPerListing === 0}
                />
                {plan?.maxVideosPerListing === 0 && (
                  <p className="text-[11px] text-amber-600">
                    Les vidéos nécessitent un forfait supérieur (Starter, Pro ou Business).
                  </p>
                )}
              </div>

              <Button type="submit" disabled={createListingMutation.isPending} className="w-full">
                {createListingMutation.isPending
                  ? 'Soumission...'
                  : 'Soumettre l’annonce pour modération'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 4: MANDATS REÇUS */}
      {tab === 'mandates' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">
            Mandats de commercialisation confiés par les propriétaires
          </h2>
          {!mandates || mandates.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center border border-dashed rounded-xl">
              Aucun mandat confié par un propriétaire pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {mandates.map((m) => (
                <Card
                  key={m._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Mandat : {m.mandateType}</span>
                      <span
                        className={`rounded px-2 py-0.5 font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : m.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-600'
                              : 'bg-red-500/20 text-red-600'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Propriétaire : {m.ownerId?.name} ({m.ownerId?.email}) • Commission :{' '}
                      <strong>{m.commissionRate}%</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Période : {new Date(m.startDate).toLocaleDateString('fr-FR')} au{' '}
                      {new Date(m.endDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>

                  {m.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 h-8"
                        onClick={() =>
                          mandateDecisionMutation.mutate({ id: m._id, action: 'accept' })
                        }
                      >
                        Accepter le mandat
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-red-600"
                        onClick={() =>
                          mandateDecisionMutation.mutate({
                            id: m._id,
                            action: 'reject',
                            reason: 'Non disponible',
                          })
                        }
                      >
                        Refuser
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: CRM PROSPECTS */}
      {tab === 'crm' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">Pipeline CRM Prospects</h2>
            <Button size="sm" onClick={() => setNewLeadOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Nouveau prospect
            </Button>
          </div>

          {newLeadOpen && (
            <Card className="p-4 border-primary">
              <h3 className="font-bold text-xs mb-3">Enregistrer un nouveau prospect</h3>
              <form
                className="grid gap-3 sm:grid-cols-3 text-xs"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  createLeadMutation.mutate({
                    fullName: form.get('fullName'),
                    phone: form.get('phone'),
                    email: form.get('email') || undefined,
                    searchType: form.get('searchType'),
                    budgetMinor: form.get('budgetMinor')
                      ? Number(form.get('budgetMinor'))
                      : undefined,
                    targetCity: form.get('targetCity'),
                    targetDistrict: form.get('targetDistrict'),
                    status: 'NEW',
                    notes: form.get('notes'),
                  });
                }}
              >
                <Input name="fullName" placeholder="Nom complet *" required />
                <Input name="phone" placeholder="Téléphone / WhatsApp *" required />
                <Input name="email" type="email" placeholder="Email" />
                <select name="searchType" className="rounded border border-input p-2 bg-background">
                  <option value="BUY">Acheteur</option>
                  <option value="RENT">Locataire</option>
                </select>
                <Input name="budgetMinor" type="number" placeholder="Budget estimé (XOF)" />
                <Input name="targetCity" placeholder="Ville recherchée" />
                <div className="sm:col-span-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setNewLeadOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" size="sm" disabled={createLeadMutation.isPending}>
                    Enregistrer
                  </Button>
                </div>
              </form>
            </Card>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Prospect</th>
                  <th className="p-3">Recherche</th>
                  <th className="p-3">Budget</th>
                  <th className="p-3">Localisation</th>
                  <th className="p-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {leads?.map((l) => (
                  <tr key={l._id} className="hover:bg-muted/30">
                    <td className="p-3 font-semibold">
                      {l.fullName}
                      <span className="block text-[11px] font-normal text-muted-foreground">
                        {l.phone}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">
                        {l.searchType === 'BUY' ? 'Achat' : 'Location'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-primary">
                      {l.budgetMinor ? `${l.budgetMinor.toLocaleString('fr-FR')} XOF` : '—'}
                    </td>
                    <td className="p-3">
                      {l.targetCity || '—'} {l.targetDistrict ? `(${l.targetDistrict})` : ''}
                    </td>
                    <td className="p-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {l.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: VISITES */}
      {tab === 'viewings' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Calendrier des visites</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {viewings?.map((v) => (
              <Card key={v._id} className="p-4 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{v.prospectName}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      v.status === 'CONFIRMED'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {v.status}
                  </span>
                </div>
                <p className="text-muted-foreground">Bien : {v.listingId?.title}</p>
                <p className="font-semibold text-primary">
                  {new Date(v.date).toLocaleString('fr-FR')}
                </p>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => viewingUpdateMutation.mutate({ id: v._id, status: 'CONFIRMED' })}
                  >
                    Confirmer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => viewingUpdateMutation.mutate({ id: v._id, status: 'COMPLETED' })}
                  >
                    Terminée
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: OFFRES & NÉGOCIATIONS */}
      {tab === 'offers' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Offres d'achat et propositions de loyer</h2>
          <div className="space-y-3">
            {offers?.map((o) => (
              <Card
                key={o._id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">
                      {o.prospectName} ({o.prospectPhone})
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                      {o.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">Annonce : {o.listingId?.title}</p>
                  <p className="text-base font-black text-primary mt-1">
                    Offre : {o.offeredAmountMinor.toLocaleString('fr-FR')} {o.currency}
                  </p>
                  {o.message && (
                    <p className="text-muted-foreground italic mt-0.5">"{o.message}"</p>
                  )}
                </div>

                {o.status === 'SUBMITTED' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
                      onClick={() =>
                        offerDecisionMutation.mutate({ id: o._id, status: 'ACCEPTED' })
                      }
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600"
                      onClick={() =>
                        offerDecisionMutation.mutate({ id: o._id, status: 'REJECTED' })
                      }
                    >
                      Refuser
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: COMMISSIONS */}
      {tab === 'commissions' && (
        <div className="space-y-4">
          <h2 className="text-base font-bold">Suivi des commissions immobilières</h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border font-semibold text-muted-foreground">
                <tr>
                  <th className="p-3">Bien concerné</th>
                  <th className="p-3">Transaction</th>
                  <th className="p-3">Commission calculée</th>
                  <th className="p-3">Statut</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {commissions?.map((c) => (
                  <tr key={c._id}>
                    <td className="p-3 font-semibold">{c.listingId?.title || 'Bien certifié'}</td>
                    <td className="p-3">
                      {c.transactionAmountMinor?.toLocaleString('fr-FR')} {c.currency}
                    </td>
                    <td className="p-3 font-bold text-primary">
                      {c.commissionAmountMinor?.toLocaleString('fr-FR')} {c.currency}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          c.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : 'bg-amber-500/20 text-amber-600'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: PROFIL PROFESSIONNEL */}
      {tab === 'profile' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">Profil professionnel de l’agent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="text-muted-foreground block">Nom & Prénom</span>
                <span className="font-bold text-sm">
                  {profile?.firstName} {profile?.lastName}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Agence</span>
                <span className="font-bold text-sm">{profile?.agencyName || 'Indépendant'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Téléphone</span>
                <span className="font-bold">{profile?.phone}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Email</span>
                <span className="font-bold">{profile?.email}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Ville & Zone</span>
                <span className="font-bold">
                  {profile?.city} — {profile?.activityZone || 'Toute la région'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block">Statut de vérification</span>
                <span className="font-bold text-emerald-600">{profile?.verificationStatus}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* TAB 10: FORMULES D'ABONNEMENT */}
      {tab === 'subscription' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl font-bold">Formules d'abonnements Agents Immobiliers</h2>
            <p className="text-xs text-muted-foreground">
              Augmentez vos quotas d'annonces, ajoutez des vidéos immersives et accédez aux outils
              avancés de CRM & prospection.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {subscriptionData?.availablePlans?.map((p: any) => {
              const isCurrent = profile?.activeSubscriptionPlan === p.code;
              return (
                <Card
                  key={p.code}
                  className={`flex flex-col justify-between p-5 border ${
                    isCurrent ? 'border-primary ring-2 ring-primary/20 shadow-md' : 'border-border'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base">{p.name}</h3>
                      {isCurrent && (
                        <span className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                          Actuel
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-black text-foreground">
                      {p.priceMinor === 0
                        ? 'Gratuit'
                        : `${p.priceMinor.toLocaleString('fr-FR')} XOF`}
                      {p.priceMinor > 0 && (
                        <span className="text-xs font-normal text-muted-foreground"> / mois</span>
                      )}
                    </div>

                    <ul className="space-y-2 text-xs text-muted-foreground pt-2 border-t border-border">
                      <li className="flex items-center gap-1.5 text-foreground font-medium">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        Jusqu'à {p.maxActiveListings} annonces actives
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {p.maxPhotosPerListing} photos par annonce
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {p.maxVideosPerListing} vidéo(s) autorisée(s)
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {p.featuredListingsQuota} mise(s) en avant
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="h-3.5 w-3.5 text-emerald-500" />
                        {p.leadManagement ? 'CRM Prospects complet' : 'CRM basique'}
                      </li>
                    </ul>
                  </div>

                  <div className="pt-4">
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={isCurrent || changePlanMutation.isPending}
                      variant={isCurrent ? 'outline' : 'default'}
                      onClick={() => changePlanMutation.mutate(p.code)}
                    >
                      {isCurrent ? 'Formule active' : 'Choisir cette formule'}
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
