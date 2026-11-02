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
  Bot, 
  Settings, 
  Sparkles, 
  QrCode, 
  MapPin, 
  Bell, 
  AlertTriangle, 
  ArrowUpRight,
  TrendingUp,
  Wallet
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

interface ActionCard {
  title: string;
  description: string;
  icon: any;
  to?: string;
  onClick?: () => void;
  gradient: string;
  badge?: string;
  badgeColor?: string;
}

export function DashboardPage() {
  const { activeOrganization } = useOrganization();
  const { user, memberships } = useSession();
  const { data } = useOrgQuery<Overview>(['dashboard'], '/dashboard');

  // Detect active role
  const userRole = memberships?.[0]?.role || (user as any)?.platformRole || 'OWNER';
  const isSuperAdmin = userRole === 'SUPER_ADMIN' || (user as any)?.platformRole === 'SUPER_ADMIN';

  // State for switching preview role if desired
  const [activeTabRole, setActiveTabRole] = useState<string>(userRole);

  // Modals state
  const [ikeepayPayinOpen, setIkeepayPayinOpen] = useState(false);
  const [ikeepaySettingsOpen, setIkeepaySettingsOpen] = useState(false);

  // Action Buttons categorized by role
  const getActionCards = (role: string): ActionCard[] => {
    switch (role) {
      case 'SUPER_ADMIN':
        return [
          {
            title: 'Passerelle Ikeepay H2H',
            description: 'Configurer les clés API Publiques & Secrètes Ikeepay',
            icon: CreditCard,
            onClick: () => setIkeepaySettingsOpen(true),
            gradient: 'from-emerald-600 to-teal-700',
            badge: 'Paiements H2H',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Chefferie & Gouvernance',
            description: 'Superviser les arrondissements, chefferies et commissions',
            icon: Crown,
            to: '/quartier',
            gradient: 'from-purple-600 to-indigo-700',
            badge: 'Territoire',
            badgeColor: 'bg-purple-500/20 text-purple-300',
          },
          {
            title: 'Modération Marketplace',
            description: 'Valider et certifier les annonces de vente et location',
            icon: Building2,
            to: '/admin-marketplace',
            gradient: 'from-blue-600 to-cyan-700',
            badge: 'Catalogue',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
          {
            title: 'Recensement & Sécurité',
            description: 'Découpage des blocs et validation des chefs de quartier',
            icon: ShieldCheck,
            to: '/quartier',
            gradient: 'from-cyan-600 to-blue-700',
            badge: 'Sécurité',
            badgeColor: 'bg-cyan-500/20 text-cyan-300',
          },
          {
            title: 'Statistiques Globales',
            description: 'Taux de recouvrement, flux foncier et volume de loyers',
            icon: TrendingUp,
            to: '/analytics',
            gradient: 'from-rose-600 to-orange-700',
            badge: 'KPIs Réseau',
            badgeColor: 'bg-rose-500/20 text-rose-300',
          },
          {
            title: 'Parc Immobilier Global',
            description: 'Vue d’ensemble des résidences, baux et immeubles',
            icon: Home,
            to: '/properties',
            gradient: 'from-slate-700 to-slate-900',
            badge: 'Patrimoine',
            badgeColor: 'bg-slate-500/20 text-slate-300',
          },
        ];

      case 'TENANT':
        return [
          {
            title: 'Payer mon Loyer (Ikeepay)',
            description: 'Règlement instantané via Orange, MTN, Wave ou Moov',
            icon: CreditCard,
            onClick: () => setIkeepayPayinOpen(true),
            gradient: 'from-emerald-500 to-teal-600',
            badge: 'Mobile Money',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Mes Quittances & Reçus',
            description: 'Consulter et télécharger mes quittances horodatées',
            icon: Receipt,
            to: '/portal/receipts',
            gradient: 'from-blue-600 to-indigo-600',
            badge: 'Certifié Conforme',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
          {
            title: 'Mon Contrat de Bail',
            description: 'Détails du loyer, échéances et inventaire d’entrée',
            icon: FileText,
            to: '/portal/lease',
            gradient: 'from-purple-600 to-violet-700',
            badge: 'Bail Actif',
            badgeColor: 'bg-purple-500/20 text-purple-300',
          },
          {
            title: 'Signaler une Panne',
            description: 'Déclarer un incident ou une demande de réparation',
            icon: Wrench,
            to: '/portal/maintenance',
            gradient: 'from-amber-600 to-orange-600',
            badge: 'Assistance',
            badgeColor: 'bg-amber-500/20 text-amber-300',
          },
          {
            title: 'Messages avec le Bailleur',
            description: 'Échanges directs et notifications officielles',
            icon: Bell,
            to: '/portal/messages',
            gradient: 'from-cyan-600 to-teal-700',
            badge: 'Messagerie',
            badgeColor: 'bg-cyan-500/20 text-cyan-300',
          },
        ];

      case 'NEIGHBORHOOD_LEADER':
        return [
          {
            title: 'Ventes de Terrains Coutumières',
            description: 'Enregistrer les transactions foncières et calculer les droits',
            icon: MapPin,
            to: '/quartier',
            gradient: 'from-purple-600 to-indigo-700',
            badge: 'Foncier',
            badgeColor: 'bg-purple-500/20 text-purple-300',
          },
          {
            title: 'Générateur de Certificats QR',
            description: 'Émettre les documents certifiés infalsifiables de la chefferie',
            icon: QrCode,
            to: '/quartier',
            gradient: 'from-emerald-600 to-teal-700',
            badge: 'Sceau Officiel',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Ventes & Locations de Maisons',
            description: 'Historique des mutations et perception des commissions',
            icon: Home,
            to: '/quartier',
            gradient: 'from-blue-600 to-cyan-700',
            badge: 'Actes Coutumiers',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
          {
            title: 'Supervision des Chefs de Bloc',
            description: 'Coordonner le recensement et valider les blocs du secteur',
            icon: ShieldCheck,
            to: '/quartier',
            gradient: 'from-cyan-600 to-blue-700',
            badge: 'Territoire',
            badgeColor: 'bg-cyan-500/20 text-cyan-300',
          },
          {
            title: 'Alertes & Communications',
            description: 'Diffuser des consignes de sécurité à toute la population',
            icon: Bell,
            to: '/quartier',
            gradient: 'from-rose-600 to-pink-700',
            badge: 'Sécurité',
            badgeColor: 'bg-rose-500/20 text-rose-300',
          },
        ];

      case 'BLOCK_LEADER':
        return [
          {
            title: 'Enrôlement des Résidences',
            description: 'Recenser les maisons, immeubles et familles de votre bloc',
            icon: Home,
            to: '/quartier',
            gradient: 'from-cyan-600 to-blue-700',
            badge: 'Recensement',
            badgeColor: 'bg-cyan-500/20 text-cyan-300',
          },
          {
            title: 'Générer QR Code du Bloc',
            description: 'Lien et QR Code d’invitation pour les résidents du secteur',
            icon: QrCode,
            to: '/quartier',
            gradient: 'from-emerald-600 to-teal-700',
            badge: 'Adhésion',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Signalements & Sécurité',
            description: 'Gérer les incidents et coordonner la garde de proximité',
            icon: AlertTriangle,
            to: '/quartier',
            gradient: 'from-rose-600 to-amber-700',
            badge: 'Urgence',
            badgeColor: 'bg-rose-500/20 text-rose-300',
          },
          {
            title: 'Statistiques du Bloc',
            description: 'Nombre de foyers recensés et taux de couverture',
            icon: Users,
            to: '/quartier',
            gradient: 'from-indigo-600 to-purple-700',
            badge: 'Données',
            badgeColor: 'bg-indigo-500/20 text-indigo-300',
          },
        ];

      case 'AGENT':
        return [
          {
            title: 'Marketplace Publique',
            description: 'Consulter et diffuser des annonces exclusives',
            icon: Building2,
            to: '/marketplace',
            gradient: 'from-amber-600 to-orange-700',
            badge: 'Marketplace',
            badgeColor: 'bg-amber-500/20 text-amber-300',
          },
          {
            title: 'Mes Mandats de Vente & Gestion',
            description: 'Gérer mon portefeuille de mandats exclusifs',
            icon: Briefcase,
            to: '/agent',
            gradient: 'from-blue-600 to-indigo-700',
            badge: 'Portefeuille',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
          {
            title: 'Mes Commissions & Factures',
            description: 'Suivre les honoraires perçus et les règlements',
            icon: Wallet,
            to: '/agent',
            gradient: 'from-emerald-600 to-teal-700',
            badge: 'Revenus',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'KadtEstate AI Assistant',
            description: 'Rédiger des annonces attractives et évaluer des biens',
            icon: Bot,
            to: '/ai',
            gradient: 'from-purple-600 to-violet-700',
            badge: 'Intelligence IA',
            badgeColor: 'bg-purple-500/20 text-purple-300',
          },
        ];

      case 'RESIDENT':
        return [
          {
            title: 'Mon Attestation de Résidence',
            description: 'Télécharger mon certificat avec QR Code certifié par le Chef',
            icon: FileText,
            to: '/quartier',
            gradient: 'from-rose-600 to-pink-700',
            badge: 'Document Officiel',
            badgeColor: 'bg-rose-500/20 text-rose-300',
          },
          {
            title: 'Signaler un Incident de Sécurité',
            description: 'Alerter le Chef de Bloc en cas d’urgence ou anomalie',
            icon: AlertTriangle,
            to: '/quartier',
            gradient: 'from-amber-600 to-red-600',
            badge: 'Alerte Rapide',
            badgeColor: 'bg-amber-500/20 text-amber-300',
          },
          {
            title: 'Alertes du Quartier',
            description: 'Consulter les annonces et travaux de la chefferie',
            icon: Bell,
            to: '/quartier',
            gradient: 'from-blue-600 to-cyan-700',
            badge: 'Informations',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
        ];

      default: // OWNER / General
        return [
          {
            title: 'Mes Propriétés & Immeubles',
            description: 'Consulter, ajouter et gérer mes biens fonciers et bâtis',
            icon: Building2,
            to: '/properties',
            gradient: 'from-blue-600 to-indigo-700',
            badge: 'Patrimoine',
            badgeColor: 'bg-blue-500/20 text-blue-300',
          },
          {
            title: 'Logements & Lots Disponibles',
            description: 'Inventaire des appartements, studios et bureaux',
            icon: Home,
            to: '/units',
            gradient: 'from-cyan-600 to-teal-700',
            badge: 'Disponibilités',
            badgeColor: 'bg-cyan-500/20 text-cyan-300',
          },
          {
            title: 'Contrats de Baux',
            description: 'Créer, renouveler et résilier les contrats locatifs',
            icon: KeyRound,
            to: '/leases',
            gradient: 'from-purple-600 to-violet-700',
            badge: 'Juridique',
            badgeColor: 'bg-purple-500/20 text-purple-300',
          },
          {
            title: 'Locataires & Dossiers',
            description: 'Répertoire des occupants et historique des paiements',
            icon: Users,
            to: '/tenants',
            gradient: 'from-emerald-600 to-teal-700',
            badge: 'Occupants',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Encaissement & Loyers',
            description: 'Échéances en cours, relances et quittances',
            icon: Receipt,
            to: '/rent',
            gradient: 'from-amber-600 to-orange-700',
            badge: 'Finances',
            badgeColor: 'bg-amber-500/20 text-amber-300',
          },
          {
            title: 'Paiement Rapide Ikeepay',
            description: 'Effectuer ou tester un encaissement Mobile Money direct',
            icon: CreditCard,
            onClick: () => setIkeepayPayinOpen(true),
            gradient: 'from-emerald-500 to-green-600',
            badge: 'Ikeepay H2H',
            badgeColor: 'bg-emerald-500/20 text-emerald-300',
          },
          {
            title: 'Dépenses & Charges',
            description: 'Factures d’eau, électricité, syndic et travaux',
            icon: TrendingDown,
            to: '/expenses',
            gradient: 'from-rose-600 to-pink-700',
            badge: 'Comptabilité',
            badgeColor: 'bg-rose-500/20 text-rose-300',
          },
          {
            title: 'Maintenance & Tickets',
            description: 'Suivi des pannes, devis et interventions techniques',
            icon: Wrench,
            to: '/maintenance',
            gradient: 'from-slate-700 to-slate-800',
            badge: 'Opérations',
            badgeColor: 'bg-slate-500/20 text-slate-300',
          },
          {
            title: 'KadtEstate AI Copilot',
            description: 'Optimisation de rendements, scoring et aide rédactionnelle',
            icon: Bot,
            to: '/ai',
            gradient: 'from-violet-600 to-fuchsia-700',
            badge: 'Assistant IA',
            badgeColor: 'bg-violet-500/20 text-violet-300',
          },
        ];
    }
  };

  const currentCards = getActionCards(activeTabRole);

  return (
    <div className="space-y-8 pb-12">
      
      {/* 1. Header Bar with Universal Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <BackButton to="/" label="Retour à l'accueil" />
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              KadtEstate Pro
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Tableau de Bord Interactif
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Bienvenue, <strong className="text-foreground">{user?.displayName || 'Utilisateur'}</strong> ({activeOrganization?.name || 'KadtEstate'})
          </p>
        </div>

        {/* Global Action Modals Trigger */}
        <div className="flex items-center gap-2.5">
          <Button
            onClick={() => setIkeepayPayinOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-md flex items-center gap-1.5"
          >
            <CreditCard className="size-4" />
            <span>Payer par Mobile Money</span>
          </Button>

          {isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => setIkeepaySettingsOpen(true)}
              className="text-xs font-medium border-border flex items-center gap-1.5"
            >
              <Settings className="size-4 text-emerald-500" />
              <span>Clés Ikeepay</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Interactive Role Switcher Pills (Allows testing or multi-role exploration) */}
      <div className="bg-card/50 border border-border p-3 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Sparkles className="size-4 text-emerald-500" />
          <span>Vue Rôle Actuelle :</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'OWNER', label: 'Propriétaire' },
            { id: 'TENANT', label: 'Locataire' },
            { id: 'AGENT', label: 'Agent Immobilier' },
            { id: 'NEIGHBORHOOD_LEADER', label: 'Chef de Quartier' },
            { id: 'BLOCK_LEADER', label: 'Chef de Bloc' },
            { id: 'RESIDENT', label: 'Résident' },
            { id: 'SUPER_ADMIN', label: 'Super Admin' },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveTabRole(r.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeTabRole === r.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Real-Time Stats Overview Cards */}
      {data && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Revenus du mois</span>
              <Receipt className="size-4 text-emerald-500" />
            </div>
            <p className="text-xl font-bold text-foreground">{data.incomeMinor.toLocaleString('fr-FR')} FCFA</p>
            <p className="text-[11px] text-muted-foreground">Encaissements validés</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Impayés & Retards</span>
              <TrendingDown className="size-4 text-rose-500" />
            </div>
            <p className="text-xl font-bold text-rose-500">{data.arrearsMinor.toLocaleString('fr-FR')} FCFA</p>
            <p className="text-[11px] text-muted-foreground">Échéances en souffrance</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Taux d'occupation</span>
              <KeyRound className="size-4 text-blue-500" />
            </div>
            <p className="text-xl font-bold text-foreground">{data.occupancyRate}%</p>
            <p className="text-[11px] text-muted-foreground">{data.availableUnits} logements vacants</p>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border shadow-sm space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
              <span>Maintenance active</span>
              <Wrench className="size-4 text-amber-500" />
            </div>
            <p className="text-xl font-bold text-foreground">{data.openMaintenance} tickets</p>
            <p className="text-[11px] text-muted-foreground">Interventions en cours</p>
          </div>
        </div>
      )}

      {/* 4. App Launcher: Interactive Feature Buttons Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <span>Actions & Modules KadtEstate</span>
            <span className="text-xs font-normal text-muted-foreground">({currentCards.length} modules disponibles)</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {currentCards.map((card, idx) => {
            const Icon = card.icon;

            const content = (
              <div className="h-full p-6 rounded-3xl bg-card border border-border hover:border-primary/40 hover:shadow-xl transition-all duration-300 group flex flex-col justify-between relative overflow-hidden">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-md group-hover:scale-105 transition-transform`}>
                      <Icon className="size-6" />
                    </div>
                    {card.badge && (
                      <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${card.badgeColor}`}>
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{card.title}</span>
                      <ArrowUpRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground group-hover:text-foreground font-medium">
                  <span>Accéder au module</span>
                  <div className="size-6 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ArrowUpRight className="size-3.5" />
                  </div>
                </div>
              </div>
            );

            if (card.onClick) {
              return (
                <button
                  type="button"
                  key={idx}
                  onClick={card.onClick}
                  className="text-left w-full h-full focus:outline-none"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link key={idx} to={card.to || '#'} className="block h-full focus:outline-none">
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {/* 5. Mobile Money Gateway (Ikeepay) Modal */}
      <IkeepayModal
        isOpen={ikeepayPayinOpen}
        onClose={() => setIkeepayPayinOpen(false)}
        amount={250000}
        title="Règlement Immédiat Mobile Money (Ikeepay)"
        onPaymentSuccess={(ref: string) => {
          setIkeepayPayinOpen(false);
          alert(`Paiement Mobile Money validé avec succès ! Référence : ${ref}`);
        }}
      />

      {/* 6. Admin Ikeepay Settings Modal */}
      <IkeepaySettingsModal
        isOpen={ikeepaySettingsOpen}
        onClose={() => setIkeepaySettingsOpen(false)}
      />

    </div>
  );
}