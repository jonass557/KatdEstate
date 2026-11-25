import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Copy,
  Crown,
  Flame,
  Home,
  KeyRound,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Shield,
  TrendingUp,
  UserCheck,
  Wallet,
} from 'lucide-react';
import { computePolygonAreaM2, type GeoJsonBoundary } from '@rentflow/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';
import { useSession } from '../../app/session';
import { GeoMapCanvas } from '../../components/geo/GeoMapCanvas';
import { getLocalProperties, type Property } from '../properties';
import { getLocalTenants, type Tenant } from '../tenants';
import {
  getBlockLeaders,
  getBlockOwners,
  getHierarchyMessages,
  getStoredBlocks,
  getStoredHabitants,
  getStoredIncidents,
  getStoredNeighborhoods,
  getWorkflowListings,
  saveBlockOwner,
  saveRegisteredUser,
  saveStoredHabitant,
  saveStoredIncident,
  saveWorkflowListings,
  sendHierarchyMessage,
  type BlockOwnerRecord,
  type DirectHierarchyMessage,
  type HabitantRecord,
  type QuartierIncidentRecord,
  type WorkflowListingItem,
} from '../../lib/katdestate-store';

type BlockTab =
  | 'cartographie'
  | 'proprietaires'
  | 'habitants'
  | 'incidents'
  | 'messagerie-proprietaires'
  | 'messagerie-quartier'
  | 'rapport-financier'
  | 'publier-annonce';

const VALID_BLOCK_TABS: BlockTab[] = [
  'cartographie',
  'proprietaires',
  'habitants',
  'incidents',
  'messagerie-proprietaires',
  'messagerie-quartier',
  'rapport-financier',
  'publier-annonce',
];

const PUBLISH_CATEGORIES = [
  'Chambre Simple',
  'Chambre Moderne',
  'Studio',
  'Appartement',
  'Villa',
  'Maison en Carabot',
  'Terrain',
  'Bureau / Commerce',
];

export function BlockLeaderDashboard() {
  const { user } = useSession();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as BlockTab | null;
  const isIsolatedMode = Boolean(urlTab && VALID_BLOCK_TABS.includes(urlTab));

  const [tab, setTab] = useState<BlockTab>(() =>
    urlTab && VALID_BLOCK_TABS.includes(urlTab) ? urlTab : 'cartographie',
  );

  useEffect(() => {
    if (urlTab && VALID_BLOCK_TABS.includes(urlTab)) {
      setTab(urlTab);
    }
  }, [urlTab]);

  // Résoudre dynamiquement le bloc et le quartier assignés au Chef de Bloc connecté
  const emailNorm = user?.email?.trim().toLowerCase();
  const allBlocks = useMemo(() => getStoredBlocks(), []);
  const allNeighborhoods = useMemo(() => getStoredNeighborhoods(), []);
  const allLeaders = useMemo(() => getBlockLeaders(), []);

  const activeBlock = useMemo(() => {
    if (emailNorm) {
      const byLeader = allLeaders.find((l) => l.email?.trim().toLowerCase() === emailNorm);
      if (byLeader) {
        const blk = allBlocks.find((b) => b.id === byLeader.blockId);
        if (blk) return blk;
      }
      const byBlockEmail = allBlocks.find((b) => b.leaderEmail?.trim().toLowerCase() === emailNorm);
      if (byBlockEmail) return byBlockEmail;
    }
    return allBlocks[0]!;
  }, [allBlocks, allLeaders, emailNorm]);

  const activeNeighborhood = useMemo(
    () =>
      allNeighborhoods.find((n) => n.id === activeBlock?.neighborhoodId) || allNeighborhoods[0]!,
    [allNeighborhoods, activeBlock],
  );

  // Données locales cloisonnées au bloc actif
  const [owners, setOwners] = useState<BlockOwnerRecord[]>(() =>
    getBlockOwners().filter((o) => o.blockId === activeBlock.id),
  );
  const [habitants, setHabitants] = useState<HabitantRecord[]>(() =>
    getStoredHabitants().filter((h) => h.blockId === activeBlock.id),
  );
  const [incidents, setIncidents] = useState<QuartierIncidentRecord[]>(() =>
    getStoredIncidents().filter((i) => i.blockId === activeBlock.id),
  );
  const [properties, setProperties] = useState<Property[]>(() => getLocalProperties());
  const [tenants, setTenants] = useState<Tenant[]>(() => getLocalTenants());
  const [listings, setListings] = useState<WorkflowListingItem[]>(() => getWorkflowListings());
  const [hierarchyMsgs, setHierarchyMsgs] = useState<DirectHierarchyMessage[]>(() =>
    getHierarchyMessages(),
  );

  const refreshAll = () => {
    setOwners(getBlockOwners().filter((o) => o.blockId === activeBlock.id));
    setHabitants(getStoredHabitants().filter((h) => h.blockId === activeBlock.id));
    setIncidents(getStoredIncidents().filter((i) => i.blockId === activeBlock.id));
    setProperties(getLocalProperties());
    setTenants(getLocalTenants());
    setListings(getWorkflowListings());
    setHierarchyMsgs(getHierarchyMessages());
  };

  // Propriétés appartenant au bloc ou aux propriétaires créés par ce Chef de Bloc
  const blockProperties = useMemo(() => {
    const ownerIds = new Set(owners.map((o) => o.id));
    return properties.filter(
      (p) =>
        p.blockId === activeBlock.id ||
        (p.geoOwnerId && ownerIds.has(p.geoOwnerId)),
    );
  }, [properties, owners, activeBlock.id]);

  // --- GESTION DES PROPRIÉTAIRES ---
  const [newOwnerOpen, setNewOwnerOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+225 ');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('Proprio2026!');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('Immeuble résidentiel');
  const [monthlyDues, setMonthlyDues] = useState(150000);
  const [ownerBoundary, setOwnerBoundary] = useState<GeoJsonBoundary | null>(null);
  const [lastCreatedOwner, setLastCreatedOwner] = useState<BlockOwnerRecord | null>(null);

  const handleCreateOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerEmail.trim()) {
      toast({ title: 'Nom et email requis', variant: 'error' });
      return;
    }
    const cleanEmail = ownerEmail.trim().toLowerCase();
    const generatedPwd =
      ownerPassword.trim() || `Proprio${Math.floor(1000 + Math.random() * 9000)}!`;

    const newO: BlockOwnerRecord = {
      id: `own-${Date.now()}`,
      fullName: ownerName.trim(),
      email: cleanEmail,
      phone: ownerPhone.trim(),
      password: generatedPwd,
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      neighborhoodId: activeNeighborhood.id,
      ...(ownerBoundary ? { assignedBoundary: ownerBoundary } : {}),
      propertyName: propertyName.trim() || 'Propriété du bloc',
      propertyType,
      monthlyRentOrDues: Number(monthlyDues) || 0,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      createdAt: new Date().toISOString(),
      createdByBlockLeader: true,
    };
    saveBlockOwner(newO);

    // Créer automatiquement ses identifiants pour la connexion sur /sign-in
    saveRegisteredUser({
      email: cleanEmail,
      password: generatedPwd,
      displayName: ownerName.trim(),
      role: 'OWNER',
      phone: ownerPhone.trim(),
      createdAt: new Date().toISOString(),
    });

    refreshAll();
    setLastCreatedOwner(newO);
    setNewOwnerOpen(false);
    setOwnerName('');
    setOwnerEmail('');
    setOwnerPhone('+225 ');
    setPropertyName('');
    setOwnerBoundary(null);
    setOwnerPassword(`Proprio${Math.floor(1000 + Math.random() * 9000)}!`);
    toast({
      title: 'Propriétaire & identifiants créés !',
      description: `${newO.fullName} peut se connecter sur /sign-in avec ${newO.email} / ${newO.password}`,
      variant: 'success',
    });
  };

  // --- HABITANTS & COTISATIONS ---
  const [newHabitantOpen, setNewHabitantOpen] = useState(false);
  const [habitantName, setHabitantName] = useState('');
  const [habitantPhone, setHabitantPhone] = useState('+225 ');
  const [habitantEmail, setHabitantEmail] = useState('');
  const [residenceName, setResidenceName] = useState('');
  const [dwellingType, setDwellingType] = useState('Maison individuelle');
  const [rentOrCotisation, setRentOrCotisation] = useState(25000);

  const handleToggleHabitantPaid = (habitant: HabitantRecord) => {
    saveStoredHabitant({
      ...habitant,
      isPaid: !habitant.isPaid,
      paidAt: !habitant.isPaid ? new Date().toISOString() : undefined,
    });
    refreshAll();
    toast({
      title: !habitant.isPaid ? 'Cotisation marquée PAYÉE' : 'Statut réinitialisé',
      variant: !habitant.isPaid ? 'success' : 'info',
    });
  };

  const handleCreateHabitant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitantName.trim() || !residenceName.trim()) {
      toast({ title: 'Veuillez remplir le nom et la résidence.', variant: 'error' });
      return;
    }
    saveStoredHabitant({
      id: `hab-${Date.now()}`,
      fullName: habitantName.trim(),
      phone: habitantPhone.trim(),
      email: habitantEmail.trim() || undefined,
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      residenceName: residenceName.trim(),
      dwellingType,
      isOwner: false,
      rentOrCotisationAmount: Number(rentOrCotisation) || 25000,
      isPaid: false,
      createdAt: new Date().toISOString(),
    });
    refreshAll();
    setNewHabitantOpen(false);
    setHabitantName('');
    setResidenceName('');
    toast({ title: 'Habitant ajouté au bloc avec succès !', variant: 'success' });
  };

  // --- SIGNALEMENT DE MON BLOC -> CHEF DE QUARTIER ---
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentCategory, setIncidentCategory] =
    useState<QuartierIncidentRecord['category']>('SECURITY');
  const [incidentSeverity, setIncidentSeverity] =
    useState<QuartierIncidentRecord['severity']>('MEDIUM');

  const handleSendIncidentToNeighborhood = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim() || !incidentDesc.trim()) {
      toast({ title: 'Veuillez renseigner l’objet et la description du problème.', variant: 'error' });
      return;
    }
    const leaderDisplay = activeBlock.leaderName || user?.displayName || 'Chef de Bloc';
    const newInc: QuartierIncidentRecord = {
      id: `inc-${Date.now()}`,
      title: incidentTitle.trim(),
      description: incidentDesc.trim(),
      category: incidentCategory,
      severity: incidentSeverity,
      status: 'REPORTED',
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      neighborhoodId: activeNeighborhood.id,
      reportedBy: `${leaderDisplay} (Chef de ${activeBlock.name})`,
      reportedByRole: 'CHEF_DE_BLOC',
      escalatedToNeighborhood: true,
      escalatedAt: new Date().toISOString(),
      escalatedBy: leaderDisplay,
      targetLeaderName: activeNeighborhood.leaderName || 'Chef de Quartier',
      targetLeaderEmail: activeNeighborhood.leaderEmail || 'chef.quartier@katdestate.immo',
      createdAt: new Date().toISOString(),
    };
    saveStoredIncident(newInc);
    refreshAll();
    setIncidentTitle('');
    setIncidentDesc('');
    toast({
      title: 'Signalement envoyé au Chef de Quartier !',
      description: `Transmis directement à ${activeNeighborhood.leaderName || 'votre Chef de Quartier'}.`,
      variant: 'success',
    });
  };

  // --- MESSAGERIE AUX PROPRIÉTAIRES (GROUPE OU PRIVÉ) ---
  const [msgOwnerTarget, setMsgOwnerTarget] = useState<string>('ALL');
  const [msgOwnerSubject, setMsgOwnerSubject] = useState('');
  const [msgOwnerBody, setMsgOwnerBody] = useState('');

  const handleSendMessageToOwners = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgOwnerBody.trim()) return;

    const targetOwner = owners.find((o) => o.email.toLowerCase() === msgOwnerTarget.toLowerCase());
    sendHierarchyMessage({
      senderEmail: emailNorm || activeBlock.leaderEmail || 'chef.bloc@katdestate.immo',
      senderName: user?.displayName || activeBlock.leaderName || 'Chef de Bloc',
      senderRole: 'BLOCK_LEADER',
      recipientType: msgOwnerTarget === 'ALL' ? 'ALL_BLOCK_OWNERS' : 'OWNER',
      recipientEmail: msgOwnerTarget === 'ALL' ? undefined : targetOwner?.email,
      recipientName:
        msgOwnerTarget === 'ALL'
          ? `Tous les propriétaires (${owners.length})`
          : targetOwner?.fullName,
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      subject: msgOwnerSubject.trim() || 'Instruction du Chef de Bloc',
      body: msgOwnerBody.trim(),
    });
    refreshAll();
    setMsgOwnerSubject('');
    setMsgOwnerBody('');
    toast({
      title:
        msgOwnerTarget === 'ALL'
          ? 'Message groupé envoyé à tous les propriétaires !'
          : `Message envoyé à ${targetOwner?.fullName || 'propriétaire'} !`,
      variant: 'success',
    });
  };

  // --- MESSAGE AU CHEF DE QUARTIER ---
  const [msgQuartierSubject, setMsgQuartierSubject] = useState('');
  const [msgQuartierBody, setMsgQuartierBody] = useState('');

  const handleSendMessageToNeighborhoodLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgQuartierBody.trim()) return;

    sendHierarchyMessage({
      senderEmail: emailNorm || activeBlock.leaderEmail || 'chef.bloc@katdestate.immo',
      senderName: `${user?.displayName || activeBlock.leaderName || 'Chef de Bloc'} (${activeBlock.name})`,
      senderRole: 'BLOCK_LEADER',
      recipientType: 'NEIGHBORHOOD_LEADER',
      recipientEmail: activeNeighborhood.leaderEmail || 'chef.quartier@katdestate.immo',
      recipientName: activeNeighborhood.leaderName || 'Chef de Quartier',
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      subject: msgQuartierSubject.trim() || `Message du ${activeBlock.name}`,
      body: msgQuartierBody.trim(),
    });
    refreshAll();
    setMsgQuartierSubject('');
    setMsgQuartierBody('');
    toast({
      title: 'Message envoyé à votre Chef de Quartier !',
      description: `Destinataire : ${activeNeighborhood.leaderName || 'Chef de Quartier'}`,
      variant: 'success',
    });
  };

  // --- RAPPORT FINANCIER MENSUEL DES PROPRIÉTAIRES ---
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  const [selectedOwnerIdFilter, setSelectedOwnerIdFilter] = useState<string>('ALL');

  const ownerTenantsReport = useMemo(() => {
    const ownerPropIds = new Set(blockProperties.map((p) => p._id));
    const ownerEmails = new Set(owners.map((o) => o.email.toLowerCase()));

    const matched = tenants.filter((t) => {
      const propMatch = t.propertyId && ownerPropIds.has(t.propertyId);
      const emailMatch = (t as any).ownerEmail && ownerEmails.has(String((t as any).ownerEmail).toLowerCase());
      return propMatch || emailMatch;
    });

    // Normaliser en entrées financières mensuelles
    const rows = matched.map((t) => {
      const prop = blockProperties.find((p) => p._id === t.propertyId);
      const own = owners.find(
        (o) =>
          (prop?.geoOwnerId && o.id === prop.geoOwnerId) ||
          ((t as any).ownerEmail && o.email.toLowerCase() === String((t as any).ownerEmail).toLowerCase()),
      );
      const rawStatus = (t as any).paymentStatus || (t.status === 'ACTIVE' ? 'PAID' : 'UNPAID');
      const normalizedStatus: 'PAID' | 'LATE' | 'UNPAID' =
        rawStatus === 'PAID' || rawStatus === 'PAYE'
          ? 'PAID'
          : rawStatus === 'OVERDUE' || rawStatus === 'LATE' || rawStatus === 'EN_RETARD'
            ? 'LATE'
            : 'UNPAID';
      return {
        id: t._id,
        tenantName: (t as any).fullName || `${(t as any).firstName || ''} ${(t as any).lastName || ''}`.trim() || 'Locataire',
        phone: t.phone,
        propertyName: prop?.name || own?.propertyName || 'Propriété du bloc',
        ownerId: own?.id || 'unknown',
        ownerName: own?.fullName || 'Propriétaire du bloc',
        amount: (t as any).monthlyRent || own?.monthlyRentOrDues || 75000,
        status: normalizedStatus,
        month: selectedMonth,
      };
    });

    // Ajouter les propriétaires sans locataire enregistré dans le stockage local afin que leur suivi apparaisse
    owners.forEach((o) => {
      if (!rows.some((r) => r.ownerId === o.id)) {
        rows.push({
          id: `own-due-${o.id}`,
          tenantName: `Locataire principal (${o.propertyName || 'Résidence'})`,
          phone: o.phone,
          propertyName: o.propertyName || 'Bien du bloc',
          ownerId: o.id,
          ownerName: o.fullName,
          amount: o.monthlyRentOrDues || 100000,
          status:
            o.paymentStatus === 'PAID'
              ? 'PAID'
              : o.paymentStatus === 'OVERDUE'
                ? 'LATE'
                : 'UNPAID',
          month: selectedMonth,
        });
      }
    });

    return selectedOwnerIdFilter === 'ALL'
      ? rows
      : rows.filter((r) => r.ownerId === selectedOwnerIdFilter);
  }, [blockProperties, owners, tenants, selectedMonth, selectedOwnerIdFilter]);

  const financeStats = useMemo(() => {
    const paid = ownerTenantsReport.filter((r) => r.status === 'PAID');
    const late = ownerTenantsReport.filter((r) => r.status === 'LATE');
    const unpaid = ownerTenantsReport.filter((r) => r.status === 'UNPAID');
    return {
      paidCount: paid.length,
      paidSum: paid.reduce((s, r) => s + r.amount, 0),
      lateCount: late.length,
      lateSum: late.reduce((s, r) => s + r.amount, 0),
      unpaidCount: unpaid.length,
      unpaidSum: unpaid.reduce((s, r) => s + r.amount, 0),
    };
  }, [ownerTenantsReport]);

  // --- PUBLIER UNE ANNONCE PAR CATÉGORIE ---
  const [pubCategory, setPubCategory] = useState<string>(PUBLISH_CATEGORIES[0]!);
  const [pubTitle, setPubTitle] = useState('');
  const [pubPrice, setPubPrice] = useState(50000);
  const [pubSurface, setPubSurface] = useState(30);
  const [pubBedrooms, setPubBedrooms] = useState(1);
  const [pubCity, setPubCity] = useState('Abidjan');
  const [pubAddress, setPubAddress] = useState('');
  const [pubDescription, setPubDescription] = useState('');

  const handlePublishByCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pubTitle.trim() || !pubAddress.trim()) {
      toast({ title: 'Veuillez indiquer le titre et l’adresse du bien.', variant: 'error' });
      return;
    }
    const newItem: WorkflowListingItem = {
      _id: `lst-blk-${Date.now()}`,
      title: `[${pubCategory}] ${pubTitle.trim()}`,
      description: pubDescription.trim() || `${pubCategory} disponible dans le secteur ${activeBlock.name}`,
      category: pubCategory === 'Maison en Carabot' ? 'CARABOT' : 'CLASSIQUE',
      propertyType: pubCategory,
      transactionType: pubCategory === 'Terrain' ? 'SALE' : 'RENT',
      priceMinor: Number(pubPrice) || 50000,
      currency: 'FCFA',
      surfaceM2: Number(pubSurface) || 30,
      bedrooms: Number(pubBedrooms) || 1,
      status: 'PUBLISHED',
      workflowStatus: 'PUBLIE',
      location: {
        city: pubCity.trim() || 'Abidjan',
        district: activeNeighborhood.name,
        blockId: activeBlock.id,
        blockName: activeBlock.name,
        address: pubAddress.trim(),
      },
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80',
          label: 'EXTERIEUR',
        },
      ],
      authorId: user?.id || 'block-leader',
      authorName: user?.displayName || activeBlock.leaderName || 'Chef de Bloc',
      contact: {
        name: user?.displayName || activeBlock.leaderName || 'Chef de Bloc',
        phone: activeBlock.leaderPhone || '+225 07 11 22 33 44',
        whatsapp: activeBlock.leaderPhone || '+225 07 11 22 33 44',
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...listings];
    saveWorkflowListings(updated);
    refreshAll();
    setPubTitle('');
    setPubAddress('');
    setPubDescription('');
    toast({
      title: `Bien publié dans la catégorie « ${pubCategory} » !`,
      description: 'L’annonce est visible publiquement sur la Marketplace.',
      variant: 'success',
    });
  };

  const tabHeaderMeta: Record<BlockTab, { title: string; subtitle: string }> = {
    cartographie: {
      title: `Carte du Secteur : ${activeBlock.name}`,
      subtitle: `Votre quartier (${activeNeighborhood.name}) et votre bloc assigné par votre Chef de Quartier.`,
    },
    proprietaires: {
      title: `Gestion des Propriétaires (${activeBlock.name})`,
      subtitle:
        'Créez les propriétaires et leurs identifiants, suivez leurs statistiques (propriétés & locataires) et visualisez leurs biens sur la carte de votre bloc.',
    },
    habitants: {
      title: `Habitants & Cotisations (${activeBlock.name})`,
      subtitle: 'Recensement de proximité et suivi des cotisations mensuelles.',
    },
    incidents: {
      title: `Signalement de mon Bloc → Chef de Quartier`,
      subtitle: `Envoyez directement un signalement au Chef de Quartier (${activeNeighborhood.leaderName || 'Chefferie'}) concernant un problème dans votre bloc.`,
    },
    'messagerie-proprietaires': {
      title: 'Messagerie aux Propriétaires du Bloc',
      subtitle:
        'Envoyez un message groupé à tous les propriétaires ou sélectionnez un propriétaire précis, et consultez leurs messages reçus.',
    },
    'messagerie-quartier': {
      title: 'Message au Chef de Quartier',
      subtitle: `Communiquez directement avec votre Chef de Quartier (${activeNeighborhood.leaderName || 'Autorité Coutumière'}).`,
    },
    'rapport-financier': {
      title: 'Rapport Financier des Propriétaires',
      subtitle:
        'Suivi mensuel des paiements de chaque locataire des propriétaires que vous avez créés (Payé, En retard, Non payé).',
    },
    'publier-annonce': {
      title: 'Publier une Annonce par Catégorie',
      subtitle: 'Publiez les biens immobiliers de votre choix par catégorie sur la Marketplace.',
    },
  };

  // Préparation des marqueurs de propriétés pour les cartes du bloc
  const propertyMarkers = useMemo(() => {
    return blockProperties
      .filter((p) => {
        const lat = typeof p.latitude === 'number' ? p.latitude : p.location?.coordinates?.[1];
        const lng = typeof p.longitude === 'number' ? p.longitude : p.location?.coordinates?.[0];
        return typeof lat === 'number' && typeof lng === 'number';
      })
      .map((p) => {
        const lat = typeof p.latitude === 'number' ? p.latitude : p.location!.coordinates[1];
        const lng = typeof p.longitude === 'number' ? p.longitude : p.location!.coordinates[0];
        return {
          id: p._id,
          level: 'PROPERTY' as const,
          title: p.name,
          subtitle: p.address,
          position: { lat, lng },
          color: '#f59e0b',
          propertyDetails: {
            propertyId: p._id,
            name: p.name,
            type: p.customPropertyType || p.type || 'Bien Immobilier',
            address: p.address,
            city: p.city,
            country: p.country,
            neighborhood: p.neighborhoodName || activeNeighborhood.name,
            roomsCount:
              p.roomsCount || (p.chambreSimpleCount || 0) + (p.chambreModerneCount || 0),
            status: p.status,
            photoUrl: (p as any).mainPhotoUrl || (p as any).photos?.[0],
            currency: 'FCFA',
          },
        };
      });
  }, [blockProperties, activeNeighborhood.name]);

  return (
    <div className="space-y-6">
      {/* Header Banner Chef de Bloc */}
      <div className="flex flex-col gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-card via-card to-cyan-500/5 p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white font-black text-xs shadow-md">
              🛡️
            </span>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {tabHeaderMeta[tab]?.title || 'Espace Chef de Bloc'}
            </h1>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              {activeBlock.code} · {activeNeighborhood.name}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{tabHeaderMeta[tab]?.subtitle}</p>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border text-[11px] text-muted-foreground">
          <Shield className="h-4 w-4 text-cyan-500 shrink-0" />
          <span>Périmètre assigné : {activeBlock.name}</span>
        </div>
      </div>

      {/* Barre d'onglets : MASQUÉE en mode isolé (clic depuis un bouton du dashboard) */}
      {!isIsolatedMode && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
          <button
            type="button"
            onClick={() => setTab('cartographie')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'cartographie'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Carte du Secteur</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('proprietaires')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'proprietaires'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Gestion des Propriétaires ({owners.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('rapport-financier')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'rapport-financier'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>Rapport Financier Propriétaires</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('incidents')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'incidents'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Flame className="h-4 w-4" />
            <span>Signalement de mon Bloc</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('messagerie-proprietaires')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'messagerie-proprietaires'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Messagerie Propriétaires</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('messagerie-quartier')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'messagerie-quartier'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Crown className="h-4 w-4" />
            <span>Message Chef de Quartier</span>
          </button>

          <button
            type="button"
            onClick={() => setTab('publier-annonce')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              tab === 'publier-annonce'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Plus className="h-4 w-4" />
            <span>Publier une Annonce</span>
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 1. CARTE DU SECTEUR UNIQUEMENT (SON QUARTIER + SON BLOC ASSIGNÉ)      */}
      {/* ===================================================================== */}
      {tab === 'cartographie' && (
        <div className="space-y-4">
          <GeoMapCanvas
            title={`Quartier : ${activeNeighborhood.name} — Bloc : ${activeBlock.name}`}
            subtitle={
              activeBlock.boundary
                ? `Superficie du bloc : ${(activeBlock.targetAreaM2 || Math.round(computePolygonAreaM2(activeBlock.boundary))).toLocaleString('fr-FR')} m²`
                : 'Périmètre assigné par votre Chef de Quartier'
            }
            heightClassName="h-[540px]"
            initialCenter={(() => {
              const b = activeBlock.boundary || activeNeighborhood.boundary;
              const ring = b?.type === 'Polygon' ? b.coordinates?.[0] : b?.coordinates?.[0]?.[0];
              if (!Array.isArray(ring) || ring.length === 0) return undefined;
              const lng = ring.reduce((s: number, c: any) => s + Number(c[0]), 0) / ring.length;
              const lat = ring.reduce((s: number, c: any) => s + Number(c[1]), 0) / ring.length;
              return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
            })()}
            overlays={[
              ...(activeNeighborhood.boundary
                ? [
                    {
                      id: activeNeighborhood.id,
                      level: 'NEIGHBORHOOD' as const,
                      label: `Quartier : ${activeNeighborhood.name}`,
                      boundary: activeNeighborhood.boundary,
                      color: '#7c3aed',
                      fillOpacity: 0.05,
                      strokeWeight: 2,
                      locked: true,
                    },
                  ]
                : []),
              ...(activeBlock.boundary
                ? [
                    {
                      id: activeBlock.id,
                      level: 'BLOCK' as const,
                      label: `Mon Bloc : ${activeBlock.name}`,
                      boundary: activeBlock.boundary,
                      color: activeBlock.color || '#06b6d4',
                      fillOpacity: 0.18,
                      strokeWeight: 3,
                      locked: true,
                    },
                  ]
                : []),
            ]}
            markers={propertyMarkers}
            legendItems={[
              { label: `Quartier (${activeNeighborhood.name})`, color: '#7c3aed' },
              { label: `Mon Bloc (${activeBlock.name})`, color: activeBlock.color || '#06b6d4' },
              { label: `Propriétés (${propertyMarkers.length})`, color: '#f59e0b' },
            ]}
            focusTarget={{
              boundary: activeBlock.boundary || activeNeighborhood.boundary || null,
              key: `sector-${activeBlock.id}`,
            }}
          />
        </div>
      )}

      {/* ===================================================================== */}
      {/* 2. GESTION DES PROPRIÉTAIRES (CRÉER + STATS + CARTE MARQUÉE)          */}
      {/* ===================================================================== */}
      {tab === 'proprietaires' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Propriétaires du {activeBlock.name} ({owners.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Créez vos propriétaires avec leurs identifiants, suivez leurs statistiques de propriétés et locataires, et visualisez leurs biens sur votre carte.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewOwnerOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <UserCheck className="size-4" />+ Créer un Propriétaire & Identifiants
            </Button>
          </div>

          {lastCreatedOwner && (
            <Card className="p-4 border-emerald-500/40 bg-emerald-500/10 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-emerald-600 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  Identifiants du propriétaire « {lastCreatedOwner.fullName} » générés :
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setLastCreatedOwner(null)}
                >
                  Fermer
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-background/80 p-3 border border-border">
                <span>
                  Email : <strong className="font-mono">{lastCreatedOwner.email}</strong>
                </span>
                <span>•</span>
                <span>
                  Mot de passe : <strong className="font-mono">{lastCreatedOwner.password}</strong>
                </span>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2.5 text-[11px] ml-auto"
                  onClick={() => {
                    void navigator.clipboard.writeText(
                      `Identifiants Propriétaire KatdEstate\nEmail : ${lastCreatedOwner.email}\nMot de passe : ${lastCreatedOwner.password}\nConnexion : ${window.location.origin}/sign-in`,
                    );
                    toast({ title: 'Identifiants copiés !', variant: 'success' });
                  }}
                >
                  <Copy className="size-3 mr-1" />
                  Copier
                </Button>
              </div>
            </Card>
          )}

          {/* Liste des propriétaires avec leurs statistiques (Propriétés & Locataires) */}
          <div className="grid gap-3 md:grid-cols-2">
            {owners.map((o) => {
              const ownerProps = blockProperties.filter((p) => p.geoOwnerId === o.id);
              const ownerTenantsCount = tenants.filter((t) =>
                ownerProps.some((p) => p._id === t.propertyId) ||
                ((t as any).ownerEmail && String((t as any).ownerEmail).toLowerCase() === o.email.toLowerCase()),
              ).length;

              return (
                <Card key={o.id} className="p-4 space-y-3 border-border text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-sm text-foreground">{o.fullName}</p>
                      <p className="text-muted-foreground">
                        {o.propertyName} ({o.propertyType}) • Tél : <strong>{o.phone}</strong>
                      </p>
                    </div>
                    <span className="rounded bg-cyan-500/20 text-cyan-600 px-2 py-0.5 text-[10px] font-bold">
                      RATTACHÉ BLOC
                    </span>
                  </div>

                  {/* Statistiques Propriétés & Locataires */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl border border-border bg-muted/20 p-2">
                      <p className="text-[10px] text-muted-foreground">Propriétés</p>
                      <p className="text-base font-black text-amber-500">
                        {Math.max(ownerProps.length, o.propertyName ? 1 : 0)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-2">
                      <p className="text-[10px] text-muted-foreground">Locataires</p>
                      <p className="text-base font-black text-emerald-500">{ownerTenantsCount}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-muted/20 p-2">
                      <p className="text-[10px] text-muted-foreground">Loyer / Cotis.</p>
                      <p className="text-xs font-black text-foreground mt-0.5">
                        {o.monthlyRentOrDues.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/20 px-2.5 py-1.5 text-[11px]">
                    <KeyRound className="size-3.5 text-cyan-500" />
                    <span>
                      Email : <strong className="font-mono">{o.email}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Pass : <strong className="font-mono">{o.password}</strong>
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Carte marquée des propriétés des propriétaires dans la zone délimitée */}
          <Card className="p-4 space-y-3 border-cyan-500/30">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <MapPin className="size-4 text-amber-500" />
                Carte des Propriétés enregistrées dans votre bloc ({propertyMarkers.length} marquée(s))
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Toutes les propriétés enregistrées par vos propriétaires dans la zone délimitée apparaissent automatiquement ci-dessous.
              </p>
            </div>
            <GeoMapCanvas
              title={`Biens enregistrés — ${activeBlock.name}`}
              heightClassName="h-[420px]"
              overlays={[
                ...(activeBlock.boundary
                  ? [
                      {
                        id: activeBlock.id,
                        level: 'BLOCK' as const,
                        label: activeBlock.name,
                        boundary: activeBlock.boundary,
                        color: activeBlock.color || '#06b6d4',
                        fillOpacity: 0.12,
                        strokeWeight: 2,
                        locked: true,
                      },
                    ]
                  : []),
                ...owners
                  .filter((o) => o.assignedBoundary)
                  .map((o) => ({
                    id: o.id,
                    level: 'OWNER' as const,
                    label: `Secteur : ${o.fullName}`,
                    boundary: o.assignedBoundary!,
                    color: '#10b981',
                    fillOpacity: 0.16,
                    strokeWeight: 2,
                    locked: true,
                  })),
              ]}
              markers={propertyMarkers}
              focusTarget={{
                boundary: activeBlock.boundary || activeNeighborhood.boundary || null,
                key: `owners-map-${owners.length}-${propertyMarkers.length}`,
              }}
            />
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 3. HABITANTS & COTISATIONS                                            */}
      {/* ===================================================================== */}
      {tab === 'habitants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Habitants & Cotisations du {activeBlock.name} ({habitants.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Suivez les habitants de votre bloc et marquez les cotisations payées.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewHabitantOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="size-4" />+ Ajouter un habitant
            </Button>
          </div>

          <div className="space-y-2">
            {habitants.map((h) => (
              <Card
                key={h.id}
                className="p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs border-border"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{h.fullName}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        h.isPaid
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-amber-500/20 text-amber-600'
                      }`}
                    >
                      {h.isPaid ? 'PAYÉ' : 'IMPAYÉ'}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    <strong>{h.residenceName}</strong> ({h.dwellingType}) •{' '}
                    <strong>{h.rentOrCotisationAmount.toLocaleString('fr-FR')} FCFA</strong>
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={h.isPaid ? 'outline' : 'primary'}
                  onClick={() => handleToggleHabitantPaid(h)}
                  className={
                    !h.isPaid ? 'bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs' : 'h-8 text-xs'
                  }
                >
                  {h.isPaid ? 'Annuler' : 'Marquer PAYÉ'}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 4. SIGNALEMENT DE MON BLOC -> CHEF DE QUARTIER UNIQUEMENT             */}
      {/* ===================================================================== */}
      {tab === 'incidents' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4 border-red-500/30">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Flame className="size-4 text-red-500" />
                Envoyer un signalement à votre Chef de Quartier
              </h2>
              <p className="text-xs text-muted-foreground">
                Destinataire : <strong>{activeNeighborhood.leaderName || 'Chef de Quartier'}</strong> ({activeNeighborhood.name})
              </p>
            </div>

            <form onSubmit={handleSendIncidentToNeighborhood} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Objet du problème rencontré *</label>
                <Input
                  value={incidentTitle}
                  onChange={(e) => setIncidentTitle(e.target.value)}
                  placeholder="Ex : Litige de parcelle ou problème de sécurité dans le bloc"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Catégorie</label>
                  <select
                    value={incidentCategory}
                    onChange={(e) => setIncidentCategory(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-input px-2.5 bg-background text-xs"
                  >
                    <option value="SECURITY">Sécurité</option>
                    <option value="DISPUTE">Litige Foncier / Voisinage</option>
                    <option value="SANITATION">Salubrité / Voirie</option>
                    <option value="FIRE">Sinistre / Incendie</option>
                    <option value="NOISE">Nuisance</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold block mb-1">Urgence</label>
                  <select
                    value={incidentSeverity}
                    onChange={(e) => setIncidentSeverity(e.target.value as any)}
                    className="w-full h-9 rounded-xl border border-input px-2.5 bg-background text-xs"
                  >
                    <option value="LOW">Faible</option>
                    <option value="MEDIUM">Moyenne</option>
                    <option value="HIGH">Élevée</option>
                    <option value="URGENT">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Description détaillée *</label>
                <textarea
                  rows={4}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Décrivez précisément le problème rencontré dans votre bloc..."
                  required
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
                />
              </div>
              <Button type="submit" className="w-full bg-red-600 hover:bg-red-500 text-white font-bold">
                <Send className="size-4 mr-1.5" />
                Envoyer le signalement au Chef de Quartier
              </Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3 border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Signalements transmis au Chef de Quartier ({incidents.length})
            </h3>
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
              {incidents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun signalement envoyé pour le moment.</p>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.id} className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{inc.title}</span>
                      <span className="rounded bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{inc.description}</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">
                      ✅ Transmis au Chef de Quartier • {new Date(inc.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 5. MESSAGERIE AUX PROPRIÉTAIRES (GROUPE OU CHOIX PRÉCIS + RÉCEPTIONS) */}
      {/* ===================================================================== */}
      {tab === 'messagerie-proprietaires' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4 border-purple-500/30">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="size-4 text-purple-500" />
              Envoyer un message aux propriétaires
            </h2>

            <form onSubmit={handleSendMessageToOwners} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Destinataire(s) :</label>
                <select
                  value={msgOwnerTarget}
                  onChange={(e) => setMsgOwnerTarget(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="ALL">
                    📢 Tous les propriétaires de mon bloc ({owners.length}) — Message groupé
                  </option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.email}>
                      👤 {o.fullName} ({o.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Objet</label>
                <Input
                  value={msgOwnerSubject}
                  onChange={(e) => setMsgOwnerSubject(e.target.value)}
                  placeholder="Ex : Réunion de bloc ou rappel de cotisation"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Message *</label>
                <textarea
                  rows={4}
                  value={msgOwnerBody}
                  onChange={(e) => setMsgOwnerBody(e.target.value)}
                  placeholder="Rédigez votre message..."
                  required
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs"
                />
              </div>
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold">
                <Send className="size-4 mr-1.5" />
                {msgOwnerTarget === 'ALL'
                  ? 'Envoyer à tous les propriétaires'
                  : 'Envoyer au propriétaire sélectionné'}
              </Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3 border-border">
            <h3 className="text-sm font-bold text-foreground">
              Boîte de réception & Messages échangés avec les propriétaires
            </h3>
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {hierarchyMsgs
                .filter(
                  (m) =>
                    m.blockId === activeBlock.id &&
                    (m.recipientType === 'ALL_BLOCK_OWNERS' ||
                      m.recipientType === 'OWNER' ||
                      (m.senderRole === 'OWNER' && m.recipientType === 'BLOCK_LEADER')),
                )
                .map((m) => (
                  <div key={m.id} className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">
                        {m.senderRole === 'OWNER' ? `📥 De : ${m.senderName}` : `📤 À : ${m.recipientName}`}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="font-semibold text-primary">{m.subject}</p>
                    <p className="text-muted-foreground">{m.body}</p>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 6. MESSAGE AU CHEF DE QUARTIER                                        */}
      {/* ===================================================================== */}
      {tab === 'messagerie-quartier' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card className="p-5 space-y-4 border-indigo-500/30">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Crown className="size-4 text-purple-500" />
                Écrire à mon Chef de Quartier
              </h2>
              <p className="text-xs text-muted-foreground">
                Destinataire : <strong>{activeNeighborhood.leaderName || 'Chef de Quartier'}</strong> ({activeNeighborhood.name})
              </p>
            </div>

            <form onSubmit={handleSendMessageToNeighborhoodLeader} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Objet</label>
                <Input
                  value={msgQuartierSubject}
                  onChange={(e) => setMsgQuartierSubject(e.target.value)}
                  placeholder="Ex : Point d'avancement du bloc ou demande d'audience"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Message *</label>
                <textarea
                  rows={4}
                  value={msgQuartierBody}
                  onChange={(e) => setMsgQuartierBody(e.target.value)}
                  placeholder="Écrivez votre message au Chef de Quartier..."
                  required
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs"
                />
              </div>
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold">
                <Send className="size-4 mr-1.5" />
                Envoyer au Chef de Quartier
              </Button>
            </form>
          </Card>

          <Card className="p-4 space-y-2 border-border">
            <h3 className="text-xs font-bold text-foreground">
              Fil de discussion avec votre Chef de Quartier
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {hierarchyMsgs
                .filter(
                  (m) =>
                    (m.recipientType === 'NEIGHBORHOOD_LEADER' && m.blockId === activeBlock.id) ||
                    (m.senderRole === 'NEIGHBORHOOD_LEADER' &&
                      (!m.blockId ||
                        m.blockId === activeBlock.id ||
                        (emailNorm && m.recipientEmail?.trim().toLowerCase() === emailNorm))),
                )
                .map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-xl border p-3 text-xs space-y-1 ${
                      m.senderRole === 'NEIGHBORHOOD_LEADER'
                        ? 'border-purple-500/30 bg-purple-500/10 mr-4'
                        : 'border-indigo-500/30 bg-indigo-500/10 ml-4'
                    }`}
                  >
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <strong className="text-foreground">
                        {m.senderName} ({m.senderRole === 'NEIGHBORHOOD_LEADER' ? 'Chef de Quartier' : 'Moi — Chef de Bloc'}) · {m.subject}
                      </strong>
                      <span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="text-foreground">{m.body}</p>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 7. RAPPORT FINANCIER DES PROPRIÉTAIRES (PAIEMENTS LOCATAIRES MENSUELS)*/}
      {/* ===================================================================== */}
      {tab === 'rapport-financier' && (
        <div className="space-y-5">
          {/* Filtres Mois & Propriétaire */}
          <Card className="p-4 flex flex-wrap items-center justify-between gap-3 border-border">
            <div className="flex items-center gap-2 text-xs">
              <TrendingUp className="size-4 text-emerald-500" />
              <span className="font-bold text-foreground">Suivi Mensuel des Loyers des Locataires :</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
              />
              <select
                value={selectedOwnerIdFilter}
                onChange={(e) => setSelectedOwnerIdFilter(e.target.value)}
                className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
              >
                <option value="ALL">Tous mes propriétaires ({owners.length})</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Statistiques : Ayant Payé / En Retard / Non Payé */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <p className="text-xs font-bold text-emerald-600">Locataires Ayant Payé</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {financeStats.paidCount} locataire(s)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total : {financeStats.paidSum.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <p className="text-xs font-bold text-amber-600">Locataires En Retard</p>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {financeStats.lateCount} locataire(s)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total : {financeStats.lateSum.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-red-500/30 bg-red-500/5">
              <p className="text-xs font-bold text-red-600">Locataires Non Payés</p>
              <p className="text-2xl font-black text-red-600 mt-1">
                {financeStats.unpaidCount} locataire(s)
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Total : {financeStats.unpaidSum.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>
          </div>

          {/* Détail des paiements par locataire & propriétaire */}
          <Card className="p-4 space-y-3 border-border">
            <h3 className="text-sm font-bold text-foreground">
              Détail des paiements — Mois {selectedMonth}
            </h3>
            {ownerTenantsReport.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun paiement locataire enregistré pour ce filtre.
              </p>
            ) : (
              <div className="space-y-2">
                {ownerTenantsReport.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-foreground">{row.tenantName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Propriétaire : <strong>{row.ownerName}</strong> • Bien : {row.propertyName} • Tél : {row.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-foreground">
                        {row.amount.toLocaleString('fr-FR')} FCFA
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          row.status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : row.status === 'LATE'
                              ? 'bg-amber-500/20 text-amber-600'
                              : 'bg-red-500/20 text-red-600'
                        }`}
                      >
                        {row.status === 'PAID'
                          ? '✅ Payé'
                          : row.status === 'LATE'
                            ? '⏳ En retard'
                            : '❌ Non payé'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ===================================================================== */}
      {/* 8. PUBLIER UNE ANNONCE PAR CATÉGORIE                                  */}
      {/* ===================================================================== */}
      {tab === 'publier-annonce' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="p-5 space-y-4 border-cyan-500/30">
            <div>
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Building2 className="size-4 text-cyan-500" />
                Publier un bien immobilier sur la Marketplace (par catégorie)
              </h2>
              <p className="text-xs text-muted-foreground">
                Sélectionnez la catégorie du bien que vous souhaitez publier.
              </p>
            </div>

            <form onSubmit={handlePublishByCategory} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Catégorie du bien *</label>
                <select
                  value={pubCategory}
                  onChange={(e) => setPubCategory(e.target.value)}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                >
                  {PUBLISH_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-semibold block mb-1">Titre de l'annonce *</label>
                <Input
                  value={pubTitle}
                  onChange={(e) => setPubTitle(e.target.value)}
                  placeholder="Ex : Bel appartement 3 pièces climatisé"
                  required
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Prix (FCFA) *</label>
                  <Input
                    type="number"
                    value={pubPrice}
                    onChange={(e) => setPubPrice(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Surface (m²)</label>
                  <Input
                    type="number"
                    value={pubSurface}
                    onChange={(e) => setPubSurface(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Pièces</label>
                  <Input
                    type="number"
                    value={pubBedrooms}
                    onChange={(e) => setPubBedrooms(Number(e.target.value))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold block mb-1">Ville *</label>
                  <Input
                    value={pubCity}
                    onChange={(e) => setPubCity(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Adresse / Rue *</label>
                  <Input
                    value={pubAddress}
                    onChange={(e) => setPubAddress(e.target.value)}
                    placeholder="Ex : Rue des Palmiers"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">Description</label>
                <textarea
                  rows={3}
                  value={pubDescription}
                  onChange={(e) => setPubDescription(e.target.value)}
                  placeholder="Décrivez les atouts du bien..."
                  className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
                />
              </div>
              <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                <Send className="size-4 mr-1.5" />
                Publier dans la catégorie « {pubCategory} »
              </Button>
            </form>
          </Card>

          <Card className="p-5 space-y-3 border-border">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Home className="size-4 text-emerald-500" />
              Mes publications récentes ({listings.filter((l) => l.location?.blockId === activeBlock.id).length})
            </h3>
            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {listings
                .filter((l) => l.location?.blockId === activeBlock.id)
                .map((l) => (
                  <div key={l._id} className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-foreground">{l.title}</span>
                      <span className="rounded bg-emerald-500/20 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                        PUBLIÉ
                      </span>
                    </div>
                    <p className="text-primary font-black">
                      {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {l.location.address}, {l.location.city} • {l.surfaceM2} m²
                    </p>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      )}

      {/* MODAL : CRÉER UN PROPRIÉTAIRE + IDENTIFIANTS */}
      <Modal
        open={newOwnerOpen}
        onOpenChange={setNewOwnerOpen}
        title="Créer un Propriétaire & ses Identifiants de connexion"
        className="max-w-2xl"
      >
        <form onSubmit={handleCreateOwner} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet du propriétaire *</label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Ex : M. Adama Koné"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email de connexion *</label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="proprio@katdestate.immo"
                required
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Mot de passe *</label>
            <div className="flex gap-1.5">
              <Input
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                required
              />
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-2 text-[11px]"
                onClick={() =>
                  setOwnerPassword(`Proprio${Math.floor(1000 + Math.random() * 9000)}!`)
                }
              >
                Générer
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Nom du bien principal</label>
              <Input
                value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
                placeholder="Ex : Immeuble Émeraude"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Ville / Secteur assigné</label>
              <Input
                value={`${activeNeighborhood.city || activeNeighborhood.name} — ${activeBlock.name}`}
                disabled
              />
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border border-cyan-500/30">
            <GeoMapCanvas
              title={`Ville : ${activeNeighborhood.city || activeNeighborhood.name} · Mon Bloc : ${activeBlock.name}`}
              subtitle="Tous les propriétaires créés seront automatiquement rattachés à votre bloc ci-dessous."
              heightClassName="h-52"
              initialCenter={(() => {
                const b = activeBlock.boundary || activeNeighborhood.boundary;
                const ring = b?.type === 'Polygon' ? b.coordinates?.[0] : b?.coordinates?.[0]?.[0];
                if (!Array.isArray(ring) || ring.length === 0) return undefined;
                const lng = ring.reduce((s: number, c: any) => s + Number(c[0]), 0) / ring.length;
                const lat = ring.reduce((s: number, c: any) => s + Number(c[1]), 0) / ring.length;
                return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
              })()}
              overlays={[
                ...(activeNeighborhood.boundary
                  ? [
                      {
                        id: activeNeighborhood.id,
                        level: 'NEIGHBORHOOD' as const,
                        label: `Quartier : ${activeNeighborhood.name}`,
                        boundary: activeNeighborhood.boundary,
                        color: '#7c3aed',
                        fillOpacity: 0.05,
                        strokeWeight: 2,
                        locked: true,
                      },
                    ]
                  : []),
                ...(activeBlock.boundary
                  ? [
                      {
                        id: activeBlock.id,
                        level: 'BLOCK' as const,
                        label: `Mon Bloc : ${activeBlock.name}`,
                        boundary: activeBlock.boundary,
                        color: activeBlock.color || '#06b6d4',
                        fillOpacity: 0.22,
                        strokeWeight: 3,
                        locked: true,
                      },
                    ]
                  : []),
              ]}
              focusTarget={{
                boundary: activeBlock.boundary || activeNeighborhood.boundary || null,
                key: `modal-owner-${activeBlock.id}`,
              }}
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Type de bien</label>
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="w-full h-9 rounded-xl border border-input px-2 bg-background text-xs"
            >
              <option value="Immeuble résidentiel">Immeuble résidentiel</option>
              <option value="Cour commune">Cour commune</option>
              <option value="Villa duplex">Villa duplex</option>
              <option value="Terrain bâti">Terrain bâti</option>
            </select>
          </div>
          <div>
            <label className="font-semibold block mb-1">Cotisation / Loyer mensuel attendu (FCFA)</label>
            <Input
              type="number"
              value={monthlyDues}
              onChange={(e) => setMonthlyDues(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <label className="font-semibold block">
              Délimiter le secteur du propriétaire dans votre bloc (optionnel) :
            </label>
            <GeoMapCanvas
              title="Secteur du propriétaire"
              heightClassName="h-[220px]"
              allowPolygonDraw={true}
              activeBoundary={ownerBoundary}
              onBoundaryChange={setOwnerBoundary}
              overlays={
                activeBlock.boundary
                  ? [
                      {
                        id: activeBlock.id,
                        level: 'BLOCK',
                        label: activeBlock.name,
                        boundary: activeBlock.boundary,
                        color: '#06b6d4',
                        fillOpacity: 0.1,
                        strokeWeight: 2,
                        locked: true,
                      },
                    ]
                  : []
              }
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewOwnerOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Créer le Propriétaire
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : AJOUTER UN HABITANT */}
      <Modal
        open={newHabitantOpen}
        onOpenChange={setNewHabitantOpen}
        title={`Ajouter un habitant dans ${activeBlock.name}`}
      >
        <form onSubmit={handleCreateHabitant} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet *</label>
            <Input
              value={habitantName}
              onChange={(e) => setHabitantName(e.target.value)}
              placeholder="Ex : Mme Mariam Traoré"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={habitantPhone}
                onChange={(e) => setHabitantPhone(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email</label>
              <Input
                type="email"
                value={habitantEmail}
                onChange={(e) => setHabitantEmail(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Résidence / Adresse *</label>
            <Input
              value={residenceName}
              onChange={(e) => setResidenceName(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Type de logement</label>
              <select
                value={dwellingType}
                onChange={(e) => setDwellingType(e.target.value)}
                className="w-full h-9 rounded-xl border border-input px-2 bg-background text-xs"
              >
                <option value="Maison individuelle">Maison individuelle</option>
                <option value="Cour commune">Cour commune</option>
                <option value="Studio">Studio</option>
                <option value="Appartement">Appartement</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Cotisation (FCFA)</label>
              <Input
                type="number"
                value={rentOrCotisation}
                onChange={(e) => setRentOrCotisation(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewHabitantOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer l'habitant
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
