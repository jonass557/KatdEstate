import crypto from 'node:crypto';
import { AppError } from '../../common/errors.js';
import { IkeepayConfig, IkeepayTransaction } from '../../models/payment-gateway.js';
import { RentSchedule } from '../../models/lease.js';
import {
  HouseSaleTransaction,
  HouseRentalRecord,
  LandSaleTransaction,
} from '../../models/chefferie.js';
import type { IkeepayPayinInput, IkeepayPayoutInput, IkeepayConfigInput } from '@rentflow/shared';

const IKEEPAY_BASE_URL = 'https://api.ikeepay.com';

interface IkeepayApiResponse {
  message?: string;
  provider_reference?: string;
  payment_link?: string;
  status?: string;
  data?: {
    provider_reference?: string;
    payment_link?: string;
    status?: string;
  };
}

export class IkeepayService {
  /**
   * Récupère la configuration Ikeepay de l'organisation ou de la plateforme.
   */
  static async getConfig(organizationId?: string) {
    let query: Record<string, unknown> = {};
    if (organizationId) {
      query = { organizationId };
    }
    const config = await IkeepayConfig.findOne(query).sort({ updatedAt: -1 });
    return config;
  }

  /**
   * Met à jour ou crée la configuration Ikeepay (Admin).
   */
  static async updateConfig(organizationId: string, input: IkeepayConfigInput, userId?: string) {
    const config = await IkeepayConfig.findOneAndUpdate(
      { organizationId },
      {
        $set: {
          publicKey: input.publicKey,
          secretKey: input.secretKey,
          environment: input.environment,
          isActive: input.isActive,
          webhookSecret: input.webhookSecret,
          updatedBy: userId,
        },
      },
      { upsert: true, new: true },
    );
    return config;
  }

  /**
   * Initialise un encaissement (Payin H2H).
   */
  static async initiatePayin(organizationId: string, input: IkeepayPayinInput) {
    const config = await this.getConfig(organizationId);
    if (!config || !config.isActive) {
      throw new AppError(
        'PAYMENT_GATEWAY_DISABLED',
        "La passerelle de paiement Ikeepay n'est pas encore configurée ou active.",
        400,
      );
    }

    const externalRef = `REF_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Créer la trace locale avant l'appel externe
    const localTx = await IkeepayTransaction.create({
      organizationId,
      external_reference: externalRef,
      type: 'payin',
      amount: input.amount,
      currency: input.currency,
      country: input.country,
      phoneNumber: input.phoneNumber,
      operator: input.operator,
      status: 'pending',
      purpose: input.purpose,
      referenceId: input.referenceId,
      customerEmail: input.customerEmail,
      description: input.description,
    });

    const payload = {
      amount: input.amount,
      currency: input.currency,
      country: input.country,
      phoneNumber: input.phoneNumber,
      operator: input.operator,
      external_reference: externalRef,
      customer_email: input.customerEmail,
      otp: input.otp,
    };

    try {
      const response = await fetch(`${IKEEPAY_BASE_URL}/h2h-payin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.secretKey,
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as IkeepayApiResponse;

      if (!response.ok) {
        await IkeepayTransaction.findByIdAndUpdate(localTx._id, {
          status: 'failed',
          rawWebhookPayload: data,
        });
        throw new AppError(
          'IKEEPAY_PAYIN_ERROR',
          data?.message || "Échec de l'initialisation du paiement Ikeepay.",
          response.status,
          data,
        );
      }

      await IkeepayTransaction.findByIdAndUpdate(localTx._id, {
        provider_reference: data?.data?.provider_reference || data?.provider_reference,
        paymentLink: data?.payment_link || data?.data?.payment_link,
        status:
          data?.status === 'completed' || data?.data?.status === 'completed'
            ? 'completed'
            : 'pending',
        rawWebhookPayload: data,
      });

      return {
        transactionId: localTx._id,
        external_reference: externalRef,
        provider_reference: data?.data?.provider_reference || data?.provider_reference,
        paymentLink: data?.payment_link || data?.data?.payment_link,
        status: data?.status || 'pending',
        message: 'Demande de paiement transmise avec succès au réseau mobile.',
      };
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      throw new AppError(
        'IKEEPAY_NETWORK_ERROR',
        `Impossible de joindre Ikeepay : ${err?.message || 'Erreur inconnue'}`,
        502,
      );
    }
  }

  /**
   * Initialise un retrait / transfert (Payout H2H).
   */
  static async initiatePayout(organizationId: string, input: IkeepayPayoutInput) {
    const config = await this.getConfig(organizationId);
    if (!config || !config.isActive) {
      throw new AppError(
        'PAYMENT_GATEWAY_DISABLED',
        "La passerelle Ikeepay n'est pas active.",
        400,
      );
    }

    const externalRef = `PAYOUT_${Date.now()}_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const localTx = await IkeepayTransaction.create({
      organizationId,
      external_reference: externalRef,
      type: 'payout',
      amount: input.amount,
      currency: input.currency,
      country: input.country,
      phoneNumber: input.phoneNumber,
      operator: input.operator,
      status: 'pending',
      purpose: 'OTHER',
      description: input.description,
    });

    const payload = {
      amount: input.amount,
      currency: input.currency,
      country: input.country,
      phoneNumber: input.phoneNumber,
      operator: input.operator,
      external_reference: externalRef,
    };

    const response = await fetch(`${IKEEPAY_BASE_URL}/h2h-payout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.secretKey,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as IkeepayApiResponse;

    if (!response.ok) {
      await IkeepayTransaction.findByIdAndUpdate(localTx._id, {
        status: 'failed',
        rawWebhookPayload: data,
      });
      throw new AppError(
        'IKEEPAY_PAYOUT_ERROR',
        data?.message || 'Échec du retrait Ikeepay.',
        response.status,
        data,
      );
    }

    await IkeepayTransaction.findByIdAndUpdate(localTx._id, {
      provider_reference: data?.data?.provider_reference,
      status: data?.data?.status || 'pending',
      rawWebhookPayload: data,
    });

    return {
      transactionId: localTx._id,
      external_reference: externalRef,
      status: data?.data?.status || 'pending',
    };
  }

  /**
   * Vérification du statut d'une transaction.
   */
  static async verifyTransaction(organizationId: string, reference: string) {
    const config = await this.getConfig(organizationId);
    if (!config) throw new AppError('CONFIG_NOT_FOUND', 'Configuration Ikeepay introuvable.', 404);

    const response = await fetch(`${IKEEPAY_BASE_URL}/h2h-verify/${reference}`, {
      headers: {
        'x-api-key': config.secretKey,
      },
    });

    const resJson = (await response.json()) as IkeepayApiResponse;
    if (!response.ok) {
      throw new AppError(
        'VERIFY_FAILED',
        resJson?.message || 'Échec de vérification Ikeepay.',
        response.status,
      );
    }

    const txData = resJson.data || resJson;
    const isCompleted = txData.status === 'completed';

    // Mettre à jour la transaction locale
    const updated = await IkeepayTransaction.findOneAndUpdate(
      { external_reference: reference },
      {
        $set: {
          status: isCompleted ? 'completed' : txData.status === 'failed' ? 'failed' : 'pending',
          verifiedAt: new Date(),
          provider_reference: txData.provider_reference,
        },
      },
      { new: true },
    );

    if (isCompleted && updated) {
      await this.applyPaymentEffect(updated);
    }

    return {
      status: txData.status,
      data: txData,
      localRecord: updated,
    };
  }

  /**
   * Traitement d'un webhook entrant avec validation cryptographique HMAC SHA-256.
   */
  static async processWebhook(rawBody: string | Buffer, signature?: string) {
    if (!signature) {
      throw new AppError('INVALID_SIGNATURE', 'Signature de webhook manquante.', 401);
    }

    // Récupérer la clé secrète globale ou active
    const config = await IkeepayConfig.findOne({ isActive: true }).sort({ updatedAt: -1 });
    if (!config) {
      throw new AppError('NO_ACTIVE_CONFIG', 'Aucune configuration Ikeepay active.', 400);
    }

    const secret = config.webhookSecret || config.secretKey;
    const bodyStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    const expectedSignature = crypto.createHmac('sha256', secret).update(bodyStr).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new AppError('INVALID_SIGNATURE', 'Signature HMAC Ikeepay non valide.', 401);
    }

    const eventData = JSON.parse(bodyStr);
    const payloadData = eventData.data || eventData;
    const externalRef = payloadData.external_reference;
    const status = payloadData.status;

    const tx = await IkeepayTransaction.findOneAndUpdate(
      { external_reference: externalRef },
      {
        $set: {
          status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
          provider_reference: payloadData.provider_reference,
          rawWebhookPayload: eventData,
          verifiedAt: new Date(),
        },
      },
      { new: true },
    );

    if (tx && status === 'completed') {
      await this.applyPaymentEffect(tx);
    }

    return { received: true, external_reference: externalRef, status };
  }

  /**
   * Répercute automatiquement l'encaissement sur les objets métier (loyer, chefferie, etc.).
   */
  private static async applyPaymentEffect(tx: {
    purpose?: string;
    referenceId?: unknown;
    amount?: number;
  }) {
    if (tx.purpose === 'RENT_PAYMENT' && tx.referenceId) {
      await RentSchedule.findByIdAndUpdate(tx.referenceId, {
        $set: {
          status: 'PAID',
          amountPaidMinor: tx.amount,
          paidAt: new Date(),
        },
      });
    } else if (tx.purpose === 'CHEFFERIE_COMMISSION' && tx.referenceId) {
      await HouseSaleTransaction.findByIdAndUpdate(tx.referenceId, {
        $set: { paymentStatus: 'PAID', chefferieAmountPaidMinor: tx.amount },
      });
      await HouseRentalRecord.findByIdAndUpdate(tx.referenceId, {
        $set: { paymentStatus: 'PAID', chefferieCommissionPaidMinor: tx.amount },
      });
      await LandSaleTransaction.findByIdAndUpdate(tx.referenceId, {
        $set: { paymentStatus: 'PAID', chefferieAmountPaidMinor: tx.amount },
      });
    }
  }

  /**
   * Liste l'historique des transactions d'une organisation.
   */
  static async listTransactions(organizationId: string) {
    return IkeepayTransaction.find({ organizationId }).sort({ createdAt: -1 }).limit(50);
  }
}
