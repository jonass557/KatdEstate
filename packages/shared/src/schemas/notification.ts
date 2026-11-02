import { z } from 'zod';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENTS,
  NOTIFICATION_TEMPLATE_VARIABLES,
} from '../constants/statuses.js';

const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z]+)\s*\}\}/g;

/** Rejette tout template contenant une variable hors de la liste autorisée. */
function assertKnownVariables(template: string, ctx: z.RefinementCtx, path: string): void {
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (name && !NOTIFICATION_TEMPLATE_VARIABLES.includes(name as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `Variable inconnue {{${name}}}. Autorisées : ${NOTIFICATION_TEMPLATE_VARIABLES.join(', ')}.`,
      });
    }
  }
}

export const notificationTemplateInputSchema = z
  .object({
    event: z.enum(NOTIFICATION_EVENTS),
    channel: z.enum(NOTIFICATION_CHANNELS),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5_000),
  })
  .superRefine((value, ctx) => {
    assertKnownVariables(value.subject, ctx, 'subject');
    assertKnownVariables(value.body, ctx, 'body');
  });

export const notificationPreferenceInputSchema = z.object({
  event: z.enum(NOTIFICATION_EVENTS),
  channels: z.array(z.enum(NOTIFICATION_CHANNELS)).max(NOTIFICATION_CHANNELS.length),
});

export type NotificationTemplateInput = z.infer<typeof notificationTemplateInputSchema>;
