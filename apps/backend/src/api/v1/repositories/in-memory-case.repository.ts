import type { AuditEntry, CaseFilter, ComplianceCase } from "@repo/shared";
import {
  matchesFilter,
  type AuditRepository,
  type CaseRepository,
} from "./case.repository.js";

const newestFirst = (a: ComplianceCase, b: ComplianceCase) =>
  b.createdAt.localeCompare(a.createdAt);

export class InMemoryCaseRepository implements CaseRepository {
  private readonly cases = new Map<string, ComplianceCase>();

  async findAll(filter?: CaseFilter): Promise<ComplianceCase[]> {
    return [...this.cases.values()]
      .filter((c) => matchesFilter(c, filter))
      .sort(newestFirst);
  }

  async findByReporter(
    reporterId: string,
    filter?: CaseFilter,
  ): Promise<ComplianceCase[]> {
    const all = await this.findAll(filter);
    return all.filter((c) => c.reporterId === reporterId);
  }

  async findById(id: string): Promise<ComplianceCase | null> {
    return this.cases.get(id) ?? null;
  }

  async create(complianceCase: ComplianceCase): Promise<ComplianceCase> {
    this.cases.set(complianceCase.id, complianceCase);
    return complianceCase;
  }

  async save(complianceCase: ComplianceCase): Promise<ComplianceCase> {
    this.cases.set(complianceCase.id, complianceCase);
    return complianceCase;
  }
}

export class InMemoryAuditRepository implements AuditRepository {
  // A single operation can emit several entries sharing one timestamp (triage
  // writes RiskInputsUpdated + Triaged), so insertion order breaks the tie and
  // keeps "newest first" deterministic.
  private readonly entries: { seq: number; entry: AuditEntry }[] = [];
  private seq = 0;

  async append(entry: AuditEntry): Promise<AuditEntry> {
    this.entries.push({ seq: this.seq++, entry });
    return entry;
  }

  async appendMany(entries: AuditEntry[]): Promise<AuditEntry[]> {
    for (const entry of entries) await this.append(entry);
    return entries;
  }

  async listByCase(caseId: string): Promise<AuditEntry[]> {
    return this.entries
      .filter(({ entry }) => entry.caseId === caseId)
      .sort((a, b) => b.seq - a.seq)
      .map(({ entry }) => entry);
  }
}
