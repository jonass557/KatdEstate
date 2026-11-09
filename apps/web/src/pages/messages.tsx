import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox, MessageSquare, Plus, Send } from 'lucide-react';
import { PageHeader } from '../components/page-header';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';
import { useSession } from '../app/session';
import {
  getStoredChatThreads,
  createLocalChatThread,
  replyToLocalChatThread,
  type ChatThread,
} from '../lib/katdestate-store';

interface Reply {
  senderId: string;
  senderName: string;
  senderRole: string;
  body: string;
  createdAt: string;
}

interface Message {
  _id: string;
  subject: string;
  body: string;
  category: string;
  priority: string;
  status: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  recipientName?: string | undefined;
  tenantName?: string | undefined;
  propertyName?: string | undefined;
  unitNumber?: string | undefined;
  replies?: Reply[] | undefined;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  GENERAL: 'Général',
  PAYMENT: 'Paiement & Loyer',
  MAINTENANCE: 'Maintenance',
  LEASE: 'Contrat & Bail',
  URGENT: 'Urgent',
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: 'Basse',
  MEDIUM: 'Normale',
  HIGH: 'Haute',
  URGENT: 'Urgente',
};

export function MessagesPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { user, memberships } = useSession();
  const userRole = (memberships?.[0]?.role as 'OWNER' | 'TENANT' | 'AGENT') || 'OWNER';

  const [localThreads, setLocalThreads] = useState<ChatThread[]>(() => getStoredChatThreads());
  const [selectedId, setSelectedId] = useState<string | null>(
    () => getStoredChatThreads()[0]?._id ?? null,
  );
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  const refreshLocal = () => {
    setLocalThreads(getStoredChatThreads());
  };

  // Messages list query
  const queryUrl = filterCategory === 'ALL' ? '/messages' : `/messages?category=${filterCategory}`;
  const { data: apiMessages, isLoading } = useOrgQuery<Message[]>(
    ['messages', filterCategory],
    queryUrl,
  );

  // Merge local chat threads and API messages
  const mergedMessages: Message[] = (() => {
    const map = new Map<string, Message>();
    for (const thread of localThreads) {
      if (filterCategory === 'ALL' || thread.category === filterCategory) {
        map.set(thread._id, thread);
      }
    }
    for (const m of apiMessages ?? []) {
      if (!map.has(m._id)) {
        map.set(m._id, m);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  })();

  const selectedMessage = mergedMessages.find((m) => m._id === selectedId) ?? null;

  // Create message mutation
  const createMutation = useMutation({
    mutationFn: async (body: {
      subject: string;
      body: string;
      category: string;
      priority: string;
      tenantName?: string | undefined;
    }) => {
      const created = createLocalChatThread({
        subject: body.subject,
        body: body.body,
        category: body.category,
        priority: body.priority,
        senderName: user?.displayName ?? 'Propriétaire',
        senderRole: userRole,
        tenantName: body.tenantName,
      });
      try {
        await apiRequest<{ _id: string }>(`${base}/messages`, {
          method: 'POST',
          body,
        });
      } catch {
        // Saved locally
      }
      return created;
    },
    onSuccess: (res) => {
      refreshLocal();
      void client.invalidateQueries({ queryKey: ['messages'] });
      setNewModalOpen(false);
      setSelectedId(res._id);
      toast({ title: 'Message envoyé avec succès', variant: 'success' });
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: async (body: { body: string }) => {
      if (selectedId) {
        replyToLocalChatThread(selectedId, {
          senderName: user?.displayName ?? 'Propriétaire',
          senderRole: userRole,
          body: body.body,
        });
      }
      try {
        await apiRequest(`${base}/messages/${selectedId}/reply`, {
          method: 'POST',
          body,
        });
      } catch {
        // Saved locally
      }
    },
    onSuccess: () => {
      refreshLocal();
      void client.invalidateQueries({ queryKey: ['message-detail', selectedId] });
      void client.invalidateQueries({ queryKey: ['messages'] });
      setReplyText('');
      toast({ title: 'Réponse transmise', variant: 'success' });
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const subject = (form.get('subject') as string) || '';
    const body = (form.get('body') as string) || '';
    const category = (form.get('category') as string) || 'GENERAL';
    const priority = (form.get('priority') as string) || 'MEDIUM';
    const tenantName = (form.get('tenantName') as string) || undefined;

    if (!subject || !body) {
      toast({ title: 'Veuillez remplir le sujet et le message', variant: 'error' });
      return;
    }

    createMutation.mutate({ subject, body, category, priority, tenantName });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedId || replyMutation.isPending) return;
    replyMutation.mutate({ body: replyText.trim() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie & Discussion Directe (Propriétaire ↔ Locataires)"
        description="Échanges directs et sécurisés en temps réel entre le propriétaire, ses locataires et ses gestionnaires."
        actions={
          <Button
            onClick={() => setNewModalOpen(true)}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="size-4" />
            Nouveau message au locataire
          </Button>
        }
      />

      {/* Filtres par catégorie */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        <Button
          variant={filterCategory === 'ALL' ? 'primary' : 'secondary'}
          className="h-8 px-2.5 text-xs"
          onClick={() => setFilterCategory('ALL')}
        >
          Tous les échanges ({mergedMessages.length})
        </Button>
        {Object.entries(CATEGORY_LABELS).map(([cat, label]) => (
          <Button
            key={cat}
            variant={filterCategory === cat ? 'primary' : 'secondary'}
            className="h-8 px-2.5 text-xs"
            onClick={() => setFilterCategory(cat)}
          >
            {label}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Liste des conversations */}
        <div className="lg:col-span-5 space-y-2">
          {isLoading && mergedMessages.length === 0 && (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Chargement des messages…
            </p>
          )}

          {!isLoading && mergedMessages.length === 0 && (
            <EmptyState
              title="Aucun message"
              description="Votre boîte de messagerie est vide dans cette catégorie."
            />
          )}

          {mergedMessages.map((msg) => {
            const isSelected = selectedId === msg._id;
            const replyCount = msg.replies?.length ?? 0;
            return (
              <div
                key={msg._id}
                onClick={() => setSelectedId(msg._id)}
                className={`cursor-pointer rounded-xl border p-3.5 transition ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border bg-card hover:border-border hover:bg-muted/40'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold truncate text-foreground">{msg.subject}</p>
                  <Badge className="text-[10px]">
                    {CATEGORY_LABELS[msg.category] ?? msg.category}
                  </Badge>
                </div>

                {msg.propertyName && (
                  <p className="mt-0.5 text-[11px] font-semibold text-primary">
                    {msg.propertyName} {msg.unitNumber ? `• ${msg.unitNumber}` : ''}
                  </p>
                )}

                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{msg.body}</p>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    De <strong>{msg.senderName}</strong>
                    {msg.tenantName ? ` ↔ ${msg.tenantName}` : ''}
                  </span>
                  <div className="flex items-center gap-2">
                    {replyCount > 0 && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <MessageSquare className="size-3" />
                        {replyCount}
                      </span>
                    )}
                    <span>
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panneau de détail et réponses */}
        <div className="lg:col-span-7">
          {selectedMessage ? (
            <Card className="flex h-[640px] flex-col">
              <CardHeader className="border-b border-border pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {selectedMessage.subject}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Initié par{' '}
                      <span className="font-medium text-foreground">
                        {selectedMessage.senderName}
                      </span>{' '}
                      ({selectedMessage.senderRole})
                      {selectedMessage.propertyName
                        ? ` • ${selectedMessage.propertyName} ${selectedMessage.unitNumber ?? ''}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs border border-border bg-muted text-muted-foreground">
                      {PRIORITY_LABELS[selectedMessage.priority] ?? selectedMessage.priority}
                    </Badge>
                    <Badge className="text-xs">
                      {CATEGORY_LABELS[selectedMessage.category] ?? selectedMessage.category}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {/* Historique du fil */}
              <CardContent className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* Message initial */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {selectedMessage.senderName} ({selectedMessage.senderRole})
                    </span>
                    <span>{new Date(selectedMessage.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {selectedMessage.body}
                  </p>
                </div>

                {/* Réponses successives */}
                {(selectedMessage.replies ?? []).map((reply, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3.5 text-xs space-y-2 ${
                      reply.senderRole === 'OWNER' || reply.senderId === user?.id
                        ? 'border-primary/30 bg-primary/5 ml-4'
                        : 'border-border bg-card mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {reply.senderName} ({reply.senderRole})
                      </span>
                      <span>{new Date(reply.createdAt).toLocaleString('fr-FR')}</span>
                    </div>
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">
                      {reply.body}
                    </p>
                  </div>
                ))}
              </CardContent>

              {/* Boîte de réponse */}
              <div className="border-t border-border p-3">
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Écrire une réponse au locataire…"
                    className="h-10 text-sm"
                    disabled={replyMutation.isPending}
                  />
                  <Button type="submit" disabled={replyMutation.isPending || !replyText.trim()}>
                    <Send className="size-4" />
                  </Button>
                </form>
              </div>
            </Card>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
              <Inbox className="mb-3 size-10 text-muted-foreground/40" />
              <p className="text-sm font-medium">Sélectionnez une conversation</p>
              <p className="text-xs text-muted-foreground mt-1">
                Choisissez un fil à gauche ou commencez un nouvel échange avec un locataire.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modale de nouveau message */}
      <Modal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        title="Nouveau message à un locataire"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium">Nom du locataire destinataire</label>
            <Input name="tenantName" placeholder="Ex: Jean Kouadio (Appartement N°1)" />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Sujet *</label>
            <Input
              name="subject"
              placeholder="ex: Question relative à la quittance ou au loyer"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Catégorie</label>
              <select
                name="category"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(CATEGORY_LABELS).map(([val, lab]) => (
                  <option key={val} value={val}>
                    {lab}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Priorité</label>
              <select
                name="priority"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(PRIORITY_LABELS).map(([val, lab]) => (
                  <option key={val} value={val}>
                    {lab}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">Votre message *</label>
            <textarea
              name="body"
              rows={5}
              placeholder="Exposez votre message au locataire..."
              required
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Envoi…' : 'Envoyer le message'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
