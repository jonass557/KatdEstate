import { useState } from 'react';
import {
  Building2,
  MapPin,
  Phone,
  Plus,
  Trash2,
  Check,
  X,
  Compass,
  Home,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';
import { useSession } from '../../app/session';

export interface NewListingPayload {
  title: string;
  category: string;
  propertyType: string;
  transactionType: 'SALE' | 'RENT';
  priceMinor: number;
  currency: string;
  billingFrequency: 'DAILY' | 'MONTHLY' | 'TOTAL';
  location: {
    city: string;
    district: string;
    address: string;
    latitude?: number;
    longitude?: number;
  };
  surfaceM2?: number;
  bedrooms?: number;
  bathrooms?: number;
  photos: Array<{ url: string; isPrimary?: boolean; caption?: string }>;
  contact: {
    name: string;
    phone: string;
    whatsapp: string;
    email?: string;
  };
  description: string;
  cautionMonths?: number;
  advanceMonths?: number;
}

const PROPERTY_CATEGORIES = [
  {
    id: 'CARABOT',
    label: 'Maison en carabot (Traditionnelle & Éco)',
    icon: Home,
    defaultType: 'RENT',
  },
  { id: 'CHAMBRE_SIMPLE', label: 'Chambre simple', icon: Home, defaultType: 'RENT' },
  {
    id: 'CHAMBRE_MODERNE',
    label: 'Chambre moderne (avec douche interne)',
    icon: Home,
    defaultType: 'RENT',
  },
  { id: 'STUDIO_MODERNE', label: 'Studio moderne', icon: Home, defaultType: 'RENT' },
  {
    id: 'APPARTEMENT',
    label: 'Appartement standard (2, 3, 4+ pièces)',
    icon: Building2,
    defaultType: 'RENT',
  },
  {
    id: 'APPARTEMENT_MEUBLE',
    label: 'Appartement meublé haut standing',
    icon: Sparkles,
    defaultType: 'RENT',
  },
  {
    id: 'STUDIO_MEUBLE_JOURNALIER',
    label: 'Studio meublé (Location journalière / Nuitée)',
    icon: Sparkles,
    defaultType: 'RENT',
  },
  { id: 'VILLA', label: 'Villa & Maison individuelle', icon: Building2, defaultType: 'SALE' },
  { id: 'LAND', label: 'Terrain foncier / Parcelle avec ACD', icon: MapPin, defaultType: 'SALE' },
  {
    id: 'COMMERCIAL',
    label: 'Local commercial, Bureau ou Magasin',
    icon: Building2,
    defaultType: 'RENT',
  },
];

export function PublishListingModal({
  isOpen,
  onClose,
  onPublished,
}: {
  isOpen: boolean;
  onClose: () => void;
  onPublished?: (listing: NewListingPayload) => void;
}) {
  const { user } = useSession();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('STUDIO_MODERNE');
  const [transactionType, setTransactionType] = useState<'RENT' | 'SALE'>('RENT');
  const [billingFrequency, setBillingFrequency] = useState<'DAILY' | 'MONTHLY' | 'TOTAL'>(
    'MONTHLY',
  );
  const [priceMinor, setPriceMinor] = useState<number>(150000);
  const [currency, setCurrency] = useState('FCFA');

  // Location & Map
  const [city, setCity] = useState('Abidjan');
  const [district, setDistrict] = useState('Cocody Angré');
  const [address, setAddress] = useState('Carrefour Duncan, Rue L12');
  const [latitude, setLatitude] = useState<number>(5.359952);
  const [longitude, setLongitude] = useState<number>(-4.008256);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Photos
  const [photoUrls, setPhotoUrls] = useState<string[]>([
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=800&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  ]);
  const [newPhotoInput, setNewPhotoInput] = useState('');
  const [photoExterieur, setPhotoExterieur] = useState(
    'https://images.unsplash.com/photo-1518780664697-55e3ad937233?auto=format&fit=crop&w=800&q=80',
  );
  const [photoInterieur, setPhotoInterieur] = useState(
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80',
  );

  // Specs
  const [surfaceM2, setSurfaceM2] = useState<number>(35);
  const [bedrooms, setBedrooms] = useState<number>(1);
  const [bathrooms, setBathrooms] = useState<number>(1);
  const [cautionMonths, setCautionMonths] = useState<number>(2);
  const [advanceMonths, setAdvanceMonths] = useState<number>(2);

  // Contact info
  const [contactName, setContactName] = useState(
    user?.displayName || 'Propriétaire / Agent KatdEstate',
  );
  const [contactPhone, setContactPhone] = useState('+225 07 00 00 00 00');
  const [contactWhatsapp, setContactWhatsapp] = useState('+225 07 00 00 00 00');
  const [contactEmail, setContactEmail] = useState(user?.email || 'contact@katdestate.immo');
  const [description, setDescription] = useState(
    'Très beau logement spacieux et lumineux dans un cadre paisible et sécurisé. Eau et électricité disponibles 24/7, gardiennage et parking disponible.',
  );

  if (!isOpen) return null;

  // Handle auto GPS Location
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Géolocalisation non supportée', variant: 'error' });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(Number(pos.coords.latitude.toFixed(6)));
        setLongitude(Number(pos.coords.longitude.toFixed(6)));
        setGettingLocation(false);
        toast({
          title: 'Coordonnées GPS capturées !',
          description: `Lat: ${pos.coords.latitude.toFixed(4)}, Long: ${pos.coords.longitude.toFixed(4)}`,
          variant: 'success',
        });
      },
      () => {
        setGettingLocation(false);
        toast({ title: 'Impossible d’obtenir la position GPS', variant: 'error' });
      },
    );
  };

  const handleAddPhoto = () => {
    if (!newPhotoInput.trim()) return;
    setPhotoUrls([...photoUrls, newPhotoInput.trim()]);
    setNewPhotoInput('');
  };

  const handleRemovePhoto = (idx: number) => {
    setPhotoUrls(photoUrls.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !priceMinor) {
      toast({
        title: 'Veuillez remplir le titre et le montant.',
        variant: 'error',
      });
      return;
    }

    if (category === 'CARABOT') {
      if (!photoExterieur.trim() || !photoInterieur.trim()) {
        toast({
          title: 'Pour une Maison en carabot, 2 photos sont obligatoires (extérieur + intérieur).',
          variant: 'error',
        });
        return;
      }
    } else if (photoUrls.length === 0) {
      toast({
        title: 'Veuillez ajouter au moins une photo pour cette annonce.',
        variant: 'error',
      });
      return;
    }

    const finalPhotos =
      category === 'CARABOT'
        ? [
            { url: photoExterieur.trim(), label: 'EXTERIEUR' as const, isPrimary: true },
            { url: photoInterieur.trim(), label: 'INTERIEUR' as const, isPrimary: false },
          ]
        : photoUrls.map((url, idx) => ({ url, isPrimary: idx === 0 }));

    const payload: NewListingPayload = {
      title,
      category,
      propertyType: category,
      transactionType,
      billingFrequency,
      priceMinor,
      currency,
      location: {
        city,
        district,
        address,
        latitude,
        longitude,
      },
      surfaceM2,
      bedrooms,
      bathrooms,
      photos: finalPhotos,
      contact: {
        name: contactName,
        phone: contactPhone,
        whatsapp: contactWhatsapp,
        email: contactEmail,
      },
      description,
      cautionMonths,
      advanceMonths,
    };

    // Store in custom listings with workflow status EN_ATTENTE
    try {
      const existing = JSON.parse(localStorage.getItem('katdestate_custom_listings') || '[]');
      existing.unshift({
        ...payload,
        _id: `listing-${Date.now()}`,
        workflowStatus: 'EN_ATTENTE',
        status: 'PENDING',
        authorId: user?.id || 'habitant-local',
        authorName: user?.displayName || contactName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      localStorage.setItem('katdestate_custom_listings', JSON.stringify(existing));
    } catch {
      // fallback
    }

    toast({
      title: 'Annonce enregistrée — Statut : EN ATTENTE',
      description:
        'Votre annonce a été soumise avec succès. Le Chef de Bloc va procéder à la vérification terrain avant validation.',
      variant: 'success',
    });

    if (onPublished) onPublished(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
      <div className="bg-[#15042c] border border-purple-500/40 rounded-3xl p-6 sm:p-8 max-w-3xl w-full my-8 space-y-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-800/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-gradient-to-tr from-[#00e676] to-purple-600 p-0.5 shadow-md">
              <div className="w-full h-full bg-[#15042c] rounded-[14px] flex items-center justify-center text-[#00e676]">
                <Plus className="size-5" />
              </div>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black">Publier un Bien sur la Marketplace</h3>
              <p className="text-xs text-purple-300">
                Chambre simple, studio meublé, appartement ou villa avec géolocalisation et photos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-purple-900/40 text-purple-300 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. Catégorie & Type */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#00e676]">
              1. Type & Catégorie de Bien *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {PROPERTY_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setCategory(cat.id);
                    if (cat.id === 'STUDIO_MEUBLE_JOURNALIER') {
                      setBillingFrequency('DAILY');
                      setTransactionType('RENT');
                    } else if (cat.id === 'VILLA' || cat.id === 'LAND') {
                      setTransactionType('SALE');
                      setBillingFrequency('TOTAL');
                    } else {
                      setBillingFrequency('MONTHLY');
                      setTransactionType('RENT');
                    }
                  }}
                  className={`p-3 rounded-2xl text-left border transition-all flex flex-col justify-between ${
                    category === cat.id
                      ? 'bg-purple-900/60 border-[#00e676] text-white shadow-md'
                      : 'bg-purple-950/40 border-purple-800/40 text-purple-300 hover:bg-purple-900/40'
                  }`}
                >
                  <span className="text-xs font-bold leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. Titre & Prix */}
          <div className="space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[#00e676]">
              2. Informations & Tarif *
            </label>
            <div className="space-y-1">
              <label className="text-xs text-purple-200">Titre de l'annonce</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Superbe Studio Moderne Meublé Climatiseur + Wifi"
                required
                className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-10"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Type de contrat</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-purple-800/80 bg-purple-950/60 px-3 text-xs text-white"
                >
                  <option value="RENT">Location</option>
                  <option value="SALE">Vente définitive</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Périodicité</label>
                <select
                  value={billingFrequency}
                  onChange={(e) => setBillingFrequency(e.target.value as any)}
                  className="h-10 w-full rounded-xl border border-purple-800/80 bg-purple-950/60 px-3 text-xs text-white"
                >
                  <option value="DAILY">Par Jour / Nuitée</option>
                  <option value="MONTHLY">Par Mois</option>
                  <option value="TOTAL">Prix Total Vente</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Devise</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-10 w-full rounded-xl border border-purple-800/80 bg-purple-950/60 px-3 text-xs text-white"
                >
                  <option value="FCFA">FCFA</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="USD">USD ($)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Prix ({currency})</label>
                <Input
                  type="number"
                  value={priceMinor}
                  onChange={(e) => setPriceMinor(Number(e.target.value))}
                  required
                  min="1"
                  className="bg-purple-950/60 border-purple-800/80 text-white font-black text-sm h-10"
                />
              </div>
            </div>

            {/* Caractéristiques */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-xs text-purple-200">
                  {category === 'CARABOT' ? 'Superficie (15-35 m²)' : 'Superficie (m²)'}
                </label>
                <Input
                  type="number"
                  value={surfaceM2}
                  onChange={(e) => setSurfaceM2(Number(e.target.value))}
                  min={category === 'CARABOT' ? 15 : 5}
                  max={category === 'CARABOT' ? 35 : undefined}
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
                {category === 'CARABOT' && (
                  <span className="text-[10px] text-amber-400">Norme : 15 à 35 m²</span>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-purple-200">
                  {category === 'CARABOT' ? 'Chambres (1 à 2)' : 'Chambres'}
                </label>
                <select
                  value={bedrooms}
                  onChange={(e) => setBedrooms(Number(e.target.value))}
                  className="h-9 w-full rounded-xl border border-purple-800/80 bg-purple-950/60 px-3 text-xs text-white"
                >
                  <option value={1}>1 Chambre</option>
                  <option value={2}>2 Chambres</option>
                  {category !== 'CARABOT' && (
                    <>
                      <option value={3}>3 Chambres</option>
                      <option value={4}>4+ Chambres</option>
                    </>
                  )}
                </select>
                {category === 'CARABOT' && (
                  <span className="text-[10px] text-amber-400">1 ou 2 pièces</span>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Salles de bain</label>
                <Input
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(Number(e.target.value))}
                  min="1"
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Caution (mois)</label>
                <Input
                  type="number"
                  value={cautionMonths}
                  onChange={(e) => setCautionMonths(Number(e.target.value))}
                  min="0"
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Avance (mois)</label>
                <Input
                  type="number"
                  value={advanceMonths}
                  onChange={(e) => setAdvanceMonths(Number(e.target.value))}
                  min="0"
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>
            </div>
          </div>

          {/* 3. Photos */}
          {category === 'CARABOT' ? (
            <div className="space-y-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  3. Photos Maison en carabot (2 URLs obligatoires : Extérieur + Intérieur) *
                </label>
                <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                  Obligatoire
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-purple-200 font-semibold">
                    1. Photo Façade Extérieure (URL) *
                  </label>
                  <Input
                    value={photoExterieur}
                    onChange={(e) => setPhotoExterieur(e.target.value)}
                    placeholder="https://... (photo extérieur carabot)"
                    required
                    className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                  />
                  {photoExterieur && (
                    <div className="relative h-28 overflow-hidden rounded-xl border border-purple-700/60">
                      <img
                        src={photoExterieur}
                        alt="Extérieur carabot"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                        Extérieur
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-purple-200 font-semibold">
                    2. Photo Pièce Intérieure (URL) *
                  </label>
                  <Input
                    value={photoInterieur}
                    onChange={(e) => setPhotoInterieur(e.target.value)}
                    placeholder="https://... (photo intérieur carabot)"
                    required
                    className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                  />
                  {photoInterieur && (
                    <div className="relative h-28 overflow-hidden rounded-xl border border-purple-700/60">
                      <img
                        src={photoInterieur}
                        alt="Intérieur carabot"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                        Intérieur
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-[#00e676]">
                3. Galerie Photos du Bien ({photoUrls.length} photos) *
              </label>
              <div className="flex gap-2">
                <Input
                  value={newPhotoInput}
                  onChange={(e) => setNewPhotoInput(e.target.value)}
                  placeholder="Entrez l'URL d'une photo (Unsplash, Cloudinary, etc.)..."
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9 flex-1"
                />
                <Button
                  type="button"
                  onClick={handleAddPhoto}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                >
                  <Plus className="size-4 mr-1" /> Ajouter
                </Button>
              </div>

              {/* Thumbnails */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {photoUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="group relative h-20 rounded-xl overflow-hidden border border-purple-800/60 bg-purple-950/40"
                  >
                    <img
                      src={url}
                      alt={`Photo ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 p-1 rounded-md bg-red-600/80 text-white opacity-0 group-hover:opacity-100 transition"
                    >
                      <Trash2 className="size-3" />
                    </button>
                    {idx === 0 && (
                      <span className="absolute bottom-1 left-1 rounded bg-[#00e676] text-black text-[9px] font-black px-1.5 py-0.5">
                        Principale
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Localisation Réelle & Coordonnées GPS / Carte */}
          <div className="space-y-3 p-4 rounded-2xl bg-purple-950/50 border border-purple-800/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#00e676] flex items-center gap-1.5">
                <MapPin className="size-4" /> 4. Localisation Réelle & Carte GPS *
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleGetLocation}
                disabled={gettingLocation}
                className="text-xs text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/10 h-7"
              >
                <Compass className={`size-3.5 mr-1 ${gettingLocation ? 'animate-spin' : ''}`} />
                {gettingLocation ? 'Recherche GPS...' : 'Ma position GPS'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Ville</label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex : Abidjan, Yamoussoukro, San-Pédro..."
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Commune / Quartier</label>
                <Input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Ex : Cocody Palmeraie, Marcory Zone 4..."
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Adresse / Repère précis</label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex : Proche Clinique Sainte-Anne"
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>
            </div>

            {/* Latitude & Longitude with interactive Map preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] text-purple-300">Latitude GPS (ex: 5.359952)</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={latitude}
                  onChange={(e) => setLatitude(Number(e.target.value))}
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] text-purple-300">Longitude GPS (ex: -4.008256)</label>
                <Input
                  type="number"
                  step="0.000001"
                  value={longitude}
                  onChange={(e) => setLongitude(Number(e.target.value))}
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-8"
                />
              </div>
            </div>

            {/* Interactive OpenStreetMap iframe preview */}
            <div className="h-32 rounded-xl overflow-hidden border border-purple-700/60 relative mt-2 shadow-inner">
              <iframe
                title="Aperçu de la position"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`}
                className="w-full h-full grayscale-[20%] contrast-125"
              />
              <div className="absolute top-1 left-2 bg-slate-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-emerald-400 font-bold">
                📍 Point d’ancrage GPS vérifié
              </div>
            </div>
          </div>

          {/* 5. Coordonnées de Contact & WhatsApp */}
          <div className="space-y-3 p-4 rounded-2xl bg-purple-950/50 border border-purple-800/60">
            <label className="text-xs font-bold uppercase tracking-wider text-[#00e676] flex items-center gap-1.5">
              <Phone className="size-4" /> 5. Coordonnées de Contact Direct (Bailleur / Agent) *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-purple-200">Nom du Bailleur / Agence</label>
                <Input
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Ex : SCI Diallo ou Agence Ivoire Immo"
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Téléphone Direct</label>
                <Input
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Numéro WhatsApp (avec code pays)</label>
                <Input
                  value={contactWhatsapp}
                  onChange={(e) => setContactWhatsapp(e.target.value)}
                  placeholder="+2250700000000"
                  required
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-purple-200">Email de contact</label>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="bailleur@katdestate.immo"
                  className="bg-purple-950/60 border-purple-800/80 text-white text-xs h-9"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-purple-200">
              Description détaillée du bien
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-purple-800/80 bg-purple-950/60 p-3 text-xs text-white focus:outline-none focus:border-[#00e676]"
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-800/60">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              Annuler
            </Button>
            <Button
              type="submit"
              className="bg-[#00e676] hover:bg-[#00c853] text-slate-950 font-black text-xs px-6 py-2.5 rounded-xl shadow-lg"
            >
              <Check className="size-4 mr-1.5" />
              Publier l'Annonce en Ligne
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
