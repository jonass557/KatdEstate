import { useState } from 'react';
import {
  AlertTriangle,
  Building,
  CheckCircle2,
  Copy,
  Edit3,
  FileCheck,
  Flame,
  KeyRound,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Shield,
  UserCheck,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';
import { useSession } from '../../app/session';
import { BlockLeaderGeoPanel } from '../../components/geo/BlockLeaderGeoPanel';
import {
  getBlockOwners,
  saveBlockOwner,
  getStoredHabitants,
  saveStoredHabitant,
  getStoredIncidents,
  saveStoredIncident,
  getWorkflowListings,
  updateListingWorkflow,
  saveWorkflowListings,
  type BlockOwnerRecord,
  type HabitantRecord,
  type QuartierIncidentRecord,
  type WorkflowListingItem,
} from '../../lib/katdestate-store';

export function BlockLeaderDashboard() {
  const { user } = useSession();
  const { toast } = useToast();

  // Le chef de bloc est cloisonné à son bloc unique
  const [activeBlock] = useState({
    id: 'block-1',
    code: 'BLOC-PALM-2',
    name: 'Bloc Riviera Palmeraie 2',
    neighborhoodName: 'Cocody',
  });

  const [tab, setTab] = useState<
    'habitants' | 'annonces' | 'proprietaires' | 'incidents' | 'messagerie' | 'cartographie'
  >('annonces');

  // Local data states
  const [habitants, setHabitants] = useState<HabitantRecord[]>(() =>
    getStoredHabitants().filter((h) => h.blockId === activeBlock.id),
  );
  const [owners, setOwners] = useState<BlockOwnerRecord[]>(() =>
    getBlockOwners().filter((o) => o.blockId === activeBlock.id),
  );
  const [incidents, setIncidents] = useState<QuartierIncidentRecord[]>(() =>
    getStoredIncidents().filter((i) => i.blockId === activeBlock.id),
  );
  const [listings, setListings] = useState<WorkflowListingItem[]>(() =>
    getWorkflowListings().filter(
      (l) => !l.location.blockId || l.location.blockId === activeBlock.id,
    ),
  );

  const refreshAll = () => {
    setHabitants(getStoredHabitants().filter((h) => h.blockId === activeBlock.id));
    setOwners(getBlockOwners().filter((o) => o.blockId === activeBlock.id));
    setIncidents(getStoredIncidents().filter((i) => i.blockId === activeBlock.id));
    setListings(
      getWorkflowListings().filter(
        (l) => !l.location.blockId || l.location.blockId === activeBlock.id,
      ),
    );
  };

  // Modals state
  const [newHabitantOpen, setNewHabitantOpen] = useState(false);
  const [newOwnerOpen, setNewOwnerOpen] = useState(false);
  const [newIncidentOpen, setNewIncidentOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [editListingModalOpen, setEditListingModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<WorkflowListingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Form states for new Habitant
  const [habitantName, setHabitantName] = useState('');
  const [habitantPhone, setHabitantPhone] = useState('+225 ');
  const [habitantEmail, setHabitantEmail] = useState('');
  const [residenceName, setResidenceName] = useState('');
  const [dwellingType, setDwellingType] = useState('Maison individuelle');
  const [rentOrCotisation, setRentOrCotisation] = useState(25000);
  const [isOwnerHabitant, setIsOwnerHabitant] = useState(false);

  // Form states for new Owner
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('+225 ');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('Proprio2026!');
  const [propertyName, setPropertyName] = useState('');
  const [propertyType, setPropertyType] = useState('Immeuble résidentiel');
  const [monthlyDues, setMonthlyDues] = useState(150000);

  // Form states for new Incident
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentCategory, setIncidentCategory] =
    useState<QuartierIncidentRecord['category']>('SECURITY');
  const [incidentSeverity, setIncidentSeverity] =
    useState<QuartierIncidentRecord['severity']>('MEDIUM');

  // Form state for editing listing
  const [editTitle, setEditTitle] = useState('');
  const [editPrice, setEditPrice] = useState(0);
  const [editSurface, setEditSurface] = useState(25);
  const [editBedrooms, setEditBedrooms] = useState(1);
  const [editDesc, setEditDesc] = useState('');

  // Broadcast state
  const [broadcastBody, setBroadcastBody] = useState('');

  // 1. Action: Valider le terrain (Passer à APPROUVE_BLOC)
  const handleApproveListing = (listingId: string) => {
    updateListingWorkflow(listingId, {
      workflowStatus: 'APPROUVE_BLOC',
      actorRole: 'BLOCK_LEADER',
      actorName: user?.displayName || 'M. Bakary Diarra (Chef de Bloc)',
    });
    refreshAll();
    toast({
      title: 'Vérification terrain validée !',
      description:
        'L’annonce est maintenant passée au statut APPROUVÉ BLOC. Elle est transmise au Chef de Quartier pour publication finale.',
      variant: 'success',
    });
  };

  // 2. Action: Refuser l'annonce avec motif visible par l'habitant
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListing || !rejectionReason.trim()) {
      toast({ title: 'Veuillez préciser le motif du refus.', variant: 'error' });
      return;
    }
    updateListingWorkflow(selectedListing._id, {
      workflowStatus: 'REFUSE',
      rejectionReason: rejectionReason.trim(),
      actorRole: 'BLOCK_LEADER',
      actorName: user?.displayName || 'M. Bakary Diarra (Chef de Bloc)',
    });
    refreshAll();
    setRejectModalOpen(false);
    setRejectionReason('');
    setSelectedListing(null);
    toast({
      title: 'Annonce refusée',
      description: 'Le motif de refus sera affiché à l’habitant pour correction.',
      variant: 'error',
    });
  };

  // 3. Action: Modifier / Corriger une annonce du bloc
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
      toast({ title: 'Annonce corrigée avec succès par le chef de bloc', variant: 'success' });
    }
  };

  // 4. Action: Basculer le statut paiement d'un habitant
  const handleToggleHabitantPaid = (habitant: HabitantRecord) => {
    const updated: HabitantRecord = {
      ...habitant,
      isPaid: !habitant.isPaid,
      paidAt: !habitant.isPaid ? new Date().toISOString() : undefined,
    };
    saveStoredHabitant(updated);
    refreshAll();
    toast({
      title: updated.isPaid ? 'Cotisation / Loyer marqué PAYÉ' : 'Statut remis en NON PAYÉ',
      variant: 'success',
    });
  };

  // 5. Action: Créer un habitant / maison dans son bloc
  const handleCreateHabitant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitantName.trim() || !residenceName.trim()) {
      toast({ title: 'Nom et maison obligatoires', variant: 'error' });
      return;
    }
    const newH: HabitantRecord = {
      id: `hab-${Date.now()}`,
      fullName: habitantName.trim(),
      phone: habitantPhone.trim(),
      email: habitantEmail.trim() || undefined,
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      residenceName: residenceName.trim(),
      dwellingType,
      isOwner: isOwnerHabitant,
      rentOrCotisationAmount: Number(rentOrCotisation) || 0,
      isPaid: false,
      createdAt: new Date().toISOString(),
    };
    saveStoredHabitant(newH);
    refreshAll();
    setNewHabitantOpen(false);
    setHabitantName('');
    setResidenceName('');
    toast({ title: 'Habitant ajouté à votre bloc avec succès !', variant: 'success' });
  };

  // 6. Action: Créer un propriétaire dans son bloc
  const handleCreateOwner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim() || !ownerEmail.trim() || !ownerPassword.trim()) {
      toast({ title: 'Nom, email et mot de passe requis', variant: 'error' });
      return;
    }
    const newO: BlockOwnerRecord = {
      id: `own-${Date.now()}`,
      fullName: ownerName.trim(),
      email: ownerEmail.trim().toLowerCase(),
      phone: ownerPhone.trim(),
      password: ownerPassword.trim(),
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      propertyName: propertyName.trim() || 'Propriété du bloc',
      propertyType,
      monthlyRentOrDues: Number(monthlyDues) || 0,
      status: 'ACTIVE',
      paymentStatus: 'PAID',
      createdAt: new Date().toISOString(),
    };
    saveBlockOwner(newO);
    refreshAll();
    setNewOwnerOpen(false);
    toast({
      title: 'Compte Propriétaire créé avec succès !',
      description: `${newO.fullName} peut se connecter avec : ${newO.email} / ${newO.password}`,
      variant: 'success',
    });
  };

  // 7. Action: Créer un signalement dans son bloc
  const handleCreateIncident = (e: React.FormEvent) => {
    e.preventDefault();
    if (!incidentTitle.trim()) {
      toast({ title: 'Titre du signalement requis', variant: 'error' });
      return;
    }
    const newInc: QuartierIncidentRecord = {
      id: `inc-${Date.now()}`,
      title: incidentTitle.trim(),
      description: incidentDesc.trim(),
      category: incidentCategory,
      severity: incidentSeverity,
      status: 'REPORTED',
      blockId: activeBlock.id,
      blockName: activeBlock.name,
      reportedBy: `${user?.displayName || 'Bakary Diarra'} (Chef de Bloc)`,
      createdAt: new Date().toISOString(),
    };
    saveStoredIncident(newInc);
    refreshAll();
    setNewIncidentOpen(false);
    setIncidentTitle('');
    setIncidentDesc('');
    toast({ title: 'Signalement enregistré dans le bloc', variant: 'success' });
  };

  // 8. Action: Envoyer un message broadcast aux habitants du bloc
  const handleSendBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastBody.trim()) return;
    toast({
      title: 'Message diffusé avec succès',
      description: `Le message a été transmis à l’ensemble des ${habitants.length} habitants du ${activeBlock.name}.`,
      variant: 'success',
    });
    setBroadcastBody('');
  };

  return (
    <div className="space-y-6">
      {/* Block Header Banner avec badge de restriction stricte */}
      <div className="flex flex-col gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-card via-card to-cyan-500/5 p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-600 text-white font-black text-xs">
              🛡️
            </span>
            <h1 className="text-xl font-black tracking-tight text-foreground">
              Dashboard Chef de Bloc : {activeBlock.name}
            </h1>
            <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              Code : {activeBlock.code}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Quartier de rattachement : <strong>{activeBlock.neighborhoodName}</strong> • Périmètre
            strict :{' '}
            <strong className="text-cyan-600 dark:text-cyan-400">
              Réservé exclusivement à votre bloc
            </strong>
          </p>
        </div>

        {/* Rappel des permissions Chef de Bloc */}
        <div className="flex items-center gap-2 bg-muted/40 p-2.5 rounded-xl border border-border text-[11px] text-muted-foreground">
          <Shield className="h-4 w-4 text-cyan-500 shrink-0" />
          <span>
            Autorisations : Gestion terrain, vérification des annonces, recensement des foyers et
            signalements de votre secteur.
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
        <button
          type="button"
          onClick={() => setTab('annonces')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            tab === 'annonces'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <FileCheck className="h-4 w-4" />
          <span>Annonces du Bloc ({listings.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('habitants')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            tab === 'habitants'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Habitants ({habitants.length})</span>
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
          <Building className="h-4 w-4" />
          <span>Propriétaires du Bloc ({owners.length})</span>
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
          <span>Signalements & Sécurité ({incidents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setTab('messagerie')}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition-all ${
            tab === 'messagerie'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>Message aux Habitants</span>
        </button>

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
          <span>Cartographie & Zones Propriétaires</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : ANNONCES DU BLOC & WORKFLOW VERIFICATION TERRAIN */}
      {/* ========================================================================= */}
      {tab === 'annonces' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Workflow des Annonces du Secteur (Vérification Terrain)
              </h2>
              <p className="text-xs text-muted-foreground">
                Vérifiez la réalité physique des logements sur le terrain, validez vers{' '}
                <strong className="text-cyan-500">APPROUVÉ BLOC</strong> ou refusez avec un motif
                explicite.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-lg bg-amber-500/10 text-amber-600 px-2.5 py-1 font-bold border border-amber-500/20">
                EN_ATTENTE :{' '}
                {listings.filter((l) => l.workflowStatus === 'EN_ATTENTE').length}
              </span>
              <span className="rounded-lg bg-cyan-500/10 text-cyan-600 px-2.5 py-1 font-bold border border-cyan-500/20">
                APPROUVÉ_BLOC :{' '}
                {listings.filter((l) => l.workflowStatus === 'APPROUVE_BLOC').length}
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
                    {/* Badge Workflow */}
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
                        {l.workflowStatus === 'EN_ATTENTE' && '⏳ En attente vérification terrain'}
                        {l.workflowStatus === 'APPROUVE_BLOC' && '🛡️ Approuvé Bloc'}
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
                    <p className="font-black text-cyan-600 text-sm">
                      {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                      <span className="text-[10px] font-normal text-muted-foreground"> / mois</span>
                    </p>

                    {/* Spécifications (Superficie & Chambres) */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>Superficie : <strong>{l.surfaceM2 || 25} m²</strong></span>
                      <span>•</span>
                      <span>Chambres : <strong>{l.bedrooms || 1}</strong></span>
                      <span>•</span>
                      <span>Pièces d'eau : <strong>{l.bathrooms || 1}</strong></span>
                    </div>

                    <p className="text-muted-foreground line-clamp-2 text-[11px]">
                      {l.description}
                    </p>

                    <div className="pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <p>
                        Déposé par : <strong>{l.authorName || l.contact?.name}</strong>
                      </p>
                      <p>Contact : {l.contact?.phone}</p>
                    </div>

                    {/* Motif de rejet si refusé */}
                    {l.workflowStatus === 'REFUSE' && l.rejectionReason && (
                      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-500">
                        <strong>Motif de refus :</strong> {l.rejectionReason}
                      </div>
                    )}
                  </div>

                  {/* Actions Chef de Bloc */}
                  <div className="p-3 border-t border-border bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      {l.workflowStatus === 'EN_ATTENTE' && (
                        <Button
                          size="sm"
                          onClick={() => handleApproveListing(l._id)}
                          className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-8 text-xs"
                        >
                          <CheckCircle2 className="size-3.5 mr-1" />
                          Valider (Approuvé Bloc)
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
                        Corriger
                      </Button>
                    </div>

                    <p className="text-[10px] text-muted-foreground text-center italic">
                      Protection : La suppression définitive est réservée au Chef de Quartier.
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : HABITANTS DU BLOC (RECENSEMENT & COTISATIONS) */}
      {/* ========================================================================= */}
      {tab === 'habitants' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Habitants & Foyers de votre Bloc ({habitants.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Recensement de proximité, suivi des paiements de cotisations et loyers de votre
                secteur.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewHabitantOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              + Ajouter un habitant / maison
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
                        h.isOwner
                          ? 'bg-purple-500/20 text-purple-600'
                          : 'bg-blue-500/20 text-blue-600'
                      }`}
                    >
                      {h.isOwner ? 'Propriétaire' : 'Locataire'}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                        h.isPaid
                          ? 'bg-emerald-500/20 text-emerald-600'
                          : 'bg-amber-500/20 text-amber-600'
                      }`}
                    >
                      {h.isPaid ? 'Cotisation / Loyer : PAYÉ' : 'Cotisation / Loyer : EN RETARD'}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Logement : <strong>{h.residenceName}</strong> ({h.dwellingType}) • Tél :{' '}
                    <strong>{h.phone}</strong>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Montant dû : <strong>{h.rentOrCotisationAmount.toLocaleString('fr-FR')} FCFA</strong>
                    {h.paidAt && ` • Encaissé le : ${new Date(h.paidAt).toLocaleDateString('fr-FR')}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={h.isPaid ? 'outline' : 'primary'}
                    onClick={() => handleToggleHabitantPaid(h)}
                    className={
                      h.isPaid
                        ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 h-8 text-xs'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white h-8 text-xs'
                    }
                  >
                    <CheckCircle2 className="size-3.5 mr-1" />
                    {h.isPaid ? 'Marquer Impayé' : 'Marquer Payé'}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 3 : PROPRIETAIRES DU BLOC (CREER IDENTIFIANTS) */}
      {/* ========================================================================= */}
      {tab === 'proprietaires' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Propriétaires Recensés dans votre Bloc ({owners.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                En tant que chef de bloc, vous pouvez créer les comptes des propriétaires de votre
                secteur afin qu'ils gèrent leurs biens.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewOwnerOpen(true)}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <UserCheck className="size-4" />
              + Créer un Propriétaire (Identifiants)
            </Button>
          </div>

          <div className="space-y-3">
            {owners.map((o) => (
              <Card
                key={o.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs border-cyan-500/30 bg-cyan-500/5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{o.fullName}</span>
                    <span className="rounded bg-cyan-500/20 text-cyan-600 px-2 py-0.5 text-[10px] font-bold">
                      PROPRIÉTAIRE CERTIFIÉ
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    Patrimoine : <strong>{o.propertyName}</strong> ({o.propertyType}) • Tél :{' '}
                    <strong>{o.phone}</strong>
                  </p>

                  <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-cyan-500/30 bg-background px-3 py-1.5 text-[11px]">
                    <KeyRound className="size-3.5 text-cyan-500" />
                    <span>
                      Email : <strong className="font-mono">{o.email}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Mot de passe : <strong className="font-mono">{o.password}</strong>
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
                        `Identifiants Propriétaire KatdEstate\nEmail : ${o.email}\nMot de passe : ${o.password}\nConnexion : ${window.location.origin}/sign-in`,
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
                      const cleanPhone = (o.phone || '').replace(/\D/g, '');
                      const text = encodeURIComponent(
                        `Bonjour ${o.fullName}, votre compte Propriétaire KatdEstate pour ${o.propertyName} a été créé.\n\nIdentifiants :\n- Email : ${o.email}\n- Mot de passe : ${o.password}\n- Lien : ${window.location.origin}/sign-in`,
                      );
                      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
                    }}
                  >
                    <MessageSquare className="size-3.5" />
                    WhatsApp
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 4 : SIGNALEMENTS DU BLOC */}
      {/* ========================================================================= */}
      {tab === 'incidents' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Sécurité & Signalements de votre Bloc ({incidents.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Suivi des alertes, dysfonctionnements et interventions de proximité.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setNewIncidentOpen(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <AlertTriangle className="size-4" />
              + Créer un signalement
            </Button>
          </div>

          <div className="space-y-2">
            {incidents.map((inc) => (
              <Card key={inc.id} className="p-3.5 space-y-2 text-xs border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{inc.title}</span>
                    <span className="rounded bg-red-500/20 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                      {inc.category}
                    </span>
                    <span className="rounded bg-amber-500/20 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                      Gravité : {inc.severity}
                    </span>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(inc.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-muted-foreground">{inc.description}</p>
                <div className="flex items-center justify-between pt-1 border-t border-border text-[11px] text-muted-foreground">
                  <span>Signalé par : {inc.reportedBy}</span>
                  <span className="font-semibold text-cyan-600">Statut : {inc.status}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 5 : MESSAGERIE DU BLOC */}
      {/* ========================================================================= */}
      {tab === 'messagerie' && (
        <Card className="max-w-xl mx-auto p-5 space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Send className="size-4 text-cyan-500" />
              Message groupé à tous les habitants de votre bloc
            </h2>
            <p className="text-xs text-muted-foreground">
              Cette communication sera transmise instantanément aux {habitants.length} habitants
              enregistrés dans le <strong>{activeBlock.name}</strong>.
            </p>
          </div>

          <form onSubmit={handleSendBroadcast} className="space-y-3 text-xs">
            <textarea
              rows={4}
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              placeholder="Ex : Réunion communautaire ce samedi à 16h au préau du bloc concernant l'éclairage public et la sécurité..."
              required
              className="w-full rounded-xl border border-input bg-background p-3 text-xs"
            />
            <Button
              type="submit"
              disabled={!broadcastBody.trim()}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
            >
              <Send className="size-4 mr-1.5" />
              Diffuser le message à tous les habitants du bloc
            </Button>
          </form>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 6 : CARTOGRAPHIE & ZONES PROPRIÉTAIRES DU BLOC (NIVEAU 2) */}
      {/* ========================================================================= */}
      {tab === 'cartographie' && (
        <BlockLeaderGeoPanel activeBlockId={activeBlock.id} onDataChanged={refreshAll} />
      )}

      {/* MODAL : NOUVEL HABITANT */}
      <Modal open={newHabitantOpen} onOpenChange={setNewHabitantOpen} title="Ajouter un habitant / maison">
        <form onSubmit={handleCreateHabitant} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet de l'habitant *</label>
            <Input
              value={habitantName}
              onChange={(e) => setHabitantName(e.target.value)}
              placeholder="Ex: Kouamé N'Goran"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={habitantPhone}
                onChange={(e) => setHabitantPhone(e.target.value)}
                placeholder="+225 07..."
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email</label>
              <Input
                type="email"
                value={habitantEmail}
                onChange={(e) => setHabitantEmail(e.target.value)}
                placeholder="habitant@gmail.com"
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Adresse / Maison *</label>
            <Input
              value={residenceName}
              onChange={(e) => setResidenceName(e.target.value)}
              placeholder="Ex: Villa N°12 Rue des Jardins ou Cour Commune Porte 4"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Type de logement</label>
              <select
                value={dwellingType}
                onChange={(e) => setDwellingType(e.target.value)}
                className="w-full rounded-xl border border-input p-2 bg-background text-xs"
              >
                <option value="Maison individuelle">Maison individuelle</option>
                <option value="Maison en carabot">Maison en carabot</option>
                <option value="Appartement">Appartement</option>
                <option value="Studio">Studio</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Montant Cotisation / Loyer (FCFA)</label>
              <Input
                type="number"
                value={rentOrCotisation}
                onChange={(e) => setRentOrCotisation(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isOwnerCheck"
              checked={isOwnerHabitant}
              onChange={(e) => setIsOwnerHabitant(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="isOwnerCheck" className="text-xs">
              Cet habitant est propriétaire de son logement
            </label>
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

      {/* MODAL : NOUVEAU PROPRIÉTAIRE */}
      <Modal open={newOwnerOpen} onOpenChange={setNewOwnerOpen} title="Créer un compte Propriétaire du Bloc">
        <form onSubmit={handleCreateOwner} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet du propriétaire *</label>
            <Input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="Ex: M. Jean-Baptiste Kouassi"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone *</label>
              <Input
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="+225 07..."
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email de connexion *</label>
              <Input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="proprio@katdestate.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Mot de passe de connexion *</label>
            <div className="flex gap-1.5">
              <Input
                type="text"
                value={ownerPassword}
                onChange={(e) => setOwnerPassword(e.target.value)}
                placeholder="Proprio2026!"
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
          <div>
            <label className="font-semibold block mb-1">Nom de la propriété / concession *</label>
            <Input
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              placeholder="Ex: Concession Kouassi (4 Maisons en carabot)"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Type de bien</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full rounded-xl border border-input p-2 bg-background text-xs"
              >
                <option value="Maison en carabot">Maison en carabot</option>
                <option value="Immeuble résidentiel">Immeuble résidentiel</option>
                <option value="Cour commune">Cour commune</option>
                <option value="Villa">Villa</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Loyer mensuel global (FCFA)</label>
              <Input
                type="number"
                value={monthlyDues}
                onChange={(e) => setMonthlyDues(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewOwnerOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Créer le compte Propriétaire
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : NOUVEAU SIGNALEMENT */}
      <Modal open={newIncidentOpen} onOpenChange={setNewIncidentOpen} title="Créer un signalement dans le bloc">
        <form onSubmit={handleCreateIncident} className="space-y-3 text-xs">
          <div>
            <label className="font-semibold block mb-1">Titre de l'incident / alerte *</label>
            <Input
              value={incidentTitle}
              onChange={(e) => setIncidentTitle(e.target.value)}
              placeholder="Ex: Panne transformateur électrique ou Fuite importante"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Catégorie</label>
              <select
                value={incidentCategory}
                onChange={(e) => setIncidentCategory(e.target.value as any)}
                className="w-full rounded-xl border border-input p-2 bg-background text-xs"
              >
                <option value="SECURITY">Sécurité & Vigilance</option>
                <option value="FIRE">Incendie</option>
                <option value="SANITATION">Assainissement & Eau</option>
                <option value="NOISE">Trouble du voisinage</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Niveau de gravité</label>
              <select
                value={incidentSeverity}
                onChange={(e) => setIncidentSeverity(e.target.value as any)}
                className="w-full rounded-xl border border-input p-2 bg-background text-xs"
              >
                <option value="LOW">Faible</option>
                <option value="MEDIUM">Moyenne</option>
                <option value="HIGH">Haute</option>
                <option value="URGENT">Urgente</option>
              </select>
            </div>
          </div>
          <div>
            <label className="font-semibold block mb-1">Description détaillée *</label>
            <textarea
              rows={3}
              value={incidentDesc}
              onChange={(e) => setIncidentDesc(e.target.value)}
              placeholder="Précisez le lieu exact et les démarches entreprises..."
              required
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setNewIncidentOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-bold">
              Enregistrer l'incident
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : MOTIF DE REJET VISIBLE PAR L'HABITANT */}
      <Modal open={rejectModalOpen} onOpenChange={setRejectModalOpen} title="Refuser l'annonce (Motif obligatoire)">
        <form onSubmit={handleConfirmReject} className="space-y-3 text-xs">
          <p className="text-muted-foreground">
            Le motif que vous écrivez ci-dessous sera directement affiché à l'habitant sur son
            tableau de bord pour qu'il puisse corriger son annonce.
          </p>
          <div>
            <label className="font-semibold block mb-1">Motif explicite du refus *</label>
            <textarea
              rows={4}
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ex : Après visite terrain, le logement n'est pas encore carrelé et le compteur électrique n'est pas individuel. Veuillez régulariser avant validation."
              required
              className="w-full rounded-xl border border-input bg-background p-3 text-xs"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setRejectModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" className="bg-red-600 hover:bg-red-500 text-white font-bold">
              Confirmer le refus avec ce motif
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL : CORRIGER / MODIFIER UNE ANNONCE */}
      <Modal
        open={editListingModalOpen}
        onOpenChange={setEditListingModalOpen}
        title="Corriger l'annonce du bloc (Modification Chef de Bloc)"
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
            <Button type="submit" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
              Enregistrer les corrections
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
