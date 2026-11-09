import { useState } from 'react';
import {
  Award,
  Building,
  CheckCircle2,
  Copy,
  Crown,
  Edit3,
  FileCheck,
  FileText,
  KeyRound,
  MessageSquare,
  Plus,
  Printer,
  Send,
  Shield,
  Trash2,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';
import { useSession } from '../../app/session';
import {
  getBlockLeaders,
  saveBlockLeader,
  deleteBlockLeader,
  getStoredBlocks,
  createBlock,
  getStoredHabitants,
  reassignHabitantBlock,
  getWorkflowListings,
  updateListingWorkflow,
  deleteWorkflowListingPermanently,
  saveWorkflowListings,
  getOfficialCertificates,
  saveOfficialCertificate,
  getStoredIncidents,
  type BlockLeaderRecord,
  type BlockRecord,
  type HabitantRecord,
  type WorkflowListingItem,
  type OfficialCertificateRecord,
} from '../../lib/katdestate-store';

export function NeighborhoodLeaderDashboard() {
  const { user } = useSession();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<
    | 'overview'
    | 'blocks'
    | 'leaders'
    | 'annonces'
    | 'habitants'
    | 'finances'
    | 'attestations'
    | 'broadcast'
    | 'rapport'
  >('annonces');

  // Local data states
  const [blocks, setBlocks] = useState<BlockRecord[]>(() => getStoredBlocks());
  const [leaders, setLeaders] = useState<BlockLeaderRecord[]>(() => getBlockLeaders());
  const [habitants, setHabitants] = useState<HabitantRecord[]>(() => getStoredHabitants());
  const [listings, setListings] = useState<WorkflowListingItem[]>(() => getWorkflowListings());
  const [certificates, setCertificates] = useState<OfficialCertificateRecord[]>(() =>
    getOfficialCertificates(),
  );
  const [incidents] = useState(() => getStoredIncidents());

  const refreshAll = () => {
    setBlocks(getStoredBlocks());
    setLeaders(getBlockLeaders());
    setHabitants(getStoredHabitants());
    setListings(getWorkflowListings());
    setCertificates(getOfficialCertificates());
  };

  // Modals state
  const [newLeaderModalOpen, setNewLeaderModalOpen] = useState(false);
  const [newBlockModalOpen, setNewBlockModalOpen] = useState(false);
  const [newCertModalOpen, setNewCertModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [editListingModalOpen, setEditListingModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);

  // Selected item states
  const [selectedListing, setSelectedListing] = useState<WorkflowListingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [selectedHabitant, setSelectedHabitant] = useState<HabitantRecord | null>(null);
  const [reassignBlockId, setReassignBlockId] = useState('');

  // Form states for new Leader
  const [leaderName, setLeaderName] = useState('');
  const [leaderEmail, setLeaderEmail] = useState('');
  const [leaderPhone, setLeaderPhone] = useState('+225 ');
  const [leaderPassword, setLeaderPassword] = useState('ChefBloc2026!');
  const [leaderBlockId, setLeaderBlockId] = useState(blocks[0]?.id || 'block-1');

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

  // Form states for editing listing
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editSurface, setEditSurface] = useState(25);
  const [editBedrooms, setEditBedrooms] = useState(1);
  const [editDesc, setEditDesc] = useState('');

  // Broadcast state
  const [globalMessage, setGlobalMessage] = useState('');

  // 1. Action: Créer un Chef de Bloc
  const handleCreateLeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaderName.trim() || !leaderEmail.trim() || !leaderPassword.trim()) {
      toast({ title: 'Veuillez remplir le nom, email et mot de passe.', variant: 'error' });
      return;
    }
    const b = blocks.find((item) => item.id === leaderBlockId) || blocks[0];
    const newLdr: BlockLeaderRecord = {
      id: `ldr-${Date.now()}`,
      name: leaderName.trim(),
      email: leaderEmail.trim().toLowerCase(),
      phone: leaderPhone.trim(),
      password: leaderPassword.trim(),
      blockId: b?.id || 'block-1',
      blockName: b?.name || 'Bloc Riviera Palmeraie 2',
      neighborhoodId: 'neigh-cocody',
      neighborhoodName: 'Cocody',
      createdAt: new Date().toISOString(),
    };
    saveBlockLeader(newLdr);
    refreshAll();
    setNewLeaderModalOpen(false);
    toast({
      title: 'Chef de Bloc créé avec succès !',
      description: `${newLdr.name} peut se connecter avec ${newLdr.email} / ${newLdr.password}`,
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

  // 4. Action: Valider & Publier définitivement une annonce (APPROUVE_BLOC -> PUBLIE)
  const handlePublishListing = (listingId: string) => {
    updateListingWorkflow(listingId, {
      workflowStatus: 'PUBLIE',
      actorRole: 'NEIGHBORHOOD_LEADER',
      actorName: user?.displayName || 'Nanan Kouamé N’Guessan (Chef de Quartier)',
    });
    refreshAll();
    toast({
      title: 'Annonce publiée en ligne !',
      description:
        'Le bien est désormais actif et visible par tous les visiteurs sur le site web et la Marketplace KatdEstate.',
      variant: 'success',
    });
  };

  // 5. Action: Refuser une annonce avec motif visible par l'habitant
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !rejectionReason.trim()) {
      toast({ title: 'Veuillez préciser le motif du refus.', variant: 'error' });
      return;
    }
    updateListingWorkflow(selectedListing._id, {
      workflowStatus: 'REFUSE',
      rejectionReason: rejectionReason.trim(),
      actorRole: 'NEIGHBORHOOD_LEADER',
      actorName: user?.displayName || 'Nanan Kouamé N’Guessan (Chef de Quartier)',
    });
    refreshAll();
    setRejectModalOpen(false);
    setRejectionReason('');
    setSelectedListing(null);
    toast({
      title: 'Annonce rejetée',
      description: 'Le motif de rejet est visible par l’habitant pour correction.',
      variant: 'error',
    });
  };

  // 6. Action: Modifier toute annonce du quartier
  const handleOpenEdit = (listing: WorkflowListingItem) => {
    setSelectedListing(listing);
    setEditTitle(listing.title);
    setEditPrice(listing.priceMinor);
    setEditSurface(listing.surfaceM2 || 25);
    setEditBedrooms(listing.bedrooms || 1);
    setEditDesc(listing.description);
    setEditListingModalOpen(true);
  };

  const handleSaveListingCorrection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing) return;

    const all = getWorkflowListings();
    const idx = all.findIndex((l) => l._id === selectedListing._id);
    if (idx >= 0 && all[idx]) {
      const cur = all[idx]!;
      all[idx] = {
        ...cur,
        title: editTitle.trim(),
        priceMinor: Number(editPrice) || cur.priceMinor,
        surfaceM2: Number(editSurface) || cur.surfaceM2,
        bedrooms: Number(editBedrooms) || cur.bedrooms,
        description: editDesc.trim(),
        updatedAt: new Date().toISOString(),
      };
      saveWorkflowListings(all);
      refreshAll();
      setEditListingModalOpen(false);
      toast({ title: 'Annonce mise à jour par la Chefferie', variant: 'success' });
    }
  };

  // 7. Action: Supprimer / Archiver définitivement une annonce frauduleuse
  const handleDeleteListing = (listingId: string, title: string) => {
    if (
      confirm(`Supprimer définitivement l’annonce "${title}" pour fraude ou fausse déclaration ?`)
    ) {
      deleteWorkflowListingPermanently(listingId);
      refreshAll();
      toast({ title: 'Annonce frauduleuse supprimée du système', variant: 'info' });
    }
  };

  // 8. Action: Réassigner un habitant à un autre bloc
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

  // 9. Action: Créer une attestation / certificat officiel avec QR Code
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

  // 10. Action: Message global à tout le quartier
  const handleSendGlobalMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalMessage.trim()) return;
    toast({
      title: 'Message diffusé à l’ensemble du Quartier !',
      description: `Transmis à tous les ${blocks.length} blocs et ${habitants.length} habitants.`,
      variant: 'success',
    });
    setGlobalMessage('');
  };

  // Calculs financiers
  const totalCotisations = habitants.reduce((sum, h) => sum + h.rentOrCotisationAmount, 0);
  const totalPaid = habitants
    .filter((h) => h.isPaid)
    .reduce((sum, h) => sum + h.rentOrCotisationAmount, 0);
  const totalUnpaid = totalCotisations - totalPaid;

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
              Dashboard Chef de Quartier (Autorité Coutumière)
            </h1>
            <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400 border border-purple-500/30">
              Juridiction : TOUS LES BLOCS ({blocks.length} blocs)
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Supervision territoriale intégrale : Nomination des chefs de bloc, validation finale
            des annonces, réassignation, délivrance des attestations et rapports.
          </p>
        </div>

        {/* Rappel des permissions Chef de Quartier */}
        <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border text-[11px] text-muted-foreground">
          <Shield className="h-4 w-4 text-purple-500 shrink-0" />
          <span>
            Périmètre étendu : Vous avez pleine autorité sur l'ensemble des blocs de votre
            quartier.
          </span>
        </div>
      </div>

      {/* Navigation Onglets */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('annonces')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            activeTab === 'annonces'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileCheck className="h-4 w-4" />
          <span>Validation des Annonces ({listings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('blocks')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            activeTab === 'blocks'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Tous les Blocs ({blocks.length})</span>
        </button>

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
          <span>Message au Quartier</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rapport')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            activeTab === 'rapport'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Rapport Mensuel PDF</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : VALIDATION FINALE DES ANNONCES DU QUARTIER */}
      {/* ========================================================================= */}
      {activeTab === 'annonces' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Validation Finale des Annonces du Quartier (Tous les Blocs)
              </h2>
              <p className="text-xs text-muted-foreground">
                Passez les annonces approuvées par les chefs de bloc au statut{' '}
                <strong className="text-emerald-500">PUBLIÉ</strong> pour mise en ligne sur le
                site web, ou supprimez définitivement les annonces frauduleuses.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg bg-cyan-500/10 text-cyan-600 px-2.5 py-1 font-bold border border-cyan-500/20">
                Prêtes pour publication ({listings.filter((l) => l.workflowStatus === 'APPROUVE_BLOC').length})
              </span>
              <span className="rounded-lg bg-emerald-500/10 text-emerald-600 px-2.5 py-1 font-bold border border-emerald-500/20">
                En ligne ({listings.filter((l) => l.workflowStatus === 'PUBLIE').length})
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const isCarabot = l.category === 'CARABOT';
              return (
                <Card
                  key={l._id}
                  className="overflow-hidden border border-border bg-card flex flex-col justify-between text-xs"
                >
                  <div className="space-y-2.5 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          l.workflowStatus === 'EN_ATTENTE'
                            ? 'bg-amber-500/20 text-amber-600 border border-amber-500/30'
                            : l.workflowStatus === 'APPROUVE_BLOC'
                              ? 'bg-cyan-500/20 text-cyan-600 border border-cyan-500/30'
                              : l.workflowStatus === 'PUBLIE'
                                ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-600 border border-red-500/30'
                        }`}
                      >
                        {l.workflowStatus === 'EN_ATTENTE' && '⏳ En attente vérif terrain'}
                        {l.workflowStatus === 'APPROUVE_BLOC' && '🛡️ Approuvé Bloc (À publier)'}
                        {l.workflowStatus === 'PUBLIE' && '✅ Publié sur le site web'}
                        {l.workflowStatus === 'REFUSE' && '❌ Rejeté'}
                      </span>

                      {isCarabot && (
                        <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-500 border border-amber-400/40">
                          Maison en carabot
                        </span>
                      )}
                    </div>

                    {/* Photos Preview */}
                    <div className="grid grid-cols-2 gap-2 h-28">
                      {l.photos?.slice(0, 2).map((p, idx) => (
                        <div
                          key={idx}
                          className="relative h-full overflow-hidden rounded-xl bg-muted"
                        >
                          <img
                            src={p.url}
                            alt={l.title}
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            {p.label || (idx === 0 ? 'Extérieur' : 'Intérieur')}
                          </span>
                        </div>
                      ))}
                    </div>

                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{l.title}</h3>
                    <p className="font-black text-purple-600 text-sm">
                      {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                      <span className="text-[10px] font-normal text-muted-foreground"> / mois</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Bloc : <strong>{l.location.blockName || 'Bloc Palmeraie 2'}</strong></span>
                      <span>•</span>
                      <span>Superficie : <strong>{l.surfaceM2 || 25} m²</strong></span>
                      <span>•</span>
                      <span>Chambres : <strong>{l.bedrooms || 1}</strong></span>
                    </div>

                    <p className="text-muted-foreground line-clamp-2 text-[11px]">
                      {l.description}
                    </p>

                    <div className="pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <p>
                        Déposant : <strong>{l.authorName || l.contact?.name}</strong>
                      </p>
                      {l.approvedByBlockLeaderName && (
                        <p className="text-cyan-600">
                          Terrain vérifié par : {l.approvedByBlockLeaderName}
                        </p>
                      )}
                    </div>

                    {l.workflowStatus === 'REFUSE' && l.rejectionReason && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-500">
                        <strong>Motif de rejet :</strong> {l.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions Chef de Quartier */}
                  <div className="p-3 border-t border-border bg-muted/10 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {l.workflowStatus !== 'PUBLIE' && (
                        <Button
                          size="sm"
                          onClick={() => handlePublishListing(l._id)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-8 text-xs"
                        >
                          <CheckCircle2 className="size-3.5 mr-1" />
                          Valider & Publier sur site
                        </Button>
                      )}

                      {l.workflowStatus !== 'REFUSE' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedListing(l);
                            setRejectModalOpen(true);
                          }}
                          className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-8 text-xs"
                        >
                          <XCircle className="size-3.5 mr-1" />
                          Refuser
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenEdit(l)}
                        className="h-8 text-xs inline-flex items-center gap-1"
                      >
                        <Edit3 className="size-3.5" />
                        Modifier
                      </Button>

                      {/* Suppression définitive autorisée pour le Chef de Quartier */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteListing(l._id, l.title)}
                        className="text-red-600 border-red-200 hover:bg-red-50 h-8 text-xs inline-flex items-center gap-1"
                        title="Suppression définitive réservée au Chef de Quartier"
                      >
                        <Trash2 className="size-3.5" />
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
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

          <div className="space-y-3">
            {leaders.map((ldr) => (
              <Card
                key={ldr.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs border-purple-500/30 bg-purple-500/5"
              >
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

                <div className="flex items-center gap-2">
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
              </Card>
            ))}
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
      {/* ONGLET 5 : FINANCES GLOBALES DU QUARTIER */}
      {/* ========================================================================= */}
      {activeTab === 'finances' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4 border-border">
              <p className="text-xs text-muted-foreground">Total Cotisations & Loyers Attendus</p>
              <p className="text-xl font-black text-foreground mt-1">
                {totalCotisations.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-emerald-500/30 bg-emerald-500/5">
              <p className="text-xs text-emerald-600 font-bold">Total Encaissé / Payé</p>
              <p className="text-xl font-black text-emerald-600 mt-1">
                {totalPaid.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>

            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <p className="text-xs text-amber-600 font-bold">Total En Retard / Impayé</p>
              <p className="text-xl font-black text-amber-600 mt-1">
                {totalUnpaid.toLocaleString('fr-FR')} FCFA
              </p>
            </Card>
          </div>

          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground">
              Ventilation par Bloc du Quartier
            </h3>
            <div className="space-y-2 text-xs">
              {blocks.map((b) => {
                const bHabitants = habitants.filter((h) => h.blockId === b.id);
                const bTotal = bHabitants.reduce((s, h) => s + h.rentOrCotisationAmount, 0);
                const bPaid = bHabitants
                  .filter((h) => h.isPaid)
                  .reduce((s, h) => s + h.rentOrCotisationAmount, 0);
                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border"
                  >
                    <div>
                      <p className="font-bold text-foreground">{b.name}</p>
                      <p className="text-muted-foreground text-[11px]">
                        Chef : {b.leaderName || 'Non assigné'} • {bHabitants.length} habitants
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-emerald-600">
                        {bPaid.toLocaleString('fr-FR')} FCFA encaissés
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        sur {bTotal.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
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
      {/* ONGLET 7 : MESSAGE GLOBAL À TOUT LE QUARTIER */}
      {/* ========================================================================= */}
      {activeTab === 'broadcast' && (
        <Card className="max-w-xl mx-auto p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Crown className="size-4 text-purple-600" />
              Communication Officielle du Chef de Quartier
            </h2>
            <p className="text-xs text-muted-foreground">
              Ce message sera notifié à l'ensemble des chefs de bloc et des habitants de tous les
              secteurs du quartier.
            </p>
          </div>

          <form onSubmit={handleSendGlobalMessage} className="space-y-3 text-xs">
            <textarea
              rows={4}
              value={globalMessage}
              onChange={(e) => setGlobalMessage(e.target.value)}
              placeholder="Ex : Chers administrés, suite aux travaux d'assainissement initiés par la mairie, une grande opération de salubrité publique aura lieu samedi..."
              required
              className="w-full rounded-xl border border-input bg-background p-3 text-xs"
            />
            <Button
              type="submit"
              disabled={!globalMessage.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              <Send className="size-4 mr-1.5" />
              Diffuser à l'ensemble du quartier
            </Button>
          </form>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 8 : RAPPORT MENSUEL PDF DU QUARTIER */}
      {/* ========================================================================= */}
      {activeTab === 'rapport' && (
        <Card className="p-6 max-w-3xl mx-auto space-y-6 border-purple-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-black text-foreground">
                Rapport Mensuel Officiel de la Chefferie Coutumière
              </h2>
              <p className="text-xs text-muted-foreground">
                Période : Novembre 2026 • Quartier Cocody
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Printer className="size-4" />
              Imprimer / Enregistrer en PDF
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-muted-foreground">Blocs Sous Gestion</p>
              <p className="text-lg font-black text-foreground mt-0.5">{blocks.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-muted-foreground">Habitants Recensés</p>
              <p className="text-lg font-black text-foreground mt-0.5">{habitants.length}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-muted-foreground">Annonces Publiées</p>
              <p className="text-lg font-black text-foreground mt-0.5">
                {listings.filter((l) => l.workflowStatus === 'PUBLIE').length}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border">
              <p className="text-muted-foreground">Incidents Enregistrés</p>
              <p className="text-lg font-black text-foreground mt-0.5">{incidents.length}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <h4 className="font-bold text-foreground">Bilan Financier et Cotisations</h4>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-1">
              <p>
                Total des cotisations et loyers encaissés :{' '}
                <strong className="text-emerald-600">{totalPaid.toLocaleString('fr-FR')} FCFA</strong>
              </p>
              <p>
                Reste à recouvrer :{' '}
                <strong className="text-amber-600">{totalUnpaid.toLocaleString('fr-FR')} FCFA</strong>
              </p>
              <p>
                Taux de recouvrement du quartier :{' '}
                <strong>
                  {totalCotisations > 0
                    ? `${Math.round((totalPaid / totalCotisations) * 100)}%`
                    : '100%'}
                </strong>
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex justify-between text-[11px] text-muted-foreground">
            <span>Visé par la Chefferie Coutumière</span>
            <span>Signature & Sceau du Chef de Quartier</span>
          </div>
        </Card>
      )}

      {/* MODAL : NOMMER UN CHEF DE BLOC */}
      <Modal open={newLeaderModalOpen} onOpenChange={setNewLeaderModalOpen} title="Nommer un Chef de Bloc">
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
            <label className="font-semibold block mb-1">Bloc assigné *</label>
            <select
              value={leaderBlockId}
              onChange={(e) => setLeaderBlockId(e.target.value)}
              className="w-full rounded-xl border border-input p-2 bg-background text-xs"
            >
              {blocks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewLeaderModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Nommer le Chef de Bloc
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

      {/* MODAL : MOTIF DE REJET */}
      <Modal open={rejectModalOpen} onOpenChange={setRejectModalOpen} title="Refuser l'annonce (Motif visible par l'habitant)">
        <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            Précisez le motif du refus. L'habitant verra ce motif pour corriger son annonce.
          </p>
          <div>
            <label className="font-semibold block mb-1">Motif explicite du refus *</label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex : Document de propriété incomplet ou litige en cours sur la parcelle..."
              required
              className="w-full rounded-xl border border-input bg-background p-3 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-bold">
              Confirmer le refus
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : MODIFIER UNE ANNONCE */}
      <Modal
        open={editListingModalOpen}
        onOpenChange={setEditListingModalOpen}
        title="Modifier l'annonce (Autorité Chefferie)"
      >
        <form onSubmit={handleSaveListingCorrection} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Titre de l'annonce</label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="font-semibold block mb-1">Prix mensuel (FCFA)</label>
              <Input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Superficie (m²)</label>
              <Input
                type="number"
                value={editSurface}
                onChange={(e) => setEditSurface(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Chambres</label>
              <Input
                type="number"
                value={editBedrooms}
                onChange={(e) => setEditBedrooms(Number(e.target.value))}
                required
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Description</label>
            <textarea
              rows={3}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditListingModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-500 text-white font-bold">
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
