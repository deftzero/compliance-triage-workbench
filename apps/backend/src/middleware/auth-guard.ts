import type { RequestHandler } from "express";
import { UnauthorizedError } from "../lib/errors.js";
import type { AuthService } from "../api/v1/services/auth.service.js";

/**
 * Applied per-route rather than globally: a route is public unless it opts in.
 * Verifies the bearer token and hangs the claims off `req.auth`.
 */
export function authGuard(authService: AuthService): RequestHandler {
  return (req, _res, next) => {
    const header = req.header("authorization");

    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedError("Missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) throw new UnauthorizedError("Missing bearer token");

    req.auth = authService.verifyToken(token);
    next();
  };
}
