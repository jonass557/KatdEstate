import type { Model } from 'mongoose';
import type { PaginationMeta } from '@rentflow/shared';
import { AppError } from './errors.js';

export interface PageQuery {
  page: number;
  pageSize: number;
  sort?: string | undefined;
  order: 'asc' | 'desc';
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * Champs triables autorisés par ressource.
 *
 * Le tri demandé par le client n'est jamais interpolé tel quel dans la requête :
 * un champ hors liste est rejeté. C'est ce qui empêche un tri sur un champ
 * sensible ou inexistant.
 */
const SORTABLE: Record<string, readonly string[]> = {
  property: ['name', 'city', 'createdAt'],
  building: ['name', 'createdAt'],
  unit: ['name', 'number', 'rentAmountMinor', 'status', 'createdAt'],
  tenant: ['fullName', 'createdAt'],
  lease: ['startDate', 'endDate', 'status', 'createdAt'],
  rentSchedule: ['dueDate', 'status', 'amountDueMinor'],
  payment: ['paidAt', 'amountMinor', 'method'],
  transaction: ['date', 'amountMinor', 'category'],
  maintenance: ['createdAt', 'priority', 'status'],
  meter: ['label', 'type', 'createdAt'],
  notification: ['createdAt'],
};

export function sortOf(resource: string, query: PageQuery): Record<string, 1 | -1> {
  const allowed = SORTABLE[resource] ?? ['createdAt'];
  const field = query.sort && allowed.includes(query.sort) ? query.sort : 'createdAt';
  return { [field]: query.order === 'asc' ? 1 : -1 };
}

export async function paginate(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: Model<any>,
  filter: Record<string, unknown>,
  query: PageQuery,
  resource: string,
): Promise<Page<unknown>> {
  const total = await model.countDocuments(filter);
  const items: unknown[] = await model
    .find(filter)
    .sort(sortOf(resource, query))
    .skip((query.page - 1) * query.pageSize)
    .limit(query.pageSize)
    .lean();

  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      hasNextPage: query.page * query.pageSize < total,
    },
  };
}

/** Échappe les caractères spéciaux d'une recherche texte saisie par l'utilisateur. */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function notFound(resource: string): AppError {
  return new AppError('NOT_FOUND', `${resource} introuvable.`, 404);
}
