import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Inbox,
  MessageSquare,
  Plus,
  Send,
} from 'lucide-react';
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
  recipientName?: string;
  replies?: Reply[];
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
  const { user } = useSession();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newModalOpen, setNewModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  // Messages list query
  const queryUrl = filterCategory === 'ALL' ? '/messages' : `/messages?category=${filterCategory}`;
  const { data: messages, isLoading } = useOrgQuery<Message[]>(['messages', filterCategory], queryUrl);

  // Selected message detail query
  const { data: selectedMessage } = useOrgQuery<Message>(
    ['message-detail', selectedId],
    selectedId ? `/messages/${selectedId}` : '',
    Boolean(selectedId),
  );

  // Create message mutation
  const createMutation = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ _id: string }>(`${base}/messages`, {
        method: 'POST',
        body,
      }),
    onSuccess: (res) => {
      void client.invalidateQueries({ queryKey: ['messages'] });
      setNewModalOpen(false);
      setSelectedId(res._id);
      toast({ title: 'Message envoyé avec succès', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({ title: 'Erreur d’envoi', description: err.message, variant: 'error' });
    },
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: (body: { body: string }) =>
      apiRequest(`${base}/messages/${selectedId}/reply`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['message-detail', selectedId] });
      void client.invalidateQueries({ queryKey: ['messages'] });
      setReplyText('');
      toast({ title: 'Réponse transmise', variant: 'success' });
    },
    onError: (err: Error) => {
      toast({ title: 'Impossible d’envoyer la réponse', description: err.message, variant: 'error' });
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const subject = form.get('subject') as string;
    const body = form.get('body') as string;
    const category = form.get('category') as string;
    const priority = form.get('priority') as string;

    if (!subject || !body) {
      toast({ title: 'Veuillez remplir le sujet et le message', variant: 'error' });
      return;
    }

    createMutation.mutate({ subject, body, category, priority });
  };

  const handleSendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedId || replyMutation.isPending) return;
    replyMutation.mutate({ body: replyText.trim() });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie Interne"
        description="Échanges directs et sécurisés entre locataires, propriétaires et gestionnaires."
        actions={
          <Button onClick={() => setNewModalOpen(true)} className="inline-flex items-center gap-1.5">
            <Plus className="size-4" />
            Nouveau message
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
          Tous les échanges
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
          {isLoading && (
            <p className="py-8 text-center text-xs text-muted-foreground">Chargement des messages…</p>
          )}

          {!isLoading && messages?.length === 0 && (
            <EmptyState
              title="Aucun message"
              description="Votre boîte de messagerie est vide dans cette catégorie."
            />
          )}

          {messages?.map((msg) => {
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

                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{msg.body}</p>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>De {msg.senderName}</span>
                  <div className="flex items-center gap-2">
                    {replyCount > 0 && (
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <MessageSquare className="size-3" />
                        {replyCount}
                      </span>
                    )}
                    <span>{new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
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
                    <CardTitle className="text-base font-semibold">{selectedMessage.subject}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Initié par <span className="font-medium text-foreground">{selectedMessage.senderName}</span> ({selectedMessage.senderRole})
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
                    <span className="font-semibold text-foreground">{selectedMessage.senderName}</span>
                    <span>{new Date(selectedMessage.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">{selectedMessage.body}</p>
                </div>

                {/* Réponses successives */}
                {(selectedMessage.replies ?? []).map((reply, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3.5 text-xs space-y-2 ${
                      reply.senderId === user?.id
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
                    <p className="whitespace-pre-wrap leading-relaxed text-foreground">{reply.body}</p>
                  </div>
                ))}
              </CardContent>

              {/* Boîte de réponse */}
              <div className="border-t border-border p-3">
                <form onSubmit={handleSendReply} className="flex gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Écrire une réponse…"
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
                Choisissez un fil à gauche ou commencez un nouvel échange.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modale de nouveau message */}
      <Modal
        open={newModalOpen}
        onOpenChange={setNewModalOpen}
        title="Nouveau message interne"
      >
        <form onSubmit={handleCreate} className="space-y-4 text-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium">Sujet *</label>
            <Input name="subject" placeholder="ex: Question relative à la quittance du mois de mai" required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Catégorie</label>
              <select name="category" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
                {Object.entries(CATEGORY_LABELS).map(([val, lab]) => (
                  <option key={val} value={val}>
                    {lab}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Priorité</label>
              <select name="priority" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
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
              placeholder="Exposez votre demande de manière précise..."
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
