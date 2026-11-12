import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
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
  Plus,
  ArrowUpRight,
  Building2,
  DoorOpen,
  X,
} from 'lucide-react';
import { maintenanceTicketInputSchema } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { API_BASE_URL, apiRequest, downloadFile, getAccessToken } from '../lib/api-client';
import { useOrgPath, useOrgQuery } from '../lib/query';
import { useSession } from '../app/session';
import { IkeepayModal } from '../components/payments/ikeepay-modal';
import {
  LeaseContractModal,
  type LeaseContractData,
} from '../components/leases/lease-contract-modal';
import { getStoredQuittances, markQuittanceAsPaid, type QuittanceItem } from '../lib/quittances';
import { getLocalTenants, type Tenant } from './tenants';
import { getLocalProperties } from './properties';
import {
  createLocalChatThread,
  depositToTenantWallet,
  getRentValidations,
  getStoredChatThreads,
  getTenantWallet,
  replyToLocalChatThread,
  transferFromTenantWalletToOwner,
  type ChatThread,
  type WalletState,
} from '../lib/katdestate-store';
import { STORAGE_ACTIVE_TENANT_PROFILE_KEY } from '../lib/auth-api';

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

/**
 * Récupère les informations complètes du locataire connecté et de sa propriété attribuée
 */
function useResolvedTenantProfile(userEmail?: string, userDisplayName?: string) {
  return useMemo(() => {
    const allTenants = getLocalTenants();
    const allProps = getLocalProperties();
    let matched: Tenant | undefined;

    if (userEmail) {
      matched = allTenants.find(
        (t) => t.email && t.email.trim().toLowerCase() === userEmail.trim().toLowerCase(),
      );
    }
    if (!matched && typeof window !== 'undefined') {
      try {
        const storedProfile = localStorage.getItem(STORAGE_ACTIVE_TENANT_PROFILE_KEY);
        if (storedProfile) matched = JSON.parse(storedProfile) as Tenant;
      } catch {}
    }
    if (!matched && allTenants.length > 0) {
      matched = allTenants[0];
    }

    const prop = matched?.propertyId
      ? allProps.find((p) => p._id === matched?.propertyId)
      : allProps[0];

    return {
      tenantId: matched?._id || 'ten-default-1',
      fullName: matched?.fullName || userDisplayName || 'Kouamé Jean-Marc',
      email: matched?.email || userEmail || 'locataire@katdestate.immo',
      phone: matched?.phone || '+225 07 12 34 56 78',
      propertyId: matched?.propertyId || prop?._id || 'prop-default-1',
      propertyName: matched?.propertyName || prop?.name || 'Résidence Katd Les Palmiers',
      propertyZone: prop?.zone || 'Cocody Riviera Palmeraie',
      propertyAddress: prop?.address || 'Boulevard de France, Lot 142',
      propertyCity: prop?.city || 'Abidjan',
      unitName: matched?.unitName || 'Appartement / Chambre Moderne',
      unitNumber: matched?.unitNumber || 'Porte 3B',
      unitType: matched?.unitType || 'Chambre moderne',
      rentAmount: matched?.rentAmount || 150000,
      dueDay: matched?.dueDay || 5,
      paymentPeriod: matched?.paymentPeriod || 'Novembre 2026',
      tenantCategory: matched?.tenantCategory || 'EXISTING',
      leaseStartDate: matched?.leaseStartDate || '2026-01-01',
      leaseEndDate: matched?.leaseEndDate || '2026-12-31',
      advanceMonths: matched?.advanceMonths,
      advanceAmount: matched?.advanceAmount,
      monthlyPaymentStartPeriod: matched?.monthlyPaymentStartPeriod,
    };
  }, [userEmail, userDisplayName]);
}

export function PortalHomePage() {
  const { data } = useOrgQuery<PortalHome>(['portal'], '/portal');
  const { user } = useSession();
  const { toast } = useToast();

  const resolved = useResolvedTenantProfile(user?.email, user?.displayName);
  const walletKey = resolved.email || resolved.tenantId;

  const [wallet, setWallet] = useState<WalletState>(() => getTenantWallet(walletKey));
  const [rentValidations, setRentValidations] = useState(() => getRentValidations());
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferInitialCategory, setTransferInitialCategory] = useState<'RENT' | 'QUITTANCE'>(
    'RENT',
  );

  const reloadWalletAndStatus = () => {
    setWallet(getTenantWallet(walletKey));
    setRentValidations(getRentValidations());
  };

  useEffect(() => {
    reloadWalletAndStatus();
  }, [walletKey]);

  const isRentPaid = Boolean(
    rentValidations[resolved.tenantId]?.status === 'PAID' ||
      (resolved.email && rentValidations[resolved.email.toLowerCase()]?.status === 'PAID'),
  );

  const amountToPay = isRentPaid ? 0 : resolved.rentAmount;

  const contractDetails: LeaseContractData = {
    leaseNumber: data?.lease?.number || 'BAIL-2026-0042',
    propertyName: resolved.propertyName,
    propertyAddress: resolved.propertyAddress,
    propertyZone: resolved.propertyZone,
    propertyCity: resolved.propertyCity,
    unitName: resolved.unitName,
    unitType: resolved.unitType,
    unitNumber: resolved.unitNumber,
    floor: 1,
    tenantName: resolved.fullName,
    tenantPhone: resolved.phone,
    tenantEmail: resolved.email,
    ownerName: 'M. Amadou Diallo (Propriétaire Bailleur)',
    ownerPhone: '+225 07 10 20 30 40',
    ownerEmail: 'proprietaire@katdestate.immo',
    startDate: resolved.leaseStartDate,
    endDate: resolved.leaseEndDate,
    dueDay: resolved.dueDay,
    rentAmountMinor: resolved.rentAmount,
    chargesAmountMinor: 5000,
    depositAmountMinor: resolved.advanceAmount || resolved.rentAmount * 2,
    currency: 'FCFA',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Bonjour ${resolved.fullName}`}
        description="Votre dashboard locataire KatdEstate : informations complètes de votre propriété, votre Portefeuille Locataire (dépôts & transferts au propriétaire), vos quittances et votre messagerie."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/portal/receipts">
              <Button variant="secondary" className="h-9 text-xs inline-flex items-center gap-1.5">
                <Receipt className="size-3.5" />
                Gestion des Quittances & Factures
              </Button>
            </Link>
            <Link to="/portal/messages">
              <Button className="h-9 text-xs inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90">
                <MessageSquare className="size-3.5" />
                Discuter avec le Propriétaire
              </Button>
            </Link>
          </div>
        }
      />

      {/* ====================================================================
          SECTION 1 : MON PORTEFEUILLE LOCATAIRE (DÉPÔT & TRANSFERT AU PROPRIÉTAIRE)
         ==================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-card to-background border border-emerald-500/30 shadow-md space-y-4 text-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Wallet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-500">
                  Mon Portefeuille Locataire KatdEstate
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  SOLDE DISPONIBLE
                </Badge>
              </div>
              <h2 className="text-2xl font-black text-foreground">
                {wallet.balance.toLocaleString('fr-FR')} FCFA
              </h2>
              <p className="text-xs text-muted-foreground">
                Faites un dépôt puis transférez votre loyer ou votre facture d'eau/électricité vers
                le portefeuille du propriétaire en mentionnant la nature du transfert.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setDepositModalOpen(true)}
              variant="outline"
              className="text-xs font-bold border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 h-10 px-4"
            >
              <Plus className="size-4 mr-1.5" />
              Faire un dépôt (Recharger)
            </Button>
            <Button
              onClick={() => {
                setTransferInitialCategory('RENT');
                setTransferModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-4 shadow-md shadow-emerald-500/20"
            >
              <ArrowUpRight className="size-4 mr-1.5" />
              Transférer au Propriétaire (Loyer / Facture)
            </Button>
          </div>
        </div>

        {/* Historique récent du portefeuille du locataire */}
        {wallet.transactions.length > 0 && (
          <div className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Historique de mon portefeuille (Dépôts & Transferts vers le Propriétaire) :
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {wallet.transactions.slice(0, 4).map((tx) => (
                <div
                  key={tx._id}
                  className="p-2.5 rounded-xl bg-background/80 border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground">
                      {tx.type === 'DEPOSIT'
                        ? '📥 Dépôt sur mon portefeuille'
                        : tx.type === 'TRANSFER_RENT'
                          ? '🏠 Transfert Loyer → Propriétaire'
                          : '💧 Transfert Quittance/Facture → Propriétaire'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Nature : <strong className="text-foreground">{tx.nature}</strong>
                    </p>
                  </div>
                  <span
                    className={`font-black text-xs shrink-0 ${
                      tx.type === 'DEPOSIT' ? 'text-emerald-500' : 'text-amber-500'
                    }`}
                  >
                    {tx.type === 'DEPOSIT' ? '+' : '-'}
                    {tx.amount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ====================================================================
          SECTION 2 : TOUTES LES INFORMATIONS CONCERNANT MA PROPRIÉTÉ & MON LOGEMENT
         ==================================================================== */}
      <div className="p-5 sm:p-6 rounded-3xl bg-card border border-border shadow-sm space-y-4 text-foreground">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Building2 className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Informations Complètes sur ma Propriété & mon Logement
                </span>
                <Badge
                  className={
                    isRentPaid
                      ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px]'
                      : 'bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px]'
                  }
                >
                  {isRentPaid ? '✓ LOYER À JOUR' : 'ÉCHÉANCE EN COURS'}
                </Badge>
              </div>
              <h2 className="text-lg font-black">{resolved.propertyName}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3.5 text-rose-500" />
                {resolved.propertyZone} · {resolved.propertyAddress}, {resolved.propertyCity}
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
              Mon Contrat de Bail
            </Button>
            <Button
              onClick={() => {
                setTransferInitialCategory('QUITTANCE');
                setTransferModalOpen(true);
              }}
              variant="outline"
              className="text-xs font-bold border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
            >
              <Receipt className="size-4 mr-1.5" />
              Payer Facture / Quittance d'Eau
            </Button>
          </div>
        </div>

        {/* Grille détaillée de la propriété et du logement attribué */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Propriété & Zone
            </span>
            <strong className="text-foreground text-sm block truncate">
              {resolved.propertyName}
            </strong>
            <span className="text-[11px] text-muted-foreground">{resolved.propertyZone}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Logement & Numéro occupé
            </span>
            <strong className="text-emerald-500 text-sm font-black block">
              {resolved.unitNumber}
            </strong>
            <span className="text-[11px] text-muted-foreground">{resolved.unitName}</span>
          </div>
          <div className="p-3 rounded-xl bg-muted/30 border border-border">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Loyer mensuel
            </span>
            <strong className="text-foreground text-sm font-black block">
              {resolved.rentAmount.toLocaleString('fr-FR')} FCFA
            </strong>
            <span className="text-[11px] text-muted-foreground">
              {isRentPaid ? 'Payé et validé' : 'À régler'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] uppercase font-bold text-amber-500 block">
              Période / Échéance Loyer
            </span>
            <strong className="text-amber-500 text-sm font-black block">
              Le {resolved.dueDay} du mois
            </strong>
            <span className="text-[11px] text-muted-foreground">{resolved.paymentPeriod}</span>
          </div>
        </div>

        {/* Contact du Propriétaire + Bouton Messagerie */}
        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">
              Votre Propriétaire / Bailleur :
            </span>
            <p className="font-bold text-foreground">
              M. Amadou Diallo · Tél : +225 07 10 20 30 40 · Email : proprietaire@katdestate.immo
            </p>
          </div>
          <Link to="/portal/messages">
            <Button size="sm" className="text-xs font-bold flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Discuter par message avec le propriétaire
            </Button>
          </Link>
        </div>
      </div>

      {/* Cartes de synthèse */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Mon Portefeuille"
          value={`${wallet.balance.toLocaleString('fr-FR')} FCFA`}
          hint="Solde disponible pour transfert"
          icon={Wallet}
        />
        <StatCard
          label="Logement occupé"
          value={resolved.unitNumber}
          hint={`${resolved.unitName} · ${resolved.propertyName}`}
          icon={DoorOpen}
        />
        <StatCard
          label="Statut du Loyer"
          value={isRentPaid ? 'Payé ✓' : `${amountToPay.toLocaleString('fr-FR')} FCFA`}
          hint={
            isRentPaid
              ? 'Validé dans Gestion des Loyers'
              : `Échéance : Le ${resolved.dueDay} du mois`
          }
          icon={Home}
        />
        <StatCard
          label="Contrat de Bail"
          value={contractDetails.leaseNumber}
          hint={`Valide jusqu'au ${date(resolved.leaseEndDate)}`}
          icon={FileText}
        />
      </div>

      {/* Modal Dépôt sur le Portefeuille Locataire */}
      {depositModalOpen && (
        <TenantWalletDepositModal
          walletKey={walletKey}
          onClose={() => setDepositModalOpen(false)}
          onSuccess={() => {
            reloadWalletAndStatus();
            setDepositModalOpen(false);
            toast({
              title: 'Dépôt effectué sur votre portefeuille !',
              description:
                'Votre solde a été crédité. Vous pouvez maintenant transférer vers le portefeuille du propriétaire.',
              variant: 'success',
            });
          }}
        />
      )}

      {/* Modal Transfert du Portefeuille Locataire vers le Portefeuille du Propriétaire */}
      {transferModalOpen && (
        <TenantWalletTransferModal
          walletKey={walletKey}
          walletBalance={wallet.balance}
          tenantProfile={resolved}
          initialCategory={transferInitialCategory}
          onClose={() => setTransferModalOpen(false)}
          onSuccess={(category, nature, amount) => {
            reloadWalletAndStatus();
            setTransferModalOpen(false);
            toast({
              title:
                category === 'RENT'
                  ? 'Loyer transféré & validé automatiquement !'
                  : 'Facture / Quittance payée dans les délais !',
              description: `Transfert de ${amount.toLocaleString('fr-FR')} FCFA (${nature}) reçu dans le portefeuille du propriétaire.`,
              variant: 'success',
            });
          }}
        />
      )}

      {/* Modal Visualisation Contrat de Bail Certifié */}
      {contractModalOpen && (
        <LeaseContractModal
          contract={contractDetails}
          onClose={() => setContractModalOpen(false)}
        />
      )}

      {/* Modal Paiement iKeepay direct */}
      {payModalOpen && (
        <IkeepayModal
          isOpen={payModalOpen}
          onClose={() => setPayModalOpen(false)}
          amount={amountToPay}
          purpose="RENT_PAYMENT"
          title="Règlement de votre loyer d'habitation"
          description={`Paiement sécurisé de votre loyer pour ${resolved.unitName} (${resolved.unitNumber}).`}
          onPaymentSuccess={() => {
            setPayModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// MODAL DE DÉPÔT SUR LE PORTEFEUILLE DU LOCATAIRE
// ============================================================================
function TenantWalletDepositModal({
  walletKey,
  onClose,
  onSuccess,
}: {
  walletKey: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState(150000);
  const [method, setMethod] = useState('Mobile Money (Wave)');
  const [phone, setPhone] = useState('+225 07 12 34 56 78');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || amount <= 0) return;
    depositToTenantWallet(
      walletKey,
      Number(amount),
      `${method} (${phone})`,
      `Dépôt sur portefeuille locataire via ${method}`,
    );
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <Wallet className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Faire un Dépôt sur mon Portefeuille</h3>
              <p className="text-xs text-muted-foreground">
                Rechargez votre solde pour payer vos loyers et quittances
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Montant à déposer (FCFA) *</label>
            <Input
              type="number"
              min="500"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              required
              className="text-sm font-black"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Moyen de rechargement *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
            >
              <option value="Mobile Money (Wave)">Wave Mobile Money</option>
              <option value="Mobile Money (Orange Money)">Orange Money</option>
              <option value="Mobile Money (MTN MoMo)">MTN Mobile Money</option>
              <option value="Mobile Money (Moov Money)">Moov Money</option>
              <option value="Carte Bancaire Visa/Mastercard">Carte Bancaire</option>
            </select>
          </div>

          <div>
            <label className="font-semibold block mb-1">Numéro de téléphone débité *</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <Plus className="size-4 mr-1" />
              Créditer mon portefeuille ({amount.toLocaleString('fr-FR')} FCFA)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL DE TRANSFERT DU PORTEFEUILLE LOCATAIRE VERS LE PORTEFEUILLE PROPRIÉTAIRE
// (Avec mention obligatoire de la nature du transfert : Loyer ou Quittance/Facture d'eau/élec)
// ============================================================================
function TenantWalletTransferModal({
  walletKey,
  walletBalance,
  tenantProfile,
  initialCategory = 'RENT',
  preselectedQuittance = null,
  onClose,
  onSuccess,
}: {
  walletKey: string;
  walletBalance: number;
  tenantProfile: ReturnType<typeof useResolvedTenantProfile>;
  initialCategory?: 'RENT' | 'QUITTANCE';
  preselectedQuittance?: QuittanceItem | null;
  onClose: () => void;
  onSuccess: (category: 'RENT' | 'QUITTANCE', nature: string, amount: number) => void;
}) {
  const { toast } = useToast();
  const [category, setCategory] = useState<'RENT' | 'QUITTANCE'>(
    preselectedQuittance ? 'QUITTANCE' : initialCategory,
  );
  const pendingQuittances = useMemo(
    () => getStoredQuittances().filter((q) => q.status === 'PENDING'),
    [],
  );
  const [selectedQuittanceId, setSelectedQuittanceId] = useState<string>(
    preselectedQuittance?._id || pendingQuittances[0]?._id || '',
  );
  const [amount, setAmount] = useState<number>(
    preselectedQuittance
      ? preselectedQuittance.amountMinor
      : initialCategory === 'RENT'
        ? tenantProfile.rentAmount
        : pendingQuittances[0]?.amountMinor || 15000,
  );
  const [nature, setNature] = useState<string>(
    preselectedQuittance
      ? `${preselectedQuittance.typeLabel} - ${preselectedQuittance.period} (${tenantProfile.unitNumber})`
      : initialCategory === 'RENT'
        ? `Paiement Loyer ${tenantProfile.paymentPeriod} - ${tenantProfile.unitNumber} (${tenantProfile.propertyName})`
        : pendingQuittances[0]
          ? `${pendingQuittances[0].typeLabel} - ${pendingQuittances[0].period}`
          : `Facture d'eau SODECI / Électricité - ${tenantProfile.unitNumber}`,
  );

  const handleCategoryChange = (nextCat: 'RENT' | 'QUITTANCE') => {
    setCategory(nextCat);
    if (nextCat === 'RENT') {
      setAmount(tenantProfile.rentAmount);
      setNature(
        `Paiement Loyer ${tenantProfile.paymentPeriod} - ${tenantProfile.unitNumber} (${tenantProfile.propertyName})`,
      );
    } else {
      const firstQ = pendingQuittances[0];
      if (firstQ) {
        setSelectedQuittanceId(firstQ._id);
        setAmount(firstQ.amountMinor);
        setNature(`${firstQ.typeLabel} - ${firstQ.period} (${tenantProfile.unitNumber})`);
      } else {
        setAmount(15000);
        setNature(`Facture d'eau SODECI - ${tenantProfile.unitNumber}`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nature.trim()) {
      toast({ title: 'Veuillez mentionner la nature du transfert', variant: 'error' });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: 'Montant invalide', variant: 'error' });
      return;
    }
    try {
      transferFromTenantWalletToOwner({
        tenantKey: walletKey,
        tenantId: tenantProfile.tenantId,
        tenantName: tenantProfile.fullName,
        tenantEmail: tenantProfile.email,
        tenantPhone: tenantProfile.phone,
        propertyId: tenantProfile.propertyId,
        propertyName: tenantProfile.propertyName,
        unitName: tenantProfile.unitName,
        unitNumber: tenantProfile.unitNumber,
        amount: Number(amount),
        category,
        nature: nature.trim(),
        period: tenantProfile.paymentPeriod,
        quittanceId: category === 'QUITTANCE' ? selectedQuittanceId || undefined : undefined,
      });
      onSuccess(category, nature.trim(), Number(amount));
    } catch (err: any) {
      toast({
        title: 'Transfert impossible',
        description: err instanceof Error ? err.message : 'Vérifiez votre solde.',
        variant: 'error',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <ArrowUpRight className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-base">
                Transférer de mon Portefeuille vers le Propriétaire
              </h3>
              <p className="text-xs text-muted-foreground">
                Solde disponible :{' '}
                <strong className="text-emerald-500">
                  {walletBalance.toLocaleString('fr-FR')} FCFA
                </strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Choix : Loyer vs Quittance/Facture d'eau */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-muted/50 border border-border">
            <button
              type="button"
              onClick={() => handleCategoryChange('RENT')}
              className={`p-2.5 rounded-xl font-bold text-left transition ${
                category === 'RENT'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="block text-xs">🏠 Payer mon Loyer</span>
              <span className="text-[10px] opacity-80">Vers Portefeuille Loyers Propriétaire</span>
            </button>

            <button
              type="button"
              onClick={() => handleCategoryChange('QUITTANCE')}
              className={`p-2.5 rounded-xl font-bold text-left transition ${
                category === 'QUITTANCE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="block text-xs">💧 Payer Facture / Quittance</span>
              <span className="text-[10px] opacity-80">Eau SODECI, Électricité CIE, Charges</span>
            </button>
          </div>

          {category === 'QUITTANCE' && pendingQuittances.length > 0 && (
            <div>
              <label className="font-semibold block mb-1">
                Sélectionner la facture / quittance à régler :
              </label>
              <select
                value={selectedQuittanceId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedQuittanceId(id);
                  const found = pendingQuittances.find((q) => q._id === id);
                  if (found) {
                    setAmount(found.amountMinor);
                    setNature(
                      `${found.typeLabel} - ${found.period} (${tenantProfile.unitNumber})`,
                    );
                  }
                }}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                {pendingQuittances.map((q) => (
                  <option key={q._id} value={q._id}>
                    {q.typeLabel} ({q.period}) — {q.amountMinor.toLocaleString('fr-FR')} FCFA
                  </option>
                ))}
                <option value="">Autre facture d'eau / électricité…</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-bold text-emerald-500 block mb-1">
              Nature du transfert (obligatoire) *
            </label>
            <Input
              value={nature}
              onChange={(e) => setNature(e.target.value)}
              placeholder="Ex: Loyer Novembre 2026 ou Facture d'eau SODECI Novembre 2026"
              required
            />
            <span className="text-[10px] text-muted-foreground mt-0.5 block">
              Cette mention apparaîtra immédiatement chez le propriétaire et validera
              automatiquement votre paiement.
            </span>
          </div>

          <div>
            <label className="font-semibold block mb-1">Montant à transférer (FCFA) *</label>
            <Input
              type="number"
              min="100"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
              required
              className="text-sm font-black"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <ArrowUpRight className="size-4 mr-1" />
              Transférer {amount.toLocaleString('fr-FR')} FCFA au Propriétaire
            </Button>
          </div>
        </form>
      </div>
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
  const { user } = useSession();
  const resolved = useResolvedTenantProfile(user?.email, user?.displayName);
  const walletKey = resolved.email || resolved.tenantId;

  const [quittances, setQuittances] = useState<QuittanceItem[]>(() => getStoredQuittances());
  const [wallet, setWallet] = useState<WalletState>(() => getTenantWallet(walletKey));
  const [selectedQuittanceToPay, setSelectedQuittanceToPay] = useState<QuittanceItem | null>(null);
  const [walletTransferQuittance, setWalletTransferQuittance] = useState<QuittanceItem | null>(
    null,
  );
  const [depositOpen, setDepositOpen] = useState(false);
  const [activeQuittanceForPrint, setActiveQuittanceForPrint] = useState<QuittanceItem | null>(
    null,
  );

  const reload = () => {
    setQuittances(getStoredQuittances());
    setWallet(getTenantWallet(walletKey));
  };

  const pendingBills = quittances.filter((q) => q.status === 'PENDING');
  const paidBills = quittances.filter((q) => q.status === 'PAID');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Quittances et Factures"
        description="Réglez vos factures d'eau (SODECI), d'électricité (CIE) et charges en transférant votre solde depuis votre Portefeuille Locataire vers le Portefeuille du Propriétaire (validation automatique dans les délais) ou par Mobile Money."
        actions={
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 px-3 py-1.5 text-xs font-black">
              Mon Portefeuille : {wallet.balance.toLocaleString('fr-FR')} FCFA
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDepositOpen(true)}
              className="text-xs font-bold border-emerald-500/40 text-emerald-500"
            >
              <Plus className="size-3.5 mr-1" />
              Faire un dépôt
            </Button>
          </div>
        }
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
                Vous avez {pendingBills.length} quittance(s) / facture(s) en attente de règlement
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
          <span>Factures & Quittances à régler (Eau, Électricité & Charges)</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-500">
            {pendingBills.length}
          </span>
        </h3>

        {pendingBills.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-border bg-card/40 text-center text-sm text-muted-foreground">
            Toutes vos quittances et factures sont payées dans les délais ! Aucune charge en
            attente.
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

                  <div className="pt-2 border-t border-border space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Montant à régler :
                      </span>
                      <strong className="text-base font-black text-emerald-500">
                        {q.amountMinor.toLocaleString('fr-FR')} FCFA
                      </strong>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <Button
                        onClick={() => setWalletTransferQuittance(q)}
                        className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-sm flex items-center justify-center gap-1.5"
                      >
                        <Wallet className="size-3.5" />
                        Payer par Portefeuille
                      </Button>

                      <Button
                        variant="outline"
                        onClick={() => setSelectedQuittanceToPay(q)}
                        className="font-bold text-xs flex items-center justify-center gap-1.5"
                      >
                        <Smartphone className="size-3.5" />
                        Mobile Money direct
                      </Button>
                    </div>
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
          <span>Quittances réglées dans les délais & Reçus officiels</span>
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
                <th className="px-4 py-3 font-semibold text-xs">Statut & Mode</th>
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
                      {q.paymentMethod || 'Payé dans les délais'}
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

      {/* Modal Dépôt Portefeuille */}
      {depositOpen && (
        <TenantWalletDepositModal
          walletKey={walletKey}
          onClose={() => setDepositOpen(false)}
          onSuccess={() => {
            reload();
            setDepositOpen(false);
            toast({ title: 'Portefeuille rechargé avec succès !', variant: 'success' });
          }}
        />
      )}

      {/* Modal Transfert depuis le Portefeuille Locataire vers le Portefeuille du Propriétaire */}
      {walletTransferQuittance && (
        <TenantWalletTransferModal
          walletKey={walletKey}
          walletBalance={wallet.balance}
          tenantProfile={resolved}
          initialCategory="QUITTANCE"
          preselectedQuittance={walletTransferQuittance}
          onClose={() => setWalletTransferQuittance(null)}
          onSuccess={(_cat, nature, amount) => {
            reload();
            setWalletTransferQuittance(null);
            toast({
              title: 'Facture payée dans les délais via votre Portefeuille !',
              description: `${amount.toLocaleString('fr-FR')} FCFA transférés au propriétaire (${nature}). La quittance est automatiquement marquée comme payée.`,
              variant: 'success',
            });
          }}
        />
      )}

      {/* Modal Paiement iKeepay direct */}
      {selectedQuittanceToPay && (
        <IkeepayModal
          isOpen={Boolean(selectedQuittanceToPay)}
          onClose={() => setSelectedQuittanceToPay(null)}
          amount={selectedQuittanceToPay.amountMinor}
          purpose="RENT_PAYMENT"
          title={`Paiement : ${selectedQuittanceToPay.typeLabel}`}
          description={`Règlement Mobile Money de la quittance ${selectedQuittanceToPay.number} (${selectedQuittanceToPay.period}) pour un montant de ${selectedQuittanceToPay.amountMinor.toLocaleString('fr-FR')} FCFA.`}
          onPaymentSuccess={() => {
            markQuittanceAsPaid(selectedQuittanceToPay._id, 'Payé dans les délais (Mobile Money)');
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
              <Badge className="bg-emerald-500 text-white font-bold">RÉGLÉE DANS LES DÉLAIS</Badge>
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
                  {activeQuittanceForPrint.paymentMethod || 'Portefeuille / Mobile Money'}
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
  const resolved = useResolvedTenantProfile(user?.email, user?.displayName);
  const [contractModalOpen, setContractModalOpen] = useState(false);

  const certifiedContract: LeaseContractData = {
    leaseNumber: 'BAIL-2026-0042',
    propertyName: resolved.propertyName,
    propertyAddress: resolved.propertyAddress,
    propertyZone: resolved.propertyZone,
    propertyCity: resolved.propertyCity,
    unitName: resolved.unitName,
    unitType: resolved.unitType,
    unitNumber: resolved.unitNumber,
    floor: 1,
    tenantName: resolved.fullName,
    tenantPhone: resolved.phone,
    tenantEmail: resolved.email,
    ownerName: 'M. Amadou Diallo (Bailleur KatdEstate)',
    ownerPhone: '+225 07 10 20 30 40',
    ownerEmail: 'proprietaire@katdestate.immo',
    startDate: resolved.leaseStartDate,
    endDate: resolved.leaseEndDate,
    dueDay: resolved.dueDay,
    rentAmountMinor: resolved.rentAmount,
    chargesAmountMinor: 5000,
    depositAmountMinor: resolved.advanceAmount || resolved.rentAmount * 2,
    currency: 'FCFA',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mon Contrat de Bail Numérique"
        description="Votre bail d'habitation certifié établi par votre propriétaire, conforme aux normes KatdEstate."
      />

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
                {certifiedContract.unitName} ({certifiedContract.unitNumber})
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
              Avance / Caution :{' '}
              {(certifiedContract.depositAmountMinor ?? 0).toLocaleString('fr-FR')} FCFA
            </p>
          </div>
        </div>
      </div>

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
  const base = useOrgPath();
  const { toast } = useToast();
  const { data } = useOrgQuery<Row[]>(['portal-documents'], '/portal/documents');
  const rows = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Mes documents" description="Documents déposés sur votre dossier." />
      {rows.length === 0 ? (
        <EmptyState
          title="Aucun document disponible"
          description="Vos documents déposés apparaîtront ici et seront téléchargeables."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={String(row._id)}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {String(row.originalName ?? 'Document')}
                </p>
                <p className="text-xs text-muted-foreground">{date(row.createdAt)}</p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 inline-flex items-center gap-1.5"
                onClick={() => {
                  const filename = String(row.originalName ?? 'document.pdf');
                  downloadFile(`${base}/files/${String(row._id)}`, filename).catch((err: Error) =>
                    toast({
                      title: 'Téléchargement impossible',
                      description: err.message,
                      variant: 'error',
                    }),
                  );
                }}
              >
                <Download className="size-3.5" />
                Télécharger
              </Button>
            </div>
          ))}
        </div>
      )}
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

// ============================================================================
// MESSAGERIE INTERACTIVE LOCATAIRE <-> PROPRIÉTAIRE
// ============================================================================
export function PortalMessagesPage() {
  const { user } = useSession();
  const { toast } = useToast();
  const resolved = useResolvedTenantProfile(user?.email, user?.displayName);

  const [threads, setThreads] = useState<ChatThread[]>(() => getStoredChatThreads());
  const [open, setOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => getStoredChatThreads()[0]?._id || null,
  );

  const reloadThreads = () => {
    setThreads(getStoredChatThreads());
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Messagerie avec mon Propriétaire"
        description={`Échangez directement par message avec votre propriétaire au sujet de votre logement (${resolved.unitNumber} - ${resolved.propertyName}).`}
        actions={
          <Button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5">
            <Send className="size-3.5" />
            Nouveau message au propriétaire
          </Button>
        }
      />

      {open && (
        <form
          className="space-y-3 rounded-2xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const subject = String(form.get('subject') || '').trim();
            const category = String(form.get('category') || 'GENERAL');
            const body = String(form.get('body') || '').trim();
            if (!subject || !body) return;

            const created = createLocalChatThread({
              subject,
              body,
              category,
              senderName: `${resolved.fullName} (Locataire)`,
              senderRole: 'TENANT',
              tenantId: resolved.tenantId,
              tenantName: resolved.fullName,
              tenantEmail: resolved.email,
              propertyName: resolved.propertyName,
              unitName: resolved.unitNumber,
              recipientName: 'Propriétaire (Bailleur)',
            });
            reloadThreads();
            setActiveThreadId(created._id);
            setOpen(false);
            toast({
              title: 'Message envoyé au propriétaire !',
              description: 'Votre propriétaire a reçu votre message dans sa messagerie.',
              variant: 'success',
            });
          }}
        >
          <Input name="subject" placeholder="Sujet de votre message (ex: Paiement loyer, Eau…)" required />
          <select
            name="category"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="GENERAL">Question générale</option>
            <option value="PAYMENT">Loyer, Portefeuille et Quittances</option>
            <option value="MAINTENANCE">Maintenance et réparations</option>
            <option value="LEASE">Contrat de location</option>
          </select>
          <textarea
            name="body"
            rows={4}
            placeholder="Écrivez votre message à destination de votre propriétaire…"
            required
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Envoyer au propriétaire</Button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {threads.map((msg) => (
          <div key={msg._id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm text-foreground">{msg.subject}</p>
                <p className="text-xs text-muted-foreground">
                  De <strong>{msg.senderName}</strong> ·{' '}
                  {new Date(msg.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <Button
                variant="secondary"
                className="h-8 px-3 text-xs font-semibold"
                onClick={() => setActiveThreadId(activeThreadId === msg._id ? null : msg._id)}
              >
                {activeThreadId === msg._id ? 'Masquer la discussion' : 'Répondre / Voir le fil'}
              </Button>
            </div>

            <p className="text-xs text-foreground bg-muted/30 rounded-xl p-3 whitespace-pre-wrap">
              {msg.body}
            </p>

            {activeThreadId === msg._id && (
              <div className="pt-2 border-t border-border/60 space-y-3">
                {(msg.replies ?? []).map((r, i) => (
                  <div
                    key={i}
                    className={`rounded-xl p-3 text-xs ${
                      r.senderRole === 'TENANT'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 ml-4'
                        : 'bg-primary/10 border border-primary/20 mr-4'
                    }`}
                  >
                    <div className="flex justify-between mb-1">
                      <p className="font-bold text-foreground">{r.senderName}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <p className="text-foreground whitespace-pre-wrap">{r.body}</p>
                  </div>
                ))}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!replyText.trim()) return;
                    replyToLocalChatThread(msg._id, {
                      senderName: `${resolved.fullName} (Locataire ${resolved.unitNumber})`,
                      senderRole: 'TENANT',
                      body: replyText.trim(),
                    });
                    reloadThreads();
                    setReplyText('');
                    toast({ title: 'Réponse envoyée au propriétaire', variant: 'success' });
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Écrire votre réponse au propriétaire…"
                    className="h-9 text-xs"
                  />
                  <Button type="submit" className="h-9 px-4 text-xs font-bold">
                    Envoyer
                  </Button>
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
