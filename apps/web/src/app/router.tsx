import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../layouts/app-shell';
import { PortalShell } from '../layouts/portal-shell';
import { NAV_ITEMS } from '../lib/navigation';
import { ProtectedRoute, PublicOnlyRoute } from '../components/protected-route';
import { RequirePermission } from '../components/role-guard';
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
import { QuartierHomePage } from '../pages/quartier/quartier-home';
import type { ReactNode } from 'react';

/**
 * Table de routage.
 *
 * Les routes de modules sont **dérivées** du catalogue de navigation : un module
 * ne peut pas exister dans la barre latérale sans route, ni l'inverse. Chaque
 * route hérite de la permission déclarée dans le catalogue, ce qui évite de
 * dupliquer la règle à deux endroits.
 */
const PAGES: Record<string, ReactNode> = {
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

const moduleRoutes = NAV_ITEMS.filter((item) => item.path !== '/').map((item) => {
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
  {
    path: '/quartier',
    element: <QuartierHomePage />,
  },
  {
    path: '/quartier/join/:token',
    element: <QuartierHomePage />,
  },
  {
    path: '/marketplace',
    element: <MarketplacePage />,
  },
  {
    path: '/sign-in',
    element: (
      <PublicOnlyRoute>
        <SignInPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: '/platform',
    element: (
      <ProtectedRoute>
        <PlatformPage />
      </ProtectedRoute>
    ),
  },
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
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
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
