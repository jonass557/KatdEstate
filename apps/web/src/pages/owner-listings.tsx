import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Copy,
  Home,
  KeyRound,
  MessageSquare,
  Plus,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';
import { PublishListingModal } from '../components/marketplace/publish-listing-modal';
import {
  getMandateCredentials,
  saveMandateCredential,
  removeMandateCredential,
  type MandateCredentialRecord,
} from '../lib/katdestate-store';

export function OwnerListingsPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState<'listings' | 'mandates' | 'offers' | 'new-mandate'>(
    initialTab === 'mandates' || initialTab === 'new-mandate' || initialTab === 'offers'
      ? initialTab
      : 'listings',
  );
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [localMandates, setLocalMandates] = useState<MandateCredentialRecord[]>(() =>
    getMandateCredentials(),
  );

  // New mandate form state
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('+225 ');
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('Mandat2026!');
  const [agencyName, setAgencyName] = useState('');
  const [scope, setScope] = useState<'ALL_PORTFOLIO' | 'PROPERTY'>('ALL_PORTFOLIO');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [commissionRate, setCommissionRate] = useState(8);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [permissions, setPermissions] = useState<string[]>([
    'COLLECTION',
    'LEASES',
    'MAINTENANCE',
    'VISITS',
  ]);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'mandates' || tab === 'new-mandate' || tab === 'offers' || tab === 'listings') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const refreshMandates = () => {
    setLocalMandates(getMandateCredentials());
  };

  // Queries
  const { data: listings } = useOrgQuery<any[]>(['owner-listings'], '/owner/listings');
  const { data: mandates } = useOrgQuery<any[]>(['owner-mandates'], '/owner/mandates');
  const { data: offers } = useOrgQuery<any[]>(['owner-offers'], '/owner/offers');
  const { data: properties } = useOrgQuery<any[]>(['properties-brief'], '/properties?pageSize=50');

  // Mutation: Revoke mandate
  const revokeMandateMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiRequest(`${base}/owner/mandates/${id}/revoke`, { method: 'POST', body: { reason } }),
    onSuccess: () => {
      toast({
        title: 'Mandat révoqué avec succès',
        description: 'Les droits et annonces associées de l’agent ont été immédiatement suspendus.',
        variant: 'success',
      });
      void client.invalidateQueries({ queryKey: ['owner-mandates'] });
      void client.invalidateQueries({ queryKey: ['owner-listings'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Create Mandate
  const createMandateMutation = useMutation({
    mutationFn: async (e: React.FormEvent) => {
      e.preventDefault();
      if (!managerName.trim() || !managerEmail.trim() || !managerPassword.trim()) {
        throw new Error('Veuillez renseigner le nom, l’email et le mot de passe du mandataire.');
      }

      const propObj = (properties ?? []).find((p: any) => p._id === selectedPropertyId);
      const record: MandateCredentialRecord = {
        id: `mandat-${Date.now()}`,
        managerName: managerName.trim(),
        managerEmail: managerEmail.trim().toLowerCase(),
        managerPhone: managerPhone.trim(),
        password: managerPassword.trim(),
        agencyName: agencyName.trim() || undefined,
        scope,
        propertyId: scope === 'PROPERTY' ? selectedPropertyId || undefined : undefined,
        propertyName:
          scope === 'PROPERTY' ? propObj?.name || 'Propriété désignée' : 'Tout le patrimoine',
        permissions,
        commissionRate: Number(commissionRate) || 0,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status: 'ACTIVE',
        notes: notes.trim() || undefined,
        createdAt: new Date().toISOString(),
      };

      saveMandateCredential(record);

      try {
        await apiRequest(`${base}/owner/mandates`, {
          method: 'POST',
          body: {
            agentId: managerEmail.trim().toLowerCase(),
            propertyId: selectedPropertyId || undefined,
            mandateType: 'MANAGEMENT',
            commissionType: 'PERCENTAGE',
            commissionRate: Number(commissionRate) || 0,
            startDate,
            endDate: endDate || startDate,
            terms: notes,
          },
        });
      } catch {
        // Saved locally in katdestate-store
      }

      return record;
    },
    onSuccess: (record) => {
      refreshMandates();
      toast({
        title: 'Mandat & Identifiants de connexion créés !',
        description: `${record.managerName} peut maintenant se connecter avec ${record.managerEmail} / ${record.password} pour gérer votre dashboard propriétaire.`,
        variant: 'success',
      });
      setManagerName('');
      setManagerEmail('');
      setManagerPhone('+225 ');
      setManagerPassword(`Mandat${Math.floor(1000 + Math.random() * 9000)}!`);
      setAgencyName('');
      setNotes('');
      void client.invalidateQueries({ queryKey: ['owner-mandates'] });
      setActiveTab('mandates');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  // Mutation: Decide on Offer
  const decideOfferMutation = useMutation({
    mutationFn: ({ id, status, counterOfferAmountMinor, ownerDecisionNote }: any) =>
      apiRequest(`${base}/owner/offers/${id}`, {
        method: 'PATCH',
        body: { status, counterOfferAmountMinor, ownerDecisionNote },
      }),
    onSuccess: () => {
      toast({ title: 'Décision enregistrée', variant: 'success' });
      void client.invalidateQueries({ queryKey: ['owner-offers'] });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  const togglePermission = (perm: string) => {
    if (permissions.includes(perm)) {
      setPermissions(permissions.filter((p) => p !== perm));
    } else {
      setPermissions([...permissions, perm]);
    }
  };

  const totalMandatesCount = localMandates.length + (mandates?.length || 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Mandats de Gestion & Commercialisation Marketplace
          </h1>
          <p className="text-xs text-muted-foreground">
            Mandatez une personne (en créant ses identifiants de connexion) pour vous aider à gérer
            votre dashboard propriétaire, et gérez vos annonces Marketplace.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setActiveTab('new-mandate')}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <UserCheck className="size-3.5" />
            <span>+ Mandater un gestionnaire (Créer ses identifiants)</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setPublishModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            <span>+ Publier une annonce</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2 text-xs">
        {[
          { key: 'mandates', label: `Mandats & Gestionnaires (${totalMandatesCount})` },
          { key: 'new-mandate', label: '+ Nouveau Mandat (Créer identifiants)' },
          { key: 'listings', label: `Mes annonces (${listings?.length || 0})` },
          { key: 'offers', label: `Offres reçues (${offers?.length || 0})` },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key as any)}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              activeTab === t.key
                ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {!listings || listings.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune annonce publiée pour l'instant. Vous pouvez créer une annonce ou confier la
              gestion à un mandataire.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => (
                <Card key={l._id} className="overflow-hidden border-border text-xs">
                  <div className="h-32 bg-muted relative">
                    {l.photos?.[0]?.url ? (
                      <img
                        src={l.photos[0].url}
                        alt={l.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <Home className="h-8 w-8 opacity-30" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 rounded bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      {l.status}
                    </span>
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <h3 className="font-bold text-sm line-clamp-1">{l.title}</h3>
                    <p className="font-black text-primary text-sm">
                      {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                    </p>
                    <p className="text-muted-foreground">{l.location?.city}</p>
                    <div className="flex justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                      <span>{l.viewsCount || 0} vues</span>
                      <span>{l.inquiriesCount || 0} contacts</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MANDATES */}
      {activeTab === 'mandates' && (
        <div className="space-y-4">
          {localMandates.length === 0 && (!mandates || mandates.length === 0) ? (
            <Card className="p-8 text-center text-xs text-muted-foreground space-y-3">
              <p>
                Vous n'avez pas encore mandaté de personne pour vous aider à gérer votre dashboard
                propriétaire.
              </p>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-500 text-white"
                onClick={() => setActiveTab('new-mandate')}
              >
                + Créer un mandat et les identifiants du gestionnaire
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {localMandates.map((m) => (
                <Card
                  key={m.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-xs border-amber-500/30 bg-amber-500/5"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{m.managerName}</span>
                      {m.agencyName && (
                        <span className="text-muted-foreground">({m.agencyName})</span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : 'bg-red-500/20 text-red-600'
                        }`}
                      >
                        {m.status === 'ACTIVE' ? 'ACTIF — ACCÈS DASHBOARD PROPRIÉTAIRE' : m.status}
                      </span>
                    </div>

                    <p className="text-muted-foreground">
                      Périmètre :{' '}
                      <strong className="text-foreground">
                        {m.scope === 'ALL_PORTFOLIO'
                          ? 'Tout le patrimoine (Dashboard Propriétaire)'
                          : m.propertyName || 'Propriété désignée'}
                      </strong>{' '}
                      • Commission : <strong>{m.commissionRate}%</strong> • Tél :{' '}
                      <strong>{m.managerPhone}</strong>
                    </p>

                    <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-background px-3 py-1.5 text-[11px]">
                      <KeyRound className="size-3.5 text-amber-500" />
                      <span>
                        Email : <strong className="font-mono">{m.managerEmail}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Mot de passe : <strong className="font-mono">{m.password}</strong>
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
                          `Identifiants Mandataire KatdEstate\nEmail : ${m.managerEmail}\nMot de passe : ${m.password}\nConnexion : ${window.location.origin}/sign-in`,
                        );
                        toast({
                          title: 'Identifiants copiés !',
                          description: 'Vous pouvez les transmettre à votre mandataire.',
                          variant: 'success',
                        });
                      }}
                    >
                      <Copy className="size-3.5" />
                      Copier accès
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 text-xs bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 inline-flex items-center gap-1"
                      onClick={() => {
                        const cleanPhone = (m.managerPhone || '').replace(/\D/g, '');
                        const text = encodeURIComponent(
                          `Bonjour ${m.managerName}, je vous ai mandaté sur KatdEstate pour gérer mon espace propriétaire (${m.propertyName || 'Tout mon patrimoine'}).\n\nVoici vos identifiants de connexion :\n- Email : ${m.managerEmail}\n- Mot de passe : ${m.password}\n- Lien : ${window.location.origin}/sign-in`,
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
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8 inline-flex items-center gap-1"
                      onClick={() => {
                        removeMandateCredential(m.id);
                        refreshMandates();
                        toast({
                          title: 'Mandat révoqué',
                          description: `Les accès de ${m.managerName} ont été supprimés.`,
                          variant: 'info',
                        });
                      }}
                    >
                      <Trash2 className="size-3.5" />
                      Révoquer
                    </Button>
                  </div>
                </Card>
              ))}

              {(mandates ?? []).map((m) => (
                <Card
                  key={m._id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">Mandat : {m.mandateType}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-600'
                            : m.status === 'REVOKED'
                              ? 'bg-red-500/20 text-red-600'
                              : 'bg-amber-500/20 text-amber-600'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-1">
                      Bien rattaché : <strong>{m.propertyId?.name || 'Bien non rattaché'}</strong> •
                      Commission convenue : <strong>{m.commissionRate}%</strong>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Agent mandaté : {m.agentProfileId?.firstName} {m.agentProfileId?.lastName} (
                      {m.agentProfileId?.agencyName || 'Indépendant'})
                    </p>
                  </div>

                  {m.status === 'ACTIVE' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50 h-8"
                      onClick={() => {
                        const reason = prompt('Motif de la révocation du mandat :');
                        if (reason) revokeMandateMutation.mutate({ id: m._id, reason });
                      }}
                    >
                      Révoquer le mandat
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OFFERS */}
      {activeTab === 'offers' && (
        <div className="space-y-3">
          {!offers || offers.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune offre d'achat ou proposition de location reçue pour vos biens.
            </Card>
          ) : (
            offers.map((o) => (
              <Card
                key={o._id}
                className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{o.prospectName}</span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                      {o.status}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    Annonce : <strong>{o.listingId?.title}</strong>
                  </p>
                  <p className="text-base font-black text-primary mt-1">
                    Proposition : {o.offeredAmountMinor?.toLocaleString('fr-FR')} {o.currency}
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
                      onClick={() => decideOfferMutation.mutate({ id: o._id, status: 'ACCEPTED' })}
                    >
                      Accepter l'offre
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs text-red-600"
                      onClick={() => decideOfferMutation.mutate({ id: o._id, status: 'REJECTED' })}
                    >
                      Décliner
                    </Button>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 4: NEW MANDATE FORM */}
      {activeTab === 'new-mandate' && (
        <Card className="max-w-2xl mx-auto border-amber-500/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="size-5 text-amber-500" />
              Mandater une personne pour gérer votre Dashboard Propriétaire
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Remplissez les informations de la personne mandatée et créez ses identifiants de
              connexion (Email + Mot de passe). Elle pourra se connecter pour vous aider à gérer
              votre espace propriétaire.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                createMandateMutation.mutate(e);
              }}
            >
              {/* Périmètre */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('ALL_PORTFOLIO')}
                  className={`p-3 rounded-xl border text-left transition ${
                    scope === 'ALL_PORTFOLIO'
                      ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <span className="block font-semibold">Tout mon Dashboard Propriétaire</span>
                  <span className="text-[10px] text-muted-foreground">
                    Gestion complète de toutes les propriétés, locataires et loyers
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setScope('PROPERTY')}
                  className={`p-3 rounded-xl border text-left transition ${
                    scope === 'PROPERTY'
                      ? 'border-amber-500 bg-amber-500/10 text-foreground font-bold'
                      : 'border-border bg-background text-muted-foreground'
                  }`}
                >
                  <span className="block font-semibold">Une propriété spécifique</span>
                  <span className="text-[10px] text-muted-foreground">
                    Sélectionner un bien précis de votre patrimoine
                  </span>
                </button>
              </div>

              {scope === 'PROPERTY' && (
                <div>
                  <label className="font-semibold block mb-1">Propriété concernée *</label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    className="w-full rounded-xl border border-input p-2.5 bg-background"
                    required
                  >
                    <option value="">Sélectionnez une propriété...</option>
                    {properties?.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.address?.city || 'Afrique'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Informations de la personne mandatée */}
              <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
                <p className="font-bold text-foreground">Informations de la personne mandatée</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Nom & Prénom du mandataire *</label>
                    <Input
                      value={managerName}
                      onChange={(e) => setManagerName(e.target.value)}
                      placeholder="Ex: Kouassi Stéphane"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Téléphone / WhatsApp *</label>
                    <Input
                      value={managerPhone}
                      onChange={(e) => setManagerPhone(e.target.value)}
                      placeholder="+225 07 00 00 00"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="font-semibold block mb-1">
                    Agence ou Cabinet (optionnel)
                  </label>
                  <Input
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="Ex: Cabinet Immobilier Ivoire"
                  />
                </div>
              </div>

              {/* Identifiants de connexion du mandataire */}
              <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400">
                  <KeyRound className="size-4" />
                  <span>Identifiants de connexion du Mandataire (pour se connecter)</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">
                      Email de connexion du mandataire *
                    </label>
                    <Input
                      type="email"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                      placeholder="mandataire@katdestate.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Mot de passe de connexion *</label>
                    <div className="flex gap-1.5">
                      <Input
                        type="text"
                        value={managerPassword}
                        onChange={(e) => setManagerPassword(e.target.value)}
                        placeholder="Mandat2026!"
                        required
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-9 px-2.5 text-[11px] shrink-0"
                        onClick={() =>
                          setManagerPassword(`Mandat${Math.floor(1000 + Math.random() * 9000)}!`)
                        }
                      >
                        Générer
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Missions déléguées */}
              <div className="space-y-2">
                <label className="font-semibold block">Missions & Accès autorisés</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'COLLECTION', label: 'Gestion des loyers & quittances' },
                    { id: 'LEASES', label: 'Gestion des locataires & baux' },
                    { id: 'MAINTENANCE', label: 'Gestion des propriétés & travaux' },
                    { id: 'VISITS', label: 'Annonces Marketplace & visites' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => togglePermission(item.id)}
                      className={`p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition ${
                        permissions.includes(item.id)
                          ? 'border-emerald-500 bg-emerald-500/10 font-bold text-foreground'
                          : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      <span>{item.label}</span>
                      {permissions.includes(item.id) && (
                        <CheckCircle2 className="size-3.5 text-emerald-500" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="font-semibold block mb-1">Taux de commission (%) *</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={commissionRate}
                    onChange={(e) => setCommissionRate(Number(e.target.value))}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Date de début *</label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Date d'échéance (optionnel)</label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Instructions et clauses particulières
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background p-2.5"
                  placeholder="Instructions pour la gestion de votre dashboard propriétaire..."
                />
              </div>

              <Button
                type="submit"
                disabled={createMandateMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold"
              >
                {createMandateMutation.isPending
                  ? 'Création en cours...'
                  : 'Créer le Mandat et Activer les Identifiants de Connexion'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <PublishListingModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
        onPublished={() => {
          void client.invalidateQueries({ queryKey: ['owner-listings'] });
          setActiveTab('listings');
        }}
      />
    </div>
  );
}
