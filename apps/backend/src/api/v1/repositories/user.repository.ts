import type { User } from "@repo/shared";

/** What the service layer is allowed to assume about persistence. */
export interface UserRepository {
  findAll(): Promise<User[]>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  deleteById(id: string): Promise<boolean>;
}
