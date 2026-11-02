/**
 * Échéancier d'un contrat.
 *
 * Pour une fréquence mensuelle, une échéance est émise à chaque mois entre la
 * date de début et la date de fin, calée sur le jour d'échéance du contrat.
 * Le jour est borné à 28 pour éviter les ambiguïtés de février.
 */

import type { LeaseFrequency } from '@rentflow/shared';

export interface SchedulePeriod {
  periodStart: Date;
  dueDate: Date;
}

function atUtcDay(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

export function buildSchedule(
  startDate: Date,
  endDate: Date,
  dueDay: number,
  frequency: LeaseFrequency,
): SchedulePeriod[] {
  const step = frequency === 'YEARLY' ? 12 : frequency === 'SEMI_ANNUAL' ? 6 : frequency === 'QUARTERLY' ? 3 : 1;
  const periods: SchedulePeriod[] = [];

  let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
  while (cursor.getTime() <= endDate.getTime()) {
    const dueDate = atUtcDay(cursor.getUTCFullYear(), cursor.getUTCMonth(), dueDay);
    if (dueDate.getTime() >= startDate.getTime() && dueDate.getTime() <= endDate.getTime()) {
      periods.push({ periodStart: new Date(cursor), dueDate });
    }
    cursor = atUtcDay(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1);
  }
  return periods;
}

/** Pénalité applicable à une échéance en retard, selon la règle du contrat. */
export function computePenalty(
  amountDueMinor: number,
  rule: { type: 'NONE' | 'FIXED' | 'PERCENTAGE'; value: number },
): number {
  if (rule.type === 'FIXED') return rule.value;
  if (rule.type === 'PERCENTAGE') return Math.round((amountDueMinor * rule.value) / 100);
  return 0;
}
