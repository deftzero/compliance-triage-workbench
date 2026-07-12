import type { RequestHandler } from "express";
import type { UserService } from "../services/user.service.js";

type IdParams = { id: string };

export class UserController {
  constructor(private readonly userService: UserService) {}

  list: RequestHandler = async (_req, res) => {
    res.json(await this.userService.list());
  };

  getById: RequestHandler<IdParams> = async (req, res) => {
    res.json(await this.userService.getById(req.params.id));
  };

  remove: RequestHandler<IdParams> = async (req, res) => {
    await this.userService.remove(req.params.id);
    res.status(204).send();
  };
}
