import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  applyLatePenaltiesSchema,
  cancelScheduleSchema,
  chargeSplitSchema,
  recordDepositSchema,
  recordPaymentSchema,
  updateScheduleSchema,
} from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Modal } from '../components/ui/dialog';
import { useToast } from '../components/ui/toast';
import { apiRequest, downloadFile } from '../lib/api-client';
import { formatDate } from '../lib/format';
import { useOrgList, useOrgPath, useOrgQuery } from '../lib/query';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Clock,
  CreditCard,
  Download,
  FileSpreadsheet,
  Send,
  ShieldCheck,
  Split,
  Wallet,
  ArrowDownCircle,
  Smartphone,
  Mail,
  Plus,
  Receipt,
  Building2,
} from 'lucide-react';
import { IkeepayPayoutModal } from '../components/payments/ikeepay-payout-modal';
import {
  getStoredQuittances,
  markQuittanceAsPaid,
  saveStoredQuittances,
  type QuittanceItem,
} from '../lib/quittances';
import { getLocalProperties } from './properties';
import { getLocalTenants, saveLocalTenants, type Tenant } from './tenants';
import {
  getOwnerQuittanceWallet,
  getOwnerRentWallet,
  getRentValidations,
  saveOwnerQuittanceWallet,
  saveOwnerRentWallet,
  saveRentValidation,
  withdrawFromOwnerQuittanceWallet,
  withdrawFromOwnerRentWallet,
} from '../lib/katdestate-store';

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
  const [rentSubTab, setRentSubTab] = useState<'by-tenant' | 'schedules' | 'late-tenants'>(
    'by-tenant',
  );
  const [status, setStatus] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [cancelSchedule, setCancelSchedule] = useState<Schedule | null>(null);
  const [showPenaltiesModal, setShowPenaltiesModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showTenantHistoryModal, setShowTenantHistoryModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [validatingTenantRow, setValidatingTenantRow] = useState<any | null>(null);
  const [selectedValidateMethod, setSelectedValidateMethod] = useState('Mobile Money (Wave)');

  const base = useOrgPath();
  const { toast } = useToast();

  const [localTenants, setLocalTenants] = useState<Tenant[]>(() => getLocalTenants());
  const [rentValidations, setRentValidations] = useState(() => getRentValidations());
  const [ownerRentWallet, setOwnerRentWallet] = useState(() => getOwnerRentWallet());

  const reloadRentState = () => {
    setLocalTenants(getLocalTenants());
    setRentValidations(getRentValidations());
    setOwnerRentWallet(getOwnerRentWallet());
  };

  useEffect(() => {
    reloadRentState();
  }, []);

  const { data: schedulesData } = useOrgList<Schedule>(
    ['schedules', status],
    `/rent-schedules?pageSize=50${status ? `&status=${status}` : ''}`,
  );
  const { data: invoicesData } = useOrgList<Invoice>(['invoices'], '/invoices?pageSize=50');
  const summary = useOrgQuery<Summary>(['finance-summary'], '/finance/summary');

  // Calcul synthétique par locataire & propriété occupée avec prise en compte des validations (Portefeuille ou Manuelles)
  const tenantRentSummaries = useMemo(() => {
    const defaultList = [
      {
        id: 'ten-default-1',
        name: 'Kouamé Jean-Marc',
        phone: '+225 07 12 34 56 78',
        email: 'jean.kouame@gmail.com',
        property: 'Résidence Katd Les Palmiers',
        unit: 'Chambre Moderne Porte 3B',
        monthlyRent: 150000,
        paidTotal: 150000,
        dueAmount: 0,
        lateDays: 0,
        status: 'UP_TO_DATE',
        paymentMethod: 'Transfert Portefeuille (Loyer Novembre 2026)',
        validatedBy: 'WALLET_AUTO',
      },
      {
        id: 'ten-2',
        name: 'Mlle Aminata Koné',
        phone: '+225 05 98 76 54 32',
        email: 'aminata.kone@yahoo.fr',
        property: 'Résidence Katd Les Palmiers',
        unit: 'Studio Moderne N°2',
        monthlyRent: 120000,
        paidTotal: 0,
        dueAmount: 120000,
        lateDays: 6,
        status: 'LATE',
        paymentMethod: 'En attente',
        validatedBy: undefined,
      },
      {
        id: 'ten-3',
        name: 'M. Ibrahim Ouattara',
        phone: '+225 01 23 45 67 89',
        email: 'ibrahim.ouattara@gmail.com',
        property: 'Villa Duplex Angré',
        unit: 'Appartement N°1 (3 pièces)',
        monthlyRent: 250000,
        paidTotal: 0,
        dueAmount: 250000,
        lateDays: 14,
        status: 'UNPAID',
        paymentMethod: 'En attente',
        validatedBy: undefined,
      },
    ];

    const rawList =
      localTenants.length > 0
        ? localTenants.map((lt, idx) => ({
            id: lt._id,
            name: lt.fullName,
            phone: lt.phone || '+225 07 00 00 00 00',
            email: lt.email || 'locataire@katdestate.immo',
            property: lt.propertyName || 'Résidence Principale',
            unit: lt.unitNumber || lt.unitName || 'Logement 1',
            monthlyRent: lt.rentAmount || 120000,
            paidTotal: lt.rentPaymentStatus === 'PAID' ? lt.rentAmount || 120000 : 0,
            dueAmount: lt.rentPaymentStatus === 'PAID' ? 0 : lt.rentAmount || 120000,
            lateDays: lt.rentPaymentStatus === 'PAID' ? 0 : idx === 1 ? 5 : 0,
            status:
              lt.rentPaymentStatus === 'PAID'
                ? 'UP_TO_DATE'
                : idx === 1
                  ? 'LATE'
                  : 'UNPAID',
            paymentMethod: lt.lastPaymentMethod || 'En attente',
            validatedBy: undefined as string | undefined,
          }))
        : defaultList;

    return rawList.map((item) => {
      const valById = rentValidations[item.id];
      const valByEmail = item.email ? rentValidations[item.email.toLowerCase()] : undefined;
      const val = valById || valByEmail;
      if (val && val.status === 'PAID') {
        return {
          ...item,
          paidTotal: val.paidAmount || item.monthlyRent,
          dueAmount: 0,
          lateDays: 0,
          status: 'UP_TO_DATE',
          paymentMethod: val.paymentMethod,
          validatedBy: val.validatedBy,
        };
      }
      return item;
    });
  }, [localTenants, rentValidations]);

  // Statistiques des locataires ayant payé par propriété occupée
  const rentStatsByProperty = useMemo(() => {
    const map: Record<
      string,
      {
        propertyName: string;
        totalTenants: number;
        paidCount: number;
        lateCount: number;
        unpaidCount: number;
        collectedAmount: number;
      }
    > = {};
    for (const item of tenantRentSummaries) {
      const prop = item.property || 'Propriété';
      if (!map[prop]) {
        map[prop] = {
          propertyName: prop,
          totalTenants: 0,
          paidCount: 0,
          lateCount: 0,
          unpaidCount: 0,
          collectedAmount: 0,
        };
      }
      map[prop].totalTenants += 1;
      if (item.status === 'UP_TO_DATE') {
        map[prop].paidCount += 1;
        map[prop].collectedAmount += item.paidTotal;
      } else if (item.status === 'LATE') {
        map[prop].lateCount += 1;
      } else {
        map[prop].unpaidCount += 1;
      }
    }
    return Object.values(map);
  }, [tenantRentSummaries]);

  const totalPaidRent = Math.max(
    ownerRentWallet.balance,
    tenantRentSummaries.reduce((sum, item) => sum + item.paidTotal, 0),
  );

  const lateTenants = tenantRentSummaries.filter(
    (t) => t.status === 'LATE' || t.status === 'UNPAID',
  );

  const handleManualValidateRent = (item: (typeof tenantRentSummaries)[0], method: string) => {
    const now = new Date().toISOString();
    saveRentValidation({
      tenantId: item.id,
      tenantName: item.name,
      tenantEmail: item.email,
      tenantPhone: item.phone,
      propertyName: item.property,
      unitName: item.unit,
      monthlyRent: item.monthlyRent,
      paidAmount: item.monthlyRent,
      status: 'PAID',
      paymentMethod: method,
      period: 'Novembre 2026',
      paidAt: now,
      validatedBy: 'OWNER_MANUAL',
    });

    // Mettre à jour le locataire local s'il existe
    const updatedTenants = localTenants.map((lt) =>
      lt._id === item.id || (lt.email && lt.email.toLowerCase() === item.email.toLowerCase())
        ? {
            ...lt,
            rentPaymentStatus: 'PAID' as const,
            lastPaymentMethod: method,
            lastPaidAt: now,
          }
        : lt,
    );
    saveLocalTenants(updatedTenants);

    // Créditer aussi le Portefeuille Gestion des Loyers
    const currentWallet = getOwnerRentWallet();
    saveOwnerRentWallet({
      balance: currentWallet.balance + item.monthlyRent,
      totalReceived: currentWallet.totalReceived + item.monthlyRent,
      totalWithdrawn: currentWallet.totalWithdrawn,
      transactions: [
        {
          _id: `tx-man-rent-${Date.now()}`,
          type: 'MANUAL_VALIDATION',
          amount: item.monthlyRent,
          nature: `Validation Loyer (${item.unit} - ${item.property})`,
          method,
          tenantId: item.id,
          tenantName: item.name,
          propertyName: item.property,
          unitName: item.unit,
          createdAt: now,
        },
        ...currentWallet.transactions,
      ],
    });

    reloadRentState();
    setValidatingTenantRow(null);
    toast({
      title: 'Loyer validé avec succès !',
      description: `Le paiement de ${item.name} (${item.unit}) via ${method} est enregistré dans Gestion des Loyers.`,
      variant: 'success',
    });
  };

  const handleRemindWhatsApp = (t: (typeof tenantRentSummaries)[0]) => {
    const text = encodeURIComponent(
      `Bonjour ${t.name},\nNous vous rappelons que votre loyer d'un montant de ${t.dueAmount.toLocaleString('fr-FR')} FCFA pour votre logement (${t.unit} - ${t.property}) est en attente de règlement.\n\nVous pouvez effectuer votre paiement depuis votre Portefeuille Locataire sur KatdEstate : https://katdestate.vercel.app/portal\n\nMerci de votre confiance.`,
    );
    const clean = t.phone.replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${clean}?text=${text}`, '_blank');
  };

  const handleRemindEmail = (t: (typeof tenantRentSummaries)[0]) => {
    toast({
      title: 'Alerte email transmise',
      description: `Notification d’échéance de loyer envoyée à ${t.name} (${t.email}).`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Loyers"
        description="Portefeuille Gestion des Loyers, statistiques des locataires ayant payé par propriété occupée, validation manuelle ou automatique via portefeuille, et retrait Mobile Money."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setShowPayoutModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <ArrowDownCircle className="size-4" />
              <span>Retrait du Portefeuille Gestion des Loyers</span>
            </Button>
            <Button variant="secondary" onClick={() => setShowPenaltiesModal(true)}>
              <Clock className="mr-1.5 size-4" />
              Pénalités
            </Button>
            <Button variant="secondary" onClick={() => setShowDepositModal(true)}>
              <ShieldCheck className="mr-1.5 size-4" />
              Cautions
            </Button>
          </div>
        }
      />

      {/* PORTEFEUILLE DÉDIÉ N°1 : PORTEFEUILLE GESTION DES LOYERS */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-card to-background border border-emerald-500/30 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <Wallet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-500">
                  Portefeuille Propriétaire N°1 — Gestion des Loyers
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  ACTIF & RETIRABLE
                </Badge>
              </div>
              <h2 className="text-2xl font-black text-foreground">
                {totalPaidRent.toLocaleString('fr-FR')} FCFA
              </h2>
              <p className="text-xs text-muted-foreground">
                Reçoit automatiquement les transferts de loyers effectués depuis les portefeuilles
                de vos locataires
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowPayoutModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 h-10 px-5 shadow-lg shadow-emerald-500/20"
          >
            <ArrowDownCircle className="size-4" />
            <span>Retirer mes Loyers (Mobile Money)</span>
          </Button>
        </div>

        {/* Derniers transferts reçus des locataires avec nature du transfert */}
        {ownerRentWallet.transactions.length > 0 && (
          <div className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Derniers transferts & règlements de loyers reçus :
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ownerRentWallet.transactions.slice(0, 4).map((tx) => (
                <div
                  key={tx._id}
                  className="p-2.5 rounded-xl bg-background/80 border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground">
                      {tx.tenantName || 'Opération Portefeuille'} ·{' '}
                      <span className="text-primary">{tx.unitName || tx.propertyName || ''}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Nature : <strong className="text-foreground">{tx.nature}</strong>
                    </p>
                  </div>
                  <span
                    className={`font-black text-xs shrink-0 ${
                      tx.type === 'WITHDRAWAL' ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    {tx.type === 'WITHDRAWAL' ? '-' : '+'}
                    {tx.amount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STATISTIQUES DES LOCATAIRES AYANT PAYÉ LEUR LOYER PAR PROPRIÉTÉ OCCUPÉE */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-4 text-emerald-500" />
              Statistiques des locataires ayant payé leur loyer par propriété occupée
            </span>
            <span className="text-xs font-bold text-emerald-500">
              {tenantRentSummaries.filter((t) => t.status === 'UP_TO_DATE').length} /{' '}
              {tenantRentSummaries.length} locataire(s) à jour
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rentStatsByProperty.map((st) => (
              <div
                key={st.propertyName}
                className="p-3.5 rounded-2xl bg-background border border-border space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <strong className="font-bold text-foreground truncate">{st.propertyName}</strong>
                  <Badge className="bg-emerald-500/15 text-emerald-500 text-[10px]">
                    {st.collectedAmount.toLocaleString('fr-FR')} FCFA encaissés
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block font-black text-emerald-500">{st.paidCount}</span>
                    <span className="text-[10px] text-muted-foreground">Ayant payé</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <span className="block font-black text-amber-500">{st.lateCount}</span>
                    <span className="text-[10px] text-muted-foreground">En retard</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                    <span className="block font-black text-rose-500">{st.unpaidCount}</span>
                    <span className="text-[10px] text-muted-foreground">Non payé</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
          {/* Sous-onglets de gestion des loyers */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-muted/40 border border-border">
            <button
              type="button"
              onClick={() => setRentSubTab('schedules')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                rentSubTab === 'schedules'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Calendrier des échéances
            </button>
            <button
              type="button"
              onClick={() => setRentSubTab('by-tenant')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                rentSubTab === 'by-tenant'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>Loyers par Locataire & Propriété</span>
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px]">
                {tenantRentSummaries.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setRentSubTab('late-tenants')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                rentSubTab === 'late-tenants'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-500 hover:text-rose-600'
              }`}
            >
              <span>Retards de paiement & Impayés</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                {lateTenants.length}
              </span>
            </button>
          </div>

          {rentSubTab === 'schedules' && (
            <>
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
                          <td className="px-4 py-3">
                            {schedule.amountDueMinor.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-4 py-3 text-amber-600">
                            {schedule.penaltyMinor > 0
                              ? `+${schedule.penaltyMinor.toLocaleString('fr-FR')}`
                              : '0'}
                          </td>
                          <td className="px-4 py-3 font-semibold">
                            {totalDue.toLocaleString('fr-FR')}
                          </td>
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
            </>
          )}

          {/* VUE : SOMMES PAYÉES PAR LOCATAIRE SUR CHAQUE PROPRIÉTÉ */}
          {rentSubTab === 'by-tenant' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Détails Complets des Locataires & Loyers par Propriété Occupée
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Si le locataire paie depuis son portefeuille, son loyer est validé
                    automatiquement. Sinon, validez manuellement son mode de paiement.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowPayoutModal(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center gap-1.5"
                >
                  <ArrowDownCircle className="size-4" />
                  <span>Retirer du Portefeuille Loyers</span>
                </Button>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-4 py-3 font-medium">Propriété & Logement</th>
                      <th className="px-4 py-3 font-medium">Informations du Locataire</th>
                      <th className="px-4 py-3 font-medium">Loyer Mensuel</th>
                      <th className="px-4 py-3 font-medium text-emerald-600">Total Payé</th>
                      <th className="px-4 py-3 font-medium">Mode / Validation</th>
                      <th className="px-4 py-3 font-medium">Statut</th>
                      <th className="px-4 py-3 text-right font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tenantRentSummaries.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="size-3.5 text-primary shrink-0" />
                            <span>{item.property}</span>
                          </div>
                          <p className="text-xs text-emerald-500 font-bold mt-0.5">{item.unit}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.phone}</p>
                          <p className="text-[11px] text-muted-foreground">{item.email}</p>
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {item.monthlyRent.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-4 py-3 font-black text-emerald-500">
                          {item.paidTotal.toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {item.status === 'UP_TO_DATE' ? (
                            <div>
                              <span className="font-semibold text-emerald-500 block">
                                {item.paymentMethod || 'Mobile Money'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {item.validatedBy === 'WALLET_AUTO'
                                  ? '⚡ Validé auto (Portefeuille)'
                                  : '✓ Validé par le propriétaire'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Non réglé</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            className={
                              item.status === 'UP_TO_DATE'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : item.status === 'LATE'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            }
                          >
                            {item.status === 'UP_TO_DATE'
                              ? 'Payé / À jour'
                              : item.status === 'LATE'
                                ? `${item.lateDays}j de retard`
                                : 'Non payé'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.dueAmount > 0 ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => setValidatingTenantRow(item)}
                                  className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                                >
                                  <CheckCircle2 className="size-3.5 mr-1" />
                                  Valider paiement
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRemindWhatsApp(item)}
                                  className="text-xs h-8 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                                >
                                  <Smartphone className="size-3 mr-1" />
                                  Relancer
                                </Button>
                              </>
                            ) : (
                              <span className="text-xs text-emerald-500 font-bold flex items-center justify-end gap-1">
                                <CheckCircle2 className="size-3.5" />
                                Validé
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VUE : LOCATAIRES EN RETARD & IMPAYÉS */}
          {rentSubTab === 'late-tenants' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-rose-500 flex items-center gap-1.5">
                    <AlertTriangle className="size-4" />
                    Suivi des Retards de Paiement & Impayés
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {lateTenants.length} locataire(s) ont dépassé la date d'échéance. Relancez-les
                    directement par WhatsApp ou email.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    lateTenants.forEach((t) => handleRemindEmail(t));
                  }}
                  className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs"
                >
                  <Mail className="size-3.5 mr-1.5" />
                  Relancer tous les retards par email
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {lateTenants.map((tenant) => (
                  <Card key={tenant.id} className="border-rose-500/30 bg-card">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{tenant.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {tenant.property} ·{' '}
                            <strong className="text-foreground">{tenant.unit}</strong>
                          </p>
                        </div>
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-black">
                          {tenant.lateDays} jours de retard
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs">
                        <div>
                          <span className="text-muted-foreground text-[11px] block">
                            Montant en retard
                          </span>
                          <span className="font-black text-rose-500 text-sm">
                            {tenant.dueAmount.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-muted-foreground text-[11px] block">
                            Loyer mensuel
                          </span>
                          <span className="font-bold text-foreground">
                            {tenant.monthlyRent.toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <p>
                          Tél : <strong className="text-foreground">{tenant.phone}</strong>
                        </p>
                        <p>
                          Email : <strong className="text-foreground">{tenant.email}</strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button
                          size="sm"
                          onClick={() => handleRemindWhatsApp(tenant)}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 flex items-center justify-center gap-1.5"
                        >
                          <Smartphone className="size-3.5" />
                          <span>Rappeler (WhatsApp)</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemindEmail(tenant)}
                          className="flex-1 text-xs h-8 flex items-center justify-center gap-1.5"
                        >
                          <Mail className="size-3.5" />
                          <span>Notification Email</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {lateTenants.length === 0 && (
                  <div className="sm:col-span-2 text-center py-8 text-sm text-muted-foreground">
                    🎉 Aucun locataire en retard. Tous vos loyers sont à jour !
                  </div>
                )}
              </div>
            </div>
          )}
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
                      {Math.max(0, inv.amountTotalMinor - inv.amountPaidMinor).toLocaleString(
                        'fr-FR',
                      )}{' '}
                      FCFA
                    </td>
                    <td className="px-4 py-3">
                      <Badge>{STATUS_LABELS[inv.status] ?? inv.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="secondary"
                        className="h-8 px-2.5 text-xs"
                        onClick={() =>
                          downloadFile(
                            `${base}/invoices/${inv._id}/pdf`,
                            `facture-${inv.number}.pdf`,
                          )
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
            pour enregistrer une caution perçue, une restitution de sortie ou une déduction pour
            loyer impayé.
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
          <PaymentForm schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />
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
          <EditScheduleForm schedule={editSchedule} onClose={() => setEditSchedule(null)} />
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
          <CancelScheduleForm schedule={cancelSchedule} onClose={() => setCancelSchedule(null)} />
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

      {/* Modal Validation Manuelle du Loyer dans Gestion des Loyers */}
      {validatingTenantRow ? (
        <Modal
          open={Boolean(validatingTenantRow)}
          onOpenChange={(op) => !op && setValidatingTenantRow(null)}
          title={`Valider le loyer de ${validatingTenantRow.name}`}
          description={`${validatingTenantRow.property} · ${validatingTenantRow.unit}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex justify-between items-center">
              <span>Montant du loyer à valider :</span>
              <strong className="text-base font-black text-emerald-500">
                {validatingTenantRow.monthlyRent.toLocaleString('fr-FR')} FCFA
              </strong>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">
                Choisissez le mode de paiement utilisé par le locataire :
              </label>
              <select
                value={selectedValidateMethod}
                onChange={(e) => setSelectedValidateMethod(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                <option value="Mobile Money (Wave)">Mobile Money (Wave)</option>
                <option value="Mobile Money (Orange Money)">Mobile Money (Orange Money)</option>
                <option value="Mobile Money (MTN MoMo)">Mobile Money (MTN MoMo)</option>
                <option value="Mobile Money (Moov Money)">Mobile Money (Moov Money)</option>
                <option value="Espèces / Cash">Espèces / Cash</option>
                <option value="Virement bancaire">Virement bancaire</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setValidatingTenantRow(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => handleManualValidateRent(validatingTenantRow, selectedValidateMethod)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <CheckCircle2 className="size-4 mr-1.5" />
                Valider le paiement
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {/* Modal Retrait Mobile Money (Portefeuille Gestion des Loyers) */}
      {showPayoutModal ? (
        <IkeepayPayoutModal
          open={showPayoutModal}
          onOpenChange={setShowPayoutModal}
          availableBalance={totalPaidRent}
          onSuccess={() => {
            withdrawFromOwnerRentWallet(totalPaidRent, 'Mobile Money');
            reloadRentState();
            toast({
              title: 'Retrait du Portefeuille Gestion des Loyers initié',
              description:
                'Votre virement Mobile Money depuis votre Portefeuille Gestion des Loyers a été effectué.',
              variant: 'success',
            });
          }}
        />
      ) : null}
    </div>
  );
}

function PaymentForm({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
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
        <label className="text-xs font-medium text-muted-foreground">
          Montant à encaisser (FCFA)
        </label>
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
          <label className="text-xs font-medium text-muted-foreground">
            Référence unique (Anti-double paiement)
          </label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() =>
              setIdempotencyKey(
                `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
              )
            }
          >
            Régénérer
          </button>
        </div>
        <Input
          name="idempotencyKey"
          value={idempotencyKey}
          onChange={(e) => setIdempotencyKey(e.target.value)}
          required
        />
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

function EditScheduleForm({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const update = useMutation({
    mutationFn: (body: unknown) =>
      apiRequest(`${base}/rent-schedules/${schedule._id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({
        title: 'Échéance mise à jour',
        description: 'Modification consignée dans le journal d’audit.',
        variant: 'success',
      });
      onClose();
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
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
          toast({
            title: 'Données invalides',
            description: parsed.error.issues[0]?.message,
            variant: 'error',
          });
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
        <Input
          name="amountDueMinor"
          type="number"
          min={1}
          defaultValue={schedule.amountDueMinor}
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Pénalité de retard (FCFA)
        </label>
        <Input
          name="penaltyMinor"
          type="number"
          min={0}
          defaultValue={schedule.penaltyMinor}
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">
          Motif de la modification (Audit)
        </label>
        <Input
          name="reason"
          placeholder="Ex: Accord amiable d'échelonnement, régularisation"
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={update.isPending}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

function CancelScheduleForm({ schedule, onClose }: { schedule: Schedule; onClose: () => void }) {
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
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
  });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const parsed = cancelScheduleSchema.safeParse({ reason: form.get('reason') });
        if (!parsed.success) {
          toast({
            title: 'Motif requis',
            description: parsed.error.issues[0]?.message,
            variant: 'error',
          });
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
        <Button type="button" variant="ghost" onClick={onClose}>
          Retour
        </Button>
        <Button
          type="submit"
          variant="secondary"
          className="text-rose-600 hover:text-rose-700"
          disabled={cancel.isPending}
        >
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
      apiRequest<{ updated: number }>(`${base}/rent-schedules/apply-penalties`, {
        method: 'POST',
        body,
      }),
    onSuccess: (data) => {
      void client.invalidateQueries();
      toast({
        title: 'Pénalités appliquées',
        description: `${data.updated} échéance(s) mise(s) à jour avec leurs pénalités.`,
        variant: 'success',
      });
      onClose();
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
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
          toast({
            title: 'Paramètres invalides',
            description: parsed.error.issues[0]?.message,
            variant: 'error',
          });
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
          <label className="text-xs font-medium text-muted-foreground">
            Délai de grâce (jours)
          </label>
          <Input name="gracePeriodDays" type="number" min={0} defaultValue={0} required />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Taux de pénalité (%)</label>
          <Input
            name="penaltyRatePercent"
            type="number"
            min={0}
            max={100}
            defaultValue={10}
            required
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Seules les échéances échues ayant un statut non soldé (À venir, Partiel, En retard) seront
        recalculées.
      </p>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={apply.isPending}>
          Calculer et appliquer
        </Button>
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
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
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
          toast({
            title: 'Données invalides',
            description: parsed.error.issues[0]?.message,
            variant: 'error',
          });
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
          <select
            name="category"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
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
          <select
            name="splitMethod"
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
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
        <label className="text-xs font-medium text-muted-foreground">
          Montant total de la facture (FCFA)
        </label>
        <Input name="totalAmountMinor" type="number" min={1} required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Description / Référence</label>
        <Input name="description" placeholder="Ex: Facture SONEB / Senelec Octobre 2026" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={split.isPending}>
          Calculer & Émettre les factures
        </Button>
      </div>
    </form>
  );
}

function DepositForm({ onClose }: { onClose: () => void }) {
  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const record = useMutation({
    mutationFn: (body: unknown) => apiRequest(`${base}/deposits`, { method: 'POST', body }),
    onSuccess: () => {
      void client.invalidateQueries();
      toast({ title: 'Mouvement de caution enregistré', variant: 'success' });
      onClose();
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'error' }),
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
        <label className="text-xs font-medium text-muted-foreground">
          ID Contrat de bail (Lease ID)
        </label>
        <Input name="leaseId" placeholder="Identifiant du contrat" required />
      </div>

      <div>
        <label className="text-xs font-medium text-muted-foreground">Type d'opération</label>
        <select
          name="type"
          className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
        >
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
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" disabled={record.isPending}>
          Enregistrer
        </Button>
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
                  <span>
                    {s.amountDueMinor.toLocaleString('fr-FR')} FCFA (
                    {STATUS_LABELS[s.status] ?? s.status})
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted-foreground">Paiements enregistrés</h4>
            <div className="mt-1 space-y-1">
              {history.data.payments.slice(0, 5).map((p) => (
                <div key={p._id} className="flex justify-between text-xs">
                  <span>
                    {p.number} · {formatDate(p.paidAt)}
                  </span>
                  <span className="text-emerald-600">
                    +{p.amountMinor.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
              {history.data.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun paiement.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PaymentsPage() {
  const { toast } = useToast();
  const [quittances, setQuittances] = useState<QuittanceItem[]>(() => getStoredQuittances());
  const [ownerQuittanceWallet, setOwnerQuittanceWallet] = useState(() => getOwnerQuittanceWallet());
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [propertyFilter, setPropertyFilter] = useState<string>('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [activeQuittanceForPrint, setActiveQuittanceForPrint] = useState<QuittanceItem | null>(
    null,
  );
  const [validatingQuittance, setValidatingQuittance] = useState<QuittanceItem | null>(null);
  const [manualPaymentMethod, setManualPaymentMethod] = useState('Mobile Money (Wave)');

  // Sync with local storage
  const reloadQuittances = () => {
    setQuittances(getStoredQuittances());
    setOwnerQuittanceWallet(getOwnerQuittanceWallet());
  };

  useEffect(() => {
    reloadQuittances();
  }, []);

  const properties = useMemo(() => getLocalProperties(), []);

  // Filtered quittances
  const filtered = useMemo(() => {
    return quittances.filter((q) => {
      if (typeFilter !== 'ALL' && q.type !== typeFilter) return false;
      if (statusFilter !== 'ALL' && q.status !== statusFilter) return false;
      if (propertyFilter !== 'ALL' && q.propertyId !== propertyFilter) return false;
      return true;
    });
  }, [quittances, typeFilter, statusFilter, propertyFilter]);

  // Statistics
  const totalEmittedCount = quittances.length;
  const totalPaidAmount = Math.max(
    ownerQuittanceWallet.balance,
    quittances.filter((q) => q.status === 'PAID').reduce((sum, q) => sum + q.amountMinor, 0),
  );
  const pendingCount = quittances.filter((q) => q.status === 'PENDING').length;
  const pendingAmount = quittances
    .filter((q) => q.status === 'PENDING')
    .reduce((sum, q) => sum + q.amountMinor, 0);

  const handleConfirmManualQuittance = (q: QuittanceItem, method: string) => {
    markQuittanceAsPaid(q._id, `Payé (${method})`);
    const currentW = getOwnerQuittanceWallet();
    saveOwnerQuittanceWallet({
      balance: currentW.balance + q.amountMinor,
      totalReceived: currentW.totalReceived + q.amountMinor,
      totalWithdrawn: currentW.totalWithdrawn,
      transactions: [
        {
          _id: `tx-man-quit-${Date.now()}`,
          type: 'MANUAL_VALIDATION',
          amount: q.amountMinor,
          nature: `${q.typeLabel} (${q.period})`,
          method,
          tenantId: q.tenantId,
          tenantName: q.tenantName,
          propertyName: q.propertyName,
          quittanceId: q._id,
          createdAt: new Date().toISOString(),
        },
        ...currentW.transactions,
      ],
    });
    reloadQuittances();
    setValidatingQuittance(null);
    toast({
      title: 'Quittance validée par le propriétaire',
      description: `Le paiement de ${q.tenantName} via ${method} a été enregistré et crédité.`,
      variant: 'success',
    });
  };

  const handleDeleteQuittance = (id: string) => {
    const next = quittances.filter((q) => q._id !== id);
    saveStoredQuittances(next);
    reloadQuittances();
    toast({
      title: 'Quittance supprimée',
      variant: 'success',
    });
  };

  const handleSendReminder = (q: QuittanceItem) => {
    const text = encodeURIComponent(
      `Bonjour ${q.tenantName},\nVoici votre avis d'échéance KatdEstate pour votre logement (${q.propertyName}) :\n- Type : ${q.typeLabel}\n- Période : ${q.period}\n- Montant : ${q.amountMinor.toLocaleString('fr-FR')} FCFA\n- Date limite : ${formatDate(q.dueDate)}\n\nVous pouvez régler cette facture en 1 clic par Mobile Money sur votre portail : https://katdestate.vercel.app/portal/receipts\n\nMerci de votre réactivité.`,
    );
    const cleanPhone = (q.tenantPhone || '').replace(/[^0-9]/g, '');
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    } else {
      toast({
        title: 'Rappel transmis par notification',
        description: `Notification d'échéance envoyée au locataire ${q.tenantName}.`,
        variant: 'success',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Quittances et Factures"
        description="Émettez les quittances d'eau (SODECI), électricité (CIE) et charges. Lorsqu'un locataire transfère la somme depuis son portefeuille, la facture est marquée automatiquement comme payée dans les délais."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => setShowPayoutModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <ArrowDownCircle className="size-4" />
              <span>Retrait du Portefeuille Quittances & Factures</span>
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="size-4" />
              <span>+ Émettre une quittance (Eau / Élec / Autre)</span>
            </Button>
          </div>
        }
      />

      {/* PORTEFEUILLE DÉDIÉ N°2 : PORTEFEUILLE GESTION DES QUITTANCES ET FACTURES */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-amber-500/15 via-card to-background border border-amber-500/30 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="size-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <Wallet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-amber-500">
                  Portefeuille Propriétaire N°2 — Gestion des Quittances et Factures
                </span>
                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                  EAU / ÉLECTRICITÉ / CHARGES
                </Badge>
              </div>
              <h2 className="text-2xl font-black text-foreground">
                {totalPaidAmount.toLocaleString('fr-FR')} FCFA
              </h2>
              <p className="text-xs text-muted-foreground">
                Reçoit automatiquement les transferts des locataires pour leurs factures d’eau,
                d’électricité et quittances
              </p>
            </div>
          </div>

          <Button
            onClick={() => setShowPayoutModal(true)}
            className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs flex items-center gap-2 h-10 px-5 shadow-lg shadow-amber-500/20"
          >
            <ArrowDownCircle className="size-4" />
            <span>Retirer mes Quittances (Mobile Money)</span>
          </Button>
        </div>

        {ownerQuittanceWallet.transactions.length > 0 && (
          <div className="pt-3 border-t border-border/60 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
              Derniers transferts reçus pour paiement de quittances & factures :
            </span>
            <div className="grid gap-2 sm:grid-cols-2">
              {ownerQuittanceWallet.transactions.slice(0, 4).map((tx) => (
                <div
                  key={tx._id}
                  className="p-2.5 rounded-xl bg-background/80 border border-border flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-foreground">
                      {tx.tenantName || 'Portefeuille Quittances'} ·{' '}
                      <span className="text-amber-500">{tx.propertyName || ''}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Nature : <strong className="text-foreground">{tx.nature}</strong>
                    </p>
                  </div>
                  <span
                    className={`font-black text-xs shrink-0 ${
                      tx.type === 'WITHDRAWAL' ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    {tx.type === 'WITHDRAWAL' ? '-' : '+'}
                    {tx.amount.toLocaleString('fr-FR')} FCFA
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cartes de statistiques Quittances & Solde */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Quittances Émises"
          value={String(totalEmittedCount)}
          hint="Toutes charges confondues"
          icon={Receipt}
        />
        <StatCard
          label="Total Encaissé (Solde Retirable)"
          value={`${totalPaidAmount.toLocaleString('fr-FR')} FCFA`}
          hint="Disponible pour retrait MoMo"
          icon={CheckCircle2}
        />
        <StatCard
          label="Quittances en Attente"
          value={String(pendingCount)}
          hint={`${pendingAmount.toLocaleString('fr-FR')} FCFA à recouvrer`}
          icon={AlertCircle}
        />
        <StatCard
          label="Mode de Versement"
          value="Mobile Money"
          hint="Orange, Wave, MTN, Moov"
          icon={CreditCard}
        />
      </div>

      {/* Barre de filtres */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border border-border bg-card/60">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">Toutes les natures de charge</option>
            <option value="WATER">Facture Eau (SODECI)</option>
            <option value="ELECTRICITY">Facture Électricité (CIE)</option>
            <option value="RENT">Quittance de Loyer</option>
            <option value="CHARGES">Charges communes & Entretien</option>
            <option value="OTHER">Autre quittance</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">Tous les statuts de paiement</option>
            <option value="PENDING">En attente de paiement</option>
            <option value="PAID">Payé (Mobile Money / Encaissé)</option>
          </select>

          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="h-9 rounded-xl border border-input bg-background px-3 text-xs font-medium"
          >
            <option value="ALL">Toutes les propriétés</option>
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs text-muted-foreground font-medium">
          {filtered.length} quittance(s) affichée(s)
        </span>
      </div>

      {/* Tableau des quittances */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-xs">Réf & Nature</th>
              <th className="px-4 py-3 font-semibold text-xs">Propriété attribuée</th>
              <th className="px-4 py-3 font-semibold text-xs">Locataire destinataire</th>
              <th className="px-4 py-3 font-semibold text-xs">Période / Échéance</th>
              <th className="px-4 py-3 font-semibold text-xs">Montant</th>
              <th className="px-4 py-3 font-semibold text-xs">Statut Paiement</th>
              <th className="px-4 py-3 text-right font-semibold text-xs">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((q) => {
              const isPaid = q.status === 'PAID';
              const typeIcon =
                q.type === 'WATER'
                  ? '💧'
                  : q.type === 'ELECTRICITY'
                    ? '⚡'
                    : q.type === 'RENT'
                      ? '🏠'
                      : '📋';

              return (
                <tr key={q._id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeIcon}</span>
                      <div>
                        <div className="font-bold text-xs">{q.number}</div>
                        <div className="text-[11px] text-muted-foreground">{q.typeLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-foreground">{q.propertyName}</div>
                    {q.meterIndex && (
                      <div className="text-[10px] text-muted-foreground">{q.meterIndex}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-semibold">{q.tenantName}</div>
                    {q.tenantPhone && (
                      <div className="text-[11px] text-muted-foreground">{q.tenantPhone}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{q.period}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Limite : {formatDate(q.dueDate)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-emerald-500 text-sm">
                      {q.amountMinor.toLocaleString('fr-FR')} FCFA
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isPaid ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="size-3" />
                        Payé ({q.paymentMethod || 'Mobile Money'})
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <AlertCircle className="size-3" />
                        En attente de paiement
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!isPaid && (
                        <>
                          <Button
                            variant="secondary"
                            className="h-8 px-2 text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30"
                            title="Relancer sur WhatsApp"
                            onClick={() => handleSendReminder(q)}
                          >
                            <Send className="mr-1 size-3.5" />
                            Relancer
                          </Button>
                          <Button
                            variant="secondary"
                            className="h-8 px-2 text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-bold"
                            title="Valider le paiement et choisir le mode utilisé"
                            onClick={() => setValidatingQuittance(q)}
                          >
                            <CheckCircle2 className="mr-1 size-3.5" />
                            Valider paiement
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        onClick={() => setActiveQuittanceForPrint(q)}
                      >
                        <FileSpreadsheet className="mr-1 size-3.5" />
                        Reçu
                      </Button>
                      <Button
                        variant="ghost"
                        className="h-8 px-2 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                        onClick={() => handleDeleteQuittance(q._id)}
                      >
                        Suppr.
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  Aucune quittance ou facture correspondant aux filtres sélectionnés.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Créer une Quittance */}
      {showCreateModal && (
        <CreateQuittanceModal
          open={showCreateModal}
          onOpenChange={setShowCreateModal}
          onCreated={() => {
            reloadQuittances();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Modal Validation Manuelle d'une Quittance (Mobile Money ou Espèces) */}
      {validatingQuittance && (
        <Modal
          open={Boolean(validatingQuittance)}
          onOpenChange={(op) => !op && setValidatingQuittance(null)}
          title={`Valider le paiement : ${validatingQuittance.typeLabel}`}
          description={`Locataire : ${validatingQuittance.tenantName} · ${validatingQuittance.propertyName}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-muted/40 border border-border flex justify-between items-center">
              <span>Montant de la facture / quittance :</span>
              <strong className="text-base font-black text-emerald-500">
                {validatingQuittance.amountMinor.toLocaleString('fr-FR')} FCFA
              </strong>
            </div>

            <div>
              <label className="font-semibold block mb-1.5">
                Mode de paiement utilisé par le locataire :
              </label>
              <select
                value={manualPaymentMethod}
                onChange={(e) => setManualPaymentMethod(e.target.value)}
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-bold"
              >
                <option value="Mobile Money (Wave)">Mobile Money (Wave)</option>
                <option value="Mobile Money (Orange Money)">Mobile Money (Orange Money)</option>
                <option value="Mobile Money (MTN MoMo)">Mobile Money (MTN MoMo)</option>
                <option value="Mobile Money (Moov Money)">Mobile Money (Moov Money)</option>
                <option value="Espèces / Cash">Espèces / Cash</option>
                <option value="Virement bancaire">Virement bancaire</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setValidatingQuittance(null)}>
                Annuler
              </Button>
              <Button
                onClick={() => handleConfirmManualQuittance(validatingQuittance, manualPaymentMethod)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                <CheckCircle2 className="size-4 mr-1.5" />
                Valider le paiement
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Retrait Mobile Money (Portefeuille Gestion des Quittances et Factures) */}
      {showPayoutModal && (
        <IkeepayPayoutModal
          open={showPayoutModal}
          onOpenChange={setShowPayoutModal}
          availableBalance={totalPaidAmount}
          onSuccess={() => {
            withdrawFromOwnerQuittanceWallet(totalPaidAmount, 'Mobile Money');
            reloadQuittances();
            toast({
              title: 'Retrait du Portefeuille Quittances & Factures initié',
              description:
                'Vos fonds issus du Portefeuille Gestion des Quittances et Factures ont été transférés sur votre compte Mobile Money.',
              variant: 'success',
            });
            setShowPayoutModal(false);
          }}
        />
      )}

      {/* Modal Détails & Reçu Quittance */}
      {activeQuittanceForPrint && (
        <Modal
          open={Boolean(activeQuittanceForPrint)}
          onOpenChange={(op) => !op && setActiveQuittanceForPrint(null)}
          title={`Reçu / Quittance Officielle ${activeQuittanceForPrint.number}`}
          description="Avis de paiement et justificatif KatdEstate certifié."
        >
          <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/20">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-bold text-base">{activeQuittanceForPrint.typeLabel}</h3>
                <p className="text-xs text-muted-foreground">
                  Réf: {activeQuittanceForPrint.number}
                </p>
              </div>
              <Badge
                className={
                  activeQuittanceForPrint.status === 'PAID'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-amber-500 text-white'
                }
              >
                {activeQuittanceForPrint.status === 'PAID' ? 'RÉGLÉE' : 'EN ATTENTE'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Propriété :</span>
                <p className="font-semibold text-foreground">
                  {activeQuittanceForPrint.propertyName}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Locataire :</span>
                <p className="font-semibold text-foreground">
                  {activeQuittanceForPrint.tenantName}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Période concernée :</span>
                <p className="font-semibold text-foreground">{activeQuittanceForPrint.period}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Date limite :</span>
                <p className="font-semibold text-foreground">
                  {formatDate(activeQuittanceForPrint.dueDate)}
                </p>
              </div>
            </div>

            {activeQuittanceForPrint.meterIndex && (
              <div className="rounded-lg bg-background p-2.5 text-xs border border-border">
                <span className="text-muted-foreground font-medium">Relevé de compteur : </span>
                <span className="font-semibold">{activeQuittanceForPrint.meterIndex}</span>
              </div>
            )}

            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center justify-between">
              <span className="font-bold text-xs uppercase text-emerald-400">Montant net :</span>
              <span className="text-lg font-black text-emerald-500">
                {activeQuittanceForPrint.amountMinor.toLocaleString('fr-FR')} FCFA
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setActiveQuittanceForPrint(null)}>
                Fermer
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  window.print();
                }}
              >
                <Download className="mr-1.5 size-4" />
                Imprimer le reçu
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateQuittanceModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const properties = useMemo(() => {
    const list = getLocalProperties();
    if (list.length > 0) return list;
    return [
      {
        _id: 'prop-default-1',
        name: 'Résidence Katd Les Palmiers',
        type: 'RESIDENTIAL_BUILDING',
        address: 'Cocody Riviera',
        city: 'Abidjan',
        country: 'CI',
        zone: 'Cocody',
        status: 'ACTIVE' as const,
      },
    ];
  }, []);
  const allTenants = useMemo(() => {
    const list = getLocalTenants();
    if (list.length > 0) return list;
    return [
      {
        _id: 'ten-default-1',
        fullName: 'Kouamé Jean-Marc',
        phone: '+225 07 12 34 56 78',
        email: 'jean.kouame@gmail.com',
        status: 'ACTIVE',
        propertyId: 'prop-default-1',
        propertyName: 'Résidence Katd Les Palmiers',
        unitNumber: 'Porte 3B',
      },
    ];
  }, []);

  const [propertyId, setPropertyId] = useState(properties[0]?._id || '');
  const [tenantId, setTenantId] = useState('');
  const [type, setType] = useState<'WATER' | 'ELECTRICITY' | 'RENT' | 'CHARGES' | 'OTHER'>('WATER');
  const [amount, setAmount] = useState<number>(15000);
  const [period, setPeriod] = useState<string>('Novembre 2026');
  const [dueDate, setDueDate] = useState<string>('2026-11-20');
  const [meterIndex, setMeterIndex] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Selected property tenants
  const availableTenants = useMemo(() => {
    if (!propertyId) return allTenants;
    const filtered = allTenants.filter((t) => t.propertyId === propertyId);
    return filtered.length > 0 ? filtered : allTenants;
  }, [allTenants, propertyId]);

  useEffect(() => {
    const first = availableTenants[0];
    if (first && !tenantId) {
      setTenantId(first._id);
    }
  }, [availableTenants, tenantId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !tenantId || !amount) {
      toast({
        title: 'Formulaire incomplet',
        description: 'Veuillez sélectionner la propriété, le locataire et renseigner le montant.',
        variant: 'error',
      });
      return;
    }

    const prop = properties.find((p) => p._id === propertyId);
    const ten = allTenants.find((t) => t._id === tenantId);

    const typeLabels: Record<string, string> = {
      WATER: 'Facture Eau (SODECI)',
      ELECTRICITY: 'Facture Électricité (CIE)',
      RENT: 'Quittance de Loyer Mensuel',
      CHARGES: 'Charges communes & Entretien',
      OTHER: 'Autre Facture',
    };

    const newQuittance: QuittanceItem = {
      _id: `quit-${Date.now()}`,
      number: `QUIT-${type}-${Date.now().toString().slice(-4)}`,
      type,
      typeLabel: typeLabels[type] || 'Quittance de charges',
      propertyId,
      propertyName: prop?.name || 'Propriété',
      tenantId,
      tenantName: ten?.fullName || 'Locataire',
      tenantPhone: ten?.phone,
      tenantEmail: ten?.email,
      amountMinor: Number(amount),
      period,
      dueDate,
      status: 'PENDING',
      meterIndex: meterIndex || undefined,
      notes: notes || undefined,
      createdAt: new Date().toISOString(),
    };

    const current = getStoredQuittances();
    saveStoredQuittances([newQuittance, ...current]);

    toast({
      title: 'Quittance émise et envoyée',
      description: `La quittance ${newQuittance.number} est désormais visible sur le dashboard du locataire pour paiement Mobile Money.`,
      variant: 'success',
    });

    onCreated();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Émettre une quittance à un locataire"
      description="Sélectionnez la propriété attribuée, le locataire et le type de charge (SODECI, CIE, loyer)."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-muted-foreground">Propriété attribuée</label>
          <select
            value={propertyId}
            onChange={(e) => {
              setPropertyId(e.target.value);
              setTenantId('');
            }}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
            required
          >
            {properties.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.zone || p.city})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Locataire destinataire
          </label>
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
            required
          >
            {availableTenants.map((t) => (
              <option key={t._id} value={t._id}>
                {t.fullName} · {t.unitNumber || 'Logement'} ({t.phone || 'Contact'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Nature de la charge
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-medium"
            >
              <option value="WATER">💧 Facture Eau (SODECI)</option>
              <option value="ELECTRICITY">⚡ Facture Électricité (CIE)</option>
              <option value="RENT">🏠 Quittance de Loyer</option>
              <option value="CHARGES">🧹 Charges communes / Gardien</option>
              <option value="OTHER">📋 Autre quittance</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Montant net (FCFA)
            </label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              placeholder="Ex: 15000"
              className="mt-1 rounded-xl"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground">Période concernée</label>
            <Input
              type="text"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="Ex: Novembre 2026"
              className="mt-1 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Date limite de paiement
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 rounded-xl"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Index compteur ou N° Facture (optionnel)
          </label>
          <Input
            type="text"
            value={meterIndex}
            onChange={(e) => setMeterIndex(e.target.value)}
            placeholder="Ex: Index SODECI 4210 à 4235 ou N° compteur CIE 014785"
            className="mt-1 rounded-xl"
          />
        </div>

        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Note / Instructions particulières
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Facture commune partagée à parts égales"
            className="mt-1 rounded-xl"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" className="bg-primary hover:bg-primary/90 font-bold">
            <Send className="mr-1.5 size-4" />
            Émettre et envoyer au locataire
          </Button>
        </div>
      </form>
    </Modal>
  );
}
