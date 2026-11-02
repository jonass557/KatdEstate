/**
 * Formatting helpers.
 *
 * Money is stored as integer minor units plus an ISO-4217 currency code. Several
 * West/Central African currencies (XOF, XAF) have zero decimal places, so the
 * major-unit conversion must respect the currency exponent instead of assuming
 * a fixed /100.
 */

const ZERO_DECIMAL_CURRENCIES = new Set([
  'XOF',
  'XAF',
  'XPF',
  'JPY',
  'KRW',
  'CLP',
  'ISK',
  'VND',
  'GNF',
  'RWF',
  'UGX',
  'DJF',
  'KMF',
]);

export function minorUnitExponent(currency: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? 0 : 2;
}

export function toMajorUnits(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** minorUnitExponent(currency);
}

export function formatMoney(amountMinor: number, currency: string, locale = 'fr-FR'): string {
  const exponent = minorUnitExponent(currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: exponent,
    maximumFractionDigits: exponent,
  }).format(toMajorUnits(amountMinor, currency));
}

export function formatNumber(value: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function formatDate(value: Date | string, timezone?: string, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(toDate(value));
}

export function formatDateTime(value: Date | string, timezone?: string, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  }).format(toDate(value));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}
