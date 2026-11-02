import { Router, raw } from 'express';
import { IkeepayService } from './ikeepay.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireOrganization } from '../../middleware/organization.js';
import { validateRequest } from '../../middleware/validate-request.js';
import { sendSuccess } from '../../common/http.js';
import {
  ikeepayConfigSchema,
  ikeepayPayinInputSchema,
  ikeepayPayoutInputSchema,
} from '@rentflow/shared';

export function createIkeepayRouter(): Router {
  const router = Router();

  // 1. Webhook public (avec capture du body brut pour calcul HMAC SHA-256)
  router.post(
    '/webhook',
    raw({ type: 'application/json' }),
    async (req, res, next) => {
      try {
        const signature = (req.headers['x-ikeepay-signature'] as string) || '';
        const rawBody = req.body;
        const result = await IkeepayService.processWebhook(rawBody, signature);
        res.status(200).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // Routes protégées par authentification et organisation
  router.use(authenticate, requireOrganization);

  // 2. Initialiser un paiement (Payin Mobile Money)
  router.post(
    '/payin',
    validateRequest(ikeepayPayinInputSchema),
    async (req, res, next) => {
      try {
        const result = await IkeepayService.initiatePayin(req.organizationId, req.body);
        sendSuccess(res, result, 201);
      } catch (error) {
        next(error);
      }
    },
  );

  // 3. Initialiser un retrait (Payout)
  router.post(
    '/payout',
    validateRequest(ikeepayPayoutInputSchema),
    async (req, res, next) => {
      try {
        const result = await IkeepayService.initiatePayout(req.organizationId, req.body);
        sendSuccess(res, result, 201);
      } catch (error) {
        next(error);
      }
    },
  );

  // 4. Vérifier une transaction
  router.get('/verify/:reference', async (req, res, next) => {
    try {
      const result = await IkeepayService.verifyTransaction(req.organizationId, req.params.reference as string);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  });

  // 5. Historique des transactions
  router.get('/transactions', async (req, res, next) => {
    try {
      const list = await IkeepayService.listTransactions(req.organizationId);
      sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  });

  // 6. Configuration Ikeepay (Lecture - Admin)
  router.get('/config', async (req, res, next) => {
    try {
      const config = await IkeepayService.getConfig(req.organizationId);
      // Masquer la clé secrète sauf les 4 derniers caractères pour la sécurité
      if (config) {
        const maskedSecret = config.secretKey ? '••••••••' + config.secretKey.slice(-4) : '';
        sendSuccess(res, {
          publicKey: config.publicKey,
          secretKeyMasked: maskedSecret,
          environment: config.environment,
          isActive: config.isActive,
          hasWebhookSecret: Boolean(config.webhookSecret),
          updatedAt: config.updatedAt,
        });
      } else {
        sendSuccess(res, null);
      }
    } catch (error) {
      next(error);
    }
  });

  // 7. Configuration Ikeepay (Mise à jour - Admin)
  router.put('/config', validateRequest(ikeepayConfigSchema), async (req, res, next) => {
    try {
      const updated = await IkeepayService.updateConfig(req.organizationId, req.body, req.user?.id);
      sendSuccess(res, {
        message: 'Configuration Ikeepay mise à jour avec succès.',
        environment: updated?.environment,
        isActive: updated?.isActive,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
