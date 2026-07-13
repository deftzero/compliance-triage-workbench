import { CLOSURE_BLOCKERS, type Actor } from "@repo/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { ClosureBlockedError, ForbiddenError } from "../lib/errors.js";
import {
  InMemoryAuditRepository,
  InMemoryCaseRepository,
} from "../api/v1/repositories/in-memory-case.repository.js";
import { CaseService } from "../api/v1/services/case.service.js";

const manager: Actor = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Morgan Chase",
  role: "ComplianceManager",
};
const auditor: Actor = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Avery Quinn",
  role: "Auditor",
};
const reporter: Actor = {
  id: "33333333-3333-4333-8333-333333333333",
  name: "Riley Diaz",
  role: "Reporter",
};
const otherReporter: Actor = {
  id: "44444444-4444-4444-8444-444444444444",
  name: "Sam Vale",
  role: "Reporter",
};

let service: CaseService;
let audit: InMemoryAuditRepository;

beforeEach(() => {
  audit = new InMemoryAuditRepository();
  service = new CaseService(new InMemoryCaseRepository(), audit);
});

const lowRisk = {
  title: "Expense claim without receipt",
  description: "A claim was filed with no supporting receipt.",
  likelihood: "Low",
  impact: "Low",
} as const;

const criticalRisk = {
  title: "Bribery allegation",
  description: "Cash was offered to a tender official.",
  likelihood: "High",
  impact: "High",
} as const;

describe("reporting", () => {
  it("derives risk from likelihood and impact, ignoring anything a client might want (R7)", async () => {
    const reported = await service.report(reporter, criticalRisk);

    expect(reported.riskLevel).toBe("Critical");
    expect(reported.status).toBe("Reported");
    expect(reported.reporterId).toBe(reporter.id);
  });

  it("rejects an Auditor filing a case", async () => {
    await expect(service.report(auditor, lowRisk)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("logs a Reported audit entry with the server-set actor", async () => {
    const reported = await service.report(reporter, lowRisk);
    const trail = await service.listAudit(reporter, reported.id);

    expect(trail).toHaveLength(1);
    expect(trail[0]?.action).toBe("Reported");
    expect(trail[0]?.actorId).toBe(reporter.id);
    expect(trail[0]?.actorRole).toBe("Reporter");
  });
});

describe("triage (R6)", () => {
  const triageInput = {
    decision: "Accepted",
    investigationRequired: false,
    correctiveActionRequired: false,
  } as const;

  it("moves a Reported case to Triaged for a Compliance Manager", async () => {
    const reported = await service.report(reporter, lowRisk);
    const triaged = await service.triage(manager, reported.id, triageInput);

    expect(triaged.status).toBe("Triaged");
    expect(triaged.triageDecision).toBe("Accepted");
    expect(triaged.triagedBy).toBe(manager.id);
    expect(triaged.triagedAt).not.toBeNull();
  });

  it("rejects a Reporter triaging their own case", async () => {
    const reported = await service.report(reporter, lowRisk);

    await expect(
      service.triage(reporter, reported.id, triageInput),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects an Auditor triaging", async () => {
    const reported = await service.report(reporter, lowRisk);

    await expect(
      service.triage(auditor, reported.id, triageInput),
    ).rejects.toThrow(ForbiddenError);
  });

  it("recomputes risk when triage adjusts the inputs, and logs the change (R7/R10)", async () => {
    const reported = await service.report(reporter, lowRisk);
    expect(reported.riskLevel).toBe("Low");

    const triaged = await service.triage(manager, reported.id, {
      ...triageInput,
      likelihood: "High",
      impact: "High",
    });

    expect(triaged.riskLevel).toBe("Critical");

    const trail = await service.listAudit(manager, reported.id);
    const riskEntry = trail.find((e) => e.action === "RiskInputsUpdated");
    expect(riskEntry?.changes).toContainEqual({
      field: "riskLevel",
      oldValue: "Low",
      newValue: "Critical",
    });
  });

  it("writes exactly one Triaged entry (R9)", async () => {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, triageInput);

    const trail = await service.listAudit(manager, reported.id);
    expect(trail.filter((e) => e.action === "Triaged")).toHaveLength(1);
  });

  it("leaves no audit trail behind a rejected attempt (R9)", async () => {
    const reported = await service.report(reporter, lowRisk);

    await expect(
      service.triage(auditor, reported.id, triageInput),
    ).rejects.toThrow(ForbiddenError);

    const trail = await service.listAudit(manager, reported.id);
    expect(trail.map((e) => e.action)).toEqual(["Reported"]);
  });
});

describe("closing (R1-R4)", () => {
  it("blocks closing a case that was never triaged (R1)", async () => {
    const reported = await service.report(reporter, lowRisk);

    const error = await service.close(manager, reported.id).catch((e) => e);
    expect(error).toBeInstanceOf(ClosureBlockedError);
    expect((error as ClosureBlockedError).blockers).toContain(
      CLOSURE_BLOCKERS.notTriaged,
    );
  });

  it("returns every outstanding blocker at once, not just the first (§5)", async () => {
    const reported = await service.report(reporter, criticalRisk);
    await service.triage(manager, reported.id, {
      decision: "Escalated",
      investigationRequired: true,
      correctiveActionRequired: true,
    });

    const error = (await service
      .close(manager, reported.id)
      .catch((e) => e)) as ClosureBlockedError;

    expect(error.blockers).toEqual([
      CLOSURE_BLOCKERS.reviewNoteRequired,
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);
  });

  it("closes once every blocker is satisfied", async () => {
    const reported = await service.report(reporter, criticalRisk);
    await service.triage(manager, reported.id, {
      decision: "Escalated",
      investigationRequired: true,
      correctiveActionRequired: true,
    });
    await service.update(manager, reported.id, {
      reviewNote: "Reviewed with legal.",
      investigationOutcome: "Substantiated; contract cancelled.",
      correctiveActionStatus: "Closed",
    });

    const closed = await service.close(manager, reported.id);

    expect(closed.status).toBe("Closed");
    expect(closed.closedAt).not.toBeNull();
    expect(closed.closedBy).toBe(manager.id);
  });

  it("rejects a Reporter closing (R6)", async () => {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
    });

    await expect(service.close(reporter, reported.id)).rejects.toThrow(
      ForbiddenError,
    );
  });
});

describe("immutability of a closed case (R5/R8)", () => {
  async function closedCase() {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
    });
    return service.close(manager, reported.id);
  }

  it("rejects updating a closed case", async () => {
    const closed = await closedCase();

    await expect(
      service.update(manager, closed.id, { reviewNote: "tampering" }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects re-triaging a closed case", async () => {
    const closed = await closedCase();

    await expect(
      service.triage(manager, closed.id, {
        decision: "Dismissed",
        investigationRequired: false,
        correctiveActionRequired: false,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it("rejects re-closing, so closedAt is written exactly once (R8)", async () => {
    const closed = await closedCase();
    const firstClosedAt = closed.closedAt;

    await expect(service.close(manager, closed.id)).rejects.toThrow(
      ForbiddenError,
    );

    const reloaded = await service.getById(manager, closed.id);
    expect(reloaded.closedAt).toBe(firstClosedAt);
  });
});

describe("field-level audit (R10)", () => {
  it("logs one entry per changed field, with its own action label", async () => {
    const reported = await service.report(reporter, criticalRisk);
    await service.triage(manager, reported.id, {
      decision: "Escalated",
      investigationRequired: true,
      correctiveActionRequired: false,
    });

    await service.update(manager, reported.id, {
      reviewNote: "Reviewed.",
      investigationOutcome: "Substantiated.",
    });

    const trail = await service.listAudit(manager, reported.id);
    const actions = trail.map((e) => e.action);

    expect(actions).toContain("ReviewNoteUpdated");
    expect(actions).toContain("InvestigationOutcomeRecorded");
    // Corrective action wasn't touched, so it must not appear.
    expect(actions).not.toContain("CorrectiveActionUpdated");
  });

  it("records old -> new values", async () => {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
    });
    await service.update(manager, reported.id, { reviewNote: "First note." });
    await service.update(manager, reported.id, { reviewNote: "Second note." });

    const trail = await service.listAudit(manager, reported.id);
    const latest = trail[0];

    expect(latest?.action).toBe("ReviewNoteUpdated");
    expect(latest?.changes).toEqual([
      { field: "reviewNote", oldValue: "First note.", newValue: "Second note." },
    ]);
  });

  it("writes nothing when a mutation changes nothing", async () => {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
    });
    await service.update(manager, reported.id, { reviewNote: "Same note." });

    const before = await service.listAudit(manager, reported.id);
    await service.update(manager, reported.id, { reviewNote: "Same note." });
    const after = await service.listAudit(manager, reported.id);

    expect(after).toHaveLength(before.length);
  });

  it("is newest-first even when one operation writes several entries", async () => {
    const reported = await service.report(reporter, lowRisk);
    await service.triage(manager, reported.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
      likelihood: "High",
      impact: "High",
    });

    const trail = await service.listAudit(manager, reported.id);
    // Triage emits RiskInputsUpdated then Triaged with an identical timestamp;
    // insertion order must still decide.
    expect(trail.map((e) => e.action)).toEqual([
      "Triaged",
      "RiskInputsUpdated",
      "Reported",
    ]);
  });
});

describe("reporter scoping", () => {
  it("hides other reporters' cases from the list", async () => {
    await service.report(reporter, lowRisk);
    await service.report(otherReporter, criticalRisk);

    expect(await service.list(reporter, {})).toHaveLength(1);
    expect(await service.list(manager, {})).toHaveLength(2);
    expect(await service.list(auditor, {})).toHaveLength(2);
  });

  it("rejects a Reporter opening someone else's case", async () => {
    const theirs = await service.report(otherReporter, lowRisk);

    await expect(service.getById(reporter, theirs.id)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("lets an Auditor read any case and its trail, but mutate nothing", async () => {
    const reported = await service.report(reporter, lowRisk);

    await expect(
      service.getById(auditor, reported.id),
    ).resolves.toMatchObject({ id: reported.id });
    await expect(
      service.listAudit(auditor, reported.id),
    ).resolves.toHaveLength(1);
    await expect(
      service.update(auditor, reported.id, { reviewNote: "no" }),
    ).rejects.toThrow(ForbiddenError);
  });
});

describe("filtering", () => {
  it("filters by status, risk level, and free text", async () => {
    const low = await service.report(reporter, lowRisk);
    await service.report(reporter, criticalRisk);
    await service.triage(manager, low.id, {
      decision: "Accepted",
      investigationRequired: false,
      correctiveActionRequired: false,
    });

    expect(await service.list(manager, { status: "Triaged" })).toHaveLength(1);
    expect(await service.list(manager, { riskLevel: "Critical" })).toHaveLength(
      1,
    );
    expect(await service.list(manager, { q: "bribery" })).toHaveLength(1);
    expect(await service.list(manager, { q: "receipt" })).toHaveLength(1);
    expect(await service.list(manager, { q: "nothing matches" })).toHaveLength(
      0,
    );
  });
});
