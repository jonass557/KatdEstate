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
  Send,
  Flame,
  UserCheck,
  Settings,
  Sparkles,
  QrCode,
  MapPin,
  Bell,
  AlertTriangle,
  Wallet,
  Globe,
  Plus,
  Calendar,
  MessageSquare,
  Store,
  FolderOpen,
  LogOut,
  Gauge,
  BarChart3,
  BedDouble,
} from 'lucide-react';
import { PublishListingModal } from '../components/marketplace/publish-listing-modal';
import { useOrganization } from '../app/organization';
import { useSession } from '../app/session';
import { BackButton } from '../components/ui/back-button';
import { Button } from '../components/ui/button';
import { useOrgQuery } from '../lib/query';
import { IkeepayModal } from '../components/payments/ikeepay-modal';
import { IkeepaySettingsModal } from '../components/admin/ikeepay-settings-modal';
import { AdminNotificationApiSettingsModal } from '../components/admin/notification-api-settings-modal';
import { OwnerReportProblemModal } from '../components/quartier/OwnerReportProblemModal';
import { Modal } from '../components/ui/dialog';
import {
  getBlockOwners,
  getStoredBlocks,
  getHierarchyMessages,
  sendHierarchyMessage,
} from '../lib/katdestate-store';

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
  const [notifApiSettingsOpen, setNotifApiSettingsOpen] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [ownerProblemModalOpen, setOwnerProblemModalOpen] = useState(false);
  const [ownerMsgModalOpen, setOwnerMsgModalOpen] = useState(false);
  const [ownerMsgSubject, setOwnerMsgSubject] = useState('');
  const [ownerMsgBody, setOwnerMsgBody] = useState('');
  const [ownerMsgSentNotice, setOwnerMsgSentNotice] = useState(false);

  // Distinction stricte : Propriétaire créé par un Chef de Bloc vs Propriétaire indépendant
  const normalizedUserEmail = user?.email?.trim().toLowerCase();
  const matchedBlockOwner = normalizedUserEmail
    ? getBlockOwners().find(
        (o) =>
          o.email?.trim().toLowerCase() === normalizedUserEmail &&
          o.createdByBlockLeader === true,
      )
    : undefined;
  const isCreatedByBlockLeader = Boolean(matchedBlockOwner);
  const assignedLeaderBlock = matchedBlockOwner
    ? getStoredBlocks().find((b) => b.id === matchedBlockOwner.blockId)
    : undefined;

  const publisherMarketplaceButtons: AppButton[] = [
    {
      title: 'Publier une\nAnnonce',
      icon: Plus,
      colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
      glowClass: 'shadow-emerald-500/25',
      onClick: () => setPublishModalOpen(true),
      badge: 'CARTE GPS',
      badgeBg: 'bg-emerald-400 text-black',
    },
    {
      title: 'Gestion des\nMeublés',
      icon: BedDouble,
      colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
      glowClass: 'shadow-amber-500/25',
      to: '/publisher/meubles',
      badge: 'JOUR',
      badgeBg: 'bg-amber-300 text-black',
    },
    {
      title: 'Gestion des\nImmobiliers',
      icon: Building2,
      colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
      glowClass: 'shadow-blue-500/25',
      to: '/publisher/listings',
      badge: 'MES BIENS',
      badgeBg: 'bg-blue-300 text-black',
    },
    {
      title: 'Gestion des\nUtilisateurs',
      icon: Users,
      colorClass: 'bg-gradient-to-tr from-indigo-600 to-cyan-700 text-white',
      glowClass: 'shadow-indigo-500/25',
      to: '/publisher/users',
      badge: 'VISITES',
      badgeBg: 'bg-cyan-300 text-black',
    },
    {
      title: 'Performance &\nStatistiques',
      icon: BarChart3,
      colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
      glowClass: 'shadow-rose-500/25',
      to: '/publisher/stats',
    },
    {
      title: 'Messagerie\nClients',
      icon: MessageSquare,
      colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-700 text-white',
      glowClass: 'shadow-purple-500/25',
      to: '/messages',
    },
    {
      title: 'Signaler un\nProblème',
      icon: AlertTriangle,
      colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
      glowClass: 'shadow-red-500/25',
      to: '/publisher/support',
      badge: 'ADMIN',
      badgeBg: 'bg-rose-300 text-black',
    },
    {
      title: 'Estimation du\nPrix IA',
      icon: Sparkles,
      colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-pink-600 text-white',
      glowClass: 'shadow-fuchsia-500/25',
      to: '/ai?tab=estimate',
      badge: 'IA',
      badgeBg: 'bg-fuchsia-400 text-black',
    },
  ];

  // Build categorized button sections according to the active role
  const getSectionsForRole = (role: string): AppSection[] => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          {
            title: 'ADMINISTRATION PLATEFORME, CHEFFERIES & SOUSCRIPTIONS',
            subtitle:
              'Supervision des chefferies, blocs, propriétaires, agents immobiliers, abonnements et support',
            buttons: [
              {
                title: 'Gestion des\nChefferies',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/admin/chefferies',
                badge: 'CHEFFERIES',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Gestion\ndes Blocs',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-blue-600 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/admin/blocks',
                badge: 'BLOCS',
                badgeBg: 'bg-cyan-400 text-black',
              },
              {
                title: 'Gestion des\nPropriétaires',
                icon: Building2,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/admin/owners',
                badge: 'BLOCS',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Gestion des\nPropriétaires Indép.',
                icon: Home,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/admin/independent-owners',
                badge: 'INDÉP.',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Gestion des\nAgents Immobiliers',
                icon: Briefcase,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/admin/agents',
                badge: 'AGENTS',
                badgeBg: 'bg-amber-300 text-black',
              },
              {
                title: 'Gestion des\nAbonnements',
                icon: CreditCard,
                colorClass: 'bg-gradient-to-tr from-fuchsia-600 to-purple-700 text-white',
                glowClass: 'shadow-fuchsia-500/25',
                to: '/admin/subscriptions',
                badge: 'PLANS',
                badgeBg: 'bg-fuchsia-300 text-black',
              },
            ],
          },
          {
            title: 'CARTOGRAPHIE, SUPPORT & CONFIGURATION APIS',
            subtitle:
              'Carte générale des quartiers/blocs/propriétés, support signalements et clés API Ikeepay / SMS / Appel',
            buttons: [
              {
                title: 'Carte Générale\nQuartiers & Blocs',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-cyan-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/geo-map',
                badge: 'CARTOGRAPHIE',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Support Signalement\nPublieurs & Clients',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-red-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/publisher/support',
                badge: 'SUPPORT',
                badgeBg: 'bg-rose-300 text-black',
              },
              {
                title: 'Config Clé API\nIkeepay',
                icon: KeyRound,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                onClick: () => setIkeepaySettingsOpen(true),
                badge: 'IKEEPAY',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Paramètres API\nSMS / Appel / Email',
                icon: Settings,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-violet-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                onClick: () => setNotifApiSettingsOpen(true),
                badge: 'API NOTIF',
                badgeBg: 'bg-indigo-300 text-black',
              },
            ],
          },
        ];

      case 'NEIGHBORHOOD_LEADER':
        return [
          {
            title: 'GOUVERNANCE, CARTOGRAPHIE & CHEFS DE BLOC',
            subtitle: 'Création des chefs de bloc, délimitation GPS du quartier/blocs et gestion des habitants',
            buttons: [
              {
                title: 'Gestion des\nChefs de Bloc',
                icon: ShieldCheck,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-emerald-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/quartier?tab=leaders',
                badge: 'CRÉER & GÉRER',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Cartographie &\nZones Blocs',
                icon: MapPin,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/quartier?tab=cartographie',
                badge: 'GPS & ZONES',
                badgeBg: 'bg-cyan-300 text-black',
              },
              {
                title: 'Carte Géographique\nGénérale',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/geo-map',
                badge: '3 NIVEAUX',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Habitants &\nRéassignation',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/quartier?tab=habitants',
                badge: 'RÉASSIGNER',
                badgeBg: 'bg-rose-400 text-black',
              },
            ],
          },
          {
            title: 'ACTES COUTUMIERS, FINANCES & COMMUNICATION',
            subtitle: 'Attestations officielles, loyers mensuels des blocs, diffusion ciblée et alertes',
            buttons: [
              {
                title: 'Attestations\nCoutumières QR',
                icon: QrCode,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/quartier?tab=attestations',
                badge: 'ACTES',
                badgeBg: 'bg-yellow-400 text-black',
              },
              {
                title: 'Finances &\nCotisations',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-green-600 to-emerald-700 text-white',
                glowClass: 'shadow-green-500/25',
                to: '/quartier?tab=finances',
                badge: 'LOYERS BLOCS',
                badgeBg: 'bg-green-400 text-black',
              },
              {
                title: 'Message Global\nQuartier',
                icon: Send,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/quartier?tab=broadcast',
                badge: 'DIFFUSION',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Alertes &\nIncidents',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/25',
                to: '/quartier?tab=incidents',
                badge: 'SIGNALEMENTS',
                badgeBg: 'bg-red-300 text-black',
              },
            ],
          },
          {
            title: 'PUBLICATION MARKETPLACE, MEUBLÉS & OUTILS IA',
            subtitle: 'Publiez vos annonces et meublés avec carte GPS, suivez vos visites et utilisez l’IA',
            buttons: [
              ...publisherMarketplaceButtons,
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
            title: 'SECTEUR, PROPRIÉTAIRES & RAPPORT FINANCIER',
            subtitle: 'Carte du secteur assigné, création/suivi des propriétaires et paiements locatifs mensuels',
            buttons: [
              {
                title: 'Carte du\nSecteur',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-slate-700 to-slate-900 text-white',
                glowClass: 'shadow-slate-500/25',
                to: '/quartier?tab=cartographie',
                badge: 'MON BLOC',
                badgeBg: 'bg-cyan-400 text-black',
              },
              {
                title: 'Gestion des\nPropriétaires',
                icon: UserCheck,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/quartier?tab=proprietaires',
                badge: 'STATS & ID',
                badgeBg: 'bg-teal-300 text-black',
              },
              {
                title: 'Rapport Financier\ndes Propriétaires',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-green-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/quartier?tab=rapport-financier',
                badge: 'MENSUEL',
                badgeBg: 'bg-emerald-300 text-black',
              },
              {
                title: 'Habitants &\nCotisations',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/quartier?tab=habitants',
                badge: 'RECENSEMENT',
                badgeBg: 'bg-blue-300 text-black',
              },
            ],
          },
          {
            title: 'COMMUNICATION, SIGNALEMENT & PUBLICATIONS',
            subtitle: 'Messagerie aux propriétaires, communication avec le Chef de Quartier et publications par catégorie',
            buttons: [
              {
                title: 'Messagerie aux\nPropriétaires',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-purple-600 to-violet-700 text-white',
                glowClass: 'shadow-purple-500/25',
                to: '/quartier?tab=messagerie-proprietaires',
                badge: 'GROUPE / PRIVÉ',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Message au\nChef de Quartier',
                icon: Crown,
                colorClass: 'bg-gradient-to-tr from-indigo-600 to-purple-700 text-white',
                glowClass: 'shadow-indigo-500/25',
                to: '/quartier?tab=messagerie-quartier',
                badge: 'CHEFFERIE',
                badgeBg: 'bg-indigo-300 text-black',
              },
              {
                title: 'Signalement\nde mon Bloc',
                icon: Flame,
                colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                glowClass: 'shadow-red-500/25',
                to: '/quartier?tab=incidents',
                badge: 'CHEF QUARTIER',
                badgeBg: 'bg-red-400 text-white',
              },
              {
                title: 'Publier une\nAnnonce',
                icon: Plus,
                colorClass: 'bg-gradient-to-tr from-cyan-600 to-blue-700 text-white',
                glowClass: 'shadow-cyan-500/25',
                to: '/quartier?tab=publier-annonce',
                badge: 'CATÉGORIES',
                badgeBg: 'bg-yellow-400 text-black',
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
          {
            title: 'PUBLICATION MARKETPLACE, MEUBLÉS & OUTILS IA',
            subtitle: 'Publiez vos annonces et meublés avec carte GPS, suivez vos visites et utilisez l’IA',
            buttons: publisherMarketplaceButtons,
          },
        ];

      case 'TENANT':
        return [
          {
            title: 'MA PROPRIÉTÉ, MON PORTEFEUILLE & MON CONTRAT',
            subtitle:
              'Rechargez votre portefeuille via Mobile Money avant de transférer votre loyer, gérez vos quittances et consultez votre bail',
            buttons: [
              {
                title: 'Ma Propriété &\nMon Portefeuille',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                to: '/portal',
                badge: 'PORTEFEUILLE',
                badgeBg: 'bg-emerald-400 text-black',
              },
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
                title: 'Gestion des Quittances\n& Factures',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/portal/receipts',
                badge: 'EAU & ÉLEC',
                badgeBg: 'bg-amber-400 text-black',
              },
              {
                title: 'Factures &\nÉchéances',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/portal/invoices',
                badge: 'TÉLÉCHARGER',
                badgeBg: 'bg-rose-300 text-black',
              },
              {
                title: 'Suivi de mes\nPaiements',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/portal/payments',
                badge: 'HISTORIQUE',
                badgeBg: 'bg-teal-300 text-black',
              },
            ],
          },
          {
            title: 'COMMUNICATION, ASSISTANCE & PROFIL RÉSIDENT',
            subtitle: 'Discutez avec votre propriétaire, signalez une panne ou accédez à votre profil et la marketplace',
            buttons: [
              {
                title: 'Discuter avec\nle Propriétaire',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/portal/messages',
                badge: 'DIRECT',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Signaler\nune Panne',
                icon: Wrench,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-pink-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/portal/maintenance',
                badge: 'TICKET',
                badgeBg: 'bg-rose-400 text-black',
              },
              {
                title: 'Mon Profil\nRésident',
                icon: Users,
                colorClass: 'bg-gradient-to-tr from-teal-600 to-cyan-700 text-white',
                glowClass: 'shadow-teal-500/25',
                to: '/portal/profile',
                badge: 'FICHE',
                badgeBg: 'bg-cyan-300 text-black',
              },
              {
                title: 'Marketplace\nBiens & Locs',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-amber-600 to-orange-700 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/marketplace',
              },
            ],
          },
        ];

      case 'AGENT':
        return [
          {
            title: 'ESPACE AGENT IMMOBILIER',
            subtitle:
              'Publication Marketplace avec carte GPS, gestion des meublés (location journalière), immobiliers, visites, statistiques et estimation IA',
            buttons: publisherMarketplaceButtons,
          },
        ];

      case 'USER':
      case 'CLIENT':
        return [
          {
            title: 'ESPACE UTILISATEUR / VISITEUR (100% GRATUIT)',
            subtitle:
              'Trouvez votre bien sur la Marketplace, suivez vos commandes, discutez avec les propriétaires et naviguez par GPS en temps réel',
            buttons: [
              {
                title: 'Marketplace\n& Carte GPS',
                icon: Store,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-teal-600 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/marketplace',
                badge: 'GPS DIRECT',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Historique des\nCommandes',
                icon: Calendar,
                colorClass: 'bg-gradient-to-tr from-blue-600 to-indigo-700 text-white',
                glowClass: 'shadow-blue-500/25',
                to: '/user/orders',
                badge: 'PROPRIÉTÉS',
                badgeBg: 'bg-blue-300 text-black',
              },
              {
                title: 'Conversations\nPropriétaires',
                icon: MessageSquare,
                colorClass: 'bg-gradient-to-tr from-violet-600 to-purple-700 text-white',
                glowClass: 'shadow-violet-500/25',
                to: '/messages',
                badge: 'MESSAGES',
                badgeBg: 'bg-purple-300 text-black',
              },
              {
                title: 'Signaler un\nProblème Support',
                icon: AlertTriangle,
                colorClass: 'bg-gradient-to-tr from-rose-600 to-red-700 text-white',
                glowClass: 'shadow-rose-500/25',
                to: '/publisher/support',
                badge: 'SUPPORT',
                badgeBg: 'bg-rose-300 text-black',
              },
            ],
          },
        ];

      case 'INDEPENDENT_OWNER':
        return [
          {
            title: 'ESPACE PROPRIÉTAIRE INDÉPENDANT',
            subtitle:
              'Publication Marketplace avec carte GPS, gestion des meublés & comptes à rebours clients, immobiliers, visites, statistiques et estimation IA',
            buttons: publisherMarketplaceButtons,
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
                to: '/owner-listings?tab=mandates',
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
              {
                title: 'Cartographie\n& Parc GPS',
                icon: Globe,
                colorClass: 'bg-gradient-to-tr from-emerald-600 to-teal-700 text-white',
                glowClass: 'shadow-emerald-500/25',
                to: '/geo-map',
                badge: 'CARTE',
                badgeBg: 'bg-emerald-400 text-black',
              },
            ],
          },
          {
            title: 'FINANCES, GESTION DES LOYERS & QUITTANCES',
            subtitle:
              'Portefeuille Gestion des Loyers, Portefeuille Gestion des Quittances et Factures, retraits Mobile Money',
            buttons: [
              {
                title: 'Gestion\ndes Loyers',
                icon: Wallet,
                colorClass: 'bg-gradient-to-tr from-emerald-500 to-green-600 text-white',
                glowClass: 'shadow-emerald-500/30',
                to: '/rent',
                badge: 'PORTEFEUILLE',
                badgeBg: 'bg-emerald-400 text-black',
              },
              {
                title: 'Gestion des Quittances\net Factures',
                icon: Receipt,
                colorClass: 'bg-gradient-to-tr from-amber-500 to-orange-600 text-white',
                glowClass: 'shadow-amber-500/25',
                to: '/payments',
                badge: 'PORTEFEUILLE',
                badgeBg: 'bg-amber-300 text-black',
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
              ...(isCreatedByBlockLeader
                ? [
                    {
                      title: 'Signaler Problème\nau Chef de Bloc',
                      icon: AlertTriangle,
                      colorClass: 'bg-gradient-to-tr from-red-600 to-rose-700 text-white',
                      glowClass: 'shadow-red-500/25',
                      onClick: () => setOwnerProblemModalOpen(true),
                      badge: 'SECTEUR',
                      badgeBg: 'bg-red-300 text-black',
                    },
                    {
                      title: 'Messagerie avec\nChef de Bloc',
                      icon: ShieldCheck,
                      colorClass: 'bg-gradient-to-tr from-cyan-600 to-teal-700 text-white',
                      glowClass: 'shadow-cyan-500/25',
                      onClick: () => setOwnerMsgModalOpen(true),
                      badge: 'DIRECT',
                      badgeBg: 'bg-cyan-300 text-black',
                    },
                  ]
                : []),
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
          {
            title: 'PUBLICATION MARKETPLACE, MEUBLÉS & OUTILS IA',
            subtitle: 'Publiez vos annonces et meublés avec carte GPS, suivez vos visites et utilisez l’IA',
            buttons: publisherMarketplaceButtons,
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
    INDEPENDENT_OWNER: {
      label: 'Propriétaire Indépendant',
      icon: Home,
      color: 'text-teal-400 bg-teal-400/10 border-teal-400/30',
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

      {/* 5. Mobile Floating Action Shortcuts */}
      <div className="fixed bottom-6 right-4 z-40 flex flex-col gap-2.5 sm:hidden">
        <button
          onClick={() => setIkeepayPayinOpen(true)}
          className="size-12 rounded-full bg-emerald-500 text-slate-950 shadow-xl flex items-center justify-center active:scale-95 transition-transform"
          title="Paiement Mobile Money"
        >
          <CreditCard className="size-6" />
        </button>
        {(userRole === 'NEIGHBORHOOD_LEADER' || userRole === 'BLOCK_LEADER' || userRole === 'SUPER_ADMIN') && (
          <Link
            to="/quartier"
            className="size-12 rounded-full bg-purple-600 text-white shadow-xl flex items-center justify-center active:scale-95 transition-transform"
            title="Chefferie & Foncier"
          >
            <Crown className="size-6" />
          </Link>
        )}
      </div>

      {/* 6. Modals */}
      <OwnerReportProblemModal
        isOpen={ownerProblemModalOpen}
        onClose={() => setOwnerProblemModalOpen(false)}
      />

      {/* Modal Messagerie Propriétaire -> Chef de Bloc */}
      <Modal
        open={ownerMsgModalOpen}
        onOpenChange={(open) => {
          setOwnerMsgModalOpen(open);
          if (!open) setOwnerMsgSentNotice(false);
        }}
        title={`Messagerie avec mon Chef de Bloc (${assignedLeaderBlock?.leaderName || 'Chef de Bloc'})`}
      >
        <div className="space-y-4 text-xs">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 space-y-0.5">
            <p className="font-bold text-foreground">
              Destinataire : {assignedLeaderBlock?.leaderName || 'Votre Chef de Bloc'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Secteur : {assignedLeaderBlock?.name || matchedBlockOwner?.blockName || 'Bloc attribué'} • Email : {assignedLeaderBlock?.leaderEmail || 'chef.bloc@katdestate.immo'}
            </p>
          </div>

          {/* Messages échangés */}
          <div className="max-h-44 overflow-y-auto space-y-2 border border-border rounded-xl p-2.5 bg-muted/20">
            {getHierarchyMessages()
              .filter(
                (m) =>
                  (m.senderEmail === normalizedUserEmail && m.recipientType === 'BLOCK_LEADER') ||
                  (m.recipientType === 'ALL_BLOCK_OWNERS' && m.blockId === matchedBlockOwner?.blockId) ||
                  (m.recipientType === 'OWNER' && m.recipientEmail === normalizedUserEmail),
              )
              .map((m) => (
                <div key={m.id} className="rounded-lg border border-border bg-background p-2 space-y-0.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <strong className="text-foreground">{m.senderName}</strong>
                    <span>{new Date(m.createdAt).toLocaleString('fr-FR')}</span>
                  </div>
                  <p className="font-semibold text-primary">{m.subject}</p>
                  <p className="text-foreground">{m.body}</p>
                </div>
              ))}
          </div>

          {ownerMsgSentNotice && (
            <p className="text-emerald-600 font-bold text-xs">
              ✅ Message transmis à votre Chef de Bloc !
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ownerMsgBody.trim()) return;
              sendHierarchyMessage({
                senderEmail: normalizedUserEmail || '',
                senderName: user?.displayName || matchedBlockOwner?.fullName || 'Propriétaire',
                senderRole: 'OWNER',
                recipientType: 'BLOCK_LEADER',
                recipientEmail: assignedLeaderBlock?.leaderEmail || 'chef.bloc@katdestate.immo',
                recipientName: assignedLeaderBlock?.leaderName || 'Chef de Bloc',
                blockId: matchedBlockOwner?.blockId,
                blockName: assignedLeaderBlock?.name || matchedBlockOwner?.blockName,
                subject: ownerMsgSubject.trim() || 'Message du propriétaire',
                body: ownerMsgBody.trim(),
              });
              setOwnerMsgSubject('');
              setOwnerMsgBody('');
              setOwnerMsgSentNotice(true);
            }}
            className="space-y-2.5"
          >
            <input
              type="text"
              placeholder="Objet du message..."
              value={ownerMsgSubject}
              onChange={(e) => setOwnerMsgSubject(e.target.value)}
              className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs"
            />
            <textarea
              rows={3}
              required
              placeholder="Écrivez votre message à votre Chef de Bloc..."
              value={ownerMsgBody}
              onChange={(e) => setOwnerMsgBody(e.target.value)}
              className="w-full rounded-xl border border-input bg-background p-2.5 text-xs"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setOwnerMsgModalOpen(false)}>
                Fermer
              </Button>
              <Button type="submit" size="sm" className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold">
                Envoyer au Chef de Bloc
              </Button>
            </div>
          </form>
        </div>
      </Modal>

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

      <AdminNotificationApiSettingsModal
        isOpen={notifApiSettingsOpen}
        onClose={() => setNotifApiSettingsOpen(false)}
      />

      <PublishListingModal
        isOpen={publishModalOpen}
        onClose={() => setPublishModalOpen(false)}
      />
    </div>
  );
}
