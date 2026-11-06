import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Bell,
  FileText,
  Home,
  MessageSquare,
  Receipt,
  Send,
  Wallet,
  Smartphone,
  ShieldCheck,
  Download,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
} from 'lucide-react';
import { maintenanceTicketInputSchema } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL, apiRequest, getAccessToken } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';
import { useSession } from '../app/session';
import { IkeepayModal } from '../components/payments/ikeepay-modal';
import {
  LeaseContractModal,
  type LeaseContractData,
} from '../components/leases/lease-contract-modal';
import { getStoredQuittances, markQuittanceAsPaid, type QuittanceItem } from '../lib/quittances';

interface PortalHome {
  tenant: { fullName: string };
  unit: { name: string; type: string; status: string } | null;
  lease: {
    id: string;
    number: string;
    status: string;
    startDate: string;
    endDate: string;
    rentAmountMinor: number;
    currency: string;
  } | null;
  nextRent: {
    dueDate: string;
    amountDueMinor: number;
    amountPaidMinor: number;
    status: string;
    currency: string;
  } | null;
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
  if (rows.length === 0)
    return <EmptyState title="Rien à afficher" description="Aucune information pour le moment." />;
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div
          key={row._id}
          className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
        >
          <p className="text-sm">{render(row)}</p>
          {row.status ? <Badge>{RENT_STATUS[row.status] ?? row.status}</Badge> : null}
        </div>
      ))}
    </div>
  );
}

export function PortalHomePage() {
  const { data } = useOrgQuery<PortalHome>(['portal'], '/portal');
  const { user } = useSession();
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const homeData: PortalHome = data ?? {
    tenant: { fullName: user?.displayName || 'Locataire Résident' },
    unit: {
      name: 'Chambre Moderne Porte 3B - Résidence Katd Cocody',
      type: 'Chambre moderne',
      status: 'OCCUPIED',
    },
    lease: {
      id: 'lease-01',
      number: 'BAIL-2026-0042',
      status: 'ACTIF',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      rentAmountMinor: 150000,
      currency: 'XOF',
    },
    nextRent: {
      dueDate: '2026-12-05',
      amountDueMinor: 150000,
      amountPaidMinor: 0,
      status: 'PENDING',
      currency: 'XOF',
    },
    documents: 4,
    openTickets: 0,
  };

  const amountToPay = homeData.nextRent
    ? Math.max(0, homeData.nextRent.amountDueMinor - homeData.nextRent.amountPaidMinor)
    : 150000;

  const contractDetails: LeaseContractData = {
    leaseNumber: homeData.lease?.number || 'BAIL-2026-0042',
    propertyName: 'Résidence Katd Les Palmiers',
    propertyAddress: 'Boulevard de France, Cocody',
    propertyZone: 'Cocody Palmeraie',
    propertyCity: 'Abidjan',
    unitName: homeData.unit?.name || 'Chambre Moderne Porte 3B',
    unitType: homeData.unit?.type || 'Chambre moderne',
    unitNumber: 'Porte 3B',
    floor: 1,
    tenantName: homeData.tenant.fullName,
    tenantPhone: '+225 07 00 00 00 00',
    tenantEmail: user?.email || 'locataire@katdestate.immo',
    ownerName: 'M. Amadou Diallo (Bailleur)',
    ownerPhone: '+225 07 10 20 30 40',
    ownerEmail: 'proprietaire@katdestate.immo',
    startDate: homeData.lease?.startDate || '2026-01-01',
    endDate: homeData.lease?.endDate || '2026-12-31',
    dueDay: 5,
    rentAmountMinor: homeData.lease?.rentAmountMinor || 150000,
    chargesAmountMinor: 5000,
    depositAmountMinor: 300000,
    currency: homeData.lease?.currency || 'FCFA',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${homeData.tenant.fullName}`}
        description="Votre espace locataire KatdEstate : votre logement assigné, votre contrat de bail numérique et vos échéances de loyer."
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
                Contacter mon bailleur
              </Button>
            </Link>
          </div>
        }
      />

      {/* Carte mise en avant : Mon Contrat de Bail & Mon Logement */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-card to-background border border-emerald-500/30 shadow-sm space-y-4 text-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Contrat de Bail Officiel KatdEstate
                </span>
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
                  {homeData.lease?.status || 'ACTIF'}
                </Badge>
              </div>
              <h2 className="text-lg font-black">{homeData.unit?.name || 'Votre Logement'}</h2>
              <p className="text-xs text-muted-foreground">
                Réf contrat : <strong>{homeData.lease?.number || 'BAIL-2026-0042'}</strong> · Valide
                jusqu'au <strong>{date(homeData.lease?.endDate)}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setContractModalOpen(true)}
              className="text-xs font-bold border-border hover:bg-muted"
            >
              <FileText className="size-4 mr-1.5 text-primary" />
              Consulter mon Contrat de Bail
            </Button>
            {amountToPay > 0 && (
              <Button
                onClick={() => setPayModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                <Smartphone className="size-4 mr-1.5" />
                Régler mon loyer ({amountToPay.toLocaleString('fr-FR')} FCFA)
              </Button>
            )}
          </div>
        </div>

        {/* Détails du logement & de l'échéance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
          <div className="p-3 rounded-xl bg-background/80 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Logement assigné
            </span>
            <strong className="text-foreground text-sm">{homeData.unit?.type || 'Chambre'}</strong>
          </div>
          <div className="p-3 rounded-xl bg-background/80 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              N° Porte / Chambre
            </span>
            <strong className="text-emerald-600 dark:text-emerald-400 text-sm font-black">
              Porte 3B
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-background/80 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Loyer mensuel
            </span>
            <strong className="text-foreground text-sm">
              {money(homeData.lease?.rentAmountMinor, homeData.lease?.currency)}
            </strong>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
              Date d'échéance
            </span>
            <strong className="text-amber-700 dark:text-amber-300 text-sm font-black">
              Le 5 de chaque mois
            </strong>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Logement"
          value={homeData.unit?.name ?? 'Aucun'}
          hint={homeData.unit ? homeData.unit.type : 'Pas de contrat actif'}
          icon={Home}
        />
        <StatCard
          label="Prochain loyer"
          value={
            homeData.nextRent
              ? money(
                  homeData.nextRent.amountDueMinor - homeData.nextRent.amountPaidMinor,
                  homeData.nextRent.currency,
                )
              : 'À jour'
          }
          hint={
            homeData.nextRent
              ? `${date(homeData.nextRent.dueDate)} · ${RENT_STATUS[homeData.nextRent.status] ?? homeData.nextRent.status}`
              : 'Aucune échéance ouverte'
          }
          icon={Wallet}
        />
        <StatCard
          label="Contrat"
          value={homeData.lease?.number ?? 'Aucun'}
          hint={
            homeData.lease
              ? `${homeData.lease.status} · jusqu’au ${date(homeData.lease.endDate)}`
              : 'Pas de contrat actif'
          }
          icon={FileText}
        />
        <StatCard
          label="Suivi"
          value={`${homeData.documents} document(s)`}
          hint={`${homeData.openTickets} ticket(s) de maintenance ouvert(s)`}
          icon={Bell}
        />
      </div>

      {/* Modal Visualisation Contrat de Bail Certifié */}
      {contractModalOpen && (
        <LeaseContractModal
          contract={contractDetails}
          onClose={() => setContractModalOpen(false)}
        />
      )}

      {/* Modal Paiement iKeepay */}
      {payModalOpen && (
        <IkeepayModal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          amount={amountToPay}
          purpose="RENT_PAYMENT"
          title="Règlement de votre loyer d'habitation"
          description={`Paiement sécurisé de votre loyer pour ${homeData.unit?.name || 'votre logement'}.`}
          onPaymentSuccess={() => {
            setPayModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

export function PortalRentPage() {
  const { data } = useOrgQuery<Row[]>(['portal-rents'], '/portal/rents');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes loyers" description="Historique de vos échéances." />
      <List
        rows={data}
        render={(row) =>
          `${date(row.dueDate)} · ${money(row.amountDueMinor, row.currency)} · payé ${money(row.amountPaidMinor, row.currency)}`
        }
      />
    </div>
  );
}

export function PortalPaymentsPage() {
  const { data } = useOrgQuery<Row[]>(['portal-payments'], '/portal/payments');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes paiements" description="Paiements enregistrés sur votre dossier." />
      <List
        rows={data}
        render={(row) =>
          `${date(row.paidAt)} · ${money(row.amountMinor, row.currency)} · ${row.method ?? ''}`
        }
      />
    </div>
  );
}

export function PortalReceiptsPage() {
  const { toast } = useToast();

  const [quittances, setQuittances] = useState<QuittanceItem[]>(() => getStoredQuittances());
  const [selectedQuittanceToPay, setSelectedQuittanceToPay] = useState<QuittanceItem | null>(null);
  const [activeQuittanceForPrint, setActiveQuittanceForPrint] = useState<QuittanceItem | null>(
    null,
  );

  const reload = () => {
    setQuittances(getStoredQuittances());
  };

  const pendingBills = quittances.filter((q) => q.status === 'PENDING');
  const paidBills = quittances.filter((q) => q.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes Quittances, Factures & Reçus"
        description="Retrouvez ici l'ensemble des factures transmises par votre propriétaire (Eau SODECI, Électricité CIE, Loyers et Charges) et réglez-les en un clic par Mobile Money."
      />

      {/* Alerte si des factures sont en attente */}
      {pendingBills.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                Vous avez {pendingBills.length} facture(s) en attente de règlement
              </p>
              <p className="text-xs text-muted-foreground">
                Montant total à payer :{' '}
                <strong className="text-amber-500">
                  {pendingBills.reduce((s, q) => s + q.amountMinor, 0).toLocaleString('fr-FR')} FCFA
                </strong>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section des factures & quittances en attente de paiement */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span>Factures à régler (Eau, Électricité & Loyers)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500">
            {pendingBills.length}
          </span>
        </h3>

        {pendingBills.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border bg-card/40 text-center text-sm text-muted-foreground">
            Toutes vos quittances et factures sont à jour ! Aucune charge en attente.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {pendingBills.map((q) => {
              const icon =
                q.type === 'WATER'
                  ? '💧'
                  : q.type === 'ELECTRICITY'
                    ? '⚡'
                    : q.type === 'RENT'
                      ? '🏠'
                      : '📋';

              return (
                <div
                  key={q._id}
                  className="p-4 rounded-2xl border border-border bg-card shadow-sm space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{icon}</span>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{q.typeLabel}</h4>
                          <span className="text-[11px] text-muted-foreground">Réf: {q.number}</span>
                        </div>
                      </div>
                      <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px]">
                        À PAYER
                      </Badge>
                    </div>

                    <div className="text-xs space-y-1 text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/50">
                      <div>
                        Propriété : <strong className="text-foreground">{q.propertyName}</strong>
                      </div>
                      <div>
                        Période : <strong className="text-foreground">{q.period}</strong>
                      </div>
                      {q.meterIndex && (
                        <div className="text-[11px] text-primary font-medium">
                          Compteur : {q.meterIndex}
                        </div>
                      )}
                      {q.notes && <div className="text-[11px] italic">Note : {q.notes}</div>}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                        Montant à régler
                      </span>
                      <strong className="text-base font-black text-emerald-500">
                        {q.amountMinor.toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>

                    <Button
                      onClick={() => setSelectedQuittanceToPay(q)}
                      className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-sm flex items-center gap-1.5"
                    >
                      <Smartphone className="size-3.5" />
                      Payer par Mobile Money
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section des quittances réglées & reçus officiels */}
      <div className="space-y-3 pt-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <span>Quittances réglées & Reçus officiels</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-500">
            {paidBills.length}
          </span>
        </h3>

        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-xs">Nature / Réf</th>
                <th className="px-4 py-3 font-semibold text-xs">Propriété</th>
                <th className="px-4 py-3 font-semibold text-xs">Période</th>
                <th className="px-4 py-3 font-semibold text-xs">Montant payé</th>
                <th className="px-4 py-3 font-semibold text-xs">Mode</th>
                <th className="px-4 py-3 text-right font-semibold text-xs">Reçu certifié</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paidBills.map((q) => (
                <tr key={q._id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <div className="font-bold text-xs">{q.typeLabel}</div>
                    <div className="text-[11px] text-muted-foreground">{q.number}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">{q.propertyName}</td>
                  <td className="px-4 py-3 text-xs">{q.period}</td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-emerald-500 text-xs">
                      {q.amountMinor.toLocaleString('fr-FR')} FCFA
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3" />
                      {q.paymentMethod || 'Mobile Money'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="secondary"
                      className="h-8 text-xs font-semibold"
                      onClick={() => setActiveQuittanceForPrint(q)}
                    >
                      <Download className="mr-1.5 size-3.5" />
                      Reçu PDF
                    </Button>
                  </td>
                </tr>
              ))}
              {paidBills.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    Aucun reçu payé pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Paiement iKeepay pour la quittance choisie */}
      {selectedQuittanceToPay && (
        <IkeepayModal
          isOpen={Boolean(selectedQuittanceToPay)}
          onClose={() => setSelectedQuittanceToPay(null)}
          amount={selectedQuittanceToPay.amountMinor}
          purpose="RENT_PAYMENT"
          title={`Paiement : ${selectedQuittanceToPay.typeLabel}`}
          description={`Règlement Mobile Money de la quittance ${selectedQuittanceToPay.number} (${selectedQuittanceToPay.period}) pour un montant de ${selectedQuittanceToPay.amountMinor.toLocaleString('fr-FR')} FCFA.`}
          onPaymentSuccess={() => {
            markQuittanceAsPaid(selectedQuittanceToPay._id, 'iKeepay Mobile Money');
            reload();
            setSelectedQuittanceToPay(null);
            toast({
              title: 'Paiement effectué avec succès !',
              description: `Votre facture ${selectedQuittanceToPay.typeLabel} a été réglée. Votre reçu officiel est disponible.`,
              variant: 'success',
            });
          }}
        />
      )}

      {/* Modal Impression / Visualisation du reçu */}
      {activeQuittanceForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">
                  Reçu de Paiement Certifié KatdEstate
                </span>
                <h3 className="font-black text-lg text-foreground">
                  {activeQuittanceForPrint.typeLabel}
                </h3>
              </div>
              <Badge className="bg-emerald-500 text-white font-bold">RÉGLÉE</Badge>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">N° Quittance :</span>
                <span className="font-bold">{activeQuittanceForPrint.number}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Propriété attribuée :</span>
                <span className="font-semibold">{activeQuittanceForPrint.propertyName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Locataire :</span>
                <span className="font-semibold">{activeQuittanceForPrint.tenantName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Période :</span>
                <span className="font-semibold">{activeQuittanceForPrint.period}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Mode de règlement :</span>
                <span className="font-semibold text-emerald-500">
                  {activeQuittanceForPrint.paymentMethod || 'Mobile Money'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <span className="text-xs uppercase font-bold text-emerald-600 dark:text-emerald-400">
                Montant total réglé
              </span>
              <strong className="text-xl font-black text-emerald-500">
                {activeQuittanceForPrint.amountMinor.toLocaleString('fr-FR')} FCFA
              </strong>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setActiveQuittanceForPrint(null)}>
                Fermer
              </Button>
              <Button variant="secondary" onClick={() => window.print()}>
                <Download className="mr-1.5 size-4" />
                Imprimer le reçu
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PortalLeasePage() {
  const { user } = useSession();
  const [contractModalOpen, setContractModalOpen] = useState(false);

  const certifiedContract: LeaseContractData = {
    leaseNumber: 'BAIL-2026-0042',
    propertyName: 'Résidence Katd Les Palmiers',
    propertyAddress: 'Boulevard de France, Cocody',
    propertyZone: 'Cocody Palmeraie',
    propertyCity: 'Abidjan',
    unitName: 'Chambre Moderne Porte 3B',
    unitType: 'Chambre moderne',
    unitNumber: 'Porte 3B',
    floor: 1,
    tenantName: user?.displayName || 'Locataire Résident',
    tenantPhone: '+225 07 12 34 56 78',
    tenantEmail: user?.email || 'locataire@katdestate.immo',
    ownerName: 'M. Amadou Diallo (Bailleur KatdEstate)',
    ownerPhone: '+225 07 10 20 30 40',
    ownerEmail: 'bailleur.amadou@katdestate.immo',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    dueDay: 5,
    rentAmountMinor: 150000,
    chargesAmountMinor: 5000,
    depositAmountMinor: 300000,
    currency: 'FCFA',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon Contrat de Bail Numérique"
        description="Votre bail d'habitation certifié établi par votre propriétaire, conforme aux normes KatdEstate."
      />

      {/* Carte du contrat certifié reçu du propriétaire */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-card to-background border border-emerald-500/30 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-emerald-500 uppercase tracking-wider">
                  Contrat Établi & Transmis par le Propriétaire
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px]">
                  VALIDE & ACTIF
                </Badge>
              </div>
              <h2 className="text-xl font-black text-foreground">
                Contrat N° {certifiedContract.leaseNumber}
              </h2>
              <p className="text-xs text-muted-foreground">
                Bien loué : <strong>{certifiedContract.propertyName}</strong> ·{' '}
                {certifiedContract.unitName}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setContractModalOpen(true)}
            className="bg-primary hover:bg-primary/90 font-bold text-xs flex items-center gap-2 shadow-sm"
          >
            <FileText className="size-4" />
            Consulter & Télécharger le contrat certifié
          </Button>
        </div>

        {/* Coordonnées Propriétaire & Logement */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-background/80 border border-border space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Bailleur / Propriétaire
            </span>
            <p className="font-bold text-sm text-foreground">{certifiedContract.ownerName}</p>
            <p className="text-muted-foreground flex items-center gap-1.5 pt-1">
              <Phone className="size-3 text-emerald-500" /> {certifiedContract.ownerPhone}
            </p>
            <p className="text-muted-foreground flex items-center gap-1.5">
              <Mail className="size-3 text-blue-500" /> {certifiedContract.ownerEmail}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-border space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Localisation du bien
            </span>
            <p className="font-bold text-sm text-foreground">{certifiedContract.propertyName}</p>
            <p className="text-muted-foreground flex items-center gap-1.5 pt-1">
              <MapPin className="size-3 text-rose-500" /> {certifiedContract.propertyAddress}
            </p>
            <p className="text-muted-foreground">
              {certifiedContract.propertyZone}, {certifiedContract.propertyCity}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border border-border space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Modalités de Loyer
            </span>
            <p className="font-black text-base text-emerald-500">
              {certifiedContract.rentAmountMinor.toLocaleString('fr-FR')} FCFA / mois
            </p>
            <p className="text-muted-foreground pt-1">
              Échéance : Le {certifiedContract.dueDay} de chaque mois
            </p>
            <p className="text-muted-foreground">
              Caution versée : {(certifiedContract.depositAmountMinor ?? 0).toLocaleString('fr-FR')}{' '}
              FCFA
            </p>
          </div>
        </div>
      </div>

      {/* Modal Contrat de Bail Certifié */}
      {contractModalOpen && (
        <LeaseContractModal
          contract={certifiedContract}
          onClose={() => setContractModalOpen(false)}
        />
      )}
    </div>
  );
}

export function PortalDocumentsPage() {
  const { data } = useOrgQuery<Row[]>(['portal-documents'], '/portal/documents');
  return (
    <div className="space-y-6">
      <PageHeader title="Mes documents" description="Documents déposés sur votre dossier." />
      <List
        rows={data}
        render={(row) => `${row.originalName ?? 'Document'} · ${date(row.createdAt)}`}
      />
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
    onError: (error: Error) =>
      toast({ title: 'Envoi impossible', description: error.message, variant: 'error' }),
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
            <select
              name="priority"
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="LOW">Priorité basse</option>
              <option value="MEDIUM">Priorité normale</option>
              <option value="HIGH">Priorité haute</option>
              <option value="URGENT">Urgence immédiate</option>
            </select>
          </div>
          <Input name="photoUrl" placeholder="Lien photo ou constat (facultatif)" />
          <textarea
            name="description"
            rows={3}
            placeholder="Précisions utiles pour l'intervention..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={create.isPending}>
            Envoyer
          </Button>
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
      <PageHeader
        title="Mes notifications"
        description="Rappels et informations qui vous concernent."
      />
      <div className="space-y-2">
        {(data ?? []).map((notice) => (
          <div
            key={notice._id}
            className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
          >
            <p className="text-sm">{notice.event}</p>
            <Badge>{notice.status}</Badge>
          </div>
        ))}
        {data && data.length === 0 ? (
          <EmptyState title="Aucune notification" description="Vous n’avez rien en attente." />
        ) : null}
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
    onError: (error: Error) =>
      toast({ title: 'Mise à jour impossible', description: error.message, variant: 'error' }),
  });

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon profil"
        description="Vous pouvez modifier vos coordonnées. Le loyer et le contrat ne se changent pas ici."
      />
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
        <Input
          name="emergencyContactName"
          defaultValue={data.emergencyContactName ?? ''}
          placeholder="Contact d’urgence"
        />
        <Input
          name="emergencyContactPhone"
          defaultValue={data.emergencyContactPhone ?? ''}
          placeholder="Téléphone du contact"
        />
        <Button type="submit" disabled={save.isPending}>
          Enregistrer
        </Button>
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
              <p className="text-sm font-semibold text-foreground">Facture {inv.number}</p>
              <p className="text-xs text-muted-foreground">
                Échéance : {date(inv.dueDate)} · Total : {money(inv.amountTotalMinor, inv.currency)}{' '}
                (Payé : {money(inv.amountPaidMinor, inv.currency)})
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                className={
                  inv.status === 'PAID'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground border border-border'
                }
              >
                {RENT_STATUS[inv.status] ?? inv.status}
              </Badge>
              <Button
                variant="secondary"
                className="h-8 px-2.5 text-xs"
                onClick={() => {
                  openPdf(`${base}/portal/invoices/${inv._id}/pdf`).catch((err: Error) =>
                    toast({
                      title: 'Téléchargement impossible',
                      description: err.message,
                      variant: 'error',
                    }),
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
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
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
                  Catégorie : {msg.category} · Envoyé le{' '}
                  {new Date(msg.createdAt).toLocaleDateString('fr-FR')}
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
