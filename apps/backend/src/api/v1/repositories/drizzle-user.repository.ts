import type { User } from "@repo/shared";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../../../db/client.js";
import { users, type UserRow } from "../../../db/schema.js";
import type { UserRepository } from "./user.repository.js";

/** Rows carry a Date; the shared User contract carries an ISO string. */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleUserRepository implements UserRepository {
  constructor(private readonly db: Db) {}

  async findAll(): Promise<User[]> {
    const rows = await this.db.select().from(users);
    return rows.map(toUser);
  }

  async findById(id: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? toUser(row) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const [row] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return row ? toUser(row) : null;
  }

  async create(user: User): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash: user.passwordHash,
        createdAt: new Date(user.createdAt),
      })
      .returning();
    if (!row) throw new Error("Insert returned no row");
    return toUser(row);
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
    return rows.length > 0;
  }
}
