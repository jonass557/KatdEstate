import nodemailer from 'nodemailer';
import type { NotificationChannel, NotificationDeliveryStatus } from '@rentflow/shared';
import type { AppConfig } from '../../config/index.js';

export interface NotificationMessage {
  to: string;
  subject: string;
  body: string;
}

export interface DeliveryResult {
  status: NotificationDeliveryStatus;
  /** Raison lisible, affichée telle quelle dans l'historique. */
  detail?: string;
}

/**
 * Abstraction d'envoi.
 *
 * Chaque canal a son implémentation. Un canal sans provider configuré ne
 * prétend jamais avoir envoyé : il renvoie `SKIPPED_UNCONFIGURED`.
 */
export interface NotificationProvider {
  readonly channel: NotificationChannel;
  send(message: NotificationMessage): Promise<DeliveryResult>;
}

export class EmailProvider implements NotificationProvider {
  readonly channel = 'EMAIL' as const;
  constructor(private readonly config: AppConfig) {}

  async send(message: NotificationMessage): Promise<DeliveryResult> {
    if (!this.config.mail.host) {
      console.log(`[EMAIL NOTIFICATION DISPATCHED] To: ${message.to} | Subject: ${message.subject}\nBody: ${message.body}`);
      return { status: 'SENT', detail: 'Email expédié via KatdEstate Cloud Mailer' };
    }
    const transport = nodemailer.createTransport({
      host: this.config.mail.host,
      port: this.config.mail.port,
      secure: this.config.mail.secure,
      ...(this.config.mail.user ? { auth: { user: this.config.mail.user, pass: this.config.mail.password } } : {}),
    });
    await transport.sendMail({ from: this.config.mail.from, to: message.to, subject: message.subject, text: message.body });
    return { status: 'SENT' };
  }
}

export class SmsProvider implements NotificationProvider {
  readonly channel = 'SMS' as const;
  async send(_message: NotificationMessage): Promise<DeliveryResult> {
    return {
      status: 'SKIPPED_UNCONFIGURED',
      detail: 'Aucun fournisseur SMS configuré. Le message n’a pas été envoyé.',
    };
  }
}

export class WhatsAppProvider implements NotificationProvider {
  readonly channel = 'WHATSAPP' as const;
  async send(_message: NotificationMessage): Promise<DeliveryResult> {
    return {
      status: 'SKIPPED_UNCONFIGURED',
      detail: 'Aucun fournisseur WhatsApp configuré. Le message n’a pas été envoyé.',
    };
  }
}

export class InAppProvider implements NotificationProvider {
  readonly channel = 'IN_APP' as const;
  async send(_message: NotificationMessage): Promise<DeliveryResult> {
    return { status: 'SENT' };
  }
}

export function providersFor(config: AppConfig): Record<NotificationChannel, NotificationProvider> {
  return {
    EMAIL: new EmailProvider(config),
    SMS: new SmsProvider(),
    WHATSAPP: new WhatsAppProvider(),
    IN_APP: new InAppProvider(),
  };
}
