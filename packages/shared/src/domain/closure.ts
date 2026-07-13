import type { ClosureStatus, ComplianceCase } from "../types/case";
import { CLOSURE_BLOCKERS } from "./constants";

/** The fields closure readiness actually depends on — lets callers pass a draft. */
export type ClosureInput = Pick<
  ComplianceCase,
  | "status"
  | "riskLevel"
  | "reviewNote"
  | "investigationRequired"
  | "investigationOutcome"
  | "correctiveActionRequired"
  | "correctiveActionStatus"
>;

function isBlank(value: string | null | undefined): boolean {
  return value === null || value === undefined || value.trim() === "";
}

/**
 * Returns *every* applicable blocker, not just the first — the user should see
 * the full list of what's outstanding in one pass rather than discovering them
 * one failed close at a time.
 *
 * The same function backs the API's close guard and the UI's readiness badge,
 * so the check and its enforcement cannot diverge.
 */
export function getClosureStatus(input: ClosureInput): ClosureStatus {
  // An already-closed case has nothing outstanding and is not "ready to close".
  // Reporting R1's blocker here would claim a finished case was never triaged.
  if (input.status === "Closed") {
    return { ready: false, blockers: [] };
  }

  const blockers: string[] = [];

  // R1 — must be triaged first.
  if (input.status !== "Triaged") {
    blockers.push(CLOSURE_BLOCKERS.notTriaged);
  }

  // R2 — high-severity cases need a written review note.
  const highSeverity =
    input.riskLevel === "High" || input.riskLevel === "Critical";
  if (highSeverity && isBlank(input.reviewNote)) {
    blockers.push(CLOSURE_BLOCKERS.reviewNoteRequired);
  }

  // R3 — if triage said an investigation was needed, it must have an outcome.
  if (input.investigationRequired && isBlank(input.investigationOutcome)) {
    blockers.push(CLOSURE_BLOCKERS.investigationOutcomeMissing);
  }

  // R4 — a required corrective action must itself be closed.
  if (
    input.correctiveActionRequired &&
    input.correctiveActionStatus !== "Closed"
  ) {
    blockers.push(CLOSURE_BLOCKERS.correctiveActionOpen);
  }

  return { ready: blockers.length === 0, blockers };
}
