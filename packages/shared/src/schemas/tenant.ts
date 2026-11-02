import { z } from 'zod';

export const tenantSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  phone: z.string().max(32).optional(),
});
