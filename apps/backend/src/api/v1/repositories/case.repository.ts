import type { AuditEntry, CaseFilter, ComplianceCase } from "@repo/shared";

export interface CaseRepository {
  findAll(filter?: CaseFilter): Promise<ComplianceCase[]>;
  findByReporter(
    reporterId: string,
    filter?: CaseFilter,
  ): Promise<ComplianceCase[]>;
  findById(id: string): Promise<ComplianceCase | null>;
  create(complianceCase: ComplianceCase): Promise<ComplianceCase>;
  save(complianceCase: ComplianceCase): Promise<ComplianceCase>;
}

/**
 * Append-only by construction: there is no update or delete method to call.
 * The audit trail can't be rewritten because the interface offers no way to.
 */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<AuditEntry>;
  appendMany(entries: AuditEntry[]): Promise<AuditEntry[]>;
  /** Newest first. */
  listByCase(caseId: string): Promise<AuditEntry[]>;
}

/** Shared filter logic so memory and Drizzle impls agree on what `q` means. */
export function matchesFilter(
  complianceCase: ComplianceCase,
  filter?: CaseFilter,
): boolean {
  if (!filter) return true;

  if (filter.status && complianceCase.status !== filter.status) return false;
  if (filter.riskLevel && complianceCase.riskLevel !== filter.riskLevel) {
    return false;
  }

  if (filter.q) {
    const needle = filter.q.toLowerCase();
    const haystack =
      `${complianceCase.title} ${complianceCase.description}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }

  return true;
}
