import type { z } from "zod";
import type {
  authResponseSchema,
  createUserSchema,
  jwtPayloadSchema,
  loginSchema,
  publicUserSchema,
  userRoleSchema,
  userSchema,
} from "../validators/user.js";

export type UserRole = z.infer<typeof userRoleSchema>;
export type User = z.infer<typeof userSchema>;
export type PublicUser = z.infer<typeof publicUserSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;
export type JwtPayload = z.infer<typeof jwtPayloadSchema>;
