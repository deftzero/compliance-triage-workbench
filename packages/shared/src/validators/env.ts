import { z } from "zod";

export const persistenceModeSchema = z.enum(["memory", "database"]);

/**
 * Backend runtime config. Parsed from `process.env` at boot so bad config
 * fails fast rather than surfacing as a mystery 500 later.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(3001),
    JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
    JWT_EXPIRES_IN: z.string().default("1h"),
    PERSISTENCE: persistenceModeSchema.default("memory"),
    DATABASE_URL: z.url().optional(),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
  })
  .refine(
    (env) => env.PERSISTENCE !== "database" || Boolean(env.DATABASE_URL),
    {
      message: "DATABASE_URL is required when PERSISTENCE=database",
      path: ["DATABASE_URL"],
    },
  );
