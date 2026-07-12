import type { z } from "zod";
import type {
  apiErrorSchema,
  apiIssueSchema,
  healthSchema,
} from "../validators/api.js";
import type {
  envSchema,
  persistenceModeSchema,
} from "../validators/env.js";

export type ApiIssue = z.infer<typeof apiIssueSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type Health = z.infer<typeof healthSchema>;

export type Env = z.infer<typeof envSchema>;
export type PersistenceMode = z.infer<typeof persistenceModeSchema>;
