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

export function createRepositories(): Repositories {
  return {
    users: new InMemoryUserRepository(),
    cases: new InMemoryCaseRepository(),
    audit: new InMemoryAuditRepository(),
  };
}
