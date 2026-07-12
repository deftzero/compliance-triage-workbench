import { env } from "../../../config/env.js";
import { InMemoryUserRepository } from "./in-memory-user.repository.js";
import type { UserRepository } from "./user.repository.js";

export type { UserRepository } from "./user.repository.js";

/**
 * Picks the persistence backend from env. The Drizzle path is imported
 * dynamically so that in memory mode we never load `pg` or open a pool —
 * the app boots with no database present at all.
 */
export async function createUserRepository(): Promise<UserRepository> {
  if (env.PERSISTENCE === "database") {
    const [{ getDb }, { DrizzleUserRepository }] = await Promise.all([
      import("../../../db/client.js"),
      import("./drizzle-user.repository.js"),
    ]);
    return new DrizzleUserRepository(getDb());
  }

  return new InMemoryUserRepository();
}
