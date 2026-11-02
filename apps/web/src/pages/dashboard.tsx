import { useState } from 'react';
import { Link } from 'react-router-dom';
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
  TrendingUp,
  Wallet,
  Globe,
  Plus,
  Newspaper,
  Calendar,
  MessageSquare,
  Smartphone,
  Store,
  FolderOpen,
  Shield
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
  const { activeOrganization } = useOrganization();
  const { user, memberships } = useSession();
  const { data } = useOrgQuery<Overview>(['dashboard'], '/dashboard');

  // Detect active role
  const detectedRole = memberships?.[0]?.role || (user as any)?.platformRole || 'OWNER';
  const [activeTabRole, setActiveTabRole] = useState<string>(detectedRole);

  // Modals state
  const [ikeepayPayinOpen, setIkeepayPayinOpen] = useState(false);
  const [ikeepaySettingsOpen, setIkeepaySettingsOpen] = useState(false);

  // Build categorized button sections according to the active role
  const getSectionsForRole = (role: string): AppSection[] => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          {
            title: 'AUTORITÉS & GOUVERNANCE TERRITORIALE',
            subtitle: 'Supervision des chefferies coutumières, découpage des secteurs et audit',
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
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/admin-marketplace',
                badge: 'VALIDATION',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Parc\nImmobilier',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/properties',
              },
              {
                title: 'Audit &\nSécurité',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/platform',
              },
            ],
          },
          {
            title: 'COMMERCE, MARCHÉ & PAIEMENTS',
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
                title: 'Marketplace\nNationale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
              {
                title: 'Suivi des\nLoyers',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-green-600 to-emerald-700 text-white',
                glowClass: 'shadow-green-500/25',
                to: '/rent',
                badge: 'RÉSEAU',
                badgeBg: 'bg-green-400 text-black',
              },
              {
                title: 'Statistiques\nGlobales',
                icon: TrendingUp,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/analytics',
                badge: 'EN DIRECT',
                badgeBg: 'bg-rose-400 text-black',
              },
              {
                title: 'KadtEstate\nAI Copilot',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/ai',
                badge: 'IA V2',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
            ],
          },
        ];

      case 'NEIGHBORHOOD_LEADER':
        return [
          {
            title: 'FONCIER & ACTES COUTUMIERS',
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
                title: 'Locations &\nBaux',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-600 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier',
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
                title: 'Commissions\nChefferie',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-green-600 to-emerald-700 text-white',
                glowClass: 'shadow-green-500/25',
                to: '/quartier',
                badge: 'DROITS',
                badgeBg: 'bg-green-400 text-black',
              },
              {
                title: 'Registre\nFoncier',
                icon: FileText,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-sky-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier',
              },
            ],
          },
          {
            title: 'ORGANISATION & SÉCURITÉ DU QUARTIER',
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
                to: '/quartier',
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
                title: 'Communications\nHabitants',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-indigo-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/messages',
              },
              {
                title: 'Carte\nInteractive',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier',
              },
              {
                title: 'Marketplace\nLocale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
            ],
          },
        ];

      case 'BLOCK_LEADER':
        return [
          {
            title: 'RECENSEMENT DE PROXIMITÉ',
            subtitle: 'Enrôlement terrain des habitations, immeubles et familles',
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
                to: '/quartier',
              },
              {
                title: 'Immeubles &\nLogements',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/units',
              },
              {
                title: 'Statistiques\ndu Bloc',
                icon: TrendingUp,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/quartier',
                badge: 'DONNÉES',
                badgeBg: 'bg-indigo-300 text-black',
              },
            ],
          },
          {
            title: 'SÉCURITÉ & VIE DU BLOC',
            subtitle: 'Gestion des signalements de proximité et liaisons d’urgence',
            buttons: [
              {
                title: 'Signaler un\nIncident',
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
                title: 'Permanence\nde Garde',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/quartier',
              },
            ],
          },
        ];

      case 'TENANT':
        return [
          {
            title: 'MON LOGEMENT & BAIL',
            subtitle: 'Contrat certifié, inventaire et assistance technique',
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
            title: 'PAIEMENTS & SERVICES MOBILES',
            subtitle: 'Règlement instantané sécurisé par Orange, MTN, Wave ou Moov',
            buttons: [
              {
                title: 'Payer mon\nLoyer',
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
                title: 'Alertes du\nQuartier',
                icon: Bell,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier',
                badge: 'INFOS',
                badgeBg: 'bg-purple-300 text-black',
              },
            ],
          },
        ];

      case 'AGENT':
        return [
          {
            title: 'MANDATS & MARKETPLACE',
            subtitle: 'Diffusion de biens vérifiés, suivi des acquéreurs et visites',
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
                title: 'Mes Mandats\nExclusifs',
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
              {
                title: 'Estimation de\nPrix IA',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white',
                glowClass: 'shadow-fuchsia-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
            ],
          },
          {
            title: 'COMMISSIONS & ENCAISSEMENTS',
            subtitle: 'Calcul des honoraires d’agence et retraits Mobile Money',
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
                title: 'Retrait\nIkeepay',
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
                title: 'Performance &\nVentes',
                icon: TrendingUp,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/analytics',
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
            ],
          },
          {
            title: 'SÉCURITÉ & SOLIDARITÉ',
            subtitle: 'Signalements instantanés et consignes d’urgence du secteur',
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
                title: 'Marketplace\nLocale',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/marketplace',
              },
            ],
          },
        ];

      default: // OWNER / Propriétaire
        return [
          {
            title: 'PATRIMOINE & GESTION LOCATIVE',
            subtitle: 'Pilotage de vos résidences, logements, baux et locataires',
            buttons: [
              {
                title: 'Mes Propriétés\n& Immeubles',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/properties',
                badge: 'ACTIF',
                badgeBg: 'bg-blue-400 text-black',
              },
              {
                title: 'Logements &\nLots',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-600 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/units',
              },
              {
                title: 'Contrats de\nBaux',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/leases',
                badge: 'JURIDIQUE',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Répertoire\nLocataires',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-600 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/tenants',
              },
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
                title: 'KadtEstate\nAI Copilot',
                icon: Sparkles,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-fuchsia-600 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/ai',
                badge: 'IA',
                badgeBg: 'bg-fuchsia-400 text-black',
              },
            ],
          },
          {
            title: 'FINANCES, LOYERS & PAIEMENTS',
            subtitle: 'Encaissements Mobile Money, suivi des impayés et trésorerie',
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
                title: 'Quittances &\nFactures',
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
                icon: TrendingUp,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/analytics',
              },
              {
                title: 'Marketplace\nVente',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-orange-500 to-amber-600 text-white',
                glowClass: 'shadow-orange-500/25',
                to: '/marketplace',
              },
            ],
          },
        ];
    }
  };

  const sections = getSectionsForRole(activeTabRole);

  return (
    <div className="space-y-6 pb-16">
      
      {/* 1. Top Bar with Universal Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BackButton to="/" label="Accueil KadtEstate" />
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              KadtEstate Pro • Version 2.0
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
            Tableau de Bord des Fonctionnalités
          </h1>
          <p className="text-xs text-muted-foreground">
            Connecté en tant que <strong className="text-foreground">{user?.displayName || 'Utilisateur'}</strong> ({activeOrganization?.name || 'KadtEstate'})
          </p>
        </div>

        {/* Global Quick Action CTAs */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIkeepayPayinOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            <CreditCard className="size-4" />
            <span>Payer Mobile Money</span>
          </Button>

          {activeTabRole === 'SUPER_ADMIN' && (
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
        </div>
      </div>

      {/* 2. Role Switcher Bar: Allows previewing and switching between any role immediately */}
      <div className="bg-card border border-border p-2.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-2">
          <Sparkles className="size-3.5 text-emerald-500" />
          <span>Profil / Perspective active :</span>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'SUPER_ADMIN', label: 'Super Admin' },
            { id: 'NEIGHBORHOOD_LEADER', label: 'Chef de Quartier' },
            { id: 'BLOCK_LEADER', label: 'Chef de Bloc' },
            { id: 'OWNER', label: 'Propriétaire' },
            { id: 'TENANT', label: 'Locataire' },
            { id: 'AGENT', label: 'Agent Immobilier' },
            { id: 'RESIDENT', label: 'Résident' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveTabRole(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTabRole === r.id
                  ? 'bg-primary text-primary-foreground shadow-sm scale-105'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. KPI Quick Metrics Bar */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Revenus validés</p>
              <p className="text-base sm:text-lg font-black text-foreground">{data.incomeMinor.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
              <Receipt className="size-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Impayés du mois</p>
              <p className="text-base sm:text-lg font-black text-rose-500">{data.arrearsMinor.toLocaleString('fr-FR')} FCFA</p>
            </div>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500">
              <TrendingDown className="size-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Taux d'occupation</p>
              <p className="text-base sm:text-lg font-black text-foreground">{data.occupancyRate} %</p>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500">
              <KeyRound className="size-4" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground font-medium">Maintenance active</p>
              <p className="text-base sm:text-lg font-black text-foreground">{data.openMaintenance} tickets</p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
              <Wrench className="size-4" />
            </div>
          </div>
        </div>
      )}

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
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-sm tracking-tight ${btn.badgeBg || 'bg-amber-400 text-black'}`}>
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
                          <span key={lIdx} className="block">{line}</span>
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