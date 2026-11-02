import { describe, expect, it } from 'vitest';
import { decryptString, encryptString, maskSecret } from './crypto.js';

const SECRET = 'secret-de-test-suffisamment-long';

describe('chiffrement des données sensibles', () => {
  it('retrouve exactement la valeur d’origine', () => {
    const encrypted = encryptString('1 234 567 890 123', SECRET);
    expect(encrypted).not.toContain('123');
    expect(decryptString(encrypted, SECRET)).toBe('1 234 567 890 123');
  });

  it('produit un chiffré différent à chaque appel', () => {
    expect(encryptString('ABC', SECRET)).not.toBe(encryptString('ABC', SECRET));
  });

  it('refuse un secret différent', () => {
    const encrypted = encryptString('ABC', SECRET);
    expect(() => decryptString(encrypted, 'un-autre-secret')).toThrow();
  });

  it('masque tout sauf les 4 derniers caractères', () => {
    expect(maskSecret('1234567890')).toBe('••••••7890');
  });
});
