import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import * as marketplace from './marketplace.service.js';
import * as agent from './agent.service.js';
import * as mandates from './mandates.service.js';
import * as moderation from './moderation.service.js';

function respond(handler: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    handler(req, res)
      .then(() => {
        if (!res.headersSent) sendSuccess(res, res.locals.data);
      })
      .catch(next);
  };
}

/**
 * Routes publiques pour la marketplace (consultation, visites, offres sans authentification requise)
 */
export function createMarketplacePublicRouter(_config: AppConfig) {
  const router = Router();

  router.get('/listings', respond(marketplace.searchListings));
  router.get('/listings/:id', respond(marketplace.getListingById));
  router.post('/listings/:id/inquiries', respond(marketplace.submitInquiry));
  router.post('/listings/:id/viewings', respond(marketplace.schedulePublicViewing));
  router.post('/listings/:id/offers', respond(marketplace.submitPublicOffer));

  return router;
}

/**
 * Routes authentifiées au sein d'une organisation :
 * Espace Agent, Espace Propriétaire (mes annonces/mandats), et Modération Super Admin.
 */
export function createMarketplaceRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  // --- Espace Agent Immobilier ---
  router.get(
    '/agent/dashboard',
    requirePermission('listings.view'),
    respond(agent.getAgentDashboard),
  );
  router.get('/agent/profile', requirePermission('listings.view'), respond(agent.getAgentProfile));
  router.patch(
    '/agent/profile',
    requirePermission('listings.manage'),
    respond(agent.updateAgentProfile),
  );
  router.get(
    '/agent/subscription',
    requirePermission('listings.view'),
    respond(agent.getAgentSubscription),
  );
  router.post(
    '/agent/subscription/change',
    requirePermission('agentSubscriptions.manage'),
    respond(agent.changeAgentSubscriptionPlan),
  );

  router.get(
    '/agent/listings',
    requirePermission('listings.view'),
    respond(agent.listAgentListings),
  );
  router.post(
    '/agent/listings',
    requirePermission('listings.publish'),
    respond(agent.createAgentListing),
  );
  router.patch(
    '/agent/listings/:id',
    requirePermission('listings.edit'),
    respond(agent.updateAgentListing),
  );
  router.delete(
    '/agent/listings/:id',
    requirePermission('listings.delete'),
    respond(agent.deleteAgentListing),
  );

  router.get('/agent/leads', requirePermission('leads.view'), respond(agent.listAgentLeads));
  router.post('/agent/leads', requirePermission('leads.manage'), respond(agent.createAgentLead));
  router.patch(
    '/agent/leads/:id',
    requirePermission('leads.manage'),
    respond(agent.updateAgentLead),
  );
  router.delete(
    '/agent/leads/:id',
    requirePermission('leads.manage'),
    respond(agent.deleteAgentLead),
  );

  router.get(
    '/agent/viewings',
    requirePermission('viewings.view'),
    respond(agent.listAgentViewings),
  );
  router.patch(
    '/agent/viewings/:id',
    requirePermission('viewings.manage'),
    respond(agent.updateAgentViewing),
  );

  router.get('/agent/offers', requirePermission('offers.view'), respond(agent.listAgentOffers));
  router.patch(
    '/agent/offers/:id',
    requirePermission('offers.manage'),
    respond(agent.updateAgentOfferDecision),
  );

  router.get(
    '/agent/commissions',
    requirePermission('commissions.view'),
    respond(agent.listAgentCommissions),
  );

  router.get(
    '/agent/mandates',
    requirePermission('mandates.view'),
    respond(mandates.listAgentMandates),
  );
  router.post(
    '/agent/mandates/:id/accept',
    requirePermission('mandates.manage'),
    respond(mandates.acceptMandate),
  );
  router.post(
    '/agent/mandates/:id/reject',
    requirePermission('mandates.manage'),
    respond(mandates.rejectMandate),
  );

  // --- Espace Propriétaire : Mes Annonces & Mandats ---
  router.get(
    '/owner/listings',
    requirePermission('listings.view'),
    respond(mandates.listOwnerListings),
  );
  router.post(
    '/owner/listings',
    requirePermission('listings.publish'),
    respond(mandates.createOwnerListing),
  );
  router.patch(
    '/owner/listings/:id',
    requirePermission('listings.edit'),
    respond(mandates.updateOwnerListing),
  );
  router.delete(
    '/owner/listings/:id',
    requirePermission('listings.delete'),
    respond(mandates.deleteOwnerListing),
  );

  router.get(
    '/owner/offers',
    requirePermission('offers.view'),
    respond(mandates.listOwnerReceivedOffers),
  );
  router.patch(
    '/owner/offers/:id',
    requirePermission('offers.manage'),
    respond(mandates.decideOwnerOffer),
  );

  router.get(
    '/owner/mandates',
    requirePermission('mandates.view'),
    respond(mandates.listOwnerMandates),
  );
  router.post(
    '/owner/mandates',
    requirePermission('mandates.manage'),
    respond(mandates.createMandate),
  );
  router.post(
    '/owner/mandates/:id/revoke',
    requirePermission('mandates.manage'),
    respond(mandates.revokeMandate),
  );

  // --- Modération Super Admin & Administration Marketplace ---
  router.get(
    '/admin/marketplace/listings',
    requirePermission('listings.manage'),
    respond(moderation.listModerationListings),
  );
  router.post(
    '/admin/marketplace/listings/:id/approve',
    requirePermission('listings.manage'),
    respond(moderation.approveListing),
  );
  router.post(
    '/admin/marketplace/listings/:id/reject',
    requirePermission('listings.manage'),
    respond(moderation.rejectListing),
  );
  router.post(
    '/admin/marketplace/listings/:id/suspend',
    requirePermission('listings.manage'),
    respond(moderation.suspendListing),
  );
  router.post(
    '/admin/marketplace/listings/:id/verify',
    requirePermission('listings.manage'),
    respond(moderation.toggleListingVerified),
  );

  router.get(
    '/admin/marketplace/agents',
    requirePermission('listings.manage'),
    respond(moderation.listAgentProfiles),
  );
  router.post(
    '/admin/marketplace/agents/:id/verify',
    requirePermission('listings.manage'),
    respond(moderation.verifyAgentProfile),
  );
  router.post(
    '/admin/marketplace/agents/:id/reject',
    requirePermission('listings.manage'),
    respond(moderation.rejectAgentProfile),
  );

  router.get(
    '/admin/marketplace/plans',
    requirePermission('agentSubscriptions.manage'),
    respond(moderation.listAdminAgentPlans),
  );
  router.patch(
    '/admin/marketplace/plans/:id',
    requirePermission('agentSubscriptions.manage'),
    respond(moderation.updateAdminAgentPlan),
  );

  return router;
}
