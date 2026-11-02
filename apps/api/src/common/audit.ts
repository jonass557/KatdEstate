import { AuditLog } from '../models/identity.js';

export interface AuditEntry {
  organizationId?: string;
  actorId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  requestId: string;
  changes?: Record<string, unknown>;
}

/**
 * Piste d'audit métier, append-only.
 *
 * Distincte des journaux techniques : elle trace qui a fait quoi sur quelle
 * ressource. Un échec d'écriture ne doit pas faire échouer l'opération métier
 * déjà validée, mais il est visible dans les journaux du processus.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await AuditLog.create({
    ...(entry.organizationId ? { organizationId: entry.organizationId } : {}),
    ...(entry.actorId ? { actorId: entry.actorId } : {}),
    action: entry.action.slice(0, 120),
    resourceType: entry.resourceType.slice(0, 80),
    ...(entry.resourceId ? { resourceId: entry.resourceId.slice(0, 120) } : {}),
    result: 'SUCCESS',
    requestId: entry.requestId,
    ...(entry.changes ? { changes: entry.changes } : {}),
  });
}
