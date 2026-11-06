import type { Logger } from 'pino';
import type { Permission, Role } from '@rentflow/shared';
export interface OrganizationContext {
  organizationId: string;
  role: Role;
  permissions: readonly Permission[];
}
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      sessionId?: string;
      organizationContext?: OrganizationContext;
      user?: { id: string; roles: readonly Role[] };
      log?: Logger;
    }
  }
}
export {};
