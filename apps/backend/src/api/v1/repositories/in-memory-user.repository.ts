import type { User } from "@repo/shared";
import type { UserRepository } from "./user.repository.js";

/** Default repository: lets the app boot and be exercised with zero infra. */
export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findAll(): Promise<User[]> {
    return [...this.users.values()];
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const needle = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === needle) return user;
    }
    return null;
  }

  async create(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async deleteById(id: string): Promise<boolean> {
    return this.users.delete(id);
  }
}
