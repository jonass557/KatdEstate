import { describe, expect, it } from 'vitest';
import { buildSchedule, computePenalty } from './schedule.js';

describe('échéancier', () => {
  it('génère une échéance par mois sur la période', () => {
    const periods = buildSchedule(new Date('2026-01-01'), new Date('2026-03-31'), 1, 'MONTHLY');
    expect(periods).toHaveLength(3);
    expect(periods.map((period) => period.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
    ]);
  });

  it('respecte le jour d’échéance et exclut les dates hors période', () => {
    const periods = buildSchedule(new Date('2026-01-10'), new Date('2026-03-04'), 5, 'MONTHLY');
    expect(periods.map((period) => period.dueDate.toISOString().slice(0, 10))).toEqual([
      '2026-02-05',
    ]);
  });

  it('espace les échéances trimestrielles', () => {
    const periods = buildSchedule(new Date('2026-01-01'), new Date('2026-12-31'), 1, 'QUARTERLY');
    expect(periods).toHaveLength(4);
  });
});

describe('pénalités', () => {
  it('calcule un montant fixe, un pourcentage, ou rien', () => {
    expect(computePenalty(100_000, { type: 'FIXED', value: 5_000 })).toBe(5_000);
    expect(computePenalty(100_000, { type: 'PERCENTAGE', value: 10 })).toBe(10_000);
    expect(computePenalty(100_000, { type: 'NONE', value: 0 })).toBe(0);
  });
});
