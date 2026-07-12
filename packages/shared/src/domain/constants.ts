/**
 * Blocker text is exported rather than inlined so the API's rejection payload
 * and the UI's blocker list are literally the same strings and cannot drift.
 */
export const CLOSURE_BLOCKERS = {
  notTriaged: "Case has not been triaged yet.",
  reviewNoteRequired: "Review note is required for High/Critical risk cases.",
  investigationOutcomeMissing: "Investigation outcome is missing.",
  correctiveActionOpen: "Corrective action is still open.",
} as const;

export const CASE_CLOSED_MESSAGE =
  "This case is closed and can no longer be modified.";

export const CATEGORY_OPTIONS = [
  "Safety",
  "Health and Safety",
  "Legal / Insurance",
  "Clinical equipment",
  "Waste management",
  "Clinical records",
  "Medication",
  "Staff conduct",
  "Data breach",
  "Other",
] as const;

export const ROLE_LABELS = {
  ComplianceManager: "Compliance Manager",
  Auditor: "Auditor",
  Reporter: "Reporter",
} as const;

export const AUDIT_ACTION_LABELS = {
  Reported: "Reported",
  Triaged: "Triaged",
  ReviewNoteUpdated: "Review note updated",
  InvestigationOutcomeRecorded: "Investigation outcome recorded",
  CorrectiveActionUpdated: "Corrective action updated",
  RiskInputsUpdated: "Risk inputs updated",
  Closed: "Closed",
} as const;
