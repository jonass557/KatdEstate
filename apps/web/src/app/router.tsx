import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../layouts/app-shell';
import { PortalShell } from '../layouts/portal-shell';
import { NAV_ITEMS } from '../lib/navigation';
import { ProtectedRoute, PublicOnlyRoute } from '../components/protected-route';
import { RequirePermission } from '../components/role-guard';
import { LandingPage } from '../pages/landing-page';
import { RegisterPage } from '../pages/register';
import { DashboardPage } from '../pages/dashboard';
import { DocumentsPage } from '../pages/documents';
import { ModulePlaceholderPage } from '../pages/module-placeholder';
import { NotFoundPage } from '../pages/not-found';
import {
  PortalDocumentsPage,
  PortalHomePage,
  PortalInvoicesPage,
  PortalLeasePage,
  PortalMaintenancePage,
  PortalMessagesPage,
  PortalNotificationsPage,
  PortalPaymentsPage,
  PortalProfilePage,
  PortalReceiptsPage,
  PortalRentPage,
} from '../pages/portal';
import { SignInPage } from '../pages/sign-in';
import { PlatformPage } from '../pages/platform';
import { AnalyticsPage, ExpensesPage, MaintenancePage, NotificationsPage, UtilitiesPage } from '../pages/operations';
import { LeasesPage } from '../pages/leases';
import { PaymentsPage, RentPage } from '../pages/finance';
import { PropertiesPage, PropertyDetailPage, PropertyFormPage, UnitsPage } from '../pages/properties';
import { TenantsPage } from '../pages/tenants';
import { OwnerPortalPage } from '../pages/owner';
import { AiAssistantPage } from '../pages/ai';
import { MessagesPage } from '../pages/messages';
import { MarketplacePage } from '../pages/marketplace';
import { AgentPage } from '../pages/agent';
import { OwnerListingsPage } from '../pages/owner-listings';
import { AdminMarketplacePage } from '../pages/admin-marketplace';
import { AdminOwnersPage } from '../pages/admin-owners';
import { QuartierHomePage } from '../pages/quartier/quartier-home';
import type { ReactNode } from 'react';

/**
 * Table de routage KatdEstate.
 */
const PAGES: Record<string, ReactNode> = {
  '/dashboard': <DashboardPage />,
  '/quartier': <QuartierHomePage />,
  '/marketplace': <MarketplacePage />,
  '/agent': <AgentPage />,
  '/owner-listings': <OwnerListingsPage />,
  '/admin-marketplace': <AdminMarketplacePage />,
  '/owner-portal': <OwnerPortalPage />,
  '/ai': <AiAssistantPage />,
  '/analytics': <AnalyticsPage />,
  '/properties': <PropertiesPage />,
  '/units': <UnitsPage />,
  '/tenants': <TenantsPage />,
  '/leases': <LeasesPage />,
  '/rent': <RentPage />,
  '/payments': <PaymentsPage />,
  '/expenses': <ExpensesPage />,
  '/maintenance': <MaintenancePage />,
  '/documents': <DocumentsPage />,
  '/messages': <MessagesPage />,
  '/utilities': <UtilitiesPage />,
  '/notifications': <NotificationsPage />,
};

const moduleRoutes = NAV_ITEMS.filter((item) => item.path !== '/' && item.path !== '/dashboard').map((item) => {
  const page = PAGES[item.path] ?? <ModulePlaceholderPage title={item.label} phase={item.phase} />;

  return {
    path: item.path.replace(/^\//, ''),
    element: item.permission ? (
      <RequirePermission permission={item.permission}>{page}</RequirePermission>
    ) : (
      page
    ),
  };
});

const router = createBrowserRouter([
  // Page d'accueil publique KatdEstate
  {
    path: '/',
    element: <LandingPage />,
  },
  // Inscription personnalisée par rôle
  {
    path: '/register',
    element: <RegisterPage />,
  },
  // Connexion
  {
    path: '/sign-in',
    element: (
      <PublicOnlyRoute>
        <SignInPage />
      </PublicOnlyRoute>
    ),
  },
  // Chefferie & Recensement (Accès direct ou public token)
  {
    path: '/quartier',
    element: <QuartierHomePage />,
  },
  {
    path: '/quartier/join/:token',
    element: <QuartierHomePage />,
  },
  // Marketplace publique
  {
    path: '/marketplace',
    element: <MarketplacePage />,
  },
  // Super Admin Platform
  {
    path: '/platform',
    element: (
      <ProtectedRoute>
        <PlatformPage />
      </ProtectedRoute>
    ),
  },
  // Portail Locataire
  {
    path: '/portal',
    element: (
      <ProtectedRoute>
        <PortalShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PortalHomePage /> },
      { path: 'rent', element: <PortalRentPage /> },
      { path: 'payments', element: <PortalPaymentsPage /> },
      { path: 'invoices', element: <PortalInvoicesPage /> },
      { path: 'receipts', element: <PortalReceiptsPage /> },
      { path: 'lease', element: <PortalLeasePage /> },
      { path: 'documents', element: <PortalDocumentsPage /> },
      { path: 'maintenance', element: <PortalMaintenancePage /> },
      { path: 'messages', element: <PortalMessagesPage /> },
      { path: 'notifications', element: <PortalNotificationsPage /> },
      { path: 'profile', element: <PortalProfilePage /> },
    ],
  },
  // Espace Connecté Principal (Dashboard et Modules Bailleurs / Agents / Chefferie)
  {
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'admin/owners', element: <AdminOwnersPage /> },
      { path: 'platform/owners', element: <AdminOwnersPage /> },
      { path: 'properties/new', element: <RequirePermission permission="properties.create"><PropertyFormPage mode="create" /></RequirePermission> },
      { path: 'properties/:id', element: <RequirePermission permission="properties.view"><PropertyDetailPage /></RequirePermission> },
      { path: 'properties/:id/edit', element: <RequirePermission permission="properties.update"><PropertyFormPage mode="edit" /></RequirePermission> },
      ...moduleRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}