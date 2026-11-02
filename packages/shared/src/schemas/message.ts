import { z } from 'zod';
import { MESSAGE_CATEGORIES } from '../constants/statuses.js';
import { objectIdSchema, paginationSchema } from './common.js';

export const messageInputSchema = z.object({
  recipientId: objectIdSchema.optional(),
  category: z.enum(MESSAGE_CATEGORIES).default('GENERAL'),
  subject: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5_000),
  propertyId: objectIdSchema.optional(),
  unitId: objectIdSchema.optional(),
  ticketId: objectIdSchema.optional(),
});

export const messageReplySchema = z.object({
  body: z.string().trim().min(1).max(5_000),
});

export const messageListQuerySchema = paginationSchema.extend({
  category: z.enum(MESSAGE_CATEGORIES).optional(),
});

export type MessageInput = z.infer<typeof messageInputSchema>;
export type MessageReply = z.infer<typeof messageReplySchema>;
