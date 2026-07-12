import { createUserSchema, loginSchema } from "@repo/shared";
import { Router } from "express";
import type { RequestHandler } from "express";
import { validateBody } from "../../../middleware/validate.js";
import type { AuthController } from "../controllers/auth.controller.js";

export function authRoutes(
  controller: AuthController,
  guard: RequestHandler,
): Router {
  const router = Router();

  router.post("/register", validateBody(createUserSchema), controller.register);
  router.post("/login", validateBody(loginSchema), controller.login);
  router.get("/me", guard, controller.me);

  return router;
}
