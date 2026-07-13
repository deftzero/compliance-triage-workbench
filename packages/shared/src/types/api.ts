import type { z } from "zod";
import type {
  apiErrorSchema,
  apiIssueSchema,
  healthSchema,
} from "../validators/api";
import type { envSchema } from "../validators/env";

export type ApiIssue = z.infer<typeof apiIssueSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Health = z.infer<typeof healthSchema>;

export type Env = z.infer<typeof envSchema>;
