import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  applyLatePenaltiesSchema,
  cancelScheduleSchema,
  chargeSplitSchema,
  recordDepositSchema,
  recordPaymentSchema,
  refundPaymentSchema,
  sendReceiptSchema,
  updateScheduleSchema,
} from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { apiRequest, downloadFile } from '../lib/api-client';
import { formatDate } from '../lib/format';
import { useOrgList, useOrgPath, useOrgQuery } from '../lib/query';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  Download,
  FileSpreadsheet,
  Search,
  Send,
  ShieldCheck,
  Split,
  Undo2,
  Wallet,
} from 'lucide-react';

interface Schedule {
  _id: string;
  dueDate: string;
  amountDueMinor: number;
  amountPaidMinor: number;
  penaltyMinor: number;
  status: string;
  currency: string;
  leaseId: string;
}

interface Summary {
  expectedMinor: number;
  collectedMinor: number;
  remainingMinor: number;
  overdueMinor: number;
}

interface Invoice {
  _id: string;
  number: string;
  dueDate: string;
  amountTotalMinor: number;
  amountPaidMinor: number;
  status: string;
  type: string;
}

interface TenantHistory {
  tenantId: string;
  totalOwedMinor: number;
  schedules: {
    _id: string;
    dueDate: string;
    amountDueMinor: number;
    amountPaidMinor: number;
    status: string;
  }[];
  payments: {
    _id: string;
    number: string;
    amountMinor: number;
    paidAt: string;
    method: string;
  }[];
  deposits: {
    _id: string;
    type: string;
    amountMinor: number;
    createdAt: string;
  }[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'À venir',
  PARTIAL: 'Partiel',
  PAID: 'Payé',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulé',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: 'Confirmé',
  PENDING: 'En attente',
  REFUNDED: 'Remboursé',
  CANCELLED: 'Annulé',
};

const METHODS = [
  ['CASH', 'Espèces'],
  ['TRANSFER', 'Virement'],
  ['MTN_MOMO', 'MTN Mobile Money'],
  ['ORANGE_MONEY', 'Orange Money'],
  ['CARD', 'Carte'],
  ['OTHER', 'Autre'],
] as const;

export function RentPage() {
  const [activeTab, setActiveTab] = useState<'schedules' | 'invoices' | 'deposits'>('schedules');
  const [status, setStatus] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [cancelSchedule, setCancelSchedule] = useState<Schedule | null>(null);
  const [showPenaltiesModal, setShowPenaltiesModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTenantHistoryModal, setShowTenantHistoryModal] = useState(false);

  const base = useOrgPath();

  const { data: schedulesData } = useOrgList<Schedule>(
    ['schedules', status],
    `/rent-schedules?pageSize=50${status ? `&status=${status}` : ''}`,
  );
  const { data: invoicesData } = useOrgList<Invoice>(['invoices'], '/invoices?pageSize=50');
  const summary = useOrgQuery<Summary>(['finance-summary'], '/finance/summary');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des loyers et factures"
        description="Suivi des échéances, pénalités de retard, cautions et répartition des charges."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setShowPenaltiesModal(true)}>
              <Clock className="mr-1.5 size-4" />
              Pénalités de retard
            </Button>
            <Button variant="secondary" onClick={() => setShowDepositModal(true)}>
              <ShieldCheck className="mr-1.5 size-4" />
              Enregistrer caution
            </Button>
            <Button variant="secondary" onClick={() => setShowTenantHistoryModal(true)}>
              <Search className="mr-1.5 size-4" />
              Historique locataire
            </Button>
          </div>
        }
      />

      {summary.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Attendu"
            value={`${summary.data.expectedMinor.toLocaleString('fr-FR')} FCFA`}
            hint="Total des échéances actives"
            icon={Wallet}
          />
          <StatCard
            label="Encaissé"
            value={`${summary.data.collectedMinor.toLocaleString('fr-FR')} FCFA`}
            hint="Paiements confirmés"
            icon={CircleDollarSign}
          />
          <StatCard
            label="Restant"
            value={`${summary.data.remainingMinor.toLocaleString('fr-FR')} FCFA`}
            hint="Solde restant à percevoir"
            icon={Clock}
          />
          <StatCard
            label="En retard"
            value={`${summary.data.overdueMinor.toLocaleString('fr-FR')} FCFA`}
            hint="Échéances dépassées non soldées"
            icon={AlertTriangle}
          />
        </div>
      ) : null}

      {/* Onglets */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === 'schedules'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Échéances de loyers
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invoices')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === 'invoices'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Factures & Charges locatives
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('deposits')}
          className={`border-b-2 px-4 py-2.5 text-sm font-medium transition ${
            activeTab === 'deposits'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Cautions & Dépôts
        </button>
      </div>

      {activeTab === 'schedules' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">Tous les statuts</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Échéance</th>
                  <th className="px-4 py-3 font-medium">Loyer de base</th>
                  <th className="px-4 py-3 font-medium">Pénalité</th>
                  <th className="px-4 py-3 font-medium">Total dû</th>
                  <th className="px-4 py-3 font-medium">Payé</th>
                  <th className="px-4 py-3 font-medium">Reste</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(schedulesData?.data ?? []).map((schedule) => {
                  const totalDue = schedule.amountDueMinor + schedule.penaltyMinor;
                  const remaining = Math.max(0, totalDue - schedule.amountPaidMinor);
                  return (
                    <tr key={schedule._id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium">{formatDate(schedule.dueDate)}</td>
                      <td className="px-4 py-3">{schedule.amountDueMinor.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-amber-600">
                        {schedule.penaltyMinor > 0 ? `+${schedule.penaltyMinor.toLocaleString('fr-FR')}` : '0'}
                      </td>
                      <td className="px-4 py-3 font-semibold">{totalDue.toLocaleString('fr-FR')}</td>
                      <td className="px-4 py-3 text-emerald-600">
                        {schedule.amountPaidMinor.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 font-semibold text-rose-600">
                        {remaining.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-4 py-3">
                        <Badge>{STATUS_LABELS[schedule.status] ?? schedule.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {schedule.status !== 'PAID' && schedule.status !== 'CANCELLED' ? (
                            <Button
                              variant="secondary"
                              className="h-8 px-2.5 text-xs"
                              onClick={() => setSelectedSchedule(schedule)}
                            >
                              Encaisser
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            className="h-8 px-2.5 text-xs"
                            onClick={() => setEditSchedule(schedule)}
                          >
                            Modifier
                          </Button>
                          {schedule.status !== 'PAID' && schedule.status !== 'CANCELLED' ? (
                            <Button
                              variant="ghost"
                              className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700"
                              onClick={() => setCancelSchedule(schedule)}
                            >
                              Annuler
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(schedulesData?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Aucune échéance trouvée.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'invoices' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Factures individuelles et charges réparties entre locataires.
            </p>
            <Button onClick={() => setShowSplitModal(true)}>
              <Split className="mr-1.5 size-4" />
              Répartir les charges
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Numéro</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Échéance</th>
                  <th className="px-4 py-3 font-medium">Montant</th>
                  <th className="px-4 py-3 font-medium">Payé</th>
                  <th className="px-4 py-3 font-medium">Reste</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 text-right font-medium">Facture PDF</th>
                </tr>
              </thead>
              <tbody>
                {(invoicesData?.data ?? []).map((inv) => (
                  <tr key={inv._id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{inv.number}</td>
                    <td className="px-4 py-3">{inv.type}</td>
                    <td className="px-4 py-3">{formatDate(inv.dueDate)}</td>
                    <td className="px-4 py-3 font-semibold">
                      {inv.amountTotalMinor.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3 text-emerald-600">
                      {inv.amountPaidMinor.toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3 text-rose-600">
                      {Math.max(0, inv.amountTotalMinor - inv.amountPaidMinor).toLocaleString('fr-FR')} FCFA
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        className="h-8 px-2.5 text-xs"
                        onClick={() =>
                          downloadFile(`${base}/invoices/${inv._id}/pdf`, `facture-${inv.number}.pdf`)
                        }
                      >
                        <Download className="mr-1 size-3.5" />
                        PDF
                      </Button>
                    </td>
                  </tr>
                ))}
                {(invoicesData?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                      Aucune facture disponible.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === 'deposits' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Gestion sécurisée des dépôts de garantie, restitutions et retenues légales.
            </p>
            <Button onClick={() => setShowDepositModal(true)}>
              <ShieldCheck className="mr-1.5 size-4" />
              Nouveau mouvement de caution
            </Button>
          </div>
          <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
            Les cautions et dépôts sont rattachés aux contrats actifs. Utilisez le bouton ci-dessus
            pour enregistrer une caution perçue, une restitution de sortie ou une déduction pour loyer impayé.
          </div>
        </div>
      ) : null}

      {/* Modal Encaisser Paiement */}
      {selectedSchedule ? (
        <Modal
          open={!!selectedSchedule}
          onOpenChange={(open) => {
            if (!open) setSelectedSchedule(null);
          }}
          title="Enregistrer un paiement"
          description={`Échéance du ${formatDate(selectedSchedule.dueDate)} · Solde restant : ${(
            selectedSchedule.amountDueMinor +
            selectedSchedule.penaltyMinor -
            selectedSchedule.amountPaidMinor
          ).toLocaleString('fr-FR')} FCFA`}
        >
          <PaymentForm
            schedule={selectedSchedule}
            onClose={() => setSelectedSchedule(null)}
          />
        </Modal>
      ) : null}

      {/* Modal Modifier Échéance */}
      {editSchedule ? (
        <Modal
          open={!!editSchedule}
          onOpenChange={(open) => {
            if (!open) setEditSchedule(null);
          }}
          title="Modifier l'échéance"
          description="Ajustement de la date d'échéance, du loyer ou des pénalités avec traçabilité d'audit."
        >
          <EditScheduleForm
            schedule={editSchedule}
            onClose={() => setEditSchedule(null)}
          />
        </Modal>
      ) : null}

      {/* Modal Annuler Échéance */}
      {cancelSchedule ? (
        <Modal
          open={!!cancelSchedule}
          onOpenChange={(open) => {
            if (!open) setCancelSchedule(null);
          }}
          title="Annuler l'échéance de loyer"
          description="L'annulation clôt définitivement l'échéance avec motif motivé."
        >
          <CancelScheduleForm
            schedule={cancelSchedule}
            onClose={() => setCancelSchedule(null)}
          />
        </Modal>
      ) : null}

      {/* Modal Pénalités de Retard */}
      {showPenaltiesModal ? (
        <Modal
          open={showPenaltiesModal}
          onOpenChange={setShowPenaltiesModal}
          title="Calcul des pénalités de retard"
          description="Applique automatiquement le taux de pénalité sur toutes les échéances échues non réglées."
        >
          <ApplyPenaltiesForm onClose={() => setShowPenaltiesModal(false)} />
        </Modal>
      ) : null}

      {/* Modal Répartition des Charges */}
      {showSplitModal ? (
        <Modal
          open={showSplitModal}
          onOpenChange={setShowSplitModal}
          title="Répartition des charges communes"
          description="Divise une dépense commune (eau, électricité, gardiennage) entre les baux actifs d'une propriété."
        >
          <SplitChargesForm onClose={() => setShowSplitModal(false)} />
        </Modal>
      ) : null}

      {/* Modal Mouvement de Caution */}
      {showDepositModal ? (
        <Modal
          open={showDepositModal}
          onOpenChange={setShowDepositModal}
          title="Enregistrer un mouvement de caution"
          description="Enregistre un dépôt de garantie perçu, une restitution ou une déduction sur impayé."
        >
          <DepositForm onClose={() => setShowDepositModal(false)} />
        </Modal>
      ) : null}

      {/* Modal Historique Locataire */}
      {showTenantHistoryModal ? (
        <Modal
          open={showTenantHistoryModal}
          onOpenChange={setShowTenantHistoryModal}
          title="Historique financier du locataire"
          description="Consultez l'ensemble des échéances, paiements et soldes pour un locataire."
        >
          <TenantHistoryViewer />
        </Modal>
      ) : null}
    </div>
  );
}

function PaymentForm({
  schedule,
  onClose,
}: {
  schedule: Schedule;
  onClose: () => void;
}) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();
  const defaultRemaining = Math.max(
    0,
    schedule.amountDueMinor + schedule.penaltyMinor - schedule.amountPaidMinor,
  );
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
  );

  const record = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ duplicate?: boolean }>(`${base}/payments`, { method: 'POST', body }),
    onSuccess: (result) => {
      void client.invalidateQueries();
      toast({
        title: result.duplicate ? 'Paiement déjà enregistré' : 'Paiement enregistré avec succès',
        description: result.duplicate
          ? 'Cette transaction avait déjà été confirmée (idempotence).'
          : 'La quittance de loyer a été émise et est téléchargeable.',
        variant: result.duplicate ? 'warning' : 'success',
      });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur lors du paiement', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = recordPaymentSchema.safeParse({
          rentScheduleId: schedule._id,
          amountMinor: Number(form.get('amountMinor')),
          method: form.get('method'),
          idempotencyKey: form.get('idempotencyKey'),
          note: form.get('note') || undefined,
        });
        if (!parsed.success) {
          toast({
            title: 'Données invalides',
            description: parsed.error.issues[0]?.message,
            variant: 'error',
          });
          return;
        }
        record.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Montant à encaisser (FCFA)</label>
        <Input
          name="amountMinor"
          type="number"
          min={1}
          max={defaultRemaining}
          defaultValue={defaultRemaining}
          required
        />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Mode de règlement</label>
        <select
          name="method"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
          {METHODS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Référence unique (Anti-double paiement)</label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() =>
              setIdempotencyKey(`PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`)
            }
          >
            Régénérer
          </button>
        </div>
        <Input name="idempotencyKey" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Remarque / Note interne</label>
        <Input name="note" placeholder="Ex: Paiement reçu par MTN MoMo, réf locataire..." />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={record.isPending}>
          {record.isPending ? 'Enregistrement...' : 'Valider le paiement'}
        </Button>
      </div>
    </form>
  );
}

function EditScheduleForm({
  schedule,
  onClose,
}: {
  schedule: Schedule;
  onClose: () => void;
}) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const update = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/rent-schedules/${schedule._id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Échéance mise à jour', description: 'Modification consignée dans le journal d’audit.', variant: 'success' });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = updateScheduleSchema.safeParse({
          dueDate: form.get('dueDate'),
          amountDueMinor: Number(form.get('amountDueMinor')),
          penaltyMinor: Number(form.get('penaltyMinor')),
          reason: form.get('reason'),
        });
        if (!parsed.success) {
          toast({ title: 'Données invalides', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        update.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Date d’échéance</label>
        <Input name="dueDate" type="date" defaultValue={schedule.dueDate.slice(0, 10)} required />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Montant du loyer (FCFA)</label>
        <Input name="amountDueMinor" type="number" min={1} defaultValue={schedule.amountDueMinor} required />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Pénalité de retard (FCFA)</label>
        <Input name="penaltyMinor" type="number" min={0} defaultValue={schedule.penaltyMinor} required />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Motif de la modification (Audit)</label>
        <Input name="reason" placeholder="Ex: Accord amiable d'échelonnement, régularisation" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={update.isPending}>Enregistrer</Button>
      </div>
    </form>
  );
}

function CancelScheduleForm({
  schedule,
  onClose,
}: {
  schedule: Schedule;
  onClose: () => void;
}) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const cancel = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/rent-schedules/${schedule._id}/cancel`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Échéance annulée', variant: 'success' });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = cancelScheduleSchema.safeParse({ reason: form.get('reason') });
        if (!parsed.success) {
          toast({ title: 'Motif requis', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        cancel.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Motif de l'annulation</label>
        <Input name="reason" placeholder="Ex: Résiliation anticipée, erreur de saisie" required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Retour</Button>
        <Button type="submit" variant="secondary" className="text-rose-600 hover:text-rose-700" disabled={cancel.isPending}>
          Confirmer l'annulation
        </Button>
      </div>
    </form>
  );
}

function ApplyPenaltiesForm({ onClose }: { onClose: () => void }) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const apply = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ updated: number }>(`${base}/rent-schedules/apply-penalties`, { method: 'POST', body }),
    onSuccess: (data) => {
      void client.invalidateQueries();
      toast({
        title: 'Pénalités appliquées',
        description: `${data.updated} échéance(s) mise(s) à jour avec leurs pénalités.`,
        variant: 'success',
      });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = applyLatePenaltiesSchema.safeParse({
          minDaysOverdue: Number(form.get('minDaysOverdue')),
          gracePeriodDays: Number(form.get('gracePeriodDays')),
          penaltyRatePercent: Number(form.get('penaltyRatePercent')),
        });
        if (!parsed.success) {
          toast({ title: 'Paramètres invalides', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        apply.mutate(parsed.data);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Retard min (jours)</label>
          <Input name="minDaysOverdue" type="number" min={1} defaultValue={5} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Délai de grâce (jours)</label>
          <Input name="gracePeriodDays" type="number" min={0} defaultValue={0} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Taux de pénalité (%)</label>
          <Input name="penaltyRatePercent" type="number" min={0} max={100} defaultValue={10} required />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Seules les échéances échues ayant un statut non soldé (À venir, Partiel, En retard) seront recalculées.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={apply.isPending}>Calculer et appliquer</Button>
      </div>
    </form>
  );
}

function SplitChargesForm({ onClose }: { onClose: () => void }) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const split = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest<{ invoicesCreated: number; totalDistributedMinor: number }>(
        `${base}/finance/split-charges`,
        { method: 'POST', body },
      ),
    onSuccess: (res) => {
      void client.invalidateQueries();
      toast({
        title: 'Charges réparties avec succès',
        description: `${res.invoicesCreated} facture(s) créée(s) pour un total de ${res.totalDistributedMinor.toLocaleString('fr-FR')} FCFA.`,
        variant: 'success',
      });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = chargeSplitSchema.safeParse({
          propertyId: form.get('propertyId'),
          category: form.get('category'),
          periodStart: form.get('periodStart'),
          periodEnd: form.get('periodEnd'),
          totalAmountMinor: Number(form.get('totalAmountMinor')),
          splitMethod: form.get('splitMethod'),
          description: form.get('description'),
        });
        if (!parsed.success) {
          toast({ title: 'Données invalides', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        split.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">ID Propriété</label>
        <Input name="propertyId" placeholder="Identifiant de la propriété" required />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
          <select name="category" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="WATER">Facture d’eau</option>
            <option value="ELECTRICITY">Électricité commune</option>
            <option value="INTERNET">Internet collectif</option>
            <option value="CLEANING">Entretien des communs</option>
            <option value="SECURITY">Gardiennage & Sécurité</option>
            <option value="MAINTENANCE">Maintenance</option>
            <option value="OTHER">Autre charge</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Mode de répartition</label>
          <select name="splitMethod" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            <option value="EQUAL">Part égale par logement</option>
            <option value="SURFACE">Au prorata de la superficie (m²)</option>
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date de début</label>
          <Input name="periodStart" type="date" required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Date de fin</label>
          <Input name="periodEnd" type="date" required />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Montant total de la facture (FCFA)</label>
        <Input name="totalAmountMinor" type="number" min={1} required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Description / Référence</label>
        <Input name="description" placeholder="Ex: Facture SONEB / Senelec Octobre 2026" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={split.isPending}>Calculer & Émettre les factures</Button>
      </div>
    </form>
  );
}

function DepositForm({ onClose }: { onClose: () => void }) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const record = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/deposits`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Mouvement de caution enregistré', variant: 'success' });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = recordDepositSchema.safeParse({
          leaseId: form.get('leaseId'),
          type: form.get('type'),
          amountMinor: Number(form.get('amountMinor')),
          note: form.get('note') || undefined,
        });
        if (!parsed.success) {
          toast({ title: 'Données invalides', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        record.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">ID Contrat de bail (Lease ID)</label>
        <Input name="leaseId" placeholder="Identifiant du contrat" required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Type d'opération</label>
        <select name="type" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
          <option value="RECEIVED">Caution perçue (Encaissement dépôt)</option>
          <option value="REFUNDED">Restitution au locataire</option>
          <option value="DEDUCTION">Déduction pour impayé / dégradations</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Montant (FCFA)</label>
        <Input name="amountMinor" type="number" min={1} required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Note / Justificatif</label>
        <Input name="note" placeholder="Détail de la caution ou retenue effectuée" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={record.isPending}>Enregistrer</Button>
      </div>
    </form>
  );
}

function TenantHistoryViewer() {
  const [tenantId, setTenantId] = useState('');
  const [searchId, setSearchId] = useState('');
  const history = useOrgQuery<TenantHistory>(
    ['tenant-history', searchId],
    `/finance/tenants/${searchId}/history`,
    Boolean(searchId),
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Entrez l'identifiant du locataire (ex: 60c...)"
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
        />
        <Button type="button" onClick={() => setSearchId(tenantId.trim())}>
          Rechercher
        </Button>
      </div>

      {searchId && history.data ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">Dette totale en cours : </span>
            <span className="text-base font-bold text-rose-600">
              {history.data.totalOwedMinor.toLocaleString('fr-FR')} FCFA
            </span>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground">Échéances récentes</h4>
            <div className="mt-1 space-y-1">
              {history.data.schedules.slice(0, 5).map((s) => (
                <div key={s._id} className="flex justify-between text-xs">
                  <span>{formatDate(s.dueDate)}</span>
                  <span>{s.amountDueMinor.toLocaleString('fr-FR')} FCFA ({STATUS_LABELS[s.status] ?? s.status})</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground">Paiements enregistrés</h4>
            <div className="mt-1 space-y-1">
              {history.data.payments.slice(0, 5).map((p) => (
                <div key={p._id} className="flex justify-between text-xs">
                  <span>{p.number} · {formatDate(p.paidAt)}</span>
                  <span className="text-emerald-600">+{p.amountMinor.toLocaleString('fr-FR')} FCFA</span>
                </div>
              ))}
              {history.data.payments.length === 0 ? <p className="text-xs text-muted-foreground">Aucun paiement.</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PaymentsPage() {
  const [method, setMethod] = useState('');
  const [status, setStatus] = useState('');
  const [refundPayment, setRefundPayment] = useState<{ _id: string; number: string; amountMinor: number } | null>(null);
  const [sendReceiptModal, setSendReceiptModal] = useState<{ _id: string; number: string } | null>(null);

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const queryParams = new URLSearchParams({ pageSize: '50' });
  if (method) queryParams.set('method', method);
  if (status) queryParams.set('status', status);

  const { data } = useOrgList<{
    _id: string;
    number: string;
    paidAt: string;
    amountMinor: number;
    method: string;
    status: string;
  }>(['payments', method, status], `/payments?${queryParams.toString()}`);

  const confirmMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`${base}/payments/${id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Paiement confirmé', description: 'La quittance de loyer a été validée.', variant: 'success' });
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des paiements & quittances"
        description="Encaissements, gestion des passerelles (MTN/Orange MoMo), quittances officielles et exports."
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => downloadFile(`${base}/payments/export?format=xlsx`, 'paiements-domora.xlsx')}
            >
              <FileSpreadsheet className="mr-1.5 size-4" />
              Exporter XLSX
            </Button>
            <Button
              variant="secondary"
              onClick={() => downloadFile(`${base}/payments/export?format=csv`, 'paiements-domora.csv')}
            >
              <Download className="mr-1.5 size-4" />
              Exporter CSV
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les modes de règlement</option>
          {METHODS.map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Référence</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Quittance PDF</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((payment) => (
              <tr key={payment._id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{payment.number}</td>
                <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                <td className="px-4 py-3 font-semibold text-emerald-600">
                  {payment.amountMinor.toLocaleString('fr-FR')} FCFA
                </td>
                <td className="px-4 py-3">
                  {METHODS.find(([val]) => val === payment.method)?.[1] ?? payment.method}
                </td>
                <td className="px-4 py-3">
                  <Badge>{PAYMENT_STATUS_LABELS[payment.status] ?? payment.status}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="ghost"
                    className="h-8 px-2.5 text-xs"
                    onClick={() =>
                      downloadFile(
                        `${base}/receipts/${payment._id}/pdf`,
                        `quittance-${payment.number}.pdf`,
                      )
                    }
                  >
                    <Download className="mr-1 size-3.5" />
                    Quittance
                  </Button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => setSendReceiptModal(payment)}
                    >
                      <Send className="mr-1 size-3.5" />
                      Envoyer
                    </Button>
                    {payment.status === 'PENDING' ? (
                      <Button
                        variant="secondary"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => confirmMutation.mutate(payment._id)}
                      >
                        <CheckCircle2 className="mr-1 size-3.5" />
                        Confirmer
                      </Button>
                    ) : null}
                    {payment.status === 'CONFIRMED' ? (
                      <Button
                        variant="ghost"
                        className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700"
                        onClick={() => setRefundPayment(payment)}
                      >
                        <Undo2 className="mr-1 size-3.5" />
                        Rembourser
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
            {(data?.data ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  Aucun paiement trouvé pour ces filtres.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {refundPayment ? (
        <Modal
          open={!!refundPayment}
          onOpenChange={(open) => {
            if (!open) setRefundPayment(null);
          }}
          title="Rembourser un paiement"
          description={`Remboursement de ${refundPayment.amountMinor.toLocaleString('fr-FR')} FCFA sur la référence ${refundPayment.number}.`}
        >
          <RefundForm payment={refundPayment} onClose={() => setRefundPayment(null)} />
        </Modal>
      ) : null}

      {sendReceiptModal ? (
        <Modal
          open={!!sendReceiptModal}
          onOpenChange={(open) => {
            if (!open) setSendReceiptModal(null);
          }}
          title="Transmettre la quittance au locataire"
          description={`Envoi officiel de la quittance ${sendReceiptModal.number} par notification et email.`}
        >
          <SendReceiptForm paymentId={sendReceiptModal._id} onClose={() => setSendReceiptModal(null)} />
        </Modal>
      ) : null}
    </div>
  );
}

function RefundForm({
  payment,
  onClose,
}: {
  payment: { _id: string; number: string; amountMinor: number };
  onClose: () => void;
}) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const refund = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/payments/${payment._id}/refund`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Remboursement effectué', description: 'Le solde de l’échéance a été réouvert.', variant: 'success' });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = refundPaymentSchema.safeParse({ reason: form.get('reason') });
        if (!parsed.success) {
          toast({ title: 'Motif requis', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        refund.mutate(parsed.data);
      }}
    >
      <div>
        <label className="text-xs font-medium text-muted-foreground">Motif du remboursement</label>
        <Input name="reason" placeholder="Ex: Paiement en doublon, erreur de facturation" required />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" variant="secondary" className="text-rose-600 hover:text-rose-700" disabled={refund.isPending}>
          Valider le remboursement
        </Button>
      </div>
    </form>
  );
}

function SendReceiptForm({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const base = useOrgPath();
  const { toast } = useToast();

  const send = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/receipts/${paymentId}/send`, { method: 'POST', body }),
    onSuccess: () => {
      toast({ title: 'Quittance transmise', description: 'Notification envoyée au locataire avec succès.', variant: 'success' });
      onClose();
    },
    onError: (err: Error) =>
      toast({ title: 'Erreur d’envoi', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = sendReceiptSchema.safeParse({
          sendEmail: form.get('sendEmail') === 'on',
          notifyInApp: form.get('notifyInApp') === 'on',
        });
        if (!parsed.success) {
          toast({ title: 'Erreur', description: parsed.error.issues[0]?.message, variant: 'error' });
          return;
        }
        send.mutate(parsed.data);
      }}
    >
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="sendEmail" defaultChecked className="rounded border-input" />
          Envoyer par Email au locataire
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="notifyInApp" defaultChecked className="rounded border-input" />
          Envoyer une notification in-app sur le portail locataire
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
        <Button type="submit" disabled={send.isPending}>
          <Send className="mr-1.5 size-4" />
          Envoyer la quittance
        </Button>
      </div>
    </form>
  );
}
