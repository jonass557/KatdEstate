import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { AppConfig } from '../../config/index.js';
import { sendSuccess } from '../../common/http.js';
import { createAuthenticate } from '../../middleware/authenticate.js';
import { requireOrganizationMembership } from '../../middleware/organization.js';
import { requirePermission } from '../../middleware/permissions.js';
import * as geo from './geo.service.js';
import * as census from './census.service.js';
import * as security from './security.service.js';
import * as communication from './communication.service.js';
import * as stats from './stats.service.js';
import * as chefferie from './chefferie.service.js';

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
 * Routes publiques DOMORA QUARTIER (inscription habitant gratuite, QR code de bloc, urgences locales)
 */
export function createQuartierPublicRouter(_config: AppConfig) {
  const router = Router();

  router.get('/cities', respond(geo.listCities));
  router.get('/districts', respond(geo.listDistricts));
  router.get('/neighborhoods', respond(geo.listNeighborhoods));
  router.get('/blocks', respond(geo.listBlocks));
  router.get('/blocks/token/:token', respond(geo.getBlockByToken));
  router.post('/residents/register', respond(census.registerHouseholdResident));
  router.get('/emergency-contacts', respond(security.listEmergencyContacts));
  router.get('/announcements', respond(communication.listAnnouncements));

  // Chefferie public : Vérification d'authenticité de certificat officiel et horaires du service
  router.get('/certificates/verify/:code', respond(chefferie.verifyCertificatePublic));
  router.get('/chefferie/service-hours', (_req, res) => {
    sendSuccess(res, chefferie.getRentalServiceHoursStatus());
  });

  return router;
}

/**
 * Routes authentifiées DOMORA QUARTIER :
 * Tableaux de bord Chef de Bloc, Chef de Quartier, Super Admin,
 * validation des résidences, signalements confidentiels et communications.
 */
export function createQuartierRouter(config: AppConfig) {
  const router = Router({ mergeParams: true });
  router.use(createAuthenticate(config), requireOrganizationMembership);

  // --- Territoires & Affectations ---
  router.get('/cities', requirePermission('quartier.view'), respond(geo.listCities));
  router.post('/cities', requirePermission('quartier.manageSectors'), respond(geo.createCity));
  router.get('/districts', requirePermission('quartier.view'), respond(geo.listDistricts));
  router.post(
    '/districts',
    requirePermission('quartier.manageSectors'),
    respond(geo.createDistrict),
  );
  router.get('/neighborhoods', requirePermission('quartier.view'), respond(geo.listNeighborhoods));
  router.post(
    '/neighborhoods',
    requirePermission('quartier.manageSectors'),
    respond(geo.createNeighborhood),
  );
  router.get('/blocks', requirePermission('quartier.view'), respond(geo.listBlocks));
  router.post('/blocks', requirePermission('quartier.manageSectors'), respond(geo.createBlock));

  router.post(
    '/sectors/assign',
    requirePermission('quartier.manageLeaders'),
    respond(geo.assignSectorLeader),
  );
  router.get(
    '/sectors/assignments',
    requirePermission('quartier.view'),
    respond(geo.listSectorAssignments),
  );

  // --- Recensement des Résidences & Workflow ---
  router.get(
    '/residences',
    requirePermission('quartier.viewCensus'),
    respond(census.listResidences),
  );
  router.post(
    '/residences',
    requirePermission('quartier.registerCensus'),
    respond(census.createResidenceByChef),
  );
  router.get(
    '/submissions/pending',
    requirePermission('quartier.viewCensus'),
    respond(census.listPendingSubmissions),
  );
  router.post(
    '/submissions/:id/validate',
    requirePermission('quartier.validateCensus'),
    respond(census.validateCensusSubmission),
  );
  router.post(
    '/residents/move-out',
    requirePermission('quartier.registerCensus'),
    respond(census.declareMoveOut),
  );

  // --- Sécurité Communautaire & Signalements Confidentiels ---
  router.post(
    '/incidents',
    requirePermission('quartier.reportIncidents'),
    respond(security.reportIncident),
  );
  router.get(
    '/incidents',
    requirePermission('quartier.viewIncidents'),
    respond(security.listIncidents),
  );
  router.patch(
    '/incidents/:id',
    requirePermission('quartier.manageIncidents'),
    respond(security.updateIncidentStatus),
  );
  router.get(
    '/emergency-contacts',
    requirePermission('quartier.view'),
    respond(security.listEmergencyContacts),
  );
  router.post(
    '/emergency-contacts',
    requirePermission('quartier.admin'),
    respond(security.createEmergencyContact),
  );

  // --- Communications & Alertes ---
  router.post(
    '/announcements',
    requirePermission('quartier.sendAnnouncements'),
    respond(communication.broadcastAnnouncement),
  );
  router.get(
    '/announcements',
    requirePermission('quartier.viewAnnouncements'),
    respond(communication.listAnnouncements),
  );

  // --- Dashboards & Statistiques ---
  router.get(
    '/dashboard/block-leader',
    requirePermission('quartier.viewStats'),
    respond(stats.getBlockLeaderDashboard),
  );
  router.get(
    '/dashboard/neighborhood-leader',
    requirePermission('quartier.viewStats'),
    respond(stats.getNeighborhoodLeaderDashboard),
  );
  router.get(
    '/dashboard/super-admin',
    requirePermission('quartier.admin'),
    respond(stats.getSuperAdminQuartierStats),
  );

  // --- Chefferie : Ventes, Locations, Foncier, Certificats & Commissions ---
  router.get(
    '/chefferie/commissions/settings',
    requirePermission('quartier.view'),
    respond(chefferie.getCommissionSettings),
  );
  router.post(
    '/chefferie/commissions/settings',
    requirePermission('quartier.manageCommissions'),
    respond(chefferie.updateCommissionSettings),
  );
  router.post(
    '/chefferie/house-sales',
    requirePermission('quartier.createTransactions'),
    respond(chefferie.recordHouseSale),
  );
  router.get(
    '/chefferie/house-sales',
    requirePermission('quartier.viewTransactions'),
    respond(chefferie.listHouseSales),
  );
  router.post(
    '/chefferie/house-rentals',
    requirePermission('quartier.createTransactions'),
    respond(chefferie.recordHouseRental),
  );
  router.get(
    '/chefferie/house-rentals',
    requirePermission('quartier.viewTransactions'),
    respond(chefferie.listHouseRentals),
  );
  router.post(
    '/chefferie/land-sales',
    requirePermission('quartier.createTransactions'),
    respond(chefferie.recordLandSale),
  );
  router.get(
    '/chefferie/land-sales',
    requirePermission('quartier.viewTransactions'),
    respond(chefferie.listLandSales),
  );
  router.post(
    '/chefferie/certificates',
    requirePermission('quartier.issueCertificates'),
    respond(chefferie.issueChefferieCertificate),
  );
  router.get(
    '/chefferie/certificates',
    requirePermission('quartier.viewTransactions'),
    respond(chefferie.listChefferieCertificates),
  );
  router.get(
    '/chefferie/dashboard',
    requirePermission('quartier.viewStats'),
    respond(chefferie.getChefferieDashboardStats),
  );

  return router;
}
