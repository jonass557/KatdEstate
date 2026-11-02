import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Chiffrement au repos des données sensibles (numéro de pièce d'identité).
 *
 * AES-256-GCM : chaque valeur porte son propre vecteur d'initialisation et son
 * tag d'authentification, donc une modification en base est détectée. La clé est
 * dérivée d'un secret déjà validé au démarrage, jamais stockée à côté des données.
 */

const ALGORITHM = 'aes-256-gcm';

function deriveKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

/** Produit `iv.tag.ciphertext`, le tout encodé en base64url. */
export function encryptString(plain: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptString(payload: string, secret: string): string {
  const [ivPart, tagPart, dataPart] = payload.split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Donnée chiffrée illisible.');
  }
  const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** N'expose que les 4 derniers caractères : suffisant pour reconnaître, pas pour usurper. */
export function maskSecret(value: string): string {
  const visible = value.slice(-4);
  return `${'•'.repeat(Math.max(0, value.length - 4))}${visible}`;
}
