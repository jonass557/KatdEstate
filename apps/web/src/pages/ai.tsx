import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Bot,
  Check,
  Copy,
  FileCheck2,
  FileText,
  HelpCircle,
  Send,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
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
  insights?: {
    kind?: string | undefined;
    data?: unknown;
  } | undefined;
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
  { value: 'RENT_REMINDER', label: 'Rappel amical d’échéance', desc: 'Courrier ou email prévenant le locataire avant l’échéance.' },
  { value: 'LATE_NOTICE', label: 'Relance pour impayé', desc: 'Rappel ferme pour un loyer dépassé depuis quelques jours.' },
  { value: 'FORMAL_NOTICE', label: 'Mise en demeure (8 jours)', desc: 'Lettre de mise en demeure formelle avant action judiciaire.' },
  { value: 'RENEWAL_PROPOSAL', label: 'Proposition de renouvellement', desc: 'Offre de renouvellement de bail avec ajustement éventuel.' },
  { value: 'MAINTENANCE_UPDATE', label: 'Point sur intervention de maintenance', desc: 'Information du locataire sur le passage d’un technicien.' },
];

export function AiAssistantPage() {
  const base = useOrgPath();
  const { activeOrganization } = useOrganization();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'chat' | 'draft'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      content:
        `Bonjour ! Je suis l’assistant intelligent DOMORA. J’analyse en direct les données de gestion de votre organisation (${activeOrganization.name}) pour répondre à vos questions financières, suivre vos impayés, détecter les vacances locatives ou générer vos communications officielles.`,
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
      <PageHeader
        title="DOMORA AI"
        description="Analyste immobilier intelligent & assistant de rédaction juridique automatisé."
        actions={
          <div className="flex gap-2">
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

      {activeTab === 'chat' ? (
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
                  <p className="text-[11px] text-muted-foreground">Données en temps réel de {activeOrganization.name}</p>
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
                        <span className="font-semibold text-emerald-600">Rapport financier mensuel validé</span>
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
                  DOMORA AI interroge rigoureusement les données enregistrées dans votre organisation.
                </p>
                <p>
                  Aucune donnée n’est inventée ni hallucinée. Si un modèle de langage distant n’est pas configuré, le moteur déterministe interne produit la synthèse chiffrée exacte.
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
                Sélectionnez le type de notification et complétez les informations pour générer un courrier juridique irréprochable.
              </p>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateDraft} className="space-y-4 text-sm">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Type de notification</label>
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
                    <label className="text-xs font-medium text-foreground">Nom complet du locataire *</label>
                    <Input
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      placeholder="ex: Mamadou Ndiaye"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Désignation du logement</label>
                    <Input
                      value={unitName}
                      onChange={(e) => setUnitName(e.target.value)}
                      placeholder="ex: Appartement 3B, Résidence Oasis"
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Montant ({activeOrganization.currency})</label>
                    <Input
                      type="number"
                      value={amountDue}
                      onChange={(e) => setAmountDue(e.target.value)}
                      placeholder="ex: 150000"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">Date limite / Échéance</label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-foreground">N° Contrat de bail</label>
                    <Input
                      value={leaseNumber}
                      onChange={(e) => setLeaseNumber(e.target.value)}
                      placeholder="ex: L-2026-001"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-foreground">Précisions ou mentions particulières</label>
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
                  {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
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
                  Remplissez le formulaire et cliquez sur « Générer » pour obtenir votre lettre officielle personnalisée.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
