import { Router } from "express";
import type { RequestHandler } from "express";
import type { UserController } from "../controllers/user.controller.js";

export function userRoutes(
  controller: UserController,
  guard: RequestHandler,
): Router {
  const router = Router();

  router.get("/", guard, controller.list);
  router.get("/:id", guard, controller.getById);
  router.delete("/:id", guard, controller.remove);

  return router;
}
