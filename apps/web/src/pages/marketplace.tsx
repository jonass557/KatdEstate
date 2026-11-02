import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { BackButton } from '../components/ui/back-button';
import {
  Building2,
  FileCheck,
  Home,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';

interface ListingItem {
  _id: string;
  title: string;
  description: string;
  category: string;
  propertyType: string;
  transactionType: 'SALE' | 'RENT';
  priceMinor: number;
  currency: string;
  location: {
    city: string;
    district?: string;
    address?: string;
  };
  surfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  roomsCount?: number;
  isTitled?: boolean;
  landTitleNumber?: string;
  isVerified?: boolean;
  isFeatured?: boolean;
  amenities?: string[];
  photos?: Array<{ url: string; isPrimary?: boolean; caption?: string }>;
  agentProfileId?: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    agencyName?: string;
    photoUrl?: string;
    rating?: number;
    verificationStatus?: string;
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  RESIDENTIAL: 'Résidentiel',
  COMMERCIAL: 'Commercial',
  LAND: 'Terrain',
  OTHER: 'Autre',
};

const TYPE_LABELS: Record<string, string> = {
  APARTMENT: 'Appartement',
  VILLA: 'Villa',
  STUDIO: 'Studio',
  BUILDING: 'Immeuble',
  ROOM: 'Chambre',
  OFFICE: 'Bureau',
  RETAIL: 'Boutique',
  WAREHOUSE: 'Entrepôt',
  LAND_RESIDENTIAL: 'Terrain résidentiel',
  LAND_COMMERCIAL: 'Terrain commercial',
  LAND_AGRICULTURAL: 'Terrain agricole',
};

export function MarketplacePage() {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [transactionType, setTransactionType] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [isTitled, setIsTitled] = useState<boolean | undefined>(undefined);
  const [isVerified, setIsVerified] = useState<boolean | undefined>(undefined);
  const [selectedListing, setSelectedListing] = useState<ListingItem | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'inquiry' | 'viewing' | 'offer'>('info');

  // Search listings query
  const queryParams = new URLSearchParams();
  if (search) queryParams.set('q', search);
  if (city) queryParams.set('city', city);
  if (transactionType) queryParams.set('transactionType', transactionType);
  if (category) queryParams.set('category', category);
  if (isTitled !== undefined) queryParams.set('isTitled', String(isTitled));
  if (isVerified !== undefined) queryParams.set('isVerified', String(isVerified));

  const { data, isLoading } = useQuery<{ items: ListingItem[] }>({
    queryKey: ['marketplace-listings', queryParams.toString()],
    queryFn: () => apiRequest(`/marketplace/listings?${queryParams.toString()}`),
  });

  const listings = data?.items || [];

  // Mutations for user interactions
  const inquiryMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`/marketplace/listings/${selectedListing?._id}/inquiries`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Demande envoyée !', description: 'Le responsable de l’annonce vous répondra sous peu.', variant: 'success' });
      setActiveTab('info');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const viewingMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`/marketplace/listings/${selectedListing?._id}/viewings`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Visite programmée !', description: 'Votre demande a bien été transmise à l’agent/propriétaire.', variant: 'success' });
      setActiveTab('info');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const offerMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`/marketplace/listings/${selectedListing?._id}/offers`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Offre soumise !', description: 'Le propriétaire et l’agent ont reçu votre proposition de prix.', variant: 'success' });
      setActiveTab('info');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="border-b border-border bg-card px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-4 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackButton to="/" label="Retour à l'accueil" />
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Marketplace Immobilière Certifiée KadtEstate
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Trouvez votre bien immobilier en Afrique
          </h1>
          <p className="max-w-2xl text-muted-foreground text-sm sm:text-base">
            Découvrez des annonces vérifiées de vente, location et terrains sécurisés avec titre foncier (Sénégal, Côte d’Ivoire, Cameroun, Bénin, Togo, etc.).
          </p>

          {/* Search Filters Card */}
          <div className="mt-6 rounded-2xl border border-border bg-background p-4 shadow-sm space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Recherche (ex: Almadies, Villa, 4 pièces...)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div>
                <Input
                  placeholder="Ville (ex: Dakar, Abidjan...)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>

              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
              >
                <option value="">Toutes transactions</option>
                <option value="RENT">Location</option>
                <option value="SALE">Vente</option>
              </select>

              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Toutes catégories</option>
                <option value="RESIDENTIAL">Résidentiel</option>
                <option value="COMMERCIAL">Commercial</option>
                <option value="LAND">Terrains</option>
                <option value="OTHER">Autres</option>
              </select>
            </div>

            {/* Quick toggles */}
            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setIsTitled((v) => (v === true ? undefined : true))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                  isTitled === true
                    ? 'bg-amber-500/20 text-amber-600 border border-amber-500/40 dark:text-amber-400 font-semibold'
                    : 'border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <FileCheck className="h-3.5 w-3.5" />
                Titre Foncier vérifié
              </button>

              <button
                type="button"
                onClick={() => setIsVerified((v) => (v === true ? undefined : true))}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors ${
                  isVerified === true
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/40 dark:text-emerald-400 font-semibold'
                    : 'border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Annonce vérifiée DOMORA
              </button>

              {(search || city || transactionType || category || isTitled !== undefined || isVerified !== undefined) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setCity('');
                    setTransactionType('');
                    setCategory('');
                    setIsTitled(undefined);
                    setIsVerified(undefined);
                  }}
                  className="ml-auto text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Listings Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            {isLoading ? 'Chargement des annonces...' : `${listings.length} bien(s) disponible(s)`}
          </p>
        </div>

        {listings.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <Building2 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="text-base font-semibold">Aucune annonce trouvée</h3>
            <p className="text-sm text-muted-foreground">
              Modifiez vos critères de recherche ou réinitialisez les filtres pour afficher l'ensemble des biens disponibles.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((item) => {
              const primaryPhoto = item.photos?.find((p) => p.isPrimary)?.url || item.photos?.[0]?.url;
              return (
                <Card
                  key={item._id}
                  className="overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer border-border flex flex-col justify-between"
                  onClick={() => {
                    setSelectedListing(item);
                    setActiveTab('info');
                  }}
                >
                  <div>
                    {/* Image Thumbnail */}
                    <div className="relative h-48 w-full bg-muted">
                      {primaryPhoto ? (
                        <img src={primaryPhoto} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Home className="h-10 w-10 opacity-30" />
                        </div>
                      )}
                      {/* Top Badges */}
                      <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-semibold uppercase ${
                            item.transactionType === 'SALE'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {item.transactionType === 'SALE' ? 'Vente' : 'Location'}
                        </span>
                        {item.isVerified && (
                          <span className="flex items-center gap-1 rounded-md bg-emerald-700/90 px-2 py-0.5 text-xs font-medium text-white shadow-sm">
                            <ShieldCheck className="h-3 w-3" /> Vérifié
                          </span>
                        )}
                        {item.isTitled && (
                          <span className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">
                            TF
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Card Body */}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {CATEGORY_LABELS[item.category] || item.category} • {TYPE_LABELS[item.propertyType] || item.propertyType}
                        </span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{item.location.district ? `${item.location.district}, ` : ''}{item.location.city}</span>
                        </div>
                      </div>

                      <h3 className="font-semibold text-base line-clamp-1 text-foreground" title={item.title}>
                        {item.title}
                      </h3>

                      <p className="text-lg font-bold text-primary">
                        {item.priceMinor.toLocaleString('fr-FR')} {item.currency}
                        {item.transactionType === 'RENT' && <span className="text-xs font-normal text-muted-foreground"> / mois</span>}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t border-border/50">
                        {item.surfaceM2 ? <span>{item.surfaceM2} m²</span> : null}
                        {item.bedrooms ? <span>{item.bedrooms} ch.</span> : null}
                        {item.roomsCount ? <span>{item.roomsCount} pièces</span> : null}
                      </div>
                    </CardContent>
                  </div>

                  {/* Card Footer: Agent snippet */}
                  <div className="bg-muted/30 px-4 py-2.5 border-t border-border flex items-center justify-between text-xs">
                    <span className="font-medium truncate max-w-[180px]">
                      {item.agentProfileId?.agencyName || `${item.agentProfileId?.firstName || 'Partenaire'} ${item.agentProfileId?.lastName || 'DOMORA'}`}
                    </span>
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      Voir détails
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-card border border-border p-6 shadow-2xl">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setSelectedListing(null)}
              className="absolute right-4 top-4 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Title & Badges */}
            <div className="space-y-2 pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase ${
                    selectedListing.transactionType === 'SALE'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {selectedListing.transactionType === 'SALE' ? 'Vente' : 'Location'}
                </span>
                {selectedListing.isVerified && (
                  <span className="flex items-center gap-1 rounded-md bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white">
                    <ShieldCheck className="h-3.5 w-3.5" /> Bien vérifié DOMORA
                  </span>
                )}
                {selectedListing.isTitled ? (
                  <span className="flex items-center gap-1 rounded-md bg-amber-600 px-2 py-0.5 text-xs font-medium text-white">
                    <FileCheck className="h-3.5 w-3.5" /> Titre Foncier : {selectedListing.landTitleNumber || 'Enregistré'}
                  </span>
                ) : (
                  <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    Non titré / Bail / Délibération
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-foreground">{selectedListing.title}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-primary" />
                <span>
                  {selectedListing.location.district ? `${selectedListing.location.district}, ` : ''}
                  {selectedListing.location.city}
                  {selectedListing.location.address ? ` — ${selectedListing.location.address}` : ''}
                </span>
              </div>
              <p className="text-2xl font-black text-primary">
                {selectedListing.priceMinor.toLocaleString('fr-FR')} {selectedListing.currency}
                {selectedListing.transactionType === 'RENT' && <span className="text-sm font-normal text-muted-foreground"> / mois</span>}
              </p>
            </div>

            {/* Gallery Photos */}
            {selectedListing.photos && selectedListing.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2 overflow-hidden rounded-xl">
                {selectedListing.photos.slice(0, 3).map((p, idx) => (
                  <img key={idx} src={p.url} alt={p.caption || 'Photo du bien'} className="h-32 w-full object-cover rounded-md" />
                ))}
              </div>
            )}

            {/* Navigation Tabs inside Modal */}
            <div className="mt-6 flex border-b border-border text-sm font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'info' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Caractéristiques
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('inquiry')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'inquiry' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Renseignement
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('viewing')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'viewing' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Planifier une visite
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('offer')}
                className={`px-4 py-2 border-b-2 transition-colors ${
                  activeTab === 'offer' ? 'border-primary text-primary font-bold' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                Faire une offre
              </button>
            </div>

            {/* Tab 1: Caractéristiques */}
            {activeTab === 'info' && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-muted/40 p-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Catégorie</span>
                    <span className="font-semibold">{CATEGORY_LABELS[selectedListing.category] || selectedListing.category}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Type de bien</span>
                    <span className="font-semibold">{TYPE_LABELS[selectedListing.propertyType] || selectedListing.propertyType}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Superficie</span>
                    <span className="font-semibold">{selectedListing.surfaceM2 ? `${selectedListing.surfaceM2} m²` : 'Non renseignée'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Chambres</span>
                    <span className="font-semibold">{selectedListing.bedrooms || '—'}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Description</h4>
                  <p className="text-sm text-foreground/90 whitespace-pre-line">{selectedListing.description}</p>
                </div>

                {/* Agent Card */}
                {selectedListing.agentProfileId && (
                  <div className="rounded-xl border border-border p-4 bg-card flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Commercialisé par</p>
                      <h4 className="text-sm font-bold text-foreground">
                        {selectedListing.agentProfileId.firstName} {selectedListing.agentProfileId.lastName}
                      </h4>
                      {selectedListing.agentProfileId.agencyName && (
                        <p className="text-xs text-primary font-medium">{selectedListing.agentProfileId.agencyName}</p>
                      )}
                    </div>
                    <div className="text-right space-y-1">
                      <a
                        href={`tel:${selectedListing.agentProfileId.phone}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline"
                      >
                        <Phone className="h-3 w-3" /> {selectedListing.agentProfileId.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Inquiry */}
            {activeTab === 'inquiry' && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  inquiryMutation.mutate({
                    fullName: form.get('fullName'),
                    phone: form.get('phone'),
                    email: form.get('email') || undefined,
                    message: form.get('message'),
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="fullName" placeholder="Votre nom complet *" required />
                  <Input name="phone" placeholder="Téléphone / WhatsApp *" required />
                </div>
                <Input name="email" type="email" placeholder="Adresse email (optionnel)" />
                <textarea
                  name="message"
                  rows={3}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Bonjour, je souhaiterais obtenir davantage d'informations sur ce bien..."
                  defaultValue="Bonjour, je suis intéressé par votre bien et j’aimerais avoir plus de précisions."
                  required
                />
                <Button type="submit" disabled={inquiryMutation.isPending} className="w-full">
                  {inquiryMutation.isPending ? 'Envoi...' : 'Envoyer la demande de renseignement'}
                </Button>
              </form>
            )}

            {/* Tab 3: Viewing Booking */}
            {activeTab === 'viewing' && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  viewingMutation.mutate({
                    prospectName: form.get('prospectName'),
                    prospectPhone: form.get('prospectPhone'),
                    prospectEmail: form.get('prospectEmail') || undefined,
                    date: form.get('date'),
                    notes: form.get('notes'),
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="prospectName" placeholder="Votre nom complet *" required />
                  <Input name="prospectPhone" placeholder="Téléphone / WhatsApp *" required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="prospectEmail" type="email" placeholder="Adresse email (optionnel)" />
                  <Input name="date" type="datetime-local" required />
                </div>
                <textarea
                  name="notes"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Créneaux préférés ou consignes particulières pour la visite..."
                />
                <Button type="submit" disabled={viewingMutation.isPending} className="w-full">
                  {viewingMutation.isPending ? 'Confirmation...' : 'Confirmer le rendez-vous de visite'}
                </Button>
              </form>
            )}

            {/* Tab 4: Submit Offer */}
            {activeTab === 'offer' && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  offerMutation.mutate({
                    prospectName: form.get('prospectName'),
                    prospectPhone: form.get('prospectPhone'),
                    prospectEmail: form.get('prospectEmail') || undefined,
                    offeredAmountMinor: Number(form.get('offeredAmountMinor')),
                    message: form.get('message'),
                  });
                }}
              >
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-800 dark:text-amber-300">
                  Prix affiché : <strong>{selectedListing.priceMinor.toLocaleString('fr-FR')} {selectedListing.currency}</strong>.
                  Votre proposition sera directement transmise au propriétaire et à l'agent en charge.
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="prospectName" placeholder="Votre nom *" required />
                  <Input name="prospectPhone" placeholder="Téléphone *" required />
                </div>
                <Input
                  name="offeredAmountMinor"
                  type="number"
                  min="1"
                  placeholder={`Montant proposé en ${selectedListing.currency} *`}
                  required
                />
                <textarea
                  name="message"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Justification de votre offre ou conditions d’achat/location..."
                />
                <Button type="submit" disabled={offerMutation.isPending} className="w-full">
                  {offerMutation.isPending ? 'Transmission...' : 'Soumettre mon offre formelle'}
                </Button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
