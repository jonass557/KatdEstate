import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BackButton } from '../components/ui/back-button';
import {
  Building2,
  Home,
  MapPin,
  Phone,
  Search,
  Sparkles,
  X,
  Plus,
  MessageSquare,
  Lock,
  Compass,
  Smartphone,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { useSession } from '../app/session';
import { PublishListingModal } from '../components/marketplace/publish-listing-modal';

export interface MarketplaceListing {
  _id: string;
  title: string;
  description: string;
  category: string;
  propertyType: string;
  transactionType: 'SALE' | 'RENT';
  billingFrequency?: 'DAILY' | 'MONTHLY' | 'TOTAL';
  priceMinor: number;
  currency: string;
  location: {
    city: string;
    district?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  surfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  isTitled?: boolean;
  landTitleNumber?: string;
  isVerified?: boolean;
  photos?: Array<{ url: string; isPrimary?: boolean; caption?: string }>;
  contact?: {
    name?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
  };
  agentProfileId?: {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    agencyName?: string;
  };
}

export const CATEGORY_LABELS: Record<string, string> = {
  ALL: 'Toutes les offres',
  CHAMBRE_SIMPLE: 'Chambre simple',
  CHAMBRE_MODERNE: 'Chambre moderne',
  STUDIO_MODERNE: 'Studio moderne',
  APPARTEMENT: 'Appartement standard',
  APPARTEMENT_MEUBLE: 'Appartement meublé',
  STUDIO_MEUBLE_JOURNALIER: 'Studio meublé (Nuitée / Jour)',
  VILLA: 'Villa & Maison',
  LAND: 'Terrain / Foncier',
  COMMERCIAL: 'Bureau / Magasin',
};

const SEED_LISTINGS: MarketplaceListing[] = [
  {
    _id: 'seed-1',
    title: 'Studio Meublé Tout Confort — Climatisation & Wifi Fibre',
    description:
      'Magnifique studio meublé situé au cœur de la zone résidentielle. Idéal pour séjours d’affaires, vacances ou courtes durées. Cuisine équipée, chauffe-eau, ménage inclus et sécurité 24h/24.',
    category: 'STUDIO_MEUBLE_JOURNALIER',
    propertyType: 'STUDIO_MEUBLE_JOURNALIER',
    transactionType: 'RENT',
    billingFrequency: 'DAILY',
    priceMinor: 25000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Cocody Angré 7ème Tranche',
      address: 'Boulevard Latrille, Résidence Les Oliviers',
      latitude: 5.378941,
      longitude: -3.985612,
    },
    surfaceM2: 32,
    bedrooms: 1,
    bathrooms: 1,
    isVerified: true,
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
      },
      {
        url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: {
      name: 'M. Koffi N’Dri (Gestionnaire Agréé)',
      phone: '+225 07 48 12 34 56',
      whatsapp: '+2250748123456',
      email: 'contact@katdestate.immo',
    },
  },
  {
    _id: 'seed-2',
    title: 'Appartement Haut Standing 4 Pièces Meublé avec Vue Panoramique',
    description:
      'Superbe appartement 4 pièces meublé composé d’un vaste salon lumineux, 3 chambres autonomes, dressing, cuisine équipée avec buanderie et balcon filant. Parking sécurisé en sous-sol.',
    category: 'APPARTEMENT_MEUBLE',
    propertyType: 'APPARTEMENT_MEUBLE',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 750000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Marcory Zone 4',
      address: 'Rue Paul Langevin, Tour Ivoire',
      latitude: 5.298144,
      longitude: -3.989721,
    },
    surfaceM2: 145,
    bedrooms: 3,
    bathrooms: 3,
    isVerified: true,
    isTitled: true,
    landTitleNumber: 'TF-68421/ABJ',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: {
      name: 'SCI Diallo & Associés',
      phone: '+225 05 64 22 11 00',
      whatsapp: '+2250564221100',
      email: 'proprietaire@katdestate.immo',
    },
  },
  {
    _id: 'seed-3',
    title: 'Chambre Moderne Autonome avec Douche & Balcon Privatif',
    description:
      'Chambre moderne spacieuse dans un immeuble récent et propre. Douche et WC internes, placard intégré, carrelage blanc et compteur individuel CIE/SODECI. Quartier paisible et accessible.',
    category: 'CHAMBRE_MODERNE',
    propertyType: 'CHAMBRE_MODERNE',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 65000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Yopougon Niangon Sud',
      address: 'Carrefour Académie, Rue des Jardins',
      latitude: 5.341255,
      longitude: -4.089412,
    },
    surfaceM2: 20,
    bedrooms: 1,
    bathrooms: 1,
    isVerified: true,
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: {
      name: 'Mme Bakayoko Fatoumata',
      phone: '+225 01 02 03 04 05',
      whatsapp: '+2250102030405',
      email: 'contact@katdestate.immo',
    },
  },
  {
    _id: 'seed-4',
    title: 'Chambre Simple Aérée dans Cour Propre et Clôturée',
    description:
      'Chambre simple accessible, bien aérée avec plafondStaff, fenêtre vitrée avec moustiquaire. Eau courante dans la cour, toilette extérieure carrelée et sécurité nocturne assurée.',
    category: 'CHAMBRE_SIMPLE',
    propertyType: 'CHAMBRE_SIMPLE',
    transactionType: 'RENT',
    billingFrequency: 'MONTHLY',
    priceMinor: 35000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Abobo Baoulé',
      address: 'Proche Pharmacie du Rond-point',
      latitude: 5.412556,
      longitude: -4.015233,
    },
    surfaceM2: 16,
    bedrooms: 1,
    bathrooms: 1,
    isVerified: true,
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
    ],
    contact: {
      name: 'M. Yao Konan',
      phone: '+225 07 11 22 33 44',
      whatsapp: '+2250711223344',
      email: 'contact@katdestate.immo',
    },
  },
  {
    _id: 'seed-5',
    title: 'Superbe Villa Duplex 5 Pièces avec Jardin et Piscine',
    description:
      'Villa contemporaine d’architecte avec finitions de luxe. Grand salon double hauteur, suite parentale avec dressing et jacuzzi, cuisine américaine, garage 2 véhicules et groupe électrogène automatique.',
    category: 'VILLA',
    propertyType: 'VILLA',
    transactionType: 'SALE',
    billingFrequency: 'TOTAL',
    priceMinor: 285000000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Cocody Ambassades',
      address: 'Avenue Jacques Aka',
      latitude: 5.342112,
      longitude: -3.992544,
    },
    surfaceM2: 450,
    bedrooms: 4,
    bathrooms: 4,
    isVerified: true,
    isTitled: true,
    landTitleNumber: 'ACD-0145892-CI',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
      {
        url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      },
      {
        url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80',
      },
    ],
    contact: {
      name: 'Agence Immobilière Ivoire (Agréée KatdEstate)',
      phone: '+225 07 77 88 99 00',
      whatsapp: '+2250777889900',
      email: 'agent@katdestate.immo',
    },
  },
  {
    _id: 'seed-6',
    title: 'Terrain Foncier Borné 600 m² avec Approbation Ministérielle & Titre Foncier',
    description:
      'Parcelle viabilisée avec eau et électricité en bordure de voie bitumée. Idéal pour construction immédiate de villa duplex ou immeuble de rapport locatif. Acte coutumier visé par la chefferie.',
    category: 'LAND',
    propertyType: 'LAND',
    transactionType: 'SALE',
    billingFrequency: 'TOTAL',
    priceMinor: 48000000,
    currency: 'FCFA',
    location: {
      city: 'Abidjan',
      district: 'Riviera Palmeraie',
      address: 'Extension Rosiers 5',
      latitude: 5.368744,
      longitude: -3.954122,
    },
    surfaceM2: 600,
    isVerified: true,
    isTitled: true,
    landTitleNumber: 'TF-90412-RIVIERA',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80',
        isPrimary: true,
      },
    ],
    contact: {
      name: 'Chefferie Coutumière & M. Kouamé',
      phone: '+225 07 20 30 40 50',
      whatsapp: '+2250720304050',
      email: 'chef.quartier@katdestate.immo',
    },
  },
];

export function MarketplacePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useSession();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [transactionType, setTransactionType] = useState<string>('');
  const [selectedListing, setSelectedListing] = useState<MarketplaceListing | null>(null);
  const [activeTab, setActiveTab] = useState<'info' | 'map' | 'contact'>('info');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // Load custom listings published by owners/agents
  const customListings = useMemo<MarketplaceListing[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('katdestate_custom_listings') || '[]');
    } catch {
      return [];
    }
  }, [publishModalOpen]);

  // Combine custom listings + seed listings
  const allListings = useMemo(() => {
    return [...customListings, ...SEED_LISTINGS];
  }, [customListings]);

  // Filtering
  const filteredListings = useMemo(() => {
    return allListings.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (transactionType && item.transactionType !== transactionType) return false;
      if (city && !item.location.city.toLowerCase().includes(city.toLowerCase())) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesDistrict = (item.location.district || '').toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesDistrict) return false;
      }
      return true;
    });
  }, [allListings, selectedCategory, transactionType, city, search]);

  const handleProtectedContact = () => {
    if (!isAuthenticated) {
      setAuthPromptOpen(true);
    } else {
      setActiveTab('contact');
    }
  };

  const handleStartMessaging = (listing: MarketplaceListing) => {
    if (!isAuthenticated) {
      setAuthPromptOpen(true);
    } else {
      navigate(
        `/messages?target=${encodeURIComponent(listing.contact?.name || 'Bailleur')}&title=${encodeURIComponent(listing.title)}`,
      );
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* 1. Header Banner */}
      <div className="border-b border-border bg-card px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <BackButton to="/dashboard" label="Tableau de bord" />

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => setPublishModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Plus className="size-4" />
                <span>Publier une Annonce</span>
              </Button>
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 mb-2">
              <Sparkles className="size-3.5" />
              Marketplace Immobilière Nationale KatdEstate
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
              Chambres, Studios Meublés, Appartements & Terrains
            </h1>
            <p className="max-w-2xl text-xs sm:text-sm text-muted-foreground">
              Trouvez votre logement vérifié en location journalière, mensuelle ou vente définitive
              avec localisation GPS et contact direct.
            </p>
          </div>

          {/* Search Inputs */}
          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                className="pl-9 h-10 text-xs"
                placeholder="Rechercher (ex: studio, meublé, climatisé, Cocody...)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div>
              <Input
                className="h-10 text-xs"
                placeholder="Ville (ex: Abidjan, Yamoussoukro, Dakar...)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
              >
                <option value="">Tous types de contrat</option>
                <option value="RENT">Location (Journalière / Mensuelle)</option>
                <option value="SALE">Vente Définitive</option>
              </select>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 pt-2 scrollbar-none">
            {Object.entries(CATEGORY_LABELS).map(([catKey, catLabel]) => (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  selectedCategory === catKey
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border'
                }`}
              >
                {catLabel}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Listings Grid */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8 space-y-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filteredListings.length} bien(s) répertorié(s)</span>
          <span className="font-semibold text-emerald-500">
            Localisation GPS & Photos Vérifiées
          </span>
        </div>

        {filteredListings.length === 0 ? (
          <div className="p-12 rounded-3xl border border-dashed border-border text-center space-y-3 bg-card/40">
            <Building2 className="size-12 mx-auto text-muted-foreground/40" />
            <h3 className="text-base font-bold text-foreground">
              Aucun bien ne correspond à ces critères
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Essayez de sélectionner une autre catégorie ou réinitialisez vos filtres pour voir
              l'ensemble des logements.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch('');
                setCity('');
                setSelectedCategory('ALL');
                setTransactionType('');
              }}
            >
              Afficher toutes les offres
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredListings.map((item) => {
              const cover = item.photos?.find((p) => p.isPrimary)?.url || item.photos?.[0]?.url;
              const isDaily = item.billingFrequency === 'DAILY';

              return (
                <Card
                  key={item._id}
                  className="overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer border-border group flex flex-col justify-between rounded-3xl bg-card"
                  onClick={() => {
                    setSelectedListing(item);
                    setActiveTab('info');
                  }}
                >
                  <div>
                    {/* Image Cover */}
                    <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                      {cover ? (
                        <img
                          src={cover}
                          alt={item.title}
                          className="h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <Home className="size-10 opacity-30" />
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-slate-950/80 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-black uppercase text-white border border-white/20">
                          {CATEGORY_LABELS[item.category] || item.category}
                        </span>
                        {isDaily && (
                          <span className="rounded-full bg-amber-400 text-slate-950 px-2 py-0.5 text-[10px] font-black uppercase shadow-sm">
                            Nuitée
                          </span>
                        )}
                      </div>

                      {/* Photo counter */}
                      {item.photos && item.photos.length > 1 && (
                        <span className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          📷 {item.photos.length} photos
                        </span>
                      )}
                    </div>

                    {/* Body */}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <MapPin className="size-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">
                          {item.location.district ? `${item.location.district}, ` : ''}
                          {item.location.city}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-foreground line-clamp-2 leading-snug group-hover:text-emerald-500 transition-colors">
                        {item.title}
                      </h3>

                      <div className="pt-1">
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          {item.priceMinor.toLocaleString('fr-FR')} {item.currency}
                          <span className="text-xs font-normal text-muted-foreground">
                            {isDaily ? ' / jour' : item.transactionType === 'RENT' ? ' / mois' : ''}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-2 border-t border-border/60">
                        {item.surfaceM2 && <span>📐 {item.surfaceM2} m²</span>}
                        {item.bedrooms && <span>🛏️ {item.bedrooms} ch.</span>}
                        {item.bathrooms && <span>🚿 {item.bathrooms} sdb</span>}
                      </div>
                    </CardContent>
                  </div>

                  {/* Card Footer */}
                  <div className="bg-muted/30 px-4 py-3 border-t border-border/60 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground truncate max-w-[170px]">
                      {item.contact?.name || item.agentProfileId?.agencyName || 'Bailleur Vérifié'}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs font-bold rounded-lg border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                    >
                      Voir détails
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Detail Modal */}
      {selectedListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-card border border-border p-6 sm:p-8 shadow-2xl text-foreground">
            <button
              onClick={() => setSelectedListing(null)}
              className="absolute right-4 top-4 rounded-xl p-2 text-muted-foreground hover:bg-muted"
            >
              <X className="size-5" />
            </button>

            {/* Title & Badges */}
            <div className="space-y-3 pr-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 px-3 py-0.5 text-xs font-black uppercase">
                  {CATEGORY_LABELS[selectedListing.category] || selectedListing.category}
                </span>
                {selectedListing.billingFrequency === 'DAILY' && (
                  <span className="rounded-full bg-amber-400 text-slate-950 px-2.5 py-0.5 text-xs font-black uppercase">
                    Location Journalière
                  </span>
                )}
                {selectedListing.isTitled && (
                  <span className="rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2.5 py-0.5 text-xs font-bold">
                    Titre Foncier / ACD
                  </span>
                )}
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-foreground">
                {selectedListing.title}
              </h2>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                <MapPin className="size-4 text-emerald-500 shrink-0" />
                <span>
                  {selectedListing.location.district
                    ? `${selectedListing.location.district}, `
                    : ''}
                  {selectedListing.location.city}
                  {selectedListing.location.address ? ` — ${selectedListing.location.address}` : ''}
                </span>
              </div>

              <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {selectedListing.priceMinor.toLocaleString('fr-FR')} {selectedListing.currency}
                <span className="text-sm font-normal text-muted-foreground">
                  {selectedListing.billingFrequency === 'DAILY'
                    ? ' / nuitée'
                    : selectedListing.transactionType === 'RENT'
                      ? ' / mois'
                      : ''}
                </span>
              </p>
            </div>

            {/* Photo Gallery */}
            {selectedListing.photos && selectedListing.photos.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-hidden rounded-2xl">
                {selectedListing.photos.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.url}
                    alt={p.caption || `Photo ${idx + 1}`}
                    className="h-32 sm:h-40 w-full object-cover rounded-xl border border-border"
                  />
                ))}
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="mt-6 flex border-b border-border text-xs sm:text-sm font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === 'info'
                    ? 'border-emerald-500 text-emerald-500 font-bold'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                Caractéristiques & Description
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('map')}
                className={`px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === 'map'
                    ? 'border-emerald-500 text-emerald-500 font-bold'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                Carte & Localisation GPS
              </button>
              <button
                type="button"
                onClick={handleProtectedContact}
                className={`px-4 py-2.5 border-b-2 transition-colors ${
                  activeTab === 'contact'
                    ? 'border-emerald-500 text-emerald-500 font-bold'
                    : 'border-transparent text-muted-foreground'
                }`}
              >
                Contacter le Bailleur / Agent
              </button>
            </div>

            {/* Tab 1: Info */}
            {activeTab === 'info' && (
              <div className="mt-4 space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-4 rounded-2xl border border-border">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Superficie</span>
                    <strong className="text-foreground">
                      {selectedListing.surfaceM2 ? `${selectedListing.surfaceM2} m²` : '—'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Chambres</span>
                    <strong className="text-foreground">{selectedListing.bedrooms || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Salles d'eau</span>
                    <strong className="text-foreground">{selectedListing.bathrooms || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Disponibilité</span>
                    <strong className="text-emerald-500">Immédiate</strong>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Description du bien
                  </h4>
                  <p className="text-foreground leading-relaxed whitespace-pre-line bg-muted/20 p-4 rounded-2xl border border-border/60">
                    {selectedListing.description}
                  </p>
                </div>
              </div>
            )}

            {/* Tab 2: Map */}
            {activeTab === 'map' && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Compass className="size-4 text-emerald-500" />
                    Position GPS certifiée du bien
                  </span>
                  <span className="text-muted-foreground font-mono">
                    Lat: {selectedListing.location.latitude ?? 5.3599}, Long:{' '}
                    {selectedListing.location.longitude ?? -4.0082}
                  </span>
                </div>

                <div className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-border relative shadow-inner">
                  <iframe
                    title="Localisation réelle"
                    width="100%"
                    height="100%"
                    frameBorder="0"
                    scrolling="no"
                    marginHeight={0}
                    marginWidth={0}
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${(selectedListing.location.longitude || -4.0082) - 0.01}%2C${(selectedListing.location.latitude || 5.3599) - 0.01}%2C${(selectedListing.location.longitude || -4.0082) + 0.01}%2C${(selectedListing.location.latitude || 5.3599) + 0.01}&layer=mapnik&marker=${selectedListing.location.latitude || 5.3599}%2C${selectedListing.location.longitude || -4.0082}`}
                    className="w-full h-full"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Contact & Messaging */}
            {activeTab === 'contact' && (
              <div className="mt-4 space-y-4">
                {isAuthenticated ? (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold">
                        <CheckCircle2 className="size-6" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          {selectedListing.contact?.name ||
                            selectedListing.agentProfileId?.agencyName ||
                            'Propriétaire Direct'}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Annonceur certifié KatdEstate
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <a
                        href={`tel:${selectedListing.contact?.phone || selectedListing.agentProfileId?.phone}`}
                        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-card border border-border text-foreground font-bold text-xs hover:border-emerald-500 transition-colors shadow-sm"
                      >
                        <Phone className="size-4 text-emerald-500" />
                        <span>
                          Appeler :{' '}
                          {selectedListing.contact?.phone ||
                            selectedListing.agentProfileId?.phone ||
                            '+225 07 00 00 00 00'}
                        </span>
                      </a>

                      <a
                        href={`https://wa.me/${(selectedListing.contact?.whatsapp || selectedListing.contact?.phone || '').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Bonjour, je suis intéressé par votre bien "${selectedListing.title}" sur KatdEstate.`)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
                      >
                        <Smartphone className="size-4" />
                        <span>Contacter sur WhatsApp</span>
                      </a>
                    </div>

                    <div className="pt-2">
                      <Button
                        onClick={() => handleStartMessaging(selectedListing)}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-2"
                      >
                        <MessageSquare className="size-4" />
                        <span>Discuter via la Messagerie KatdEstate</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-purple-950/40 border border-purple-500/30 text-center space-y-3">
                    <Lock className="size-8 text-[#00e676] mx-auto" />
                    <h4 className="text-sm font-bold text-white">
                      Coordonnées Réservées aux Membres
                    </h4>
                    <p className="text-xs text-purple-200 max-w-md mx-auto">
                      Pour accéder au contact téléphonique, échanger par WhatsApp ou débuter une
                      conversation sur la messagerie de la plateforme, vous devez posséder un compte
                      KatdEstate.
                    </p>
                    <div className="flex justify-center gap-3 pt-2">
                      <Link
                        to="/register"
                        className="bg-[#00e676] hover:bg-[#00c853] text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl shadow-lg"
                      >
                        Créer un compte gratuit
                      </Link>
                      <Link
                        to="/sign-in"
                        className="bg-purple-900/60 hover:bg-purple-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl border border-purple-700/60"
                      >
                        Se connecter
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Quick Action CTAs */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedListing(null)}
                className="text-xs"
              >
                Fermer
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleStartMessaging(selectedListing)}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <MessageSquare className="size-4" />
                  <span>Messagerie</span>
                </Button>

                <Button
                  size="sm"
                  onClick={handleProtectedContact}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Phone className="size-4" />
                  <span>Voir Contact</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Auth Prompt Modal (When non-logged in visitor clicks contact/message) */}
      {authPromptOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#15042c] border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-md w-full space-y-5 shadow-2xl text-white text-center">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-[#00e676] border border-emerald-500/30 flex items-center justify-center mx-auto">
              <Lock className="size-6" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-black">Accès Direct au Bailleur</h3>
              <p className="text-xs text-purple-200">
                Créez votre compte en 30 secondes pour échanger en direct avec le
                propriétaire/agent, planifier une visite ou faire une offre.
              </p>
            </div>

            <div className="space-y-2.5 pt-2">
              <Link
                to="/register"
                className="w-full inline-flex items-center justify-center gap-2 bg-[#00e676] hover:bg-[#00c853] text-slate-950 font-black text-xs py-3 rounded-xl shadow-lg"
              >
                <span>Créer mon compte gratuit</span>
                <ArrowRight className="size-4" />
              </Link>

              <Link
                to="/sign-in"
                className="w-full inline-flex items-center justify-center bg-purple-950/60 hover:bg-purple-900/60 text-white font-bold text-xs py-3 rounded-xl border border-purple-700/60"
              >
                <span>J'ai déjà un compte • Se connecter</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setAuthPromptOpen(false)}
              className="text-xs text-purple-400 hover:text-white underline"
            >
              Continuer d'explorer les annonces
            </button>
          </div>
        </div>
      )}

      {/* 5. Publish Listing Modal */}
      <PublishListingModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onPublished={() => {
          toast({ title: 'Nouvelle annonce ajoutée à la marketplace !', variant: 'success' });
        }}
      />
    </div>
  );
}
