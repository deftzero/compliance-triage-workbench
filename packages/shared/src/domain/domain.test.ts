import { describe, expect, it } from "vitest";
import type { ComplianceCase, LikelihoodImpact } from "../types/case.js";
import { getClosureStatus } from "./closure.js";
import { CLOSURE_BLOCKERS } from "./constants.js";
import { diffFields } from "./diff.js";
import { calculateRiskLevel } from "./risk.js";

describe("calculateRiskLevel", () => {
  const cases: [LikelihoodImpact, LikelihoodImpact, string][] = [
    ["Low", "Low", "Low"],
    ["Low", "Medium", "Low"],
    ["Medium", "Low", "Low"],
    ["Low", "High", "Medium"],
    ["High", "Low", "Medium"],
    ["Medium", "Medium", "Medium"],
    ["Medium", "High", "High"],
    ["High", "Medium", "High"],
    ["High", "High", "Critical"],
  ];

  it.each(cases)("%s likelihood x %s impact -> %s", (l, i, expected) => {
    expect(calculateRiskLevel(l, i)).toBe(expected);
  });

  it("is symmetric in its inputs", () => {
    const levels: LikelihoodImpact[] = ["Low", "Medium", "High"];
    for (const l of levels) {
      for (const i of levels) {
        expect(calculateRiskLevel(l, i)).toBe(calculateRiskLevel(i, l));
      }
    }
  });

  it("only reaches Critical when both inputs are High", () => {
    const levels: LikelihoodImpact[] = ["Low", "Medium", "High"];
    for (const l of levels) {
      for (const i of levels) {
        const isCritical = calculateRiskLevel(l, i) === "Critical";
        expect(isCritical).toBe(l === "High" && i === "High");
      }
    }
  });

  it("never drops below Medium when either input is High", () => {
    const levels: LikelihoodImpact[] = ["Low", "Medium", "High"];
    for (const other of levels) {
      expect(calculateRiskLevel("High", other)).not.toBe("Low");
      expect(calculateRiskLevel(other, "High")).not.toBe("Low");
    }
  });
});

/** A triaged, low-risk case with nothing outstanding — closure-ready. */
function baseCase(overrides: Partial<ComplianceCase> = {}): ComplianceCase {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Expense policy breach",
    description: "Reported by finance.",
    category: null,
    likelihood: "Low",
    impact: "Low",
    riskLevel: "Low",
    status: "Triaged",
    reporterId: "22222222-2222-4222-8222-222222222222",
    triageDecision: "Accepted",
    triagedAt: "2026-05-01T10:00:00.000Z",
    triagedBy: "33333333-3333-4333-8333-333333333333",
    investigationRequired: false,
    correctiveActionRequired: false,
    reviewNote: null,
    investigationOutcome: null,
    correctiveActionStatus: null,
    createdAt: "2026-05-01T09:00:00.000Z",
    closedAt: null,
    closedBy: null,
    ...overrides,
  };
}

describe("getClosureStatus", () => {
  it("is ready when triaged with nothing outstanding", () => {
    expect(getClosureStatus(baseCase())).toEqual({ ready: true, blockers: [] });
  });

  it("blocks an untriaged case (R1)", () => {
    const status = getClosureStatus(baseCase({ status: "Reported" }));
    expect(status.ready).toBe(false);
    expect(status.blockers).toContain(CLOSURE_BLOCKERS.notTriaged);
  });

  it.each(["High", "Critical"] as const)(
    "blocks %s risk without a review note (R2)",
    (riskLevel) => {
      const status = getClosureStatus(baseCase({ riskLevel }));
      expect(status.blockers).toContain(CLOSURE_BLOCKERS.reviewNoteRequired);
    },
  );

  it("treats a whitespace-only review note as missing (R2)", () => {
    const status = getClosureStatus(
      baseCase({ riskLevel: "High", reviewNote: "   " }),
    );
    expect(status.blockers).toContain(CLOSURE_BLOCKERS.reviewNoteRequired);
  });

  it("accepts a High-risk case once a review note exists (R2)", () => {
    const status = getClosureStatus(
      baseCase({ riskLevel: "High", reviewNote: "Reviewed with legal." }),
    );
    expect(status).toEqual({ ready: true, blockers: [] });
  });

  it("does not require a review note for Low/Medium risk (R2)", () => {
    expect(getClosureStatus(baseCase({ riskLevel: "Medium" })).ready).toBe(true);
  });

  it("blocks when an investigation is required but has no outcome (R3)", () => {
    const status = getClosureStatus(
      baseCase({ investigationRequired: true, investigationOutcome: null }),
    );
    expect(status.blockers).toContain(
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
    );
  });

  it("blocks when a required corrective action is still open (R4)", () => {
    const status = getClosureStatus(
      baseCase({
        correctiveActionRequired: true,
        correctiveActionStatus: "Open",
      }),
    );
    expect(status.blockers).toContain(CLOSURE_BLOCKERS.correctiveActionOpen);
  });

  it("blocks when a required corrective action was never started (R4)", () => {
    const status = getClosureStatus(
      baseCase({
        correctiveActionRequired: true,
        correctiveActionStatus: null,
      }),
    );
    expect(status.blockers).toContain(CLOSURE_BLOCKERS.correctiveActionOpen);
  });

  // The §5 contract: the caller should see everything outstanding at once,
  // not discover blockers one failed close at a time.
  it("returns every applicable blocker together", () => {
    const status = getClosureStatus(
      baseCase({
        status: "Reported",
        riskLevel: "Critical",
        reviewNote: null,
        investigationRequired: true,
        investigationOutcome: null,
        correctiveActionRequired: true,
        correctiveActionStatus: "Open",
      }),
    );

    expect(status.ready).toBe(false);
    expect(status.blockers).toEqual([
      CLOSURE_BLOCKERS.notTriaged,
      CLOSURE_BLOCKERS.reviewNoteRequired,
      CLOSURE_BLOCKERS.investigationOutcomeMissing,
      CLOSURE_BLOCKERS.correctiveActionOpen,
    ]);
  });
});

describe("diffFields", () => {
  it("reports only fields that actually changed", () => {
    const before = baseCase({ reviewNote: null, riskLevel: "Low" });
    const after = baseCase({ reviewNote: "Reviewed.", riskLevel: "Low" });

    expect(diffFields(before, after, ["reviewNote", "riskLevel"])).toEqual([
      { field: "reviewNote", oldValue: null, newValue: "Reviewed." },
    ]);
  });

  it("returns nothing when a mutation changed nothing", () => {
    const unchanged = baseCase();
    expect(
      diffFields(unchanged, unchanged, ["reviewNote", "status", "riskLevel"]),
    ).toEqual([]);
  });

  it("serializes non-string values and preserves null as null", () => {
    const before = baseCase({ investigationRequired: false });
    const after = baseCase({ investigationRequired: true });

    expect(diffFields(before, after, ["investigationRequired"])).toEqual([
      { field: "investigationRequired", oldValue: "false", newValue: "true" },
    ]);
  });
});
