import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  Compass,
  DollarSign,
  Edit2,
  Eye,
  Hotel,
  ImagePlus,
  LayoutDashboard,
  LocateFixed,
  Mail,
  MapPin,
  Phone,
  Plus,
  Power,
  Search,
  Settings,
  Sparkles,
  Star,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import { useSession } from '../../app/session';
import { apiRequest } from '../../lib/api-client';
import { getPreciseUserLocation } from '../../lib/geo/geolocation-helper';
import { reverseGeocodeWithNominatim } from '../../lib/geo/nominatim-geocoder';
import { GeoMapCanvas } from '../geo/GeoMapCanvas';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';

export type EstablishmentType =
  | 'HOTEL'
  | 'MOTEL'
  | 'HOSTEL'
  | 'RESIDENCE'
  | 'FURNISHED_APARTMENT';

export type EstablishmentStatus = 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE' | 'ARCHIVED';

export interface EstablishmentPhoto {
  url: string;
  publicId?: string | undefined;
  isPrimary?: boolean | undefined;
}

export interface HotelEstablishmentRecord {
  _id: string;
  name: string;
  type: EstablishmentType;
  stars?: number | undefined;
  description?: string | undefined;
  address: string;
  city: string;
  country: string;
  phone?: string | undefined;
  email?: string | undefined;
  latitude?: number | undefined;
  longitude?: number | undefined;
  photos: EstablishmentPhoto[];
  amenities: string[];
  status: EstablishmentStatus;
  totalRooms: number;
  occupiedRooms: number;
  estimatedMonthlyRevenue: number;
  currency: string;
  createdAt?: string | undefined;
}

const ESTABLISHMENT_TYPE_LABELS: Record<EstablishmentType, string> = {
  HOTEL: 'Hôtel',
  MOTEL: 'Motel',
  HOSTEL: 'Auberge',
  RESIDENCE: 'Résidence',
  FURNISHED_APARTMENT: 'Appartement meublé',
};

const ESTABLISHMENT_STATUS_META: Record<
  EstablishmentStatus,
  { label: string; badgeClass: string }
> = {
  ACTIVE: {
    label: 'Actif',
    badgeClass: 'bg-emerald-500 text-white shadow-sm',
  },
  MAINTENANCE: {
    label: 'En maintenance',
    badgeClass: 'bg-rose-500 text-white shadow-sm',
  },
  INACTIVE: {
    label: 'Désactivé',
    badgeClass: 'bg-slate-600 text-white shadow-sm',
  },
  ARCHIVED: {
    label: 'Archivé',
    badgeClass: 'bg-amber-500 text-slate-950 shadow-sm',
  },
};

const DEFAULT_AMENITIES = [
  'Wi-Fi Fibre',
  'Piscine',
  'Parking sécurisé',
  'Climatisation',
  'Restaurant',
  'Bar / Lounge',
  'Spa & Bien-être',
  'Salle de sport',
  'Navette aéroport',
  'Réception 24h/24',
  'Groupe électrogène',
  'Blanchisserie',
  'Salle de conférence',
];

const ACTIVE_ESTABLISHMENT_KEY = 'katdestate_active_hotel_establishment_id';

function localStorageKey(email?: string) {
  return `katdestate_hotel_establishments_${(email || 'default').trim().toLowerCase()}`;
}

function readLocalEstablishments(email?: string): HotelEstablishmentRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(localStorageKey(email));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalEstablishments(items: HotelEstablishmentRecord[], email?: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(localStorageKey(email), JSON.stringify(items));
  } catch {
    // ignore quota error
  }
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1000;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          resolve(String(reader.result || ''));
        }
      };
      img.onerror = () => resolve(String(reader.result || ''));
      img.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

type SidebarSection = 'overview' | 'list' | 'settings' | 'subscription';

export function EstablishmentsManager() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const orgId = memberships?.[0]?.organizationId;

  const [sidebarTab, setSidebarTab] = useState<SidebarSection>('list');
  const [establishments, setEstablishments] = useState<HotelEstablishmentRecord[]>(() =>
    readLocalEstablishments(user?.email),
  );
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ACTIVE_ESTABLISHMENT_KEY) || '';
  });

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HotelEstablishmentRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<HotelEstablishmentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [type, setType] = useState<EstablishmentType>('HOTEL');
  const [stars, setStars] = useState(4);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('Côte d’Ivoire');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [photos, setPhotos] = useState<EstablishmentPhoto[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [customAmenity, setCustomAmenity] = useState('');
  const [totalRooms, setTotalRooms] = useState<number>(0);
  const [occupiedRooms, setOccupiedRooms] = useState<number>(0);
  const [estimatedMonthlyRevenue, setEstimatedMonthlyRevenue] = useState<number>(0);
  const [currency, setCurrency] = useState('FCFA');

  // Load establishments from backend (multi-tenant) with local sync
  const fetchEstablishments = async () => {
    if (!orgId) {
      setEstablishments(readLocalEstablishments(user?.email));
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<HotelEstablishmentRecord[]>(
        `/organizations/${orgId}/establishments`,
      );
      if (Array.isArray(res)) {
        setEstablishments(res);
        writeLocalEstablishments(res, user?.email);
        if (res.length > 0 && !res.some((e) => e._id === activeId)) {
          setActiveId(res[0]!._id);
          localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, res[0]!._id);
        }
      }
    } catch {
      const local = readLocalEstablishments(user?.email);
      setEstablishments(local);
      if (local.length > 0 && !local.some((e) => e._id === activeId)) {
        setActiveId(local[0]!._id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchEstablishments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, user?.email]);

  const handleSelectActive = (id: string) => {
    setActiveId(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, id);
    }
    const found = establishments.find((e) => e._id === id);
    if (found) {
      toast({
        title: `Établissement actif : ${found.name}`,
        description: `${found.city}, ${found.country}`,
        variant: 'info',
      });
    }
  };

  const activeEstablishment = useMemo(
    () => establishments.find((e) => e._id === activeId) || establishments[0] || null,
    [establishments, activeId],
  );

  const stats = useMemo(() => {
    return establishments.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'ACTIVE') acc.active += 1;
        else if (item.status === 'MAINTENANCE') acc.maintenance += 1;
        else if (item.status === 'INACTIVE') acc.inactive += 1;
        else if (item.status === 'ARCHIVED') acc.archived += 1;
        acc.totalRooms += item.totalRooms || 0;
        acc.occupiedRooms += item.occupiedRooms || 0;
        acc.estimatedRevenue += item.estimatedMonthlyRevenue || 0;
        return acc;
      },
      {
        total: 0,
        active: 0,
        maintenance: 0,
        inactive: 0,
        archived: 0,
        totalRooms: 0,
        occupiedRooms: 0,
        estimatedRevenue: 0,
      },
    );
  }, [establishments]);

  const filteredEstablishments = useMemo(() => {
    return establishments.filter((item) => {
      if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
      if (filterType !== 'ALL' && item.type !== filterType) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          item.name.toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q) ||
          item.country.toLowerCase().includes(q) ||
          item.address.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [establishments, filterStatus, filterType, search]);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setType('HOTEL');
    setStars(4);
    setDescription('');
    setAddress('');
    setCity('');
    setCountry('Côte d’Ivoire');
    setPhone('');
    setEmail(user?.email || '');
    setLatitude(undefined);
    setLongitude(undefined);
    setPhotos([]);
    setAmenities(['Wi-Fi Fibre', 'Climatisation', 'Réception 24h/24']);
    setCustomAmenity('');
    setTotalRooms(0);
    setOccupiedRooms(0);
    setEstimatedMonthlyRevenue(0);
    setCurrency('FCFA');
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (item: HotelEstablishmentRecord) => {
    setEditing(item);
    setName(item.name);
    setType(item.type);
    setStars(item.stars ?? 3);
    setDescription(item.description || '');
    setAddress(item.address);
    setCity(item.city);
    setCountry(item.country);
    setPhone(item.phone || '');
    setEmail(item.email || '');
    setLatitude(item.latitude);
    setLongitude(item.longitude);
    setPhotos(item.photos || []);
    setAmenities(item.amenities || []);
    setTotalRooms(item.totalRooms || 0);
    setOccupiedRooms(item.occupiedRooms || 0);
    setEstimatedMonthlyRevenue(item.estimatedMonthlyRevenue || 0);
    setCurrency(item.currency || 'FCFA');
    setFormOpen(true);
  };

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingPhotos(true);
    try {
      const compressed: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue;
        compressed.push(await compressImageFile(file));
      }
      if (compressed.length === 0) return;

      if (orgId) {
        try {
          const uploaded = await apiRequest<EstablishmentPhoto[]>(
            `/organizations/${orgId}/establishments/upload-photos`,
            {
              method: 'POST',
              body: { photos: compressed },
            },
          );
          if (Array.isArray(uploaded) && uploaded.length > 0) {
            setPhotos((prev) => [
              ...prev,
              ...uploaded.map((u, idx) => ({
                ...u,
                isPrimary: prev.length === 0 && idx === 0,
              })),
            ]);
            toast({
              title: `${uploaded.length} photo(s) téléversée(s) via Cloudinary !`,
              variant: 'success',
            });
            return;
          }
        } catch {
          // fallback below
        }
      }

      setPhotos((prev) => [
        ...prev,
        ...compressed.map((url, idx) => ({
          url,
          isPrimary: prev.length === 0 && idx === 0,
        })),
      ]);
      toast({
        title: `${compressed.length} photo(s) ajoutée(s) !`,
        variant: 'success',
      });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleLocateGps = async () => {
    setLocatingGps(true);
    try {
      const loc = await getPreciseUserLocation({ requireRealGps: true });
      setLatitude(loc.lat);
      setLongitude(loc.lng);
      try {
        const geo = await reverseGeocodeWithNominatim(loc.lat, loc.lng);
        if (geo?.address && !address) setAddress(geo.address);
        if (geo?.city && !city) setCity(geo.city);
      } catch {
        // ignore geocode failure
      }
      toast({
        title: 'Position GPS capturée !',
        description: `Lat: ${loc.lat.toFixed(5)}, Lng: ${loc.lng.toFixed(5)}`,
        variant: 'success',
      });
    } catch (err: any) {
      toast({
        title: err?.message || 'Impossible de récupérer la position GPS réelle.',
        variant: 'error',
      });
    } finally {
      setLocatingGps(false);
    }
  };

  const toggleAmenity = (label: string) => {
    setAmenities((prev) =>
      prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label],
    );
  };

  const handleAddCustomAmenity = () => {
    const trimmed = customAmenity.trim();
    if (!trimmed) return;
    if (!amenities.includes(trimmed)) {
      setAmenities((prev) => [...prev, trimmed]);
    }
    setCustomAmenity('');
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !city.trim() || !country.trim()) {
      toast({
        title: 'Veuillez renseigner le nom, l’adresse, la ville et le pays.',
        variant: 'error',
      });
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      type,
      stars,
      description: description.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      phone: phone.trim(),
      email: email.trim(),
      latitude,
      longitude,
      photos,
      amenities,
      totalRooms: Number(totalRooms) || 0,
      occupiedRooms: Number(occupiedRooms) || 0,
      estimatedMonthlyRevenue: Number(estimatedMonthlyRevenue) || 0,
      currency,
    };

    try {
      let saved: HotelEstablishmentRecord | null = null;
      if (orgId) {
        try {
          if (editing) {
            saved = await apiRequest<HotelEstablishmentRecord>(
              `/organizations/${orgId}/establishments/${editing._id}`,
              { method: 'PATCH', body: payload },
            );
          } else {
            saved = await apiRequest<HotelEstablishmentRecord>(
              `/organizations/${orgId}/establishments`,
              { method: 'POST', body: payload },
            );
          }
        } catch {
          // Local fallback when API offline / local session
        }
      }

      if (!saved) {
        saved = {
          _id: editing?._id || `est-${Date.now()}`,
          ...payload,
          status: editing?.status || 'ACTIVE',
          createdAt: editing?.createdAt || new Date().toISOString(),
        };
      }

      setEstablishments((prev) => {
        const next = editing
          ? prev.map((item) => (item._id === saved!._id ? saved! : item))
          : [saved!, ...prev];
        writeLocalEstablishments(next, user?.email);
        return next;
      });

      if (!activeId || !editing) {
        setActiveId(saved._id);
        localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, saved._id);
      }

      toast({
        title: editing
          ? 'Établissement mis à jour avec succès !'
          : 'Nouvel établissement créé avec succès !',
        variant: 'success',
      });
      setFormOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleChangeStatus = async (item: HotelEstablishmentRecord, status: EstablishmentStatus) => {
    if (orgId) {
      try {
        await apiRequest(`/organizations/${orgId}/establishments/${item._id}/status`, {
          method: 'PATCH',
          body: { status },
        });
      } catch {
        // local update fallback
      }
    }
    setEstablishments((prev) => {
      const next = prev.map((e) => (e._id === item._id ? { ...e, status } : e));
      writeLocalEstablishments(next, user?.email);
      return next;
    });
    toast({
      title: `Statut mis à jour : ${ESTABLISHMENT_STATUS_META[status].label}`,
      variant: 'success',
    });
  };

  const handleDelete = async (item: HotelEstablishmentRecord) => {
    if (orgId) {
      try {
        await apiRequest(`/organizations/${orgId}/establishments/${item._id}`, {
          method: 'DELETE',
        });
      } catch {
        // local delete fallback
      }
    }
    setEstablishments((prev) => {
      const next = prev.filter((e) => e._id !== item._id);
      writeLocalEstablishments(next, user?.email);
      if (activeId === item._id) {
        const nextId = next[0]?._id || '';
        setActiveId(nextId);
        localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, nextId);
      }
      return next;
    });
    if (detailTarget?._id === item._id) setDetailTarget(null);
    toast({ title: 'Établissement supprimé.', variant: 'info' });
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row min-h-[680px]">
      {/* Sidebar Bleu Nuit fidèle à la maquette KadtEstate */}
      <aside className="w-full lg:w-64 bg-[#0B1E40] text-white flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="size-9 rounded-xl bg-white text-[#0B1E40] flex items-center justify-center font-black text-lg shadow">
              K
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight block leading-none">
                KadtEstate
              </span>
              <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold">
                Hôtellerie
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1.5 text-sm">
            <button
              type="button"
              onClick={() => setSidebarTab('overview')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                sidebarTab === 'overview'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span>Vue générale</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('list')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                sidebarTab === 'list'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Hotel className="size-4 shrink-0" />
              <span>Mes établissements</span>
            </button>

            <button
              type="button"
              onClick={openCreateForm}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Plus className="size-4 shrink-0" />
              <span>Ajouter un établissement</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('settings')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                sidebarTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Settings className="size-4 shrink-0" />
              <span>Paramètres</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarTab('subscription')}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium transition-all ${
                sidebarTab === 'subscription'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-blue-100/80 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Sparkles className="size-4 shrink-0" />
              <span>Mon abonnement</span>
            </button>
          </nav>
        </div>

        {/* Sélecteur rapide d'établissement actif dans la sidebar */}
        {establishments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/15 space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-200/70 px-1 block">
              Établissement actif
            </span>
            <select
              value={activeEstablishment?._id || ''}
              onChange={(e) => handleSelectActive(e.target.value)}
              className="w-full h-9 rounded-xl bg-white/10 border border-white/20 px-2.5 text-xs font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {establishments.map((est) => (
                <option key={est._id} value={est._id} className="text-slate-900">
                  {est.name} ({est.city})
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Top Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Mes établissements
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Gérez vos hôtels, motels, auberges, résidences et appartements meublés
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {establishments.length > 1 && (
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Building2 className="size-4 text-blue-600" />
                <select
                  aria-label="Changer d'établissement"
                  value={activeEstablishment?._id || ''}
                  onChange={(e) => handleSelectActive(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none"
                >
                  {establishments.map((est) => (
                    <option key={est._id} value={est._id} className="text-slate-900">
                      {est.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <div className="size-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                {(user?.displayName || 'A').slice(0, 1).toUpperCase()}
              </div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                {user?.displayName || 'Propriétaire'}
              </span>
            </div>

            <Button
              onClick={openCreateForm}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 gap-1.5"
            >
              <Plus className="size-4" />
              <span>Ajouter un établissement</span>
            </Button>
          </div>
        </header>

        {/* Body */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* 4 KPI Cards fidèles à l'image de référence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {stats.total}
                  </p>
                  <p className="text-xs font-medium text-slate-500">Total établissements</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {stats.active}
                  </p>
                  <p className="text-xs font-medium text-slate-500">Actifs</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-rose-200/70 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-rose-100 dark:bg-rose-500/20 text-rose-600 flex items-center justify-center shrink-0">
                  <Wrench className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {stats.maintenance}
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    En maintenance
                    {(stats.inactive > 0 || stats.archived > 0) &&
                      ` • ${stats.inactive + stats.archived} inactifs/archivés`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                  <DollarSign className="size-6" />
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-900 dark:text-white leading-tight">
                    {stats.estimatedRevenue.toLocaleString('fr-FR')}{' '}
                    <span className="text-xs font-bold text-slate-500">
                      {activeEstablishment?.currency || 'FCFA'}
                    </span>
                  </p>
                  <p className="text-xs font-medium text-slate-500">
                    Revenus estimés • {stats.totalRooms} chambres
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {sidebarTab === 'overview' && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <MapPin className="size-4 text-blue-600" />
                  Carte des établissements géolocalisés
                </h3>
                <span className="text-xs text-slate-500">
                  {establishments.filter((e) => typeof e.latitude === 'number').length} localisé(s)
                </span>
              </div>
              <GeoMapCanvas
                title="Localisation de vos établissements"
                subtitle="Cliquez sur un marqueur pour consulter les informations de l'établissement"
                heightClassName="h-[380px]"
                markers={establishments
                  .filter(
                    (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number',
                  )
                  .map((e) => ({
                    id: e._id,
                    level: 'PROPERTY' as const,
                    title: e.name,
                    subtitle: `${e.address} — ${e.city}, ${e.country}`,
                    position: { lat: e.latitude!, lng: e.longitude! },
                    color: e.status === 'ACTIVE' ? '#2563eb' : '#e11d48',
                    propertyDetails: {
                      propertyId: e._id,
                      name: e.name,
                      type: ESTABLISHMENT_TYPE_LABELS[e.type],
                      address: e.address,
                      city: e.city,
                      country: e.country,
                      roomsCount: e.totalRooms,
                      status: ESTABLISHMENT_STATUS_META[e.status].label,
                      photoUrl: e.photos?.[0]?.url,
                      priceMinor: e.estimatedMonthlyRevenue,
                      currency: e.currency,
                    },
                  }))}
              />
            </Card>
          )}

          {sidebarTab === 'settings' && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Paramètres de l’établissement actif
              </h3>
              {activeEstablishment ? (
                <div className="grid sm:grid-cols-2 gap-4 text-sm">
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <p className="text-xs text-slate-500">Établissement sélectionné</p>
                    <p className="font-bold text-slate-900 dark:text-white">
                      {activeEstablishment.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {activeEstablishment.address}, {activeEstablishment.city},{' '}
                      {activeEstablishment.country}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Actions rapides</p>
                      <p className="font-semibold text-xs text-slate-700 dark:text-slate-300">
                        Statut : {ESTABLISHMENT_STATUS_META[activeEstablishment.status].label}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openEditForm(activeEstablishment)}>
                      Modifier la fiche
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucun établissement enregistré. Créez votre premier établissement pour configurer ses paramètres.
                </p>
              )}
            </Card>
          )}

          {sidebarTab === 'subscription' && (
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="size-5 text-blue-600" />
                Mon abonnement Hôtellerie KadtEstate
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Gestion multi-établissements illimitée active pour votre compte propriétaire.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold border border-emerald-500/20">
                <CheckCircle2 className="size-4" />
                Compte Hôtelier Actif ({stats.total} établissement(s) enregistré(s))
              </div>
            </Card>
          )}

          {/* Filter Bar & Cards Grid */}
          {(sidebarTab === 'list' || sidebarTab === 'overview') && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher par nom, ville, pays..."
                    className="pl-9 bg-white dark:bg-slate-900 rounded-xl"
                  />
                </div>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Tous les types</option>
                  {Object.entries(ESTABLISHMENT_TYPE_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <option value="ALL">Tous les statuts</option>
                  {Object.entries(ESTABLISHMENT_STATUS_META).map(([key, meta]) => (
                    <option key={key} value={key}>
                      {meta.label}
                    </option>
                  ))}
                </select>
              </div>

              {loading && establishments.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Chargement de vos établissements…
                </div>
              ) : filteredEstablishments.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <CardContent className="p-10 text-center space-y-3">
                    <div className="mx-auto size-12 rounded-2xl bg-blue-50 dark:bg-blue-500/15 text-blue-600 flex items-center justify-center">
                      <Hotel className="size-6" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Aucun établissement trouvé
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Créez votre premier hôtel, motel, auberge, résidence ou appartement meublé pour commencer la gestion.
                    </p>
                    <Button
                      onClick={openCreateForm}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl gap-1.5"
                    >
                      <Plus className="size-4" />
                      Ajouter un établissement
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredEstablishments.map((item) => {
                    const statusMeta = ESTABLISHMENT_STATUS_META[item.status];
                    const isSelected = activeEstablishment?._id === item._id;
                    const primaryPhoto = item.photos?.[0]?.url;
                    const occupancyRate =
                      item.totalRooms > 0
                        ? Math.round(((item.occupiedRooms || 0) / item.totalRooms) * 100)
                        : 0;

                    return (
                      <Card
                        key={item._id}
                        className={`overflow-hidden bg-white dark:bg-slate-900 transition-all hover:shadow-lg flex flex-col ${
                          isSelected
                            ? 'ring-2 ring-blue-600 border-blue-600'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Image Header */}
                        <div className="relative h-44 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          {primaryPhoto ? (
                            <img
                              src={primaryPhoto}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                              <Hotel className="size-10" />
                              <span className="text-[11px] font-medium">Aucune photo</span>
                            </div>
                          )}

                          <span
                            className={`absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>

                          <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/75 text-white backdrop-blur-sm">
                            {ESTABLISHMENT_TYPE_LABELS[item.type]}
                          </span>

                          <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
                            {item.photos?.length > 1 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-white">
                                📷 {item.photos.length}
                              </span>
                            )}
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500 text-white shadow">
                              {item.totalRooms} ch.
                            </span>
                          </div>
                        </div>

                        {/* Body */}
                        <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-3">
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-bold text-base text-slate-900 dark:text-white line-clamp-1">
                                {item.name}
                              </h3>
                              {item.stars ? (
                                <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-500 shrink-0">
                                  <Star className="size-3.5 fill-amber-400 text-amber-400" />
                                  {item.stars}
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-slate-500 flex items-center gap-1 truncate">
                              <MapPin className="size-3.5 text-blue-600 shrink-0" />
                              <span>
                                {item.city}, {item.country}
                              </span>
                            </p>
                            {item.amenities?.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {item.amenities.slice(0, 3).map((a) => (
                                  <span
                                    key={a}
                                    className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                                  >
                                    {a}
                                  </span>
                                ))}
                                {item.amenities.length > 3 && (
                                  <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-500">
                                    +{item.amenities.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Mini Stats */}
                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-[11px]">
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1.5">
                              <span className="block text-slate-400 text-[10px]">Chambres</span>
                              <strong className="text-slate-800 dark:text-white">
                                {item.totalRooms}
                              </strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1.5">
                              <span className="block text-slate-400 text-[10px]">Occupation</span>
                              <strong className="text-emerald-600">{occupancyRate}%</strong>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-1.5">
                              <span className="block text-slate-400 text-[10px]">Revenus</span>
                              <strong className="text-blue-600 truncate block">
                                {item.estimatedMonthlyRevenue.toLocaleString('fr-FR')}
                              </strong>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <Button
                              size="sm"
                              variant={isSelected ? 'secondary' : 'outline'}
                              onClick={() => handleSelectActive(item._id)}
                              className="h-8 text-[11px] font-bold flex-1"
                            >
                              {isSelected ? '✓ Actif' : 'Sélectionner'}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              title="Détails"
                              onClick={() => setDetailTarget(item)}
                              className="h-8 px-2.5"
                            >
                              <Eye className="size-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              title="Modifier"
                              onClick={() => openEditForm(item)}
                              className="h-8 px-2.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Edit2 className="size-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              title={item.status === 'ACTIVE' ? 'Désactiver' : 'Activer'}
                              onClick={() =>
                                void handleChangeStatus(
                                  item,
                                  item.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                                )
                              }
                              className="h-8 px-2.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            >
                              <Power className="size-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              title="Archiver"
                              onClick={() => void handleChangeStatus(item, 'ARCHIVED')}
                              className="h-8 px-2.5 text-amber-600 border-amber-200 hover:bg-amber-50"
                            >
                              <Archive className="size-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              title="Supprimer"
                              onClick={() => void handleDelete(item)}
                              className="h-8 px-2.5 text-rose-600 border-rose-200 hover:bg-rose-50"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Détails Établissement */}
      {detailTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setDetailTarget(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div className="space-y-1 pr-8">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-600 text-white">
                  {ESTABLISHMENT_TYPE_LABELS[detailTarget.type]}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${ESTABLISHMENT_STATUS_META[detailTarget.status].badgeClass}`}
                >
                  {ESTABLISHMENT_STATUS_META[detailTarget.status].label}
                </span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                {detailTarget.name}
              </h3>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <MapPin className="size-3.5 text-blue-600" />
                {detailTarget.address}, {detailTarget.city}, {detailTarget.country}
              </p>
            </div>

            {detailTarget.photos?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {detailTarget.photos.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.url}
                    alt={`${detailTarget.name} ${idx + 1}`}
                    className="h-28 w-full object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                ))}
              </div>
            )}

            {detailTarget.description && (
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl">
                {detailTarget.description}
              </p>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-400 block">Chambres</span>
                <strong className="text-sm">{detailTarget.totalRooms}</strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-400 block">Occupées</span>
                <strong className="text-sm text-emerald-600">
                  {detailTarget.occupiedRooms}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-400 block">Revenus estimés</span>
                <strong className="text-sm text-blue-600">
                  {detailTarget.estimatedMonthlyRevenue.toLocaleString('fr-FR')}{' '}
                  {detailTarget.currency}
                </strong>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                <span className="text-slate-400 block">Contact</span>
                <strong className="text-xs truncate block">
                  {detailTarget.phone || detailTarget.email || '—'}
                </strong>
              </div>
            </div>

            {detailTarget.amenities?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Équipements & Caractéristiques
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {detailTarget.amenities.map((a) => (
                    <span
                      key={a}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-xs font-semibold"
                    >
                      ✓ {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleChangeStatus(detailTarget, 'ACTIVE')}
                className="text-emerald-600"
              >
                Activer
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleChangeStatus(detailTarget, 'MAINTENANCE')}
                className="text-rose-600"
              >
                En maintenance
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleChangeStatus(detailTarget, 'INACTIVE')}
              >
                Désactiver
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleChangeStatus(detailTarget, 'ARCHIVED')}
                className="text-amber-600"
              >
                Archiver
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Création / Modification d'établissement */}
      {formOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitForm}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <Hotel className="size-5 text-blue-600" />
                {editing ? `Modifier : ${editing.name}` : 'Ajouter un établissement'}
              </h3>
              <p className="text-xs text-slate-500">
                Hôtel, Motel, Auberge, Résidence ou Appartement meublé — photos Cloudinary & GPS
              </p>
            </div>

            {/* Informations générales */}
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="sm:col-span-2 block space-y-1 text-xs font-semibold">
                <span>Nom de l’établissement *</span>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Kadt Luxury Hotel"
                  required
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold">
                <span>Type *</span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as EstablishmentType)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  {Object.entries(ESTABLISHMENT_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <label className="block space-y-1 text-xs font-semibold">
                <span>Étoiles (1–5)</span>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={stars}
                  onChange={(e) => setStars(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Chambres totales</span>
                <Input
                  type="number"
                  min={0}
                  value={totalRooms}
                  onChange={(e) => setTotalRooms(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Revenus estimés / mois</span>
                <Input
                  type="number"
                  min={0}
                  value={estimatedMonthlyRevenue}
                  onChange={(e) => setEstimatedMonthlyRevenue(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Devise</span>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  <option value="FCFA">FCFA</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-xs font-semibold">
              <span>Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez votre établissement, ses atouts et services..."
                className="w-full rounded-xl border border-input bg-background p-3 text-xs"
              />
            </label>

            {/* Adresse & Contact */}
            <div className="grid sm:grid-cols-3 gap-4">
              <label className="sm:col-span-1 block space-y-1 text-xs font-semibold">
                <span>Adresse *</span>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Boulevard Lagunaire"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Ville *</span>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Abidjan"
                  required
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Pays *</span>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Côte d’Ivoire"
                  required
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block space-y-1 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Phone className="size-3.5 text-blue-600" /> Téléphone
                </span>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+225 07 00 00 00 00"
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span className="flex items-center gap-1">
                  <Mail className="size-3.5 text-blue-600" /> Email
                </span>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@hotel.com"
                />
              </label>
            </div>

            {/* Géolocalisation GPS & Carte */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Compass className="size-4 text-blue-600" />
                  Géolocalisation de l’établissement
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locatingGps}
                  onClick={() => void handleLocateGps()}
                  className="gap-1.5 text-xs font-bold"
                >
                  <LocateFixed className="size-3.5 text-blue-600" />
                  {locatingGps ? 'Localisation GPS...' : 'Ma position GPS'}
                </Button>
              </div>
              {typeof latitude === 'number' && typeof longitude === 'number' && (
                <p className="text-[11px] font-mono text-emerald-600">
                  📍 Coordonnées : {latitude.toFixed(6)}, {longitude.toFixed(6)}
                </p>
              )}
              <GeoMapCanvas
                title="Pointer l'emplacement exact"
                subtitle="Cliquez sur la carte pour placer l'établissement"
                heightClassName="h-56"
                allowMarkerPlacement
                activeMarker={
                  typeof latitude === 'number' && typeof longitude === 'number'
                    ? { lat: latitude, lng: longitude }
                    : null
                }
                initialCenter={
                  typeof latitude === 'number' && typeof longitude === 'number'
                    ? { lat: latitude, lng: longitude }
                    : undefined
                }
                onMarkerChange={(pt, geocode) => {
                  setLatitude(Number(pt.lat.toFixed(6)));
                  setLongitude(Number(pt.lng.toFixed(6)));
                  if (geocode?.address && !address) setAddress(geocode.address);
                  if (geocode?.city && !city) setCity(geocode.city);
                }}
              />
            </div>

            {/* Upload Multi-Photos Cloudinary */}
            <div className="space-y-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  <ImagePlus className="size-4 text-blue-600" />
                  Photos de l’établissement (Cloudinary)
                </span>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold">
                  <ImagePlus className="size-3.5" />
                  <span>{uploadingPhotos ? 'Envoi...' : 'Ajouter des photos'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => void handleUploadPhotos(e.target.files)}
                  />
                </label>
              </div>
              {photos.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200">
                      <img src={p.url} alt={`Photo ${idx + 1}`} className="h-20 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 size-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Équipements & Caractéristiques */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-white block">
                Équipements & Caractéristiques
              </span>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_AMENITIES.map((label) => {
                  const selected = amenities.includes(label);
                  return (
                    <button
                      type="button"
                      key={label}
                      onClick={() => toggleAmenity(label)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 pt-1">
                <Input
                  value={customAmenity}
                  onChange={(e) => setCustomAmenity(e.target.value)}
                  placeholder="Ajouter un équipement personnalisé..."
                  className="text-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddCustomAmenity}>
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                {saving
                  ? 'Enregistrement...'
                  : editing
                    ? 'Enregistrer les modifications'
                    : 'Créer l’établissement'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
