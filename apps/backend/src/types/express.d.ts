import type { JwtPayload } from "@repo/shared";

declare global {
  namespace Express {
    interface Request {
      /** Set by `authGuard`; present only on protected routes. */
      auth?: JwtPayload;
    }
  }
}

export {};
