import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Home,
  KeyRound,
  Receipt,
  TrendingDown,
  Wrench,
  CreditCard,
  Crown,
  ShieldCheck,
  Users,
  Briefcase,
  FileText,
  Settings,
  Sparkles,
  QrCode,
  MapPin,
  Bell,
  AlertTriangle,
  Wallet,
  Globe,
  Plus,
  Newspaper,
  Calendar,
  MessageSquare,
  Smartphone,
  Store,
  FolderOpen,
  Shield,
  LogOut,
  Gauge,
  BarChart3,
} from 'lucide-react';
import { useOrganization } from '../app/organization';
import { useSession } from '../app/session';
import { BackButton } from '../components/ui/back-button';
import { Button } from '../components/ui/button';
import { useOrgQuery } from '../lib/query';
import { IkeepayModal } from '../components/payments/ikeepay-modal';
import { IkeepaySettingsModal } from '../components/admin/ikeepay-settings-modal';

interface Overview {
  incomeMinor: number;
  arrearsMinor: number;
  occupancyRate: number;
  availableUnits: number;
  expiringLeases: number;
  openMaintenance: number;
  expenseMinor: number;
  cashflowMinor: number;
  note?: string;
}

interface AppButton {
  title: string;
  icon: any;
  colorClass: string;
  glowClass: string;
  to?: string;
  onClick?: () => void;
  badge?: string;
  badgeBg?: string;
}

interface AppSection {
  title: string;
  subtitle?: string;
  buttons: AppButton[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { activeOrganization } = useOrganization();
  const { user, memberships, signOut } = useSession();
  const { data } = useOrgQuery<Overview>(['dashboard'], '/dashboard');

  // Déconnexion rapide en 1 clic pour changer de compte
  const handleLogout = async () => {
    try {
      await signOut();
    } finally {
      navigate('/sign-in', { replace: true });
    }
  };

  // Détection stricte du rôle de l'utilisateur connecté — isolation totale entre profils
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'OWNER';

  // Modals state
  const [ikeepayPayinOpen, setIkeepayPayinOpen] = useState(false);
  const [ikeepaySettingsOpen, setIkeepaySettingsOpen] = useState(false);

  // Build categorized button sections according to the active role
  const getSectionsForRole = (role: string): AppSection[] => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          {
            title: 'GOUVERNANCE TERRITORIALE & AUDIT',
            subtitle:
              'Supervision des chefferies coutumières, découpage des secteurs et audit plateforme',
            buttons: [
              {
                title: 'Chefferie &\nFoncier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
                badge: 'OFFICIEL',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Découpage\nSecteurs',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier',
                badge: 'BLOCS',
                badgeBg: 'bg-cyan-500 text-black',
              },
              {
                title: 'Communes &\nVilles',
                icon: MapPin,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-sky-600 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/quartier',
              },
              {
                title: 'Modération\nMarketplace',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/admin-marketplace',
                badge: 'MODÉRATION',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Audit &\nSécurité',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/platform',
                badge: 'SYSTÈME',
                badgeBg: 'bg-slate-400 text-black',
              },
              {
                title: 'Gestion des\nPropriétaires',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/admin/owners',
                badge: 'BAILLEURS',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Équipe &\nRôles',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-indigo-700 to-purple-800 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/team',
              },
            ],
          },
          {
            title: 'PARC IMMOBILIER & LOCATIONS',
            subtitle: 'Gestion globale des patrimoines, logements, contrats et locataires',
            buttons: [
              {
                title: 'Gestion des\nPropriétés',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/properties',
                badge: 'PARC',
                badgeBg: 'bg-indigo-400 text-black',
              },
              {
                title: 'Baux &\nContrats',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/leases',
              },
              {
                title: 'Gestion des\nLocataires',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-600 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/tenants',
              },
              {
                title: 'Espace\nPropriétaire',
                icon: Briefcase,
                colorClass: 'bg-gradient-to-tr from-sky-600 to-blue-700 text-white',
                glowClass: 'shadow-sky-500/25',
                to: '/owner-portal',
              },
              {
                title: 'Espace\nAgent',
                icon: Briefcase,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/agent',
              },
            ],
          },
          {
            title: 'FINANCES, MARCHÉ & IKEEPAY H2H',
            subtitle: 'Flux financiers, passerelle Ikeepay H2H et intelligence économique',
            buttons: [
              {
                title: 'Passerelle\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'MOBILE MONEY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Clés API\nIkeepay',
                icon: Settings,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                onClick: () => setIkeepaySettingsOpen(true),
                badge: 'CONFIG',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Suivi des\nLoyers',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-green-600 to-emerald-700 text-white',
                glowClass: 'shadow-green-500/25',
                to: '/rent',
              },
              {
                title: 'Paiements &\nFlux',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-teal-500 to-cyan-600 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/payments',
              },
              {
                title: 'Charges &\nDépenses',
                icon: TrendingDown,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/expenses',
              },
              {
                title: 'Analytique &\nBilan',
                icon: BarChart3,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/analytics',
                badge: 'EN DIRECT',
                badgeBg: 'bg-rose-400 text-black',
              },
            ],
          },
          {
            title: 'OPÉRATIONS, OUTILS & INTELLIGENCE ARTIFICIELLE',
            subtitle: 'Marketplace, maintenance technique, documents, compteurs et KatdEstate AI',
            buttons: [
              {
                title: 'Marketplace\nPublique',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
                badge: 'VITRINE',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'KatdEstate\nAI Copilot',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/ai',
                badge: 'IA V2',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
              {
                title: 'Maintenance\n& Pannes',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-orange-600 to-amber-600 text-white',
                glowClass: 'shadow-orange-500/25',
                to: '/maintenance',
              },
              {
                title: 'Documents &\nArchives',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
              {
                title: 'Messagerie &\nCanaux',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/messages',
              },
              {
                title: 'Compteurs\nd’Énergie',
                icon: Gauge,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/utilities',
              },
              {
                title: 'Notifications\nSystème',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/notifications',
              },
              {
                title: 'Paramètres\nGénéraux',
                icon: Settings,
                colorClass: 'bg-gradient-to-tr from-slate-600 to-slate-800 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/settings',
              },
            ],
          },
        ];

      case 'NEIGHBORHOOD_LEADER':
        return [
          {
            title: 'FONCIER & ACTES COUTUMIERS DU CHEF',
            subtitle: 'Enregistrement légal des transactions et délivrance des actes officiels',
            buttons: [
              {
                title: 'Ventes de\nTerrains',
                icon: MapPin,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
                badge: 'OBLIGATOIRE',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Ventes de\nMaisons',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-cyan-600 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/quartier',
                badge: 'MUTATION',
                badgeBg: 'bg-blue-300 text-black',
              },
              {
                title: 'Locations &\nBaux Secteur',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/leases',
              },
              {
                title: 'Certificats QR\nOfficiels',
                icon: QrCode,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/quartier',
                badge: 'INFALSIFIABLE',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Registre\nFoncier',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-sky-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier',
              },
              {
                title: 'Commissions\nChefferie',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-green-600 to-emerald-700 text-white',
                glowClass: 'shadow-green-500/25',
                to: '/quartier',
                badge: 'DROITS',
                badgeBg: 'bg-green-400 text-black',
              },
            ],
          },
          {
            title: 'SÉCURITÉ, REPASSEMENT & CHEFS DE BLOC',
            subtitle: 'Coordination des chefs de bloc, recensement des foyers et alertes',
            buttons: [
              {
                title: 'Supervision\nChefs de Bloc',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/quartier',
              },
              {
                title: 'Recensement\nSecteur',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/tenants',
                badge: '15 000+',
                badgeBg: 'bg-rose-400 text-black',
              },
              {
                title: 'Alertes\nSécurité',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/25',
                to: '/quartier',
                badge: 'URGENCE',
                badgeBg: 'bg-red-500 text-white',
              },
              {
                title: 'Incidents &\nSignalements',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/maintenance',
              },
              {
                title: 'Carte\nInteractive',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier',
              },
              {
                title: 'Communications\nHabitants',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-indigo-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/messages',
              },
            ],
          },
          {
            title: 'COMMERCE, FINANCES & OUTILS',
            subtitle: 'Marketplace du quartier, quittances, Ikeepay et KatdEstate AI',
            buttons: [
              {
                title: 'Marketplace\nLocale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
              {
                title: 'Paiement Droits\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'MOBILE MONEY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Documents &\nActes',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
              {
                title: 'Notifications\nChefferie',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/notifications',
              },
              {
                title: 'KatdEstate\nAI Juridique',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white',
                glowClass: 'shadow-fuchsia-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
              {
                title: 'Compteurs\ndu Secteur',
                icon: Gauge,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/utilities',
              },
            ],
          },
        ];

      case 'BLOCK_LEADER':
        return [
          {
            title: 'RECENSEMENT DE PROXIMITÉ DU BLOC',
            subtitle: 'Enrôlement terrain des habitations, immeubles, lots et familles',
            buttons: [
              {
                title: 'Enrôler une\nMaison',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-blue-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier',
                badge: 'NOUVEAU',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Générer QR\nCode Bloc',
                icon: QrCode,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier',
                badge: 'ADHÉSION',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Registre\ndes Foyers',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/tenants',
              },
              {
                title: 'Immeubles &\nLogements',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/units',
              },
              {
                title: 'Contrats de\nProximité',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/leases',
              },
              {
                title: 'Relevé des\nCompteurs',
                icon: Gauge,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-yellow-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/utilities',
              },
            ],
          },
          {
            title: 'SÉCURITÉ, ALERTES & VIE DU BLOC',
            subtitle: 'Gestion des signalements de proximité, urgences et liaisons',
            buttons: [
              {
                title: 'Signaler un\nIncident SOS',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/25',
                to: '/quartier',
                badge: 'SOS',
                badgeBg: 'bg-red-500 text-white',
              },
              {
                title: 'Alertes\nCitoyennes',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/quartier',
                badge: 'DIRECT',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Contact\nChefferie',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/messages',
              },
              {
                title: 'Maintenance\n& Dépannages',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-orange-600 to-amber-700 text-white',
                glowClass: 'shadow-orange-500/25',
                to: '/maintenance',
              },
              {
                title: 'Documents &\nFiches Bloc',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
              {
                title: 'Permanence\nde Garde',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/quartier',
              },
            ],
          },
          {
            title: 'COMMUNICATION, COTISATIONS & COMMERCE',
            subtitle: 'Messagerie du bloc, paiements Ikeepay et marketplace',
            buttons: [
              {
                title: 'Messagerie &\nRésidents',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/messages',
              },
              {
                title: 'Cotisation\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'MOBILE MONEY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Marketplace\nLocale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
              {
                title: 'Notifications\ndu Bloc',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-fuchsia-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/notifications',
              },
            ],
          },
        ];

      case 'TENANT':
        return [
          {
            title: 'MON LOGEMENT & MON CONTRAT',
            subtitle: 'Contrat certifié, inventaire, quittances et assistance technique',
            buttons: [
              {
                title: 'Mon Contrat\nde Bail',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/portal/lease',
                badge: 'ACTIF',
                badgeBg: 'bg-blue-400 text-black',
              },
              {
                title: 'Mes Quittances\n& Reçus',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/portal/receipts',
                badge: 'CONFORME',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Signaler\nune Panne',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/portal/maintenance',
                badge: 'TICKET',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Messages avec\nle Bailleur',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/portal/messages',
              },
              {
                title: 'Mon Profil\nRésident',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/portal/profile',
              },
              {
                title: 'Mes Documents\nClassés',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/portal/documents',
              },
            ],
          },
          {
            title: 'PAIEMENTS & SERVICES MOBILES IKEEPAY',
            subtitle: 'Règlement instantané sécurisé par Orange, MTN, Wave ou Moov',
            buttons: [
              {
                title: 'Payer mon\nLoyer Mobile',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'INSTANTANÉ',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Orange\nMoney',
                icon: Smartphone,
                colorClass: 'bg-gradient-to-tr from-orange-500 to-amber-600 text-white',
                glowClass: 'shadow-orange-500/25',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'OM',
                badgeBg: 'bg-orange-500 text-white',
              },
              {
                title: 'MTN\nMoMo',
                icon: Smartphone,
                colorClass: 'bg-gradient-to-tr from-yellow-400 to-amber-500 text-black',
                glowClass: 'shadow-yellow-500/25',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'MoMo',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Wave &\nMoov',
                icon: Smartphone,
                colorClass: 'bg-gradient-to-tr from-sky-500 to-blue-600 text-white',
                glowClass: 'shadow-sky-500/25',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'WAVE',
                badgeBg: 'bg-sky-400 text-black',
              },
              {
                title: 'Factures &\nÉchéances',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/portal/invoices',
              },
              {
                title: 'Suivi de mes\nPaiements',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/portal/payments',
              },
            ],
          },
          {
            title: 'QUARTIER, COMPTEURS & MARKETPLACE',
            subtitle: 'Attestation de résidence, sécurité citoyenne et relève des compteurs',
            buttons: [
              {
                title: 'Chefferie &\nQuartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
                badge: 'CITOYEN',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Mes Compteurs\nEau & Elec',
                icon: Gauge,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/utilities',
              },
              {
                title: 'Marketplace\nBiens & Locs',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
              {
                title: 'Notifications\nLocataire',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/portal/notifications',
              },
            ],
          },
        ];

      case 'AGENT':
        return [
          {
            title: 'MANDATS & MARKETPLACE IMMOBILIÈRE',
            subtitle: 'Diffusion de biens vérifiés, suivi des acquéreurs et visites terrain',
            buttons: [
              {
                title: 'Marketplace\nPublique',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
                badge: 'VITRINE',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Espace Agent\n& Mandats',
                icon: Briefcase,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/agent',
                badge: 'EXCLUSIFS',
                badgeBg: 'bg-blue-300 text-black',
              },
              {
                title: 'Publier une\nAnnonce',
                icon: Plus,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/marketplace',
                badge: 'NOUVEAU',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Mes Annonces\n& Mandats',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-violet-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/owner-listings',
              },
              {
                title: 'Visites &\nPlanning',
                icon: Calendar,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/agent',
              },
              {
                title: 'Prospects &\nOffres',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-cyan-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/agent',
              },
            ],
          },
          {
            title: 'COMMISSIONS, HONORAIRES & FINANCES',
            subtitle: 'Calcul des honoraires d’agence et retraits Mobile Money via Ikeepay',
            buttons: [
              {
                title: 'Mes\nCommissions',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                to: '/agent',
                badge: 'DISPONIBLE',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Retrait\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'H2H',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Factures\nd’Honoraires',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-sky-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/payments',
              },
              {
                title: 'Performance &\nStatistiques',
                icon: BarChart3,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/analytics',
              },
              {
                title: 'Estimation de\nPrix IA',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white',
                glowClass: 'shadow-fuchsia-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
              {
                title: 'Baux &\nContrats',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/leases',
              },
            ],
          },
          {
            title: 'PATRIMOINE, DOCUMENTS & CONTACTS',
            subtitle: 'Propriétés mandatées, documents administratifs et messagerie',
            buttons: [
              {
                title: 'Propriétés &\nMandats',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-cyan-600 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/properties',
              },
              {
                title: 'Lots &\nLogements',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-600 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/units',
              },
              {
                title: 'Documents &\nMandats PDF',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
              {
                title: 'Messagerie &\nAcquéreurs',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/messages',
              },
              {
                title: 'Notifications\nActivité',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/notifications',
              },
              {
                title: 'Chefferie &\nQuartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/quartier',
              },
            ],
          },
        ];

      case 'RESIDENT':
        return [
          {
            title: 'MA CITOYENNETÉ & RÉSIDENCE',
            subtitle: 'Enrôlement communal, attestation de résidence et contacts chefferie',
            buttons: [
              {
                title: 'Attestation de\nRésidence',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier',
                badge: 'QR OFFICIEL',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Mon Foyer &\nQuartier',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/quartier',
                badge: 'ENRÔLÉ',
                badgeBg: 'bg-rose-400 text-black',
              },
              {
                title: 'Mon Chef\nde Bloc',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-blue-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier',
              },
              {
                title: 'Chefferie de\nQuartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
              },
              {
                title: 'Actualités &\nVie Locale',
                icon: Newspaper,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/quartier',
              },
              {
                title: 'Documents &\nQuittances',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
            ],
          },
          {
            title: 'SÉCURITÉ, SOLIDARITÉ & COMMERCE',
            subtitle: 'Signalements instantanés, cotisations citoyennes et marketplace locale',
            buttons: [
              {
                title: 'Signaler une\nUrgence SOS',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/30',
                to: '/quartier',
                badge: 'SOS ALERTE',
                badgeBg: 'bg-red-500 text-white',
              },
              {
                title: 'Déclarer un\nIncident',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-orange-600 to-amber-700 text-white',
                glowClass: 'shadow-orange-500/25',
                to: '/quartier',
              },
              {
                title: 'Consignes de\nSécurité',
                icon: Shield,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/quartier',
              },
              {
                title: 'Cotisation\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'MOBILE MONEY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Marketplace\nLocale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/marketplace',
              },
              {
                title: 'Messagerie &\nVoisins',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-indigo-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/messages',
              },
              {
                title: 'Notifications\nCitoyennes',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/notifications',
              },
            ],
          },
        ];

      case 'USER':
      case 'CLIENT':
        return [
          {
            title: 'RECHERCHE & IMMOBILIER EN LIGNE',
            subtitle:
              'Explorez la marketplace, trouvez des meublés, studios et appartements vérifiés',
            buttons: [
              {
                title: 'Marketplace\nPublique',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
                badge: 'OFFRES',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Chambres &\nStudios Meublés',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/marketplace',
                badge: 'NUITÉE',
                badgeBg: 'bg-cyan-400 text-black',
              },
              {
                title: 'Appartements\n& Villas',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/marketplace',
              },
              {
                title: 'Messagerie avec\nBailleurs / Agents',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/messages',
                badge: 'DIRECT',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Mes Demandes\nde Visites',
                icon: Calendar,
                colorClass: 'bg-gradient-to-tr from-pink-600 to-rose-700 text-white',
                glowClass: 'shadow-pink-500/25',
                to: '/portal/messages',
              },
              {
                title: 'Estimation de\nPrix par IA',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-purple-600 text-white',
                glowClass: 'shadow-fuchsia-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
            ],
          },
          {
            title: 'SERVICES DE QUARTIER & PAIEMENTS',
            subtitle: 'Chefferie locale, sécurité, attestation et règlements sécurisés Ikeepay',
            buttons: [
              {
                title: 'Chefferie &\nQuartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
                badge: 'OFFICIEL',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Paiement\nMobile Money',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'IKEEPAY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Alertes &\nSécurité SOS',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/25',
                to: '/quartier',
                badge: 'SOS',
                badgeBg: 'bg-red-500 text-white',
              },
              {
                title: 'Mon Profil\nUtilisateur',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/portal/profile',
              },
              {
                title: 'Notifications\n& Alertes',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/notifications',
              },
              {
                title: 'Documents &\nReçus',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
            ],
          },
        ];

      case 'OWNER':
      case 'LANDLORD':
      default: // OWNER / Propriétaire
        return [
          {
            title: 'PATRIMOINE & GESTION LOCATIVE',
            subtitle:
              'Création, modification et suppression de propriétés, attribution des chambres/studios aux locataires et baux',
            buttons: [
              {
                title: 'Gestion des\nPropriétés',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/properties',
                badge: 'PARC IMMO',
                badgeBg: 'bg-blue-400 text-black',
              },
              {
                title: 'Gestion des\nLocataires',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-600 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/tenants',
                badge: 'LOCATAIRES',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Contrats de\nBaux Numériques',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/leases',
                badge: 'CERTIFIÉ',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Délégation de\nGestion & Mandats',
                icon: Briefcase,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/properties',
                badge: 'MANDAT',
                badgeBg: 'bg-amber-300 text-black',
              },
              {
                title: 'Mes Annonces\n& Commercialisation',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-sky-600 to-blue-700 text-white',
                glowClass: 'shadow-sky-500/25',
                to: '/owner-listings',
              },
            ],
          },
          {
            title: 'FINANCES, LOYERS & PAIEMENTS IKEEPAY',
            subtitle: 'Encaissements Mobile Money, suivi des impayés, charges et trésorerie',
            buttons: [
              {
                title: 'Encaissement\ndes Loyers',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                to: '/rent',
                badge: 'MOBILE MONEY',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Paiement\nIkeepay H2H',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-green-600 to-teal-700 text-white',
                glowClass: 'shadow-green-500/25',
                onClick: () => setIkeepayPayinOpen(true),
                badge: 'H2H',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Quittances &\nPaiements',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/payments',
              },
              {
                title: 'Dépenses &\nCharges',
                icon: TrendingDown,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/expenses',
              },
              {
                title: 'Trésorerie &\nBilan',
                icon: BarChart3,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/analytics',
              },
              {
                title: 'Marketplace\nVente & Loc',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-orange-500 to-amber-600 text-white',
                glowClass: 'shadow-orange-500/25',
                to: '/marketplace',
              },
            ],
          },
          {
            title: 'OPÉRATIONS, COMPTEURS & INTELLIGENCE ARTIFICIELLE',
            subtitle: 'Maintenance technique, documents d’archive, compteurs, IA et chefferie',
            buttons: [
              {
                title: 'Maintenance\n& Pannes',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/maintenance',
                badge: 'TICKETS',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'KatdEstate\nAI Copilot',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
              {
                title: 'Documents &\nArchives',
                icon: FolderOpen,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/documents',
              },
              {
                title: 'Messagerie &\nLocataires',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/messages',
              },
              {
                title: 'Relevé des\nCompteurs',
                icon: Gauge,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/utilities',
              },
              {
                title: 'Chefferie &\nQuartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
              },
              {
                title: 'Notifications\nde Gestion',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/notifications',
              },
              {
                title: 'Paramètres\ndu Compte',
                icon: Settings,
                colorClass: 'bg-gradient-to-tr from-slate-600 to-slate-800 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/settings',
              },
            ],
          },
        ];
    }
  };

  const sections = getSectionsForRole(userRole);

  const ROLE_NAMES: Record<string, { label: string; icon: any; color: string }> = {
    SUPER_ADMIN: {
      label: 'Direction Super Admin',
      icon: Crown,
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    },
    NEIGHBORHOOD_LEADER: {
      label: 'Chef de Quartier (Coutumier & Foncier)',
      icon: Crown,
      color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    },
    BLOCK_LEADER: {
      label: 'Chef de Bloc (Recensement de Proximité)',
      icon: ShieldCheck,
      color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    },
    OWNER: {
      label: 'Propriétaire & Bailleur Foncier',
      icon: Building2,
      color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
    },
    TENANT: {
      label: 'Locataire Résident',
      icon: Home,
      color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30',
    },
    AGENT: {
      label: 'Agent Immobilier Agréé',
      icon: Briefcase,
      color: 'text-orange-400 bg-orange-400/10 border-orange-400/30',
    },
    RESIDENT: {
      label: 'Résident & Citoyen',
      icon: Users,
      color: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    },
    USER: {
      label: 'Client / Chercheur de Biens',
      icon: Users,
      color: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
    },
    CLIENT: {
      label: 'Client / Chercheur de Biens',
      icon: Users,
      color: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
    },
  };

  const currentRoleInfo = ROLE_NAMES[userRole] || {
    label: userRole,
    icon: ShieldCheck,
    color: 'text-primary bg-primary/10 border-primary/30',
  };
  const RoleIcon = currentRoleInfo.icon;

  return (
    <div className="space-y-6 pb-16">
      {/* 1. Top Bar with Universal Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BackButton to="/" label="Accueil KatdEstate" />
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              KatdEstate Pro • Version 2.0
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Tableau de Bord des Fonctionnalités
          </h1>
          <p className="text-xs text-muted-foreground">
            Connecté en tant que{' '}
            <strong className="text-foreground">{user?.displayName || 'Utilisateur'}</strong> (
            {activeOrganization?.name || 'KatdEstate'})
          </p>
        </div>

        {/* Global Quick Action CTAs */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIkeepayPayinOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            <CreditCard className="size-4" />
            <span>Payer Mobile Money</span>
          </Button>

          {userRole === 'SUPER_ADMIN' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIkeepaySettingsOpen(true)}
              className="text-xs font-semibold border-border flex items-center gap-1.5"
            >
              <Settings className="size-4 text-emerald-500" />
              <span>Clés Ikeepay</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleLogout}
            className="bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border-rose-500/30 font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            title="Se déconnecter pour pouvoir se reconnecter à un autre compte"
          >
            <LogOut className="size-4" />
            <span>Déconnexion</span>
          </Button>
        </div>
      </div>

      {/* 2. Exclusive Role Profile Status Card (Strict Role Isolation - No unauthorized role switching) */}
      <div className="bg-card border border-border/80 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary font-bold shadow-inner">
            <RoleIcon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Espace Réservé & Certifié
              </span>
              <span
                className={`text-[11px] font-black uppercase px-2.5 py-0.5 rounded-full border ${currentRoleInfo.color}`}
              >
                {currentRoleInfo.label}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accès strictement restreint à vos attributions et prérogatives officielles.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-foreground">Session Cloisonnée</span>
        </div>
      </div>

      {/* 3. KPI Quick Metrics Bar */}
      {(() => {
        const overview = data ?? {
          incomeMinor: 24500000,
          arrearsMinor: 1200000,
          occupancyRate: 94,
          availableUnits: 3,
          expiringLeases: 2,
          openMaintenance: 1,
          expenseMinor: 3800000,
          cashflowMinor: 20700000,
        };
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Revenus validés</p>
                <p className="text-base sm:text-lg font-black text-foreground">
                  {overview.incomeMinor.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
                <Receipt className="size-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Impayés du mois</p>
                <p className="text-base sm:text-lg font-black text-rose-500">
                  {overview.arrearsMinor.toLocaleString('fr-FR')} FCFA
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
                <TrendingDown className="size-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Taux d'occupation</p>
                <p className="text-base sm:text-lg font-black text-foreground">
                  {overview.occupancyRate} %
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
                <KeyRound className="size-4" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Maintenance active</p>
                <p className="text-base sm:text-lg font-black text-foreground">
                  {overview.openMaintenance} tickets
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                <Wrench className="size-4" />
              </div>
            </div>
          </div>
        );
      })()}

      {/* 4. Categorized Feature Sections with Circular Buttons (Conforming to Screenshot) */}
      <div className="space-y-6">
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-3">
            {/* Section Header */}
            <div className="px-1 flex items-baseline justify-between">
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold tracking-wider text-muted-foreground uppercase">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="text-[11px] text-muted-foreground/80 mt-0.5">{section.subtitle}</p>
                )}
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/60">
                {section.buttons.length} actions
              </span>
            </div>

            {/* Elevated Section Card with 3-col on Mobile, 6-col on Desktop */}
            <div className="rounded-3xl bg-card border border-border/80 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-y-7 gap-x-3 sm:gap-x-4">
                {section.buttons.map((btn, bIdx) => {
                  const Icon = btn.icon;

                  const buttonContent = (
                    <div className="flex flex-col items-center text-center group cursor-pointer focus:outline-none">
                      {/* Circular Button Container with Floating Badge */}
                      <div className="relative mb-2.5">
                        {/* Floating Badge (e.g., NOUVEAU, OFFICIEL, PROMO) */}
                        {btn.badge && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm tracking-tight ${btn.badgeBg || 'bg-amber-400 text-black'}`}
                            >
                              {btn.badge}
                            </span>
                          </div>
                        )}

                        {/* Circular Action Button */}
                        <div
                          className={`size-16 sm:size-18 rounded-full flex items-center justify-center transition-all duration-300 transform group-hover:scale-110 group-active:scale-95 shadow-lg ${btn.colorClass} ${btn.glowClass}`}
                        >
                          <Icon className="size-7 sm:size-8" />
                        </div>
                      </div>

                      {/* Label under button */}
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-tight max-w-[95px] line-clamp-2">
                        {btn.title.split('\n').map((line, lIdx) => (
                          <span key={lIdx} className="block">
                            {line}
                          </span>
                        ))}
                      </span>
                    </div>
                  );

                  if (btn.onClick) {
                    return (
                      <button
                        type="button"
                        key={bIdx}
                        onClick={btn.onClick}
                        className="focus:outline-none w-full flex justify-center"
                      >
                        {buttonContent}
                      </button>
                    );
                  }

                  return (
                    <Link
                      key={bIdx}
                      to={btn.to || '#'}
                      className="focus:outline-none w-full flex justify-center"
                    >
                      {buttonContent}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 5. Mobile Floating Action Shortcuts (like in the screenshot) */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-2.5 sm:hidden">
        <button
          onClick={() => setIkeepayPayinOpen(true)}
          className="size-12 rounded-full bg-emerald-500 text-slate-950 shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          title="Paiement Mobile Money"
        >
          <CreditCard className="size-6" />
        </button>
        <Link
          to="/quartier"
          className="size-12 rounded-full bg-purple-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          title="Chefferie & Foncier"
        >
          <Crown className="size-6" />
        </Link>
      </div>

      {/* 6. Modals */}
      <IkeepayModal
        isOpen={ikeepayPayinOpen}
        onClose={() => setIkeepayPayinOpen(false)}
        amount={250000}
        title="Règlement Mobile Money Ikeepay"
        onPaymentSuccess={(ref: string) => {
          setIkeepayPayinOpen(false);
          alert(`Paiement Mobile Money validé avec succès ! Référence : ${ref}`);
        }}
      />

      <IkeepaySettingsModal
        isOpen={ikeepaySettingsOpen}
        onClose={() => setIkeepaySettingsOpen(false)}
      />
    </div>
  );
}
