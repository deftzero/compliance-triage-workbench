import { z } from "zod";

/** A single field-level validation problem, flattened from a Zod issue. */
export const apiIssueSchema = z.object({
  path: z.string(),
  message: z.string(),
});

/**
 * The one error shape the backend ever returns. The admin app can parse any
 * failed response with this instead of guessing at the body.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    issues: z.array(apiIssueSchema).optional(),
  }),
});

export const healthSchema = z.object({
  status: z.literal("ok"),
  uptime: z.number(),
  timestamp: z.iso.datetime(),
});
