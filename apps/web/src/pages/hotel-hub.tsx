import { useParams } from 'react-router-dom';
import {
  BedDouble,
  Bell,
  Building2,
  CalendarCheck,
  ClipboardList,
  Globe,
  LogIn,
  Package,
  PieChart,
  Receipt,
  Sparkles,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { BackButton } from '../components/ui/back-button';
import { PageHeader } from '../components/page-header';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { EstablishmentsManager } from '../components/hotel/EstablishmentsManager';
import { HotelOverviewDashboard } from '../components/hotel/HotelOverviewDashboard';
import { RoomsManager } from '../components/hotel/RoomsManager';

const HOTEL_MODULES: Record<
  string,
  {
    title: string;
    subtitle: string;
    badge: string;
    icon: typeof Building2;
  }
> = {
  overview: {
    title: 'Vue générale de l’hôtel',
    subtitle: 'Tableau de bord central : revenus, taux d’occupation, réservations, transactions et alertes.',
    badge: 'DASHBOARD PRINCIPAL',
    icon: Building2,
  },
  establishments: {
    title: 'Établissements Hôteliers',
    subtitle: 'Fondation et gestion de vos établissements hôteliers (nom, adresse, étoiles, paramètres).',
    badge: 'MODULE 1',
    icon: Building2,
  },
  rooms: {
    title: 'Chambres & Catégories',
    subtitle: 'Configuration des catégories de chambres, tarifs, équipements et disponibilités.',
    badge: 'MODULE 2',
    icon: BedDouble,
  },
  reservations: {
    title: 'Réservations Hôtelières',
    subtitle: 'Calendrier, suivi et gestion complète des réservations de séjours.',
    badge: 'MODULE 3',
    icon: CalendarCheck,
  },
  crm: {
    title: 'CRM & Gestion des Clients',
    subtitle: 'Fiches clients, préférences, historique des séjours et fidélisation.',
    badge: 'MODULE 4',
    icon: Users,
  },
  'checkin-out': {
    title: 'Arrivées (Check-In) & Départs (Check-Out)',
    subtitle: 'Accueil, remise des clés, enregistrement des arrivées et clôture des départs.',
    badge: 'MODULE 5',
    icon: LogIn,
  },
  billing: {
    title: 'Facturation & Gestion des Paiements',
    subtitle: 'Édition des factures de séjour, encaissements, acomptes et reçus.',
    badge: 'MODULE 6',
    icon: Receipt,
  },
  restaurant: {
    title: 'Restaurant & Commandes',
    subtitle: 'Carte du restaurant, prise de commandes, room service et facturation en chambre.',
    badge: 'MODULE 7',
    icon: UtensilsCrossed,
  },
  services: {
    title: 'Services Supplémentaires',
    subtitle: 'Spa, blanchisserie, navette aéroport, parking et prestations additionnelles.',
    badge: 'MODULE 8',
    icon: Sparkles,
  },
  housekeeping: {
    title: 'Housekeeping & Entretien des Chambres',
    subtitle: 'Suivi du ménage, propreté des chambres, maintenance et affectation des équipes.',
    badge: 'MODULE 9',
    icon: ClipboardList,
  },
  hr: {
    title: 'Employés & Ressources Humaines',
    subtitle: 'Gestion du personnel hôtelier, plannings, postes et présences.',
    badge: 'MODULE 10',
    icon: Users,
  },
  stocks: {
    title: 'Stocks & Approvisionnements',
    subtitle: 'Inventaire, produits d’accueil, cuisine, bar et alertes de réapprovisionnement.',
    badge: 'MODULE 11',
    icon: Package,
  },
  accounting: {
    title: 'Comptabilité & Rapports Financiers',
    subtitle: 'Chiffre d’affaires, taux d’occupation, RevPAR, dépenses et bilans financiers.',
    badge: 'MODULE 12',
    icon: PieChart,
  },
  'public-notifications': {
    title: 'Site Public de l’Hôtel, Réservations en Ligne & Automatisations',
    subtitle: 'Vitrine publique en ligne, moteur de réservation et notifications automatiques.',
    badge: 'MODULE 13',
    icon: Globe,
  },
};

export function HotelModulePage() {
  const { module = 'establishments' } = useParams<{ module: string }>();
  const info = HOTEL_MODULES[module] ?? HOTEL_MODULES.establishments!;
  const IconComp = info.icon;

  return (
    <div className="space-y-6">
      <BackButton to="/dashboard" label="Retour au Dashboard" />
      <PageHeader title={info.title} description={info.subtitle} />

      {module === 'overview' ? (
        <HotelOverviewDashboard />
      ) : module === 'establishments' ? (
        <EstablishmentsManager />
      ) : module === 'rooms' ? (
        <RoomsManager />
      ) : (
        <Card className="border-border">
          <CardContent className="p-8 text-center space-y-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <IconComp className="size-7" />
            </div>
            <div className="space-y-2">
              <Badge className="bg-amber-500 text-slate-950 font-black">{info.badge}</Badge>
              <h3 className="text-lg font-bold text-foreground">{info.title}</h3>
              <p className="text-xs text-muted-foreground max-w-lg mx-auto">{info.subtitle}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-500 font-semibold">
              <Bell className="size-4" />
              <span>Module prêt — en attente de vos instructions détaillées de contenu et design.</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
