import { env } from "../../../config/env.js";
import {
  InMemoryAuditRepository,
  InMemoryCaseRepository,
} from "./in-memory-case.repository.js";
import { InMemoryUserRepository } from "./in-memory-user.repository.js";
import type { AuditRepository, CaseRepository } from "./case.repository.js";
import type { UserRepository } from "./user.repository.js";

export type { AuditRepository, CaseRepository } from "./case.repository.js";
export type { UserRepository } from "./user.repository.js";

export type Repositories = {
  users: UserRepository;
  cases: CaseRepository;
  audit: AuditRepository;
};

/**
 * Picks the persistence backend from env. The Drizzle path is imported
 * dynamically so that in memory mode we never load `pg` or open a pool —
 * the app boots with no database present at all.
 */
export async function createRepositories(): Promise<Repositories> {
  if (env.PERSISTENCE === "database") {
    const [{ getDb }, { DrizzleUserRepository }, drizzleCases] =
      await Promise.all([
        import("../../../db/client.js"),
        import("./drizzle-user.repository.js"),
        import("./drizzle-case.repository.js"),
      ]);

    const db = getDb();
    return {
      users: new DrizzleUserRepository(db),
      cases: new drizzleCases.DrizzleCaseRepository(db),
      audit: new drizzleCases.DrizzleAuditRepository(db),
    };
  }

  return {
    users: new InMemoryUserRepository(),
    cases: new InMemoryCaseRepository(),
    audit: new InMemoryAuditRepository(),
  };
}
