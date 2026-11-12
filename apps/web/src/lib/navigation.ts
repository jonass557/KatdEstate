import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CreditCard,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Receipt,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Permission } from '@rentflow/shared';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Roadmap milestone that will deliver the module. */
  phase: string;
  /** Permission required to see the entry. Omitted = always visible. */
  permission?: Permission;
}

export interface NavSection {
  label: string;
  items: readonly NavItem[];
}

/**
 * Single navigation map. Routes are generated from it, so adding a module means
 * adding one entry here — no scattered route strings.
 */
export const NAVIGATION: readonly NavSection[] = [
  {
    label: 'Pilotage',
    items: [
      { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, phase: 'Milestone 0' },
      {
        path: '/owner-portal',
        label: 'Espace Propriétaire',
        icon: Briefcase,
        phase: 'Livré',
        permission: 'properties.view',
      },
      {
        path: '/ai',
        label: 'KatdEstate AI',
        icon: Sparkles,
        phase: 'Livré',
        permission: 'reports.view',
      },
      {
        path: '/analytics',
        label: 'Analytique',
        icon: BarChart3,
        phase: 'Livré',
        permission: 'reports.view',
      },
    ],
  },
  {
    label: 'KatdEstate Quartier & Chefferie',
    items: [
      {
        path: '/quartier',
        label: 'Quartier & Chefferie',
        icon: Users,
        phase: 'Livré',
      },
      {
        path: '/geo-map',
        label: 'Carte Interactive 3 Niveaux',
        icon: MapPin,
        phase: 'Livré',
      },
    ],
  },
  {
    label: 'Marketplace & Vente',
    items: [
      {
        path: '/marketplace',
        label: 'Marketplace Publique',
        icon: Home,
        phase: 'Livré',
      },
      {
        path: '/agent',
        label: 'Espace Agent',
        icon: Briefcase,
        phase: 'Livré',
        permission: 'listings.view',
      },
      {
        path: '/owner-listings',
        label: 'Mes annonces & Mandats',
        icon: Building2,
        phase: 'Livré',
        permission: 'listings.view',
      },
      {
        path: '/admin-marketplace',
        label: 'Modération Marketplace',
        icon: ShieldCheck,
        phase: 'Livré',
        permission: 'listings.manage',
      },
    ],
  },
  {
    label: 'Parc immobilier',
    items: [
      {
        path: '/properties',
        label: 'Gestion des Propriétés',
        icon: Building2,
        phase: 'Livré',
        permission: 'properties.view',
      },
      {
        path: '/units',
        label: 'Logements',
        icon: Home,
        phase: 'Livré',
        permission: 'units.view',
      },
    ],
  },
  {
    label: 'Locations',
    items: [
      {
        path: '/tenants',
        label: 'Gestion des Locataires',
        icon: Users,
        phase: 'Livré',
        permission: 'tenants.view',
      },
      {
        path: '/leases',
        label: 'Contrats',
        icon: FileText,
        phase: 'Livré',
        permission: 'leases.view',
      },
    ],
  },
  {
    label: 'Finance',
    items: [
      {
        path: '/rent',
        label: 'Gestion des Loyers',
        icon: Receipt,
        phase: 'Livré',
        permission: 'rentSchedules.view',
      },
      {
        path: '/payments',
        label: 'Gestion des Quittances et Factures',
        icon: CreditCard,
        phase: 'Livré',
        permission: 'payments.view',
      },
      {
        path: '/expenses',
        label: 'Charges & dépenses',
        icon: Wallet,
        phase: 'Livré',
        permission: 'expenses.view',
      },
    ],
  },
  {
    label: 'Opérations',
    items: [
      {
        path: '/maintenance',
        label: 'Maintenance',
        icon: Wrench,
        phase: 'Livré',
        permission: 'maintenance.view',
      },
      {
        path: '/documents',
        label: 'Documents',
        icon: FileText,
        phase: 'Livré',
        permission: 'documents.view',
      },
      {
        path: '/messages',
        label: 'Messagerie',
        icon: MessageSquare,
        phase: 'Livré',
        permission: 'messages.view',
      },
      {
        path: '/utilities',
        label: 'Compteurs',
        icon: Gauge,
        phase: 'Livré',
        permission: 'meters.view',
      },
      {
        path: '/notifications',
        label: 'Notifications',
        icon: Bell,
        phase: 'Livré',
        permission: 'notifications.view',
      },
    ],
  },
  {
    label: 'Organisation',
    items: [
      {
        path: '/team',
        label: 'Équipe & rôles',
        icon: ShieldCheck,
        phase: 'Milestone 1',
        permission: 'users.view',
      },
      {
        path: '/settings',
        label: 'Paramètres',
        icon: Settings,
        phase: 'Milestone 1',
        permission: 'settings.manage',
      },
    ],
  },
];

/** Flattened list, handy for the command palette. */
export const NAV_ITEMS: readonly NavItem[] = NAVIGATION.flatMap((section) => section.items);
