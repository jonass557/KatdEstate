import nodemailer, { type Transporter } from 'nodemailer';
import type { AppConfig } from '../../config/index.js';

type DeliveryMessage = {
  to: string;
  subject: string;
  text: string;
};

export interface EmailDelivery {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

function createTransporter(config: AppConfig): Transporter | null {
  if (!config.mail.host) return null;

  return nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    ...(config.mail.user && config.mail.password
      ? { auth: { user: config.mail.user, pass: config.mail.password } }
      : {}),
  });
}

function buildVerificationMessage(
  config: AppConfig,
  email: string,
  token: string,
): DeliveryMessage {
  return {
    to: email,
    subject: 'Vérifiez votre adresse email RentFlow Africa',
    text: `Vérifiez votre adresse email en ouvrant ${config.client.primaryOrigin}/verify-email?token=${encodeURIComponent(token)}.`,
  };
}

function buildPasswordResetMessage(
  config: AppConfig,
  email: string,
  token: string,
): DeliveryMessage {
  return {
    to: email,
    subject: 'Réinitialisez votre mot de passe RentFlow Africa',
    text: `Réinitialisez votre mot de passe en ouvrant ${config.client.primaryOrigin}/reset-password?token=${encodeURIComponent(token)}. Ce lien expire dans une heure.`,
  };
}

export function createEmailDelivery(config: AppConfig): EmailDelivery {
  const transporter = createTransporter(config);

  async function send(message: DeliveryMessage): Promise<void> {
    if (!transporter) {
      if (config.isProduction) throw new Error('Email delivery is not configured.');
      return;
    }

    await transporter.sendMail({
      from: config.mail.from,
      ...message,
    });
  }

  return {
    sendVerificationEmail: (email, token) => send(buildVerificationMessage(config, email, token)),
    sendPasswordResetEmail: (email, token) => send(buildPasswordResetMessage(config, email, token)),
  };
}
