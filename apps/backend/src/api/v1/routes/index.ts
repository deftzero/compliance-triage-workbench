import { Router } from "express";
import { authGuard } from "../../../middleware/auth-guard.js";
import { AuthController } from "../controllers/auth.controller.js";
import { UserController } from "../controllers/user.controller.js";
import { createUserRepository } from "../repositories/index.js";
import { AuthService } from "../services/auth.service.js";
import { UserService } from "../services/user.service.js";
import { authRoutes } from "./auth.routes.js";
import { demoRoutes } from "./demo.routes.js";
import { userRoutes } from "./user.routes.js";

/**
 * Composition root for v1. Everything below this point takes its
 * dependencies as constructor args, so a v2 is a copy of this folder with
 * different wiring — not a rewrite.
 */
export async function createV1Router(): Promise<Router> {
  const userRepository = await createUserRepository();

  const authService = new AuthService(userRepository);
  const userService = new UserService(userRepository);

  const guard = authGuard(authService);

  const router = Router();
  router.use("/auth", authRoutes(new AuthController(authService), guard));
  router.use("/users", userRoutes(new UserController(userService), guard));
  router.use("/", demoRoutes(guard));

  return router;
}
