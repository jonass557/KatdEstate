import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Bell, FileText, Home, MessageSquare, Receipt, Send, Wallet } from 'lucide-react';
import { maintenanceTicketInputSchema } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL, apiRequest, getAccessToken } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';

interface PortalHome {
  tenant: { fullName: string };
  unit: { name: string; type: string; status: string } | null;
  lease: { id: string; number: string; status: string; startDate: string; endDate: string; rentAmountMinor: number; currency: string } | null;
  nextRent: { dueDate: string; amountDueMinor: number; amountPaidMinor: number; status: string; currency: string } | null;
  documents: number;
  openTickets: number;
}

interface Row {
  _id: string;
  number?: string;
  status?: string;
  dueDate?: string;
  paidAt?: string;
  amountDueMinor?: number;
  amountMinor?: number;
  amountPaidMinor?: number;
  currency?: string;
  method?: string;
  title?: string;
  category?: string;
  priority?: string;
  originalName?: string;
  mimeType?: string;
  createdAt?: string;
  startDate?: string;
  endDate?: string;
  rentAmountMinor?: number;
}

interface Profile {
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

const RENT_STATUS: Record<string, string> = {
  PENDING: 'À payer',
  PARTIAL: 'Partiellement payé',
  PAID: 'Payé',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulé',
};

function money(amount: number | undefined, currency: string | undefined): string {
  if (amount === undefined) return '—';
  return `${amount.toLocaleString('fr-FR')} ${currency ?? ''}`.trim();
}

function date(value: string | undefined): string {
  return value ? value.slice(0, 10) : '—';
}

/** Télécharge un PDF en portant le jeton, puis l'ouvre. Le lien brut ne suffit pas : l'API exige l'authentification. */
async function openPdf(path: string): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Document indisponible.');
  const blob = await response.blob();
  window.open(URL.createObjectURL(blob), '_blank', 'noopener');
}

function List({ rows, render }: { rows: Row[] | undefined; render: (row: Row) => string }) {
  if (!rows) return null;
  if (rows.length === 0) return <EmptyState title="Rien à afficher" description="Aucune information pour le moment." />;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row._id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-sm">{render(row)}</p>
          {row.status ? <Badge>{RENT_STATUS[row.status] ?? row.status}</Badge> : null}
        </div>
      ))}
    </div>
  );
}

export function PortalHomePage() {
  const { data } = useOrgQuery<PortalHome>(['portal'], '/portal');
  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${data.tenant.fullName}`}
        description="Votre logement, votre loyer et vos démarches."
        actions={
          <div className="flex gap-2">
            <Link to="/portal/invoices">
              <Button variant="secondary" className="h-9 text-xs inline-flex items-center gap-1.5">
                <Receipt className="size-3.5" />
                Mes factures
              </Button>
            </Link>
            <Link to="/portal/messages">
              <Button className="h-9 text-xs inline-flex items-center gap-1.5">
                <MessageSquare className="size-3.5" />
                Contacter mon gestionnaire
              </Button>
            </Link>
          </div>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Logement" value={data.unit?.name ?? 'Aucun'} hint={data.unit ? data.unit.type : 'Pas de contrat actif'} icon={Home} />
        <StatCard label="Prochain loyer" value={data.nextRent ? money(data.nextRent.amountDueMinor - data.nextRent.amountPaidMinor, data.nextRent.currency) : 'À jour'} hint={data.nextRent ? `${date(data.nextRent.dueDate)} · ${RENT_STATUS[data.nextRent.status] ?? data.nextRent.status}` : 'Aucune échéance ouverte'} icon={Wallet} />
        <StatCard label="Contrat" value={data.lease?.number ?? 'Aucun'} hint={data.lease ? `${data.lease.status} · jusqu’au ${date(data.lease.endDate)}` : 'Pas de contrat actif'} icon={FileText} />
        <StatCard label="Suivi" value={`${data.documents} document(s)`} hint={`${data.openTickets} ticket(s) de maintenance ouvert(s)`} icon={Bell} />
      </div>
    </div>
  );
}

export function PortalRentPage() {
  const { data } = useOrgQuery<Row[]>(['portal-rents'], '/portal/rents');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes loyers" description="Historique de vos échéances." />
      <List rows={data} render={(row) => `${date(row.dueDate)} · ${money(row.amountDueMinor, row.currency)} · payé ${money(row.amountPaidMinor, row.currency)}`} />
    </div>
  );
}

export function PortalPaymentsPage() {
  const { data } = useOrgQuery<Row[]>(['portal-payments'], '/portal/payments');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes paiements" description="Paiements enregistrés sur votre dossier." />
      <List rows={data} render={(row) => `${date(row.paidAt)} · ${money(row.amountMinor, row.currency)} · ${row.method ?? ''}`} />
    </div>
  );
}

export function PortalReceiptsPage() {
  const base = useOrgPath();
  const { toast } = useToast();
  const { data } = useOrgQuery<Row[]>(['portal-receipts'], '/portal/receipts');

  return (
    <div className="space-y-6">
      <PageHeader title="Mes reçus" description="Téléchargez vos quittances." />
      <div className="space-y-2">
        {(data ?? []).map((row) => (
          <div key={row._id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-sm">{row.number} · {money(row.amountMinor, row.currency)}</p>
            <Button
              variant="secondary"
              onClick={() => {
                openPdf(`${base}/portal/receipts/${row._id}/pdf`).catch((error: Error) =>
                  toast({ title: 'Téléchargement impossible', description: error.message, variant: 'error' }),
                );
              }}
            >
              Télécharger
            </Button>
          </div>
        ))}
        {data && data.length === 0 ? <EmptyState title="Aucune quittance" description="Une quittance apparaît ici après un paiement complet." /> : null}
      </div>
    </div>
  );
}

export function PortalLeasePage() {
  const base = useOrgPath();
  const { toast } = useToast();
  const { data } = useOrgQuery<Row[]>(['portal-lease'], '/portal/lease');

  return (
    <div className="space-y-6">
      <PageHeader title="Mon contrat" description="Vos contrats, du plus récent au plus ancien." />
      <div className="space-y-2">
        {(data ?? []).map((row) => (
          <Card key={row._id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">{row.number}</p>
                <p className="text-xs text-muted-foreground">
                  {date(row.startDate)} → {date(row.endDate)} · {money(row.rentAmountMinor, row.currency)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {row.status ? <Badge>{row.status}</Badge> : null}
                <Button
                  variant="secondary"
                  onClick={() => {
                    openPdf(`${base}/portal/lease/${row._id}/pdf`).catch((error: Error) =>
                      toast({ title: 'Téléchargement impossible', description: error.message, variant: 'error' }),
                    );
                  }}
                >
                  PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function PortalDocumentsPage() {
  const { data } = useOrgQuery<Row[]>(['portal-documents'], '/portal/documents');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes documents" description="Documents déposés sur votre dossier." />
      <List rows={data} render={(row) => `${row.originalName ?? 'Document'} · ${date(row.createdAt)}`} />
    </div>
  );
}

export function PortalMaintenancePage() {
  const [open, setOpen] = useState(false);
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgQuery<Row[]>(['portal-maintenance'], '/maintenance?pageSize=50');

  const create = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/maintenance`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      setOpen(false);
      toast({ title: 'Problème signalé', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Envoi impossible', description: error.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Maintenance"
        description="Signalez un problème dans votre logement et suivez son avancement."
        actions={<Button onClick={() => setOpen((value) => !value)}>Signaler un problème</Button>}
      />
      {open ? (
        <form
          className="space-y-3 rounded-2xl border border-border bg-background p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const photoUrl = String(form.get('photoUrl') ?? '').trim();
            const parsed = maintenanceTicketInputSchema.safeParse({
              category: form.get('category'),
              title: form.get('title'),
              description: form.get('description') || undefined,
              priority: form.get('priority') || 'MEDIUM',
              photos: photoUrl ? [photoUrl] : [],
            });
            if (!parsed.success) {
              const message = parsed.error.issues[0]?.message ?? 'Vérifiez les champs.';
              toast({ title: 'Formulaire incomplet', description: message, variant: 'error' });
              return;
            }
            create.mutate(parsed.data);
          }}
        >
          <Input name="title" placeholder="Que se passe-t-il ?" required />
          <div className="grid gap-2 sm:grid-cols-2">
            <Input name="category" placeholder="Plomberie, électricité…" required />
            <select name="priority" className="h-10 rounded-lg border border-input bg-background px-3 text-sm">
              <option value="LOW">Priorité basse</option>
              <option value="MEDIUM">Priorité normale</option>
              <option value="HIGH">Priorité haute</option>
              <option value="URGENT">Urgence immédiate</option>
            </select>
          </div>
          <Input name="photoUrl" placeholder="Lien photo ou constat (facultatif)" />
          <textarea name="description" rows={3} placeholder="Précisions utiles pour l'intervention..." className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
          <Button type="submit" disabled={create.isPending}>Envoyer</Button>
        </form>
      ) : null}
      <List rows={data} render={(row) => `${row.title ?? ''} · ${row.category ?? ''}`} />
    </div>
  );
}

interface Notice {
  _id: string;
  event: string;
  status: string;
  createdAt: string;
}

export function PortalNotificationsPage() {
  const { data } = useOrgQuery<Notice[]>(['portal-notices'], '/notifications?pageSize=50');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes notifications" description="Rappels et informations qui vous concernent." />
      <div className="space-y-2">
        {(data ?? []).map((notice) => (
          <div key={notice._id} className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-sm">{notice.event}</p>
            <Badge>{notice.status}</Badge>
          </div>
        ))}
        {data && data.length === 0 ? <EmptyState title="Aucune notification" description="Vous n’avez rien en attente." /> : null}
      </div>
    </div>
  );
}

export function PortalProfilePage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data } = useOrgQuery<Profile>(['portal-profile'], '/portal/profile');

  const save = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/portal/profile`, { method: 'PATCH', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Profil mis à jour', variant: 'success' });
    },
    onError: (error: Error) => toast({ title: 'Mise à jour impossible', description: error.message, variant: 'error' }),
  });

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Mon profil" description="Vous pouvez modifier vos coordonnées. Le loyer et le contrat ne se changent pas ici." />
      <form
        className="max-w-md space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          save.mutate({
            phone: form.get('phone') || undefined,
            email: form.get('email') || undefined,
            address: form.get('address') || undefined,
            emergencyContactName: form.get('emergencyContactName') || undefined,
            emergencyContactPhone: form.get('emergencyContactPhone') || undefined,
          });
        }}
      >
        <Input name="fullName" defaultValue={data.fullName} disabled />
        <Input name="phone" defaultValue={data.phone ?? ''} placeholder="Téléphone" />
        <Input name="email" type="email" defaultValue={data.email ?? ''} placeholder="Email" />
        <Input name="address" defaultValue={data.address ?? ''} placeholder="Adresse" />
        <Input name="emergencyContactName" defaultValue={data.emergencyContactName ?? ''} placeholder="Contact d’urgence" />
        <Input name="emergencyContactPhone" defaultValue={data.emergencyContactPhone ?? ''} placeholder="Téléphone du contact" />
        <Button type="submit" disabled={save.isPending}>Enregistrer</Button>
      </form>
    </div>
  );
}

interface InvoiceRow {
  _id: string;
  number: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountTotalMinor: number;
  amountPaidMinor: number;
  status: string;
  currency?: string;
}

export function PortalInvoicesPage() {
  const base = useOrgPath();
  const { toast } = useToast();
  const { data, isLoading } = useOrgQuery<InvoiceRow[]>(['portal-invoices'], '/portal/invoices');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes factures & charges"
        description="Consultez et téléchargez vos factures de loyer et relevés de charges."
      />
      {isLoading && (
        <p className="py-6 text-center text-xs text-muted-foreground">Chargement des factures…</p>
      )}
      <div className="space-y-2">
        {(data ?? []).map((inv) => (
          <div
            key={inv._id}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
          >
            <div>
              <p className="text-sm font-semibold text-foreground">
                Facture {inv.number}
              </p>
              <p className="text-xs text-muted-foreground">
                Échéance : {date(inv.dueDate)} · Total : {money(inv.amountTotalMinor, inv.currency)} (Payé : {money(inv.amountPaidMinor, inv.currency)})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={inv.status === 'PAID' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border'}>
                {RENT_STATUS[inv.status] ?? inv.status}
              </Badge>
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  openPdf(`${base}/portal/invoices/${inv._id}/pdf`).catch((err: Error) =>
                    toast({ title: 'Téléchargement impossible', description: err.message, variant: 'error' }),
                  );
                }}
              >
                PDF
              </Button>
            </div>
          </div>
        ))}
        {data && data.length === 0 && (
          <EmptyState
            title="Aucune facture"
            description="Aucune facture de loyer ou charges n'a été émise pour le moment."
          />
        )}
      </div>
    </div>
  );
}

interface MessageThread {
  _id: string;
  subject: string;
  body: string;
  category: string;
  createdAt: string;
  replies?: { senderName: string; body: string; createdAt: string }[];
}

export function PortalMessagesPage() {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const { data: messages, isLoading } = useOrgQuery<MessageThread[]>(
    ['portal-messages'],
    '/messages',
  );

  const createMsg = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/messages`, {
        method: 'POST',
        body,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['portal-messages'] });
      setOpen(false);
      toast({ title: 'Message transmis au gestionnaire', variant: 'success' });
    },
    onError: (err: Error) =>
      toast({ title: 'Échec de transmission', description: err.message, variant: 'error' }),
  });

  const replyMsg = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiRequest(`${base}/messages/${id}/reply`, {
        method: 'POST',
        body: { body },
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['portal-messages'] });
      setReplyText('');
      toast({ title: 'Réponse envoyée', variant: 'success' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacter mon gestionnaire"
        description="Posez une question, signalez une démarche administrative ou répondez aux messages de la régie."
        actions={
          <Button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5">
            <Send className="size-3.5" />
            Écrire au gestionnaire
          </Button>
        }
      />

      {open && (
        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const subject = form.get('subject') as string;
            const category = form.get('category') as string;
            const body = form.get('body') as string;
            if (!subject || !body) return;
            createMsg.mutate({ subject, category, body, priority: 'MEDIUM' });
          }}
        >
          <Input name="subject" placeholder="Sujet de votre message" required />
          <select
            name="category"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="GENERAL">Question générale</option>
            <option value="PAYMENT">Loyer et quittances</option>
            <option value="MAINTENANCE">Maintenance et réparations</option>
            <option value="LEASE">Contrat de location</option>
          </select>
          <textarea
            name="body"
            rows={4}
            placeholder="Écrivez votre message à destination de l'équipe de gestion…"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMsg.isPending}>
              {createMsg.isPending ? 'Envoi…' : 'Envoyer'}
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <p className="py-6 text-center text-xs text-muted-foreground">Chargement des échanges…</p>
      )}

      <div className="space-y-3">
        {(messages ?? []).map((msg) => (
          <div key={msg._id} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{msg.subject}</p>
                <p className="text-xs text-muted-foreground">
                  Catégorie : {msg.category} · Envoyé le {new Date(msg.createdAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <Button
                variant="secondary"
                className="h-7 px-2 text-xs"
                onClick={() => setActiveThreadId(activeThreadId === msg._id ? null : msg._id)}
              >
                {activeThreadId === msg._id ? 'Fermer' : 'Répondre / Voir le fil'}
              </Button>
            </div>

            <p className="text-xs text-foreground bg-muted/20 rounded-lg p-3 whitespace-pre-wrap">
              {msg.body}
            </p>

            {/* Réponses et formulaire de réponse */}
            {activeThreadId === msg._id && (
              <div className="pt-2 border-t border-border/60 space-y-3">
                {(msg.replies ?? []).map((r, i) => (
                  <div key={i} className="rounded-lg bg-muted/40 p-2.5 text-xs">
                    <p className="font-semibold text-foreground mb-1">{r.senderName} :</p>
                    <p className="text-muted-foreground">{r.body}</p>
                  </div>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!replyText.trim()) return;
                    replyMsg.mutate({ id: msg._id, body: replyText.trim() });
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Votre réponse au gestionnaire…"
                    className="h-9 text-xs"
                  />
                  <Button type="submit" className="h-9 px-3 text-xs" disabled={replyMsg.isPending}>
                    Envoyer
                  </Button>
                </form>
              </div>
            )}
          </div>
        ))}

        {messages && messages.length === 0 && (
          <EmptyState
            title="Aucun échange"
            description="Vous n'avez pas encore envoyé de message à votre gestionnaire."
          />
        )}
      </div>
    </div>
  );
}
