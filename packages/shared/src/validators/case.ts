import { z } from "zod";
import { CATEGORY_OPTIONS } from "../domain/constants.js";

export const riskLevelSchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const caseStatusSchema = z.enum(["Reported", "Triaged", "Closed"]);
export const triageDecisionSchema = z.enum([
  "Accepted",
  "Escalated",
  "Dismissed",
]);
export const correctiveActionStatusSchema = z.enum(["Open", "Closed"]);
export const likelihoodImpactSchema = z.enum(["Low", "Medium", "High"]);

export const categorySchema = z.enum(CATEGORY_OPTIONS);

export const auditActionSchema = z.enum([
  "Reported",
  "Triaged",
  "ReviewNoteUpdated",
  "InvestigationOutcomeRecorded",
  "CorrectiveActionUpdated",
  "RiskInputsUpdated",
  "Closed",
]);

export const caseSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category: categorySchema.nullable(),

  // Risk inputs are supplied; riskLevel is always derived from them.
  likelihood: likelihoodImpactSchema,
  impact: likelihoodImpactSchema,
  riskLevel: riskLevelSchema,

  status: caseStatusSchema,
  reporterId: z.uuid(),

  triageDecision: triageDecisionSchema.nullable(),
  triagedAt: z.iso.datetime().nullable(),
  triagedBy: z.uuid().nullable(),
  investigationRequired: z.boolean().nullable(),
  correctiveActionRequired: z.boolean().nullable(),

  reviewNote: z.string().max(5000).nullable(),
  investigationOutcome: z.string().max(5000).nullable(),
  correctiveActionStatus: correctiveActionStatusSchema.nullable(),

  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
  closedBy: z.uuid().nullable(),
});

/** What a reporter may supply. No id, status, or riskLevel — those are server-derived (R7). */
export const createCaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(5000),
  likelihood: likelihoodImpactSchema,
  impact: likelihoodImpactSchema,
  category: categorySchema.optional(),
});

export const triageInputSchema = z.object({
  decision: triageDecisionSchema,
  investigationRequired: z.boolean(),
  correctiveActionRequired: z.boolean(),
  // Optional risk-input adjustments; supplying either recomputes riskLevel.
  likelihood: likelihoodImpactSchema.optional(),
  impact: likelihoodImpactSchema.optional(),
});

/** Every field optional — but at least one must be present, or there's nothing to audit. */
export const updateCaseSchema = z
  .object({
    reviewNote: z.string().max(5000).optional(),
    investigationOutcome: z.string().max(5000).optional(),
    correctiveActionStatus: correctiveActionStatusSchema.optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export const caseFilterSchema = z.object({
  status: caseStatusSchema.optional(),
  riskLevel: riskLevelSchema.optional(),
  q: z.string().max(200).optional(),
});

export const fieldChangeSchema = z.object({
  field: z.string(),
  oldValue: z.string().nullable(),
  newValue: z.string().nullable(),
});

export const auditEntrySchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  action: auditActionSchema,
  actorId: z.uuid(),
  actorName: z.string(),
  actorRole: z.string(),
  timestamp: z.iso.datetime(),
  changes: z.array(fieldChangeSchema),
});

export const closureStatusSchema = z.object({
  ready: z.boolean(),
  blockers: z.array(z.string()),
});
