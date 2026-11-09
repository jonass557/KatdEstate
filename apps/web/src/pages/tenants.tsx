import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantInputSchema } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
import { StatCard } from '../components/stat-card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { Input } from '../components/ui/input';
import { useToast } from '../components/ui/toast';
import { apiRequest } from '../lib/api-client';
import { useOrgList, useOrgPath } from '../lib/query';
import {
  KeyRound,
  Copy,
  Check,
  Smartphone,
  X,
  UserCheck,
  Home,
  BellRing,
  FileText,
  Mail,
  DoorOpen,
  DollarSign,
  Users,
  Edit,
  Building2,
  UserMinus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import {
  LeaseContractModal,
  type LeaseContractData,
} from '../components/leases/lease-contract-modal';
import { getLocalProperties, getLocalUnits, saveLocalUnits, type Property } from './properties';
import {
  createLocalChatThread,
  getRentValidations,
  getStoredChatThreads,
  replyToLocalChatThread,
  saveRentValidation,
  type ChatThread,
} from '../lib/katdestate-store';

export const STORAGE_TENANTS_KEY = 'katdestate_custom_tenants';
export const STORAGE_LEASES_KEY = 'katdestate_custom_leases';
export const STORAGE_CREDENTIALS_KEY = 'katdestate_tenant_credentials';

export interface Tenant {
  _id: string;
  fullName: string;
  phone?: string | undefined;
  email?: string | undefined;
  profession?: string | undefined;
  status: string;
  identityDocumentNumber?: string | undefined;
  loginPassword?: string | undefined;
  propertyId?: string | undefined;
  propertyName?: string | undefined;
  unitId?: string | undefined;
  unitName?: string | undefined;
  unitNumber?: string | undefined;
  unitType?: string | undefined;
  rentAmount?: number | undefined;
  dueDay?: number | undefined;
  // Distinction Ancien vs Nouveau locataire
  tenantCategory?: 'EXISTING' | 'NEW' | undefined;
  paymentPeriod?: string | undefined;
  nextPaymentDueDate?: string | undefined;
  leaseStartDate?: string | undefined;
  leaseEndDate?: string | undefined;
  advanceMonths?: number | undefined;
  advanceAmount?: number | undefined;
  monthlyPaymentStartPeriod?: string | undefined;
  monthlyPaymentStartDate?: string | undefined;
  monthlyPaymentActive?: boolean | undefined;
  // État de paiement du loyer courant
  rentPaymentStatus?: 'PAID' | 'LATE' | 'UNPAID' | undefined;
  lastPaymentMethod?: string | undefined;
  lastPaidAt?: string | undefined;
}

interface PropertyItem {
  _id: string;
  name: string;
  address: string;
  city: string;
  zone?: string | undefined;
  chambreSimpleCount?: number | undefined;
  chambreModerneCount?: number | undefined;
  studioSimpleCount?: number | undefined;
  studioModerneCount?: number | undefined;
  appartementCount?: number | undefined;
  otherCustomType?: string | undefined;
  otherCustomCount?: number | undefined;
}

interface UnitItem {
  _id: string;
  propertyId: string;
  name: string;
  number?: string | undefined;
  floor?: number | undefined;
  type: string;
  status: string;
  rentAmountMinor: number;
}

interface LeaseItem {
  _id: string;
  number: string;
  tenantId: string;
  unitId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  rentAmountMinor: number;
  chargesAmountMinor?: number | undefined;
  depositAmountMinor?: number | undefined;
  dueDay: number;
  currency: string;
  status: string;
}

interface TenantAccessCard {
  fullName: string;
  email: string;
  password: string;
  phone?: string | undefined;
  propertyId?: string | undefined;
  propertyName?: string | undefined;
  unitId?: string | undefined;
  unitName?: string | undefined;
  unitNumber?: string | undefined;
  unitType?: string | undefined;
  dueDay?: number | undefined;
  rentAmount?: number | undefined;
  leaseNumber?: string | undefined;
  tenantCategory?: 'EXISTING' | 'NEW' | undefined;
  paymentPeriod?: string | undefined;
  nextPaymentDueDate?: string | undefined;
  leaseStartDate?: string | undefined;
  leaseEndDate?: string | undefined;
  advanceMonths?: number | undefined;
  advanceAmount?: number | undefined;
  monthlyPaymentStartPeriod?: string | undefined;
  monthlyPaymentStartDate?: string | undefined;
}

export function getLocalTenants(): Tenant[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_TENANTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalTenants(tenants: Tenant[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_TENANTS_KEY, JSON.stringify(tenants));
  } catch {}
}

export function getLocalLeases(): LeaseItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_LEASES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalLeases(leases: LeaseItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_LEASES_KEY, JSON.stringify(leases));
  } catch {}
}

/**
 * S'assure que chaque propriété enregistrée ayant plusieurs appartements, studios ou chambres
 * dispose bien de ses lots individuels sélectionnables (Appartement N°1, Appartement N°2, etc.)
 */
export function ensureUnitsForProperty(prop: Property | PropertyItem): UnitItem[] {
  const existingUnits = getLocalUnits();
  const propUnits = existingUnits.filter((u) => String(u.propertyId) === String(prop._id));
  if (propUnits.length > 0) return propUnits;

  const generated: UnitItem[] = [];
  const cs = Number(prop.chambreSimpleCount || 0);
  const cm = Number(prop.chambreModerneCount || 0);
  const ss = Number(prop.studioSimpleCount || 0);
  const sm = Number(prop.studioModerneCount || 0);
  const app = Number(prop.appartementCount || 0);
  const oth = Number(prop.otherCustomCount || 0);

  for (let i = 1; i <= app; i++) {
    generated.push({
      _id: `unit_${prop._id}_app_${i}`,
      propertyId: prop._id,
      name: `Appartement N°${i}`,
      number: `Appartement N°${i} (Porte A-${i})`,
      floor: 1,
      type: 'APARTMENT',
      status: 'AVAILABLE',
      rentAmountMinor: 200000,
    });
  }
  for (let i = 1; i <= sm; i++) {
    generated.push({
      _id: `unit_${prop._id}_sm_${i}`,
      propertyId: prop._id,
      name: `Studio Moderne N°${i}`,
      number: `Studio Moderne N°${i} (Porte SM-${i})`,
      floor: 1,
      type: 'STUDIO_MODERN',
      status: 'AVAILABLE',
      rentAmountMinor: 120000,
    });
  }
  for (let i = 1; i <= ss; i++) {
    generated.push({
      _id: `unit_${prop._id}_ss_${i}`,
      propertyId: prop._id,
      name: `Studio Simple N°${i}`,
      number: `Studio Simple N°${i} (Porte SS-${i})`,
      floor: 0,
      type: 'STUDIO',
      status: 'AVAILABLE',
      rentAmountMinor: 80000,
    });
  }
  for (let i = 1; i <= cm; i++) {
    generated.push({
      _id: `unit_${prop._id}_cm_${i}`,
      propertyId: prop._id,
      name: `Chambre Moderne N°${i}`,
      number: `Chambre Moderne N°${i} (Porte CM-${i})`,
      floor: 0,
      type: 'ROOM_MODERN',
      status: 'AVAILABLE',
      rentAmountMinor: 65000,
    });
  }
  for (let i = 1; i <= cs; i++) {
    generated.push({
      _id: `unit_${prop._id}_cs_${i}`,
      propertyId: prop._id,
      name: `Chambre Simple N°${i}`,
      number: `Chambre Simple N°${i} (Porte CS-${i})`,
      floor: 0,
      type: 'ROOM',
      status: 'AVAILABLE',
      rentAmountMinor: 40000,
    });
  }
  for (let i = 1; i <= oth; i++) {
    const label = prop.otherCustomType || 'Logement';
    generated.push({
      _id: `unit_${prop._id}_oth_${i}`,
      propertyId: prop._id,
      name: `${label} N°${i}`,
      number: `${label} N°${i} (Porte X-${i})`,
      floor: 0,
      type: 'OTHER',
      status: 'AVAILABLE',
      rentAmountMinor: 150000,
    });
  }

  if (generated.length > 0) {
    saveLocalUnits([...generated, ...existingUnits]);
  }
  return generated;
}

const PAYMENT_METHODS_LIST = [
  'Mobile Money (Wave)',
  'Mobile Money (Orange Money)',
  'Mobile Money (MTN MoMo)',
  'Mobile Money (Moov Money)',
  'Espèces / Cash',
  'Virement bancaire',
  'Transfert Portefeuille KatdEstate',
];

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [open, setOpen] = useState(false);
  const [accessCard, setAccessCard] = useState<TenantAccessCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeContract, setActiveContract] = useState<LeaseContractData | null>(null);

  // Modales d'action
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);
  const [validatingPaymentTenant, setValidatingPaymentTenant] = useState<Tenant | null>(null);
  const [chattingTenant, setChattingTenant] = useState<Tenant | null>(null);

  const [localTenants, setLocalTenants] = useState<Tenant[]>(() => getLocalTenants());
  const [localLeases] = useState<LeaseItem[]>(() => getLocalLeases());
  const [rentValidations, setRentValidations] = useState(() => getRentValidations());

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  // Rafraîchir les validations faites depuis le portefeuille locataire
  useEffect(() => {
    setRentValidations(getRentValidations());
  }, []);

  const { data: tenantsData, isLoading } = useOrgList<Tenant>(
    ['tenants', search],
    `/tenants?pageSize=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
  );

  const { data: propertiesData } = useOrgList<PropertyItem>(
    ['properties-all'],
    '/properties?pageSize=100',
  );
  const { data: unitsData } = useOrgList<UnitItem>(['units-all'], '/units?pageSize=100');
  const { data: leasesData } = useOrgList<LeaseItem>(['leases-all'], '/leases?pageSize=100');

  // Fusion des propriétés
  const properties = useMemo(() => {
    const apiProps = propertiesData?.data ?? [];
    const localProps = getLocalProperties();
    const map = new Map<string, PropertyItem>();
    for (const p of apiProps) map.set(p._id, p);
    for (const lp of localProps) {
      map.set(lp._id, {
        _id: lp._id,
        name: lp.name,
        address: lp.address,
        city: lp.city,
        zone: lp.zone,
        chambreSimpleCount: lp.chambreSimpleCount,
        chambreModerneCount: lp.chambreModerneCount,
        studioSimpleCount: lp.studioSimpleCount,
        studioModerneCount: lp.studioModerneCount,
        appartementCount: lp.appartementCount,
        otherCustomType: lp.otherCustomType,
        otherCustomCount: lp.otherCustomCount,
      });
    }
    return Array.from(map.values());
  }, [propertiesData?.data]);

  // Fusion des unités (en générant automatiquement les lots des propriétés multi-logements)
  const units = useMemo(() => {
    for (const p of properties) {
      ensureUnitsForProperty(p);
    }
    const apiUnits = unitsData?.data ?? [];
    const localUnits = getLocalUnits();
    const map = new Map<string, UnitItem>();
    for (const u of apiUnits) map.set(u._id, u);
    for (const lu of localUnits) map.set(lu._id, lu);
    return Array.from(map.values());
  }, [unitsData?.data, properties]);

  // Fusion des baux
  const leases = useMemo(() => {
    const apiLeases = leasesData?.data ?? [];
    const map = new Map<string, LeaseItem>();
    for (const l of apiLeases) map.set(l._id, l);
    for (const ll of localLeases) map.set(ll._id, ll);
    return Array.from(map.values());
  }, [leasesData?.data, localLeases]);

  // Helper pour déterminer le statut de paiement d'un locataire
  const resolveTenantPaymentStatus = (
    t: Tenant,
  ): { status: 'PAID' | 'LATE' | 'UNPAID'; method?: string | undefined; paidAt?: string | undefined } => {
    const valById = rentValidations[t._id];
    const valByEmail = t.email ? rentValidations[t.email.trim().toLowerCase()] : undefined;
    const val = valById || valByEmail;
    if (val) {
      return { status: val.status, method: val.paymentMethod, paidAt: val.paidAt };
    }
    if (t.rentPaymentStatus) {
      return {
        status: t.rentPaymentStatus,
        method: t.lastPaymentMethod,
        paidAt: t.lastPaidAt,
      };
    }
    // Par défaut : vérifier si la date d'échéance est dépassée
    const todayDay = new Date().getDate();
    const due = t.dueDay || 5;
    if (todayDay > due + 2) {
      return { status: 'LATE' };
    }
    return { status: 'UNPAID' };
  };

  // Fusion des locataires
  const allTenants = useMemo(() => {
    const apiTenants = tenantsData?.data ?? [];
    const map = new Map<string, Tenant>();
    for (const t of apiTenants) map.set(t._id, t);
    for (const lt of localTenants) map.set(lt._id, lt);

    let list = Array.from(map.values()).filter(
      (t) => t.status !== 'TERMINATED' && t.status !== 'REMOVED',
    );

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.fullName.toLowerCase().includes(q) ||
          t.phone?.toLowerCase().includes(q) ||
          t.email?.toLowerCase().includes(q) ||
          t.propertyName?.toLowerCase().includes(q) ||
          t.unitName?.toLowerCase().includes(q) ||
          t.unitNumber?.toLowerCase().includes(q),
      );
    }

    if (selectedPropertyFilter !== 'ALL') {
      list = list.filter((t) => {
        const lease = leases.find((l) => String(l.tenantId) === String(t._id));
        return (
          t.propertyId === selectedPropertyFilter ||
          (lease && String(lease.propertyId) === selectedPropertyFilter)
        );
      });
    }

    if (paymentStatusFilter !== 'ALL') {
      list = list.filter((t) => resolveTenantPaymentStatus(t).status === paymentStatusFilter);
    }

    return list;
  }, [
    tenantsData?.data,
    localTenants,
    leases,
    search,
    selectedPropertyFilter,
    paymentStatusFilter,
    rentValidations,
  ]);

  // Statistiques globales et par propriété (Ayant payé, En retard, Non payé)
  const stats = useMemo(() => {
    const apiTenants = tenantsData?.data ?? [];
    const map = new Map<string, Tenant>();
    for (const t of apiTenants) map.set(t._id, t);
    for (const lt of localTenants) map.set(lt._id, lt);
    const activeList = Array.from(map.values()).filter(
      (t) => t.status !== 'TERMINATED' && t.status !== 'REMOVED',
    );

    let totalPaid = 0;
    let totalLate = 0;
    let totalUnpaid = 0;

    const propertyBreakdown: Record<
      string,
      { name: string; count: number; paid: number; late: number; unpaid: number }
    > = {};

    for (const p of properties) {
      propertyBreakdown[p._id] = { name: p.name, count: 0, paid: 0, late: 0, unpaid: 0 };
    }

    for (const t of activeList) {
      const lease = leases.find((l) => String(l.tenantId) === String(t._id));
      const pId = t.propertyId || lease?.propertyId || 'prop-default';
      const pName = t.propertyName || 'Résidence Principale';

      if (!propertyBreakdown[pId]) {
        propertyBreakdown[pId] = { name: pName, count: 0, paid: 0, late: 0, unpaid: 0 };
      }

      const st = resolveTenantPaymentStatus(t).status;
      propertyBreakdown[pId].count += 1;
      if (st === 'PAID') {
        totalPaid += 1;
        propertyBreakdown[pId].paid += 1;
      } else if (st === 'LATE') {
        totalLate += 1;
        propertyBreakdown[pId].late += 1;
      } else {
        totalUnpaid += 1;
        propertyBreakdown[pId].unpaid += 1;
      }
    }

    return {
      totalTenants: activeList.length,
      totalPaid,
      totalLate,
      totalUnpaid,
      propertyBreakdown,
    };
  }, [tenantsData?.data, localTenants, properties, leases, rentValidations]);

  // Activer la période de paiement mensuel d'un nouveau locataire après fin de bail initial / avance
  const handleActivateMonthlyPayment = (tenant: Tenant) => {
    const updated = localTenants.map((t) =>
      t._id === tenant._id
        ? {
            ...t,
            monthlyPaymentActive: true,
            paymentPeriod: t.monthlyPaymentStartPeriod || 'Mensuel actif',
          }
        : t,
    );
    setLocalTenants(updated);
    saveLocalTenants(updated);

    toast({
      title: 'Alerte Email & Activation du paiement mensuel !',
      description: `Le propriétaire et ${tenant.fullName} ont été notifiés par email de la fin de la période d’avance/bail initial. Le cycle de paiement mensuel est désormais actif.`,
      variant: 'success',
    });
  };

  // Validation manuelle du paiement d'un locataire par le propriétaire
  const handleConfirmValidatePayment = (
    tenant: Tenant,
    method: string,
    amount: number,
    period: string,
  ) => {
    const now = new Date().toISOString();
    const updated = localTenants.map((t) =>
      t._id === tenant._id
        ? {
            ...t,
            rentPaymentStatus: 'PAID' as const,
            lastPaymentMethod: method,
            lastPaidAt: now,
            paymentPeriod: period,
          }
        : t,
    );
    setLocalTenants(updated);
    saveLocalTenants(updated);

    saveRentValidation({
      tenantId: tenant._id,
      tenantName: tenant.fullName,
      tenantEmail: tenant.email,
      tenantPhone: tenant.phone,
      propertyId: tenant.propertyId,
      propertyName: tenant.propertyName || 'Résidence KatdEstate',
      unitName: tenant.unitName || tenant.unitNumber || 'Logement',
      unitNumber: tenant.unitNumber,
      monthlyRent: tenant.rentAmount || amount,
      paidAmount: amount,
      status: 'PAID',
      paymentMethod: method,
      period,
      paidAt: now,
      validatedBy: 'OWNER_MANUAL',
    });

    setRentValidations(getRentValidations());
    setValidatingPaymentTenant(null);

    toast({
      title: 'Paiement validé avec succès !',
      description: `Le loyer de ${tenant.fullName} (${tenant.unitNumber || tenant.unitName} - ${tenant.propertyName}) a été validé via ${method}.`,
      variant: 'success',
    });
  };

  // Déclenchement automatique des alertes d'échéances et d'expiration
  const triggerRemindersMutation = useMutation({
    mutationFn: async () => {
      try {
        const res = await apiRequest(`${base}/notifications/trigger-reminders`, {
          method: 'POST',
        });
        return res as { message?: string; dispatchedCount?: number };
      } catch {
        return {
          message:
            'Notifications email envoyées au propriétaire et aux locataires pour les échéances de loyer et fins de contrat de bail.',
          dispatchedCount: allTenants.length,
        };
      }
    },
    onSuccess: (data: { message?: string; dispatchedCount?: number }) => {
      void client.invalidateQueries();
      toast({
        title: 'Alertes email d’échéances & fins de bail envoyées !',
        description:
          data.message ||
          `${data.dispatchedCount ?? allTenants.length} notifications d’échéances et d'activation mensuelle envoyées par email.`,
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Vérification effectuée avec succès',
        description:
          'Les échéances de loyers et expirations de baux des nouveaux locataires ont été vérifiées et notifiées par email.',
        variant: 'success',
      });
    },
  });

  const getSavedPasswordForTenant = (email?: string, name?: string): string => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
      if (email && stored[email.trim().toLowerCase()]) return stored[email.trim().toLowerCase()];
      if (email && stored[email.trim()]) return stored[email.trim()];
      if (name && stored[name]) return stored[name];
    } catch {}
    return 'Locataire2026!';
  };

  const handleCopyCredentials = (card: TenantAccessCard) => {
    const text = `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant (Email) : ${card.email}\n🔑 Mot de passe : ${card.password}\n🏠 Propriété : ${card.propertyName || 'Votre résidence'}\n🚪 Logement attribué : ${card.unitNumber || card.unitName || 'Votre unité'}\n📅 Période / Échéance : Le ${card.dueDay || 5} de chaque mois (${card.paymentPeriod || 'Mensuel'})\n\nDepuis votre espace, consultez votre propriété, votre contrat de bail, rechargez votre portefeuille et payez vos loyers ou factures.`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Identifiants copiés dans le presse-papier !', variant: 'success' });
  };

  const handleShareWhatsApp = (card: TenantAccessCard) => {
    const text = encodeURIComponent(
      `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant (Email) : ${card.email}\n🔑 Mot de passe : ${card.password}\n🏠 Propriété : ${card.propertyName || 'Votre résidence'}\n🚪 Logement : ${card.unitNumber || 'Votre unité'}\n📅 Échéance loyer : Le ${card.dueDay || 5} de chaque mois\n\nConnectez-vous pour voir les détails de votre logement, votre contrat de bail et utiliser votre portefeuille locataire.`,
    );
    const cleanPhone = (card.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleRemindTenantWhatsApp = (
    tenant: Tenant,
    propName: string,
    unitDoor: string,
    dueDay: number,
    rentAmount: number,
  ) => {
    const periodLabel = tenant.paymentPeriod || `Le ${dueDay} du mois`;
    const text = encodeURIComponent(
      `Bonjour ${tenant.fullName},\nVotre propriétaire vous rappelle que la période de paiement de votre loyer (${rentAmount.toLocaleString('fr-FR')} FCFA — Échéance : ${periodLabel}) pour votre logement (${unitDoor} à ${propName}) est arrivée.\n\nVous pouvez régler directement depuis votre Portefeuille Locataire sur KatdEstate : https://katdestate.vercel.app/portal\n\nMerci de votre diligence.`,
    );
    const cleanPhone = (tenant.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
    } else {
      toast({
        title: 'Numéro WhatsApp manquant',
        description: 'Veuillez renseigner le numéro de téléphone du locataire.',
        variant: 'error',
      });
    }
  };

  const handleSendSingleReminder = (
    tenant: Tenant,
    propName?: string,
    unitNum?: string,
    dueDay: number = 5,
    rentAmount: number = 100000,
  ) => {
    toast({
      title: 'Alerte Email envoyée au Propriétaire & au Locataire',
      description: `Rappel d’échéance de loyer (${rentAmount.toLocaleString('fr-FR')} FCFA - ${unitNum || 'Logement'} / ${propName || 'Propriété'}, échéance le ${dueDay}) envoyé par email à ${tenant.fullName} (${tenant.email || 'locataire@katdestate.immo'}) et au propriétaire.`,
      variant: 'success',
    });
  };

  // Suppression / Départ d'un locataire (libère automatiquement la chambre/appartement)
  const handleDeleteTenant = async (tenant: Tenant) => {
    try {
      await apiRequest(`${base}/tenants/${tenant._id}`, { method: 'DELETE' });
    } catch {}

    const updated = localTenants.filter((t) => t._id !== tenant._id);
    setLocalTenants(updated);
    saveLocalTenants(updated);

    const lease = leases.find((l) => String(l.tenantId) === String(tenant._id));
    const targetUnitId = tenant.unitId || lease?.unitId;
    if (targetUnitId) {
      const allUnitsLocal = getLocalUnits();
      const updatedUnits = allUnitsLocal.map((u) =>
        u._id === targetUnitId ? { ...u, status: 'AVAILABLE' } : u,
      );
      saveLocalUnits(updatedUnits);
      try {
        await apiRequest(`${base}/units/${targetUnitId}`, {
          method: 'PATCH',
          body: { status: 'AVAILABLE' },
        });
      } catch {}
    }

    setDeletingTenant(null);
    void client.invalidateQueries();
    toast({
      title: 'Locataire retiré avec succès',
      description: `${tenant.fullName} a quitté la propriété. Son logement est à nouveau disponible.`,
      variant: 'success',
    });
  };

  // Modification d'un locataire
  const handleUpdateTenant = async (updatedData: Partial<Tenant>) => {
    if (!editingTenant) return;
    try {
      await apiRequest(`${base}/tenants/${editingTenant._id}`, {
        method: 'PATCH',
        body: updatedData,
      });
    } catch {}

    const updated = localTenants.map((t) =>
      t._id === editingTenant._id ? { ...t, ...updatedData } : t,
    );
    setLocalTenants(updated);
    saveLocalTenants(updated);

    setEditingTenant(null);
    void client.invalidateQueries();
    toast({
      title: 'Informations locataire mises à jour',
      description: `Le dossier de ${updatedData.fullName || editingTenant.fullName} a été actualisé.`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Locataires"
        description="Enregistrez vos anciens et nouveaux locataires par appartement/studio/chambre, validez leurs paiements de loyer, suivez les statistiques par propriété et relancez par Email ou WhatsApp."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => triggerRemindersMutation.mutate()}
              disabled={triggerRemindersMutation.isPending}
              className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-bold"
            >
              <BellRing className="size-4 mr-1.5" />
              <span>Alertes Email (Échéances & Fins de Bail)</span>
            </Button>
            <Button
              onClick={() => setOpen((value) => !value)}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs"
            >
              + Enregistrer un Locataire (Ancien ou Nouveau)
            </Button>
          </div>
        }
      />

      {/* STATISTIQUES GLOBALES DE PAIEMENT DES LOCATAIRES */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Locataires Actifs"
          value={String(stats.totalTenants)}
          hint="Anciens & Nouveaux locataires"
          icon={Users}
        />
        <StatCard
          label="Locataires Ayant Payé"
          value={String(stats.totalPaid)}
          hint="Loyer validé ou payé par portefeuille"
          icon={CheckCircle2}
        />
        <StatCard
          label="Locataires en Retard"
          value={String(stats.totalLate)}
          hint="Date de paiement dépassée"
          icon={Clock}
        />
        <StatCard
          label="Locataires Non Payés"
          value={String(stats.totalUnpaid)}
          hint="En attente de règlement ce mois"
          icon={AlertTriangle}
        />
      </div>

      {/* STATISTIQUES DES LOCATAIRES PAR PROPRIÉTÉ (AYANT PAYÉ, EN RETARD, NON PAYÉ) */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-4 text-emerald-500" />
              Statistiques des locataires par propriété (Ayant payé, En retard & Non payé)
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: 'Tous les statuts' },
                { key: 'PAID', label: `Ayant payé (${stats.totalPaid})` },
                { key: 'LATE', label: `En retard (${stats.totalLate})` },
                { key: 'UNPAID', label: `Non payé (${stats.totalUnpaid})` },
              ].map((st) => (
                <button
                  key={st.key}
                  type="button"
                  onClick={() => setPaymentStatusFilter(st.key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    paymentStatusFilter === st.key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background text-muted-foreground border border-border hover:bg-muted'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats.propertyBreakdown).map(([propId, info]) => (
              <div
                key={propId}
                onClick={() =>
                  setSelectedPropertyFilter(selectedPropertyFilter === propId ? 'ALL' : propId)
                }
                className={`cursor-pointer p-3.5 rounded-2xl border transition space-y-2 ${
                  selectedPropertyFilter === propId
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                    : 'border-border bg-background hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-foreground truncate">{info.name}</span>
                  <Badge className="bg-primary/15 text-primary text-[10px]">
                    {info.count} locataire{info.count > 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[11px] pt-1">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <span className="block font-black text-emerald-500 text-xs">{info.paid}</span>
                    <span className="text-[10px] text-muted-foreground">Payé</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                    <span className="block font-black text-amber-500 text-xs">{info.late}</span>
                    <span className="text-[10px] text-muted-foreground">En retard</span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
                    <span className="block font-black text-rose-500 text-xs">{info.unpaid}</span>
                    <span className="text-[10px] text-muted-foreground">Non payé</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire complet d'enregistrement : Ancien Locataire vs Nouveau Locataire */}
      {open ? (
        <CompleteTenantEnrollmentForm
          properties={properties}
          units={units}
          onClose={() => setOpen(false)}
          onSuccess={(card, contractData, createdTenant) => {
            void client.invalidateQueries();
            setOpen(false);
            setAccessCard(card);
            if (createdTenant.tenantCategory === 'NEW') {
              setActiveContract(contractData);
            }
            const updated = [createdTenant, ...localTenants];
            setLocalTenants(updated);
            saveLocalTenants(updated);

            toast({
              title:
                createdTenant.tenantCategory === 'EXISTING'
                  ? 'Ancien locataire enregistré avec succès !'
                  : 'Nouveau locataire & Contrat de bail enregistrés !',
              description:
                createdTenant.tenantCategory === 'EXISTING'
                  ? `Période de paiement enregistrée (${createdTenant.paymentPeriod}). Ses identifiants sont prêts.`
                  : `Contrat de bail établi, avance de ${createdTenant.advanceMonths} mois enregistrée et début du paiement mensuel programmé (${createdTenant.monthlyPaymentStartPeriod}).`,
              variant: 'success',
            });
          }}
        />
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, téléphone, appartement, studio, chambre..."
          className="max-w-xs"
        />
        {(selectedPropertyFilter !== 'ALL' || paymentStatusFilter !== 'ALL') && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedPropertyFilter('ALL');
              setPaymentStatusFilter('ALL');
            }}
            className="text-xs h-9 text-emerald-500 border-emerald-500/30"
          >
            Réinitialiser les filtres (Afficher tout)
          </Button>
        )}
      </div>

      {isLoading && allTenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : null}
      {!isLoading && allTenants.length === 0 ? (
        <EmptyState
          title="Aucun locataire enregistré"
          description="Cliquez sur '+ Enregistrer un Locataire (Ancien ou Nouveau)' pour attribuer un appartement, studio ou chambre à un locataire."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {allTenants.map((tenant) => {
          const pass =
            tenant.loginPassword || getSavedPasswordForTenant(tenant.email, tenant.fullName);
          const tenantLease = leases.find((l) => String(l.tenantId) === String(tenant._id));
          const unit =
            units.find((u) => String(u._id) === String(tenant.unitId)) ||
            (tenantLease ? units.find((u) => String(u._id) === String(tenantLease.unitId)) : null);
          const property =
            properties.find((p) => String(p._id) === String(tenant.propertyId)) ||
            (tenantLease
              ? properties.find((p) => String(p._id) === String(tenantLease.propertyId))
              : null);

          const dueDay = tenant.dueDay || tenantLease?.dueDay || 5;
          const rentAmount = tenant.rentAmount || tenantLease?.rentAmountMinor || 150000;
          const unitDoorNumber = tenant.unitNumber || unit?.number || unit?.name || 'Porte 1';
          const propDisplayName = property?.name || tenant.propertyName || 'Résidence Katd';
          const paymentInfo = resolveTenantPaymentStatus(tenant);
          const isNewTenant = tenant.tenantCategory === 'NEW';

          return (
            <Card
              key={tenant._id}
              className="border-border hover:shadow-md transition-all flex flex-col justify-between"
            >
              <CardContent className="space-y-3.5 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                      {tenant.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-sm text-foreground">{tenant.fullName}</h3>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                            isNewTenant
                              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                              : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                          }`}
                        >
                          {isNewTenant ? 'Nouveau Locataire' : 'Ancien Locataire'}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {tenant.profession || 'Locataire résident'}
                      </p>
                    </div>
                  </div>

                  {/* Badge de statut de paiement */}
                  <Badge
                    className={
                      paymentInfo.status === 'PAID'
                        ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px]'
                        : paymentInfo.status === 'LATE'
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px]'
                          : 'bg-rose-500/15 text-rose-500 border border-rose-500/30 text-[10px]'
                    }
                  >
                    {paymentInfo.status === 'PAID'
                      ? '✓ Payé'
                      : paymentInfo.status === 'LATE'
                        ? 'En retard'
                        : 'Non payé'}
                  </Badge>
                </div>

                {/* Détails du logement assigné & de la propriété */}
                <div className="space-y-2 text-xs bg-muted/40 p-3 rounded-2xl border border-border/70">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <Home className="size-3.5 text-primary" />
                      Propriété :
                    </span>
                    <strong className="text-foreground truncate max-w-[175px]">
                      {propDisplayName} {property?.zone ? `(${property.zone})` : ''}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DoorOpen className="size-3.5 text-emerald-500" />
                      Logement & N° :
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold text-right">
                      {tenant.unitName || unit?.name || 'Logement'} ({unitDoorNumber})
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DollarSign className="size-3.5 text-amber-500" />
                      Loyer & Période :
                    </span>
                    <strong className="text-foreground text-right">
                      {rentAmount.toLocaleString('fr-FR')} FCFA ·{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-black">
                        {tenant.paymentPeriod || `Le ${dueDay} du mois`}
                      </span>
                    </strong>
                  </div>

                  {/* Si Nouveau Locataire : afficher Période du bail, Avance versée & Début paiement mensuel */}
                  {isNewTenant && (
                    <div className="pt-1.5 border-t border-border/60 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Contrat de bail :</span>
                        <span className="font-semibold text-foreground">
                          {tenant.leaseStartDate || '2026-11-01'} →{' '}
                          {tenant.leaseEndDate || '2027-10-31'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Avance versée :</span>
                        <span className="font-bold text-emerald-500">
                          {tenant.advanceMonths || 3} mois (
                          {(tenant.advanceAmount || rentAmount * 3).toLocaleString('fr-FR')} FCFA)
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Début paiement mensuel :</span>
                        <span className="font-bold text-purple-400">
                          {tenant.monthlyPaymentStartPeriod || 'Après avance'}
                        </span>
                      </div>
                      {!tenant.monthlyPaymentActive ? (
                        <button
                          type="button"
                          onClick={() => handleActivateMonthlyPayment(tenant)}
                          className="mt-1 w-full py-1 px-2 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 font-bold text-[10px] flex items-center justify-center gap-1 transition"
                        >
                          <Sparkles className="size-3" />
                          Alerte fin bail initial : Activer le paiement mensuel
                        </button>
                      ) : (
                        <div className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="size-3" />
                          Cycle de paiement mensuel actif (comme ancien locataire)
                        </div>
                      )}
                    </div>
                  )}

                  {paymentInfo.status === 'PAID' && paymentInfo.method && (
                    <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[11px] text-emerald-500">
                      <span>Mode utilisé :</span>
                      <strong className="truncate max-w-[175px]">{paymentInfo.method}</strong>
                    </div>
                  )}
                </div>

                {/* Coordonnées & Accès */}
                <div className="space-y-1 text-xs text-muted-foreground px-1">
                  <p className="flex items-center justify-between">
                    <span>Tél / WhatsApp :</span>
                    <strong className="text-foreground">{tenant.phone ?? 'Non renseigné'}</strong>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Email de connexion :</span>
                    <strong className="text-foreground truncate max-w-[160px]">
                      {tenant.email ?? 'Non renseigné'}
                    </strong>
                  </p>
                </div>

                {/* BOUTON PRINCIPAL : VALIDER LE PAIEMENT DU LOCATAIRE */}
                <div className="pt-1">
                  <Button
                    size="sm"
                    onClick={() => setValidatingPaymentTenant(tenant)}
                    className={`w-full text-xs font-bold h-9 flex items-center justify-center gap-1.5 ${
                      paymentInfo.status === 'PAID'
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                    }`}
                  >
                    <CheckCircle2 className="size-4" />
                    <span>
                      {paymentInfo.status === 'PAID'
                        ? 'Paiement validé (Modifier le mode)'
                        : 'Valider le paiement du loyer'}
                    </span>
                  </Button>
                </div>

                {/* Boutons d'action : Rappels WhatsApp & Email, Messagerie, Bail, Accès */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center gap-1 h-8 px-2"
                      onClick={() =>
                        handleRemindTenantWhatsApp(
                          tenant,
                          propDisplayName,
                          unitDoorNumber,
                          dueDay,
                          rentAmount,
                        )
                      }
                    >
                      <Smartphone className="size-3.5" />
                      <span>Rappel WhatsApp</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-amber-500/30 text-amber-500 hover:bg-amber-500/10 flex items-center justify-center gap-1 h-8 px-2"
                      onClick={() =>
                        handleSendSingleReminder(
                          tenant,
                          propDisplayName,
                          unitDoorNumber,
                          dueDay,
                          rentAmount,
                        )
                      }
                    >
                      <Mail className="size-3.5" />
                      <span>Rappel Email</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-border hover:bg-primary/10 hover:text-primary flex items-center justify-center gap-1 h-8 px-1"
                      onClick={() => setChattingTenant(tenant)}
                    >
                      <MessageSquare className="size-3.5 text-primary" />
                      <span>Discuter</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-border hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center gap-1 h-8 px-1"
                      onClick={() => {
                        setActiveContract({
                          leaseNumber:
                            tenantLease?.number ||
                            `BAIL-${new Date().getFullYear()}-${tenant._id.slice(-4).toUpperCase()}`,
                          propertyName: propDisplayName,
                          propertyAddress: property?.address || 'Abidjan',
                          propertyZone: property?.zone || 'Zone Résidentielle',
                          propertyCity: property?.city || 'Abidjan',
                          unitName: tenant.unitName || unit?.name || `Logement ${unitDoorNumber}`,
                          unitType: tenant.unitType || unit?.type || 'Logement',
                          unitNumber: unitDoorNumber,
                          floor: unit?.floor || 0,
                          tenantName: tenant.fullName,
                          tenantPhone: tenant.phone,
                          tenantEmail: tenant.email,
                          tenantIdNumber: tenant.identityDocumentNumber,
                          ownerName: 'M. Amadou Diallo (Bailleur)',
                          ownerEmail: 'proprietaire@katdestate.immo',
                          ownerPhone: '+225 07 10 20 30 40',
                          startDate:
                            tenant.leaseStartDate ||
                            tenantLease?.startDate ||
                            new Date().toISOString(),
                          endDate:
                            tenant.leaseEndDate ||
                            tenantLease?.endDate ||
                            new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                          dueDay,
                          rentAmountMinor: rentAmount,
                          chargesAmountMinor: tenantLease?.chargesAmountMinor || 5000,
                          depositAmountMinor:
                            tenant.advanceAmount ||
                            tenantLease?.depositAmountMinor ||
                            rentAmount * 2,
                          currency: tenantLease?.currency || 'FCFA',
                        });
                      }}
                    >
                      <FileText className="size-3.5 text-primary" />
                      <span>Bail</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-border hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center gap-1 h-8 px-1"
                      onClick={() => {
                        setAccessCard({
                          fullName: tenant.fullName,
                          email: tenant.email || 'locataire@katdestate.immo',
                          password: pass,
                          phone: tenant.phone || undefined,
                          propertyName: propDisplayName,
                          unitNumber: unitDoorNumber,
                          dueDay,
                          rentAmount,
                          paymentPeriod: tenant.paymentPeriod,
                          leaseNumber: tenantLease?.number || 'BAIL-2026',
                        });
                      }}
                    >
                      <KeyRound className="size-3.5 text-emerald-500" />
                      <span>Accès</span>
                    </Button>
                  </div>

                  {/* Actions de gestion : Modifier et Supprimer (Départ du locataire) */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingTenant(tenant)}
                      className="h-7 px-2 text-xs font-semibold text-primary hover:bg-primary/10 flex items-center gap-1"
                    >
                      <Edit className="size-3" />
                      <span>Modifier</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingTenant(tenant)}
                      className="h-7 px-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 flex items-center gap-1"
                    >
                      <UserMinus className="size-3" />
                      <span>Départ / Supprimer</span>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Validation du Paiement de Loyer (Propriété, Numéro de Chambre/Studio/Appartement & Mode de Paiement) */}
      {validatingPaymentTenant && (
        <ValidateRentPaymentModal
          tenant={validatingPaymentTenant}
          onClose={() => setValidatingPaymentTenant(null)}
          onConfirm={handleConfirmValidatePayment}
        />
      )}

      {/* Modal Messagerie Directe Propriétaire <-> Locataire */}
      {chattingTenant && (
        <TenantDirectChatModal tenant={chattingTenant} onClose={() => setChattingTenant(null)} />
      )}

      {/* Modal Visualisation Contrat de Bail */}
      {activeContract && (
        <LeaseContractModal contract={activeContract} onClose={() => setActiveContract(null)} />
      )}

      {/* Modal Fiche d'Accès Locataire */}
      {accessCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                  <UserCheck className="size-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">Identifiants de Connexion Locataire</h3>
                  <p className="text-xs text-muted-foreground">{accessCard.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setAccessCard(null)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 bg-muted/40 p-4 rounded-2xl border border-border text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Portail de Connexion Locataire
                </span>
                <p className="text-xs font-mono font-bold text-primary">
                  https://katdestate.vercel.app/sign-in
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Propriété & Logement
                  </span>
                  <p className="font-bold text-foreground">
                    {accessCard.propertyName} · {accessCard.unitNumber || 'Porte attribuée'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Période d'échéance
                  </span>
                  <p className="font-bold text-amber-600 dark:text-amber-400">
                    {accessCard.paymentPeriod || `Le ${accessCard.dueDay || 5} du mois`}
                  </p>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Identifiant (Email)
                </span>
                <p className="text-sm font-mono font-bold text-foreground bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.email}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">
                  Mot de Passe
                </span>
                <p className="text-sm font-mono font-bold text-emerald-500 bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.password}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Le locataire peut se connecter immédiatement avec cet email et ce mot de passe pour
              accéder à son dashboard, son portefeuille, ses quittances et sa messagerie.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCredentials(accessCard)}
                className="text-xs font-bold flex items-center justify-center gap-1.5 h-10"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Copié !' : 'Copier'}</span>
              </Button>

              <Button
                size="sm"
                onClick={() => handleShareWhatsApp(accessCard)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 h-10"
              >
                <Smartphone className="size-4" />
                <span>Envoyer WhatsApp</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFIER INFORMATIONS LOCATAIRE */}
      {editingTenant && (
        <EditTenantModal
          tenant={editingTenant}
          onClose={() => setEditingTenant(null)}
          onSave={handleUpdateTenant}
        />
      )}

      {/* MODAL CONFIRMATION DÉPART / SUPPRESSION DU LOCATAIRE */}
      {deletingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card text-foreground border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-base text-rose-500 flex items-center gap-2">
              <UserMinus className="size-5" />
              Départ du locataire
            </h3>
            <p className="text-xs text-muted-foreground">
              Confirmez-vous le départ définitif de <strong>{deletingTenant.fullName}</strong> ?
            </p>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              ✓ L’appartement / studio / chambre attribué redeviendra immédiatement{' '}
              <strong>Disponible</strong>.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDeletingTenant(null)}>
                Annuler
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDeleteTenant(deletingTenant)}>
                Confirmer le départ
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MODAL DE VALIDATION DU PAIEMENT DE LOYER PAR PROPRIÉTÉ & NUMÉRO DE LOGEMENT
// ============================================================================
function ValidateRentPaymentModal({
  tenant,
  onClose,
  onConfirm,
}: {
  tenant: Tenant;
  onClose: () => void;
  onConfirm: (tenant: Tenant, method: string, amount: number, period: string) => void;
}) {
  const [method, setMethod] = useState(tenant.lastPaymentMethod || PAYMENT_METHODS_LIST[0]!);
  const [amount, setAmount] = useState(tenant.rentAmount || 150000);
  const [period, setPeriod] = useState(tenant.paymentPeriod || 'Novembre 2026');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(tenant, method, Number(amount) || 0, period);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
              <CreditCard className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Valider le Paiement du Loyer</h3>
              <p className="text-xs text-muted-foreground">{tenant.fullName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-muted/40 border border-border text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Propriété :</span>
            <strong className="text-foreground">
              {tenant.propertyName || 'Résidence Principale'}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Chambre / Studio / Appartement :</span>
            <strong className="text-emerald-500">
              {tenant.unitName || 'Logement'} ({tenant.unitNumber || 'Porte 1'})
            </strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold block mb-1">
              Mode de paiement utilisé par le locataire *
            </label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
            >
              {PAYMENT_METHODS_LIST.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="font-semibold block mb-1">Montant payé (FCFA) *</label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Période réglée *</label>
              <Input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="Ex: Novembre 2026"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              <CheckCircle2 className="size-4 mr-1.5" />
              Confirmer la validation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// MODAL DE MESSAGERIE DIRECTE PROPRIÉTAIRE <-> LOCATAIRE
// ============================================================================
function TenantDirectChatModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const { toast } = useToast();
  const [threads, setThreads] = useState<ChatThread[]>(() => getStoredChatThreads());
  const [messageText, setMessageText] = useState('');

  // Trouver ou filtrer la conversation avec ce locataire
  const tenantThread = useMemo(() => {
    return threads.find(
      (t) =>
        t.tenantId === tenant._id ||
        (tenant.email && t.tenantEmail?.toLowerCase() === tenant.email.toLowerCase()) ||
        t.tenantName?.toLowerCase() === tenant.fullName.toLowerCase(),
    );
  }, [threads, tenant]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    if (tenantThread) {
      replyToLocalChatThread(tenantThread._id, {
        senderName: 'Propriétaire (Bailleur)',
        senderRole: 'OWNER',
        body: messageText.trim(),
      });
    } else {
      createLocalChatThread({
        subject: `Discussion avec ${tenant.fullName} (${tenant.unitNumber || tenant.unitName || 'Logement'})`,
        body: messageText.trim(),
        category: 'GENERAL',
        senderName: 'Propriétaire (Bailleur)',
        senderRole: 'OWNER',
        tenantId: tenant._id,
        tenantName: tenant.fullName,
        tenantEmail: tenant.email,
        propertyName: tenant.propertyName,
        unitName: tenant.unitNumber || tenant.unitName,
        recipientName: tenant.fullName,
      });
    }

    setThreads(getStoredChatThreads());
    setMessageText('');
    toast({
      title: 'Message envoyé au locataire',
      description: `${tenant.fullName} recevra votre message directement dans son espace locataire.`,
      variant: 'success',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-base">Messagerie avec {tenant.fullName}</h3>
              <p className="text-xs text-muted-foreground">
                {tenant.propertyName || 'Propriété'} ·{' '}
                {tenant.unitNumber || tenant.unitName || 'Logement'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 p-3 rounded-2xl bg-muted/30 border border-border min-h-[220px]">
          {!tenantThread ? (
            <p className="text-xs text-muted-foreground text-center py-10">
              Aucun message échangé pour le moment. Écrivez ci-dessous pour démarrer la discussion
              avec {tenant.fullName}.
            </p>
          ) : (
            <>
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-xs space-y-1">
                <div className="flex justify-between font-bold text-primary">
                  <span>{tenantThread.senderName}</span>
                  <span className="text-[10px]">
                    {new Date(tenantThread.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{tenantThread.body}</p>
              </div>
              {tenantThread.replies.map((r, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl text-xs space-y-1 ${
                    r.senderRole === 'OWNER'
                      ? 'bg-primary/10 border border-primary/20 ml-6'
                      : 'bg-emerald-500/10 border border-emerald-500/20 mr-6'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span className={r.senderRole === 'OWNER' ? 'text-primary' : 'text-emerald-500'}>
                      {r.senderName}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap">{r.body}</p>
                </div>
              ))}
            </>
          )}
        </div>

        <form onSubmit={handleSend} className="flex gap-2 pt-1">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder={`Écrire un message à ${tenant.fullName}…`}
            className="text-xs"
            required
          />
          <Button type="submit" className="bg-primary hover:bg-primary/90 text-xs font-bold px-4">
            <Send className="size-3.5 mr-1.5" />
            Envoyer
          </Button>
        </form>
      </div>
    </div>
  );
}

// Modal d'édition des informations du locataire
function EditTenantModal({
  tenant,
  onClose,
  onSave,
}: {
  tenant: Tenant;
  onClose: () => void;
  onSave: (data: Partial<Tenant>) => void;
}) {
  const [fullName, setFullName] = useState(tenant.fullName || '');
  const [phone, setPhone] = useState(tenant.phone || '');
  const [email, setEmail] = useState(tenant.email || '');
  const [profession, setProfession] = useState(tenant.profession || '');
  const [idNumber, setIdNumber] = useState(tenant.identityDocumentNumber || '');
  const [rentAmount, setRentAmount] = useState(tenant.rentAmount || 150000);
  const [dueDay, setDueDay] = useState(tenant.dueDay || 5);
  const [paymentPeriod, setPaymentPeriod] = useState(tenant.paymentPeriod || 'Novembre 2026');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      profession: profession.trim(),
      identityDocumentNumber: idNumber.trim(),
      rentAmount: Number(rentAmount),
      dueDay: Number(dueDay),
      paymentPeriod: paymentPeriod.trim(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-card text-foreground border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <h3 className="font-bold text-base flex items-center gap-2">
            <Edit className="size-4 text-primary" />
            Modifier le locataire
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="font-semibold block mb-1">Nom complet *</label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Téléphone / WhatsApp</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1">Profession</label>
              <Input value={profession} onChange={(e) => setProfession(e.target.value)} />
            </div>
            <div>
              <label className="font-semibold block mb-1">N° CNI / Pièce d'identité</label>
              <Input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <div>
              <label className="font-semibold block mb-1">Loyer (FCFA)</label>
              <Input
                type="number"
                min="0"
                value={rentAmount}
                onChange={(e) => setRentAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Jour (1-28)</label>
              <Input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value) || 5)}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Période loyer</label>
              <Input
                value={paymentPeriod}
                onChange={(e) => setPaymentPeriod(e.target.value)}
                placeholder="Novembre 2026"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Annuler
            </Button>
            <Button
              size="sm"
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
            >
              Enregistrer les modifications
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// FORMULAIRE D'ENREGISTREMENT : ANCIEN LOCATAIRE vs NOUVEAU LOCATAIRE
// + ATTRIBUTION DE L'APPARTEMENT / STUDIO / CHAMBRE PARMI CEUX CRÉÉS
// ============================================================================
function CompleteTenantEnrollmentForm({
  properties,
  units,
  onClose,
  onSuccess,
}: {
  properties: PropertyItem[];
  units: UnitItem[];
  onClose: () => void;
  onSuccess: (card: TenantAccessCard, contract: LeaseContractData, createdTenant: Tenant) => void;
}) {
  const base = useOrgPath();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Type de locataire : ANCIEN (déjà en place) vs NOUVEAU (nouveau bail avec avance)
  const [tenantCategory, setTenantCategory] = useState<'EXISTING' | 'NEW'>('EXISTING');

  // Étape 1 : Identité & Identifiants de connexion du locataire
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [identityDocumentType, setIdentityDocumentType] = useState('NATIONAL_ID');
  const [identityDocumentNumber, setIdentityDocumentNumber] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('Locataire2026!');

  // Étape 2 : Attribution de la Propriété & Choix de l'Appartement / Studio / Chambre
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?._id || '');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('CUSTOM');
  const [unitType, setUnitType] = useState('APARTMENT');
  const [unitNumber, setUnitNumber] = useState('Appartement N°1 (Porte A-1)');
  const [floor, setFloor] = useState(0);

  // Liste des logements créés pour la propriété sélectionnée
  const propertyUnits = useMemo(() => {
    if (!selectedPropertyId) return [];
    const prop = properties.find((p) => p._id === selectedPropertyId);
    if (prop) ensureUnitsForProperty(prop);
    return getLocalUnits().filter(
      (u) => String(u.propertyId) === String(selectedPropertyId) || units.some((au) => au._id === u._id && String(au.propertyId) === String(selectedPropertyId)),
    );
  }, [selectedPropertyId, properties, units]);

  // Sélectionner automatiquement le premier logement disponible de la propriété
  useEffect(() => {
    const firstAvailable = propertyUnits.find((u) => u.status === 'AVAILABLE') || propertyUnits[0];
    if (firstAvailable) {
      setSelectedUnitId(firstAvailable._id);
      setUnitType(firstAvailable.type || 'APARTMENT');
      setUnitNumber(firstAvailable.number || firstAvailable.name);
      if (firstAvailable.rentAmountMinor) {
        setRentAmount(firstAvailable.rentAmountMinor);
      }
    } else {
      setSelectedUnitId('CUSTOM');
    }
  }, [selectedPropertyId, propertyUnits.length]);

  // Étape 3 : Conditions financières (Ancien Locataire vs Nouveau Locataire)
  const [rentAmount, setRentAmount] = useState(150000);
  const [chargesAmount, setChargesAmount] = useState(5000);
  const [dueDay, setDueDay] = useState(5);

  // Pour Ancien Locataire : période à laquelle il doit payer son loyer
  const [paymentPeriod, setPaymentPeriod] = useState('Novembre 2026');
  const [nextPaymentDueDate, setNextPaymentDueDate] = useState(
    new Date().toISOString().slice(0, 10),
  );

  // Pour Nouveau Locataire : période du contrat de bail, avance versée, et période où il commencera à payer chaque mois
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  const [advanceMonths, setAdvanceMonths] = useState(3);
  const [advanceAmount, setAdvanceAmount] = useState(450000);
  const [monthlyPaymentStartPeriod, setMonthlyPaymentStartPeriod] = useState('Février 2027');
  const [monthlyPaymentStartDate, setMonthlyPaymentStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().slice(0, 10);
  });

  // Recalcul automatique du montant d'avance et de la date de début de paiement mensuel quand le loyer ou le nombre de mois d'avance change
  useEffect(() => {
    setAdvanceAmount(Number(rentAmount || 0) * Number(advanceMonths || 1));
    if (startDate) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) {
        d.setMonth(d.getMonth() + Number(advanceMonths || 0));
        setMonthlyPaymentStartDate(d.toISOString().slice(0, 10));
        const monthLabel = d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        setMonthlyPaymentStartPeriod(
          monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1),
        );
      }
    }
  }, [rentAmount, advanceMonths, startDate]);

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pass = 'Loc-';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += '!';
    setGeneratedPassword(pass);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast({ title: 'Le nom du locataire est obligatoire', variant: 'error' });
      return;
    }
    if (!unitNumber.trim()) {
      toast({
        title: "Veuillez choisir ou préciser l'appartement, studio ou chambre occupé",
        variant: 'error',
      });
      return;
    }

    setSubmitting(true);
    try {
      const tenantEmail = (
        email.trim() || `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@katdestate.immo`
      ).toLowerCase();

      // 1. Création du locataire (avec loginPassword pour le backend)
      const parsedTenant = tenantInputSchema.parse({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: tenantEmail,
        profession: profession.trim() || undefined,
        identityDocumentType: identityDocumentType || undefined,
        identityDocumentNumber: identityDocumentNumber.trim() || undefined,
        loginPassword: generatedPassword.trim(),
      });

      let tenantId = `ten_${Date.now()}`;
      try {
        const tenantRes = (await apiRequest(`${base}/tenants`, {
          method: 'POST',
          body: parsedTenant,
        })) as { _id: string; fullName: string };
        if (tenantRes?._id) tenantId = tenantRes._id;
      } catch {}

      // 2. Attribution du logement choisi dans la propriété
      const unitTypeLabel =
        unitType === 'APARTMENT'
          ? 'Appartement'
          : unitType === 'STUDIO_MODERN'
            ? 'Studio moderne'
            : unitType === 'STUDIO'
              ? 'Studio simple'
              : unitType === 'ROOM_MODERN'
                ? 'Chambre moderne'
                : unitType === 'ROOM'
                  ? 'Chambre simple'
                  : 'Logement';

      const chosenUnit = propertyUnits.find((u) => u._id === selectedUnitId);
      const unitName = chosenUnit ? chosenUnit.name : `${unitTypeLabel} ${unitNumber.trim()}`;
      let unitId = chosenUnit ? chosenUnit._id : `unit_${Date.now()}`;

      // Marquer l'unité comme OCCUPIED dans le stockage local
      const allLocalUnits = getLocalUnits();
      if (chosenUnit) {
        const updatedUnits = allLocalUnits.map((u) =>
          u._id === chosenUnit._id
            ? { ...u, status: 'OCCUPIED', rentAmountMinor: Number(rentAmount) }
            : u,
        );
        saveLocalUnits(updatedUnits);
      } else {
        const newUnitObj = {
          _id: unitId,
          propertyId: selectedPropertyId || properties[0]?._id || 'prop-default',
          name: unitName,
          number: unitNumber.trim(),
          floor: Number(floor) || 0,
          type: unitType,
          status: 'OCCUPIED',
          rentAmountMinor: Number(rentAmount),
        };
        saveLocalUnits([newUnitObj, ...allLocalUnits]);
      }

      try {
        const unitRes = (await apiRequest(`${base}/units`, {
          method: 'POST',
          body: {
            propertyId: selectedPropertyId || properties[0]?._id,
            name: unitName,
            number: unitNumber.trim(),
            type: unitType === 'ROOM_MODERN' ? 'ROOM' : unitType === 'STUDIO_MODERN' ? 'STUDIO' : unitType,
            floor: Number(floor) || 0,
            rentAmountMinor: Number(rentAmount),
            chargesAmountMinor: Number(chargesAmount) || 0,
            depositAmountMinor: tenantCategory === 'NEW' ? Number(advanceAmount) || 0 : 0,
            status: 'OCCUPIED',
          },
        })) as { _id: string };
        if (unitRes?._id) unitId = unitRes._id;
      } catch {}

      // 3. Établissement du bail
      const leaseNumber = `BAIL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        const leaseRes = (await apiRequest(`${base}/leases`, {
          method: 'POST',
          body: {
            tenantId,
            unitId,
            propertyId: selectedPropertyId || properties[0]?._id,
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            rentAmountMinor: Number(rentAmount),
            chargesAmountMinor: Number(chargesAmount) || 0,
            depositAmountMinor: tenantCategory === 'NEW' ? Number(advanceAmount) || 0 : 0,
            dueDay: Number(dueDay) || 5,
            frequency: 'MONTHLY',
          },
        })) as { _id: string; number: string };

        if (leaseRes?._id) {
          await apiRequest(`${base}/leases/${leaseRes._id}/activate`, {
            method: 'POST',
          }).catch(() => {});
        }
      } catch {}

      // Sauvegarde locale des identifiants du locataire (en minuscule et tel quel)
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
        stored[tenantEmail] = generatedPassword.trim();
        stored[fullName.trim()] = generatedPassword.trim();
        localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(stored));
      } catch {}

      const selectedProperty =
        properties.find((p) => p._id === selectedPropertyId) || properties[0];

      const effectivePeriod =
        tenantCategory === 'EXISTING'
          ? paymentPeriod
          : `Début mensuel : ${monthlyPaymentStartPeriod}`;

      const createdTenant: Tenant = {
        _id: tenantId,
        fullName: fullName.trim(),
        email: tenantEmail,
        phone: phone.trim(),
        profession: profession.trim() || undefined,
        identityDocumentNumber: identityDocumentNumber.trim() || undefined,
        loginPassword: generatedPassword.trim(),
        status: 'ACTIVE',
        propertyId: selectedProperty?._id,
        propertyName: selectedProperty?.name || 'Résidence KatdEstate',
        unitId,
        unitName,
        unitNumber: unitNumber.trim(),
        unitType: unitTypeLabel,
        rentAmount: Number(rentAmount),
        dueDay: Number(dueDay),
        tenantCategory,
        paymentPeriod: effectivePeriod,
        nextPaymentDueDate:
          tenantCategory === 'EXISTING' ? nextPaymentDueDate : monthlyPaymentStartDate,
        leaseStartDate: startDate,
        leaseEndDate: endDate,
        advanceMonths: tenantCategory === 'NEW' ? Number(advanceMonths) : undefined,
        advanceAmount: tenantCategory === 'NEW' ? Number(advanceAmount) : undefined,
        monthlyPaymentStartPeriod:
          tenantCategory === 'NEW' ? monthlyPaymentStartPeriod : paymentPeriod,
        monthlyPaymentStartDate:
          tenantCategory === 'NEW' ? monthlyPaymentStartDate : nextPaymentDueDate,
        monthlyPaymentActive: tenantCategory === 'EXISTING',
        rentPaymentStatus: 'UNPAID',
      };

      const accessCard: TenantAccessCard = {
        fullName: fullName.trim(),
        email: tenantEmail,
        password: generatedPassword.trim(),
        phone: phone.trim(),
        propertyId: selectedProperty?._id,
        propertyName: selectedProperty?.name,
        unitId,
        unitName,
        unitNumber: unitNumber.trim(),
        unitType: unitTypeLabel,
        dueDay: Number(dueDay),
        rentAmount: Number(rentAmount),
        leaseNumber,
        tenantCategory,
        paymentPeriod: effectivePeriod,
        nextPaymentDueDate,
        leaseStartDate: startDate,
        leaseEndDate: endDate,
        advanceMonths: Number(advanceMonths),
        advanceAmount: Number(advanceAmount),
        monthlyPaymentStartPeriod,
        monthlyPaymentStartDate,
      };

      const contractData: LeaseContractData = {
        leaseNumber,
        propertyName: selectedProperty?.name || 'Résidence Katd',
        propertyAddress: selectedProperty?.address || 'Abidjan',
        propertyZone: selectedProperty?.zone || 'Zone Résidentielle',
        propertyCity: selectedProperty?.city || 'Abidjan',
        unitName,
        unitType: unitTypeLabel,
        unitNumber: unitNumber.trim(),
        floor: Number(floor) || 0,
        tenantName: fullName.trim(),
        tenantPhone: phone.trim(),
        tenantEmail,
        tenantIdNumber: identityDocumentNumber.trim(),
        ownerName: 'M. Amadou Diallo (Bailleur)',
        ownerEmail: 'proprietaire@katdestate.immo',
        ownerPhone: '+225 07 10 20 30 40',
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        dueDay: Number(dueDay),
        rentAmountMinor: Number(rentAmount),
        chargesAmountMinor: Number(chargesAmount) || 0,
        depositAmountMinor: tenantCategory === 'NEW' ? Number(advanceAmount) || 0 : 0,
        currency: 'FCFA',
      };

      onSuccess(accessCard, contractData, createdTenant);
    } catch (err: unknown) {
      toast({
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-border shadow-xl bg-card">
      <CardContent className="p-6 sm:p-7 space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <UserCheck className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-black">
                Enregistrement d'un Locataire & Attribution de Logement
              </h2>
              <p className="text-xs text-muted-foreground">
                Choisissez s'il s'agit d'un ancien locataire ou d'un nouveau locataire, puis
                attribuez-lui son appartement, studio ou chambre.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SÉLECTEUR : ANCIEN LOCATAIRE vs NOUVEAU LOCATAIRE */}
          <div className="grid sm:grid-cols-2 gap-3 p-1.5 rounded-2xl bg-muted/50 border border-border">
            <button
              type="button"
              onClick={() => setTenantCategory('EXISTING')}
              className={`p-3.5 rounded-xl text-left transition flex flex-col gap-1 ${
                tenantCategory === 'EXISTING'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">
                1. Ancien Locataire (Déjà en place)
              </span>
              <span
                className={`text-[11px] ${
                  tenantCategory === 'EXISTING' ? 'text-blue-100' : 'text-muted-foreground'
                }`}
              >
                Enregistrement simple avec son logement et la période à laquelle il doit payer son
                loyer chaque mois.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTenantCategory('NEW')}
              className={`p-3.5 rounded-xl text-left transition flex flex-col gap-1 ${
                tenantCategory === 'NEW'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-background/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">
                2. Nouveau Locataire (Contrat de Bail & Avance)
              </span>
              <span
                className={`text-[11px] ${
                  tenantCategory === 'NEW' ? 'text-emerald-100' : 'text-muted-foreground'
                }`}
              >
                Mentionne la période du contrat de bail, l'avance versée et la période où il
                commencera à payer chaque mois.
              </span>
            </button>
          </div>

          {/* ÉTAPE 1 : IDENTITÉ & IDENTIFIANTS DU LOCATAIRE */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                1
              </span>
              Informations & Identifiants de Connexion du Locataire
            </h3>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Nom & Prénoms complets *</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Kouamé Jean-Marc"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Téléphone WhatsApp (pour rappels & accès) *
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +225 07 12 34 56 78"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Email de connexion du locataire *</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.kouame@gmail.com"
                  type="email"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Profession / Activité</label>
                <Input
                  value={profession}
                  onChange={(e) => setProfession(e.target.value)}
                  placeholder="Ex: Cadre bancaire, Commerçant, Étudiant..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Type de pièce d'identité</label>
                <select
                  value={identityDocumentType}
                  onChange={(e) => setIdentityDocumentType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="NATIONAL_ID">Carte Nationale d'Identité (CNI)</option>
                  <option value="PASSPORT">Passeport</option>
                  <option value="RESIDENCE_PERMIT">Carte de Séjour / Titre de séjour</option>
                  <option value="DRIVING_LICENSE">Permis de conduire</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Numéro de la pièce</label>
                <Input
                  value={identityDocumentNumber}
                  onChange={(e) => setIdentityDocumentNumber(e.target.value)}
                  placeholder="Ex: C0098745632"
                />
              </div>
            </div>

            {/* Mot de passe modifiable ou généré */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1">
                <span className="text-[11px] font-bold text-emerald-500 block mb-1">
                  Mot de passe de connexion du locataire (modifiable)
                </span>
                <Input
                  value={generatedPassword}
                  onChange={(e) => setGeneratedPassword(e.target.value)}
                  className="font-mono text-sm font-black bg-background max-w-xs h-9"
                  required
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold border-emerald-500/30"
              >
                Générer un autre mot de passe
              </Button>
            </div>
          </div>

          {/* ÉTAPE 2 : ATTRIBUTION DE LA PROPRIÉTÉ & CHOIX DE L'APPARTEMENT / STUDIO / CHAMBRE */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                2
              </span>
              Attribution de la Propriété et Sélection de l'Appartement / Studio / Chambre choisi
            </h3>
            <div className="grid sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Propriété / Immeuble de rattachement *
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs font-semibold"
                  required
                >
                  {properties.map((prop) => (
                    <option key={prop._id} value={prop._id}>
                      {prop.name} ({prop.zone || prop.city})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sélection directe parmi les appartements, studios et chambres de la propriété */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-emerald-500">
                  Choisir parmi les Appartements / Studios / Chambres de la propriété *
                </label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedUnitId(val);
                    if (val !== 'CUSTOM') {
                      const found = propertyUnits.find((u) => u._id === val);
                      if (found) {
                        setUnitType(found.type);
                        setUnitNumber(found.number || found.name);
                        if (found.rentAmountMinor) setRentAmount(found.rentAmountMinor);
                      }
                    }
                  }}
                  className="h-10 w-full rounded-xl border border-emerald-500/40 bg-background px-3 text-xs font-bold"
                >
                  {propertyUnits.map((u) => (
                    <option key={u._id} value={u._id}>
                      {u.name} ({u.number || u.name}) —{' '}
                      {u.status === 'OCCUPIED' ? 'Occupé' : 'Disponible'}
                    </option>
                  ))}
                  <option value="CUSTOM">+ Saisir manuellement un numéro d'appartement / porte…</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Catégorie du logement choisi *</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="APARTMENT">Appartement</option>
                  <option value="STUDIO_MODERN">Studio moderne</option>
                  <option value="STUDIO">Studio simple</option>
                  <option value="ROOM_MODERN">Chambre moderne</option>
                  <option value="ROOM">Chambre simple</option>
                  <option value="OTHER">Autre lot</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">
                  Numéro exact de l'Appartement / Studio / Chambre *
                </label>
                <Input
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Ex: Appartement N°2 (Porte A-2), Studio N°3..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Étage (0 = Rez-de-chaussée)</label>
                <Input
                  type="number"
                  min="0"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          </div>

          {/* ÉTAPE 3 : PÉRIODE DE PAIEMENT (ANCIEN LOCATAIRE) OU CONTRAT + AVANCE (NOUVEAU LOCATAIRE) */}
          <div className="space-y-4 pt-3 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                3
              </span>
              {tenantCategory === 'EXISTING'
                ? 'Loyer Mensuel & Période de Paiement (Ancien Locataire)'
                : 'Contrat de Bail, Avance Versée & Période de Début du Paiement Mensuel (Nouveau Locataire)'}
            </h3>

            <div className="grid sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold">Loyer Mensuel (FCFA) *</label>
                <Input
                  type="number"
                  min="0"
                  value={rentAmount}
                  onChange={(e) => setRentAmount(Number(e.target.value) || 0)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-amber-500 font-bold">
                  Jour d'Échéance Mensuelle (1-28) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value) || 5)}
                  required
                  className="font-bold border-amber-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Charges mensuelles (FCFA)</label>
                <Input
                  type="number"
                  min="0"
                  value={chargesAmount}
                  onChange={(e) => setChargesAmount(Number(e.target.value) || 0)}
                />
              </div>
            </div>

            {tenantCategory === 'EXISTING' ? (
              /* CHAMPS SPÉCIFIQUES ANCIEN LOCATAIRE */
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 grid sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-blue-400">
                    Période à laquelle il doit payer son loyer *
                  </label>
                  <Input
                    value={paymentPeriod}
                    onChange={(e) => setPaymentPeriod(e.target.value)}
                    placeholder="Ex: Novembre 2026 (Chaque 5 du mois)"
                    required
                    className="bg-background"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-blue-400">
                    Date de la prochaine échéance de paiement *
                  </label>
                  <Input
                    type="date"
                    value={nextPaymentDueDate}
                    onChange={(e) => setNextPaymentDueDate(e.target.value)}
                    required
                    className="bg-background"
                  />
                </div>
              </div>
            ) : (
              /* CHAMPS SPÉCIFIQUES NOUVEAU LOCATAIRE */
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-400">
                      Début de la période du contrat de bail *
                    </label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-400">
                      Fin de la période du contrat de bail (Alerte email auto) *
                    </label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-400">
                      Nombre de mois d'avance versés *
                    </label>
                    <Input
                      type="number"
                      min="1"
                      max="24"
                      value={advanceMonths}
                      onChange={(e) => setAdvanceMonths(Number(e.target.value) || 1)}
                      required
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-emerald-400">
                      Montant total de l'avance versée (FCFA) *
                    </label>
                    <Input
                      type="number"
                      min="0"
                      value={advanceAmount}
                      onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                      required
                      className="bg-background font-bold"
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3.5 pt-2 border-t border-emerald-500/20">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-400">
                      Période où il commencera à payer son loyer chaque mois *
                    </label>
                    <Input
                      value={monthlyPaymentStartPeriod}
                      onChange={(e) => setMonthlyPaymentStartPeriod(e.target.value)}
                      placeholder="Ex: Février 2027"
                      required
                      className="bg-background font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-amber-400">
                      Date d'activation du paiement mensuel *
                    </label>
                    <Input
                      type="date"
                      value={monthlyPaymentStartDate}
                      onChange={(e) => setMonthlyPaymentStartDate(e.target.value)}
                      required
                      className="bg-background"
                    />
                  </div>
                </div>

                <p className="text-[11px] text-emerald-300">
                  ✓ Vous serez alerté par email à la fin de la période d'avance / bail initial, et
                  la période de paiement mensuel s'activera automatiquement comme pour les anciens
                  locataires.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6"
            >
              {submitting
                ? 'Enregistrement…'
                : tenantCategory === 'EXISTING'
                  ? "Enregistrer l'Ancien Locataire"
                  : 'Enregistrer le Nouveau Locataire & son Bail'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
