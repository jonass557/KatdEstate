import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BedDouble,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Edit2,
  FolderPlus,
  Hotel,
  ImagePlus,
  Layers,
  LayoutDashboard,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Tag,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useSession } from '../../app/session';
import { apiRequest } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { useToast } from '../ui/toast';
import type { EstablishmentPhoto, HotelEstablishmentRecord } from './EstablishmentsManager';

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING' | 'MAINTENANCE';
type ViewMode = 'grid' | 'table' | 'floors';

export interface RoomCategoryRecord {
  _id: string;
  establishmentId: string;
  name: string;
  description?: string;
  basePrice: number;
  defaultBedsCount: number;
  defaultMaxCapacity: number;
  currency: string;
}

export interface HotelRoomRecord {
  _id: string;
  establishmentId: string;
  roomNumber: string;
  categoryId?: string | undefined;
  categoryName: string;
  floor: number;
  bedsCount: number;
  maxCapacity: number;
  pricePerNight: number;
  currency: string;
  description?: string;
  photos: EstablishmentPhoto[];
  status: RoomStatus;
  amenities: string[];
}

export interface RoomReservationRecord {
  _id: string;
  establishmentId: string;
  roomId: string;
  roomNumber?: string;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  source?: 'DIRECT' | 'OTA' | 'CORPORATE' | 'WALK_IN';
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  totalAmount: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
}

const ROOM_STATUS_META: Record<
  RoomStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  AVAILABLE: {
    label: 'Disponible',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
  },
  OCCUPIED: {
    label: 'Occupée',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    dotClass: 'bg-orange-500',
  },
  RESERVED: {
    label: 'Réservée',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-500',
  },
  CLEANING: {
    label: 'Nettoyage',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  MAINTENANCE: {
    label: 'Maintenance',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
    dotClass: 'bg-rose-500',
  },
};

const DEFAULT_ROOM_AMENITIES = [
  'Wi-Fi Fibre',
  'Climatisation',
  'TV Smart',
  'Mini-bar',
  'Coffre-fort',
  'Balcon / Terrasse',
  'Eau chaude',
  'Bureau de travail',
  'Sèche-cheveux',
  'Service en chambre',
];

const ACTIVE_ESTABLISHMENT_KEY = 'katdestate_active_hotel_establishment_id';

function localEstKey(email?: string) {
  return `katdestate_hotel_establishments_${(email || 'default').trim().toLowerCase()}`;
}
function localRoomsKey(email?: string) {
  return `katdestate_hotel_rooms_${(email || 'default').trim().toLowerCase()}`;
}
function localCatsKey(email?: string) {
  return `katdestate_hotel_room_categories_${(email || 'default').trim().toLowerCase()}`;
}
function localResKey(email?: string) {
  return `katdestate_hotel_reservations_${(email || 'default').trim().toLowerCase()}`;
}

function readJson<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson<T>(key: string, items: T[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {}
}

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 900;
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

export function RoomsManager() {
  const { user, memberships } = useSession();
  const { toast } = useToast();
  const orgId = memberships?.[0]?.organizationId;

  const [establishments, setEstablishments] = useState<HotelEstablishmentRecord[]>(() =>
    readJson<HotelEstablishmentRecord>(localEstKey(user?.email)),
  );
  const [activeEstablishmentId, setActiveEstablishmentId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ACTIVE_ESTABLISHMENT_KEY) || '';
  });

  const [rooms, setRooms] = useState<HotelRoomRecord[]>(() =>
    readJson<HotelRoomRecord>(localRoomsKey(user?.email)),
  );
  const [categories, setCategories] = useState<RoomCategoryRecord[]>(() =>
    readJson<RoomCategoryRecord>(localCatsKey(user?.email)),
  );
  const [reservations, setReservations] = useState<RoomReservationRecord[]>(() =>
    readJson<RoomReservationRecord>(localResKey(user?.email)),
  );

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filterFloor, setFilterFloor] = useState<string>('ALL');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Room Create/Edit Modal
  const [roomFormOpen, setRoomFormOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<HotelRoomRecord | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);

  const [roomNumber, setRoomNumber] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('Standard');
  const [floor, setFloor] = useState(1);
  const [bedsCount, setBedsCount] = useState(1);
  const [maxCapacity, setMaxCapacity] = useState(2);
  const [pricePerNight, setPricePerNight] = useState(35000);
  const [currency, setCurrency] = useState('FCFA');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<RoomStatus>('AVAILABLE');
  const [photos, setPhotos] = useState<EstablishmentPhoto[]>([]);
  const [amenities, setAmenities] = useState<string[]>(['Wi-Fi Fibre', 'Climatisation']);
  const [customAmenity, setCustomAmenity] = useState('');

  // Category Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const [catBasePrice, setCatBasePrice] = useState(35000);
  const [catBeds, setCatBeds] = useState(1);
  const [catCapacity, setCatCapacity] = useState(2);

  // Detail & Reservation Modal
  const [detailRoom, setDetailRoom] = useState<HotelRoomRecord | null>(null);
  const [detailReservations, setDetailReservations] = useState<RoomReservationRecord[]>([]);
  const [resGuestName, setResGuestName] = useState('');
  const [resGuestPhone, setResGuestPhone] = useState('');
  const [resCheckIn, setResCheckIn] = useState(() => new Date().toISOString().slice(0, 10));
  const [resCheckOut, setResCheckOut] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [resSource, setResSource] = useState<'DIRECT' | 'OTA' | 'CORPORATE' | 'WALK_IN'>('DIRECT');
  const [bookingSaving, setBookingSaving] = useState(false);

  const activeEst = useMemo(
    () =>
      establishments.find((e) => e._id === activeEstablishmentId) || establishments[0] || null,
    [establishments, activeEstablishmentId],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    let currentEstId = activeEstablishmentId;

    if (orgId) {
      try {
        const estRes = await apiRequest<HotelEstablishmentRecord[]>(
          `/organizations/${orgId}/establishments`,
        );
        if (Array.isArray(estRes) && estRes.length > 0) {
          setEstablishments(estRes);
          writeJson(localEstKey(user?.email), estRes);
          if (!currentEstId || !estRes.some((e) => e._id === currentEstId)) {
            currentEstId = estRes[0]!._id;
            setActiveEstablishmentId(currentEstId);
            localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, currentEstId);
          }
        }
      } catch {
        // fallback local
      }

      if (currentEstId) {
        try {
          const [roomsRes, catsRes] = await Promise.all([
            apiRequest<HotelRoomRecord[]>(
              `/organizations/${orgId}/rooms?establishmentId=${currentEstId}`,
            ),
            apiRequest<RoomCategoryRecord[]>(
              `/organizations/${orgId}/room-categories?establishmentId=${currentEstId}`,
            ),
          ]);
          if (Array.isArray(roomsRes)) {
            setRooms(roomsRes);
            writeJson(localRoomsKey(user?.email), roomsRes);
          }
          if (Array.isArray(catsRes)) {
            setCategories(catsRes);
            writeJson(localCatsKey(user?.email), catsRes);
          }
          setLoading(false);
          return;
        } catch {
          // fallback local
        }
      }
    }

    const localEst = readJson<HotelEstablishmentRecord>(localEstKey(user?.email));
    setEstablishments(localEst);
    if (!currentEstId && localEst[0]) {
      currentEstId = localEst[0]._id;
      setActiveEstablishmentId(currentEstId);
    }
    setRooms(readJson<HotelRoomRecord>(localRoomsKey(user?.email)));
    setCategories(readJson<RoomCategoryRecord>(localCatsKey(user?.email)));
    setReservations(readJson<RoomReservationRecord>(localResKey(user?.email)));
    setLoading(false);
  }, [orgId, user?.email, activeEstablishmentId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const scopedRooms = useMemo(() => {
    if (!activeEst) return rooms;
    return rooms.filter((r) => !r.establishmentId || r.establishmentId === activeEst._id);
  }, [rooms, activeEst]);

  const scopedCategories = useMemo(() => {
    if (!activeEst) return categories;
    return categories.filter((c) => !c.establishmentId || c.establishmentId === activeEst._id);
  }, [categories, activeEst]);

  const stats = useMemo(() => {
    return scopedRooms.reduce(
      (acc, r) => {
        acc.total += 1;
        if (r.status === 'AVAILABLE') acc.available += 1;
        else if (r.status === 'OCCUPIED') acc.occupied += 1;
        else if (r.status === 'RESERVED') acc.reserved += 1;
        else if (r.status === 'CLEANING') acc.cleaning += 1;
        else if (r.status === 'MAINTENANCE') acc.maintenance += 1;
        return acc;
      },
      { total: 0, available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0 },
    );
  }, [scopedRooms]);

  const availableFloors = useMemo(() => {
    return Array.from(new Set(scopedRooms.map((r) => r.floor))).sort((a, b) => a - b);
  }, [scopedRooms]);

  const availableCategoryNames = useMemo(() => {
    const names = new Set<string>([
      ...scopedRooms.map((r) => r.categoryName).filter(Boolean),
      ...scopedCategories.map((c) => c.name),
    ]);
    return Array.from(names).sort();
  }, [scopedRooms, scopedCategories]);

  const filteredRooms = useMemo(() => {
    return scopedRooms.filter((r) => {
      if (filterFloor !== 'ALL' && r.floor !== Number(filterFloor)) return false;
      if (filterCategory !== 'ALL' && r.categoryName !== filterCategory) return false;
      if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          r.roomNumber.toLowerCase().includes(q) ||
          r.categoryName.toLowerCase().includes(q) ||
          (r.description || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [scopedRooms, filterFloor, filterCategory, filterStatus, search]);

  const roomsByFloor = useMemo(() => {
    const groups = new Map<number, HotelRoomRecord[]>();
    filteredRooms.forEach((r) => {
      const list = groups.get(r.floor) || [];
      list.push(r);
      groups.set(r.floor, list);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredRooms]);

  const openCreateRoom = () => {
    setEditingRoom(null);
    setRoomNumber('');
    setCategoryId(scopedCategories[0]?._id || '');
    setCategoryName(scopedCategories[0]?.name || 'Standard');
    setFloor(1);
    setBedsCount(scopedCategories[0]?.defaultBedsCount || 1);
    setMaxCapacity(scopedCategories[0]?.defaultMaxCapacity || 2);
    setPricePerNight(scopedCategories[0]?.basePrice || 35000);
    setCurrency(activeEst?.currency || 'FCFA');
    setDescription('');
    setStatus('AVAILABLE');
    setPhotos([]);
    setAmenities(['Wi-Fi Fibre', 'Climatisation']);
    setRoomFormOpen(true);
  };

  const openEditRoom = (room: HotelRoomRecord) => {
    setEditingRoom(room);
    setRoomNumber(room.roomNumber);
    setCategoryId(room.categoryId || '');
    setCategoryName(room.categoryName);
    setFloor(room.floor);
    setBedsCount(room.bedsCount);
    setMaxCapacity(room.maxCapacity);
    setPricePerNight(room.pricePerNight);
    setCurrency(room.currency || activeEst?.currency || 'FCFA');
    setDescription(room.description || '');
    setStatus(room.status);
    setPhotos(room.photos || []);
    setAmenities(room.amenities || []);
    setRoomFormOpen(true);
  };

  const openRoomDetail = async (room: HotelRoomRecord) => {
    setDetailRoom(room);
    if (orgId) {
      try {
        const res = await apiRequest<{
          room: HotelRoomRecord;
          reservations: RoomReservationRecord[];
        }>(`/organizations/${orgId}/rooms/${room._id}`);
        if (res?.reservations) {
          setDetailReservations(res.reservations);
          return;
        }
      } catch {
        // fallback local
      }
    }
    setDetailReservations(reservations.filter((r) => r.roomId === room._id));
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
            { method: 'POST', body: { photos: compressed } },
          );
          if (Array.isArray(uploaded) && uploaded.length > 0) {
            setPhotos((prev) => [
              ...prev,
              ...uploaded.map((u, idx) => ({ ...u, isPrimary: prev.length === 0 && idx === 0 })),
            ]);
            toast({ title: `${uploaded.length} photo(s) téléversée(s) !`, variant: 'success' });
            return;
          }
        } catch {}
      }

      setPhotos((prev) => [
        ...prev,
        ...compressed.map((url, idx) => ({ url, isPrimary: prev.length === 0 && idx === 0 })),
      ]);
      toast({ title: `${compressed.length} photo(s) ajoutée(s) !`, variant: 'success' });
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSubmitRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEst) {
      toast({
        title: 'Veuillez d’abord créer un établissement hôtelier.',
        variant: 'error',
      });
      return;
    }
    if (!roomNumber.trim()) {
      toast({ title: 'Le numéro de chambre est obligatoire.', variant: 'error' });
      return;
    }

    setSavingRoom(true);
    const payload = {
      establishmentId: activeEst._id,
      roomNumber: roomNumber.trim(),
      categoryId: categoryId || undefined,
      categoryName: categoryName.trim() || 'Standard',
      floor: Number(floor),
      bedsCount: Number(bedsCount) || 1,
      maxCapacity: Number(maxCapacity) || 2,
      pricePerNight: Number(pricePerNight) || 0,
      currency,
      description: description.trim(),
      photos,
      status,
      amenities,
    };

    try {
      let saved: HotelRoomRecord | null = null;
      if (orgId) {
        try {
          if (editingRoom) {
            saved = await apiRequest<HotelRoomRecord>(
              `/organizations/${orgId}/rooms/${editingRoom._id}`,
              { method: 'PATCH', body: payload },
            );
          } else {
            saved = await apiRequest<HotelRoomRecord>(`/organizations/${orgId}/rooms`, {
              method: 'POST',
              body: payload,
            });
          }
        } catch (err: any) {
          if (err?.status === 409) {
            toast({ title: err.message, variant: 'error' });
            setSavingRoom(false);
            return;
          }
        }
      }

      if (!saved) {
        const duplicate = scopedRooms.some(
          (r) =>
            r.roomNumber.toLowerCase() === payload.roomNumber.toLowerCase() &&
            r._id !== editingRoom?._id,
        );
        if (duplicate) {
          toast({
            title: `La chambre ${payload.roomNumber} existe déjà dans cet établissement.`,
            variant: 'error',
          });
          setSavingRoom(false);
          return;
        }
        saved = {
          _id: editingRoom?._id || `room-${Date.now()}`,
          ...payload,
        };
      }

      setRooms((prev) => {
        const next = editingRoom
          ? prev.map((r) => (r._id === saved!._id ? saved! : r))
          : [...prev, saved!];
        writeJson(localRoomsKey(user?.email), next);
        return next;
      });
      toast({
        title: editingRoom ? 'Chambre mise à jour !' : 'Chambre ajoutée avec succès !',
        variant: 'success',
      });
      setRoomFormOpen(false);
    } finally {
      setSavingRoom(false);
    }
  };

  const handleDeleteRoom = async (room: HotelRoomRecord) => {
    // Règle locale anti-suppression si réservée ou occupée
    const hasActiveRes = reservations.some(
      (r) =>
        r.roomId === room._id &&
        ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) &&
        new Date(r.checkOutDate) >= new Date(),
    );
    if (hasActiveRes || room.status === 'OCCUPIED' || room.status === 'RESERVED') {
      toast({
        title: 'Suppression refusée',
        description:
          'Cette chambre est actuellement occupée ou possède des réservations actives/à venir.',
        variant: 'error',
      });
      return;
    }

    if (orgId) {
      try {
        await apiRequest(`/organizations/${orgId}/rooms/${room._id}`, { method: 'DELETE' });
      } catch (err: any) {
        if (err?.status === 409) {
          toast({ title: 'Suppression refusée', description: err.message, variant: 'error' });
          return;
        }
      }
    }

    setRooms((prev) => {
      const next = prev.filter((r) => r._id !== room._id);
      writeJson(localRoomsKey(user?.email), next);
      return next;
    });
    if (detailRoom?._id === room._id) setDetailRoom(null);
    toast({ title: `Chambre ${room.roomNumber} supprimée.`, variant: 'info' });
  };

  const handleQuickStatusChange = async (room: HotelRoomRecord, nextStatus: RoomStatus) => {
    if (orgId) {
      try {
        await apiRequest(`/organizations/${orgId}/rooms/${room._id}`, {
          method: 'PATCH',
          body: { status: nextStatus },
        });
      } catch {}
    }
    setRooms((prev) => {
      const next = prev.map((r) => (r._id === room._id ? { ...r, status: nextStatus } : r));
      writeJson(localRoomsKey(user?.email), next);
      return next;
    });
    if (detailRoom?._id === room._id) {
      setDetailRoom({ ...room, status: nextStatus });
    }
    toast({
      title: `Chambre ${room.roomNumber} : ${ROOM_STATUS_META[nextStatus].label}`,
      variant: 'success',
    });
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEst || !catName.trim()) return;
    const payload = {
      establishmentId: activeEst._id,
      name: catName.trim(),
      description: catDescription.trim(),
      basePrice: Number(catBasePrice) || 0,
      defaultBedsCount: Number(catBeds) || 1,
      defaultMaxCapacity: Number(catCapacity) || 2,
      currency: activeEst.currency || 'FCFA',
    };

    let saved: RoomCategoryRecord | null = null;
    if (orgId) {
      try {
        saved = await apiRequest<RoomCategoryRecord>(`/organizations/${orgId}/room-categories`, {
          method: 'POST',
          body: payload,
        });
      } catch {}
    }
    if (!saved) {
      saved = { _id: `cat-${Date.now()}`, ...payload };
    }
    setCategories((prev) => {
      const next = [...prev, saved!];
      writeJson(localCatsKey(user?.email), next);
      return next;
    });
    setCatModalOpen(false);
    setCatName('');
    setCatDescription('');
    toast({ title: `Catégorie "${saved.name}" créée !`, variant: 'success' });
  };

  const handleCreateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailRoom || !activeEst || !resGuestName.trim()) return;

    const cIn = new Date(resCheckIn);
    const cOut = new Date(resCheckOut);
    if (cOut <= cIn) {
      toast({
        title: 'La date de départ doit être postérieure à la date d’arrivée.',
        variant: 'error',
      });
      return;
    }

    // Vérification locale anti-chevauchement
    const overlap = detailReservations.find(
      (r) =>
        ['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(r.status) &&
        new Date(r.checkInDate) < cOut &&
        new Date(r.checkOutDate) > cIn,
    );
    if (overlap) {
      toast({
        title: 'Conflit de réservation détecté !',
        description: `La chambre ${detailRoom.roomNumber} est déjà réservée/occupée par ${overlap.guestName} sur cette période.`,
        variant: 'error',
      });
      return;
    }

    setBookingSaving(true);
    try {
      let created: RoomReservationRecord | null = null;
      if (orgId) {
        try {
          created = await apiRequest<RoomReservationRecord>(
            `/organizations/${orgId}/reservations`,
            {
              method: 'POST',
              body: {
                establishmentId: activeEst._id,
                roomId: detailRoom._id,
                guestName: resGuestName.trim(),
                guestPhone: resGuestPhone.trim(),
                source: resSource,
                checkInDate: resCheckIn,
                checkOutDate: resCheckOut,
              },
            },
          );
        } catch (err: any) {
          if (err?.status === 409 || err?.status === 422) {
            toast({ title: 'Réservation refusée', description: err.message, variant: 'error' });
            setBookingSaving(false);
            return;
          }
        }
      }

      const nights = Math.max(1, Math.ceil((cOut.getTime() - cIn.getTime()) / (1000 * 60 * 60 * 24)));
      const now = new Date();
      const isNow = cIn <= now && cOut > now;

      if (!created) {
        created = {
          _id: `res-${Date.now()}`,
          establishmentId: activeEst._id,
          roomId: detailRoom._id,
          roomNumber: detailRoom.roomNumber,
          guestName: resGuestName.trim(),
          guestPhone: resGuestPhone.trim(),
          source: resSource,
          checkInDate: resCheckIn,
          checkOutDate: resCheckOut,
          nights,
          totalAmount: nights * detailRoom.pricePerNight,
          currency: detailRoom.currency,
          status: isNow ? 'CHECKED_IN' : 'CONFIRMED',
        };
      }

      setDetailReservations((prev) => [created!, ...prev]);
      setReservations((prev) => {
        const next = [created!, ...prev];
        writeJson(localResKey(user?.email), next);
        return next;
      });
      const nextRoomStatus: RoomStatus = isNow ? 'OCCUPIED' : 'RESERVED';
      setRooms((prev) => {
        const next = prev.map((r) =>
          r._id === detailRoom._id ? { ...r, status: nextRoomStatus } : r,
        );
        writeJson(localRoomsKey(user?.email), next);
        return next;
      });
      setDetailRoom({ ...detailRoom, status: nextRoomStatus });
      setResGuestName('');
      setResGuestPhone('');
      toast({
        title: `Réservation confirmée (${nights} nuit(s))`,
        description: `Statut chambre synchronisé : ${ROOM_STATUS_META[nextRoomStatus].label}`,
        variant: 'success',
      });
    } finally {
      setBookingSaving(false);
    }
  };

  return (
    <div className="rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl bg-slate-50 dark:bg-slate-950 flex flex-col lg:flex-row min-h-[700px]">
      {/* Sidebar Bleu Nuit fidèle à l'image */}
      <aside className="w-full lg:w-60 bg-[#0B1E40] text-white flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 px-2">
            <div className="size-9 rounded-xl bg-white text-[#0B1E40] flex items-center justify-center font-black text-lg shadow">
              K
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight block leading-none">
                KadtEstate
              </span>
              <span className="text-[10px] text-blue-200/80 uppercase tracking-wider font-semibold">
                Chambres
              </span>
            </div>
          </div>

          <nav className="space-y-1 text-sm">
            <Link
              to="/hotel/overview"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <LayoutDashboard className="size-4 shrink-0" />
              <span>Vue générale</span>
            </Link>
            <Link
              to="/hotel/rooms"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium bg-blue-600 text-white shadow-md shadow-blue-900/40"
            >
              <BedDouble className="size-4 shrink-0" />
              <span>Chambres</span>
            </Link>
            <Link
              to="/hotel/reservations"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <CalendarCheck className="size-4 shrink-0" />
              <span>Réservations</span>
            </Link>
            <Link
              to="/hotel/crm"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Users className="size-4 shrink-0" />
              <span>Clients</span>
            </Link>
            <Link
              to="/hotel/billing"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Receipt className="size-4 shrink-0" />
              <span>Facturation</span>
            </Link>
            <Link
              to="/hotel/establishments"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-blue-100/80 hover:bg-white/10 hover:text-white transition-all"
            >
              <Settings className="size-4 shrink-0" />
              <span>Paramètres</span>
            </Link>
          </nav>
        </div>

        {establishments.length > 0 && (
          <div className="mt-6 pt-4 border-t border-white/15 space-y-2">
            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-200/70 px-1 block">
              Établissement actif
            </span>
            <select
              value={activeEst?._id || ''}
              onChange={(e) => {
                setActiveEstablishmentId(e.target.value);
                localStorage.setItem(ACTIVE_ESTABLISHMENT_KEY, e.target.value);
              }}
              className="w-full h-9 rounded-xl bg-white/10 border border-white/20 px-2.5 text-xs font-semibold text-white"
            >
              {establishments.map((est) => (
                <option key={est._id} value={est._id} className="text-slate-900">
                  {est.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950">
        {/* Top Bar */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">
              Gestion des chambres
            </h2>
            <p className="text-xs text-slate-500">
              {activeEst ? `${activeEst.name} (${activeEst.city})` : 'Sélectionnez ou créez un établissement'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCatModalOpen(true)}
              className="gap-1.5 text-xs font-bold rounded-xl"
            >
              <FolderPlus className="size-4 text-blue-600" />
              <span>Créer une catégorie</span>
            </Button>

            <Button
              onClick={openCreateRoom}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-blue-600/20 gap-1.5"
            >
              <Plus className="size-4" />
              <span>Ajouter une chambre</span>
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Barre de recherche + Filtres + 3 Modes d'affichage */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="size-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une chambre..."
                className="pl-9 bg-white dark:bg-slate-900 rounded-xl"
              />
            </div>

            <select
              value={filterFloor}
              onChange={(e) => setFilterFloor(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"
            >
              <option value="ALL">Étage : Tous</option>
              {availableFloors.map((f) => (
                <option key={f} value={f}>
                  Étage {f}
                </option>
              ))}
            </select>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"
            >
              <option value="ALL">Catégorie : Toutes</option>
              {availableCategoryNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-semibold"
            >
              <option value="ALL">Statut : Tous</option>
              {Object.entries(ROOM_STATUS_META).map(([k, m]) => (
                <option key={k} value={k}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* 3 Affichages : Grille, Tableau, Vue par étage */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Vue Grille"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  viewMode === 'grid' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <LayoutGrid className="size-3.5" />
                <span className="hidden sm:inline">Grille</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                title="Vue Tableau"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <List className="size-3.5" />
                <span className="hidden sm:inline">Tableau</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('floors')}
                title="Vue par étage"
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                  viewMode === 'floors' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Layers className="size-3.5" />
                <span className="hidden sm:inline">Étages</span>
              </button>
            </div>
          </div>

          {/* 5 Cartes Statistiques en haut (style exact de l'image) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="size-10 rounded-full bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                  <Building2 className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {stats.total}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Total</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/70 dark:border-emerald-900/40">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="size-10 rounded-full bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {stats.available}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Disponibles</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-200/70 dark:border-orange-900/40">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="size-10 rounded-full bg-orange-500/15 text-orange-600 flex items-center justify-center shrink-0">
                  <BedDouble className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {stats.occupied + stats.reserved}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">
                    Occupées{stats.reserved > 0 ? ` (${stats.reserved} rés.)` : ''}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/70 dark:border-amber-900/40">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="size-10 rounded-full bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {stats.cleaning}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Nettoyage</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-teal-50/50 dark:bg-teal-950/20 border-teal-200/70 dark:border-teal-900/40">
              <CardContent className="p-3.5 flex items-center gap-3">
                <div className="size-10 rounded-full bg-teal-500/15 text-teal-700 flex items-center justify-center shrink-0">
                  <Wrench className="size-5" />
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 dark:text-white leading-none">
                    {stats.maintenance}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-1">Maintenance</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Contenu selon le mode d'affichage */}
          {loading && scopedRooms.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="size-7 animate-spin text-blue-600" />
              <span className="text-xs font-semibold">Chargement des chambres…</span>
            </div>
          ) : filteredRooms.length === 0 ? (
            <Card className="border-dashed border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900">
              <CardContent className="p-10 text-center space-y-3">
                <BedDouble className="size-10 text-blue-600 mx-auto" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Aucune chambre enregistrée
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  {activeEst
                    ? `Ajoutez les chambres de ${activeEst.name} avec leurs numéros, étages, catégories, tarifs et photos.`
                    : 'Créez d’abord un établissement dans le module Établissements Hôteliers.'}
                </p>
                <Button
                  onClick={openCreateRoom}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl gap-1.5"
                >
                  <Plus className="size-4" />
                  Ajouter une chambre
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredRooms.map((room) => {
                const st = ROOM_STATUS_META[room.status];
                const primaryPhoto = room.photos?.[0]?.url;
                return (
                  <Card
                    key={room._id}
                    onClick={() => void openRoomDetail(room)}
                    className="overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:shadow-lg hover:border-blue-500/40 transition-all cursor-pointer group flex flex-col"
                  >
                    <div className="relative h-36 bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      {primaryPhoto ? (
                        <img
                          src={primaryPhoto}
                          alt={`Chambre ${room.roomNumber}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1">
                          <Hotel className="size-8" />
                          <span className="text-[10px]">Chambre {room.roomNumber}</span>
                        </div>
                      )}
                      <span
                        className={`absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-sm ${st.badgeClass}`}
                      >
                        {st.label}
                      </span>
                    </div>

                    <CardContent className="p-4 flex-1 flex flex-col justify-between space-y-2.5">
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-lg font-black text-slate-900 dark:text-white">
                            {room.roomNumber}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500">
                            Étage {room.floor}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-blue-600">{room.categoryName}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          🛏️ {room.bedsCount} lit(s) • 👥 Max {room.maxCapacity} pers.
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-sm font-black text-emerald-600">
                          {room.pricePerNight.toLocaleString('fr-FR')} {room.currency}
                          <span className="text-[10px] font-normal text-slate-400"> / nuit</span>
                        </span>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditRoom(room)}
                            className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50"
                            title="Modifier"
                          >
                            <Edit2 className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRoom(room)}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                            title="Supprimer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : viewMode === 'table' ? (
            <Card className="overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[11px]">
                    <tr>
                      <th className="p-3">Chambre</th>
                      <th className="p-3">Catégorie</th>
                      <th className="p-3">Étage</th>
                      <th className="p-3">Lits / Cap.</th>
                      <th className="p-3">Prix / nuit</th>
                      <th className="p-3">Statut</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredRooms.map((room) => {
                      const st = ROOM_STATUS_META[room.status];
                      return (
                        <tr
                          key={room._id}
                          onClick={() => void openRoomDetail(room)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="p-3 font-black text-sm">{room.roomNumber}</td>
                          <td className="p-3 font-semibold text-blue-600">{room.categoryName}</td>
                          <td className="p-3">Étage {room.floor}</td>
                          <td className="p-3">
                            {room.bedsCount} lit(s) • {room.maxCapacity} pers.
                          </td>
                          <td className="p-3 font-bold text-emerald-600">
                            {room.pricePerNight.toLocaleString('fr-FR')} {room.currency}
                          </td>
                          <td className="p-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${st.badgeClass}`}>
                              {st.label}
                            </span>
                          </td>
                          <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="inline-flex gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEditRoom(room)} className="h-7 px-2">
                                <Edit2 className="size-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleDeleteRoom(room)}
                                className="h-7 px-2 text-rose-600"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="space-y-5">
              {roomsByFloor.map(([floorNum, floorRooms]) => (
                <Card
                  key={floorNum}
                  className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers className="size-4 text-blue-600" />
                      Étage {floorNum}
                    </h4>
                    <span className="text-xs font-bold text-slate-500">
                      {floorRooms.length} chambre(s)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {floorRooms.map((room) => {
                      const st = ROOM_STATUS_META[room.status];
                      return (
                        <button
                          type="button"
                          key={room._id}
                          onClick={() => void openRoomDetail(room)}
                          className={`p-3 rounded-2xl border text-left transition-all hover:shadow-md ${st.badgeClass}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-base font-black">{room.roomNumber}</span>
                            <span className={`size-2.5 rounded-full ${st.dotClass}`} />
                          </div>
                          <p className="text-[11px] font-semibold truncate mt-1">{room.categoryName}</p>
                          <p className="text-[10px] opacity-80">{st.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fiche Détaillée de la Chambre + Historique + Réservation anti-chevauchement */}
      {detailRoom && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setDetailRoom(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="size-5" />
            </button>

            <div className="flex flex-wrap items-start justify-between gap-4 pr-8">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    Chambre {detailRoom.roomNumber}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${ROOM_STATUS_META[detailRoom.status].badgeClass}`}
                  >
                    {ROOM_STATUS_META[detailRoom.status].label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailRoom.categoryName} • Étage {detailRoom.floor} • {detailRoom.bedsCount} lit(s) • Max{' '}
                  {detailRoom.maxCapacity} pers.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-black text-emerald-600">
                  {detailRoom.pricePerNight.toLocaleString('fr-FR')} {detailRoom.currency}
                </p>
                <span className="text-[11px] text-slate-400">par nuit</span>
              </div>
            </div>

            {detailRoom.photos?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {detailRoom.photos.map((p, idx) => (
                  <img
                    key={idx}
                    src={p.url}
                    alt={`Chambre ${detailRoom.roomNumber}`}
                    className="h-28 w-full object-cover rounded-xl border border-slate-200 dark:border-slate-700"
                  />
                ))}
              </div>
            )}

            {/* Changement rapide de statut */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-slate-500 mr-1">Statut :</span>
              {(Object.keys(ROOM_STATUS_META) as RoomStatus[]).map((stKey) => (
                <Button
                  key={stKey}
                  size="sm"
                  variant={detailRoom.status === stKey ? 'default' : 'outline'}
                  onClick={() => void handleQuickStatusChange(detailRoom, stKey)}
                  className="h-7 text-[11px]"
                >
                  {ROOM_STATUS_META[stKey].label}
                </Button>
              ))}
            </div>

            {detailRoom.amenities?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detailRoom.amenities.map((a) => (
                  <span
                    key={a}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    ✓ {a}
                  </span>
                ))}
              </div>
            )}

            {/* Réserver cette chambre (avec contrôle strict anti-chevauchement) */}
            <form
              onSubmit={handleCreateReservation}
              className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 space-y-3"
            >
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                <CalendarCheck className="size-4" />
                Attribuer / Réserver cette chambre (Anti-chevauchement activé)
              </h4>
              <div className="grid sm:grid-cols-4 gap-2.5">
                <Input
                  value={resGuestName}
                  onChange={(e) => setResGuestName(e.target.value)}
                  placeholder="Nom du client *"
                  required
                  className="bg-white dark:bg-slate-900 text-xs"
                />
                <Input
                  type="date"
                  value={resCheckIn}
                  onChange={(e) => setResCheckIn(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-900 text-xs"
                />
                <Input
                  type="date"
                  value={resCheckOut}
                  onChange={(e) => setResCheckOut(e.target.value)}
                  required
                  className="bg-white dark:bg-slate-900 text-xs"
                />
                <select
                  value={resSource}
                  onChange={(e) => setResSource(e.target.value as any)}
                  className="h-10 rounded-xl border border-input bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold"
                >
                  <option value="DIRECT">Direct</option>
                  <option value="OTA">OTA</option>
                  <option value="CORPORATE">Entreprise</option>
                  <option value="WALK_IN">Passage</option>
                </select>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Input
                  value={resGuestPhone}
                  onChange={(e) => setResGuestPhone(e.target.value)}
                  placeholder="Téléphone client (optionnel)"
                  className="bg-white dark:bg-slate-900 text-xs max-w-xs"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={bookingSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  {bookingSaving ? 'Vérification...' : 'Confirmer la réservation'}
                </Button>
              </div>
            </form>

            {/* Historique d'occupation & réservations */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Historique d’occupation & Réservations ({detailReservations.length})
              </h4>
              {detailReservations.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-center">
                  Aucun séjour ou réservation enregistré pour cette chambre.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {detailReservations.map((res) => (
                    <div
                      key={res._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs"
                    >
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">{res.guestName}</p>
                        <p className="text-[11px] text-slate-500">
                          Du {new Date(res.checkInDate).toLocaleDateString('fr-FR')} au{' '}
                          {new Date(res.checkOutDate).toLocaleDateString('fr-FR')} ({res.nights} nuit(s))
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">
                          {res.totalAmount.toLocaleString('fr-FR')} {res.currency}
                        </p>
                        <span className="text-[10px] font-bold text-slate-500">{res.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Création / Modification de Chambre */}
      {roomFormOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitRoom}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[92vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => setRoomFormOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100"
            >
              <X className="size-5" />
            </button>

            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <BedDouble className="size-5 text-blue-600" />
              {editingRoom ? `Modifier Chambre ${editingRoom.roomNumber}` : 'Ajouter une chambre'}
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <label className="block space-y-1 text-xs font-semibold">
                <span>Numéro *</span>
                <Input
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="Ex: 101"
                  required
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold">
                <span>Étage *</span>
                <Input
                  type="number"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                  required
                />
              </label>

              <label className="block space-y-1 text-xs font-semibold">
                <span>Catégorie</span>
                {scopedCategories.length > 0 ? (
                  <select
                    value={categoryId}
                    onChange={(e) => {
                      const cat = scopedCategories.find((c) => c._id === e.target.value);
                      setCategoryId(e.target.value);
                      if (cat) {
                        setCategoryName(cat.name);
                        setPricePerNight(cat.basePrice);
                        setBedsCount(cat.defaultBedsCount);
                        setMaxCapacity(cat.defaultMaxCapacity);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                  >
                    <option value="">Personnalisée</option>
                    {scopedCategories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="Standard, Deluxe, Suite..."
                  />
                )}
              </label>
            </div>

            <div className="grid sm:grid-cols-4 gap-4">
              <label className="block space-y-1 text-xs font-semibold">
                <span>Nombre de lits</span>
                <Input
                  type="number"
                  min={1}
                  value={bedsCount}
                  onChange={(e) => setBedsCount(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Capacité max</span>
                <Input
                  type="number"
                  min={1}
                  value={maxCapacity}
                  onChange={(e) => setMaxCapacity(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Prix / nuit</span>
                <Input
                  type="number"
                  min={0}
                  value={pricePerNight}
                  onChange={(e) => setPricePerNight(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Statut</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RoomStatus)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  {Object.entries(ROOM_STATUS_META).map(([k, m]) => (
                    <option key={k} value={k}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-xs font-semibold">
              <span>Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vue jardin, balcon privé, literie King Size..."
                className="w-full rounded-xl border border-input bg-background p-3 text-xs"
              />
            </label>

            {/* Photos */}
            <div className="space-y-2.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5">
                  <ImagePlus className="size-4 text-blue-600" /> Photos de la chambre
                </span>
                <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold">
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
                <div className="grid grid-cols-4 gap-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border">
                      <img src={p.url} alt="" className="h-16 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute top-1 right-1 size-4 rounded-full bg-rose-600 text-white text-[10px] flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Équipements */}
            <div className="space-y-2">
              <span className="text-xs font-bold block">Équipements de la chambre</span>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_ROOM_AMENITIES.map((label) => {
                  const selected = amenities.includes(label);
                  return (
                    <button
                      type="button"
                      key={label}
                      onClick={() =>
                        setAmenities((prev) =>
                          prev.includes(label) ? prev.filter((a) => a !== label) : [...prev, label],
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 border-slate-200'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}
                      {label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customAmenity}
                  onChange={(e) => setCustomAmenity(e.target.value)}
                  placeholder="Équipement personnalisé..."
                  className="text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (customAmenity.trim() && !amenities.includes(customAmenity.trim())) {
                      setAmenities((prev) => [...prev, customAmenity.trim()]);
                    }
                    setCustomAmenity('');
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <Button type="button" variant="outline" onClick={() => setRoomFormOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={savingRoom} className="bg-blue-600 text-white font-bold">
                {savingRoom ? 'Enregistrement...' : editingRoom ? 'Mettre à jour' : 'Créer la chambre'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Création de Catégorie */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateCategory}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl relative"
          >
            <button
              type="button"
              onClick={() => setCatModalOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:bg-slate-100"
            >
              <X className="size-5" />
            </button>
            <h3 className="text-lg font-extrabold flex items-center gap-2">
              <Tag className="size-5 text-blue-600" /> Nouvelle catégorie de chambre
            </h3>
            <label className="block space-y-1 text-xs font-semibold">
              <span>Nom de la catégorie *</span>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex: Suite Présidentielle, Deluxe, Standard..."
                required
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="block space-y-1 text-xs font-semibold">
                <span>Tarif de base</span>
                <Input
                  type="number"
                  min={0}
                  value={catBasePrice}
                  onChange={(e) => setCatBasePrice(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Lits défaut</span>
                <Input
                  type="number"
                  min={1}
                  value={catBeds}
                  onChange={(e) => setCatBeds(Number(e.target.value))}
                />
              </label>
              <label className="block space-y-1 text-xs font-semibold">
                <span>Capacité</span>
                <Input
                  type="number"
                  min={1}
                  value={catCapacity}
                  onChange={(e) => setCatCapacity(Number(e.target.value))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-xs font-semibold">
              <span>Description</span>
              <Input
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                placeholder="Description courte..."
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCatModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" className="bg-blue-600 text-white font-bold">
                Créer
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
