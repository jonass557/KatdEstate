import { Router } from 'express';
import { MarketingSettings, ContactMessage } from '../../models/marketing.js';
import { authenticate } from '../../middleware/authenticate.js';
import { sendSuccess } from '../../common/http.js';
import { AppError } from '../../common/errors.js';

export function createMarketingRouter(): Router {
  const router = Router();

  // 1. Contenu public pour la Landing Page (Bannière défilante et Coordonnées)
  router.get('/public-content', async (_req, res, next) => {
    try {
      let settings = await MarketingSettings.findOne().sort({ updatedAt: -1 });
      if (!settings) {
        settings = await MarketingSettings.create({
          tickerBanners: [
            { text: '👑 Chefferie : Service de gestion locative ouvert 05h00 - 22h00', tag: 'OFFICIEL' },
            { text: '✨ Nouveaux terrains titrés disponibles à Cocody et Almadies avec certification immédiate', tag: 'IMMO' },
            { text: '🚀 Paiements mobiles 100% sécurisés via Orange Money, MTN, Wave et Moov (Ikeepay)', tag: 'PAIEMENT' },
            { text: '🛡️ Sécurité citoyenne : Recensement cadastral et signalements confidentiels actifs', tag: 'SÉCURITÉ' },
          ],
          contactInfo: {
            email: 'contact@katdestate.immo',
            phone: '+225 07 00 00 00 00',
            whatsapp: '+225 07 00 00 00 00',
            address: 'Abidjan, Cocody Riviera Palmeraie & Dakar, Plateau',
            openingHours: 'Lun - Sam : 08h00 - 18h30',
            supportNote: 'Assistance 24/7 pour les urgences locatives et signalements de quartier.',
          },
        });
      }

      sendSuccess(res, {
        tickerBanners: settings.tickerBanners.filter((b) => b.isActive),
        contactInfo: settings.contactInfo,
      });
    } catch (error) {
      next(error);
    }
  });

  // 2. Envoi d'un message de contact public
  router.post('/contact', async (req, res, next) => {
    try {
      const { fullName, email, phoneNumber, subject, message } = req.body;
      if (!fullName || !email || !subject || !message) {
        throw new AppError('VALIDATION_ERROR', 'Veuillez remplir tous les champs obligatoires.', 400);
      }

      const record = await ContactMessage.create({
        fullName,
        email,
        phoneNumber,
        subject,
        message,
      });

      sendSuccess(
        res,
        {
          id: record._id,
          message: 'Votre message a été transmis avec succès. Notre équipe vous répondra sous 24h.',
        },
        201,
      );
    } catch (error) {
      next(error);
    }
  });

  // 3. Administration (Mise à jour des bannières et contacts)
  router.put('/settings', authenticate, async (req, res, next) => {
    try {
      const { tickerBanners, contactInfo } = req.body;
      const updated = await MarketingSettings.findOneAndUpdate(
        {},
        {
          $set: {
            ...(tickerBanners && { tickerBanners }),
            ...(contactInfo && { contactInfo }),
            updatedBy: req.user?.id,
          },
        },
        { upsert: true, new: true },
      );
      sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  });

  // 4. Administration (Liste des messages reçus)
  router.get('/messages', authenticate, async (_req, res, next) => {
    try {
      const list = await ContactMessage.find().sort({ createdAt: -1 }).limit(50);
      sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
