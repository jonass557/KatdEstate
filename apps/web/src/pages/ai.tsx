import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  Bot,
  Calculator,
  Check,
  Copy,
  FileCheck2,
  FileText,
  HelpCircle,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { BackButton } from '../components/ui/back-button';
import {
  estimatePropertyPriceAI,
  type AiPriceEstimateResult,
} from '../lib/katdestate-store';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath } from '../lib/query';
import { useOrganization } from '../app/organization';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  insights?:
    | {
        kind?: string | undefined;
        data?: unknown;
      }
    | undefined;
}

const SUGGESTIONS = [
  'Combien ai-je encaissé ce mois-ci ?',
  'Quels locataires sont en retard de paiement ?',
  'Quel immeuble est le plus rentable ?',
  'Quelles propriétés ont des logements vacants ?',
  'Quel est le montant total des dépenses de maintenance ?',
  'Quels baux arrivent bientôt à expiration ?',
];

const DRAFT_TYPES = [
  {
    value: 'RENT_REMINDER',
    label: 'Rappel amical d’échéance',
    desc: 'Courrier ou email prévenant le locataire avant l’échéance.',
  },
  {
    value: 'LATE_NOTICE',
    label: 'Relance pour impayé',
    desc: 'Rappel ferme pour un loyer dépassé depuis quelques jours.',
  },
  {
    value: 'FORMAL_NOTICE',
    label: 'Mise en demeure (8 jours)',
    desc: 'Lettre de mise en demeure formelle avant action judiciaire.',
  },
  {
    value: 'RENEWAL_PROPOSAL',
    label: 'Proposition de renouvellement',
    desc: 'Offre de renouvellement de bail avec ajustement éventuel.',
  },
  {
    value: 'MAINTENANCE_UPDATE',
    label: 'Point sur intervention de maintenance',
    desc: 'Information du locataire sur le passage d’un technicien.',
  },
];

export function AiAssistantPage() {
  const base = useOrgPath();
  const { activeOrganization } = useOrganization();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<'chat' | 'draft' | 'estimate'>(() =>
    searchParams.get('tab') === 'estimate' ? 'estimate' : 'chat',
  );

  useEffect(() => {
    if (searchParams.get('tab') === 'estimate') {
      setActiveTab('estimate');
    }
  }, [searchParams]);

  // Estimation de prix IA
  const [estCity, setEstCity] = useState('Abidjan');
  const [estDistrict, setEstDistrict] = useState('Cocody Riviera');
  const [estCategory, setEstCategory] = useState('STUDIO_MODERNE');
  const [estTransaction, setEstTransaction] = useState<'RENT' | 'DAILY_MEUBLE' | 'SALE'>('RENT');
  const [estSurface, setEstSurface] = useState(45);
  const [estBedrooms, setEstBedrooms] = useState(1);
  const [estBathrooms, setEstBathrooms] = useState(1);
  const [estStanding, setEstStanding] = useState<'ECONOMIQUE' | 'STANDARD' | 'HAUT_STANDING' | 'LUXE'>('STANDARD');
  const [estAmenities, setEstAmenities] = useState<string[]>(['Climatisation', 'Wifi Fibre']);
  const [estResult, setEstResult] = useState<AiPriceEstimateResult | null>(() =>
    estimatePropertyPriceAI({
      city: 'Abidjan',
      district: 'Cocody Riviera',
      category: 'STUDIO_MODERNE',
      transactionType: 'RENT',
      surfaceM2: 45,
      bedrooms: 1,
      bathrooms: 1,
      standing: 'STANDARD',
      amenities: ['Climatisation', 'Wifi Fibre'],
    }),
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content: `Bonjour ! Je suis l’assistant intelligent DOMORA. J’analyse en direct les données de gestion de votre organisation (${activeOrganization.name}) pour répondre à vos questions financières, suivre vos impayés, détecter les vacances locatives ou générer vos communications officielles.`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [copied, setCopied] = useState(false);

  // Formulaire générateur de courriers
  const [draftKind, setDraftKind] = useState('RENT_REMINDER');
  const [tenantName, setTenantName] = useState('');
  const [unitName, setUnitName] = useState('');
  const [amountDue, setAmountDue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [leaseNumber, setLeaseNumber] = useState('');
  const [details, setDetails] = useState('');
  const [generatedDraft, setGeneratedDraft] = useState('');

  // Mutation Chat
  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      apiRequest<{ reply: string; dataInsights?: { kind?: string; data?: unknown } }>(
        `${base}/ai/chat`,
        {
          method: 'POST',
          body: { message },
        },
      ),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          content: data.reply,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          insights: data.dataInsights,
        },
      ]);
    },
    onError: (err: Error) => {
      toast({
        title: 'Erreur d’analyse',
        description: err.message,
        variant: 'error',
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'assistant',
          content: 'Désolé, une erreur est survenue lors du traitement de votre demande.',
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    },
  });

  // Mutation Draft
  const draftMutation = useMutation({
    mutationFn: (payload: unknown) =>
      apiRequest<{ draft: string }>(`${base}/ai/draft`, {
        method: 'POST',
        body: payload,
      }),
    onSuccess: (data) => {
      setGeneratedDraft(data.draft);
      toast({ title: 'Courrier rédigé avec succès', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({
        title: 'Génération impossible',
        description: err.message,
        variant: 'error',
      });
    },
  });

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend ?? inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'user',
        content: text,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);

    if (!textToSend) setInputMessage('');
    chatMutation.mutate(text);
  };

  const handleGenerateDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantName.trim()) {
      toast({ title: 'Veuillez saisir le nom du destinataire', variant: 'error' });
      return;
    }

    draftMutation.mutate({
      kind: draftKind,
      tenantName: tenantName.trim(),
      unitName: unitName.trim() || undefined,
      amountDueMinor: amountDue ? Number(amountDue) : undefined,
      currency: activeOrganization.currency,
      dueDate: dueDate || undefined,
      leaseNumber: leaseNumber.trim() || undefined,
      details: details.trim() || undefined,
    });
  };

  const copyToClipboard = () => {
    if (!generatedDraft) return;
    navigator.clipboard.writeText(generatedDraft);
    setCopied(true);
    toast({ title: 'Copié dans le presse-papier !', variant: 'success' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader
        title="KatdEstate AI & Estimation de Prix"
        description="Estimation intelligente des loyers, nuitées meublées et prix de vente, plus assistant juridique."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant={activeTab === 'estimate' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('estimate')}
              className="inline-flex items-center gap-1.5"
            >
              <Calculator className="size-4" />
              Estimation de Prix IA
            </Button>
            <Button
              variant={activeTab === 'chat' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('chat')}
              className="inline-flex items-center gap-1.5"
            >
              <Bot className="size-4" />
              Assistant Conversationnel
            </Button>
            <Button
              variant={activeTab === 'draft' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('draft')}
              className="inline-flex items-center gap-1.5"
            >
              <FileCheck2 className="size-4" />
              Générateur de Courriers
            </Button>
          </div>
        }
      />

      {activeTab === 'estimate' ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="size-4 text-fuchsia-500" />
                Paramètres du bien à estimer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Ville</label>
                  <Input
                    value={estCity}
                    onChange={(e) => setEstCity(e.target.value)}
                    placeholder="Ex: Abidjan, Douala, Mbanga..."
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Quartier / Secteur</label>
                  <Input
                    value={estDistrict}
                    onChange={(e) => setEstDistrict(e.target.value)}
                    placeholder="Ex: Cocody Riviera, Bonapriso..."
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Type de transaction</label>
                  <select
                    value={estTransaction}
                    onChange={(e) => {
                      const val = e.target.value as 'RENT' | 'DAILY_MEUBLE' | 'SALE';
                      setEstTransaction(val);
                      if (val === 'DAILY_MEUBLE') setEstCategory('STUDIO_MEUBLE_JOURNALIER');
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="RENT">Location Mensuelle</option>
                    <option value="DAILY_MEUBLE">Meublé (Location Journalière)</option>
                    <option value="SALE">Vente Définitive</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold">Catégorie du bien</label>
                  <select
                    value={estCategory}
                    onChange={(e) => setEstCategory(e.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="CHAMBRE_SIMPLE">Chambre simple</option>
                    <option value="CHAMBRE_MODERNE">Chambre moderne</option>
                    <option value="STUDIO_MODERNE">Studio moderne</option>
                    <option value="CHAMBRE_MEUBLEE">Chambre meublée (Jour)</option>
                    <option value="STUDIO_MEUBLE_JOURNALIER">Studio meublé (Jour)</option>
                    <option value="APPARTEMENT_MEUBLE">Appartement meublé</option>
                    <option value="APPARTEMENT">Appartement standard</option>
                    <option value="VILLA">Villa / Maison</option>
                    <option value="LAND">Terrain / Parcelle</option>
                    <option value="COMMERCIAL">Local commercial / Bureau</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Surface (m²)</label>
                  <Input
                    type="number"
                    min={10}
                    value={estSurface}
                    onChange={(e) => setEstSurface(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Chambres</label>
                  <Input
                    type="number"
                    min={0}
                    value={estBedrooms}
                    onChange={(e) => setEstBedrooms(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Douches</label>
                  <Input
                    type="number"
                    min={0}
                    value={estBathrooms}
                    onChange={(e) => setEstBathrooms(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold">Standing</label>
                  <select
                    value={estStanding}
                    onChange={(e) => setEstStanding(e.target.value as any)}
                    className="h-10 w-full rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="ECONOMIQUE">Économique</option>
                    <option value="STANDARD">Standard</option>
                    <option value="HAUT_STANDING">Haut Standing</option>
                    <option value="LUXE">Luxe</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold">Équipements & atouts</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Climatisation',
                    'Wifi Fibre',
                    'Parking sécurisé',
                    'Gardiennage 24/7',
                    'Groupe électrogène',
                    'Piscine',
                  ].map((am) => {
                    const active = estAmenities.includes(am);
                    return (
                      <button
                        key={am}
                        type="button"
                        onClick={() =>
                          setEstAmenities((prev) =>
                            prev.includes(am) ? prev.filter((x) => x !== am) : [...prev, am],
                          )
                        }
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition ${
                          active
                            ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                            : 'bg-muted/40 text-muted-foreground border-border'
                        }`}
                      >
                        {active ? '✓ ' : '+ '}
                        {am}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button
                type="button"
                className="w-full bg-gradient-to-r from-fuchsia-600 to-emerald-600 text-white font-bold gap-2"
                onClick={() => {
                  const res = estimatePropertyPriceAI({
                    city: estCity,
                    district: estDistrict,
                    category: estCategory,
                    transactionType: estTransaction,
                    surfaceM2: estSurface,
                    bedrooms: estBedrooms,
                    bathrooms: estBathrooms,
                    standing: estStanding,
                    amenities: estAmenities,
                  });
                  setEstResult(res);
                  toast({ title: 'Estimation IA calculée !', variant: 'success' });
                }}
              >
                <Sparkles className="size-4" />
                Calculer l’estimation de prix IA
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-emerald-500" />
                  Résultat de l’analyse IA
                </span>
                {estResult && (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                    Confiance {estResult.confidenceScore}%
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {estResult ? (
                <>
                  <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-center space-y-1">
                    <span className="text-xs uppercase font-bold text-emerald-500">
                      Prix recommandé par l’IA
                    </span>
                    <div className="text-3xl font-black text-foreground">
                      {estResult.estimatedPrice.toLocaleString('fr-FR')}{' '}
                      <span className="text-base font-bold text-emerald-500">
                        {estResult.unitLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Fourchette marché : {estResult.minPrice.toLocaleString('fr-FR')} –{' '}
                      {estResult.maxPrice.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>

                  {estResult.pricePerM2 > 0 && (
                    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-2.5 text-xs">
                      <span className="text-muted-foreground">Ratio estimé au m²</span>
                      <strong className="text-foreground">
                        {estResult.pricePerM2.toLocaleString('fr-FR')} FCFA / m²
                      </strong>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground">
                      Facteurs pris en compte par l’IA
                    </h4>
                    <ul className="space-y-1.5 text-xs text-foreground">
                      {estResult.rationale.map((line, i) => (
                        <li key={i} className="rounded-xl bg-muted/30 p-2.5 border border-border/50">
                          • {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : activeTab === 'chat' ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Fil de discussion principal */}
          <div className="flex h-[620px] flex-col rounded-2xl border border-border bg-card lg:col-span-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Conseiller Virtuel DOMORA</p>
                  <p className="text-[11px] text-muted-foreground">
                    Données en temps réel de {activeOrganization.name}
                  </p>
                </div>
              </div>
              <Badge className="text-[11px] border border-border bg-muted">
                Synthèse directe BD
              </Badge>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                      msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-muted/30 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium opacity-70">
                        {msg.sender === 'user' ? 'Vous' : 'DOMORA AI'} · {msg.timestamp}
                      </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                    {/* Affichage d'insights visuels si fournis */}
                    {msg.insights?.kind === 'RENT_SUMMARY' && (
                      <div className="mt-3 rounded-lg border border-border/50 bg-background/50 p-2 text-xs">
                        <span className="font-semibold text-emerald-600">
                          Rapport financier mensuel validé
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                    <Sparkles className="size-3.5 animate-spin text-primary" />
                    Analyse des indicateurs en cours…
                  </div>
                </div>
              )}
            </div>

            {/* Saisie */}
            <div className="border-t border-border p-3">
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
              >
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Posez une question sur vos loyers, impayés, baux ou dépenses…"
                  className="h-10"
                  disabled={chatMutation.isPending}
                />
                <Button type="submit" disabled={chatMutation.isPending || !inputMessage.trim()}>
                  <Send className="size-4" />
                </Button>
              </form>
            </div>
          </div>

          {/* Suggestions et capacités */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <HelpCircle className="size-4 text-primary" />
                  Questions Fréquentes
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur une invite pour interroger immédiatement votre base de données.
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {SUGGESTIONS.map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(suggestion)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-background p-2.5 text-left text-xs text-muted-foreground transition hover:border-primary hover:bg-accent hover:text-foreground"
                  >
                    <TrendingUp className="size-3.5 shrink-0 text-primary" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Moteur Sécurisé & Fiable
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p>
                  DOMORA AI interroge rigoureusement les données enregistrées dans votre
                  organisation.
                </p>
                <p>
                  Aucune donnée n’est inventée ni hallucinée. Si un modèle de langage distant n’est
                  pas configuré, le moteur déterministe interne produit la synthèse chiffrée exacte.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Onglet Générateur de courriers */
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Formulaire de paramétrage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-primary" />
                Paramètres du Courrier
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Sélectionnez le type de notification et complétez les informations pour générer un
                courrier juridique irréprochable.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateDraft} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Type de notification
                  </label>
                  <select
                    value={draftKind}
                    onChange={(e) => setDraftKind(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  >
                    {DRAFT_TYPES.map((dt) => (
                      <option key={dt.value} value={dt.value}>
                        {dt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Nom complet du locataire *
                    </label>
                    <Input
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="ex: Mamadou Ndiaye"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Désignation du logement
                    </label>
                    <Input
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="ex: Appartement 3B, Résidence Oasis"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Montant ({activeOrganization.currency})
                    </label>
                    <Input
                      type="number"
                      value={amountDue}
                      onChange={(e) => setAmountDue(e.target.value)}
                      placeholder="ex: 150000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      Date limite / Échéance
                    </label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">
                      N° Contrat de bail
                    </label>
                    <Input
                      value={leaseNumber}
                      onChange={(e) => setLeaseNumber(e.target.value)}
                      placeholder="ex: L-2026-001"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">
                    Précisions ou mentions particulières
                  </label>
                  <textarea
                    rows={3}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="ex: Frais de relance applicables selon l'article 7 du bail, possibilité de payer via Orange Money..."
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>

                <Button type="submit" disabled={draftMutation.isPending} className="w-full">
                  {draftMutation.isPending ? 'Rédaction en cours…' : 'Générer le courrier officiel'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Rendu du courrier généré */}
          <Card className="flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Aperçu du Courrier</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Modèle prêt à imprimer ou envoyer par email / WhatsApp.
                </p>
              </div>
              {generatedDraft && (
                <Button
                  variant="secondary"
                  onClick={copyToClipboard}
                  className="h-8 px-2.5 text-xs inline-flex items-center gap-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? 'Copié !' : 'Copier le texte'}
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              {generatedDraft ? (
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 font-mono text-xs leading-relaxed text-foreground">
                  {generatedDraft}
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  <FileText className="mb-2 size-8 text-muted-foreground/50" />
                  Remplissez le formulaire et cliquez sur « Générer » pour obtenir votre lettre
                  officielle personnalisée.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
