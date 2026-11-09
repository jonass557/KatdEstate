import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Bell,
  Building,
  Flame,
  Home,
  Phone,
  PhoneCall,
  Plus,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { useToast } from '../../components/ui/toast';
import { apiRequest } from '../../lib/api-client';
import { PublishListingModal } from '../../components/marketplace/publish-listing-modal';
import { getWorkflowListings, type WorkflowListingItem } from '../../lib/katdestate-store';

const RESIDENCE_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL_HOUSE', label: 'Maison individuelle' },
  { value: 'RESIDENTIAL_BUILDING', label: 'Immeuble résidentiel' },
  { value: 'APARTMENT', label: 'Appartement' },
  { value: 'STUDIO', label: 'Studio' },
  { value: 'COLLECTIVE_RESIDENCE', label: 'Résidence collective' },
  { value: 'COMMERCIAL_RESIDENTIAL', label: 'Logement commercial et résidentiel' },
  { value: 'OTHER_BUILDING', label: 'Autre type' },
];

const INCIDENT_CATEGORIES = [
  { value: 'FIRE', label: 'Incendie' },
  { value: 'FLOOD', label: 'Inondation' },
  { value: 'THEFT', label: 'Vol / Cambriolage' },
  { value: 'ACCIDENT', label: 'Accident' },
  { value: 'NEIGHBORHOOD_HAZARD', label: 'Danger dans le quartier' },
  { value: 'DAMAGED_INFRASTRUCTURE', label: 'Infrastructure endommagée (câbles, route, tuyau)' },
  { value: 'PUBLIC_SERVICES_EMERGENCY', label: 'Urgence services publics' },
  { value: 'OTHER', label: 'Autre incident' },
];

export function ResidentPortal() {
  const { toast } = useToast();
  const client = useQueryClient();
  const [activeTab, setActiveTab] = useState<
    'register' | 'report' | 'annonces' | 'emergencies' | 'announcements'
  >('register');
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [myListings, setMyListings] = useState<WorkflowListingItem[]>(() =>
    getWorkflowListings(),
  );

  const refreshListings = () => {
    setMyListings(getWorkflowListings());
  };

  // Queries for territory selection
  const { data: cities } = useQuery<any[]>({
    queryKey: ['quartier-cities'],
    queryFn: () => apiRequest('/quartier/cities'),
  });

  const [selectedCityId, setSelectedCityId] = useState('');
  const { data: neighborhoods } = useQuery<any[]>({
    queryKey: ['quartier-neighborhoods', selectedCityId],
    queryFn: () => apiRequest(`/quartier/neighborhoods?cityId=${selectedCityId}`),
    enabled: Boolean(selectedCityId),
  });

  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState('');
  const { data: blocks } = useQuery<any[]>({
    queryKey: ['quartier-blocks', selectedNeighborhoodId],
    queryFn: () => apiRequest(`/quartier/blocks?neighborhoodId=${selectedNeighborhoodId}`),
    enabled: Boolean(selectedNeighborhoodId),
  });

  // Emergency contacts query
  const { data: emergencyContacts } = useQuery<any[]>({
    queryKey: ['quartier-emergency-contacts', selectedNeighborhoodId],
    queryFn: () =>
      apiRequest(`/quartier/emergency-contacts?neighborhoodId=${selectedNeighborhoodId}`),
  });

  // Announcements query
  const { data: announcements } = useQuery<any[]>({
    queryKey: ['quartier-announcements', selectedNeighborhoodId],
    queryFn: () => apiRequest(`/quartier/announcements?neighborhoodId=${selectedNeighborhoodId}`),
    enabled: Boolean(selectedNeighborhoodId),
  });

  // Mutation: Register household & residence
  const registerMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest('/quartier/residents/register', { method: 'POST', body }),
    onSuccess: (res: any) => {
      toast({
        title: 'Enregistrement réussi !',
        description:
          res?.message || 'Votre dossier a été transmis à votre chef de bloc pour validation.',
        variant: 'success',
      });
      void client.invalidateQueries({ queryKey: ['quartier-blocks'] });
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur d’enregistrement', description: err.message, variant: 'error' }),
  });

  // Mutation: Report incident
  const reportMutation = useMutation({
    mutationFn: (body: unknown) => apiRequest('/quartier/incidents', { method: 'POST', body }),
    onSuccess: (res: any) => {
      toast({
        title: 'Signalement transmis',
        description:
          res?.message || 'Votre signalement confidentiel a été transmis aux responsables.',
        variant: 'success',
      });
      setActiveTab('announcements');
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-2 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Espace Habitant & Citoyenneté — KatdEstate Quartier
        </div>
        <h1 className="text-2xl font-black text-foreground">
          Portail Résident & Sécurité Communautaire
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Recensez gratuitement votre résidence, déclarez les membres de votre foyer en toute
          confidentialité, signalez un incident et accédez aux numéros d'urgence locaux.
        </p>
      </div>

      {/* Tabs navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('annonces')}
          className={`flex items-center justify-center gap-1.5 rounded-xl p-3 border transition-colors ${
            activeTab === 'annonces'
              ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Store className="h-4 w-4" /> Mes Annonces ({myListings.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('register')}
          className={`flex items-center justify-center gap-1.5 rounded-xl p-3 border transition-colors ${
            activeTab === 'register'
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Home className="h-4 w-4" /> Recenser mon logement
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('report')}
          className={`flex items-center justify-center gap-1.5 rounded-xl p-3 border transition-colors ${
            activeTab === 'report'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Flame className="h-4 w-4" /> Signaler un incident
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('emergencies')}
          className={`flex items-center justify-center gap-1.5 rounded-xl p-3 border transition-colors ${
            activeTab === 'emergencies'
              ? 'bg-red-600 text-white border-red-600 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <PhoneCall className="h-4 w-4" /> Urgences du secteur
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('announcements')}
          className={`flex items-center justify-center gap-1.5 rounded-xl p-3 border transition-colors ${
            activeTab === 'announcements'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          <Bell className="h-4 w-4" /> Alertes & Infos
        </button>
      </div>

      {/* TAB 0: MES ANNONCES & WORKFLOW DE VALIDATION */}
      {activeTab === 'annonces' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-muted/20 p-4 rounded-2xl border border-border">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Suivi du Workflow de vos Annonces
              </h2>
              <p className="text-xs text-muted-foreground">
                Workflow : Habitant crée (EN_ATTENTE) ➔ Chef de Bloc vérifie sur le terrain (APPROUVE_BLOC) ➔ Chef de Quartier publie sur le site (PUBLIÉ).
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setPublishModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs inline-flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              + Déposer une annonce
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myListings.map((l) => (
              <Card key={l._id} className="overflow-hidden border border-border bg-card flex flex-col justify-between text-xs">
                <div className="p-4 space-y-2">
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
                      {l.workflowStatus === 'EN_ATTENTE' && '⏳ En attente vérif. terrain'}
                      {l.workflowStatus === 'APPROUVE_BLOC' && '🛡️ Validé Bloc (Attente Chef Quartier)'}
                      {l.workflowStatus === 'PUBLIE' && '✅ Publié sur le site web'}
                      {l.workflowStatus === 'REFUSE' && '❌ Rejeté'}
                    </span>

                    {l.category === 'CARABOT' && (
                      <span className="rounded bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                        Maison en carabot
                      </span>
                    )}
                  </div>

                  {l.photos?.[0]?.url && (
                    <div className="h-28 overflow-hidden rounded-xl bg-muted">
                      <img src={l.photos[0].url} alt={l.title} className="h-full w-full object-cover" />
                    </div>
                  )}

                  <h3 className="font-bold text-sm text-foreground line-clamp-1">{l.title}</h3>
                  <p className="font-black text-purple-600 text-sm">
                    {l.priceMinor.toLocaleString('fr-FR')} {l.currency}
                  </p>
                  <p className="text-muted-foreground text-[11px] line-clamp-2">{l.description}</p>

                  {/* Motif de rejet explicite visible par l'habitant */}
                  {l.workflowStatus === 'REFUSE' && l.rejectionReason && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-[11px] text-red-500">
                      <strong>Motif du refus :</strong> {l.rejectionReason}
                    </div>
                  )}
                </div>

                <div className="p-3 border-t border-border bg-muted/10 text-[11px] text-muted-foreground">
                  <span>Créé le : {new Date(l.createdAt).toLocaleDateString('fr-FR')}</span>
                </div>
              </Card>
            ))}
          </div>

          <PublishListingModal
            isOpen={publishModalOpen}
            onClose={() => {
              setPublishModalOpen(false);
              refreshListings();
            }}
            onPublished={() => {
              refreshListings();
            }}
          />
        </div>
      )}

      {/* TAB 1: ENREGISTRER MA RÉSIDENCE */}
      {activeTab === 'register' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" /> Formulaire d'enregistrement de résidence
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Remplissez les informations de votre habitation. Ce formulaire est gratuit et vos
              données privées sont protégées.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                registerMutation.mutate({
                  cityId: selectedCityId,
                  neighborhoodId: selectedNeighborhoodId,
                  blockId: form.get('blockId'),
                  address: form.get('address'),
                  landmark: form.get('landmark') || undefined,
                  buildingType: form.get('buildingType'),
                  fullName: form.get('fullName'),
                  phone: form.get('phone'),
                  email: form.get('email') || undefined,
                  householdSize: Number(form.get('householdSize')),
                  minorsCount: Number(form.get('minorsCount')),
                  arrivalDate: form.get('arrivalDate') || undefined,
                  emergencyContactName: form.get('emergencyContactName') || undefined,
                  emergencyContactPhone: form.get('emergencyContactPhone') || undefined,
                  consentAccepted: form.get('consentAccepted') === 'on',
                });
              }}
            >
              {/* Sector Cascading Select */}
              <div className="grid gap-3 sm:grid-cols-3 bg-muted/30 p-3 rounded-xl border border-border">
                <div>
                  <label className="font-bold block mb-1">1. Ville *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    value={selectedCityId}
                    onChange={(e) => {
                      setSelectedCityId(e.target.value);
                      setSelectedNeighborhoodId('');
                    }}
                    required
                  >
                    <option value="">Sélectionnez votre ville...</option>
                    {cities?.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.country})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">2. Quartier *</label>
                  <select
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    value={selectedNeighborhoodId}
                    onChange={(e) => setSelectedNeighborhoodId(e.target.value)}
                    disabled={!selectedCityId}
                    required
                  >
                    <option value="">Sélectionnez votre quartier...</option>
                    {neighborhoods?.map((n) => (
                      <option key={n._id} value={n._id}>
                        {n.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">3. Bloc / Carré *</label>
                  <select
                    name="blockId"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    disabled={!selectedNeighborhoodId}
                    required
                  >
                    <option value="">Sélectionnez votre bloc...</option>
                    {blocks?.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Residence Details */}
              <div className="space-y-3 pt-2">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <Building className="h-4 w-4 text-primary" /> Informations sur le bâtiment
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Type d'habitation *</label>
                    <select
                      name="buildingType"
                      className="w-full rounded-md border border-input bg-background p-2 text-xs"
                      defaultValue="INDIVIDUAL_HOUSE"
                    >
                      {RESIDENCE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Adresse ou numéro de rue *</label>
                    <Input
                      name="address"
                      placeholder="Ex: Rue 14 x Boulevard Central, Villa 42"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="font-semibold block mb-1">
                    Repère visuel (facultatif mais recommandé)
                  </label>
                  <Input
                    name="landmark"
                    placeholder="Ex: Derrière la pharmacie, en face de la grande mosquée"
                  />
                </div>
              </div>

              {/* Household & Privacy-first Resident Info */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" /> Déclaration du foyer (Chef de famille /
                  Habitant)
                </h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="font-semibold block mb-1">Nom et prénom *</label>
                    <Input name="fullName" placeholder="Ex: Mamadou Diallo" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Téléphone / WhatsApp *</label>
                    <Input name="phone" placeholder="Ex: +221 77 123 45 67" required />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Adresse email (facultatif)</label>
                    <Input name="email" type="email" placeholder="email@kadtestate.immo" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 bg-muted/20 p-3 rounded-xl border border-border">
                  <div>
                    <label className="font-semibold block mb-1">
                      Nombre total de personnes au foyer *
                    </label>
                    <Input
                      name="householdSize"
                      type="number"
                      min="1"
                      max="50"
                      defaultValue="1"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">
                      Nombre d'enfants / mineurs (agrégé)
                    </label>
                    <Input name="minorsCount" type="number" min="0" max="50" defaultValue="0" />
                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                      Par respect de la vie privée, aucun profil nominatif de mineur n'est collecté.
                    </span>
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">Date d'installation</label>
                    <Input name="arrivalDate" type="date" />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="font-semibold block mb-1">Contact d'urgence (Nom)</label>
                    <Input
                      name="emergencyContactName"
                      placeholder="Proche à contacter en cas d'urgence"
                    />
                  </div>
                  <div>
                    <label className="font-semibold block mb-1">
                      Téléphone du contact d'urgence
                    </label>
                    <Input name="emergencyContactPhone" placeholder="+221 77 000 00 00" />
                  </div>
                </div>
              </div>

              {/* Consent RGPD / Protection des données */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="consentAccepted"
                    name="consentAccepted"
                    required
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label
                    htmlFor="consentAccepted"
                    className="text-xs leading-relaxed text-foreground"
                  >
                    <strong>Consentement éclairé :</strong> Je certifie l'exactitude de ces
                    informations et consens à leur transmission sécurisée à mon chef de bloc dans le
                    cadre exclusif du recensement résidentiel et de la sécurité communautaire. Je
                    dispose d'un droit d'accès, de rectification et de suppression conformément aux
                    lois sur la protection des données personnelles.
                  </label>
                </div>
              </div>

              <Button
                type="submit"
                disabled={registerMutation.isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-700 h-10 font-bold"
              >
                {registerMutation.isPending
                  ? 'Enregistrement en cours...'
                  : 'Valider mon enregistrement de résidence'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 2: SIGNALER UN INCIDENT */}
      {activeTab === 'report' && (
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" /> Signalement de sécurité & incident communautaire
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Signalez un danger, un accident, une inondation ou une urgence. Votre signalement est{' '}
              <strong>confidentiel</strong> et n'expose jamais votre identité sur les écrans publics
              des autres résidents.
            </p>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4 text-xs"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                reportMutation.mutate({
                  neighborhoodId: selectedNeighborhoodId,
                  category: form.get('category'),
                  severity: form.get('severity'),
                  description: form.get('description'),
                  locationText: form.get('locationText'),
                  reporterName: form.get('reporterName') || undefined,
                  reporterPhone: form.get('reporterPhone') || undefined,
                  isAnonymous: form.get('isAnonymous') === 'on',
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-bold block mb-1">Catégorie de l'incident *</label>
                  <select
                    name="category"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    required
                  >
                    {INCIDENT_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">Niveau d'urgence / Gravité *</label>
                  <select
                    name="severity"
                    className="w-full rounded-md border border-input bg-background p-2 text-xs"
                    defaultValue="MEDIUM"
                  >
                    <option value="LOW">Faible (Information)</option>
                    <option value="MEDIUM">Moyen (Vigilance)</option>
                    <option value="HIGH">Élevé (Danger avéré)</option>
                    <option value="CRITICAL">Critique (Urgence absolue / Secours immédiats)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Lieu précis ou repère géographique *
                </label>
                <Input
                  name="locationText"
                  placeholder="Ex: Carrefour du marché, près du transformateur"
                  required
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Description détaillée de la situation *
                </label>
                <textarea
                  name="description"
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-2.5 text-xs"
                  placeholder="Décrivez précisément ce qui se passe pour aider les secours et le chef de bloc..."
                  required
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 bg-muted/20 p-3 rounded-xl border border-border">
                <div>
                  <label className="font-semibold block mb-1">Votre nom (facultatif)</label>
                  <Input
                    name="reporterName"
                    placeholder="Pour permettre aux secours de vous joindre"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Votre téléphone (facultatif)</label>
                  <Input name="reporterPhone" placeholder="+221 77..." />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAnonymous"
                  name="isAnonymous"
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="isAnonymous" className="text-xs text-muted-foreground">
                  Garder mon signalement 100% anonyme
                </label>
              </div>

              <Button
                type="submit"
                disabled={reportMutation.isPending}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold h-10"
              >
                {reportMutation.isPending ? 'Transmission...' : 'Envoyer le signalement d’urgence'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* TAB 3: CONTACTS D'URGENCE DU SECTEUR */}
      {activeTab === 'emergencies' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-800 dark:text-red-300">
            <strong>Numéros d'urgence officiels :</strong> En cas de danger immédiat pour la vie
            d'autrui, composez directement les numéros abrégés ci-dessous.
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {emergencyContacts?.map((c: any, idx: number) => (
              <Card key={idx} className="p-4 flex flex-col justify-between border-border text-xs">
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground">{c.name}</h3>
                    {c.shortNumber && (
                      <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-black text-white">
                        {c.shortNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px] mt-1">{c.serviceType}</p>
                </div>
                <div className="pt-3 border-t border-border mt-3 flex items-center justify-between">
                  <span className="font-bold text-primary">{c.phone}</span>
                  <a
                    href={`tel:${c.phone}`}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Phone className="h-3 w-3" /> Appeler
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: ALERTES & ANNONCES DU QUARTIER */}
      {activeTab === 'announcements' && (
        <div className="space-y-4">
          {!announcements || announcements.length === 0 ? (
            <Card className="p-8 text-center text-xs text-muted-foreground">
              Aucune annonce ou alerte diffusée pour le moment dans votre secteur.
            </Card>
          ) : (
            <div className="space-y-3">
              {announcements.map((a: any) => (
                <Card
                  key={a._id}
                  className={`p-4 text-xs border ${
                    a.type === 'URGENT_ALERT'
                      ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500/20'
                      : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          a.type === 'URGENT_ALERT'
                            ? 'bg-red-600 text-white'
                            : 'bg-primary text-primary-foreground'
                        }`}
                      >
                        {a.type === 'URGENT_ALERT' ? 'ALERTE URGENTE' : a.type}
                      </span>
                      <h3 className="font-bold text-sm text-foreground">{a.title}</h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  <p className="mt-2 text-foreground/90 whitespace-pre-line leading-relaxed">
                    {a.message}
                  </p>
                  <div className="mt-3 pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Publié par : {a.authorId?.name || 'Chef de secteur'} ({a.authorRole})
                    </span>
                    {a.eventDate && (
                      <span className="font-semibold text-primary">
                        Date prévue : {new Date(a.eventDate).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
