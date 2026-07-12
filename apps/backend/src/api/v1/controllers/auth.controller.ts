import type { CreateUserInput, LoginInput } from "@repo/shared";
import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../lib/errors.js";
import type { AuthService } from "../services/auth.service.js";

/** No route params on these; the generic slots only carry the request body. */
type NoParams = Record<string, never>;

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register: RequestHandler<NoParams, unknown, CreateUserInput> = async (
    req,
    res,
  ) => {
    res.status(201).json(await this.authService.register(req.body));
  };

  login: RequestHandler<NoParams, unknown, LoginInput> = async (req, res) => {
    res.json(await this.authService.login(req.body));
  };

  me: RequestHandler = async (req, res) => {
    if (!req.auth) throw new UnauthorizedError();
    res.json(await this.authService.getCurrentUser(req.auth));
  };
}
