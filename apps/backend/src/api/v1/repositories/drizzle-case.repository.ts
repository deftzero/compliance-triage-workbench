import type { AuditEntry, CaseFilter, ComplianceCase } from "@repo/shared";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Db } from "../../../db/client.js";
import {
  auditEntries,
  cases,
  type AuditRow,
  type CaseRow,
} from "../../../db/schema.js";
import type { AuditRepository, CaseRepository } from "./case.repository.js";

/** Rows carry Dates; the shared contract carries ISO strings. */
function toCase(row: CaseRow): ComplianceCase {
  return {
    ...row,
    triagedAt: row.triagedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    closedAt: row.closedAt?.toISOString() ?? null,
  };
}

function toAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    caseId: row.caseId,
    action: row.action,
    actorId: row.actorId,
    actorName: row.actorName,
    actorRole: row.actorRole,
    timestamp: row.timestamp.toISOString(),
    changes: row.changes,
  };
}

function toRow(complianceCase: ComplianceCase) {
  return {
    ...complianceCase,
    triagedAt: complianceCase.triagedAt
      ? new Date(complianceCase.triagedAt)
      : null,
    createdAt: new Date(complianceCase.createdAt),
    closedAt: complianceCase.closedAt ? new Date(complianceCase.closedAt) : null,
  };
}

function buildWhere(filter?: CaseFilter): SQL | undefined {
  const conditions: SQL[] = [];

  if (filter?.status) conditions.push(eq(cases.status, filter.status));
  if (filter?.riskLevel) conditions.push(eq(cases.riskLevel, filter.riskLevel));

  if (filter?.q) {
    const pattern = `%${filter.q}%`;
    const search = or(
      ilike(cases.title, pattern),
      ilike(cases.description, pattern),
    );
    if (search) conditions.push(search);
  }

  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class DrizzleCaseRepository implements CaseRepository {
  constructor(private readonly db: Db) {}

  async findAll(filter?: CaseFilter): Promise<ComplianceCase[]> {
    const rows = await this.db
      .select()
      .from(cases)
      .where(buildWhere(filter))
      .orderBy(desc(cases.createdAt));
    return rows.map(toCase);
  }

  async findByReporter(
    reporterId: string,
    filter?: CaseFilter,
  ): Promise<ComplianceCase[]> {
    const where = buildWhere(filter);
    const scoped = where
      ? and(eq(cases.reporterId, reporterId), where)
      : eq(cases.reporterId, reporterId);

    const rows = await this.db
      .select()
      .from(cases)
      .where(scoped)
      .orderBy(desc(cases.createdAt));
    return rows.map(toCase);
  }

  async findById(id: string): Promise<ComplianceCase | null> {
    const [row] = await this.db
      .select()
      .from(cases)
      .where(eq(cases.id, id))
      .limit(1);
    return row ? toCase(row) : null;
  }

  async create(complianceCase: ComplianceCase): Promise<ComplianceCase> {
    const [row] = await this.db
      .insert(cases)
      .values(toRow(complianceCase))
      .returning();
    if (!row) throw new Error("Insert returned no row");
    return toCase(row);
  }

  async save(complianceCase: ComplianceCase): Promise<ComplianceCase> {
    const [row] = await this.db
      .update(cases)
      .set(toRow(complianceCase))
      .where(eq(cases.id, complianceCase.id))
      .returning();
    if (!row) throw new Error("Update matched no row");
    return toCase(row);
  }
}

/** No update or delete method exists here, by design — the trail is append-only. */
export class DrizzleAuditRepository implements AuditRepository {
  constructor(private readonly db: Db) {}

  async append(entry: AuditEntry): Promise<AuditEntry> {
    const [result] = await this.appendMany([entry]);
    if (!result) throw new Error("Insert returned no row");
    return result;
  }

  async appendMany(entries: AuditEntry[]): Promise<AuditEntry[]> {
    if (entries.length === 0) return [];

    const rows = await this.db
      .insert(auditEntries)
      .values(
        entries.map((entry) => ({
          ...entry,
          timestamp: new Date(entry.timestamp),
        })),
      )
      .returning();
    return rows.map(toAudit);
  }

  async listByCase(caseId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.caseId, caseId))
      .orderBy(desc(auditEntries.seq));
    return rows.map(toAudit);
  }
}
