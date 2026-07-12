import type { PublicUser, User } from "@repo/shared";
import type { UserRepository } from "../repositories/index.js";
import { NotFoundError } from "../../../lib/errors.js";

/** Strips the password hash. Every path out of the API goes through this. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export class UserService {
  constructor(private readonly users: UserRepository) {}

  async list(): Promise<PublicUser[]> {
    const users = await this.users.findAll();
    return users.map(toPublicUser);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError(`No user with id ${id}`);
    return toPublicUser(user);
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.users.deleteById(id);
    if (!deleted) throw new NotFoundError(`No user with id ${id}`);
  }
}
