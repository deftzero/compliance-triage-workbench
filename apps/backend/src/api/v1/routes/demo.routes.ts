import { Router } from "express";
import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../lib/errors.js";

/** Two routes whose only job is to prove the auth middleware is wired up. */
export function demoRoutes(guard: RequestHandler): Router {
  const router = Router();

  router.get("/public", (_req, res) => {
    res.json({ message: "This route is open to everyone." });
  });

  router.get("/protected", guard, (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    res.json({
      message: "You reached a protected route.",
      auth: req.auth,
    });
  });

  return router;
}
