import {
  getClosureStatus,
  type Actor,
  type AuditEntry,
  type CaseFilter,
  type ClosureStatus,
  type ComplianceCase,
  type CreateCaseInput,
  type TriageInput,
  type UpdateCaseInput,
} from "@repo/shared";
import { ForbiddenError, NotFoundError } from "../../../lib/errors";
import type { AuditRepository, CaseRepository } from "../repositories/index";
import {
  assertCanViewCase,
  closeCase,
  reportCase,
  triageCase,
  updateCase,
  type DomainResult,
} from "./case-domain";

/** A case plus its server-computed readiness, which the client never derives itself. */
export type CaseView = ComplianceCase & { closureStatus: ClosureStatus };

function withClosureStatus(complianceCase: ComplianceCase): CaseView {
  return { ...complianceCase, closureStatus: getClosureStatus(complianceCase) };
}

/**
 * Thin orchestration around the domain: load, apply a pure rule function,
 * persist the result and its audit entries. Every rule decision happens in
 * `case-domain.ts`, so calling these methods directly — bypassing GraphQL
 * entirely — still enforces R1-R10.
 */
export class CaseService {
  constructor(
    private readonly cases: CaseRepository,
    private readonly audit: AuditRepository,
  ) {}

  async list(actor: Actor, filter?: CaseFilter): Promise<CaseView[]> {
    // Reporters are scoped to their own cases at the query, not filtered later.
    const found =
      actor.role === "Reporter"
        ? await this.cases.findByReporter(actor.id, filter)
        : await this.cases.findAll(filter);

    return found.map(withClosureStatus);
  }

  async getById(actor: Actor, id: string): Promise<CaseView> {
    const found = await this.cases.findById(id);
    if (!found) throw new NotFoundError(`No case with id ${id}`);

    assertCanViewCase(actor, found);
    return withClosureStatus(found);
  }

  async listAudit(actor: Actor, caseId: string): Promise<AuditEntry[]> {
    // Reuses the same view check, so a Reporter can't read another's trail.
    await this.getById(actor, caseId);
    return this.audit.listByCase(caseId);
  }

  async report(actor: Actor, input: CreateCaseInput): Promise<CaseView> {
    const result = reportCase(actor, input);
    await this.cases.create(result.case);
    await this.audit.appendMany(result.audits);
    return withClosureStatus(result.case);
  }

  async triage(
    actor: Actor,
    id: string,
    input: TriageInput,
  ): Promise<CaseView> {
    return this.mutate(actor, id, (current) => triageCase(actor, current, input));
  }

  async update(
    actor: Actor,
    id: string,
    input: UpdateCaseInput,
  ): Promise<CaseView> {
    return this.mutate(actor, id, (current) =>
      updateCase(actor, current, input),
    );
  }

  /** Throws ClosureBlockedError carrying the full blocker list when not ready. */
  async close(actor: Actor, id: string): Promise<CaseView> {
    return this.mutate(actor, id, (current) => closeCase(actor, current));
  }

  private async mutate(
    actor: Actor,
    id: string,
    apply: (current: ComplianceCase) => DomainResult,
  ): Promise<CaseView> {
    const current = await this.cases.findById(id);
    if (!current) throw new NotFoundError(`No case with id ${id}`);

    // A Reporter must not learn about cases that aren't theirs, even to be
    // told "forbidden" — so the visibility check runs before the role check.
    if (actor.role === "Reporter" && current.reporterId !== actor.id) {
      throw new NotFoundError(`No case with id ${id}`);
    }
    if (actor.role === "Auditor") {
      throw new ForbiddenError("Auditors have read-only access.");
    }

    const result = apply(current);
    await this.cases.save(result.case);
    await this.audit.appendMany(result.audits);

    return withClosureStatus(result.case);
  }
}
