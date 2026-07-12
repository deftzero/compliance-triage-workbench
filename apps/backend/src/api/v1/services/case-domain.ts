import {
  CASE_CLOSED_MESSAGE,
  calculateRiskLevel,
  diffFields,
  getClosureStatus,
  type Actor,
  type AuditAction,
  type AuditEntry,
  type ComplianceCase,
  type CreateCaseInput,
  type FieldChange,
  type TriageInput,
  type UpdateCaseInput,
} from "@repo/shared";
import { randomUUID } from "node:crypto";
import {
  ClosureBlockedError,
  ForbiddenError,
} from "../../../lib/errors.js";

/**
 * The result of a domain operation: the new case state plus the audit entries
 * it produced. Nothing here touches Express, GraphQL, or a database — the rules
 * are decided against plain data, so they hold no matter who calls them.
 */
export type DomainResult = {
  case: ComplianceCase;
  audits: AuditEntry[];
};

/** Fields the audit trail tracks. Anything not listed here is never logged. */
const AUDITED_FIELDS = [
  "likelihood",
  "impact",
  "riskLevel",
  "status",
  "triageDecision",
  "investigationRequired",
  "correctiveActionRequired",
  "reviewNote",
  "investigationOutcome",
  "correctiveActionStatus",
  "closedAt",
] as const satisfies readonly (keyof ComplianceCase)[];

type Clock = () => string;

const systemClock: Clock = () => new Date().toISOString();

function auditEntry(
  actor: Actor,
  caseId: string,
  action: AuditAction,
  changes: FieldChange[],
  now: string,
): AuditEntry {
  return {
    id: randomUUID(),
    caseId,
    action,
    // Actor and timestamp are set here, server-side — never taken from input (R10).
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
    timestamp: now,
    changes,
  };
}

/** R6 — only a Compliance Manager may triage, close, or edit workflow fields. */
function assertIsComplianceManager(actor: Actor): void {
  if (actor.role !== "ComplianceManager") {
    throw new ForbiddenError(
      "Only a Compliance Manager may perform this action.",
    );
  }
}

/** R5 — a closed case is immutable, whoever is asking. */
function assertNotClosed(current: ComplianceCase): void {
  if (current.status === "Closed") {
    throw new ForbiddenError(CASE_CLOSED_MESSAGE);
  }
}

/** Reporters only ever see their own cases; CM and Auditor see everything. */
export function canViewCase(actor: Actor, current: ComplianceCase): boolean {
  if (actor.role === "Reporter") return current.reporterId === actor.id;
  return true;
}

export function assertCanViewCase(
  actor: Actor,
  current: ComplianceCase,
): void {
  if (!canViewCase(actor, current)) {
    throw new ForbiddenError("You may only view cases you reported.");
  }
}

export function reportCase(
  actor: Actor,
  input: CreateCaseInput,
  now: Clock = systemClock,
): DomainResult {
  if (actor.role === "Auditor") {
    throw new ForbiddenError("Auditors have read-only access.");
  }

  const timestamp = now();
  const created: ComplianceCase = {
    id: randomUUID(),
    title: input.title,
    description: input.description,
    category: input.category ?? null,
    likelihood: input.likelihood,
    impact: input.impact,
    // R7 — derived, never accepted from the client.
    riskLevel: calculateRiskLevel(input.likelihood, input.impact),
    status: "Reported",
    reporterId: actor.id,
    triageDecision: null,
    triagedAt: null,
    triagedBy: null,
    investigationRequired: null,
    correctiveActionRequired: null,
    reviewNote: null,
    investigationOutcome: null,
    correctiveActionStatus: null,
    createdAt: timestamp,
    closedAt: null,
    closedBy: null,
  };

  const audit = auditEntry(
    actor,
    created.id,
    "Reported",
    [
      { field: "status", oldValue: null, newValue: created.status },
      { field: "riskLevel", oldValue: null, newValue: created.riskLevel },
    ],
    timestamp,
  );

  return { case: created, audits: [audit] };
}

export function triageCase(
  actor: Actor,
  current: ComplianceCase,
  input: TriageInput,
  now: Clock = systemClock,
): DomainResult {
  assertIsComplianceManager(actor); // R6
  assertNotClosed(current); // R5

  const timestamp = now();
  const likelihood = input.likelihood ?? current.likelihood;
  const impact = input.impact ?? current.impact;

  const triaged: ComplianceCase = {
    ...current,
    likelihood,
    impact,
    // R7 — recomputed from the (possibly adjusted) inputs, never hand-set.
    riskLevel: calculateRiskLevel(likelihood, impact),
    status: "Triaged",
    triageDecision: input.decision,
    triagedAt: timestamp,
    triagedBy: actor.id,
    investigationRequired: input.investigationRequired,
    correctiveActionRequired: input.correctiveActionRequired,
    correctiveActionStatus: input.correctiveActionRequired
      ? (current.correctiveActionStatus ?? "Open")
      : current.correctiveActionStatus,
  };

  const audits: AuditEntry[] = [];

  // An adjustment to the risk inputs is its own event, so the recomputed risk
  // is traceable to the person who changed the inputs.
  const riskChanges = diffFields(current, triaged, [
    "likelihood",
    "impact",
    "riskLevel",
  ]);
  if (riskChanges.length > 0) {
    audits.push(
      auditEntry(actor, current.id, "RiskInputsUpdated", riskChanges, timestamp),
    );
  }

  // R9 — exactly one Triaged entry per successful triage.
  audits.push(
    auditEntry(
      actor,
      current.id,
      "Triaged",
      diffFields(current, triaged, [
        "status",
        "triageDecision",
        "investigationRequired",
        "correctiveActionRequired",
        "correctiveActionStatus",
      ]),
      timestamp,
    ),
  );

  return { case: triaged, audits };
}

/** Each changed workflow field gets its own audit action label. */
const UPDATE_ACTIONS = {
  reviewNote: "ReviewNoteUpdated",
  investigationOutcome: "InvestigationOutcomeRecorded",
  correctiveActionStatus: "CorrectiveActionUpdated",
} as const satisfies Record<keyof UpdateCaseInput, AuditAction>;

export function updateCase(
  actor: Actor,
  current: ComplianceCase,
  input: UpdateCaseInput,
  now: Clock = systemClock,
): DomainResult {
  assertIsComplianceManager(actor); // R6
  assertNotClosed(current); // R5

  const timestamp = now();
  const updated: ComplianceCase = {
    ...current,
    reviewNote: input.reviewNote ?? current.reviewNote,
    investigationOutcome:
      input.investigationOutcome ?? current.investigationOutcome,
    correctiveActionStatus:
      input.correctiveActionStatus ?? current.correctiveActionStatus,
  };

  const audits: AuditEntry[] = [];
  for (const field of Object.keys(UPDATE_ACTIONS) as (keyof UpdateCaseInput)[]) {
    // R10 — only fields that actually changed produce an entry.
    const changes = diffFields(current, updated, [field]);
    if (changes.length === 0) continue;

    audits.push(
      auditEntry(actor, current.id, UPDATE_ACTIONS[field], changes, timestamp),
    );
  }

  return { case: updated, audits };
}

export function closeCase(
  actor: Actor,
  current: ComplianceCase,
  now: Clock = systemClock,
): DomainResult {
  assertIsComplianceManager(actor); // R6
  assertNotClosed(current); // R5 — a closed case cannot be re-closed.

  // R1-R4, via the same helper the UI renders its blocker list from.
  const closure = getClosureStatus(current);
  if (!closure.ready) {
    throw new ClosureBlockedError(closure.blockers);
  }

  const timestamp = now();
  const closed: ComplianceCase = {
    ...current,
    status: "Closed",
    // R8 — assertNotClosed above guarantees this is only ever written once.
    closedAt: timestamp,
    closedBy: actor.id,
  };

  const audit = auditEntry(
    actor,
    current.id,
    "Closed",
    diffFields(current, closed, ["status", "closedAt"]),
    timestamp,
  );

  return { case: closed, audits: [audit] };
}

export { AUDITED_FIELDS };
