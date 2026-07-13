import {
  InMemoryAuditRepository,
  InMemoryCaseRepository,
} from "./in-memory-case.repository";
import { InMemoryUserRepository } from "./in-memory-user.repository";
import type { AuditRepository, CaseRepository } from "./case.repository";
import type { UserRepository } from "./user.repository";

export type { AuditRepository, CaseRepository } from "./case.repository";
export type { UserRepository } from "./user.repository";

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
