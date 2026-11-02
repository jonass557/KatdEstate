import { describe, expect, it } from 'vitest';
import { formatMoney, initials, minorUnitExponent } from './format';

describe('money formatting', () => {
  it('treats XOF as a zero-decimal currency', () => {
    expect(minorUnitExponent('XOF')).toBe(0);
    // 125 000 FCFA stored as minor units stays 125 000 in major units.
    expect(formatMoney(125_000, 'XOF')).toContain('125');
  });

  it('treats EUR as a two-decimal currency', () => {
    expect(minorUnitExponent('EUR')).toBe(2);
    expect(formatMoney(125_000, 'EUR')).toContain('1');
  });
});

describe('initials', () => {
  it('derives at most two initials', () => {
    expect(initials('Aïcha Diallo')).toBe('AD');
    expect(initials('  kora  immobilier  sarl ')).toBe('KI');
  });
});
