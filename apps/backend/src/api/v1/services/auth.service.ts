import { randomUUID } from "node:crypto";
import type {
  Actor,
  AuthResponse,
  CreateUserInput,
  JwtPayload,
  LoginInput,
  PublicUser,
  User,
} from "@repo/shared";
import { jwtPayloadSchema } from "@repo/shared";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../../config/env.js";
import { ConflictError, UnauthorizedError } from "../../../lib/errors.js";
import type { UserRepository } from "../repositories/index.js";
import { toPublicUser } from "./user.service.js";

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly users: UserRepository) {}

  async register(input: CreateUserInput): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) throw new ConflictError("Email is already registered");

    const user: User = {
      id: randomUUID(),
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, SALT_ROUNDS),
      createdAt: new Date().toISOString(),
    };

    const created = await this.users.create(user);
    return this.authResponse(created);
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email);

    // Same error for "no such user" and "wrong password" so the endpoint
    // can't be used to enumerate registered accounts.
    if (!user) throw new UnauthorizedError("Invalid email or password");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw new UnauthorizedError("Invalid email or password");

    return this.authResponse(user);
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedError("User no longer exists");
    return toPublicUser(user);
  }

  /**
   * Resolves a bearer token to the principal every domain rule is evaluated
   * against. The user is re-read rather than trusted from the token, so a
   * token for a deleted user — or one whose role changed — can't be replayed.
   * Returns null for a bad token; requiring an actor is the resolver's job.
   */
  async actorFromToken(token: string): Promise<Actor | null> {
    let payload: JwtPayload;
    try {
      payload = this.verifyToken(token);
    } catch {
      return null;
    }

    const user = await this.users.findById(payload.sub);
    if (!user) return null;

    return { id: user.id, name: user.name, role: user.role };
  }

  verifyToken(token: string): JwtPayload {
    let decoded: unknown;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new UnauthorizedError("Invalid or expired token");
    }

    const parsed = jwtPayloadSchema.safeParse(decoded);
    if (!parsed.success) throw new UnauthorizedError("Malformed token payload");
    return parsed.data;
  }

  private authResponse(user: User): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const options: SignOptions = {
      expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    };
    return {
      token: jwt.sign(payload, env.JWT_SECRET, options),
      user: toPublicUser(user),
    };
  }
}
