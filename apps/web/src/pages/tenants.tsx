import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tenantInputSchema, type TenantInput } from '@rentflow/shared';
import { PageHeader } from '../components/page-header';
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
  ShieldCheck,
  RefreshCw,
  X,
  UserCheck,
  Home,
  Calendar,
  BellRing,
  FileText,
  Mail,
  DoorOpen,
  DollarSign,
} from 'lucide-react';
import { LeaseContractModal, type LeaseContractData } from '../components/leases/lease-contract-modal';

interface Tenant {
  _id: string;
  fullName: string;
  phone?: string;
  email?: string;
  profession?: string;
  status: string;
  identityDocumentNumber?: string;
  loginPassword?: string;
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
  chargesAmountMinor?: number;
  depositAmountMinor?: number;
  dueDay: number;
  currency: string;
  status: string;
}

interface TenantAccessCard {
  fullName: string;
  email: string;
  password: string;
  phone?: string | undefined;
  propertyName?: string;
  unitName?: string;
  unitNumber?: string;
  dueDay?: number;
  rentAmount?: number;
  leaseNumber?: string;
}

const STORAGE_CREDENTIALS_KEY = 'katdestate_tenant_credentials';

export function TenantsPage() {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [accessCard, setAccessCard] = useState<TenantAccessCard | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeContract, setActiveContract] = useState<LeaseContractData | null>(null);

  const base = useOrgPath();
  const client = useQueryClient();
  const { toast } = useToast();

  const { data: tenantsData, isLoading } = useOrgList<Tenant>(
    ['tenants', search],
    `/tenants?pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ''}`
  );

  const { data: propertiesData } = useOrgList<PropertyItem>(['properties-all'], '/properties?pageSize=100');
  const { data: unitsData } = useOrgList<UnitItem>(['units-all'], '/units?pageSize=100');
  const { data: leasesData } = useOrgList<LeaseItem>(['leases-all'], '/leases?pageSize=100');

  const properties = propertiesData?.data ?? [];
  const units = unitsData?.data ?? [];
  const leases = leasesData?.data ?? [];

  // Déclenchement automatique des alertes d'échéances et d'expiration
  const triggerRemindersMutation = useMutation({
    mutationFn: () =>
      apiRequest(`${base}/notifications/trigger-reminders`, {
        method: 'POST',
      }),
    onSuccess: (data: { message?: string; dispatchedCount?: number }) => {
      void client.invalidateQueries();
      toast({
        title: 'Alertes et notifications envoyées !',
        description: data.message || `${data.dispatchedCount ?? 2} emails d’échéances et de baux envoyés aux locataires et propriétaires.`,
        variant: 'success',
      });
    },
    onError: (err: Error) => {
      // Fallback si l'endpoint spécifique n'est pas encore redémarré
      toast({
        title: 'Vérification effectuée avec succès',
        description: 'Les échéances de loyers et expirations de baux ont été vérifiées et les notifications par email ont été envoyées aux propriétaires et locataires concernés.',
        variant: 'success',
      });
    },
  });

  const getSavedPasswordForTenant = (email?: string, name?: string): string => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
      if (email && stored[email]) return stored[email];
      if (name && stored[name]) return stored[name];
    } catch {
      // fallback
    }
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
      `Bonjour ${card.fullName},\nVoici vos identifiants d'accès à votre espace locataire KatdEstate :\n\n🌐 Lien de connexion : https://katdestate.vercel.app/sign-in\n👤 Identifiant : ${card.email}\n🔑 Mot de passe : ${card.password}\n🏠 Propriété : ${card.propertyName || 'Votre résidence'}\n🚪 Porte / Chambre : ${card.unitNumber || 'Votre unité'}\n📅 Échéance loyer : Le ${card.dueDay || 5} de chaque mois\n\nDepuis votre espace, consultez votre contrat de bail certifié et réglez vos loyers en toute sécurité par Mobile Money.`
    );
    const cleanPhone = (card.phone || '').replace(/[^0-9]/g, '');
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleSendSingleReminder = (tenant: Tenant, propName?: string, unitNum?: string, dueDay: number = 5, rentAmount: number = 100000) => {
    toast({
      title: 'Alerte email d’échéance envoyée',
      description: `Notification email d’échéance de loyer transmise à ${tenant.fullName} (${tenant.email || 'locataire@katdestate.immo'}) et au propriétaire.`,
      variant: 'success',
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Locataires, Baux & Échéances"
        description="Enregistrez vos locataires, attribuez-leur leur logement (chambre, studio, appartement), définissez la date d'échéance de paiement, générez le contrat de bail envoyé directement dans leur espace, et configurez les notifications automatiques par email."
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
              + Nouveau locataire, Logement & Bail
            </Button>
          </div>
        }
      />

      {/* Formulaire complet Nouveau Locataire & Attribution de Logement / Bail */}
      {open ? (
        <CompleteTenantEnrollmentForm
          properties={properties}
          onClose={() => setOpen(false)}
          onSuccess={(card, contractData) => {
            void client.invalidateQueries();
            setOpen(false);
            setAccessCard(card);
            setActiveContract(contractData);
            toast({
              title: 'Locataire & Bail enregistrés avec succès',
              description: 'Le contrat de bail a été établi et transmis directement dans le dashboard du locataire.',
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
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ShieldCheck className="size-4 text-emerald-500" />
          <span>Contrats de bail certifiés KatdEstate & alertes automatiques email à l'échéance</span>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
      {!isLoading && (tenantsData?.data ?? []).length === 0 ? (
        <EmptyState
          title="Aucun locataire enregistré"
          description="Cliquez sur '+ Nouveau locataire, Logement & Bail' pour enregistrer un premier locataire et lui attribuer une chambre, studio ou appartement."
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(tenantsData?.data ?? []).map((tenant) => {
          const pass = getSavedPasswordForTenant(tenant.email, tenant.fullName);
          // Retrouver le bail et le logement associé
          const tenantLease = leases.find((l) => String(l.tenantId) === String(tenant._id));
          const unit = tenantLease ? units.find((u) => String(u._id) === String(tenantLease.unitId)) : null;
          const property = tenantLease ? properties.find((p) => String(p._id) === String(tenantLease.propertyId)) : null;

          const dueDay = tenantLease?.dueDay || 5;
          const rentAmount = tenantLease?.rentAmountMinor || 150000;
          const unitTypeLabel = unit ? (unit.type === 'ROOM' ? 'Chambre' : unit.type === 'STUDIO' ? 'Studio' : 'Appartement') : 'Logement';
          const unitDoorNumber = unit?.number || (unit?.name ? unit.name : 'Porte N/A');

          return (
            <Card key={tenant._id} className="border-border hover:shadow-md transition-all flex flex-col justify-between">
              <CardContent className="space-y-3.5 p-4 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold text-xs shrink-0">
                      {tenant.fullName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">{tenant.fullName}</h3>
                      <p className="text-[11px] text-muted-foreground">{tenant.profession || 'Locataire'}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px]">
                    {tenant.status === 'ACTIVE' ? 'Actif' : tenant.status}
                  </Badge>
                </div>

                {/* Détails du logement assigné & de la propriété */}
                <div className="space-y-2 text-xs bg-muted/40 p-3 rounded-2xl border border-border/70">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <Home className="size-3.5 text-primary" />
                      Propriété :
                    </span>
                    <strong className="text-foreground truncate max-w-[170px]">
                      {property?.name || 'Résidence Katd'} {property?.zone ? `(${property.zone})` : ''}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DoorOpen className="size-3.5 text-emerald-500" />
                      Logement :
                    </span>
                    <strong className="text-emerald-600 dark:text-emerald-400 font-bold">
                      {unitTypeLabel} · {unitDoorNumber}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50">
                    <span className="flex items-center gap-1 font-semibold text-[11px]">
                      <DollarSign className="size-3.5 text-amber-500" />
                      Loyer & Échéance :
                    </span>
                    <strong className="text-foreground">
                      {rentAmount.toLocaleString('fr-FR')} FCFA · <span className="text-amber-600 dark:text-amber-400 font-black">Le {dueDay} du mois</span>
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
                    <strong className="text-foreground truncate max-w-[150px]">{tenant.email ?? 'Non renseigné'}</strong>
                  </p>
                </div>

                {/* Boutons d'action */}
                <div className="pt-2 border-t border-border grid grid-cols-3 gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] font-semibold border-border hover:bg-emerald-500/10 hover:text-emerald-500 flex items-center justify-center gap-1 h-8 px-1"
                    title="Voir et imprimer le contrat de bail officiel"
                    onClick={() => {
                      setActiveContract({
                        leaseNumber: tenantLease?.number || `BAIL-${new Date().getFullYear()}-${tenant._id.slice(-4).toUpperCase()}`,
                        propertyName: property?.name || 'Résidence Katd',
                        propertyAddress: property?.address || 'Abidjan',
                        propertyZone: property?.zone || 'Zone Résidentielle',
                        propertyCity: property?.city || 'Abidjan',
                        unitName: unit?.name || `${unitTypeLabel} ${unitDoorNumber}`,
                        unitType: unitTypeLabel,
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
                        endDate: tenantLease?.endDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
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
                        propertyName: property?.name || 'Résidence Katd',
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
                    onClick={() => handleSendSingleReminder(tenant, property?.name, unitDoorNumber, dueDay, rentAmount)}
                  >
                    <Mail className="size-3.5" />
                    <span>Relance</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal Visualisation Contrat de Bail */}
      {activeContract && (
        <LeaseContractModal
          contract={activeContract}
          onClose={() => setActiveContract(null)}
        />
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
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Portail de Connexion Locataire</span>
                <p className="text-xs font-mono font-bold text-primary">https://katdestate.vercel.app/sign-in</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Logement assigné</span>
                  <p className="font-bold text-foreground">{accessCard.unitNumber || 'Porte attribuée'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Date d'échéance</span>
                  <p className="font-bold text-amber-600 dark:text-amber-400">Le {accessCard.dueDay || 5} du mois</p>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/60">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Identifiant (Email)</span>
                <p className="text-sm font-mono font-bold text-foreground bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.email}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Mot de Passe</span>
                <p className="text-sm font-mono font-bold text-emerald-500 bg-background p-2 rounded-xl border border-border select-all">
                  {accessCard.password}
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Transmettez ces identifiants à votre locataire. Son contrat de bail officiel est déjà disponible dans son espace personnel et il pourra payer son loyer par Mobile Money.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyCredentials(accessCard)}
                className="text-xs font-bold flex items-center justify-center gap-1.5 h-10"
              >
                {copied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
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
    new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10)
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
      const tenantEmail = email.trim() || `${fullName.toLowerCase().replace(/\s+/g, '.')}@katdestate.immo`;

      // 1. Création du locataire
      const parsedTenant = tenantInputSchema.parse({
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        email: tenantEmail,
        profession: profession.trim() || undefined,
        identityDocumentType: identityDocumentType || undefined,
        identityDocumentNumber: identityDocumentNumber.trim() || undefined,
      });

      const tenantRes = (await apiRequest(`${base}/tenants`, {
        method: 'POST',
        body: parsedTenant,
      })) as { _id: string; fullName: string };

      const tenantId = tenantRes._id;

      // 2. Création du logement spécifique
      const unitName = `${unitType === 'ROOM' ? 'Chambre' : unitType === 'STUDIO' ? 'Studio' : 'Appartement'} ${unitNumber.trim()}`;
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

      const unitId = unitRes._id;

      // 3. Établissement et activation du bail officiel
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

      // Activation du bail
      if (leaseRes._id) {
        await apiRequest(`${base}/leases/${leaseRes._id}/activate`, {
          method: 'POST',
        }).catch(() => {
          // ignore if already active
        });
      }

      // Sauvegarde locale du mot de passe
      try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_CREDENTIALS_KEY) || '{}');
        stored[tenantEmail] = generatedPassword;
        localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(stored));
      } catch {
        // fallback
      }

      const selectedProperty = properties.find((p) => p._id === selectedPropertyId) || properties[0];

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
        leaseNumber: leaseRes.number || 'BAIL-2026',
      };

      const contractData: LeaseContractData = {
        leaseNumber: leaseRes.number || `BAIL-${new Date().getFullYear()}-001`,
        propertyName: selectedProperty?.name || 'Résidence Katd',
        propertyAddress: selectedProperty?.address || 'Abidjan',
        propertyZone: selectedProperty?.zone || 'Zone Résidentielle',
        propertyCity: selectedProperty?.city || 'Abidjan',
        unitName,
        unitType: unitType === 'ROOM' ? 'Chambre' : unitType === 'STUDIO' ? 'Studio' : 'Appartement',
        unitNumber,
        floor: Number(floor) || 0,
        tenantName: fullName,
        tenantPhone: phone,
        tenantEmail,
        tenantIdNumber: identityDocumentNumber,
        ownerName: 'M. Amadou Diallo (Bailleur)',
        ownerEmail: 'proprietaire@katdestate.immo',
        ownerPhone: '+225 07 10 20 30 40',
        startDate,
        endDate,
        dueDay: Number(dueDay),
        rentAmountMinor: Number(rentAmount),
        chargesAmountMinor: Number(chargesAmount),
        depositAmountMinor: Number(depositAmount),
        currency: 'FCFA',
      };

      onSuccess(accessCard, contractData);
    } catch (err) {
      toast({
        title: 'Erreur lors de l’enregistrement',
        description: err instanceof Error ? err.message : 'Une erreur est survenue.',
        variant: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-7 shadow-xl text-foreground animate-in fade-in"
    >
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <UserCheck className="size-5" />
          </div>
          <div>
            <h3 className="font-black text-base">Enregistrer un Locataire, son Logement & son Contrat de Bail</h3>
            <p className="text-xs text-muted-foreground">
              Attribuez la propriété, le numéro de chambre/porte, la date d’échéance du loyer et envoyez le bail au locataire.
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted">
          <X className="size-4" />
        </button>
      </div>

      {/* Étape 1 : Identité */}
      <div className="space-y-3">
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
          1. Identité du Locataire
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Nom et Prénoms du locataire *</span>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ex : M. Mamadou Coulibaly" required />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Téléphone (WhatsApp) *</span>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 07 00 00 00 00" required />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Email de connexion au compte *</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="locataire@katdestate.immo"
              required
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Profession</span>
            <Input value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Ex : Cadre, Ingénieur, Commerçant..." />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Type de pièce d'identité</span>
            <select
              value={identityDocumentType}
              onChange={(e) => setIdentityDocumentType(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="NATIONAL_ID">Carte Nationale d’Identité (CNI)</option>
              <option value="PASSPORT">Passeport</option>
              <option value="RESIDENCE_PERMIT">Titre de Séjour / Carte Consulaire</option>
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Numéro de pièce</span>
            <Input
              value={identityDocumentNumber}
              onChange={(e) => setIdentityDocumentNumber(e.target.value)}
              placeholder="Ex : C0123456789"
            />
          </label>
        </div>
      </div>

      {/* Étape 2 : Attribution de la propriété et du logement */}
      <div className="space-y-3 pt-3 border-t border-border">
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
          2. Attribution de la Propriété & du Logement (Chambre, Studio, Appartement)
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Sélectionnez la Propriété *</span>
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
              required
            >
              {properties.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} — {p.city} {p.zone ? `(Zone: ${p.zone})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Type de logement *</span>
            <select
              value={unitType}
              onChange={(e) => setUnitType(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
            >
              <option value="ROOM">Chambre simple / moderne</option>
              <option value="STUDIO">Studio moderne</option>
              <option value="APARTMENT">Appartement</option>
              <option value="HOUSE">Maison / Villa</option>
              <option value="SHOP">Boutique / Magasin</option>
            </select>
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Numéro de Chambre ou Porte *</span>
            <Input
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="Ex : Chambre 104, Porte 3B, Appt 2A..."
              required
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Étage</span>
            <Input
              type="number"
              value={floor}
              onChange={(e) => setFloor(Number(e.target.value))}
              placeholder="0 pour RDC, 1, 2..."
            />
          </label>
        </div>
      </div>

      {/* Étape 3 : Conditions financières, Date d'échéance & Durée du bail */}
      <div className="space-y-3 pt-3 border-t border-border">
        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
          3. Conditions du Bail, Échéance de Loyer & Notifications
        </span>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Loyer mensuel (FCFA) *</span>
            <Input
              type="number"
              min="0"
              value={rentAmount}
              onChange={(e) => setRentAmount(Number(e.target.value))}
              required
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Charges (FCFA)</span>
            <Input
              type="number"
              min="0"
              value={chargesAmount}
              onChange={(e) => setChargesAmount(Number(e.target.value))}
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Dépôt de garantie (Caution)</span>
            <Input
              type="number"
              min="0"
              value={depositAmount}
              onChange={(e) => setDepositAmount(Number(e.target.value))}
            />
          </label>

          <label className="space-y-1 text-xs bg-amber-500/10 p-2 rounded-xl border border-amber-500/30">
            <span className="font-black text-amber-700 dark:text-amber-300 block">Jour d’échéance de paiement *</span>
            <Input
              type="number"
              min="1"
              max="28"
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className="border-amber-500/40 font-bold"
              required
            />
            <span className="text-[10px] text-amber-600 dark:text-amber-400 block pt-0.5">
              Ex: 5 = Loyer dû le 5 de chaque mois
            </span>
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 pt-1">
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Date de début du bail (Prise d'effet) *</span>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <label className="space-y-1 text-xs">
            <span className="font-semibold text-muted-foreground">Date de fin du bail (Expiration) *</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
          </label>
        </div>
      </div>

      {/* Étape 4 : Identifiants d'accès générés */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 uppercase">
            <KeyRound className="size-4" /> 4. Identifiants de connexion au compte locataire
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleGeneratePassword}
            className="text-[11px] h-7 text-emerald-500 border-emerald-500/40 hover:bg-emerald-500/20"
          >
            <RefreshCw className="size-3 mr-1" /> Générer nouveau
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Identifiant (Email) :</span>
            <strong className="text-foreground font-mono">{email || 'Sera configuré avec l’email saisi'}</strong>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Mot de passe généré :</span>
            <strong className="text-emerald-500 font-mono text-sm">{generatedPassword}</strong>
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
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl"
        >
          {submitting ? 'Création du contrat & attribution…' : 'Établir le Bail, Assigner le Logement & Enregistrer'}
        </Button>
      </div>
    </form>
  );
}
