import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Award,
  Building,
  Building2,
  Copy,
  Crown,
  Download,
  Home,
  KeyRound,
  MapPin,
  MessageSquare,
  Plus,
  Printer,
  Send,
  Shield,
  Trash2,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { GeoJsonBoundary } from '@rentflow/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';
import { useSession } from '../../app/session';
import { NeighborhoodGeoPanel } from '../../components/geo/NeighborhoodGeoPanel';
import { GeoMapCanvas } from '../../components/geo/GeoMapCanvas';
import { getLocalProperties, type Property } from '../properties';
import {
  getBlockLeaders,
  getBlockOwners,
  saveBlockLeader,
  saveRegisteredUser,
  deleteBlockLeader,
  getStoredBlocks,
  getStoredNeighborhoods,
  createBlock,
  updateStoredBlock,
  getStoredHabitants,
  getHierarchyMessages,
  sendHierarchyMessage,
  reassignHabitantBlock,
  type DirectHierarchyMessage,
  getWorkflowListings,
  getOfficialCertificates,
  saveOfficialCertificate,
  getStoredIncidents,
  type BlockLeaderRecord,
  type BlockOwnerRecord,
  type BlockRecord,
  type HabitantRecord,
  type WorkflowListingItem,
  type OfficialCertificateRecord,
} from '../../lib/katdestate-store';

type LeaderTab =
  | 'blocks'
  | 'leaders'
  | 'habitants'
  | 'finances'
  | 'attestations'
  | 'broadcast'
  | 'cartographie'
  | 'incidents';

const VALID_TABS: LeaderTab[] = [
  'blocks',
  'leaders',
  'habitants',
  'finances',
  'attestations',
  'broadcast',
  'cartographie',
  'incidents',
];

export function NeighborhoodLeaderDashboard() {
  const { user } = useSession();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as LeaderTab | null;
  const isIsolatedMode = Boolean(urlTab && VALID_TABS.includes(urlTab));

  const [activeTab, setActiveTab] = useState<LeaderTab>(() =>
    urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'leaders',
  );

  useEffect(() => {
    if (urlTab && VALID_TABS.includes(urlTab)) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  // Local data states
  const [blocks, setBlocks] = useState<BlockRecord[]>(() => getStoredBlocks());
  const [leaders, setLeaders] = useState<BlockLeaderRecord[]>(() => getBlockLeaders());
  const [owners, setOwners] = useState<BlockOwnerRecord[]>(() => getBlockOwners());
  const [properties, setProperties] = useState<Property[]>(() => getLocalProperties());
  const [habitants, setHabitants] = useState<HabitantRecord[]>(() => getStoredHabitants());
  const [listings, setListings] = useState<WorkflowListingItem[]>(() => getWorkflowListings());
  const [certificates, setCertificates] = useState<OfficialCertificateRecord[]>(() =>
    getOfficialCertificates(),
  );
  const [incidents] = useState(() => getStoredIncidents());
  const escalatedIncidents = useMemo(
    () => incidents.filter((i) => i.escalatedToNeighborhood || i.reportedByRole === 'CHEF_DE_BLOC'),
    [incidents],
  );

  const refreshAll = () => {
    setBlocks(getStoredBlocks());
    setLeaders(getBlockLeaders());
    setOwners(getBlockOwners());
    setProperties(getLocalProperties());
    setHabitants(getStoredHabitants());
    setListings(getWorkflowListings());
    setCertificates(getOfficialCertificates());
    setHierarchyMsgs(getHierarchyMessages());
  };

  // Modals state
  const [newLeaderModalOpen, setNewLeaderModalOpen] = useState(false);
  const [newBlockModalOpen, setNewBlockModalOpen] = useState(false);
  const [newCertModalOpen, setNewCertModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);

  // Selected item states
  const [selectedHabitant, setSelectedHabitant] = useState<HabitantRecord | null>(null);
  const [reassignBlockId, setReassignBlockId] = useState('');

  // Form states for new Leader (+ délimitation de zone sur carte)
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('+225 ');
  const [leaderPassword, setLeaderPassword] = useState('ChefBloc2026!');
  const [leaderBlockId, setLeaderBlockId] = useState(blocks[0]?.id || 'block-1');
  const [leaderNewZoneName, setLeaderNewZoneName] = useState('');
  const [leaderBoundary, setLeaderBoundary] = useState<GeoJsonBoundary | null>(null);

  // Form states for new Block
  const [blockName, setBlockName] = useState('');
  const [blockCode, setBlockCode] = useState('');

  // Form states for new Certificate
  const [certType, setCertType] =
    useState<OfficialCertificateRecord['type']>('RESIDENCE');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('+225 ');
  const [beneficiaryIdNumber, setBeneficiaryIdNumber] = useState('');
  const [certBlockId, setCertBlockId] = useState(blocks[0]?.id || 'block-1');
  const [plotNumber, setPlotNumber] = useState('');
  const [certSurface, setCertSurface] = useState(300);

  // Broadcast state (Envoi groupé à tous les blocs OU conversation directe avec un Chef de Bloc)
  const [broadcastTarget, setBroadcastTarget] = useState<string>('ALL');
  const [globalMessage, setGlobalMessage] = useState('');
  const [hierarchyMsgs, setHierarchyMsgs] = useState<DirectHierarchyMessage[]>(() =>
    getHierarchyMessages(),
  );
  const [sentBroadcasts, setSentBroadcasts] = useState<
    Array<{ id: string; targetLabel: string; message: string; sentAt: string }>
  >([]);

  // 1. Action: Créer un Chef de Bloc (+ Identifiants + Zone délimitée sur la carte)
  const handleCreateLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaderName.trim() || !leaderEmail.trim() || !leaderPassword.trim()) {
      toast({ title: 'Veuillez remplir le nom, email et mot de passe.', variant: 'error' });
      return;
    }

    const emailClean = leaderEmail.trim().toLowerCase();
    const passwordClean = leaderPassword.trim();

    let targetBlock: BlockRecord | undefined;
    if (leaderBlockId === '__new__') {
      if (!leaderNewZoneName.trim()) {
        toast({ title: 'Veuillez indiquer le nom de la nouvelle zone / bloc.', variant: 'error' });
        return;
      }
      targetBlock = createBlock({
        name: leaderNewZoneName.trim(),
        code: `BLOC-${Math.floor(100 + Math.random() * 900)}`,
        neighborhoodId: 'neigh-cocody',
        neighborhoodName: 'Cocody Riviera Palmeraie',
        leaderName: leaderName.trim(),
        leaderEmail: emailClean,
        leaderPhone: leaderPhone.trim(),
        totalResidences: 0,
        totalHabitants: 0,
        boundary: leaderBoundary ?? undefined,
      });
    } else {
      targetBlock = blocks.find((item) => item.id === leaderBlockId) || blocks[0];
      if (targetBlock) {
        updateStoredBlock(targetBlock.id, {
          leaderName: leaderName.trim(),
          leaderEmail: emailClean,
          leaderPhone: leaderPhone.trim(),
          ...(leaderBoundary ? { boundary: leaderBoundary } : {}),
        });
      }
    }

    const newLdr: BlockLeaderRecord = {
      id: `ldr-${Date.now()}`,
      name: leaderName.trim(),
      email: emailClean,
      phone: leaderPhone.trim(),
      password: passwordClean,
      blockId: targetBlock?.id || 'block-1',
      blockName: targetBlock?.name || 'Bloc Riviera Palmeraie 2',
      neighborhoodId: 'neigh-cocody',
      neighborhoodName: 'Cocody',
      createdAt: new Date().toISOString(),
    };
    saveBlockLeader(newLdr);

    // Enregistrer automatiquement les identifiants pour la connexion via /sign-in
    saveRegisteredUser({
      email: emailClean,
      password: passwordClean,
      displayName: leaderName.trim(),
      role: 'BLOCK_LEADER',
      phone: leaderPhone.trim(),
      createdAt: new Date().toISOString(),
    });

    refreshAll();
    setNewLeaderModalOpen(false);
    setLeaderName('');
    setLeaderEmail('');
    setLeaderNewZoneName('');
    setLeaderBoundary(null);
    toast({
      title: 'Chef de Bloc créé avec ses identifiants !',
      description: `${newLdr.name} peut se connecter sur /sign-in avec ${newLdr.email} / ${newLdr.password}`,
      variant: 'success',
    });
  };

  // 2. Action: Supprimer un Chef de Bloc
  const handleDeleteLeader = (id: string, name: string) => {
    if (confirm(`Confirmez-vous la révocation du mandat de ${name} ?`)) {
      deleteBlockLeader(id);
      refreshAll();
      toast({ title: 'Chef de Bloc révoqué', variant: 'info' });
    }
  };

  // 3. Action: Créer un nouveau Bloc
  const handleCreateBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockName.trim() || !blockCode.trim()) {
      toast({ title: 'Nom et code du bloc requis', variant: 'error' });
      return;
    }
    createBlock({
      name: blockName.trim(),
      code: blockCode.trim().toUpperCase(),
      neighborhoodId: 'neigh-cocody',
      neighborhoodName: 'Cocody',
      totalResidences: 0,
      totalHabitants: 0,
    });
    refreshAll();
    setNewBlockModalOpen(false);
    setBlockName('');
    setBlockCode('');
    toast({ title: 'Nouveau bloc créé avec succès !', variant: 'success' });
  };

  // 4. Action: Réassigner un habitant à un autre bloc
  const handleConfirmReassign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabitant || !reassignBlockId) return;
    const targetBlock = blocks.find((b) => b.id === reassignBlockId);
    if (!targetBlock) return;

    reassignHabitantBlock(selectedHabitant.id, targetBlock.id, targetBlock.name);
    refreshAll();
    setReassignModalOpen(false);
    toast({
      title: 'Habitant réassigné avec succès',
      description: `${selectedHabitant.fullName} est désormais rattaché(e) au ${targetBlock.name}.`,
      variant: 'success',
    });
  };

  // 5. Action: Créer une attestation / certificat officiel avec QR Code
  const handleCreateCertificate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!beneficiaryName.trim()) {
      toast({ title: 'Nom du bénéficiaire requis', variant: 'error' });
      return;
    }
    const b = blocks.find((item) => item.id === certBlockId) || blocks[0];
    const certNum = `ACT-CHEFF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCert: OfficialCertificateRecord = {
      id: `cert-${Date.now()}`,
      certificateNumber: certNum,
      type: certType,
      title:
        certType === 'RESIDENCE'
          ? 'Certificat de Résidence & Recensement Coutumier'
          : certType === 'CUSTOMARY_LAND_SALE'
            ? 'Attestation Coutumière de Cession Foncière'
            : certType === 'CESSION'
              ? 'Acte de Mutation & Cession Immobilière'
              : 'Attestation Coutumière d’Attribution',
      beneficiaryName: beneficiaryName.trim(),
      beneficiaryPhone: beneficiaryPhone.trim(),
      beneficiaryNationalId: beneficiaryIdNumber.trim() || undefined,
      blockId: b?.id || 'block-1',
      blockName: b?.name || 'Bloc Riviera Palmeraie 2',
      plotNumber: plotNumber.trim() || undefined,
      surfaceM2: Number(certSurface) || undefined,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=KATDESTATE-VERIF-${certNum}`,
      issuedAt: new Date().toISOString(),
      issuedByName: user?.displayName || 'Nanan Kouamé N’Guessan (Chef de Quartier)',
      status: 'DELIVERED',
    };
    saveOfficialCertificate(newCert);
    refreshAll();
    setNewCertModalOpen(false);
    toast({
      title: 'Attestation officielle créée !',
      description: `Acte N° ${certNum} délivré avec QR Code infalsifiable.`,
      variant: 'success',
    });
  };

  // 6. Action: Message groupé à tous les blocs OU ciblé vers un bloc précis
  const handleSendGlobalMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalMessage.trim()) return;

    const targetBlock = blocks.find((b) => b.id === broadcastTarget);
    const targetLabel =
      broadcastTarget === 'ALL'
        ? `Tous les blocs du quartier (${blocks.length} blocs)`
        : `${targetBlock?.name || 'Bloc sélectionné'} (Chef : ${targetBlock?.leaderName || 'Non assigné'})`;

    sendHierarchyMessage({
      senderEmail: user?.email || 'chef.quartier@katdestate.immo',
      senderName: user?.displayName || 'Chef de Quartier',
      senderRole: 'NEIGHBORHOOD_LEADER',
      recipientType: broadcastTarget === 'ALL' ? 'ALL_BLOCK_OWNERS' : 'BLOCK_LEADER',
      recipientEmail: targetBlock?.leaderEmail,
      recipientName: targetBlock?.leaderName || targetLabel,
      blockId: broadcastTarget === 'ALL' ? undefined : targetBlock?.id,
      blockName: broadcastTarget === 'ALL' ? 'Tous les blocs' : targetBlock?.name,
      subject: broadcastTarget === 'ALL' ? 'Message global du Chef de Quartier' : `Message direct — ${targetBlock?.name || 'Bloc'}`,
      body: globalMessage.trim(),
    });
    setHierarchyMsgs(getHierarchyMessages());

    setSentBroadcasts((prev) => [
      {
        id: `msg-${Date.now()}`,
        targetLabel,
        message: globalMessage.trim(),
        sentAt: new Date().toISOString(),
      },
      ...prev,
    ]);

    toast({
      title: broadcastTarget === 'ALL' ? 'Message groupé diffusé à tous les blocs !' : `Message envoyé au ${targetBlock?.name || 'bloc'} !`,
      description: `Destinataire : ${targetLabel}`,
      variant: 'success',
    });
    setGlobalMessage('');
  };

  // Calculs financiers : Loyers mensuels payés par les propriétaires de chaque chef de bloc
  const totalOwnersRentExpected = owners.reduce((sum, o) => sum + (o.monthlyRentOrDues || 0), 0);
  const totalOwnersRentPaid = owners
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.monthlyRentOrDues || 0), 0);
  const totalOwnersRentPending = totalOwnersRentExpected - totalOwnersRentPaid;

  const tabTitles: Record<LeaderTab, { title: string; subtitle: string }> = {
    leaders: {
      title: 'Gestion des Chefs de Bloc',
      subtitle: 'Créez des chefs de bloc, délimitez leur zone d’intervention, générez leurs identifiants et consultez leurs propriétaires et propriétés.',
    },
    blocks: {
      title: 'Blocs du Quartier',
      subtitle: 'Liste des blocs et secteurs délimités dans le quartier.',
    },
    habitants: {
      title: 'Habitants & Réassignation',
      subtitle: 'Consultez les habitants recensés et réassignez-les entre les blocs du quartier.',
    },
    finances: {
      title: 'Finances & Cotisations (Loyers des Propriétaires)',
      subtitle: 'Suivi exclusif des loyers mensuels payés par les propriétaires de chaque Chef de Bloc.',
    },
    attestations: {
      title: 'Attestations Coutumières QR',
      subtitle: 'Délivrance, téléchargement et impression des actes coutumiers infalsifiables.',
    },
    broadcast: {
      title: 'Message Global Quartier',
      subtitle: 'Envoyez un message groupé à tous les blocs ou ciblez un bloc précis.',
    },
    cartographie: {
      title: 'Cartographie & Zones Blocs (Temps Réel GPS)',
      subtitle: 'Délimitez votre quartier par GPS automatique et tracez/affectez les zones de chaque bloc.',
    },
    incidents: {
      title: 'Alertes & Incidents Escaladés',
      subtitle: 'Signalements transmis par les Chefs de Bloc pour arbitrage coutumier.',
    },
  };

  return (
    <div className="space-y-6">
      {/* Header Banner Chef de Quartier */}
      <div className="flex flex-col gap-4 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-card via-card to-purple-500/5 p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-600 text-white font-black text-xs shadow-md">
              👑
            </span>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              {tabTitles[activeTab]?.title || 'Espace Chef de Quartier'}
            </h1>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400 border border-purple-500/30">
              {blocks.length} bloc(s) sous juridiction
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {tabTitles[activeTab]?.subtitle}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border text-[11px] text-muted-foreground">
          <Shield className="h-4 w-4 text-purple-500 shrink-0" />
          <span>Périmètre : Autorité Coutumière du Quartier</span>
        </div>
      </div>

      {/* Navigation Onglets : MASQUÉE en mode isolé (lorsqu'on clique sur un bouton du dashboard) */}
      {!isIsolatedMode && (
        <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('leaders')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'leaders'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <UserCheck className="h-4 w-4" />
            <span>Chefs de Bloc ({leaders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cartographie')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'cartographie'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <MapPin className="h-4 w-4" />
            <span>Cartographie & Zones Blocs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('habitants')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'habitants'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Habitants & Réassignation ({habitants.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('finances')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'finances'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>Finances & Cotisations</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('attestations')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'attestations'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Attestations Coutumières ({certificates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'broadcast'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Send className="h-4 w-4" />
            <span>Message Global Quartier</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('incidents')}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
              activeTab === 'incidents'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
            <span>Alertes & Incidents ({escalatedIncidents.length})</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : TOUS LES BLOCS DU QUARTIER */}
      {/* ========================================================================= */}
      {activeTab === 'blocks' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Découpage des Blocs du Quartier ({blocks.length} blocs)
              </h2>
              <p className="text-xs text-muted-foreground">
                Supervision du maillage territorial de la Chefferie.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewBlockModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              + Créer un nouveau bloc
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {blocks.map((b) => (
              <Card key={b.id} className="p-4 space-y-2 border-border text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">{b.name}</span>
                  <span className="rounded bg-purple-500/20 text-purple-600 px-2 py-0.5 text-[10px] font-bold">
                    {b.code}
                  </span>
                </div>
                <p className="text-muted-foreground">
                  Chef assigné :{' '}
                  <strong className="text-foreground">{b.leaderName || 'En attente de nomination'}</strong>
                </p>
                <div className="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
                  <span>{b.totalResidences || 35} résidences</span>
                  <span>{b.totalHabitants || 120} habitants</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : GESTION DES CHEFS DE BLOC (CRÉER / SUPPRIMER) */}
      {/* ========================================================================= */}
      {activeTab === 'leaders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Chefs de Bloc Assermentés ({leaders.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Nommez des chefs de bloc, créez leurs identifiants de connexion et gérez leurs
                mandats.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewLeaderModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <UserCheck className="size-4" />
              + Nommer un Chef de Bloc (Créer identifiants)
            </Button>
          </div>

          <div className="space-y-4">
            {leaders.map((ldr) => {
              const blockOwnersList = owners.filter((o) => o.blockId === ldr.blockId);
              const blockPropertiesList = properties.filter(
                (p) =>
                  p.blockId === ldr.blockId ||
                  blockOwnersList.some((o) => o.id === p.geoOwnerId),
              );
              const blockListingsList = listings.filter(
                (l) =>
                  l.location?.blockId === ldr.blockId ||
                  blockOwnersList.some((o) => o.id === l.authorId),
              );

              return (
                <Card
                  key={ldr.id}
                  className="p-4 space-y-4 text-xs border-purple-500/30 bg-purple-500/5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{ldr.name}</span>
                        <span className="rounded bg-purple-500/20 text-purple-600 px-2 py-0.5 text-[10px] font-bold">
                          CHEF DE BLOC ACTIF
                        </span>
                      </div>
                      <p className="text-muted-foreground">
                        Secteur sous responsabilité :{' '}
                        <strong className="text-foreground">{ldr.blockName}</strong> • Tél :{' '}
                        <strong>{ldr.phone}</strong>
                      </p>

                      <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-purple-500/30 bg-background px-3 py-1.5 text-[11px]">
                        <KeyRound className="size-3.5 text-purple-500" />
                        <span>
                          Email : <strong className="font-mono">{ldr.email}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Mot de passe : <strong className="font-mono">{ldr.password}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs inline-flex items-center gap-1"
                        onClick={() => {
                          void navigator.clipboard.writeText(
                            `Identifiants Chef de Bloc KatdEstate\nEmail : ${ldr.email}\nMot de passe : ${ldr.password}\nSecteur : ${ldr.blockName}\nConnexion : ${window.location.origin}/sign-in`,
                          );
                          toast({ title: 'Identifiants copiés !', variant: 'success' });
                        }}
                      >
                        <Copy className="size-3.5" />
                        Copier
                      </Button>

                      <Button
                        size="sm"
                        className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1"
                        onClick={() => {
                          const cleanPhone = (ldr.phone || '').replace(/\D/g, '');
                          const text = encodeURIComponent(
                            `Bonjour ${ldr.name}, vous avez été nommé Chef de Bloc KatdEstate pour le ${ldr.blockName}.\n\nVos identifiants de connexion :\n- Email : ${ldr.email}\n- Mot de passe : ${ldr.password}\n- Lien : ${window.location.origin}/sign-in`,
                          );
                          window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                        }}
                      >
                        <MessageSquare className="size-3.5" />
                        WhatsApp
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteLeader(ldr.id, ldr.name)}
                        className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs inline-flex items-center gap-1"
                      >
                        <Trash2 className="size-3.5" />
                        Révoquer
                      </Button>
                    </div>
                  </div>

                  {/* Propriétaires rattachés à ce Chef de Bloc & Propriétés publiées */}
                  <div className="grid gap-3 md:grid-cols-2 border-t border-purple-500/20 pt-3">
                    <div className="rounded-xl border border-border bg-background/80 p-3 space-y-2">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Users className="size-3.5 text-cyan-500" />
                        Propriétaires du bloc ({blockOwnersList.length})
                      </p>
                      {blockOwnersList.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Aucun propriétaire enregistré dans ce bloc pour le moment.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {blockOwnersList.map((own) => (
                            <div
                              key={own.id}
                              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2 text-[11px]"
                            >
                              <div>
                                <p className="font-semibold text-foreground">{own.fullName}</p>
                                <p className="text-muted-foreground">
                                  {own.propertyName || 'Bien'} • {own.phone}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  own.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/20 text-emerald-600'
                                    : 'bg-amber-500/20 text-amber-600'
                                }`}
                              >
                                {own.paymentStatus === 'PAID' ? 'Payé' : 'En attente'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-border bg-background/80 p-3 space-y-2">
                      <p className="font-bold text-foreground flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-amber-500" />
                        Propriétés publiées par les propriétaires ({blockPropertiesList.length + blockListingsList.length})
                      </p>
                      {blockPropertiesList.length === 0 && blockListingsList.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                          Aucune propriété publiée dans ce bloc pour le moment.
                        </p>
                      ) : (
                        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                          {blockPropertiesList.map((prop) => (
                            <div
                              key={prop._id}
                              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2 text-[11px]"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <Home className="size-3.5 text-amber-500 shrink-0" />
                                <div className="truncate">
                                  <p className="font-semibold text-foreground truncate">{prop.name}</p>
                                  <p className="text-muted-foreground truncate">
                                    {prop.address}, {prop.city}
                                  </p>
                                </div>
                              </div>
                              <Link
                                to={`/properties/${prop._id}`}
                                className="shrink-0 text-[10px] font-bold text-primary hover:underline ml-2"
                              >
                                Voir →
                              </Link>
                            </div>
                          ))}
                          {blockListingsList.map((lst) => (
                            <div
                              key={lst._id}
                              className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2 text-[11px]"
                            >
                              <div className="truncate">
                                <p className="font-semibold text-foreground truncate">{lst.title}</p>
                                <p className="text-muted-foreground truncate">
                                  {lst.priceMinor.toLocaleString('fr-FR')} {lst.currency} • {lst.workflowStatus}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : HABITANTS & RÉASSIGNATION DE BLOC */}
      {/* ========================================================================= */}
      {activeTab === 'habitants' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">
              Tous les Habitants du Quartier ({habitants.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Vous avez la permission de réassigner n'importe quel habitant d'un bloc vers un autre
              bloc du quartier.
            </p>
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
                    <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">
                      {h.blockName}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        h.isPaid
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-amber-500/20 text-amber-600'
                      }`}
                    >
                      {h.isPaid ? 'Cotisation : PAYÉ' : 'Cotisation : IMPAYÉ'}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Adresse : <strong>{h.residenceName}</strong> ({h.dwellingType}) • Tél :{' '}
                    <strong>{h.phone}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedHabitant(h);
                      setReassignBlockId(h.blockId);
                      setReassignModalOpen(true);
                    }}
                    className="h-8 text-xs text-purple-600 border-purple-500/30 hover:bg-purple-500/10 inline-flex items-center gap-1"
                  >
                    <Building className="size-3.5" />
                    Réassigner à un autre bloc
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 5 : FINANCES & COTISATIONS (LOYERS MENSUELS DES PROPRIÉTAIRES PAR CHEF DE BLOC) */}
      {/* ========================================================================= */}
      {activeTab === 'finances' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 border-border">
              <p className="text-xs text-muted-foreground">Total Loyers Mensuels Attendus (Propriétaires)</p>
              <p className="text-xl font-black text-foreground mt-1">
                {totalOwnersRentExpected.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <p className="text-xs text-emerald-600 font-bold">Total Loyers Payés par les Propriétaires</p>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {totalOwnersRentPaid.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <p className="text-xs text-amber-600 font-bold">Reste à Percevoir</p>
              <p className="text-xl font-black text-amber-600 mt-1">
                {totalOwnersRentPending.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            {blocks.map((b) => {
              const blockOwnersList = owners.filter((o) => o.blockId === b.id);
              const blockLeader = leaders.find((l) => l.blockId === b.id);
              const blockPaidTotal = blockOwnersList
                .filter((o) => o.paymentStatus === 'PAID')
                .reduce((s, o) => s + (o.monthlyRentOrDues || 0), 0);
              const blockExpectedTotal = blockOwnersList.reduce(
                (s, o) => s + (o.monthlyRentOrDues || 0),
                0,
              );

              return (
                <Card key={b.id} className="p-4 space-y-3 border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2.5">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Building className="size-4 text-purple-500" />
                        {b.name} ({b.code})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Chef de Bloc : <strong className="text-foreground">{blockLeader?.name || b.leaderName || 'Non assigné'}</strong> • {blockOwnersList.length} propriétaire(s)
                      </p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="font-black text-emerald-600">
                        {blockPaidTotal.toLocaleString('fr-FR')} FCFA payés
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        sur {blockExpectedTotal.toLocaleString('fr-FR')} FCFA attendus
                      </p>
                    </div>
                  </div>

                  {blockOwnersList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Aucun propriétaire enregistré pour ce Chef de Bloc.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {blockOwnersList.map((o) => (
                        <div
                          key={o.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs"
                        >
                          <div>
                            <p className="font-bold text-foreground">{o.fullName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Bien : {o.propertyName || o.propertyType || 'Propriété'} • Tél : {o.phone}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-black text-foreground">
                              {(o.monthlyRentOrDues || 0).toLocaleString('fr-FR')} FCFA / mois
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                o.paymentStatus === 'PAID'
                                  ? 'bg-emerald-500/20 text-emerald-600'
                                  : o.paymentStatus === 'OVERDUE'
                                    ? 'bg-red-500/20 text-red-600'
                                    : 'bg-amber-500/20 text-amber-600'
                              }`}
                            >
                              {o.paymentStatus === 'PAID'
                                ? '✅ Payé'
                                : o.paymentStatus === 'OVERDUE'
                                  ? '❌ En retard'
                                  : '⏳ En attente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 6 : ATTESTATIONS & CERTIFICATS OFFICIELS COUTUMIERS */}
      {/* ========================================================================= */}
      {activeTab === 'attestations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Délivrance des Attestations Coutumières avec QR Code
              </h2>
              <p className="text-xs text-muted-foreground">
                Certificats de résidence, attestations foncières coutumières et actes de cession
                infalsifiables.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewCertModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Award className="size-4" />
              + Délivrer une attestation coutumière
            </Button>
          </div>

          <div className="space-y-3">
            {certificates.map((c) => (
              <Card
                key={c.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs border-border"
              >
                <div className="flex items-start gap-3">
                  <div className="size-16 rounded-xl border border-border p-1 bg-white shrink-0">
                    <img src={c.qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{c.title}</span>
                      <span className="rounded bg-purple-500/20 text-purple-600 px-2 py-0.5 text-[10px] font-bold">
                        N° {c.certificateNumber}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Bénéficiaire : <strong>{c.beneficiaryName}</strong> • Tél :{' '}
                      <strong>{c.beneficiaryPhone}</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Bloc : {c.blockName} {c.plotNumber ? `• Parcelle : ${c.plotNumber}` : ''} •
                      Délivré le : {new Date(c.issuedAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      const content = [
                        `ATTESTATION COUTUMIÈRE OFFICIELLE — ${c.certificateNumber}`,
                        `Type : ${c.title}`,
                        `Bénéficiaire : ${c.beneficiaryName}`,
                        `Bloc : ${c.blockName}`,
                        c.plotNumber ? `Parcelle : ${c.plotNumber}` : '',
                        `Délivré le : ${new Date(c.issuedAt).toLocaleDateString('fr-FR')}`,
                      ]
                        .filter(Boolean)
                        .join('\n');
                      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `attestation-${c.certificateNumber}.txt`;
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      URL.revokeObjectURL(url);
                    }}
                    className="h-8 text-xs inline-flex items-center gap-1"
                  >
                    <Download className="size-3.5" />
                    Télécharger
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                    className="h-8 text-xs inline-flex items-center gap-1"
                  >
                    <Printer className="size-3.5" />
                    Imprimer Acte
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 7 : MESSAGE GLOBAL OU CIBLÉ PAR BLOC */}
      {/* ========================================================================= */}
      {activeTab === 'broadcast' && (
        <div className="max-w-2xl mx-auto space-y-4">
          <Card className="p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Crown className="size-4 text-purple-600" />
                Communication Officielle du Chef de Quartier
              </h2>
              <p className="text-xs text-muted-foreground">
                Envoyez un message groupé à tous les blocs que vous avez créés ou sélectionnez un bloc précis pour une instruction ciblée.
              </p>
            </div>

            <form onSubmit={handleSendGlobalMessage} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Destinataire(s) :</label>
                <select
                  value={broadcastTarget}
                  onChange={(e) => setBroadcastTarget(e.target.value)}
                  className="h-9 w-full rounded-xl border border-input bg-background px-3 text-xs font-medium"
                >
                  <option value="ALL">
                    📢 Tous les blocs du quartier ({blocks.length} blocs — Envoi groupé)
                  </option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      📌 {b.name} ({b.code}) — Chef : {b.leaderName || 'Non assigné'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Contenu du message :</label>
                <textarea
                  rows={4}
                  value={globalMessage}
                  onChange={(e) => setGlobalMessage(e.target.value)}
                  placeholder="Ex : Chers Chefs de Bloc et administrés, merci de prendre note des instructions suivantes..."
                  required
                  className="w-full rounded-xl border border-input bg-background p-3 text-xs"
                />
              </div>

              <Button
                type="submit"
                disabled={!globalMessage.trim()}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold"
              >
                <Send className="size-4 mr-1.5" />
                {broadcastTarget === 'ALL'
                  ? 'Diffuser le message groupé à tous les blocs'
                  : 'Envoyer au bloc sélectionné'}
              </Button>
            </form>
          </Card>

          <Card className="p-4 space-y-3 border-border">
            <h3 className="text-xs font-bold text-foreground">
              Fil de discussion bidirectionnel (Chef de Quartier ↔ Chefs de Bloc)
            </h3>
            {hierarchyMsgs.filter(
              (m) =>
                m.senderRole === 'NEIGHBORHOOD_LEADER' ||
                m.recipientType === 'NEIGHBORHOOD_LEADER' ||
                m.senderRole === 'BLOCK_LEADER',
            ).length === 0 && sentBroadcasts.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun message échangé avec vos Chefs de Bloc pour le moment.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {hierarchyMsgs
                  .filter(
                    (m) =>
                      m.senderRole === 'NEIGHBORHOOD_LEADER' ||
                      m.recipientType === 'NEIGHBORHOOD_LEADER' ||
                      (m.senderRole === 'BLOCK_LEADER' &&
                        (broadcastTarget === 'ALL' || m.blockId === broadcastTarget)),
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3 text-xs space-y-1 ${
                        m.senderRole === 'NEIGHBORHOOD_LEADER'
                          ? 'border-purple-500/30 bg-purple-500/10 ml-4'
                          : 'border-cyan-500/30 bg-cyan-500/10 mr-4'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-foreground">
                          {m.senderName} ({m.senderRole === 'NEIGHBORHOOD_LEADER' ? 'Chef de Quartier' : 'Chef de Bloc'})
                          {m.blockName ? ` · ${m.blockName}` : ''}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-foreground">{m.body}</p>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 9 : CARTOGRAPHIE & DÉLIMITATION DES ZONES DE BLOCS (NIVEAU 1) */}
      {/* ========================================================================= */}
      {activeTab === 'cartographie' && <NeighborhoodGeoPanel onDataChanged={refreshAll} />}

      {/* ========================================================================= */}
      {/* ONGLET 10 : ALERTES & INCIDENTS TRANSMIS PAR LES CHEFS DE BLOC */}
      {/* ========================================================================= */}
      {activeTab === 'incidents' && (
        <div className="space-y-4">
          <div className="bg-muted/20 p-4 rounded-2xl border border-border">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              Signalements Escaladés par vos Chefs de Bloc ({escalatedIncidents.length})
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ces incidents et litiges territoriaux ont été transmis directement par vos Chefs de Bloc pour arbitrage coutumier.
            </p>
          </div>

          <div className="space-y-2.5">
            {escalatedIncidents.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                Aucun incident n’a été transmis par vos Chefs de Bloc pour le moment.
              </Card>
            ) : (
              escalatedIncidents.map((inc) => (
                <Card key={inc.id} className="p-4 space-y-2 border-border">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{inc.title}</span>
                      <span className="rounded bg-red-500/20 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                        {inc.category}
                      </span>
                      <span className="rounded bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                        Gravité : {inc.severity}
                      </span>
                      <span className="rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 text-[10px] font-bold">
                        Bloc : {inc.blockName}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(inc.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-line">{inc.description}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-[11px] text-muted-foreground">
                    <span>
                      Transmis par : <strong className="text-foreground">{inc.escalatedBy || 'Chef de Bloc'}</strong> · Origine : {inc.reportedBy}
                    </span>
                    <span className="font-semibold text-emerald-600">Statut : {inc.status}</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* MODAL : NOMMER UN CHEF DE BLOC */}
      <Modal
        open={newLeaderModalOpen}
        onOpenChange={setNewLeaderModalOpen}
        title="Nommer un Chef de Bloc"
        className="max-w-2xl"
      >
        <form onSubmit={handleCreateLeader} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet du Chef de Bloc *</label>
            <Input
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder="Ex: M. Bakary Diarra"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={leaderPhone}
                onChange={(e) => setLeaderPhone(e.target.value)}
                placeholder="+225 07..."
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email de connexion *</label>
              <Input
                type="email"
                value={leaderEmail}
                onChange={(e) => setLeaderEmail(e.target.value)}
                placeholder="chef.bloc@katdestate.immo"
                required
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Mot de passe de connexion *</label>
            <div className="flex gap-1.5">
              <Input
                type="text"
                value={leaderPassword}
                onChange={(e) => setLeaderPassword(e.target.value)}
                placeholder="ChefBloc2026!"
                required
              />
              <Button
                type="button"
                variant="secondary"
                className="h-9 px-2 text-[11px]"
                onClick={() =>
                  setLeaderPassword(`ChefBloc${Math.floor(1000 + Math.random() * 9000)}!`)
                }
              >
                Générer
              </Button>
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Zone / Bloc d'intervention *</label>
            <select
              value={leaderBlockId}
              onChange={(e) => setLeaderBlockId(e.target.value)}
              className="w-full rounded-xl border border-input p-2 bg-background text-xs"
            >
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code}) {b.boundary ? '• Zone délimitée' : ''}
                </option>
              ))}
              <option value="__new__">+ Créer & délimiter une nouvelle zone de bloc sur la carte</option>
            </select>
          </div>

          {leaderBlockId === '__new__' && (
            <div>
              <label className="font-semibold block mb-1">Nom de la nouvelle zone / bloc *</label>
              <Input
                value={leaderNewZoneName}
                onChange={(e) => setLeaderNewZoneName(e.target.value)}
                placeholder="Ex: Bloc Riviera Nord"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-semibold block">
              Délimiter la zone d'intervention sur la carte (Cliquez pour tracer les sommets)
            </label>
            <GeoMapCanvas
              title="Zone d'intervention du Chef de Bloc"
              heightClassName="h-[260px]"
              allowPolygonDraw={true}
              activeBoundary={leaderBoundary}
              onBoundaryChange={setLeaderBoundary}
              overlays={[
                ...getStoredNeighborhoods()
                  .filter((n) => n.boundary)
                  .map((n) => ({
                    id: n.id,
                    level: 'NEIGHBORHOOD' as const,
                    label: `Mon Quartier : ${n.name}`,
                    boundary: n.boundary!,
                    color: '#7c3aed',
                    fillOpacity: 0.08,
                    strokeWeight: 3,
                    locked: true,
                  })),
                ...getStoredBlocks()
                  .filter((b) => b.boundary)
                  .map((b) => ({
                    id: b.id,
                    level: 'BLOCK' as const,
                    label: b.name,
                    boundary: b.boundary!,
                    color: b.color || '#06b6d4',
                    fillOpacity: 0.14,
                    strokeWeight: 2,
                    locked: true,
                  })),
              ]}
              focusTarget={{
                boundary: getStoredNeighborhoods()[0]?.boundary ?? null,
                key: `leader-modal-${newLeaderModalOpen}`,
              }}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewLeaderModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Créer Chef de Bloc & Identifiants
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : CRÉER UN NOUVEAU BLOC */}
      <Modal open={newBlockModalOpen} onOpenChange={setNewBlockModalOpen} title="Créer un nouveau Bloc">
        <form onSubmit={handleCreateBlock} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom du Bloc *</label>
            <Input
              value={blockName}
              onChange={(e) => setBlockName(e.target.value)}
              placeholder="Ex: Bloc Abatta Extension Sud"
              required
            />
          </div>
          <div>
            <label className="font-semibold block mb-1">Code Identifiant du Bloc *</label>
            <Input
              value={blockCode}
              onChange={(e) => setBlockCode(e.target.value)}
              placeholder="Ex: BLOC-ABATTA-SUD"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewBlockModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Enregistrer le Bloc
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : RÉASSIGNER UN HABITANT */}
      <Modal open={reassignModalOpen} onOpenChange={setReassignModalOpen} title="Réassigner l'habitant à un autre bloc">
        <form onSubmit={handleConfirmReassign} className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            Habitant : <strong>{selectedHabitant?.fullName}</strong> (Actuellement dans :{' '}
            {selectedHabitant?.blockName})
          </p>
          <div>
            <label className="font-semibold block mb-1">Nouveau bloc de destination *</label>
            <select
              value={reassignBlockId}
              onChange={(e) => setReassignBlockId(e.target.value)}
              className="w-full rounded-xl border border-input p-2.5 bg-background text-xs"
            >
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setReassignModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Valider la réassignation
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : DÉLIVRER UNE ATTESTATION */}
      <Modal open={newCertModalOpen} onOpenChange={setNewCertModalOpen} title="Délivrer une Attestation Coutumière">
        <form onSubmit={handleCreateCertificate} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Type d'acte coutumier</label>
            <select
              value={certType}
              onChange={(e) => setCertType(e.target.value as any)}
              className="w-full rounded-xl border border-input p-2 bg-background text-xs"
            >
              <option value="RESIDENCE">Certificat de Résidence & Recensement Coutumier</option>
              <option value="CUSTOMARY_LAND_SALE">Attestation Coutumière de Cession Foncière</option>
              <option value="CESSION">Acte de Mutation & Cession Immobilière</option>
              <option value="CUSTOMARY_ATTRIBUTION">Attestation Coutumière d’Attribution</option>
            </select>
          </div>
          <div>
            <label className="font-semibold block mb-1">Nom complet du bénéficiaire *</label>
            <Input
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              placeholder="Ex: M. Kouadio Jean-Marie"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={beneficiaryPhone}
                onChange={(e) => setBeneficiaryPhone(e.target.value)}
                placeholder="+225 07..."
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">N° CNI / Passeport</label>
              <Input
                value={beneficiaryIdNumber}
                onChange={(e) => setBeneficiaryIdNumber(e.target.value)}
                placeholder="CNI-CI-..."
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-semibold block mb-1">Bloc concerné</label>
              <select
                value={certBlockId}
                onChange={(e) => setCertBlockId(e.target.value)}
                className="w-full rounded-xl border border-input p-2 bg-background text-xs"
              >
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">N° Lot / Parcelle</label>
              <Input
                value={plotNumber}
                onChange={(e) => setPlotNumber(e.target.value)}
                placeholder="Lot 15 Îlot 4"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Superficie (m²)</label>
              <Input
                type="number"
                value={certSurface}
                onChange={(e) => setCertSurface(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewCertModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Délivrer et Générer QR Code
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
