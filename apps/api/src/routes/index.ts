import { Router } from 'express';
import type { AppConfig } from '../config/index.js';
import { healthRouter } from '../modules/health/health.routes.js';
import { createAuthRouter } from '../modules/auth/auth.routes.js';
import { createOrganizationsRouter } from '../modules/organizations/organizations.routes.js';
import { createAccountingRouter } from '../modules/accounting/accounting.routes.js';
import { createFinanceRouter } from '../modules/finance/finance.routes.js';
import { createLeaseRouter } from '../modules/leases/leases.routes.js';
import { createMaintenanceRouter } from '../modules/maintenance/maintenance.routes.js';
import { createNotificationRouter } from '../modules/notifications/notifications.routes.js';
import { createAiRouter } from '../modules/ai/ai.routes.js';
import { createDocumentRouter } from '../modules/documents/documents.routes.js';
import { createInsightsRouter } from '../modules/insights/insights.routes.js';
import { createPlatformRouter } from '../modules/platform/platform.routes.js';
import { createPortalRouter } from '../modules/portal/portal.routes.js';
import { createPropertyRouter } from '../modules/properties/properties.routes.js';
import { createUtilityRouter } from '../modules/utilities/utilities.routes.js';
import { createMarketplacePublicRouter, createMarketplaceRouter } from '../modules/marketplace/marketplace.routes.js';
import { createQuartierPublicRouter, createQuartierRouter } from '../modules/quartier/quartier.routes.js';

export function createApiRouter(config: AppConfig) {
  const router = Router();
  router.use('/health', healthRouter);
  router.use('/auth', createAuthRouter(config));
  router.use('/platform', createPlatformRouter(config));
  router.use('/marketplace', createMarketplacePublicRouter(config));
  router.use('/quartier', createQuartierPublicRouter(config));

  const organization = Router({ mergeParams: true });
  organization.use(createPortalRouter(config));
  organization.use(createMarketplaceRouter(config));
  organization.use(createQuartierRouter(config));
  organization.use(createDocumentRouter(config));
  organization.use(createInsightsRouter(config));
  organization.use(createAiRouter(config));
  organization.use(createPropertyRouter(config));
  organization.use(createLeaseRouter(config));
  organization.use(createFinanceRouter(config));
  organization.use(createNotificationRouter(config));
  organization.use(createMaintenanceRouter(config));
  organization.use(createAccountingRouter(config));
  organization.use(createUtilityRouter(config));
  router.use('/organizations/:organizationId', organization);

  // Organizations management & memberships
  router.use('/organizations', createOrganizationsRouter(config));

  return router;
}
