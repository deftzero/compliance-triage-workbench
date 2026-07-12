import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "user"]);

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128);

/**
 * The full user record as it exists in a repository, password hash included.
 * Never send this over the wire — use `publicUserSchema`.
 */
export const userSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().min(1).max(120),
  role: userRoleSchema,
  passwordHash: z.string(),
  createdAt: z.iso.datetime(),
});

/** The user shape safe to return from the API. */
export const publicUserSchema = userSchema.omit({ passwordHash: true });

export const createUserSchema = z.object({
  email: z.email(),
  name: z.string().min(1).max(120),
  password: passwordSchema,
  role: userRoleSchema.default("user"),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export const authResponseSchema = z.object({
  token: z.string(),
  user: publicUserSchema,
});

/** Claims we put in the JWT. Kept small — the repository is the source of truth. */
export const jwtPayloadSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  role: userRoleSchema,
});
