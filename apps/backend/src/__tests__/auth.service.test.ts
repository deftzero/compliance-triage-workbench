import type { JwtPayload } from "@repo/shared";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "../config/env";
import { ConflictError, UnauthorizedError } from "../lib/errors";
import { InMemoryUserRepository } from "../api/v1/repositories/in-memory-user.repository";
import { AuthService } from "../api/v1/services/auth.service";

let users: InMemoryUserRepository;
let auth: AuthService;

beforeEach(() => {
  users = new InMemoryUserRepository();
  auth = new AuthService(users);
});

const reporter = {
  email: "riley@example.com",
  name: "Riley Diaz",
  password: "password123",
  role: "Reporter",
} as const;

describe("register", () => {
  it("returns a token and a user with no password hash", async () => {
    const result = await auth.register(reporter);

    expect(result.token).toBeTypeOf("string");
    expect(result.user.email).toBe(reporter.email);
    expect(result.user.role).toBe("Reporter");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("rejects an email that is already registered", async () => {
    await auth.register(reporter);

    await expect(auth.register(reporter)).rejects.toThrow(ConflictError);
  });
});

describe("login", () => {
  it("issues a token for the right password", async () => {
    await auth.register(reporter);
    const result = await auth.login({
      email: reporter.email,
      password: reporter.password,
    });

    expect(result.token).toBeTypeOf("string");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  // The endpoint must not double as a way to find out which emails are
  // registered, so both failures have to be indistinguishable.
  it("gives the same error for an unknown email and a wrong password", async () => {
    await auth.register(reporter);

    const unknown = await auth
      .login({ email: "nobody@example.com", password: reporter.password })
      .catch((e: unknown) => e);
    const wrongPassword = await auth
      .login({ email: reporter.email, password: "not-the-password" })
      .catch((e: unknown) => e);

    expect(unknown).toBeInstanceOf(UnauthorizedError);
    expect(wrongPassword).toBeInstanceOf(UnauthorizedError);
    expect((unknown as UnauthorizedError).message).toBe(
      (wrongPassword as UnauthorizedError).message,
    );
  });

  it("matches the email case-insensitively", async () => {
    await auth.register({ ...reporter, email: "Riley@Example.com" });

    const result = await auth.login({
      email: "riley@example.com",
      password: reporter.password,
    });

    expect(result.user.email).toBe("Riley@Example.com");
  });
});

describe("actorFromToken", () => {
  function sign(payload: JwtPayload, expiresIn = "1h"): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    });
  }

  it("resolves a freshly issued token to its actor", async () => {
    const { token, user } = await auth.register(reporter);

    await expect(auth.actorFromToken(token)).resolves.toEqual({
      id: user.id,
      name: reporter.name,
      role: "Reporter",
    });
  });

  it("returns null rather than throwing for a token it cannot trust", async () => {
    const { user } = await auth.register(reporter);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    expect(await auth.actorFromToken("not-a-jwt")).toBeNull();
    expect(await auth.actorFromToken(sign(payload, "-1s"))).toBeNull();
    expect(
      await auth.actorFromToken(jwt.sign(payload, "a-different-secret")),
    ).toBeNull();
  });

  // The user is re-read on every request, so a token outlives its user by
  // exactly zero requests.
  it("returns null once the user behind the token is gone", async () => {
    const { token, user } = await auth.register(reporter);
    await users.deleteById(user.id);

    expect(await auth.actorFromToken(token)).toBeNull();
  });

  // The claim in the token is not the source of truth — a Reporter who forges
  // a manager role into an otherwise valid token still acts as a Reporter.
  it("takes the role from the repository, not from the token's claim", async () => {
    const { user } = await auth.register(reporter);
    const forged = sign({
      sub: user.id,
      email: user.email,
      role: "ComplianceManager",
    });

    const actor = await auth.actorFromToken(forged);

    expect(actor?.role).toBe("Reporter");
  });
});

describe("verifyToken", () => {
  it("rejects a token whose payload is not the shape we sign", async () => {
    const malformed = jwt.sign({ sub: "not-a-uuid" }, env.JWT_SECRET);

    expect(() => auth.verifyToken(malformed)).toThrow(UnauthorizedError);
  });
});
