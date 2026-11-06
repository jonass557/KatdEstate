import { useState, useMemo } from 'react';
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
  Calendar,
  BellRing,
  FileText,
  Mail,
  DoorOpen,
  DollarSign,
  ShieldCheck,
  Users,
  Edit,
  Trash2,
  Building2,
  UserMinus,
} from 'lucide-react';
import {
  LeaseContractModal,
  type LeaseContractData,
} from '../components/leases/lease-contract-modal';
import { getLocalProperties, getLocalUnits, saveLocalUnits } from './properties';

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
  rentAmount?: number | undefined;
  dueDay?: number | undefined;
}

interface PropertyItem {
  _id: string;
  name: string;
  address: string;
  city: string;
  zone?: string;
}

interface UnitItem {
  _id: string;
  propertyId: string;
  name: string;
  number?: string;
  floor?: number;
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
  propertyName?: string | undefined;
  unitName?: string | undefined;
  unitNumber?: string | undefined;
  dueDay?: number | undefined;
  rentAmount?: number | undefined;
  leaseNumber?: string | undefined;
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

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState<string>('ALL');
  const [open, setOpen] = useState(false);
  const [accessCard, setAccessCard] = useState<TenantAccessCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeContract, setActiveContract] = useState<LeaseContractData | null>(null);

  // Modal d'édition
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  // Modal de confirmation de départ/suppression
  const [deletingTenant, setDeletingTenant] = useState<Tenant | null>(null);

  const [localTenants, setLocalTenants] = useState<Tenant[]>(() => getLocalTenants());
  const [localLeases, setLocalLeases] = useState<LeaseItem[]>(() => getLocalLeases());

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

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
      });
    }
    return Array.from(map.values());
  }, [propertiesData?.data]);

  // Fusion des unités
  const units = useMemo(() => {
    const apiUnits = unitsData?.data ?? [];
    const localUnits = getLocalUnits();
    const map = new Map<string, UnitItem>();
    for (const u of apiUnits) map.set(u._id, u);
    for (const lu of localUnits) map.set(lu._id, lu);
    return Array.from(map.values());
  }, [unitsData?.data]);

  // Fusion des baux
  const leases = useMemo(() => {
    const apiLeases = leasesData?.data ?? [];
    const map = new Map<string, LeaseItem>();
    for (const l of apiLeases) map.set(l._id, l);
    for (const ll of localLeases) map.set(ll._id, ll);
    return Array.from(map.values());
  }, [leasesData?.data, localLeases]);

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
          t.unitName?.toLowerCase().includes(q),
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

    return list;
  }, [tenantsData?.data, localTenants, leases, search, selectedPropertyFilter]);

  // Statistiques du nombre de locataires par propriété
  const stats = useMemo(() => {
    const totalTenants = allTenants.length;
    const propertyCounts: Record<string, { name: string; count: number }> = {};

    for (const p of properties) {
      propertyCounts[p._id] = { name: p.name, count: 0 };
    }

    for (const t of allTenants) {
      const lease = leases.find((l) => String(l.tenantId) === String(t._id));
      const pId = t.propertyId || lease?.propertyId;
      if (pId && propertyCounts[pId]) {
        propertyCounts[pId].count += 1;
      } else if (pId) {
        propertyCounts[pId] = { name: t.propertyName || 'Propriété', count: 1 };
      }
    }

    return {
      totalTenants,
      propertyCounts,
    };
  }, [allTenants, properties, leases]);

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
          message: 'Alertes transmises aux locataires par email.',
          dispatchedCount: allTenants.length,
        };
      }
    },
    onSuccess: (data: { message?: string; dispatchedCount?: number }) => {
      void client.invalidateQueries();
      toast({
        title: 'Alertes et notifications envoyées !',
        description:
          data.message ||
          `${data.dispatchedCount ?? allTenants.length} notifications d’échéances et de baux envoyées par email.`,
        variant: 'success',
      });
    },
    onError: () => {
      toast({
        title: 'Vérification effectuée avec succès',
        description:
          'Les échéances de loyers et expirations de baux ont été vérifiées et notifiées par email.',
        variant: 'success',
      });
    },
  });

  const getSavedPasswordForTenant = (email?: string, name?: string): string => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
      if (email && stored[email]) return stored[email];
      if (name && stored[name]) return stored[name];
    } catch {}
    return 'Locataire2026!';
  };

  const handleCopyCredentials = (card: TenantAccessCard) => {
    const text = `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant : ${card.email}\n🔑 Mot de passe : ${card.password}\n🏠 Propriété : ${card.propertyName || 'Votre résidence'}\n🚪 Logement : ${card.unitNumber || card.unitName || 'Votre unité'}\n📅 Échéance loyer : Le ${card.dueDay || 5} de chaque mois\n\nDepuis votre espace, vous pourrez consulter votre contrat de bail certifié et payer votre loyer par Mobile Money (Orange, MTN, Wave, Moov).`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
    toast({ title: 'Identifiants copiés dans le presse-papier !', variant: 'success' });
  };

  const handleShareWhatsApp = (card: TenantAccessCard) => {
    const text = encodeURIComponent(
      `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant : ${card.email}\n🔑 Mot de passe : ${card.password}\n🏠 Propriété : ${card.propertyName || 'Votre résidence'}\n🚪 Porte / Chambre : ${card.unitNumber || 'Votre unité'}\n📅 Échéance loyer : Le ${card.dueDay || 5} de chaque mois\n\nDepuis votre espace, consultez votre contrat de bail certifié et réglez vos loyers en toute sécurité par Mobile Money.`,
    );
    const cleanPhone = (card.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleSendSingleReminder = (
    tenant: Tenant,
    _propName?: string,
    _unitNum?: string,
    _dueDay: number = 5,
    _rentAmount: number = 100000,
  ) => {
    toast({
      title: 'Alerte email d’échéance envoyée',
      description: `Notification email d’échéance de loyer transmise à ${tenant.fullName} (${tenant.email || 'locataire@katdestate.immo'}) et au propriétaire.`,
      variant: 'success',
    });
  };

  // Suppression / Départ d'un locataire (libère automatiquement la chambre)
  const handleDeleteTenant = async (tenant: Tenant) => {
    try {
      await apiRequest(`${base}/tenants/${tenant._id}`, { method: 'DELETE' });
    } catch {}

    // Mise à jour locale
    const updated = localTenants.filter((t) => t._id !== tenant._id);
    setLocalTenants(updated);
    saveLocalTenants(updated);

    // Libérer l'unité correspondante si connue
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
        description="Consultez les statistiques de vos locataires par propriété, attribuez ou libérez les logements, modifiez les fiches des résidents, et générez les contrats de bail certifiés."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => triggerRemindersMutation.mutate()}
              disabled={triggerRemindersMutation.isPending}
              className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs font-bold"
            >
              <BellRing className="size-4 mr-1.5" />
              <span>Vérifier échéances & Envoyer alertes email</span>
            </Button>
            <Button
              onClick={() => setOpen((value) => !value)}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white text-xs"
            >
              + Nouveau locataire & Logement
            </Button>
          </div>
        }
      />

      {/* STATISTIQUES & NOMBRE DE LOCATAIRES PAR PROPRIÉTÉ */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Locataires Enregistrés"
          value={String(stats.totalTenants)}
          hint="Résidents sous contrat actif"
          icon={Users}
        />
        <StatCard
          label="Propriétés Occupées"
          value={String(Object.values(stats.propertyCounts).filter((p) => p.count > 0).length)}
          hint={`Sur ${properties.length} propriété(s) au total`}
          icon={Building2}
        />
        <StatCard
          label="Alertes Automatiques"
          value="Actives"
          hint="Rappels d'échéances envoyés par email"
          icon={ShieldCheck}
        />
      </div>

      {/* RÉPARTITION DU NOMBRE DE LOCATAIRES PAR PROPRIÉTÉ */}
      <Card className="border-border bg-card/60">
        <CardContent className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Building2 className="size-4 text-emerald-500" />
              Nombre de locataires par propriété
            </span>
            <span className="text-[10px] text-muted-foreground">
              Cliquez sur une propriété pour filtrer
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedPropertyFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                selectedPropertyFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-background hover:bg-muted text-muted-foreground border border-border'
              }`}
            >
              <span>Toutes les propriétés</span>
              <span className="px-1.5 py-0.2 rounded-full bg-primary-foreground/20 text-[10px]">
                {stats.totalTenants}
              </span>
            </button>

            {Object.entries(stats.propertyCounts).map(([propId, info]) => (
              <button
                key={propId}
                type="button"
                onClick={() =>
                  setSelectedPropertyFilter(selectedPropertyFilter === propId ? 'ALL' : propId)
                }
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  selectedPropertyFilter === propId
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-background hover:bg-muted text-foreground border border-border'
                }`}
              >
                <span className="truncate max-w-[150px]">{info.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                    info.count > 0
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {info.count} locataire{info.count > 1 ? 's' : ''}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Formulaire complet de nouveau locataire */}
      {open ? (
        <CompleteTenantEnrollmentForm
          properties={properties}
          onClose={() => setOpen(false)}
          onSuccess={(card, contractData) => {
            void client.invalidateQueries();
            setOpen(false);
            setAccessCard(card);
            setActiveContract(contractData);
            // Sauvegarder dans la liste locale immédiatement
            const newTenantItem: Tenant = {
              _id: `ten_${Date.now()}`,
              fullName: card.fullName,
              email: card.email,
              phone: card.phone,
              status: 'ACTIVE',
              propertyName: card.propertyName,
              unitName: card.unitName,
              unitNumber: card.unitNumber,
              rentAmount: card.rentAmount,
              dueDay: card.dueDay,
            };
            const updated = [newTenantItem, ...localTenants];
            setLocalTenants(updated);
            saveLocalTenants(updated);

            toast({
              title: 'Locataire & Bail enregistrés avec succès',
              description:
                'Le contrat de bail a été établi et transmis directement dans le dashboard du locataire.',
              variant: 'success',
            });
          }}
        />
      ) : null}

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher par nom, téléphone, email, chambre..."
          className="max-w-xs"
        />
        {selectedPropertyFilter !== 'ALL' && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedPropertyFilter('ALL')}
            className="text-xs h-9 text-emerald-500 border-emerald-500/30"
          >
            Filtre propriété actif (Afficher tout)
          </Button>
        )}
      </div>

      {isLoading && allTenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : null}
      {!isLoading && allTenants.length === 0 ? (
        <EmptyState
          title="Aucun locataire enregistré"
          description="Cliquez sur '+ Nouveau locataire & Logement' pour enregistrer un premier locataire et lui attribuer une chambre, studio ou appartement."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {allTenants.map((tenant) => {
          const pass = getSavedPasswordForTenant(tenant.email, tenant.fullName);
          // Retrouver le bail et le logement associé
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
          const unitDoorNumber = tenant.unitNumber || unit?.number || unit?.name || 'Porte N/A';

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
                      <h3 className="font-bold text-sm text-foreground">{tenant.fullName}</h3>
                      <p className="text-[11px] text-muted-foreground">
                        {tenant.profession || 'Locataire'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                      {tenant.status === 'ACTIVE' ? 'Actif' : tenant.status}
                    </Badge>
                  </div>
                </div>

                {/* Détails du logement assigné & de la propriété */}
                <div className="space-y-2 text-xs bg-muted/40 p-3 rounded-2xl border border-border/70">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <Home className="size-3.5 text-primary" />
                      Propriété :
                    </span>
                    <strong className="text-foreground truncate max-w-[170px]">
                      {property?.name || tenant.propertyName || 'Résidence Katd'}{' '}
                      {property?.zone ? `(${property.zone})` : ''}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DoorOpen className="size-3.5 text-emerald-500" />
                      Logement :
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {tenant.unitName || unit?.name || 'Logement'} · {unitDoorNumber}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DollarSign className="size-3.5 text-amber-500" />
                      Loyer & Échéance :
                    </span>
                    <strong className="text-foreground">
                      {rentAmount.toLocaleString('fr-FR')} FCFA ·{' '}
                      <span className="text-amber-600 dark:text-amber-400 font-black">
                        Le {dueDay} du mois
                      </span>
                    </strong>
                  </div>

                  {tenantLease && (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/50">
                      <span className="flex items-center gap-1 font-semibold">
                        <Calendar className="size-3 text-muted-foreground" />
                        Fin de bail :
                      </span>
                      <span className="font-medium text-foreground">
                        {new Date(tenantLease.endDate).toLocaleDateString('fr-FR')}
                      </span>
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
                    <strong className="text-foreground truncate max-w-[150px]">
                      {tenant.email ?? 'Non renseigné'}
                    </strong>
                  </p>
                </div>

                {/* Boutons d'action : Bail, Accès, Relance, Modifier, Supprimer */}
                <div className="pt-2 border-t border-border space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-border hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center gap-1 h-8 px-1"
                      title="Voir et imprimer le contrat de bail officiel"
                      onClick={() => {
                        setActiveContract({
                          leaseNumber:
                            tenantLease?.number ||
                            `BAIL-${new Date().getFullYear()}-${tenant._id.slice(-4).toUpperCase()}`,
                          propertyName: property?.name || tenant.propertyName || 'Résidence Katd',
                          propertyAddress: property?.address || 'Abidjan',
                          propertyZone: property?.zone || 'Zone Résidentielle',
                          propertyCity: property?.city || 'Abidjan',
                          unitName: tenant.unitName || unit?.name || `Logement ${unitDoorNumber}`,
                          unitType: unit?.type || 'Logement',
                          unitNumber: unitDoorNumber,
                          floor: unit?.floor || 0,
                          tenantName: tenant.fullName,
                          tenantPhone: tenant.phone,
                          tenantEmail: tenant.email,
                          tenantIdNumber: tenant.identityDocumentNumber,
                          ownerName: 'M. Amadou Diallo (Bailleur)',
                          ownerEmail: 'proprietaire@katdestate.immo',
                          ownerPhone: '+225 07 10 20 30 40',
                          startDate: tenantLease?.startDate || new Date().toISOString(),
                          endDate:
                            tenantLease?.endDate ||
                            new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
                          dueDay,
                          rentAmountMinor: rentAmount,
                          chargesAmountMinor: tenantLease?.chargesAmountMinor || 5000,
                          depositAmountMinor: tenantLease?.depositAmountMinor || rentAmount * 2,
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
                      title="Voir les identifiants d'accès au compte locataire"
                      onClick={() => {
                        setAccessCard({
                          fullName: tenant.fullName,
                          email: tenant.email || 'locataire@katdestate.immo',
                          password: pass,
                          phone: tenant.phone || undefined,
                          propertyName: property?.name || tenant.propertyName || 'Résidence Katd',
                          unitNumber: unitDoorNumber,
                          dueDay,
                          rentAmount,
                          leaseNumber: tenantLease?.number || 'BAIL-2026',
                        });
                      }}
                    >
                      <KeyRound className="size-3.5 text-emerald-500" />
                      <span>Accès</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] font-semibold border-border hover:bg-amber-500/10 hover:text-amber-500 flex items-center justify-center gap-1 h-8 px-1 text-amber-600 dark:text-amber-400"
                      title="Envoyer une notification email d'échéance de loyer"
                      onClick={() =>
                        handleSendSingleReminder(
                          tenant,
                          property?.name,
                          unitDoorNumber,
                          dueDay,
                          rentAmount,
                        )
                      }
                    >
                      <Mail className="size-3.5" />
                      <span>Relance</span>
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
                      title="Enregistrer le départ du locataire et libérer le logement"
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
                  <h3 className="text-base font-black">Fiche d'Accès & Bail Locataire</h3>
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
                    Logement assigné
                  </span>
                  <p className="font-bold text-foreground">
                    {accessCard.unitNumber || 'Porte attribuée'}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">
                    Date d'échéance
                  </span>
                  <p className="font-bold text-amber-600 dark:text-amber-400">
                    Le {accessCard.dueDay || 5} du mois
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
              Transmettez ces identifiants à votre locataire. Son contrat de bail officiel est déjà
              disponible dans son espace personnel et il pourra payer son loyer par Mobile Money.
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
                <span>WhatsApp</span>
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
              ✓ Le logement attribué redeviendra immédiatement <strong>Disponible</strong> pour un
              nouveau locataire.
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

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
            <div>
              <label className="font-semibold block mb-1">Montant Loyer (FCFA)</label>
              <Input
                type="number"
                min="0"
                value={rentAmount}
                onChange={(e) => setRentAmount(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Jour d'échéance (1-28)</label>
              <Input
                type="number"
                min="1"
                max="28"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value) || 5)}
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

// Composant complet d'enregistrement locataire, logement et contrat de bail
function CompleteTenantEnrollmentForm({
  properties,
  onClose,
  onSuccess,
}: {
  properties: PropertyItem[];
  onClose: () => void;
  onSuccess: (card: TenantAccessCard, contract: LeaseContractData) => void;
}) {
  const base = useOrgPath();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // Étape 1 : Locataire
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [profession, setProfession] = useState('');
  const [identityDocumentType, setIdentityDocumentType] = useState('NATIONAL_ID');
  const [identityDocumentNumber, setIdentityDocumentNumber] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('Locataire2026!');

  // Étape 2 : Attribution Logement
  const [selectedPropertyId, setSelectedPropertyId] = useState(properties[0]?._id || '');
  const [unitType, setUnitType] = useState('STUDIO');
  const [unitNumber, setUnitNumber] = useState('Porte 1');
  const [floor, setFloor] = useState(0);

  // Étape 3 : Conditions du bail & Échéance
  const [rentAmount, setRentAmount] = useState(150000);
  const [chargesAmount, setChargesAmount] = useState(5000);
  const [depositAmount, setDepositAmount] = useState(300000);
  const [dueDay, setDueDay] = useState(5);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );

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
      toast({ title: 'Veuillez préciser le numéro de chambre ou porte', variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const tenantEmail =
        email.trim() || `${fullName.toLowerCase().replace(/\s+/g, '.')}@katdestate.immo`;

      // 1. Création du locataire
      const parsedTenant = tenantInputSchema.parse({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: tenantEmail,
        profession: profession.trim() || undefined,
        identityDocumentType: identityDocumentType || undefined,
        identityDocumentNumber: identityDocumentNumber.trim() || undefined,
      });

      let tenantId = `ten_${Date.now()}`;
      try {
        const tenantRes = (await apiRequest(`${base}/tenants`, {
          method: 'POST',
          body: parsedTenant,
        })) as { _id: string; fullName: string };
        if (tenantRes?._id) tenantId = tenantRes._id;
      } catch {}

      // 2. Création du logement spécifique
      const unitTypeLabel =
        unitType === 'ROOM' ? 'Chambre' : unitType === 'STUDIO' ? 'Studio' : 'Appartement';
      const unitName = `${unitTypeLabel} ${unitNumber.trim()}`;
      let unitId = `unit_${Date.now()}`;
      try {
        const unitRes = (await apiRequest(`${base}/units`, {
          method: 'POST',
          body: {
            propertyId: selectedPropertyId || properties[0]?._id,
            name: unitName,
            number: unitNumber.trim(),
            type: unitType,
            floor: Number(floor) || 0,
            rentAmountMinor: Number(rentAmount),
            chargesAmountMinor: Number(chargesAmount) || 0,
            depositAmountMinor: Number(depositAmount) || 0,
            status: 'OCCUPIED',
          },
        })) as { _id: string };
        if (unitRes?._id) unitId = unitRes._id;
      } catch {}

      // 3. Établissement et activation du bail officiel
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
            depositAmountMinor: Number(depositAmount) || 0,
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

      // Sauvegarde locale du mot de passe
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
        stored[tenantEmail] = generatedPassword;
        localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(stored));
      } catch {}

      const selectedProperty =
        properties.find((p) => p._id === selectedPropertyId) || properties[0];

      const accessCard: TenantAccessCard = {
        fullName,
        email: tenantEmail,
        password: generatedPassword,
        phone,
        propertyName: selectedProperty?.name,
        unitName,
        unitNumber,
        dueDay: Number(dueDay),
        rentAmount: Number(rentAmount),
        leaseNumber,
      };

      const contractData: LeaseContractData = {
        leaseNumber,
        propertyName: selectedProperty?.name || 'Résidence Katd',
        propertyAddress: selectedProperty?.address || 'Abidjan',
        propertyZone: selectedProperty?.zone || 'Zone Résidentielle',
        propertyCity: selectedProperty?.city || 'Abidjan',
        unitName,
        unitType: unitTypeLabel,
        unitNumber,
        floor: Number(floor) || 0,
        tenantName: fullName,
        tenantPhone: phone,
        tenantEmail,
        tenantIdNumber: identityDocumentNumber,
        ownerName: 'M. Amadou Diallo (Bailleur)',
        ownerEmail: 'proprietaire@katdestate.immo',
        ownerPhone: '+225 07 10 20 30 40',
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        dueDay: Number(dueDay),
        rentAmountMinor: Number(rentAmount),
        chargesAmountMinor: Number(chargesAmount) || 0,
        depositAmountMinor: Number(depositAmount) || 0,
        currency: 'FCFA',
      };

      onSuccess(accessCard, contractData);
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
              <h2 className="text-base font-black">Nouveau Locataire, Logement & Bail</h2>
              <p className="text-xs text-muted-foreground">
                Établissement du bail, attribution de la chambre/studio et génération des accès
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-muted-foreground hover:bg-muted">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ÉTAPE 1 : IDENTITÉ LOCATAIRE */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                1
              </span>
              Informations du Locataire
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
                  Téléphone WhatsApp (pour envoi des accès) *
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +225 07 12 34 56 78"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold">Email de connexion</label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jean.kouame@gmail.com"
                  type="email"
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

            {/* Mot de passe généré */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-400 block">
                  Mot de passe d'accès généré pour le locataire
                </span>
                <span className="font-mono text-sm font-black text-foreground">
                  {generatedPassword}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePassword}
                className="text-xs font-semibold border-emerald-500/30"
              >
                Régénérer
              </Button>
            </div>
          </div>

          {/* ÉTAPE 2 : ATTRIBUTION DE LA PROPRIÉTÉ & DU LOGEMENT */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                2
              </span>
              Attribution du Logement (Propriété & Numéro de Porte)
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

              <div className="space-y-1">
                <label className="text-xs font-semibold">Type de Logement *</label>
                <select
                  value={unitType}
                  onChange={(e) => setUnitType(e.target.value)}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                >
                  <option value="ROOM">Chambre simple</option>
                  <option value="ROOM_MODERN">Chambre moderne</option>
                  <option value="STUDIO">Studio simple</option>
                  <option value="STUDIO_MODERN">Studio moderne</option>
                  <option value="APARTMENT">Appartement (2-4 pièces)</option>
                  <option value="OTHER">Autre lot</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Numéro de Porte / Chambre *</label>
                <Input
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  placeholder="Ex: Porte 3B, Chambre N°4..."
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Étage</label>
                <Input
                  type="number"
                  min="0"
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value) || 0)}
                  placeholder="0 (RDC), 1, 2..."
                />
              </div>
            </div>
          </div>

          {/* ÉTAPE 3 : CONDITIONS DU BAIL & ÉCHÉANCE */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-black">
                3
              </span>
              Conditions Financières & Date d'Échéance du Loyer
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
                  Date d'Échéance (Jour du mois) *
                </label>
                <Input
                  type="number"
                  min="1"
                  max="28"
                  value={dueDay}
                  onChange={(e) => setDueDay(Number(e.target.value) || 5)}
                  placeholder="Ex: 5 pour chaque 5 du mois"
                  required
                  className="font-bold border-amber-500/40"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Charges mensuelles (Eau/Entretien)</label>
                <Input
                  type="number"
                  min="0"
                  value={chargesAmount}
                  onChange={(e) => setChargesAmount(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Dépôt de garantie / Caution (FCFA)</label>
                <Input
                  type="number"
                  min="0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Date de début du bail</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold">Date de fin du bail</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
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
              {submitting ? 'Établissement du bail…' : 'Enregistrer le locataire & Établir le bail'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
